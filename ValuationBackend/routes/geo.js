// Address for GPS coordinates (site photo stamps). OpenStreetMap Nominatim, cached; empty when unreachable.
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const cache = new Map();
let last = 0;

router.get('/reverse', authenticateToken, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Invalid coordinates.' });
  }
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;          // ~10 m
  if (cache.has(key)) return res.json({ address: cache.get(key) });
  try {
    const wait = Math.max(0, 1100 - (Date.now() - last));       // Nominatim: max 1 request / second
    if (wait) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'GCR-Valuation-App/1.0', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    const d = r.ok ? await r.json() : {};
    const a = d.address || {};
    const parts = [a.house_number, a.road, a.neighbourhood || a.suburb, a.village || a.town || a.city, a.state_district || a.county, a.state, a.postcode]
      .filter(Boolean);
    const address = [...new Set(parts)].join(', ');
    if (cache.size > 5000) cache.clear();
    cache.set(key, address);
    res.json({ address });
  } catch {
    res.json({ address: '' });
  }
});

module.exports = router;
