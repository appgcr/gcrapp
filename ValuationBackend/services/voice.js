// Gouru AI's voice: natural Telugu (and English) speech from Gemini's speech models, and the review
// questions turned into everyday spoken Telugu — the way a colleague would ask on the phone.

const crypto = require('crypto');
const { config } = require('../config/env');
const { askJson } = require('./aiJson');

const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const VOICES = { male: 'Achird', female: 'Sulafat' };
const DEFAULT_VOICE = process.env.MAHE_VOICE || VOICES.female;
const cache = new Map(); // recent phrases → wav (greetings and acknowledgements repeat a lot)

function wavOf(b64, mime) {
  const buf = Buffer.from(b64, 'base64');
  if (/wav/i.test(mime || '') || buf.slice(0, 4).toString() === 'RIFF') return buf;
  const rate = Number((/rate=(\d+)/.exec(mime || '') || [])[1] || 24000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

/** text → WAV buffer (or null when the speech service is unavailable) */
async function speak(text, { voice } = {}) {
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const name = Object.values(VOICES).includes(voice) ? voice : DEFAULT_VOICE;
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  if (!apiKey || !clean) return null;
  const key = crypto.createHash('sha1').update(`${name}|${clean}`).digest('hex');
  if (cache.has(key)) return cache.get(key);
  const body = JSON.stringify({
    contents: [{ parts: [{ text: clean }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: name } } } },
  });
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const part = (d?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData && p.inlineData.data);
      if (!part) continue;
      const wav = wavOf(part.inlineData.data, part.inlineData.mimeType);
      cache.set(key, wav);
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      return wav;
    } catch { /* next model */ }
  }
  return null;
}

/** English review questions → natural spoken Telugu (numbers, names and document words kept exact).
 *  One small request per question, all at once, so a slow moment for one doesn't hold up the call. */
async function toTelugu(texts) {
  const one = async (text) => {
    const prompt = `Rewrite this question as natural, polite, everyday spoken Telugu — the way a friendly Telugu colleague talks on a phone call to a property valuation engineer in Andhra Pradesh.
Rules: put "అండి" where people naturally say it (usually at the end), never start the sentence with it; keep common English words Telugu speakers use as they are (deed, survey number, extent, plan, rate, case, correct, confirm, sq yards, cents, lakhs, road width, admin, form); keep every number, date, name and value EXACTLY as written; short and clear; Telugu script with those English words in English letters.
Answer JSON: {"te": "..."}
Question: ${text}`;
    try {
      const out = await askJson(prompt, [], { timeoutMs: 45000 });
      return out && typeof out.te === 'string' ? out.te.trim() : '';
    } catch { return ''; }
  };
  return Promise.all(texts.map(one));
}

module.exports = { speak, toTelugu, VOICES, DEFAULT_VOICE };
