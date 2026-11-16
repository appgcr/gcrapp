// Where a valuation sits on the map, and its address as per the sale deed.
//
//  • Address: built from the sale-deed details (door / plot / survey no, village, mandal, district),
//    falling back to the address typed when the case was created.
//  • Spot:    the site GPS saved when the engineer was at the property; otherwise the deed
//    address looked up on OpenStreetMap (most precise part first). The result is remembered
//    on the case (case.geo) so each address is looked up only once.

const ValuationCase = require('../models/ValuationCase');

const STATE = 'Andhra Pradesh';
const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

function deedAddress(c) {
  const pd = c.propertyDetails || {};
  const rep = pd.report || {};
  const village = clean(pd.village || rep.village);
  const mandal = clean(pd.mandal || rep.mandal);
  const district = clean(pd.district || rep.district || c.bankDistrict);
  const parts = [
    pd.doorNo && `D.No. ${clean(pd.doorNo)}`,
    pd.plotNo && `Plot No. ${clean(pd.plotNo)}`,
    pd.surveyNo && `Sy. No. ${clean(pd.surveyNo)}`,
    clean(rep.landmark),
    village,
    mandal && mandal.toLowerCase() !== village.toLowerCase() ? `${mandal} Mandal` : '',
    district,
  ].filter(Boolean);
  const looksLikeAddress = (v) => typeof v === 'string' && v.trim() && !v.trim().startsWith('{') && !/^lat|location unavailable|fetching location/i.test(v.trim());
  const typed = clean(c.address) || (looksLikeAddress(c.locationData) ? clean(c.locationData) : '');
  // Deed details are the official address; when only numbers are known, add the typed address for the place
  const placeKnown = village || mandal || district;
  let segs = parts;
  if (!(parts.length && placeKnown) && typed) {
    // Add the typed address for the place, without repeating what the deed already gave (e.g. the door no)
    const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
    const have = new Set(parts.map(norm));
    const doorKnown = !!pd.doorNo;
    segs = parts.concat(typed.split(',').map(clean).filter((t) => t && !have.has(norm(t)) && !(doorKnown && /^(d\.?\s*no|door|h\.?\s*no)/i.test(t))));
  }
  const text = segs.join(', ');
  return { text, village, mandal, district, typed };
}

function siteGps(c) {
  try {
    const j = typeof c.locationData === 'string' && c.locationData.trim().startsWith('{') ? JSON.parse(c.locationData) : null;
    if (j && Number.isFinite(+j.lat) && Number.isFinite(+j.lng) && !(+j.lat === 0 && +j.lng === 0)) return { lat: +j.lat, lng: +j.lng };
  } catch { /* not GPS */ }
  // Site photos save it as text: "Lat: 14.466031, Long: 78.825028"
  const t = /lat[a-z]*\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*,\s*l(?:o)?ng[a-z]*\s*[:=]\s*(-?\d+(?:\.\d+)?)/i.exec(String(c.locationData || ''));
  if (t && Math.abs(+t[1]) <= 90 && Math.abs(+t[2]) <= 180 && !(+t[1] === 0 && +t[2] === 0)) return { lat: +t[1], lng: +t[2] };
  const cur = c.currentLocation;
  if (cur && Number.isFinite(cur.lat) && Number.isFinite(cur.lng)) return { lat: cur.lat, lng: cur.lng };
  return null;
}

// OpenStreetMap lookup: at most one request a second (their rule), results cached in memory too
const memo = new Map();
let nextSlot = 0;
async function lookup(q) {
  const key = q.toLowerCase();
  if (memo.has(key)) return memo.get(key);
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  let hit = null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'GouruValuations/1.0 (valuation map)' }, signal: AbortSignal.timeout(10000) });
    const d = r.ok ? await r.json() : [];
    if (Array.isArray(d) && d[0]) hit = { lat: +d[0].lat, lng: +d[0].lon };
  } catch { /* offline: try again next time */ return undefined; }
  memo.set(key, hit);
  return hit;
}

/** Find the deed address on the map: most precise part first. → { lat, lng, precision, query } or null */
async function geocodeDeed(addr) {
  const tries = [];
  const typedParts = addr.typed.split(',').map(clean).filter((x) => x && !/^(d\.?\s*no|door|plot|h\.?\s*no|sy)/i.test(x));
  const firstPlace = typedParts[0];
  // The town: the deed's district, else the last part of the typed address ("…, NGO Colony, Kadapa")
  const typedTown = typedParts.length > 1 ? typedParts[typedParts.length - 1] : '';
  const town = addr.district || typedTown || addr.mandal || '';
  if (firstPlace && town && firstPlace !== town) tries.push([`${firstPlace}, ${town}, ${STATE}`, 'street']);
  if (addr.village) tries.push([[addr.village, addr.mandal, addr.district || typedTown, STATE].filter(Boolean).join(', '), 'village']);
  if (addr.mandal) tries.push([[addr.mandal, addr.district || typedTown, STATE].filter(Boolean).join(', '), 'mandal']);
  if (town) tries.push([`${town}, ${STATE}`, 'town']);
  // A bare place name can match the same colony name in another town: only when no town is known
  if (firstPlace && !town) tries.push([`${firstPlace}, ${STATE}`, 'area']);
  for (const [q, precision] of tries) {
    const hit = await lookup(q);
    if (hit === undefined) return undefined; // lookup service unreachable
    if (hit) return { ...hit, precision, query: q };
  }
  return null;
}

/**
 * Map entry for a finished case. Looks the address up when needed (and allowed) and stores it.
 * → { lat, lng, precision: 'site' | 'street' | 'village' | 'area' | 'mandal' | 'town', address } or { address } when unknown
 */
async function locateCase(c, { allowLookup = true } = {}) {
  const addr = deedAddress(c);
  const gps = siteGps(c);
  if (gps) return { ...gps, precision: 'site', address: addr.text };
  const g = c.geo;
  if (g && g.v === 2 && g.query && Number.isFinite(g.lat) && g.forAddress === addr.text) return { lat: g.lat, lng: g.lng, precision: g.precision, address: addr.text };
  // Looked up before and not found: try again only after a week (or when the address changes)
  if (g && g.v === 2 && !g.query && g.forAddress === addr.text && Date.now() - new Date(g.at).getTime() < 7 * 86400000) return { address: addr.text };
  if (!allowLookup || !addr.text) return { address: addr.text };
  const found = await geocodeDeed(addr);
  if (found === undefined) return { address: addr.text, looked: true };
  await ValuationCase.updateOne({ id: c.id }, { $set: { geo: found ? { ...found, v: 2, forAddress: addr.text, at: new Date() } : { query: '', v: 2, forAddress: addr.text, at: new Date() } } });
  return found ? { lat: found.lat, lng: found.lng, precision: found.precision, address: addr.text, looked: true } : { address: addr.text, looked: true };
}

module.exports = { deedAddress, siteGps, locateCase };
