const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY;
const testModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash'];

async function test() {
  for (const m of testModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return JSON: {"status":"active"}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      console.log(`Model ${m} -> HTTP ${res.status}`);
    } catch (e) {
      console.log(`Model ${m} Exception:`, e.message);
    }
  }
}
test();
