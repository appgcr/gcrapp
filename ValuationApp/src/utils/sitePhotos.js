// Site photos for Step 4: real GPS + time stamped onto the picture, at most 10 photos, no duplicates.
import { API_BASE_URL } from '../config/api';

export const MAX_SITE_PHOTOS = 10;

/** Current position, fresh (no cached fix older than 30 s). Rejects when location is off. */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device has no GPS / location service.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, time: new Date(p.timestamp || Date.now()) }),
      () => reject(new Error('Location is off. Turn on GPS / location permission to take site photos.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

/** Address for the coordinates (server looks it up; empty when offline). */
export async function addressFor(lat, lng) {
  try {
    const r = await fetch(`${API_BASE_URL}/api/geo/reverse?lat=${lat}&lng=${lng}`);
    if (!r.ok) return '';
    const d = await r.json();
    return d.address || '';
  } catch { return ''; }
}

const fmtTime = (d) => d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

/** Draw the stamp (bottom strip) onto a canvas that already holds the photo. */
export function drawStamp(canvas, { lat, lng, accuracy, time, address, caseLabel, engineer }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const s = Math.max(1, W / 900);
  const lines = [
    `Lat ${lat.toFixed(6)}°  Long ${lng.toFixed(6)}°${accuracy ? `  (±${Math.round(accuracy)} m)` : ''}`,
    fmtTime(time),
    ...(address ? wrap(ctx, address, W - 40 * s, 15 * s) : []),
    [caseLabel, engineer && `Engineer: ${engineer}`].filter(Boolean).join('  •  '),
  ].filter(Boolean);
  const lh = 22 * s;
  const h = lines.length * lh + 22 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, canvas.height - h, W, h);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  lines.forEach((t, i) => {
    ctx.font = `${i === 0 ? '700 ' : ''}${Math.round(15 * s)}px sans-serif`;
    ctx.fillText(t, 16 * s, canvas.height - h + 11 * s + i * lh);
  });
}

function wrap(ctx, text, maxW, size) {
  ctx.font = `${Math.round(size)}px sans-serif`;
  const words = String(text).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}

/** SHA-256 of the file bytes (same photo renamed is still a duplicate). */
export async function fileHash(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** GPS position and capture time stored inside a JPEG by the phone camera (EXIF). Null when missing. */
export function readExifGps(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const size = v.getUint16(off + 2);
    if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
    if ((marker & 0xFF00) !== 0xFF00) break;
    off += 2 + size;
  }
  return null;
}

function parseTiff(v, start) {
  const le = v.getUint16(start) === 0x4949;
  const u16 = o => v.getUint16(start + o, le);
  const u32 = o => v.getUint32(start + o, le);
  const ifd = (o) => {
    const n = u16(o);
    const tags = {};
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 };
    }
    return tags;
  };
  const rational = (o, k) => u32(o + k * 8) / (u32(o + k * 8 + 4) || 1);
  const ascii = (t) => {
    const o = t.count > 4 ? u32(t.valueOff) : t.valueOff;
    let s = '';
    for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(start + o + i));
    return s;
  };
  try {
    const ifd0 = ifd(u32(4));
    let time = null;
    if (ifd0[0x8769]) {
      const ex = ifd(u32(ifd0[0x8769].valueOff));
      const t = ex[0x9003] || ex[0x9004];
      if (t) time = ascii(t);
    }
    if (!time && ifd0[0x0132]) time = ascii(ifd0[0x0132]);
    if (!ifd0[0x8825]) return null;
    const g = ifd(u32(ifd0[0x8825].valueOff));
    if (!g[2] || !g[4]) return null;
    const dms = (t) => { const o = u32(t.valueOff); return rational(o, 0) + rational(o, 1) / 60 + rational(o, 2) / 3600; };
    let lat = dms(g[2]);
    let lng = dms(g[4]);
    if (g[1] && String.fromCharCode(v.getUint8(start + g[1].valueOff)) === 'S') lat = -lat;
    if (g[3] && String.fromCharCode(v.getUint8(start + g[3].valueOff)) === 'W') lng = -lng;
    if (!lat && !lng) return null;
    let when = null;
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(time || '');
    if (m) when = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return { lat, lng, time: when };
  } catch { return null; }
}

/** Load an image file/URL into a canvas (max 2000 px wide). */
export function imageToCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2000 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error('This file is not a readable photo.'));
    img.src = src;
  });
}
