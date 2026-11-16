// AI helpers for the engineer at the site: speak the details, sort the photos.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { askJson, aiOn } = require('../services/aiJson');

router.use(authenticateToken);

const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length < 60).slice(0, 30) : []);

// POST /api/assist/voice-fields { audio: dataUrl, propertyType, options: { plotTypes, roadTypes, structureTypes, flooringTypes } }
router.post('/voice-fields', async (req, res) => {
  try {
    const { audio, propertyType = '', options = {} } = req.body || {};
    if (!/^data:audio\/[a-z0-9.+-]+;base64,/i.test(String(audio || ''))) return res.status(400).json({ error: 'No recording received.' });
    if (String(audio).length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Recording is too long. Keep it under 2 minutes.' });
    if (!aiOn()) return res.status(503).json({ error: 'Voice fill needs Mahe AI, which is switched off on this server.' });
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
    if (!out) return res.status(503).json({ error: 'Mahe AI is busy. Please try again in a minute or type the details.' });
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
    if (!labels) return res.status(503).json({ error: 'Mahe AI is busy. Photo check skipped.' });
    const have = new Set(labels.map((l) => l.kind));
    const missing = NEEDED[kind].filter((k) => !have.has(k)).map((k) => ({ kind: k, label: KINDS[k] }));
    res.json({ labels, missing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
