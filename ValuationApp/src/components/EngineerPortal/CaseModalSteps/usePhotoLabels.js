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
const KIND_LABEL = { front: 'Front view', road: 'Approach road', side: 'Side / rear view', inside: 'Inside (hall / rooms)', kitchen: 'Kitchen', surroundings: 'Surroundings', boundary: 'Boundary / compound', meter: 'Electricity meter / door no.', open_land: 'Open land / plot', other: 'Other' };
function needed(propertyType = '') {
  const t = propertyType.toLowerCase();
  if (/apart|flat/.test(t)) return ['front', 'inside', 'kitchen', 'road'];
  if (/site|plot|land|agri/.test(t)) return ['open_land', 'road', 'boundary', 'surroundings'];
  return ['front', 'road', 'inside', 'surroundings'];
}

/**
 * Mahe AI names each site photo (front, road, inside…) and lists the key photos still missing.
 * Each photo is sent once; deleting or adding a photo only checks the new ones.
 * → { labels: { [imageId]: { kind, label } }, missing: [{ kind, label }] | null, busy }
 */
export default function usePhotoLabels(siteImages = [], propertyType = '') {
  const [labels, setLabels] = useState({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const runId = useRef(0);
  const key = siteImages.map((i) => i.id).join('|');

  useEffect(() => {
    const todo = siteImages.filter((i) => !labels[i.id]);
    if (!todo.length) return undefined;
    const my = ++runId.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const small = await Promise.all(todo.map((i) => shrink(i.url)));
        const ok = todo.map((img, i) => ({ img, data: small[i] })).filter((x) => x.data);
        if (!ok.length) return;
        const r = await fetch(`${API_BASE_URL}/api/assist/photo-labels`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: ok.map((x) => x.data), propertyType }),
        });
        if (!r.ok) { setFailed(true); return; }
        const d = await r.json();
        setFailed(false);
        setLabels((prev) => {
          const next = { ...prev };
          ok.forEach((x, i) => { if (d.labels && d.labels[i]) next[x.img.id] = d.labels[i]; });
          return next;
        });
      } catch { setFailed(true); /* offline: no labels */ } finally {
        if (my === runId.current) setBusy(false);
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, propertyType]);

  // What is still missing, from the photos that are named
  const named = siteImages.filter((i) => labels[i.id]);
  const missing = !siteImages.length || failed || named.length < siteImages.length ? (named.length ? computeMissing() : null) : computeMissing();
  function computeMissing() {
    const have = new Set(named.map((i) => labels[i.id].kind));
    return needed(propertyType).filter((k) => !have.has(k)).map((k) => ({ kind: k, label: KIND_LABEL[k] }));
  }
  return { labels, missing, busy };
}
