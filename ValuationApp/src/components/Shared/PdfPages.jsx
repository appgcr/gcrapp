import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

/**
 * A PDF drawn page by page inside the app. Works on Android too, where the in-app browser has no
 * PDF reader (an <iframe> of a PDF shows blank there). Pages fit the width; scroll and pinch to read.
 */
export default function PdfPages({ url, dark = true }) {
  const box = useRef(null);
  const [w, setW] = useState(360);
  const [pages, setPages] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => {
    const fit = () => setW(Math.max(240, Math.min(900, (box.current?.clientWidth || window.innerWidth) - 16)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const muted = dark ? '#cbd5e1' : '#64748b';
  return (
    <div ref={box} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      {err ? (
        <div style={{ color: muted, padding: 24, textAlign: 'center', fontSize: 14 }}>{err}</div>
      ) : (
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setPages(numPages)}
          onLoadError={() => setErr('This PDF could not be shown here. Use Download to open it.')}
          loading={<div style={{ color: muted, display: 'flex', gap: 8, alignItems: 'center', padding: 32 }}><Loader2 className="spin" size={18} /> Loading PDF…</div>}
        >
          {Array.from({ length: pages }, (_, i) => (
            <div key={i} style={{ marginBottom: 12, boxShadow: '0 4px 14px rgba(0,0,0,.35)', background: '#fff' }}>
              <Page pageNumber={i + 1} width={w} renderTextLayer={false} renderAnnotationLayer={false} />
              {pages > 1 && <div style={{ color: muted, textAlign: 'center', fontSize: 12, padding: '6px 0', background: dark ? '#111' : '#f1f5f9' }}>Page {i + 1} of {pages}</div>}
            </div>
          ))}
        </Document>
      )}
    </div>
  );
}
