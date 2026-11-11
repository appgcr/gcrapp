// Strict document check for the engineer's Step 2.
//
//  • What kind of document is it? (sale deed, building plan / permit, tax receipt, market value
//    certificate, layout plan, or something else) — a file in the wrong slot is rejected.
//  • Sale deed: the names on the deed (Telugu or English) must match the customer entered in Step 1.
//  • The details read from the document are returned to pre-fill the case.
//
// Reading is done by Google Gemini (vision) when GEMINI_ENABLED + GEMINI_API_KEY are set. Without it the
// document cannot be read on this server, so the upload is accepted and marked "AI verification pending"
// (duplicate, file-type and required-document rules still apply).
const { config } = require('../config/env');

const DOC_TYPES = {
  saleDeed: { code: 'sale_deed', name: 'Registered Sale Deed' },
  buildingPlan: { code: 'building_plan', name: 'Approved Building Plan / Permit Order' },
  propertyTax: { code: 'property_tax', name: 'Property Tax Assessment / Receipt' },
  marketValue: { code: 'market_value', name: 'Market Value / Guideline Certificate' },
  layoutPlan: { code: 'layout_plan', name: 'Layout / Approval Plan' },
};
const CODE_NAMES = {
  sale_deed: 'a Sale Deed', building_plan: 'a Building Plan / Permit Order', property_tax: 'a Property Tax Receipt',
  market_value: 'a Market Value Certificate', layout_plan: 'a Layout / Site Plan', aadhaar_or_id: 'an ID card (Aadhaar / PAN)',
  photo: 'a photograph', other: 'not a property document',
};

const aiEnabled = () => Boolean(config.GEMINI_ENABLED && (config.GEMINI_API_KEY || process.env.GEMINI_API_KEY));

// ── Names: Telugu → Latin letters, and a sound "skeleton" so spellings match (Sujatha ≈ సుజాత ≈ Sujata)
const TE = {
  'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au',
  'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'n', 'చ': 'ch', 'ఛ': 'ch', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'n',
  'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
  'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ఱ': 'r', 'ల': 'l', 'ళ': 'l', 'వ': 'v',
  'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h',
};
const TE_SIGNS = { 'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au', 'ం': 'm', 'ః': 'h' };
const isTeConsonant = (ch) => /[క-హ]/.test(ch);

function teluguToLatin(text) {
  let out = '';
  const chars = [...String(text || '')];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (TE[ch]) {
      out += TE[ch];
      const next = chars[i + 1];
      if (isTeConsonant(ch) && next !== '్' && !TE_SIGNS[next]) out += 'a';   // inherent vowel
    } else if (TE_SIGNS[ch]) out += TE_SIGNS[ch];
    else if (ch === '్') continue;
    else out += ch;
  }
  return out;
}

const TITLES = /\b(sri|shri|smt|srimathi|sreemathi|kum|kumari|mr|mrs|ms|dr|late|s\/o|w\/o|d\/o|c\/o|son|wife|daughter|of)\b\.?/gi;

function skeleton(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  w = w.replace(/th/g, 't').replace(/dh/g, 'd').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ph/g, 'p')
    .replace(/bh/g, 'b').replace(/jh/g, 'j').replace(/ch/g, 'c').replace(/sh/g, 's').replace(/z/g, 'j').replace(/w/g, 'v')
    .replace(/q/g, 'k').replace(/x/g, 'ks').replace(/f/g, 'p');
  if (!w) return '';
  const head = w[0];
  const rest = w.slice(1).replace(/[aeiouy]/g, '');
  return (head + rest).replace(/(.)\1+/g, '$1');
}

const COMMON = new Set(['reddy', 'rao', 'naidu', 'kumar', 'devi', 'babu', 'sharma', 'shaik', 'sheik', 'syed', 'begum', 'bee', 'bi',
  'venkata', 'sri', 'lakshmi', 'amma', 'chowdary', 'goud', 'gowd', 'swamy', 'prasad', 'raju', 'murthy', 'khan', 'basha', 'saheb']
  .map(w => skeleton(w)));

function nameTokens(name) {
  return String(name || '').replace(TITLES, ' ').split(/[^A-Za-z]+/).filter(t => t.length >= 3);
}

/** Does the Step 1 customer appear among the names read from the deed (or its text)? */
function namesMatch(clientName, candidates = [], rawText = '') {
  const want = nameTokens(clientName).map(skeleton).filter(s => s.length >= 2);
  if (!want.length) return { matched: true };
  const pool = new Set();
  const add = (s) => nameTokens(teluguToLatin(s)).forEach(t => { const k = skeleton(t); if (k.length >= 2) pool.add(k); });
  candidates.forEach(add);
  if (rawText) add(rawText);
  const hit = (w) => pool.has(w) || [...pool].some(p => p.length >= 3 && w.length >= 3 && (p.startsWith(w) || w.startsWith(p)));
  const hits = want.filter(hit);
  // Common surnames / words alone (Reddy, Rao, Devi…) are not enough — a distinctive name must match too
  const distinctive = want.filter(w => !COMMON.has(w));
  const needed = Math.max(1, Math.ceil(want.length / 2));
  const okDistinct = !distinctive.length || distinctive.some(hit);
  return { matched: hits.length >= needed && okDistinct, hits: hits.length, needed };
}

// ── Gemini vision: classify + read the document ──────────────────────────────
const PROMPT = (expected) => `You are checking documents for an Indian bank property valuation (Andhra Pradesh / Telangana).
The engineer uploaded this file as: ${expected}.
Documents are often in Telugu; read Telugu carefully and give every name in English letters (transliterate, do not translate).
Read ALL pages (the property schedule with survey no., extent and boundaries is usually on the later pages).
"sale_deed" means any registered ownership deed: sale deed (విక్రయ దస్తావేజు), rectification deed (సవరణ దస్తావేజు),
gift / settlement / partition / release deed.
In a deed the BUYER / receiver (వ్రాయించుకొన్నవారు, "claimant", 1st party who receives) has role "purchaser";
the SELLER / giver (వ్రాయించియిచ్చినవారు, "executant") has role "vendor". Witnesses are role "other".
"building_plan" means the Building Permit Order / plan sanction letter or proceedings (a typed approval document).
"layout_plan" means any DRAWING: approved building plan sheet, site plan, layout plan, floor plans, sections,
elevations (architectural / site drawings), even when it carries a BA / permit number and an approval stamp.
Set "isDrawing": true when the file is mainly a drawing.
Never return Aadhaar, PAN or phone numbers.
Reply with ONLY this JSON:
{
 "docType": "sale_deed" | "building_plan" | "property_tax" | "market_value" | "layout_plan" | "aadhaar_or_id" | "photo" | "other",
 "confidence": 0-1,
 "isDrawing": true/false,
 "readable": true/false,
 "persons": [{"role": "purchaser|vendor|owner|claimant|executant|assessee|applicant|other", "name": "English letters", "relation": "S/o / W/o / D/o … in English letters or null"}],
 "fields": {
   "deedNo": null, "deedDate": "DD-MM-YYYY or null", "surveyNo": null, "plotNo": null, "doorNo": null, "flatNo": null,
   "extent": "number and unit as written, e.g. 2.58 Cents / 145 Sq.Yds / Ac 1.20", "village": null, "mandal": null, "district": null,
   "wardNo": null, "khataNo": null, "assessmentNo": null, "taxAmount": null, "marketValue": null, "guidelineRate": null,
   "approvalPlanNo": null, "approvalPlanDate": null, "plinthArea": null,
   "boundaries": {"north": null, "south": null, "east": null, "west": null}
 }
}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function readWithAI(dataUrl, expectedName) {
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  // Main model first, then newer / lighter ones when Google reports it is busy
  const models = [...new Set([config.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'].filter(Boolean))];
  const bytes = Math.round(m[2].length * 0.75);
  const timeout = Math.max(config.GEMINI_TIMEOUT_MS || 60000, bytes > 1e6 ? 150000 : 90000); // big scanned deeds need longer
  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT(expectedName) }, { inlineData: { mimeType: m[1], data: m[2] } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  const deadline = Date.now() + 150000; // never keep the engineer waiting more than ~2.5 minutes
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 5000) return null;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(Math.min(timeout, left)),
        });
        if (!res.ok) {
          console.warn(`Document AI (${model}) HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 160)}`);
          if (res.status === 400) return { badFile: true };                    // Google could not open the file
          if (res.status === 401 || res.status === 403) return null;          // key problem: retrying won't help
          continue;
        }
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim()
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        if (text) return JSON.parse(text);
      } catch (err) {
        console.warn(`Document AI (${model}) failed:`, err.message);
      }
    }
    if (Date.now() + 4000 < deadline) await sleep(4000); // every model busy: wait a moment, then one more round
  }
  return null;
}

// "198.45000000000002 Sq. Yards" → "198.45 Sq. Yards"
const tidyNumber = (v) => (v == null ? v : String(v).replace(/\d+\.\d{3,}/g, (n) => String(Math.round(parseFloat(n) * 100) / 100)));

// Map the AI reading onto the fields the app pre-fills
function toCaseFields(ai) {
  const f = (ai && ai.fields) || {};
  const people = (ai && ai.persons) || [];
  const owner = people.find(p => /purchaser|owner|claimant|assessee/i.test(p.role)) || people[0];
  const vendor = people.find(p => /vendor|executant/i.test(p.role));
  const yearOf = (d) => (/(\d{4})$/.exec(String(d || '')) || [])[1];
  const out = {
    deedNo: f.deedNo, deedDate: f.deedDate, deedYear: yearOf(f.deedDate) || (/\/(\d{4})/.exec(String(f.deedNo || '')) || [])[1],
    surveyNo: f.surveyNo, plotNo: f.plotNo, doorNo: f.doorNo, flatNo: f.flatNo, netExtent: tidyNumber(f.extent), wardNo: f.wardNo,
    khathaNo: f.khataNo, assessmentNo: f.assessmentNo, taxAmount: f.taxAmount, marketValue: f.marketValue, guidelineRate: f.guidelineRate,
    approvalPlanNo: f.approvalPlanNo, approvalPlanDate: f.approvalPlanDate, village: f.village, mandal: f.mandal,
    ownerName: owner && owner.name, fathersName: owner && owner.relation, vendorName: vendor && vendor.name,
    boundaries: f.boundaries && Object.values(f.boundaries).some(Boolean) ? f.boundaries : null,
  };
  Object.keys(out).forEach(k => (out[k] === null || out[k] === undefined || out[k] === '') && delete out[k]);
  return out;
}

/**
 * Check one uploaded page.  → { passed, reason?, pendingVerification?, extractedMeta?, engine }
 */
async function verifyDocument({ dataUrl, docId, clientName, ocrText = '' }) {
  const slot = DOC_TYPES[docId];
  if (!slot) return { passed: false, reason: 'Unknown document slot.' };
  if (!aiEnabled()) {
    return { passed: true, pendingVerification: true, engine: 'AI verification pending (no AI key configured)',
             warning: `${slot.name} saved — AI verification will run once the AI service is switched on.` };
  }
  const ai = await readWithAI(dataUrl, slot.name);
  if (!ai) {
    // Google busy / offline: keep the page, flag it — the admin sees it was not AI-verified
    return { passed: true, pendingVerification: true, engine: 'AI busy — verification pending',
             warning: `${slot.name} saved, but the AI reader is busy right now, so it is marked "AI check pending". The admin will see it was not verified.` };
  }
  if (ai.badFile) {
    return { passed: false, reason: `This file could not be opened as a document. Please upload a clear photo (JPG / PNG) or PDF of the ${slot.name}.` };
  }
  if (ai.readable === false) {
    return { passed: false, reason: `This ${slot.name} is not readable. Please upload a clear, well-lit scan or photo of the full page.` };
  }
  // Wrong document in this slot
  // Plans: the permit slot takes the permit order or the approved plan drawing; the layout slot takes drawings
  const PLAN = ['building_plan', 'layout_plan'];
  const sameKind = ai.docType === slot.code ||
    (slot.code === 'building_plan' && ai.docType === 'layout_plan') ||
    (slot.code === 'layout_plan' && PLAN.includes(ai.docType) && ai.isDrawing === true);
  if (!sameKind) {
    return { passed: false, detected: ai.docType,
             reason: `This is ${CODE_NAMES[ai.docType] || 'a different document'}, not the ${slot.name}. Please upload the correct document in this slot.` };
  }
  const extractedMeta = toCaseFields(ai);
  // Names on the sale deed must match the customer from Step 1
  if (docId === 'saleDeed' && clientName) {
    // The customer must be the owner / buyer — a seller or witness with the same name does not count
    const people = (ai.persons || []).filter(p => p && p.name);
    const owners = people.filter(p => /purchaser|owner|claimant|assessee/i.test(p.role || ''));
    const names = (owners.length ? owners : people).map(p => p.name);
    if (names.length) {
      const check = namesMatch(clientName, names, ocrText);
      if (!check.matched) {
        return { passed: false, nameMismatch: true, namesOnDocument: names,
                 reason: `The owner / buyer on this Sale Deed (${names.join(', ')}) does not match the customer "${clientName}" entered in Step 1.\n\nThis document does not belong to this case. Please upload the customer's own Sale Deed, or correct the customer name in Step 1.` };
      }
    }
  }
  return { passed: true, extractedMeta, aiDocType: ai.docType, confidence: ai.confidence, engine: 'Gemini Document AI' };
}

module.exports = { verifyDocument, namesMatch, teluguToLatin, skeleton, aiEnabled, DOC_TYPES };
