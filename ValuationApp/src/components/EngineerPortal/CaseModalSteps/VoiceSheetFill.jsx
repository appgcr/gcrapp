import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Check, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config/api';
import { authHeaders } from '../../Shared/authHeaders';
import { requestMic, openMicSettings } from '../../../utils/micPermission';
import askConfirm from '../../Shared/askConfirm';
import localforage from 'localforage';

/**
 * Speak the office-sheet details — "owner name Mahesh, S/o Maheer, address 2/240-45, engineer Chanikya Reddy,
 * inspection date today, deed no 123/2025, deed date 23-04-24, survey no 114…" — and Gouru AI fills the sheet.
 * Only what was said is changed; every filled field is listed (and highlighted) to check.
 */
const MAX_SEC = 240; // 4 minutes in all (pauses don't count)
const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

// All recorded pieces → one 16 kHz mono WAV (pieces from before and after a pause or a call are joined)
async function piecesToWav(blobs) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const rate = 16000;
  const parts = [];
  for (const b of blobs) {
    let audio = null;
    try { audio = await ctx.decodeAudioData(await b.arrayBuffer()); } catch { audio = null; } // a piece cut off by the phone switching off may not open
    if (!audio) continue;
    const src = audio.getChannelData(0);
    const ratio = audio.sampleRate / rate;
    const n = Math.floor(src.length / ratio);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = src[Math.floor(i * ratio)] || 0;
    parts.push(out);
    parts.push(new Float32Array(Math.round(rate * 0.4))); // a short silence between pieces
  }
  try { ctx.close && ctx.close(); } catch { /* ignore */ }
  const n = parts.reduce((a, p) => a + p.length, 0);
  if (!n) throw new Error('The recording could not be opened. Please record again.');
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, n * 2, true);
  let o = 44;
  for (const p of parts) for (let i = 0; i < p.length; i++) { const v = Math.max(-1, Math.min(1, p[i])); view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  const bytes = new Uint8Array(view.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}
export const SHEET_LABELS = {
  dealType: 'Mortgage / Purchase', ownerName: 'Owner name', ownerRelation: 'Owner S/o · W/o', ownerAddress: 'Owner address',
  applicantName: 'Applicant name', applicantRelation: 'Applicant S/o · W/o', applicantAddress: 'Applicant address', bank: 'Bank',
  engineerNames: 'Engineer', inspectionDate: 'Inspection date', deedNo: 'Deed no', deedDate: 'Deed date', surveyNo: 'Survey no',
  doorNo: 'Door no', wardNo: 'Ward no', plotNo: 'Plot no', address: 'Detail address', extentDocument: 'Extent (document)',
  extentPlan: 'Extent (plan)', netExtentPlan: 'Net extent', roadAffectedArea: 'Road affected', baNumber: 'B.A. number', baDate: 'B.A. date',
  floorsArea: 'Floor areas', guidelineRate: 'Govt rate', assessmentNo: 'Assessment no', taxAmount: 'Tax amount', taxName: 'Tax in the name of',
  propertyType: 'Property type', structureType: 'Structure', buildingAge: 'Age', marketRatePerCent: 'Market rate per cent',
  constructionRate: 'Construction rate', roadWidth: 'Road width', roadType: 'Road type', flooringType: 'Flooring', comments: 'Comments', extras: 'Extras',
};

/** Sheet-shaped values → a flat list of { key, label, value } (boundaries / measurements per side) */
export function sheetFilledList(f) {
  const out = [];
  for (const [k, v] of Object.entries(f || {})) {
    if (k === 'measurements' || k === 'boundaries') {
      Object.entries(v || {}).forEach(([side, x]) => out.push({ key: `${k}.${side}`, label: `${k === 'boundaries' ? 'Boundary' : 'Measurement'} ${side}`, value: x }));
    } else if (SHEET_LABELS[k]) out.push({ key: k, label: SHEET_LABELS[k], value: v });
  }
  return out;
}

// apply(fields) (optional): put the values somewhere else (e.g. the whole case) → { filled: [{key,label,value}], skipped: [labels] }
// storeKey (optional): where the recording is kept on the phone while it is being made, so a call, the app
// closing or the phone switching off never loses it — it is offered again (Resume / Fill now) next time.
export default function VoiceSheetFill({ setSheet, emptySheet, onFilled, apply, example, storeKey }) {
  const [state, setState] = useState('idle'); // idle | rec | paused | busy
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const rec = useRef(null);
  const stream = useRef(null);
  const segments = useRef([]);   // finished pieces (Blobs)
  const chunks = useRef([]);     // the piece being recorded
  const savedSecs = useRef(0);   // length of the finished pieces
  const pieceStart = useRef(0);
  const afterStop = useRef('pause'); // what to do when the recorder stops: 'pause' | 'send'
  const timer = useRef(null);
  const mounted = useRef(true);

  // ── keep the recording on the phone ──
  const persist = async () => {
    if (!storeKey) return;
    try {
      const partial = chunks.current.length ? new Blob(chunks.current, { type: chunks.current[0].type || 'audio/webm' }) : null;
      const list = partial ? [...segments.current, partial] : segments.current;
      if (!list.length) return;
      await localforage.setItem(storeKey, { segments: list, secs: totalSecs(), at: Date.now() });
    } catch { /* storage full or blocked: recording still works */ }
  };
  const forget = async () => { if (storeKey) { try { await localforage.removeItem(storeKey); } catch { /* ignore */ } } };
  const totalSecs = () => savedSecs.current + (rec.current && rec.current.state === 'recording' ? Math.floor((Date.now() - pieceStart.current) / 1000) : 0);

  // A recording left from before (call, app closed, phone off) → offer to continue it
  useEffect(() => {
    mounted.current = true;
    if (storeKey) {
      localforage.getItem(storeKey).then((saved) => {
        if (!mounted.current || !saved || !Array.isArray(saved.segments) || !saved.segments.length) return;
        segments.current = saved.segments;
        savedSecs.current = saved.secs || 0;
        setSecs(savedSecs.current);
        setNote(`Your earlier recording (${fmt(savedSecs.current)}) was kept. Resume to add more, or tap Fill now.`);
        setState('paused');
      }).catch(() => {});
    }
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      try { if (rec.current && rec.current.state !== 'inactive') { afterStop.current = 'pause'; rec.current.stop(); } } catch { /* ignore */ }
      try { stream.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    };
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A call, the screen going off or switching apps → pause at once (what was said so far is kept)
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && rec.current && rec.current.state === 'recording') pause('Paused — the app was closed or a call came. Tap Resume to continue.'); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecorder = (then) => {
    afterStop.current = then;
    clearInterval(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    else if (then === 'send') send();
  };
  const pause = (why = '') => { setNote(why); stopRecorder('pause'); };
  const done = () => { if (state === 'rec') stopRecorder('send'); else send(); };
  const discard = async () => {
    if (!(await askConfirm({ title: 'Delete this recording?', message: 'What you said so far is deleted. Nothing on the form changes.', confirmText: 'Delete', tone: 'danger' }))) return;
    segments.current = []; chunks.current = []; savedSecs.current = 0;
    setSecs(0); setNote(''); setState('idle'); forget();
  };

  const record = async (fresh) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      toast.error('Voice input is not supported on this phone. Please type the details.');
      return;
    }
    const perm = await requestMic();
    if (perm === 'denied') {
      const android = /android/i.test(navigator.userAgent);
      const go = await askConfirm({
        title: 'Microphone is off for Gouru Valuations',
        message: android
          ? 'Allow the microphone to speak the details. Tap Open Settings → Permissions → Microphone → Allow.'
          : 'Allow the microphone to speak the details: open iPhone Settings → Gouru Valuations → Microphone.',
        confirmText: android ? 'Open Settings' : 'OK', cancelText: 'Not now',
      });
      if (go && android) openMicSettings();
      return;
    }
    if (perm === 'unavailable') { toast.error('Voice input is not available on this phone. Please type the details.'); return; }
    if (fresh) { segments.current = []; savedSecs.current = 0; setResult(null); await forget(); }
    if (savedSecs.current >= MAX_SEC) { toast(`That's ${fmt(MAX_SEC)} — the longest one recording can be. Tap Fill now.`); return; }
    try {
      // Echo / noise cleaning on: sites are noisy
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = st;
      const mr = new MediaRecorder(st);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) { chunks.current.push(e.data); persist(); } };
      mr.onstop = () => {
        st.getTracks().forEach((t) => t.stop());
        savedSecs.current += Math.max(0, Math.round((Date.now() - pieceStart.current) / 1000));
        if (chunks.current.length) segments.current = [...segments.current, new Blob(chunks.current, { type: mr.mimeType || chunks.current[0].type || 'audio/webm' })];
        chunks.current = [];
        rec.current = null;
        persist();
        if (!mounted.current) return;
        setSecs(savedSecs.current);
        if (afterStop.current === 'send') send(); else setState('paused');
      };
      // The microphone taken away (a call) → pause
      st.getAudioTracks().forEach((t) => {
        t.onended = () => { if (rec.current && rec.current.state === 'recording') pause('Paused — the microphone was needed for a call. Tap Resume to continue.'); };
        t.onmute = () => { if (rec.current && rec.current.state === 'recording') pause('Paused — the microphone was needed for a call. Tap Resume to continue.'); };
      });
      rec.current = mr;
      pieceStart.current = Date.now();
      mr.start(1000); // a piece every second, kept on the phone
      setNote('');
      setState('rec');
      timer.current = setInterval(() => {
        const t = totalSecs();
        setSecs(t);
        if (t >= MAX_SEC) { toast(`That's ${fmt(MAX_SEC)}. Filling the form now.`); stopRecorder('send'); }
      }, 500);
    } catch {
      toast.error('Microphone is off. Allow the microphone for Gouru Valuations in your phone settings.');
    }
  };

  const send = async () => {
    const pieces = segments.current;
    if (!pieces.length) { setState('idle'); toast.error('Nothing was recorded. Please try again.'); return; }
    setState('busy');
    try {
      const audio = await piecesToWav(pieces);
      const r = await fetch(`${API_BASE_URL}/api/assist/voice-sheet`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ audio }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not read the recording.');
      const f = d.fields || {};
      let filled = [];
      let skipped = [];
      if (apply) {
        ({ filled = [], skipped = [] } = apply(f) || {});
      } else {
        setSheet((prev) => {
          const out = { ...emptySheet, ...prev };
          for (const [k, v] of Object.entries(f)) {
            if (k === 'measurements' || k === 'boundaries') out[k] = { ...emptySheet[k], ...(prev?.[k] || {}), ...v };
            else if (k in emptySheet) out[k] = v;
          }
          if (Array.isArray(d.corrections) && d.corrections.length) out.corrections = [...new Set([...(prev?.corrections || []), ...d.corrections])];
          return out;
        });
        filled = sheetFilledList(f);
      }
      onFilled && onFilled(filled.map((x) => x.key));
      // Done: the recording is no longer needed on the phone
      segments.current = []; savedSecs.current = 0; setSecs(0); setNote('');
      await forget();
      setResult({ transcript: d.transcript, filled, skipped });
      setState('idle');
      if (filled.length) toast.success(`Filled ${filled.length} detail${filled.length === 1 ? '' : 's'}. Please check them.`);
      else toast('Nothing to fill was heard. Speak closer to the phone and say the field name first, e.g. "deed number 123 by 2025".', { duration: 6000 });
    } catch (err) {
      // Kept on the phone: try again when there's signal
      setNote(`${err.message || 'Could not read the recording.'} Your recording is kept — tap Fill now to try again.`);
      setState('paused');
    }
  };

  const time = fmt(secs);
  return (
    <div className="vsf">
      {state === 'idle' && <button type="button" className="vsf-btn" onClick={() => record(true)}><Mic size={18} /> {result ? 'Speak more details' : 'Speak the details'}</button>}
      {state === 'rec' && (
        <div className="vsf-row">
          <button type="button" className="vsf-btn rec" onClick={() => pause('')} aria-label="Pause"><Pause size={17} /> Pause · {time}</button>
          <button type="button" className="vsf-btn go" onClick={done}><Check size={17} /> Done</button>
        </div>
      )}
      {state === 'paused' && (
        <div className="vsf-row">
          <button type="button" className="vsf-btn" onClick={() => record(false)}><Play size={17} /> Resume · {time}</button>
          <button type="button" className="vsf-btn go" onClick={done}><Check size={17} /> Fill now</button>
          <button type="button" className="vsf-x" onClick={discard} aria-label="Delete recording"><Trash2 size={17} /></button>
        </div>
      )}
      {state === 'busy' && <button type="button" className="vsf-btn" disabled><Loader2 size={18} className="spin" /> Gouru AI is filling…</button>}
      {note && <div className="vsf-pnote">{note}</div>}
      <div className="vsf-hint">
        {state === 'rec'
          ? 'Listening… say the field name, then the value. Pause any time; a call pauses it by itself.'
          : state === 'paused'
            ? 'Paused. What you said is kept. Resume to say more, or Fill now.'
            : `Say the field name, then the value. e.g. "${example || 'Owner name Mahesh, S/o Maheer, address 2/240-45, engineer Chanikya Reddy, inspection date today, deed number 123 by 2025, deed date 23-04-24, survey number 114'}"`}
      </div>
      {result && state === 'idle' && (
        <div className="vsf-res">
          {result.transcript && <div className="vsf-heard"><b>Heard:</b> {result.transcript}</div>}
          {result.filled.length > 0 && (
            <ul>{result.filled.map((x) => <li key={x.key}><span>{x.label}</span><b>{x.value}</b></li>)}</ul>
          )}
          {result.skipped && result.skipped.length > 0 && <div className="vsf-skip">Not filled: {result.skipped.join(' · ')}</div>}
          {result.filled.length > 0 && <div className="vsf-note">Filled fields are highlighted. Correct anything that's wrong by typing.</div>}
        </div>
      )}
      <style>{`
        .vsf { padding: 12px; border-radius: 14px; background: linear-gradient(135deg, #eef2ff, #f5f3ff); border: 1px solid #c7d2fe; }
        .vsf-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 999px; padding: 13px; font-size: 15.5px; font-weight: 800; color: #fff; background: #4f46e5; cursor: pointer; font-family: inherit; }
        .vsf-row { display: flex; gap: 8px; align-items: center; }
        .vsf-row .vsf-btn { flex: 1; }
        .vsf-btn.go { background: #16a34a; flex: 0 0 auto; padding: 13px 18px; }
        .vsf-x { width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; border: 1px solid #fecaca; background: #fff; color: #dc2626; display: grid; place-items: center; cursor: pointer; }
        .vsf-pnote { margin-top: 8px; font-size: 12.5px; font-weight: 600; color: #b45309; text-align: center; line-height: 1.4; }
        .vsf-btn.rec { background: #dc2626; animation: vsfPulse 1.4s ease-in-out infinite; }
        .vsf-btn:disabled { opacity: .85; }
        @keyframes vsfPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.45); } 50% { box-shadow: 0 0 0 10px rgba(220,38,38,0); } }
        .vsf-hint { margin-top: 8px; font-size: 12px; color: #4338ca; line-height: 1.45; text-align: center; }
        .vsf-res { margin-top: 10px; background: #fff; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1e1b4b; line-height: 1.45; }
        .vsf-heard { color: #475569; }
        .vsf-res ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .vsf-res li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-top: 1px solid #eef2ff; }
        .vsf-res li span { color: #64748b; flex-shrink: 0; }
        .vsf-res li b { text-align: right; word-break: break-word; }
        .vsf-skip { margin-top: 6px; font-size: 12px; color: #92400e; }
        .vsf-note { margin-top: 6px; font-size: 12px; color: #15803d; font-weight: 600; }
        body.dark-theme .vsf { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .vsf-res { background: #2c2c2e; color: #fff; }
        body.dark-theme .vsf-res li { border-color: #3a3a3c; }
      `}</style>
    </div>
  );
}
