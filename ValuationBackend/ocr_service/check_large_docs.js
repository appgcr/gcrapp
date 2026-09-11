const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY;
const dir = 'C:\\Users\\busar\\.gemini\\antigravity-ide\\brain\\f9d2026f-a786-4087-9c68-806210a259d3\\.user_uploaded';

const checkFiles = [
  'media_1788955619417.png',
  'media_1788959009594.png',
  'media_1788953895647.png'
];

const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

async function callGemini(payload) {
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return { data, model };
      }
    } catch (e) {}
  }
  return null;
}

async function run() {
  for (const f of checkFiles) {
    const fPath = path.join(dir, f);
    if (!fs.existsSync(fPath)) continue;
    const b64 = fs.readFileSync(fPath).toString('base64');
    const res = await callGemini({
      contents: [{
        parts: [
          { text: 'Identify this Indian property document. State title, document type, key numbers (Market value amount, extent, survey no, floor plinth areas, etc.), in 2 sentences.' },
          { inlineData: { mimeType: 'image/png', data: b64 } }
        ]
      }]
    });
    if (res) {
      console.log(`=== ${f} ===`);
      console.log(res.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    }
  }
}
run();
