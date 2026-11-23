import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config/api';
import { landRateField } from './LandRateCard';
import { requestMic, openMicSettings } from '../../../utils/micPermission';
import askConfirm from '../../Shared/askConfirm';

/**
 * Speak the site details — "road 30 feet, framed structure, 12 years, vitrified flooring,
 * north side road…" — and Gouru AI fills the Site step. Only what was said is changed.
 */
const MAX_SEC = 120;
const FLOOR_LABELS = ['Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)', 'Third Floor (TF)', 'Fourth Floor (4F)', 'Fifth Floor (5F)', 'Sixth Floor (6F)', 'Seventh Floor (7F)'];

// Any recording → 16 kHz mono WAV (every phone's format is accepted that way)
export async function toWav(blob) {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const audio = await new Promise((res, rej) => ctx.decodeAudioData(buf.slice(0), res, rej));
  ctx.close && ctx.close();
  const rate = 16000;
  const src = audio.getChannelData(0);
  const ratio = audio.sampleRate / rate;
  const n = Math.floor(src.length / ratio);
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, src[Math.floor(i * ratio)] || 0));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export default function VoiceFill({ propertyDetails, setPropertyDetails, setManuallyModifiedFields, options }) {
  const [state, setState] = useState('idle'); // idle | rec | busy
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState(null);
  const rec = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const latest = useRef(propertyDetails);
  latest.current = propertyDetails;

  useEffect(() => () => { clearInterval(timer.current); try { rec.current?.stream?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ } }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      toast.error('Voice input is not supported on this phone. Please type the details.');
      return;
    }
    // Ask for the microphone first (Android shows its own prompt; iPhone asks on first use)
    const perm = await requestMic();
    if (perm === 'denied') {
      const android = /android/i.test(navigator.userAgent);
      const go = await askConfirm({
        title: 'Microphone is off for Gouru Valuations',
        message: android
          ? 'Allow the microphone to speak the site details. Tap Open Settings → Permissions → Microphone → Allow.'
          : 'Allow the microphone to speak the site details: open iPhone Settings → Gouru Valuations → Microphone.',
        confirmText: android ? 'Open Settings' : 'OK', cancelText: 'Not now',
      });
      if (go && android) openMicSettings();
      return;
    }
    if (perm === 'unavailable') {
      toast.error('Voice input is not available on this phone. Please type the details.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); send(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })); };
      rec.current = mr;
      mr.start(1000);
      setSecs(0); setResult(null); setState('rec');
      timer.current = setInterval(() => setSecs(s => { if (s + 1 >= MAX_SEC) stop(); return s + 1; }), 1000);
    } catch {
      toast.error('Microphone is off. Allow the microphone for Gouru Valuations in your phone settings.');
    }
  };

  const stop = () => {
    clearInterval(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  };

  const apply = (f) => {
    const pd = latest.current;
    const next = { ...pd };
    const done = [];
    const mark = (k) => setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add(k));
    [['roadWidth', 'Road width'], ['plotType', 'Plot type'], ['roadType', 'Road type'], ['structureType', 'Structure'], ['flooringType', 'Flooring'], ['buildingAge', 'Age']]
      .forEach(([k, label]) => { if (f[k]) { next[k] = String(f[k]); mark(k); done.push(label); } });
    const sides = ['north', 'south', 'east', 'west'];
    if (sides.some(d => f.boundariesActual?.[d])) {
      next.boundariesActual = { ...(pd.boundariesActual || {}) };
      sides.forEach(d => { if (f.boundariesActual[d]) { next.boundariesActual[d] = f.boundariesActual[d]; mark(`boundariesActual.${d}`); } });
      done.push('Boundaries');
    }
    if (sides.some(d => f.dimensionsActual?.[d])) {
      next.dimensionsActual = { ...(pd.dimensionsActual || {}) };
      sides.forEach(d => { if (f.dimensionsActual[d]) { next.dimensionsActual[d] = String(f.dimensionsActual[d]).replace(/[^\d.]/g, ''); mark(`dimensionsActual.${d}`); } });
      if (f.dimensionUnit) next.dimensionUnit = f.dimensionUnit;
      done.push('Measurements');
    }
    if (f.plinthArea || (f.floors || []).length) {
      const sv = { ...(pd.siteValue || {}) };
      if (f.plinthArea) sv.plinthArea = f.plinthArea;
      if ((f.floors || []).length) {
        sv.floors = f.floors.slice(0, FLOOR_LABELS.length).map((x, i) => ({ id: i === 0 ? 'gf' : `f${i}`, label: FLOOR_LABELS[i], value: String(x.area).replace(/[^\d.]/g, '') }));
      }
      next.siteValue = sv; mark('siteValue'); done.push('Areas');
    }
    // Land rate, converted to the unit this property's report uses
    const field = landRateField(pd.propertyType);
    const perSqyd = Number(f.landRatePerSqyd) || (Number(f.marketRatePerCent) ? Number(f.marketRatePerCent) / 48.4 : 0) || (Number(f.ratePerAcre) ? Number(f.ratePerAcre) / 4840 : 0);
    if (perSqyd > 0) {
      next.report = { ...(pd.report || {}), [field.key]: String(Math.round(perSqyd * field.perSqyd)), landRateFromGuideline: false };
      done.push('Land rate');
    }
    setPropertyDetails(next);
    return done;
  };

  const send = async (blob) => {
    setState('busy');
    try {
      const audio = await toWav(blob);
      const r = await fetch(`${API_BASE_URL}/api/assist/voice-fields`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, propertyType: latest.current.propertyType, options }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not read the recording.');
      const done = apply(d.fields || {});
      setResult({ transcript: d.transcript, done });
      if (done.length) toast.success(`Filled: ${done.join(', ')}`);
      else toast('Nothing to fill was heard. Try again, closer to the phone.');
    } catch (err) {
      toast.error(err.message || 'Could not read the recording.');
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="vfl">
      {state === 'idle' && (
        <button type="button" className="vfl-btn" onClick={start}><Mic size={18} /> Speak the site details</button>
      )}
      {state === 'rec' && (
        <button type="button" className="vfl-btn rec" onClick={stop}><Square size={16} /> Stop · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</button>
      )}
      {state === 'busy' && (
        <button type="button" className="vfl-btn" disabled><Loader2 size={18} className="spin" /> Gouru AI is filling…</button>
      )}
      <div className="vfl-hint">
        {state === 'rec'
          ? 'Speak naturally — road, plot, structure, age, flooring, boundaries, sizes, rate. Tap Stop when done.'
          : 'e.g. "Road 30 feet, CC road, framed structure, 12 years, vitrified flooring, north side road, plinth 1200 square feet, rate 4 lakhs per cent"'}
      </div>
      {result && result.transcript && (
        <div className="vfl-res"><b>Heard:</b> {result.transcript}{result.done.length ? <><br /><b>Filled:</b> {result.done.join(', ')}. Check below.</> : null}</div>
      )}
      <style>{`
        .vfl { padding: 12px; border-radius: 12px; background: linear-gradient(135deg, #eef2ff, #f5f3ff); border: 1px solid #c7d2fe; }
        .vfl-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 999px; padding: 12px; font-size: 15px; font-weight: 800; color: #fff; background: #4f46e5; cursor: pointer; }
        .vfl-btn.rec { background: #dc2626; animation: vflPulse 1.4s ease-in-out infinite; }
        .vfl-btn:disabled { opacity: .8; }
        @keyframes vflPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.45); } 50% { box-shadow: 0 0 0 10px rgba(220,38,38,0); } }
        .vfl-hint { margin-top: 8px; font-size: 12px; color: #4338ca; line-height: 1.4; text-align: center; }
        .vfl-res { margin-top: 8px; font-size: 12px; color: #1e1b4b; background: #fff; border-radius: 8px; padding: 8px 10px; line-height: 1.45; }
        body.dark-theme .vfl { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .vfl-res { background: #2c2c2e; color: #fff; }
      `}</style>
    </div>
  );
}
