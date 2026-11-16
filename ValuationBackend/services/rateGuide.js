// Land rates of approved valuations near a property — a guide for the engineer's market rate.
// Only the rate, distance, area and date are shared (no customer names).

const ValuationCase = require('../models/ValuationCase');
const { locateCase, siteGps, deedAddress } = require('./caseLocation');

const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };

function km(a, b) {
  const R = 6371; const r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const isFarm = (t = '') => /agri/i.test(t);
const isFlat = (t = '') => /apart|flat/i.test(t);

/** Land rate per Sq.yd of a finished case (0 when unknown) */
function landRateOf(c) {
  const pd = c.propertyDetails || {}; const rep = pd.report || {};
  return num(c.valuation && c.valuation.landRate)
    || num(rep.landRatePerSqyd)
    || (num(rep.marketRatePerCent) ? num(rep.marketRatePerCent) / 48.4 : 0)
    || (num(rep.ratePerAcre) ? num(rep.ratePerAcre) / 4840 : 0);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * → { count, radiusKm, medianPerSqyd, minPerSqyd, maxPerSqyd, basis: 'distance' | 'village', items: [...] }
 */
async function nearbyRates({ at, village = '', propertyType = '', excludeId = '', branchId = null }) {
  const q = { status: { $in: ['Approved', 'Completed'] } };
  if (branchId) q.branchId = branchId;
  const rows = await ValuationCase.find(q)
    .select('id fileNumber status approvedAt updatedAt locationData address geo currentLocation propertyDetails valuation.landRate bankDistrict')
    .lean();
  const farm = isFarm(propertyType);
  const pool = [];
  for (const r of rows) {
    if (r.id === excludeId) continue;
    const t = (r.propertyDetails || {}).propertyType || '';
    if (isFarm(t) !== farm || isFlat(t)) continue; // farm land with farm land; flats carry a land share only
    const rate = landRateOf(r);
    if (!rate) continue;
    const loc = await locateCase(r, { allowLookup: false });
    const addr = deedAddress(r);
    pool.push({
      fileNumber: r.fileNumber || `#${r.id}`, date: r.approvedAt || r.updatedAt, area: addr.village || addr.mandal || '',
      propertyType: t, ratePerSqyd: Math.round(rate),
      lat: loc.lat, lng: loc.lng, precision: loc.precision || null,
    });
  }
  let items = []; let basis = 'distance'; let radiusKm = 0;
  if (at && Number.isFinite(at.lat)) {
    const placed = pool.filter((p) => Number.isFinite(p.lat)).map((p) => ({ ...p, distanceKm: Math.round(km(at, p) * 10) / 10 }));
    for (const r of [1, 2, 3, 5]) {
      radiusKm = r;
      items = placed.filter((p) => p.distanceKm <= r);
      if (items.length >= 3) break;
    }
  }
  if (!items.length && village) {
    basis = 'village';
    const v = village.toLowerCase().trim();
    items = pool.filter((p) => p.area && p.area.toLowerCase().trim() === v);
  }
  items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  const rates = items.map((i) => i.ratePerSqyd);
  return {
    count: items.length, radiusKm: basis === 'distance' ? radiusKm : null, basis,
    medianPerSqyd: rates.length ? Math.round(median(rates)) : 0,
    minPerSqyd: rates.length ? Math.min(...rates) : 0,
    maxPerSqyd: rates.length ? Math.max(...rates) : 0,
    items: items.slice(0, 8).map(({ lat, lng, ...rest }) => rest),
  };
}

/** Where the case is: the phone's GPS when sent, else the site GPS / deed address */
async function caseSpot(c, gps) {
  if (gps && Number.isFinite(+gps.lat) && Number.isFinite(+gps.lng)) return { lat: +gps.lat, lng: +gps.lng };
  if (!c) return null;
  const s = siteGps(c);
  if (s) return s;
  const loc = await locateCase(c, { allowLookup: true });
  return Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng } : null;
}

module.exports = { nearbyRates, caseSpot, landRateOf, km };
