// AI helpers for the engineer at the site: speak the details, sort the photos.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { askJson, aiOn } = require('../services/aiJson');

router.use(authenticateToken);
// Field tools: engineers and admins only (not bank logins)
router.use((req, res, next) => (['ENGINEER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role) ? next() : res.status(403).json({ error: 'Not available for this login.' })));

const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length < 60).slice(0, 30) : []);

// POST /api/assist/voice-fields { audio: dataUrl, propertyType, options: { plotTypes, roadTypes, structureTypes, flooringTypes } }
router.post('/voice-fields', async (req, res) => {
  try {
    const { audio, propertyType = '', options = {} } = req.body || {};
    if (!/^data:audio\/[a-z0-9.+-]+;base64,/i.test(String(audio || ''))) return res.status(400).json({ error: 'No recording received.' });
    if (String(audio).length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Recording is too long. Keep it under 2 minutes.' });
    if (!aiOn()) return res.status(503).json({ error: 'Voice fill needs Gouru AI, which is switched off on this server.' });
    const o = {
      plotType: list(options.plotTypes), roadType: list(options.roadTypes),
      structureType: list(options.structureTypes), flooringType: list(options.flooringTypes),
    };
    const prompt = `A property valuation engineer in Andhra Pradesh is at the site and speaks the site details (English, Telugu or a mix).
Property type: ${propertyType || 'unknown'}.
Listen and fill ONLY what was clearly said. Leave everything else null. Do not guess.
Choose list values exactly as written in these lists (closest match), or null:
plotType: ${JSON.stringify(o.plotType)}
roadType: ${JSON.stringify(o.roadType)}
structureType: ${JSON.stringify(o.structureType)}
flooringType: ${JSON.stringify(o.flooringType)}
Numbers as plain digits (e.g. "30 feet road" → roadWidth "30 ft"; "pannendu samvatsaralu" → buildingAge "12").
Boundaries are what lies on each side (e.g. "north side road" → north "Road").
Measurements are side lengths in the unit spoken; give dimensionUnit "Feet", "Metres" or "Links".
Land rate: "per cent" → marketRatePerCent, "per square yard / gajam" → landRatePerSqyd, "per acre" → ratePerAcre (rupees as digits; 1 lakh = 100000).
Reply with ONLY this JSON:
{"transcript": "what was said, in English", "fields": {
 "roadWidth": null, "plotType": null, "roadType": null, "structureType": null, "flooringType": null, "buildingAge": null,
 "boundariesActual": {"north": null, "south": null, "east": null, "west": null},
 "dimensionUnit": null, "dimensionsActual": {"north": null, "south": null, "east": null, "west": null},
 "plinthArea": null, "floors": [{"floor": "Ground Floor", "area": null}],
 "marketRatePerCent": null, "landRatePerSqyd": null, "ratePerAcre": null
}}`;
    const out = await askJson(prompt, [audio], { timeoutMs: 70000 });
    if (!out) return res.status(503).json({ error: 'Gouru AI is busy. Please try again in a minute or type the details.' });
    const okList = (k, v) => (v && o[k].includes(v) ? v : null);
    const f = out.fields || {};
    const clean = {
      roadWidth: f.roadWidth || null,
      plotType: okList('plotType', f.plotType), roadType: okList('roadType', f.roadType),
      structureType: okList('structureType', f.structureType), flooringType: okList('flooringType', f.flooringType),
      buildingAge: f.buildingAge != null && /\d/.test(String(f.buildingAge)) ? String(f.buildingAge).replace(/[^\d.]/g, '') : null,
      boundariesActual: f.boundariesActual || {}, dimensionUnit: ['Feet', 'Metres', 'Links'].includes(f.dimensionUnit) ? f.dimensionUnit : null,
      dimensionsActual: f.dimensionsActual || {},
      plinthArea: f.plinthArea != null && /\d/.test(String(f.plinthArea)) ? String(f.plinthArea).replace(/[^\d.]/g, '') : null,
      floors: Array.isArray(f.floors) ? f.floors.filter((x) => x && x.area && /\d/.test(String(x.area))) : [],
      marketRatePerCent: f.marketRatePerCent, landRatePerSqyd: f.landRatePerSqyd, ratePerAcre: f.ratePerAcre,
    };
    res.json({ transcript: String(out.transcript || '').slice(0, 2000), fields: clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assist/voice-sheet { audio: dataUrl } — the engineer speaks the office-sheet details
// ("owner name Mahesh, S/o Maheer, deed no 123/2025, survey no 114 …") → the sheet's own fields.
// Only what was said comes back; values go through the same clean-up as a read paper sheet.
router.post('/voice-sheet', async (req, res) => {
  try {
    const { audio } = req.body || {};
    if (!/^data:audio\/[a-z0-9.+-]+;base64,/i.test(String(audio || ''))) return res.status(400).json({ error: 'No recording received.' });
    if (String(audio).length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Recording is too long. Keep it under 2 minutes.' });
    if (!aiOn()) return res.status(503).json({ error: 'Voice fill needs Gouru AI, which is switched off on this server.' });
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    const today = `${String(ist.getUTCDate()).padStart(2, '0')}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${ist.getUTCFullYear()}`;
    const prompt = `A property valuation engineer in Andhra Pradesh, India speaks the details of the "GOURU VALUATION - OFFICE" data sheet
(English, Telugu or a mix; Telugu names are common). Today is ${today} (DD-MM-YYYY).
Listen carefully and fill ONLY what was clearly said. Use "" for anything not said. Never guess or invent.
Rules:
- Names: write them properly capitalised, spelled the usual Indian / Telugu way (e.g. "chanikya reddy" → "Chanikya Reddy").
- "S/o", "son of", "W/o", "wife of", "D/o", "daughter of", "C/o" → ownerRelation (or applicantRelation for the buyer) as "S/o Maheer", "W/o …", "D/o …".
- Dates as DD-MM-YYYY. "today" = ${today}, "yesterday" = the day before. Two-digit years mean 20YY (e.g. 23-04-24 → 23-04-2024). Spoken months ("23rd April 2024") → 23-04-2024.
- Deed / document numbers exactly as spoken with the slash: "123 by 2025", "123 slash 2025" → "123/2025". Survey, door, plot and ward numbers the same way ("2 by 240 dash 45" → "2/240-45").
- Money in rupees as digits; "lakh" = 100000, "crore" = 10000000 (e.g. "14 lakhs 25 thousand per cent" → marketRatePerCent "1425000").
- "extent …" / "site extent" / "document extent" → extentDocument. Use extentPlan / netExtentPlan only when "plan" is said with it.
- "address …" said with the owner (or "owner address") → ownerAddress only. Put a number in doorNo, plotNo, surveyNo or wardNo ONLY when those words were said ("door number …", "plot number …", "survey number …", "ward …"); never copy the owner's address into them. "property address" / "site address" → address.
- "engineer …" / "inspected by …" → engineerNames (all names, comma separated). "inspection date …" → inspectionDate.
- dealType "Purchase" only when a buyer / applicant is mentioned or "purchase" is said; "Mortgage" when said; else "".
- Boundaries are what lies on each side ("east road, west house of Ramaiah"); measurements are side lengths with their unit ("east 40 feet").
- propertyType one of "Independent House","Open Site","Apartment","Open Agriculture Land","Industrial Unit"; structureType one of "RCC Framed structure","Load bearing","PEB structure";
  roadType one of "CC Road","BT Road","Metal Road"; flooringType one of "Tiles","Granite","Marble","Kadapa slab","Betham cherla" — or "".
Reply with ONLY this JSON:
{"transcript": "what was said, written in English letters",
 "dealType": "", "ownerName": "", "ownerRelation": "", "ownerAddress": "", "applicantName": "", "applicantRelation": "", "applicantAddress": "",
 "bank": "", "engineerNames": "", "inspectionDate": "", "deedNo": "", "deedDate": "", "surveyNo": "", "doorNo": "", "wardNo": "", "plotNo": "", "address": "",
 "extentDocument": "", "extentPlan": "", "measurements": {"east": "", "west": "", "north": "", "south": ""}, "boundaries": {"east": "", "west": "", "north": "", "south": ""},
 "netExtentPlan": "", "roadAffectedArea": "", "baNumber": "", "baDate": "", "floorsArea": "", "guidelineRate": "", "assessmentNo": "", "taxAmount": "", "taxName": "",
 "propertyType": "", "structureType": "", "buildingAge": "", "marketRatePerCent": "", "constructionRate": "", "roadWidth": "", "roadType": "", "flooringType": "",
 "comments": "", "extras": ""}`;
    const out = await askJson(prompt, [audio], { timeoutMs: 70000 });
    if (!out) return res.status(503).json({ error: 'Gouru AI is busy. Please try again in a minute or type the details.' });
    const { cleanSheet } = require('../services/officeSheet');
    const c = cleanSheet(out);
    // Only the fields that were actually said
    const fields = {};
    for (const [k, v] of Object.entries(c)) {
      if (k === 'corrections') continue;
      if (k === 'measurements' || k === 'boundaries') {
        const sides = Object.fromEntries(Object.entries(v || {}).filter(([, x]) => String(x || '').trim()));
        if (Object.keys(sides).length) fields[k] = sides;
      } else if (String(v || '').trim()) fields[k] = String(v).trim();
    }
    res.json({ transcript: String(out.transcript || '').slice(0, 2000), fields, corrections: (c.corrections || []).slice(0, 12) });
  } catch (err) {
    console.error('POST /api/assist/voice-sheet', err);
    res.status(500).json({ error: 'Could not read the recording. Please try again.' });
  }
});

// POST /api/assist/case-start { files: [{ url, name, kind: 'officeSheet' | 'saleDeed' | 'propertyTax' | … }] }
// Documents picked when a case is started → the customer's details for the New Case form:
// { clientName, fatherName, mobile, bankName, bankBranch, address, sheet (office-sheet fields) | null, from }.
// Office sheet first (it has everything); otherwise the sale deed / tax receipt is read by Gouru AI.
router.post('/case-start', async (req, res) => {
  try {
    const list = Array.isArray(req.body?.files) ? req.body.files.slice(0, 12) : [];
    if (!list.length) return res.status(400).json({ error: 'No documents received.' });
    const { bytesOf } = require('../services/annexure');
    const out = { clientName: '', fatherName: '', mobile: '', bankName: '', bankBranch: '', address: '', sheet: null, from: '' };

    const sheetItems = list.filter((f) => f && f.kind === 'officeSheet');
    if (sheetItems.length) {
      const files = [];
      for (const it of sheetItems) {
        const got = await bytesOf(String(it.url || ''));
        if (got && got.bytes.length) files.push({ bytes: got.bytes, type: got.type || '', name: String(it.name || got.name || '') });
      }
      if (files.length) {
        try {
          const { readOfficeSheetFiles } = require('../services/officeSheet');
          const r = await readOfficeSheetFiles(files);
          const s = r.fields || {};
          const purchase = s.dealType === 'Purchase';
          out.sheet = s;
          out.clientName = (purchase ? s.applicantName : s.ownerName) || s.ownerName || '';
          out.fatherName = (purchase ? s.applicantRelation : s.ownerRelation) || '';
          out.address = s.address || (purchase ? s.applicantAddress : s.ownerAddress) || '';
          const bank = String(s.bank || '');
          // "INDIAN BANK, RAJIV PARK BRANCH" → bank + branch
          const m = /^(.*?)(?:[,\-–]\s*|\s+)([^,]*?\bbranch\b.*)$/i.exec(bank);
          out.bankName = (m ? m[1] : bank).trim();
          out.bankBranch = m ? m[2].replace(/\bbranch\b/i, '').trim() : '';
          out.from = 'sheet';
        } catch (err) {
          if (!list.some((f) => f.kind !== 'officeSheet')) return res.status(422).json({ error: err.message || 'The office sheet could not be read.' });
        }
      }
    }

    // No office sheet (or it had no name): read the sale deed / tax receipt
    if (!out.clientName && aiOn()) {
      const doc = list.find((f) => f && f.kind === 'saleDeed') || list.find((f) => f && f.kind === 'propertyTax') || list.find((f) => f && f.kind !== 'officeSheet');
      const got = doc ? await bytesOf(String(doc.url || '')) : null;
      const type = got ? (got.type || (/\.pdf$/i.test(doc.name || '') ? 'application/pdf' : '')) : '';
      if (got && got.bytes.length && /pdf|image\//i.test(type) && got.bytes.length < 18 * 1024 * 1024) {
        const prompt = `This is an Indian property document (sale deed, gift / settlement deed or property tax receipt; English and/or Telugu).
Find the person the property now belongs to: in a sale deed the PURCHASER / vendee (not the seller), in a tax receipt the assessee.
Reply with ONLY this JSON (use "" when not written; names in English letters, properly capitalised):
{"clientName": "", "relation": "S/o, W/o or D/o with the name, e.g. S/o Venkata Ramana", "mobile": "10-digit mobile if written", "propertyAddress": "door no / survey no, street, village / town, district"}`;
        // The owner's name and address are on the first pages: send only those (big scans otherwise time out)
        let bytes = got.bytes;
        if (/pdf/i.test(type)) {
          try {
            const { PDFDocument } = require('pdf-lib');
            const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
            if (src.getPageCount() > 3) {
              const dst = await PDFDocument.create();
              const pages = await dst.copyPages(src, [0, 1, 2]);
              pages.forEach((pg) => dst.addPage(pg));
              bytes = Buffer.from(await dst.save());
            }
          } catch { /* use the whole file */ }
        }
        const r = await askJson(prompt, [`data:${type};base64,${bytes.toString('base64')}`], { timeoutMs: 45000 });
        if (r) {
          out.clientName = String(r.clientName || '').trim();
          out.fatherName = out.fatherName || String(r.relation || '').trim();
          const mob = String(r.mobile || '').replace(/\D/g, '').slice(-10);
          out.mobile = /^[6-9]\d{9}$/.test(mob) ? mob : '';
          out.address = out.address || String(r.propertyAddress || '').trim();
          out.from = out.from || 'deed';
        }
      }
    }
    res.json(out);
  } catch (err) {
    console.error('POST /api/assist/case-start', err);
    res.status(500).json({ error: 'Could not read the documents. Please fill the details.' });
  }
});

// Photo kinds a bank expects for a valuation
const KINDS = {
  front: 'Front view', road: 'Approach road', side: 'Side / rear view', inside: 'Inside (hall / rooms)',
  kitchen: 'Kitchen', surroundings: 'Surroundings', boundary: 'Boundary / compound', meter: 'Electricity meter / door no.',
  open_land: 'Open land / plot', other: 'Other',
};
const NEEDED = {
  built: ['front', 'road', 'inside', 'surroundings'],
  land: ['open_land', 'road', 'boundary', 'surroundings'],
  flat: ['front', 'inside', 'kitchen', 'road'],
};

// POST /api/assist/photo-labels { images: [dataUrl (small)], propertyType }
router.post('/photo-labels', async (req, res) => {
  try {
    const { images = [], propertyType = '' } = req.body || {};
    const imgs = (Array.isArray(images) ? images : []).slice(0, 12);
    if (!imgs.length) return res.json({ labels: [], missing: [] });
    if (imgs.some((u) => !/^data:image\/(jpeg|png|webp);base64,/i.test(String(u)) || String(u).length > 1.5 * 1024 * 1024)) {
      return res.status(400).json({ error: 'Send small JPEG / PNG photos.' });
    }
    const t = String(propertyType).toLowerCase();
    const kind = /apart|flat/.test(t) ? 'flat' : /site|plot|land|agri/.test(t) ? 'land' : 'built';
    let labels = null;
    if (aiOn()) {
      const prompt = `These are ${imgs.length} site photos (in order) from a property valuation in India (${propertyType || 'property'}).
For each photo pick ONE kind from: ${Object.keys(KINDS).join(', ')}.
"front" = the building's front elevation; "road" = the approach road / street; "inside" = rooms / hall; "surroundings" = nearby buildings / area;
"boundary" = compound wall / fencing / boundary stones; "meter" = electricity meter or door number plate; "open_land" = vacant plot / field.
Reply with ONLY: {"photos": [{"index": 0, "kind": "front", "note": "3 words max"}]}`;
      const out = await askJson(prompt, imgs, { timeoutMs: 45000 });
      if (out && Array.isArray(out.photos)) {
        labels = imgs.map((_, i) => {
          const p = out.photos.find((x) => Number(x.index) === i) || {};
          const k = KINDS[p.kind] ? p.kind : 'other';
          return { kind: k, label: KINDS[k], note: String(p.note || '').slice(0, 40) };
        });
      }
    }
    if (!labels) return res.status(503).json({ error: 'Gouru AI is busy. Photo check skipped.' });
    const have = new Set(labels.map((l) => l.kind));
    const missing = NEEDED[kind].filter((k) => !have.has(k)).map((k) => ({ kind: k, label: KINDS[k] }));
    res.json({ labels, missing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assist/speak { text, voice: 'male' | 'female' } — Gouru AI's natural voice (WAV)
router.post('/speak', async (req, res) => {
  try {
    const { speak, VOICES } = require('../services/voice');
    const text = String(req.body?.text || '').slice(0, 900);
    if (!text.trim()) return res.status(400).json({ error: 'Nothing to say.' });
    const wav = await speak(text, { voice: VOICES[req.body?.voice] || undefined });
    if (!wav) return res.status(503).json({ error: 'Voice not available right now.' });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(wav);
  } catch (err) {
    res.status(500).json({ error: 'Voice not available right now.' });
  }
});

module.exports = router;
