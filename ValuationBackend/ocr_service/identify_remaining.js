const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY;
const dir = 'C:\\Users\\busar\\.gemini\\antigravity-ide\\brain\\fd21fa50-a551-4b01-9e7c-fb3c23568236\\.user_uploaded';

const checkFiles = [
  'media_1789018091489.png',
  'media_1789018099280.png',
  'media_1789018630931.png',
  'media_1789018663249.jpg'
];

const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];

async function callGemini(payload) {
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 429 || res.status === 503) {
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        return { data, model };
      }
    } catch (e) {
      // continue
    }
  }
  return null;
}

async function run() {
  for (const f of checkFiles) {
    const fPath = path.join(dir, f);
    if (!fs.existsSync(fPath)) continue;
    const b64 = fs.readFileSync(fPath).toString('base64');
    const ext = f.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const res = await callGemini({
      contents: [{
        parts: [
          { text: 'Identify this Indian property document. State title, document type (Sale Deed, Building Plan, Property Tax, Market Value, Layout Plan, or other), key numbers (Assessment No, PTIN, Market Value amount, Survey No, etc.), in 2 sentences.' },
          { inlineData: { mimeType: ext, data: b64 } }
        ]
      }]
    });
    if (res) {
      console.log(`=== ${f} (via ${res.model}) ===`);
      console.log(res.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    } else {
      console.log(`Failed for ${f}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
run();
