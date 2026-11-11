const express = require('express');
const router = express.Router();
// Logged-in users only (this costs AI quota / looks up locations)
router.use(require('../middleware/auth').authenticateToken);

// Helper: Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// POST /api/location/resolve
// Accepts optional { lat, lng } from device GPS
// If provided, reverse-geocodes to exact street address via OpenStreetMap Nominatim
// If omitted or invalid, resolves real coordinates from client IP (e.g. Airtel/Jio network in India)
router.post('/resolve', async (req, res) => {
  try {
    let { lat, lng } = req.body || {};
    let source = 'gps';

    // 1. If no valid GPS coordinates provided by device, resolve via public IP
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      source = 'network_ip';
      // Extract client IP
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
      const isLocal = !rawIp || rawIp.includes('127.0.0.1') || rawIp.includes('::1') || rawIp.startsWith('192.168.') || rawIp.startsWith('10.');

      try {
        const ipUrl = isLocal ? 'http://ip-api.com/json/' : `http://ip-api.com/json/${rawIp}`;
        const ipRes = await fetchWithTimeout(ipUrl, {}, 5000);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.status === 'success' && ipData.lat && ipData.lon) {
            lat = ipData.lat;
            lng = ipData.lon;
          }
        }
      } catch (ipErr) {
        console.warn('IP location fetch failed:', ipErr.message);
      }
    }

    // Default safety fallback coordinates (if completely offline)
    if (!lat || !lng) {
      lat = 17.3850;
      lng = 78.4867;
      source = 'default';
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    // 2. High-precision Reverse Geocoding via OpenStreetMap Nominatim
    let fullAddress = '';
    let title = '';
    let subtitle = '';
    let road = '';
    let city = '';
    let state = '';
    let postcode = '';
    let country = 'India';

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`;
      const nomRes = await fetchWithTimeout(nominatimUrl, {
        headers: { 'User-Agent': 'GCRValuationEnterpriseApp/1.0 (valuation.internal@gcr.com)' }
      }, 5000);

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const addr = nomData.address || {};
        road = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
        city = addr.city || addr.town || addr.village || addr.county || addr.state_district || 'Local Area';
        state = addr.state || 'Telangana';
        country = addr.country || 'India';
        postcode = addr.postcode || '';

        title = `${city}, ${state}`;
        subtitle = `${country} 🇮🇳`;
        fullAddress = nomData.display_name || `${road ? road + ', ' : ''}${city}, ${state} ${postcode}, ${country}`;
      }
    } catch (nomErr) {
      console.warn('Nominatim reverse geocode failed, using structured coordinates:', nomErr.message);
    }

    if (!fullAddress) {
      // Address lookup unavailable: show what we know, plainly
      title = city ? `${city}${state ? `, ${state}` : ''}` : 'Current location';
      subtitle = country || 'India';
      const parts = [road, city, state, postcode].filter(Boolean);
      fullAddress = parts.length ? `${parts.join(', ')}, ${country}` : 'Address not available right now — your position is saved.';
    }

    return res.json({
      success: true,
      lat: numLat,
      lng: numLng,
      accuracy: source === 'gps' ? 10 : 35,
      source,
      title,
      subtitle,
      road,
      city,
      state,
      postcode,
      country,
      fullAddress
    });
  } catch (err) {
    console.error('Location resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve location: ' + err.message });
  }
});

// GET /api/location/current
router.get('/current', async (req, res) => {
  // Delegate to resolve handler
  req.body = {};
  router.handle(req, res);
});

module.exports = router;
