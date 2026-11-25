// One question to Google Gemini with text + files (audio, photos), answer as JSON.
// Same models and fallbacks as document reading (services/docVerifier.js).

const { config } = require('../config/env');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Models to try, in order. When Google reports one busy (503) or it hangs, the next one is tried.
// (gemini-flash-latest now points at a retired model for this key, so it is not used.)
const GEMINI_MODELS = () => [...new Set([config.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].filter(Boolean))];
const aiOn = () => Boolean(config.GEMINI_ENABLED && (config.GEMINI_API_KEY || process.env.GEMINI_API_KEY));

/** parts: [{ text }] or data URLs ("data:audio/wav;base64,…") → parsed JSON, or null when the AI is unavailable */
// fast: little 'thinking' before answering (listening to a recording and filling fields needs no long reasoning).
// A model that does not accept that setting is asked again without it.
async function askJson(prompt, dataUrls = [], { timeoutMs = 60000, fast = false } = {}) {
  if (!aiOn()) return null;
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  // "data:audio/webm;codecs=opus;base64,…" → mime "audio/webm" (parameters dropped)
  const files = dataUrls.map((u) => /^data:([^;,]+)(?:;[^;,]+=[^;,]*)*;base64,(.*)$/s.exec(String(u || ''))).filter(Boolean)
    .map((m) => ({ inlineData: { mimeType: m[1], data: m[2] } }));
  const makeBody = (quick) => JSON.stringify({
    contents: [{ parts: [{ text: prompt }, ...files] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, ...(quick ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) },
  });
  const body = makeBody(false);
  const quickBody = fast ? makeBody(true) : null;
  const noQuick = new Set(); // models that refused the quick setting
  const models = GEMINI_MODELS();
  const perTry = Math.max(50000, Math.round(timeoutMs * 0.6)); // plenty of time for multimodal PDF/image parsing
  const deadline = Date.now() + timeoutMs;
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 3000) return null;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const quick = quickBody && !noQuick.has(model);
        let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: quick ? quickBody : body, signal: AbortSignal.timeout(Math.min(perTry, left)) });
        if (quick && res.status === 400) {
          // This model does not take the quick setting: the same request without it
          noQuick.add(model);
          const left2 = deadline - Date.now();
          if (left2 < 3000) return null;
          res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(Math.min(perTry, left2)) });
        }
        if (!res.ok) {
          const errText = await res.text();
          require('./aiStatus').note(res.status, errText);
          console.warn(`AI (${model}) HTTP ${res.status}: ${errText.replace(/\s+/g, ' ').slice(0, 160)}`);
          if (res.status === 401 || res.status === 403) return null;
          continue;
        }
        require('./aiStatus').note(res.status);
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
