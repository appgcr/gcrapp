// One question to Google Gemini with text + files (audio, photos), answer as JSON.
// Same models and fallbacks as document reading (services/docVerifier.js).

const { config } = require('../config/env');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Models to try, in order. When Google reports one busy (503) or it hangs, the next one is tried.
// (gemini-flash-latest now points at a retired model for this key, so it is not used.)
const GEMINI_MODELS = () => [...new Set([config.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].filter(Boolean))];
const aiOn = () => Boolean(config.GEMINI_ENABLED && (config.GEMINI_API_KEY || process.env.GEMINI_API_KEY));

/** parts: [{ text }] or data URLs ("data:audio/wav;base64,…") → parsed JSON, or null when the AI is unavailable */
async function askJson(prompt, dataUrls = [], { timeoutMs = 60000 } = {}) {
  if (!aiOn()) return null;
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const files = dataUrls.map((u) => /^data:([^;]+);base64,(.*)$/s.exec(String(u || ''))).filter(Boolean)
    .map((m) => ({ inlineData: { mimeType: m[1], data: m[2] } }));
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, ...files] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  const models = GEMINI_MODELS();
  const perTry = Math.max(20000, Math.round(timeoutMs / 3)); // one slow model must not use the whole wait
  const deadline = Date.now() + timeoutMs;
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 3000) return null;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(Math.min(perTry, left)),
        });
        if (!res.ok) {
          console.warn(`AI (${model}) HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 160)}`);
          if (res.status === 400 || res.status === 401 || res.status === 403) return null;
          continue;
        }
        const data = await res.json();
        const text = (data?.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim()
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        if (text) return JSON.parse(text);
      } catch (err) {
        console.warn(`AI (${model}) failed:`, err.message);
      }
    }
    if (Date.now() + 3000 < deadline) await sleep(2500);
  }
  return null;
}

module.exports = { askJson, aiOn, GEMINI_MODELS };
