import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, FileWarning, RefreshCw } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import toast from 'react-hot-toast';

/**
 * Shows the bank-format report (the .docx the server builds) inside the app — the same
 * document that goes to the bank: letterhead, tables, photos, maps and signature.
 *   load(): Promise<Blob>  – fetches the .docx
 *   fileName               – name used for "Download"
 *   footer                 – optional extra buttons (e.g. Approve / Return)
 */
export default function ReportViewer({ title = 'Valuation Report', subtitle, load, fileName = 'Valuation_Report.docx', onClose, footer }) {
  const pagesRef = useRef(null);
  const scrollRef = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [blob, setBlob] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState('loading');
    (async () => {
      try {
        const file = await load();
        if (!alive) return;
        setBlob(file);
        pagesRef.current.innerHTML = '';
        await renderAsync(file, pagesRef.current, undefined, {
          className: 'rv-docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: false,
          experimental: true, useBase64URL: true, renderHeaders: true, renderFooters: true,
        });
        if (!alive) return;
        setState('ready');
        fit();
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'The report could not be opened.');
        setState('error');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Pages are A4 width; shrink them to fit a phone screen
  const fit = () => {
    const page = pagesRef.current?.querySelector('section.rv-docx');
    const box = scrollRef.current;
    if (!page || !box) return;
    const avail = box.clientWidth - 24;
    setZoom(Math.min(1, avail / page.offsetWidth));
  };
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success('Report downloaded');
  };

  return createPortal(
    <div className="rv-bg" role="dialog" aria-modal="true" aria-label={title}>
      <header className="rv-bar">
        <button type="button" className="rv-icon" onClick={onClose} aria-label="Close report"><X size={20} /></button>
        <div className="rv-titles">
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button type="button" className="rv-dl" onClick={download} disabled={!blob}>
          <Download size={16} /> <span>Word</span>
        </button>
      </header>

      <div className="rv-scroll" ref={scrollRef}>
        {state === 'loading' && (
          <div className="rv-state"><Loader2 size={26} className="spin" /><span>Preparing the bank report…</span></div>
        )}
        {state === 'error' && (
          <div className="rv-state">
            <FileWarning size={30} />
            <strong>Couldn’t open the report</strong>
            <span>{error}</span>
            <button type="button" className="rv-retry" onClick={() => setAttempt((n) => n + 1)}><RefreshCw size={15} /> Try again</button>
          </div>
        )}
        <div ref={pagesRef} className="rv-pages" style={{ zoom, display: state === 'ready' ? 'block' : 'none' }} />
      </div>

      {footer && state === 'ready' && <footer className="rv-foot">{footer}</footer>}

      <style>{`
        .rv-bg { position: fixed; inset: 0; z-index: 10050; background: #e9e9ee; display: flex; flex-direction: column; }
        .rv-bar { display: flex; align-items: center; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px;
          background: rgba(249,249,251,.94); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid rgba(60,60,67,.2); }
        .rv-icon { width: 36px; height: 36px; flex-shrink: 0; border: 0; border-radius: 50%; background: rgba(118,118,128,.14); display: grid; place-items: center; color: #1c1c1e; cursor: pointer; }
        .rv-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .rv-titles strong { font-size: 16px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rv-titles span { font-size: 12px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rv-dl { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border: 0; border-radius: 17px; background: #007aff; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
        .rv-dl:disabled { opacity: .45; }
        .rv-scroll { flex: 1; overflow: auto; -webkit-overflow-scrolling: touch; padding: 12px 0 24px; }
        .rv-pages .rv-docx-wrapper { background: transparent !important; padding: 0 !important; display: flex; flex-direction: column; align-items: center; }
        .rv-pages section.rv-docx { margin: 0 auto 14px !important; box-shadow: 0 2px 10px rgba(0,0,0,.14) !important; }
        /* Unequal two-column blocks (Place/Date | Signature) can't be drawn exactly in a browser — show them as one column */
        .rv-pages article[style*="column-count"] { column-count: 1 !important; }
        .rv-state { min-height: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #6b7280; text-align: center; padding: 40px 24px; font-size: 14px; }
        .rv-state strong { color: #111; font-size: 16px; }
        .rv-retry { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; border: 0; background: #fff; border-radius: 10px; padding: 9px 14px; color: #007aff; font-weight: 600; cursor: pointer; }
        .rv-foot { display: flex; gap: 10px; padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px); background: rgba(249,249,251,.96); border-top: 0.5px solid rgba(60,60,67,.2); }
        .rv-foot > * { flex: 1; }
      `}</style>
    </div>,
    document.body,
  );
}

/** Fetch a report .docx from the server, with a readable error message. */
export async function fetchReport(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) {
    let msg = `The server could not build the report (${r.status}).`;
    try { const d = await r.json(); msg = d.details || d.error || d.message || msg; } catch (_) { /* not JSON */ }
    throw new Error(msg);
  }
  return r.blob();
}
