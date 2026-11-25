import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Mic, Square, Check, Pencil, Loader2, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';
import { authHeaders } from '../../Shared/authHeaders';
import { requestMic } from '../../../utils/micPermission';
import { toWav } from './VoiceFill';

/**
 * Gouru AI review call — before the case goes to the admin, Gouru AI "calls" the engineer and asks about
 * anything that looks wrong. Questions are spoken aloud; the engineer answers by tapping, typing or voice.
 * The whole call is recorded (the engineer's side through the microphone) and kept with the case.
 *
 * props: questions [{ id, text, label, field, current, suggest, kind }]
 *        onApply(field, value)      — correct a field in the form
 *        onFinish({ log, blob, mime, seconds })
 *        onCancel()                 — engineer declined: nothing is submitted
 */
// What Gouru AI says besides the questions — natural Telugu, or English
const SAY = {
  greet: (n) => ({ te: `నమస్కారం అండి, నేను గౌరు AI. ఈ case admin కి పంపే ముందు ${n} విషయాలు మీతో ఒకసారి confirm చేసుకోవాలి. ఒక్క నిమిషం పడుతుంది అండి.`,
    en: `Hello, this is Gouru AI. Before this case goes to your admin, I need to confirm ${n} thing${n === 1 ? '' : 's'} with you. It will only take a minute.` }),
  keep: { te: 'సరే అండి, అలాగే ఉంచుతున్నాను.', en: 'Okay, I have kept it as it is.' },
  change: { te: 'సరే అండి, మార్చాను.', en: 'Done, I have changed it.' },
  explain: { te: 'అర్థమైంది అండి, మీ కారణం note చేసుకున్నాను.', en: 'Understood, I have noted your reason.' },
  heard: { te: 'సరే అండి, ఇది save చేయమంటారా?', en: 'Got it. Shall I save this?' },
  again: { te: 'క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి, లేదా screen మీద tap చేయండి.', en: 'Sorry, I could not hear that clearly. Please say it again, or tap an answer.' },
  bye: { te: 'ధన్యవాదాలు అండి. మీ answers save అయ్యాయి, case ఇప్పుడు admin కి వెళ్తుంది.', en: 'Thank you. Your answers are saved and the case is now going to your admin.' },
};

export default function AiReviewCall({ questions, onApply, onFinish, onCancel }) {
  const [phase, setPhase] = useState('ringing');   // ringing → call → saving
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [heard, setHeard] = useState(null);         // understood voice answer waiting for confirmation
  const [muted, setMuted] = useState(false);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('gcr_ai_call_lang') || 'te'; } catch { return 'te'; } });
  const [speaking, setSpeaking] = useState(false);
  const ctx = useRef(null);            // one audio graph: speaker + the call recording
  const dest = useRef(null);
  const playing = useRef(null);
  const voiceCache = useRef(new Map());
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { try { localStorage.setItem('gcr_ai_call_lang', lang); } catch { /* ignore */ } }, [lang]);
  const [secs, setSecs] = useState(0);
  const log = useRef([]);
  const t0 = useRef(0);
  const stream = useRef(null);
  const whole = useRef(null);
  const chunks = useRef([]);
  const clip = useRef(null);
  const clipChunks = useRef([]);
  const q = questions[i];

  // Ring + vibrate while the call is incoming
  useEffect(() => {
    if (phase !== 'ringing') return undefined;
    try { navigator.vibrate && navigator.vibrate([400, 300, 400, 300, 400]); } catch { /* ignore */ }
    let ctx; let osc; let stop = false;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ring = () => {
        if (stop) return;
        osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.frequency.value = 880; g.gain.value = 0.05; osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
        setTimeout(ring, 1200);
      };
      ring();
    } catch { /* no sound */ }
    return () => { stop = true; try { ctx && ctx.close(); } catch { /* ignore */ } };
  }, [phase]);

  // Call timer
  useEffect(() => {
    if (phase !== 'call') return undefined;
    const id = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Gouru AI's voice (Gemini, natural Telugu / English); the phone's own voice only if that is unavailable
  const voiceFor = (text) => {
    const key = `${lang}|${text}`;
    if (!voiceCache.current.has(key)) {
      voiceCache.current.set(key, fetch(`${API_BASE_URL}/api/assist/speak`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ text, voice: 'female' }) })
        .then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
    return voiceCache.current.get(key);
  };
  const sayId = useRef(0); // each line Gouru AI says; stopping makes any line still loading stay silent
  const stopVoice = () => {
    sayId.current += 1;
    try { playing.current && playing.current.stop(); } catch { /* ignore */ }
    playing.current = null;
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
    setSpeaking(false);
  };
  const say = async (msg) => {
    const text = typeof msg === 'string' ? msg : (msg[lang] || msg.en);
    stopVoice();
    const my = sayId.current;
    if (mutedRef.current || !text) return;
    setSpeaking(true);
    try {
      const buf = await voiceFor(text);
      if (my !== sayId.current) return; // the engineer started answering while this was loading: stay quiet
      if (buf && ctx.current && !mutedRef.current) {
        const audio = await ctx.current.decodeAudioData(buf.slice(0));
        if (my !== sayId.current) return;
        const src = ctx.current.createBufferSource();
        src.buffer = audio;
        src.connect(ctx.current.destination);          // the engineer hears it
        if (dest.current) src.connect(dest.current);    // …and it is in the call recording
        playing.current = src;
        await new Promise((res) => { src.onended = res; src.start(); });
        if (playing.current === src) playing.current = null;
        return;
      }
      if (window.speechSynthesis && !mutedRef.current && my === sayId.current) {
        await new Promise((res) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang === 'te' ? 'te-IN' : 'en-IN'; u.rate = 0.95; u.onend = res; u.onerror = res;
          window.speechSynthesis.speak(u);
        });
      }
    } catch { /* the text is on screen anyway */ } finally { setSpeaking(false); }
  };
  const questionMsg = (k) => ({ te: questions[k].te || questions[k].text, en: `Question ${k + 1}. ${questions[k].text}` });

  // Prepare the voice while the phone rings, so the call flows without pauses
  useEffect(() => {
    voiceFor(SAY.greet(questions.length)[lang]);
    questions.forEach((_, k) => voiceFor(questionMsg(k)[lang]));
    ['keep', 'change', 'explain', 'heard', 'again', 'bye'].forEach((k) => voiceFor(SAY[k][lang]));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const greeted = useRef(false);
  useEffect(() => {
    if (phase !== 'call' || !q) return;
    (async () => {
      if (!greeted.current) { greeted.current = true; await say(SAY.greet(questions.length)); }
      await say(questionMsg(i));
    })();
  }, [phase, i]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async () => {
    t0.current = Date.now();
    // One audio graph: Gouru AI's voice + the engineer's microphone → speaker and the call recording
    try {
      ctx.current = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.current.resume();
      dest.current = ctx.current.createMediaStreamDestination();
    } catch { ctx.current = null; dest.current = null; }
    try {
      if ((await requestMic()) === 'granted') {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (ctx.current && dest.current) ctx.current.createMediaStreamSource(stream.current).connect(dest.current);
      }
    } catch { /* no microphone: Gouru AI's side is still recorded */ }
    try {
      const recStream = dest.current ? dest.current.stream : stream.current;
      if (recStream && typeof MediaRecorder !== 'undefined') {
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
        const mr = type ? new MediaRecorder(recStream, { mimeType: type }) : new MediaRecorder(recStream);
        chunks.current = [];
        mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
        mr.start(1000);
        whole.current = mr;
      }
    } catch { /* no recording */ }
    setPhase('call');
  };

  const record = (entry) => {
    log.current.push({ at: Math.round((Date.now() - t0.current) / 1000), question: q.text, label: q.label || '', field: q.field || '', before: q.current || '', source: q.source || '', ...entry });
  };
  const next = () => {
    setTyped(''); setTyping(false); setHeard(null);
    if (i + 1 < questions.length) setI(i + 1);
    else finish();
  };
  const keep = () => { record({ decision: 'keep', after: q.current || '', via: 'tap' }); say(SAY.keep).then(next); };
  const change = (value, via = 'tap', extra = {}) => {
    const v = String(value || '').trim();
    if (!v) return;
    if (q.field) onApply(q.field, v);
    record({ decision: 'change', after: v, via, ...extra });
    say(SAY.change).then(next);
  };
  const explain = (note, via = 'typed', extra = {}) => { record({ decision: 'explain', after: q.current || '', note, via, ...extra }); say(SAY.explain).then(next); };

  // Voice answer: a short clip of the same microphone, understood by Gouru AI, then confirmed by the engineer
  const startVoice = async () => {
    try {
      if (!stream.current) {
        if ((await requestMic()) !== 'granted') return;
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      stopVoice();
      // A moment for the phone speaker to go quiet, so Gouru AI's own voice is not in the answer
      await new Promise((r) => setTimeout(r, 250));
      const mr = new MediaRecorder(stream.current);
      clipChunks.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) clipChunks.current.push(e.data); };
      mr.onstop = async () => {
        setListening(false); setThinking(true);
        try {
          const blob = new Blob(clipChunks.current, { type: mr.mimeType || 'audio/webm' });
          if (!blob.size) throw new Error('Nothing was recorded. Please try again.');
          // Phones record WebM / MP4 ("audio/webm;codecs=opus"); Gouru AI reads WAV reliably, so convert first
          let audio;
          try { audio = await toWav(blob); } catch {
            audio = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
          }
          const r = await fetch(`${API_BASE_URL}/api/cases/ai-review/answer`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ audio, question: { text: q.text, te: q.te, label: q.label, field: q.field, current: q.current, suggest: q.suggest } }) });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Could not hear that.');
          setHeard(j);
          say(SAY.heard);
        } catch (err) { setHeard({ error: err.message }); say(SAY.again); } finally { setThinking(false); }
      };
      mr.start();
      clip.current = mr;
      setListening(true);
    } catch { setListening(false); }
  };
  const stopAnswer = () => { try { clip.current && clip.current.state !== 'inactive' && clip.current.stop(); } catch { /* ignore */ } };

  const finish = async () => {
    setPhase('saving');
    await say(SAY.bye);
    const seconds = Math.round((Date.now() - t0.current) / 1000);
    const done = (blob, mime) => {
      try { stream.current && stream.current.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      try { ctx.current && ctx.current.close(); } catch { /* ignore */ }
      onFinish({ log: log.current, blob, mime, seconds, lang });
    };
    const mr = whole.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = () => done(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }), mr.mimeType || 'audio/webm');
      try { mr.stop(); } catch { done(null, ''); }
    } else done(null, '');
  };

  const decline = () => {
    stopVoice();
    try { ctx.current && ctx.current.close(); } catch { /* ignore */ }
    try { whole.current && whole.current.state !== 'inactive' && whole.current.stop(); } catch { /* ignore */ }
    try { stream.current && stream.current.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    onCancel();
  };

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return createPortal(
    <div className="arc" role="dialog" aria-modal="true" aria-label="Gouru AI review call" data-no-reach>
      {phase === 'ringing' && (
        <div className="arc-ring">
          <div className="arc-avatar pulse"><Sparkles size={44} /></div>
          <div className="arc-name">Gouru AI</div>
          <div className="arc-sub">{lang === 'te' ? `ఈ case గురించి call చేస్తోంది · ${questions.length} ప్రశ్నలు` : `is calling to check this case · ${questions.length} question${questions.length === 1 ? '' : 's'}`}</div>
          <p className="arc-why">{lang === 'te'
            ? 'Admin కి పంపే ముందు గౌరు AI కొన్ని విషయాలు మీతో confirm చేసుకుంటుంది. ఈ call record అయ్యి case తో save అవుతుంది.'
            : 'Before it goes to your admin, Gouru AI checks a few details with you. The call is recorded and saved with the case.'}</p>
          <button type="button" className="arc-lang" onClick={() => setLang(lang === 'te' ? 'en' : 'te')} style={{ marginTop: -10, marginBottom: 14 }}>{lang === 'te' ? 'English' : 'తెలుగు'}</button>
          <div className="arc-btns">
            <button type="button" className="arc-dec" onClick={decline} aria-label="Decline"><PhoneOff size={28} /></button>
            <button type="button" className="arc-acc" onClick={accept} aria-label="Accept"><Phone size={28} /></button>
          </div>
          <div className="arc-hints"><span>{lang === 'te' ? 'తర్వాత' : 'Not now'}</span><span>{lang === 'te' ? 'మాట్లాడండి' : 'Answer'}</span></div>
        </div>
      )}

      {phase === 'call' && q && (
        <div className="arc-call">
          <div className="arc-top">
            <div className="arc-avatar small"><Sparkles size={22} /></div>
            <div><b>Gouru AI</b><span>{whole.current ? '● Recording · ' : ''}{mmss}</span></div>
            <button type="button" className="arc-lang" onClick={() => { stopVoice(); setLang(lang === 'te' ? 'en' : 'te'); }} aria-label="Change language">{lang === 'te' ? 'English' : 'తెలుగు'}</button>
            <button type="button" className="arc-mute" onClick={() => { if (!muted) stopVoice(); setMuted(!muted); }} aria-label={muted ? 'Turn voice on' : 'Turn voice off'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          </div>
          <div className="arc-count">Question {i + 1} of {questions.length}{q.document ? ` · from the ${q.document}` : ''}</div>
          <div className={`arc-q ${speaking ? 'talking' : ''}`} lang={lang === 'te' && q.te ? 'te' : 'en'}>{lang === 'te' && q.te ? q.te : q.text}</div>
          {lang === 'te' && q.te && <div className="arc-en">{q.text}</div>}
          {q.label && <div className="arc-cur">{q.label}: <b>{q.current || '— empty —'}</b></div>}

          {heard && !heard.error && (
            <div className="arc-heard">
              <div>You said: “{heard.transcript}”</div>
              {heard.sure === false && <div className="arc-unsure">{lang === 'te' ? 'సరిగా వినిపించలేదు — check చేసి tap చేయండి, లేదా మళ్ళీ చెప్పండి.' : 'Not fully clear — please check before you tap, or say it again.'}</div>}
              <div className="arc-heard-b">
                {heard.decision === 'change' && heard.value && <button type="button" onClick={() => change(heard.value, 'voice', { transcript: heard.transcript, note: heard.note })}><Check size={16} /> Save “{heard.value}”</button>}
                {heard.decision === 'keep' && <button type="button" onClick={() => { record({ decision: 'keep', after: q.current || '', via: 'voice', transcript: heard.transcript }); next(); }}><Check size={16} /> Yes, keep it</button>}
                {heard.decision === 'explain' && <button type="button" onClick={() => explain(heard.note || heard.transcript, 'voice', { transcript: heard.transcript })}><Check size={16} /> Save my reason</button>}
                <button type="button" className="ghost" onClick={() => setHeard(null)}>Try again</button>
              </div>
            </div>
          )}
          {heard && heard.error && <div className="arc-err">{heard.error}</div>}

          {!heard && (
            <div className="arc-opts">
              {q.field ? (<>
                <button type="button" onClick={keep}><Check size={17} /> Correct as entered{q.current ? `: ${q.current}` : ''}</button>
                {q.suggest && q.suggest !== q.current && <button type="button" onClick={() => change(q.suggest)}><Pencil size={16} /> Change to: {q.suggest}</button>}
              </>) : (
                <button type="button" onClick={() => { record({ decision: 'keep', via: 'tap' }); next(); }}><Check size={17} /> Yes, it is correct</button>
              )}
              {!typing ? (
                <button type="button" className="ghost" onClick={() => setTyping(true)}><Pencil size={16} /> {q.field ? 'Type the correct value' : 'Type a reason'}</button>
              ) : (
                <div className="arc-type">
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={q.field ? 'Correct value' : 'Reason'} />
                  <button type="button" onClick={() => (q.field ? change(typed, 'typed') : explain(typed))} disabled={!typed.trim()}>Save</button>
                </div>
              )}
            </div>
          )}

          <div className="arc-voice">
            {thinking ? <div className="arc-think"><Loader2 size={18} className="spin" /> Gouru AI is listening to your answer…</div>
              : listening ? <button type="button" className="arc-mic on" onClick={stopAnswer}><Square size={20} /> Stop — I'm done</button>
                : <button type="button" className="arc-mic" onClick={startVoice}><Mic size={20} /> Answer by voice</button>}
          </div>
          <button type="button" className="arc-end" onClick={decline} aria-label="End call without submitting"><PhoneOff size={22} /></button>
        </div>
      )}

      {phase === 'saving' && (
        <div className="arc-ring">
          <div className="arc-avatar"><Check size={44} /></div>
          <div className="arc-name">{lang === 'te' ? 'Call పూర్తైంది' : 'Call finished'}</div>
          <div className="arc-sub">{lang === 'te' ? 'మీ answers, recording save అవుతున్నాయి…' : 'Saving the answers and the recording…'}</div>
          <Loader2 size={26} className="spin" />
        </div>
      )}

      <style>{`
        .arc { position: fixed; inset: 0; z-index: 12000; background: radial-gradient(120% 80% at 50% 0%, #1e3a8a 0%, #0b1533 70%); color: #fff; display: flex; font-family: inherit; }
        .arc-ring { margin: auto; text-align: center; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 420px; }
        .arc-avatar { width: 108px; height: 108px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #6366f1, #22d3ee); box-shadow: 0 10px 40px rgba(34,211,238,.35); }
        .arc-avatar.small { width: 42px; height: 42px; box-shadow: none; flex-shrink: 0; }
        .arc-avatar.pulse { animation: arcPulse 1.4s ease-in-out infinite; }
        @keyframes arcPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,.5); } 50% { box-shadow: 0 0 0 22px rgba(34,211,238,0); } }
        .arc-name { font-size: 30px; font-weight: 800; margin-top: 8px; }
        .arc-sub { font-size: 15px; color: #c7d2fe; }
        .arc-why { font-size: 13.5px; color: #a5b4fc; line-height: 1.45; margin: 10px 0 22px; }
        .arc-btns { display: flex; gap: 70px; }
        .arc-btns button { width: 72px; height: 72px; border-radius: 50%; border: 0; color: #fff; display: grid; place-items: center; cursor: pointer; }
        .arc-dec { background: #ef4444; } .arc-acc { background: #22c55e; animation: arcPulse 1.4s ease-in-out infinite; }
        .arc-hints { display: flex; gap: 86px; font-size: 13px; color: #c7d2fe; }
        .arc-call { width: 100%; max-width: 560px; margin: 0 auto; padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
        .arc-top { display: flex; align-items: center; gap: 10px; }
        .arc-top b { display: block; font-size: 17px; } .arc-top span { font-size: 12.5px; color: #fca5a5; }
        .arc-top > div:nth-child(2) { flex: 1; }
        .arc-lang { border: 0; border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.14); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
        .arc-q.talking { text-shadow: 0 0 18px rgba(34,211,238,.45); }
        .arc-en { font-size: 13px; color: #a5b4fc; line-height: 1.4; margin-top: -4px; }
        .arc-mute { width: 40px; height: 40px; border-radius: 50%; border: 0; background: rgba(255,255,255,.12); color: #fff; display: grid; place-items: center; cursor: pointer; }
        .arc-count { font-size: 12.5px; color: #a5b4fc; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; margin-top: 6px; }
        .arc-q { font-size: 21px; font-weight: 700; line-height: 1.35; }
        .arc-cur { font-size: 14px; color: #c7d2fe; background: rgba(255,255,255,.08); border-radius: 10px; padding: 8px 10px; }
        .arc-cur b { color: #fff; }
        .arc-opts { display: flex; flex-direction: column; gap: 8px; }
        .arc-opts button, .arc-heard-b button { display: flex; align-items: center; gap: 8px; text-align: left; border: 0; border-radius: 12px; padding: 13px 14px; background: #fff; color: #0f172a; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .arc-opts button.ghost, .arc-heard-b button.ghost { background: rgba(255,255,255,.12); color: #fff; }
        .arc-unsure { margin-top: 4px; font-size: 12.5px; color: #fbbf24; font-weight: 700; }
        .arc-type { display: flex; gap: 8px; }
        .arc-type input { flex: 1; min-width: 0; padding: 12px; border-radius: 12px; border: 0; font-size: 16px; font-family: inherit; }
        .arc-type button { border: 0; border-radius: 12px; padding: 0 16px; background: #22c55e; color: #fff; font-weight: 800; font-family: inherit; }
        .arc-heard { background: rgba(255,255,255,.1); border-radius: 12px; padding: 10px 12px; font-size: 14px; display: flex; flex-direction: column; gap: 8px; }
        .arc-heard-b { display: flex; flex-direction: column; gap: 8px; }
        .arc-err { color: #fecaca; font-size: 13.5px; }
        .arc-voice { display: flex; justify-content: center; margin-top: 6px; }
        .arc-mic { display: flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 13px 22px; background: #6366f1; color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .arc-mic.on { background: #ef4444; animation: arcPulse 1.2s infinite; }
        .arc-think { display: flex; align-items: center; gap: 8px; color: #c7d2fe; font-size: 14px; }
        .arc-end { align-self: center; width: 58px; height: 58px; border-radius: 50%; border: 0; background: #ef4444; color: #fff; display: grid; place-items: center; cursor: pointer; margin-top: 10px; }
      `}</style>
    </div>,
    document.body,
  );
}
