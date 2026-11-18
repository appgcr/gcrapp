// The filled GOURU VALUATION – OFFICE sheet → fields for the case.
//  • Word (.docx): the sheet's table is read row by row (exact, no AI needed)
//  • PDF / photo (typed or handwritten): Gemini reads it into the same fields
// The engineer always checks and corrects the result in the app before going on.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const FIELDS = ['dealType', 'ownerName', 'ownerAddress', 'applicantName', 'applicantAddress', 'bank', 'engineerNames', 'inspectionDate',
  'deedNo', 'deedDate', 'surveyNo', 'doorNo', 'wardNo', 'plotNo', 'address', 'extentDocument', 'extentPlan', 'netExtentPlan',
  'roadAffectedArea', 'baNumber', 'baDate', 'floorsArea', 'guidelineRate', 'assessmentNo', 'taxAmount', 'taxName', 'propertyType',
  'structureType', 'buildingAge', 'marketRatePerCent', 'constructionRate', 'roadWidth', 'roadType', 'flooringType', 'comments', 'extras'];
const SIDES = ['east', 'west', 'north', 'south'];

const PROPERTY = { HOUSE: 'Independent House', OPEN: 'Open Site', APARTMENT: 'Apartment', AGRI: 'Open Agriculture Land', INDUSTRIAL: 'Industrial Unit' };
const STRUCTURE = { 'R.C.C FRAMED': 'RCC Framed structure', 'LOAD BEARING': 'Load bearing', 'PEB STRUCTURE': 'PEB structure' };
const ROAD = { 'CC ROAD': 'CC Road', 'BT ROAD': 'BT Road', 'METAL ROAD': 'Metal Road' };
const FLOORING = { TILES: 'Tiles', GRANITE: 'Granite', MARBLE: 'Marble', 'KADAPA SLAB': 'Kadapa slab', 'BETHAM CHERLA': 'Betham cherla' };

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const tidy = (s) => String(s || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim();
/** Cell text without the template's own label words */
const strip = (text, ...labels) => {
  let t = String(text || '');
  for (const l of labels) t = t.replace(new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i'), ' ');
  return tidy(t);
};
const DATE = /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s+\d{4})\b/;

function splitNameAddress(s) {
  const t = tidy(s);
  if (!t) return ['', ''];
  const parts = t.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  return [parts[0] || '', parts.slice(1).join(', ')];
}

// ── Spelling-tolerant matching ──────────────────────────────────────────────────────────
// Words engineers write for each choice (typos are caught by the edit-distance check below)
const SYNONYMS = {
  'Independent House': ['HOUSE', 'INDEPENDENT HOUSE', 'RESIDENTIAL HOUSE', 'BUILDING', 'RESIDENTIAL BUILDING', 'HOME'],
  'Open Site': ['OPEN', 'OPEN SITE', 'OPEN PLOT', 'PLOT', 'SITE', 'VACANT SITE', 'VACANT LAND', 'HOUSE SITE'],
  'Apartment': ['APARTMENT', 'FLAT', 'APT'],
  'Open Agriculture Land': ['AGRI', 'AGRICULTURE', 'AGRICULTURAL', 'AGRICULTURE LAND', 'FARM', 'FARM LAND', 'DRY LAND', 'WET LAND'],
  'Industrial Unit': ['INDUSTRIAL', 'INDUSTRY', 'SHED', 'FACTORY', 'GODOWN'],
  'RCC Framed structure': ['R C C FRAMED', 'RCC FRAMED', 'RCC', 'FRAMED', 'FRAMED STRUCTURE', 'RCC FRAME', 'R C C'],
  'Load bearing': ['LOAD BEARING', 'LOAD BEARING STRUCTURE', 'LOAD', 'LB'],
  'PEB structure': ['PEB STRUCTURE', 'PEB', 'PRE ENGINEERED', 'STEEL STRUCTURE', 'STEEL'],
  'CC Road': ['CC ROAD', 'CC', 'C C ROAD', 'C C', 'CEMENT ROAD', 'CONCRETE ROAD'],
  'BT Road': ['BT ROAD', 'BT', 'B T ROAD', 'B T', 'BITUMEN', 'BLACK TOP', 'TAR ROAD'],
  'Metal Road': ['METAL ROAD', 'METAL', 'WBM', 'GRAVEL ROAD', 'GRAVEL', 'MUD ROAD'],
  'Tiles': ['TILES', 'TILE', 'VITRIFIED', 'VITRIFIED TILES', 'CERAMIC', 'CERAMIC TILES'],
  'Granite': ['GRANITE'],
  'Marble': ['MARBLE'],
  'Kadapa slab': ['KADAPA SLAB', 'KADAPA', 'CUDDAPAH SLAB', 'CUDDAPAH', 'KADAPA STONE', 'SLAB'],
  'Betham cherla': ['BETHAM CHERLA', 'BETHAMCHERLA', 'BETHAM', 'BETAMCHERLA', 'BETHAM CHERLA SLAB'],
};

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}
/** "close enough" for a hand-typed word: 1 typo in short words, 2 in longer ones */
const near = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1));

/** Free text → one of `choices` (canonical names), or '' — "Hose" → Independent House, "granit" → Granite */
function classify(text, choices) {
  const t = norm(text);
  if (!t) return '';
  const words = t.split(' ');
  let best = '', bestScore = 0;
  for (const c of choices) {
    for (const syn of SYNONYMS[c] || [norm(c)]) {
      const sw = syn.split(' ');
      let score = 0;
      if (t === syn) score = 100;
      else if (` ${t} `.includes(` ${syn} `)) score = 50 + syn.length;
      else if (sw.length === 1 ? words.some((w) => near(w, syn)) : near(t, syn) || sw.every((x) => words.some((w) => near(w, x)))) score = 20 + syn.length;
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  return best;
}

/** Which option the engineer picked in a row of choices: a marked word, a tick, the only one left,
 *  or a choice written in their own words / with a spelling mistake */
function pick(cells, map) {
  const opts = Object.keys(map);
  const choices = [...new Set(Object.values(map))];
  const all = cells.map((c) => ({ text: norm(c.text), raw: c.text, marked: (c.marked || []).map(norm) }));
  for (const c of all) for (const m of c.marked) {
    if (!m) continue;
    const hit = opts.find((o) => norm(o) === m || norm(o).startsWith(m) || m.startsWith(norm(o)) || norm(o).split(' ').includes(m));
    if (hit) return map[hit];
    const fuzzy = classify(m, choices);
    if (fuzzy) return fuzzy;
  }
  // A tick written in the cell of an option (no word next to it)
  for (const c of all) {
    if (/[✓✔√☑]/.test(c.raw)) { const o = opts.find((x) => c.text.includes(norm(x))); if (o) return map[o]; const f = classify(c.text, choices); if (f) return f; }
  }
  const joined = all.map((c) => c.text).join(' | ');
  const present = opts.filter((o) => joined.includes(norm(o)));
  if (present.length === 1) return map[present[0]];
  // Something typed next to one option ("Tiles ✓", "HOUSE - yes")
  for (const c of all) {
    const o = opts.find((x) => c.text.startsWith(norm(x)));
    if (o && c.text.length > norm(o).length + 1) return map[o];
  }
  // The engineer deleted the other options and wrote / misspelt the chosen one ("Hose", "granit", "C.C road")
  const written = all.filter((c) => c.text && !opts.some((o) => norm(o) === c.text));
  if (present.length === 0 || written.length) {
    const hits = [...new Set((written.length ? written : all).map((c) => classify(c.text, choices)).filter(Boolean))];
    if (hits.length === 1) return hits[0];
  }
  return '';
}

/** A row of the sheet by its label, also when the label was retyped or misspelt ("SURVY NO", "Door Number") */
function findRow(rows, labels) {
  const list = Array.isArray(labels) ? labels : [labels];
  const exact = rows.find((r) => r[0] && list.some((l) => norm(r[0].text).startsWith(norm(l))));
  if (exact) return exact;
  return rows.find((r) => {
    if (!r[0]) return false;
    const head = norm(r[0].text).split(' ').slice(0, 3);
    return list.some((l) => {
      const lw = norm(l).split(' ');
      return lw.every((w, k) => head[k] && (head[k] === w || near(head[k], w) || (w === 'NO' && /^(NO|NUMBER|NUM|NOS)$/.test(head[k]))));
    });
  });
}

// ── Values as a valuer writes them ───────────────────────────────────────────────────────
/** "14.25 lakhs" → 1425000, "Rs.7,500/-" → 7500, "1.2 Cr" → 12000000; '' when no number */
function amount(v) {
  const t = String(v || '').replace(/,/g, '').toLowerCase();
  const m = /(\d+(?:\.\d+)?)/.exec(t);
  if (!m) return '';
  let n = parseFloat(m[1]);
  if (/\b(lakh|lakhs|lac|lacs|lks?|l)\b/.test(t.slice(m.index + m[1].length, m.index + m[1].length + 8))) n *= 100000;
  else if (/\b(crore|crores|cr|crs)\b/.test(t.slice(m.index + m[1].length, m.index + m[1].length + 9))) n *= 10000000;
  return Math.round(n);
}
const inr = (n) => (n === '' || n == null ? '' : Number(n).toLocaleString('en-IN'));
/** "Doc no 4321 of 2019" / "R.No 4321-2019" → "4321/2019" */
function deedNumber(v) {
  let t = tidy(String(v || '').replace(/^(doc(ument)?|deed|regd?|r)\.?\s*(no\.?|number)?\s*[:.-]?\s*/i, '')).replace(/[,.]$/, '');
  const m = /^(\d+)\s*(?:of|\/|-)\s*((?:19|20)\d{2})$/i.exec(t);
  if (m) t = `${m[1]}/${m[2]}`;
  return t;
}
/** "Sri X, S/o Late Y" → ['Sri X', 'S/o Late Y'] */
function splitRelation(name) {
  const m = /^(.*?)[,\s]+((?:s|w|d|c)\s*\/\s*o\.?\s+.*)$/i.exec(String(name || '').trim());
  return m ? [m[1].trim().replace(/,$/, ''), m[2].replace(/^(\w)\s*\/\s*o\.?\s*/i, (x, c) => `${c.toUpperCase()}/o `).trim()] : [String(name || '').trim(), ''];
}

function fromWordRows(rows) {
  const out = { measurements: {}, boundaries: {}, _notes: [] };
  const noteFuzzy = (cells, result) => {
    if (!result) return;
    const written = cells.map((c) => tidy(c.text)).filter(Boolean).join(' ');
    const canon = (SYNONYMS[result] || [norm(result)])[0];
    if (written && !norm(written).includes(canon) && !norm(written).includes(norm(result))) out._notes.push(`${written} → ${result}`);
  };
  const ALIASES = {
    'BANK NAME': ['BANK NAME', 'BANK', 'NAME OF BANK'], 'ENGINEER NAMES': ['ENGINEER NAMES', 'ENGINEER', 'ENGINEERS'],
    'DEED NO': ['DEED NO', 'DOC NO', 'DOCUMENT NO', 'REGD NO'], 'SURVEY NO': ['SURVEY NO', 'SY NO', 'S NO', 'R S NO'],
    'DOOR NO': ['DOOR NO', 'D NO', 'H NO', 'HOUSE NO'], 'WARD NO': ['WARD NO', 'WARD'], 'DETAIL ADDRESS': ['DETAIL ADDRESS', 'ADDRESS', 'DETAILED ADDRESS'],
    'NET EXTENT AS PER PLAN': ['NET EXTENT AS PER PLAN', 'NET EXTENT'], 'PLAN APPROVAL': ['PLAN APPROVAL', 'BA NUMBER', 'B A NUMBER', 'PLAN NO', 'LP NO'],
    'GF AREA': ['GF AREA', 'G F AREA', 'PLINTH AREA', 'BUILT UP AREA'], 'GOVT MARKET VALUE': ['GOVT MARKET VALUE', 'GOVERNMENT MARKET VALUE', 'GUIDELINE', 'GUIDE LINE', 'SRO VALUE', 'BASIC VALUE'],
    'PROPERTY TAX': ['PROPERTY TAX', 'HOUSE TAX', 'TAX'], 'TYPE OF PROPERTY': ['TYPE OF PROPERTY', 'PROPERTY TYPE'],
    'TYPE OF STRUCTURE': ['TYPE OF STRUCTURE', 'STRUCTURE'], 'AGE OF THE BUILDING': ['AGE OF THE BUILDING', 'AGE OF BUILDING', 'AGE'],
    'MARKET RATE PER CENT': ['MARKET RATE PER CENT', 'MARKET RATE', 'RATE PER CENT', 'LAND RATE'], 'CONSTRUCTION RATE': ['CONSTRUCTION RATE', 'BUILDING RATE', 'COST OF CONSTRUCTION'],
    'ROAD WIDTH': ['ROAD WIDTH', 'WIDTH OF ROAD', 'ROAD'], 'TYPE OF FLOORING': ['TYPE OF FLOORING', 'FLOORING'],
    'ANY OTHER COMMENTS': ['ANY OTHER COMMENTS', 'COMMENTS', 'NOTE', 'REMARKS'], 'EXTRAS': ['EXTRAS', 'EXTRA ITEMS', 'AMENITIES'],
  };
  const find = (label) => findRow(rows, ALIASES[label] || [label]);
  const val = (r, i, ...labels) => (r && r[i] ? strip(r[i].text, ...labels) : '');
  const rest = (r, from = 1) => (r ? tidy(r.slice(from).map((c) => c.text).filter(Boolean).join(' ')) : '');

  // Mortgage / Purchase: the column the engineer filled (or marked)
  const head = rows.find((r) => r.length >= 2 && norm(r[0].text) === 'MORTGAGE');
  const people = find('Owner name');
  const mortgageText = people ? strip(people[0].text, 'Owner name & address', 'Owner name and address') : '';
  const purchaseRaw = people && people[1] ? people[1].text : '';
  const purchaseText = strip(purchaseRaw, 'Applicant name & address', 'owner name');
  const markedPurchase = head && head[1] && ((head[1].marked || []).length || /[✓✔√☑]/.test(head[1].text));
  const markedMortgage = head && head[0] && ((head[0].marked || []).length || /[✓✔√☑]/.test(head[0].text));
  out.dealType = markedPurchase ? 'Purchase' : markedMortgage ? 'Mortgage' : purchaseText && !mortgageText ? 'Purchase' : mortgageText ? 'Mortgage' : '';
  [out.ownerName, out.ownerAddress] = splitNameAddress(mortgageText);
  if (purchaseRaw) {
    const [a, o] = purchaseRaw.split(/owner\s*name\s*[:-]?/i);
    [out.applicantName, out.applicantAddress] = splitNameAddress(strip(a, 'Applicant name & address'));
    const seller = tidy(o || '');
    if (seller) { [out.ownerName, out.ownerAddress] = splitNameAddress(seller); if (mortgageText && out.dealType === 'Purchase') out.ownerAddress = out.ownerAddress || ''; }
  }

  out.bank = rest(find('BANK NAME'));
  const eng = find('ENGINEER NAMES');
  out.engineerNames = val(eng, 1);
  out.inspectionDate = eng ? strip(eng.slice(2).map((c) => c.text).join(' '), 'INSPECTION & VALUATION DATE', 'INSPECTION AND VALUATION DATE') : '';

  const deed = rest(find('DEED NO'));
  const dm = DATE.exec(deed);
  out.deedDate = dm ? dm[1] : '';
  out.deedNo = tidy((dm ? deed.replace(dm[0], ' ') : deed).replace(/\b(dt|dated|date|d)\b\.?/ig, ' '));
  out.surveyNo = rest(find('SURVEY NO'));
  out.doorNo = rest(find('DOOR NO'));
  const ward = find('WARD NO');
  out.wardNo = val(ward, 1);
  out.plotNo = ward ? strip(ward.slice(2).map((c) => c.text).join(' '), 'PLOT NO') : '';
  out.address = rest(find('DETAIL ADDRESS'));
  const ext = find('EXTENT');
  out.extentDocument = val(ext, 1, 'AS PER DOCUMENT');
  out.extentPlan = val(ext, 2, 'AS PER PLAN');
  for (const side of SIDES) {
    const r = find(side.toUpperCase());
    out.measurements[side] = val(r, 1);
    out.boundaries[side] = val(r, 2);
  }
  const net = find('NET EXTENT AS PER PLAN');
  out.netExtentPlan = val(net, 1);
  out.roadAffectedArea = net ? strip(net.slice(2).map((c) => c.text).join(' '), 'ROAD AFFECTED AREA') : '';
  const ba = find('PLAN APPROVAL');
  out.baNumber = val(ba, 1, 'B.A. NUMBER', 'B.A NUMBER', 'BA NUMBER');
  out.baDate = val(ba, 2, 'DATE');
  out.floorsArea = rest(find('GF AREA'));
  out.guidelineRate = strip(rest(find('GOVT MARKET VALUE')), 'UNIT RATE PER SQYD');
  const tax = find('PROPERTY TAX');
  out.assessmentNo = val(tax, 1, 'ASSESSMENT NO');
  out.taxAmount = val(tax, 2, 'AMOUNT');
  out.taxName = val(tax, 3, 'Name');
  const pt = find('TYPE OF PROPERTY'); out.propertyType = pt ? pick(pt.slice(1), PROPERTY) : ''; if (pt) noteFuzzy(pt.slice(1), out.propertyType);
  const st = find('TYPE OF STRUCTURE'); out.structureType = st ? pick(st.slice(1), STRUCTURE) : ''; if (st) noteFuzzy(st.slice(1), out.structureType);
  out.buildingAge = rest(find('AGE OF THE BUILDING'));
  out.marketRatePerCent = rest(find('MARKET RATE PER CENT'));
  out.constructionRate = rest(find('CONSTRUCTION RATE'));
  const rw = find('ROAD WIDTH');
  out.roadWidth = val(rw, 1);
  if (rw && rw[2]) {
    // "Type of road : CC road - BT road - Metal Road" in one cell: split it into choices
    const cellText = strip(rw[2].text, 'Type of road');
    const parts = cellText.split(/\s+-\s+|\s{2,}|\n/).map((t) => ({ text: t, marked: (rw[2].marked || []).filter((m) => norm(t).includes(norm(m))) }));
    out.roadType = pick(parts.length > 1 ? parts : [{ text: cellText, marked: rw[2].marked }], ROAD);
  } else out.roadType = '';
  const fl = find('TYPE OF FLOORING'); out.flooringType = fl ? pick(fl.slice(1), FLOORING) : ''; if (fl) noteFuzzy(fl.slice(1), out.flooringType);
  out.comments = rest(find('ANY OTHER COMMENTS'));
  out.extras = rest(find('EXTRAS'));
  return out;
}

const PROMPT = `This is a filled "GOURU VALUATION - OFFICE" property valuation data sheet from India (typed or handwritten; Telugu names are common).
Read it and answer ONLY with JSON with these keys (use "" when not written; copy numbers and names exactly as written):
The writing may have spelling mistakes: read what was meant (e.g. "Hose" = House, "granit" = Granite, "Mortage" = Mortgage), but copy names, numbers and boundaries exactly as written.
{"dealType": "Mortgage" or "Purchase" (Purchase when an Applicant (buyer) and a separate owner are written, or Purchase is ticked),
 "ownerName","ownerAddress","applicantName","applicantAddress","bank","engineerNames","inspectionDate","deedNo","deedDate","surveyNo","doorNo","wardNo","plotNo","address",
 "extentDocument","extentPlan","measurements":{"east","west","north","south"},"boundaries":{"east","west","north","south"},"netExtentPlan","roadAffectedArea",
 "baNumber","baDate","floorsArea","guidelineRate" (unit rate per sq.yd),"assessmentNo","taxAmount","taxName",
 "propertyType": one of "Independent House","Open Site","Apartment","Open Agriculture Land","Industrial Unit" (the ticked / circled one),
 "structureType": one of "RCC Framed structure","Load bearing","PEB structure", "buildingAge","marketRatePerCent","constructionRate","roadWidth",
 "roadType": one of "CC Road","BT Road","Metal Road", "flooringType": one of "Tiles","Granite","Marble","Kadapa slab","Betham cherla", "comments","extras"}`;

function clean(out) {
  const o = { measurements: {}, boundaries: {} };
  const notes = [];
  for (const k of FIELDS) o[k] = tidy(out && out[k] != null ? String(out[k]) : '');
  for (const side of SIDES) {
    o.measurements[side] = tidy(out?.measurements?.[side] || '');
    o.boundaries[side] = tidy(out?.boundaries?.[side] || '');
  }
  o.ownerRelation = ''; o.applicantRelation = '';
  if (!['Mortgage', 'Purchase'].includes(o.dealType)) {
    o.dealType = /purch|pur|buy|sale|agree/i.test(o.dealType) ? 'Purchase' : /mort|mortage|morgage|lap|loan against/i.test(o.dealType) ? 'Mortgage' : '';
  }
  // Choices written in the engineer's own words / with a spelling mistake → the app's wording
  const CHOICES = {
    propertyType: ['Independent House', 'Open Site', 'Apartment', 'Open Agriculture Land', 'Industrial Unit'],
    structureType: ['RCC Framed structure', 'Load bearing', 'PEB structure'],
    roadType: ['CC Road', 'BT Road', 'Metal Road'],
    flooringType: ['Tiles', 'Granite', 'Marble', 'Kadapa slab', 'Betham cherla'],
  };
  for (const [k, list] of Object.entries(CHOICES)) {
    if (o[k] && !list.includes(o[k])) {
      const c = classify(o[k], list);
      if (c) { notes.push(`${o[k]} → ${c}`); o[k] = c; } else { notes.push(`${o[k]} (not understood — please choose)`); o[k] = ''; }
    }
  }
  // Money: "14.25 lakhs" → 14,25,000 — a rate is never left as a bare 14.25
  for (const k of ['guidelineRate', 'taxAmount', 'marketRatePerCent', 'constructionRate']) {
    if (!o[k]) continue;
    const n = amount(o[k]);
    const v = n === '' ? '' : inr(n);
    if (v && v !== o[k]) { if (/lakh|lac|crore|\bcr\b|\bl\b/i.test(o[k])) notes.push(`${o[k]} → Rs ${v}`); o[k] = v; }
  }
  if (o.marketRatePerCent && amount(o.marketRatePerCent) < 1000) notes.push(`Market rate per cent looks too small (Rs ${o.marketRatePerCent}) — please check`);
  if (o.deedNo) { const d = deedNumber(o.deedNo); if (d !== o.deedNo) { notes.push(`Deed no: ${o.deedNo.replace(/[,.\s]+$/, '')} → ${d}`); o.deedNo = d; } }
  // S/o / W/o written with the name
  for (const [nk, rk] of [['ownerName', 'ownerRelation'], ['applicantName', 'applicantRelation']]) {
    const [name, rel] = splitRelation(o[nk]);
    o[rk] = tidy(out?.[rk] || rel);
    o[nk] = name;
  }
  if (/^(s|w|d)\/o\b/i.test(o.ownerAddress)) {
    const [rel, ...rest] = o.ownerAddress.split(',');
    o.ownerRelation = o.ownerRelation || rel.trim(); o.ownerAddress = rest.join(',').trim();
  }
  if (/^(s|w|d)\/o\b/i.test(o.applicantAddress)) {
    const [rel, ...rest] = o.applicantAddress.split(',');
    o.applicantRelation = o.applicantRelation || rel.trim(); o.applicantAddress = rest.join(',').trim();
  }
  o.corrections = [...(Array.isArray(out?._notes) ? out._notes : []), ...notes];
  return o;
}

const filledCount = (o) => FIELDS.filter((k) => k !== 'dealType' && o[k]).length + SIDES.filter((s) => o.measurements[s] || o.boundaries[s]).length;

/** { bytes, type, name } → { fields, source: 'word' | 'ai', filled } — throws with a plain message */
async function readOfficeSheet({ bytes, type = '', name = '' }) {
  const isDocx = /wordprocessingml/.test(type) || /\.docx$/i.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  if (isDocx) {
    const tmp = path.join(os.tmpdir(), `sheet_${Date.now()}_${Math.random().toString(36).slice(2)}.docx`);
    fs.writeFileSync(tmp, bytes);
    try {
      const r = spawnSync('python3', [path.join(__dirname, 'officeSheetReader.py'), tmp], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
      if (r.status !== 0) throw new Error('This Word file could not be opened. Save it again as .docx and upload, or upload a PDF / photo of the sheet.');
      const { rows } = JSON.parse(r.stdout.toString('utf8'));
      if (!rows || !rows.some((row) => row[0] && /DEED NO|SURVEY NO|DOOR NO/i.test(row[0].text))) {
        throw new Error('This is not the GOURU VALUATION – OFFICE sheet. Please upload the filled office sheet.');
      }
      const fields = clean(fromWordRows(rows));
      return { fields, source: 'word', filled: filledCount(fields) };
    } finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
  }
  if (/\.(doc|odt|rtf)$/i.test(name)) throw new Error('Please save the sheet as .docx (Word) or upload a PDF / photo of it.');
  const mime = /pdf/.test(type) || bytes.slice(0, 4).toString() === '%PDF' ? 'application/pdf' : (type.startsWith('image/') ? type : 'image/jpeg');
  const { askJson } = require('./aiJson');
  const ai = await askJson(PROMPT, [`data:${mime};base64,${bytes.toString('base64')}`], { timeoutMs: 90000 });
  if (!ai) throw new Error('Mahe AI could not read the sheet right now. Type the details below, or try again in a minute.');
  const fields = clean(ai);
  return { fields, source: 'ai', filled: filledCount(fields) };
}

module.exports = { readOfficeSheet, fromWordRows, FIELDS, classify, amount, deedNumber, splitRelation };
