// Mahe AI review call: before a case goes to the admin, the engineer is asked about anything that looks
// wrong — valuer checks on the figures, and the form compared with the uploaded documents.
// Each question can point at one field; the engineer keeps it, changes it, or explains.

const { runPreCheck } = require('./preCheck');
const { askJson } = require('./aiJson');

// Fields a question may correct (path in the case → plain name)
const FIELDS = {
  clientName: 'Owner / customer name',
  clientFatherName: 'S/o · W/o · D/o',
  'propertyDetails.deedNo': 'Deed number',
  'propertyDetails.deedDate': 'Deed date',
  'propertyDetails.netExtent': 'Extent as per deed',
  'propertyDetails.report.netExtentPlanRaw': 'Net extent as per plan',
  'propertyDetails.surveyNo': 'Survey number',
  'propertyDetails.doorNo': 'Door number',
  'propertyDetails.wardNo': 'Ward number',
  'propertyDetails.plotNo': 'Plot number',
  'propertyDetails.assessmentNo': 'Property tax assessment number',
  'propertyDetails.approvalPlanNo': 'Plan approval (B.A.) number',
  'propertyDetails.approvalPlanDate': 'Plan approval date',
  'propertyDetails.buildingAge': 'Age of the building (years)',
  'propertyDetails.roadWidth': 'Road width (ft)',
  'propertyDetails.guidelineRate': 'Guideline rate per Sq.yd',
  'propertyDetails.report.marketRatePerCent': 'Market rate per cent',
  'propertyDetails.report.constructionRate': 'Construction rate per sqft',
  'propertyDetails.boundariesActual.east': 'East boundary',
  'propertyDetails.boundariesActual.west': 'West boundary',
  'propertyDetails.boundariesActual.north': 'North boundary',
  'propertyDetails.boundariesActual.south': 'South boundary',
};
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]); return Number.isFinite(n) && n > 0 ? n : 0; };
const inr = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const words = (t) => new Set(String(t || '').toLowerCase().replace(/^(sri|smt|kum|mr|mrs|ms)\.?\s+/, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
const sameName = (a, b) => { const A = words(a); const B = words(b); if (!A.size || !B.size) return true; let hit = 0; A.forEach((w) => { if (B.has(w)) hit++; }); return hit > 0; };

/** Valuer checks on the figures (no AI needed) */
async function ruleQuestions(draft, opts) {
  const pd = draft.propertyDetails || {};
  const rep = pd.report || {};
  const qs = [];
  const add = (q) => qs.push({ source: 'check', ...q });
  const built = !/open|agri|site|plot|land/i.test(pd.propertyType || '');


  // Rate written without lakhs ("14.25")
  const rate = num(rep.marketRatePerCent);
  if (rate && rate < 1000) add({ id: 'rate_unit', field: 'propertyDetails.report.marketRatePerCent', kind: 'value',
    text: `The market rate per cent is only ${inr(rate)}. Did you mean ${inr(rate * 100000)} (${rate} lakhs)?`, suggest: String(Math.round(rate * 100000)),
    te: `Market rate per cent ${inr(rate)} మాత్రమే ఉందండి. ${inr(rate * 100000)} అంటే ${rate} lakhs అని అనుకున్నారా అండి?` });
  // Construction rate far outside the usual range
  const cr = num(rep.constructionRate);
  if (built && cr && (cr < 800 || cr > 6000)) add({ id: 'construction_rate', field: 'propertyDetails.report.constructionRate', kind: 'value',
    text: `The construction rate is ${inr(cr)} per sqft. That is outside the usual Rs 800 – Rs 6,000. Is it correct?`,
    te: `Construction rate sqft కి ${inr(cr)} అని ఉందండి. మామూలుగా Rs 800 నుంచి Rs 6,000 మధ్య ఉంటుంది. ఇది correct ఏనా అండి?` });
  // Floor area vs plot
  const floors = ((pd.siteValue || {}).floors || []).map((f) => num(f.value));
  const plotSqft = num(pd.netExtent) && /yd|yard/i.test(pd.netExtent) ? num(pd.netExtent) * 9 : 0;
  if (built && plotSqft && floors[0] && floors[0] > plotSqft * 1.05) add({ id: 'gf_vs_plot', field: null, kind: 'confirm',
    text: `The ground floor (${floors[0]} sqft) is bigger than the whole plot (${Math.round(plotSqft)} sqft). Please check the floor area or the extent.`,
    te: `Ground floor ${floors[0]} sqft అని ఉంది, కానీ plot మొత్తం ${Math.round(plotSqft)} sqft మాత్రమే అండి. Floor area లేదా extent ఒకసారి check చేస్తారా?` });
  // Tax receipt in another name
  const taxName = (pd.sheet && pd.sheet.taxName) || rep.taxPaidName || '';
  const owner = (pd.dealType === 'Purchase' && pd.sheet && pd.sheet.ownerName) || draft.clientName;
  if (taxName && owner && !sameName(taxName, owner)) add({ id: 'tax_name', field: null, kind: 'confirm',
    text: `The property tax is in the name of ${taxName}, but the owner is ${owner}. Is that correct (e.g. not yet mutated)?`,
    te: `Property tax ${taxName} పేరు మీద ఉందండి, కానీ owner ${owner}. ఇది correct ఏనా? అంటే mutation ఇంకా అవ్వలేదా అండి?` });
  // S/o missing
  if (!String(draft.clientFatherName || '').trim() && !(pd.sheet && (pd.sheet.ownerRelation || pd.sheet.applicantRelation))) add({ id: 'relation', field: 'clientFatherName', kind: 'value',
    text: `The owner's S/o, W/o or D/o is not filled. What is it?`,
    te: `Owner గారి S/o, W/o లేదా D/o fill చేయలేదండి. అది ఏంటో చెప్తారా అండి?` });
  // Road width
  if (!num(pd.roadWidth)) add({ id: 'road_width', field: 'propertyDetails.roadWidth', kind: 'value', text: 'The road width is not filled. How wide is the road in feet?',
    te: 'Road width fill చేయలేదండి. Road ఎన్ని feet ఉందో చెప్తారా అండి?' });

  // Pre-submit checks the admin would also see (extent vs plan, sides vs extent, rate vs guideline / nearby,
  // age vs permit, boundaries, photos) — after the specific questions above, which take priority per field
  try {
    const pre = await runPreCheck(draft, opts);
    for (const c of (pre.checks || []).filter((x) => x.level === 'warn')) {
      const field = { extent_plan: 'propertyDetails.netExtent', age_permit: 'propertyDetails.buildingAge', rate_guideline: 'propertyDetails.report.marketRatePerCent', rate_nearby: 'propertyDetails.report.marketRatePerCent' }[c.id] || null;
      add({ id: `pre_${c.id}`, field, text: `${c.title}. ${c.detail}`, kind: field ? 'value' : 'confirm' });
    }
  } catch { /* the review still runs */ }
  return qs;
}

/** Form vs the uploaded documents (AI reads the first pages) */
async function documentQuestions(draft, readFile) {
  const docs = draft.documents || {};
  const pick = ['officeSheet', 'saleDeed', 'propertyTax', 'buildingPlan', 'marketValue'];
  const files = [];
  for (const k of pick) {
    const page = Array.isArray(docs[k]) ? docs[k][0] : null;
    if (!page || files.length >= 3) continue;
    try {
      const got = await readFile(page);
      if (!got || !got.bytes || got.bytes.length > 9 * 1024 * 1024) continue;
      const pdf = /pdf/.test(got.type) || got.bytes.slice(0, 4).toString() === '%PDF';
      const img = /image\//.test(got.type) || (got.bytes[0] === 0xff && got.bytes[1] === 0xd8) || got.bytes.slice(1, 4).toString() === 'PNG';
      if (!pdf && !img) continue;
      const mime = pdf ? 'application/pdf' : (got.type && got.type.startsWith('image/') ? got.type : 'image/jpeg');
      files.push({ k, url: `data:${mime};base64,${got.bytes.toString('base64')}` });
    } catch { /* skip */ }
  }
  if (!files.length) return [];
  const pd = draft.propertyDetails || {};
  const form = {};
  for (const path of Object.keys(FIELDS)) { const v = get(draft, path); if (v != null && String(v).trim()) form[path] = String(v); }
  if (pd.sheet && pd.sheet.ownerName) form['sheet.ownerName'] = pd.sheet.ownerName;
  const prompt = `You check an Indian property valuation form against its documents (${files.map((f) => f.k).join(', ')}).
Form values (path: value):
${Object.entries(form).map(([k, v]) => `${k}: ${v}`).join('\n')}

List ONLY real mismatches where a document clearly shows a different value for the same thing (ignore spelling-case, "Sri/Smt", spacing, "Sq.Yds" vs "sq yards" and other harmless differences). At most 6.
Answer JSON: {"mismatches":[{"path": one of the form paths above, "documentValue": "value in the document", "document": "which document", "question": "short question to the engineer in simple English using plain words (deed number, extent, sale deed — never field names like deedNo), mentioning both values", "question_te": "the same question in natural, polite spoken Telugu as a Telugu colleague would say it on the phone (అండి at the end, never at the start; keep words like deed, survey number, extent, sale deed, correct in English letters; keep all numbers exactly)"}]}`;
  let out = null;
  try { out = await askJson(prompt, files.map((f) => f.url), { timeoutMs: 60000 }); } catch { out = null; }
  const list = Array.isArray(out && out.mismatches) ? out.mismatches : [];
  // Plain words, never internal names ("deedNo" → "deed number", "saleDeed" → "sale deed")
  const DOC_WORDS = { saleDeed: 'sale deed', officeSheet: 'office sheet', propertyTax: 'tax receipt', buildingPlan: 'approved plan', marketValue: 'guideline certificate', layoutPlan: 'layout plan' };
  const plain = (t) => {
    let out = String(t || '');
    Object.entries(DOC_WORDS).forEach(([k, w]) => { out = out.replace(new RegExp(`\\b${k}\\b`, 'g'), w); });
    Object.entries(FIELDS).forEach(([path, label]) => { const key = path.split('.').pop(); out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), label.toLowerCase()); });
    return out;
  };
  return list.filter((m) => m && FIELDS[m.path] && m.question).slice(0, 6).map((m, i) => ({
    id: `doc_${i}_${m.path}`, source: 'documents', field: m.path, kind: 'value',
    text: plain(m.question).slice(0, 300), te: plain(m.question_te || '').slice(0, 400), suggest: String(m.documentValue || '').slice(0, 120), document: plain(m.document || '').slice(0, 60),
  }));
}

/** All questions for the review call (deduplicated by field) */
async function buildReview(draft, { user = null, readFile } = {}) {
  const [rules, docs] = await Promise.all([ruleQuestions(draft, { user }), documentQuestions(draft, readFile).catch(() => [])]);
  const seen = new Set();
  const all = [];
  for (const q of [...docs, ...rules]) {
    const key = q.field || q.id;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push({ ...q, label: q.field ? FIELDS[q.field] : '', current: q.field ? String(get(draft, q.field) ?? '') : '' });
  }
  const list = all.slice(0, 10);
  // Each question also in natural spoken Telugu (the call speaks Telugu by default)
  const missing = list.filter((q) => !q.te);
  if (missing.length) {
    try {
      const te = await Promise.race([require('./voice').toTelugu(missing.map((q) => q.text)), new Promise((r) => setTimeout(() => r([]), 15000))]);
      missing.forEach((q, i) => { if (te[i]) q.te = te[i]; });
    } catch { /* those stay in English */ }
  }
  return list;
}

/** The engineer's spoken answer → { transcript, decision: keep | change | explain, value, note } */
async function understandAnswer(audioDataUrl, question) {
  const prompt = `A valuation engineer was asked: "${question.text}"${question.label ? ` (field: ${question.label}, current value: "${question.current}")` : ''}.
They answered by voice (English, Telugu or mixed). Answer JSON:
{"transcript": "what they said, in English", "decision": "keep" (the current value is right) | "change" (give the corrected value) | "explain" (a reason, no change), "value": "the corrected value when decision is change, as it should be written in the form", "note": "their reason in one short sentence"}`;
  const out = await askJson(prompt, [audioDataUrl], { timeoutMs: 45000 });
  if (!out) return null;
  const decision = ['keep', 'change', 'explain'].includes(out.decision) ? out.decision : 'explain';
  return { transcript: String(out.transcript || '').slice(0, 500), decision, value: String(out.value || '').slice(0, 200), note: String(out.note || '').slice(0, 300) };
}

module.exports = { buildReview, understandAnswer, FIELDS };
