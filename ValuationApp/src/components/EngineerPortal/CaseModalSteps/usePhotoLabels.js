import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../config/api';

// Small copy of a photo for the AI (512 px, JPEG)
function shrink(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Mahe AI names each site photo (front, road, inside…) and lists the key photos still missing.
 * → { labels: { [imageId]: { kind, label } }, missing: [{ kind, label }] | null, busy }
 */
export default function usePhotoLabels(siteImages = [], propertyType = '') {
  const [labels, setLabels] = useState({});
  const [missing, setMissing] = useState(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);
  const key = siteImages.map((i) => i.id).join('|');

  useEffect(() => {
    if (!siteImages.length) { setMissing(null); return undefined; }
    const my = ++runId.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const small = await Promise.all(siteImages.map((i) => shrink(i.url)));
        const ok = siteImages.map((img, i) => ({ img, data: small[i] })).filter((x) => x.data);
        if (!ok.length) return;
        const r = await fetch(`${API_BASE_URL}/api/assist/photo-labels`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: ok.map((x) => x.data), propertyType }),
        });
        if (!r.ok || my !== runId.current) return;
        const d = await r.json();
        const next = {};
        ok.forEach((x, i) => { if (d.labels && d.labels[i]) next[x.img.id] = d.labels[i]; });
        setLabels(next);
        setMissing(Array.isArray(d.missing) ? d.missing : null);
      } catch { /* offline: no labels */ } finally {
        if (my === runId.current) setBusy(false);
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, propertyType]);

  return { labels, missing, busy };
}
