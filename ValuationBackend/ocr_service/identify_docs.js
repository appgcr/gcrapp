const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY;
const dir = 'C:\\Users\\busar\\.gemini\\antigravity-ide\\brain\\fd21fa50-a551-4b01-9e7c-fb3c23568236\\.user_uploaded';

const checkFiles = [
  'media_1789018078005.png',
  'media_1789018084748.png',
  'media_1789018091489.png',
  'media_1789018099280.png',
  'media_1789018630931.png',
  'media_1789018663249.jpg'
];

async function identify() {
  for (const f of checkFiles) {
    const fPath = path.join(dir, f);
    if (!fs.existsSync(fPath)) continue;
    const b64 = fs.readFileSync(fPath).toString('base64');
    const ext = f.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Identify this Indian property document. State title, document type (Sale Deed, Building Plan, Property Tax, Market Value, Layout Plan, or other), key numbers (Assessment No, PTIN, Market Value amount, Survey No, etc.), in 2 sentences.' },
            { inlineData: { mimeType: ext, data: b64 } }
          ]
        }]
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`=== ${f} ===`);
      console.log(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    } else {
      console.log(`Error on ${f}:`, res.status);
    }
  }
}
identify();
