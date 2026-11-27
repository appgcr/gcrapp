import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Image as ImageIcon, Loader2, X, Download, FolderOpen, FileWarning, Sparkles, Mic, Upload } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';
import { isWordFile, resolveDocUrl } from '../../utils/docFiles';
import { PdfSheet } from './AdminFees';
import PdfPages from '../Shared/PdfPages';
import { reportFileName } from '../../utils/reportFileName';
import ValocityFilesCard from '../Shared/ValocityFilesCard';
import { isValocityBank } from '../../utils/valocityFiles';
import { useBanks } from '../../utils/banks';

const DOCS = [
  ['bankDocs', 'Documents from the bank'],
  ['officeSheet', 'Office data sheet'],
  ['saleDeed', 'Sale Deed / Registered Document'],
  ['buildingPlan', 'Approved Building Plan'],
  ['propertyTax', 'Property Tax Receipt'],
  ['marketValue', 'Guideline Value Certificate'],
  ['layoutPlan', 'Layout / Approval Plan'],
];
const pageUrl = (p) => (typeof p === 'string' ? p : (p && (p.url || p.dataUrl)) || '');
const isPdfPage = (p) => !!(p && (p.isPdf || /pdf/i.test(p.mime || p.type || '') || /\.pdf$/i.test(p.name || '') || /^data:application\/pdf/.test(pageUrl(p))));

/** "Files" for admins: every document the engineer uploaded and every site photo, plus all of it as one PDF. */
export default function CaseFiles({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="cs-btn cs-ghost" onClick={() => setOpen(true)}><FolderOpen size={15} /> Files</button>
      {open && createPortal(<FilesSheet c={c} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function FilesSheet({ c, onClose }) {
  const [full, setFull] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);   // { url, name, pdf, word }
  const [all, setAll] = useState(false);
  const banks = useBanks();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cases/${c.id}`, { headers: authHeaders() })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load the files.'); return r.json(); })
      .then(setFull).catch((e) => setErr(e.message));
  }, [c.id]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (view) setView(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, onClose]);

  const docs = full?.documents || {};
  const photos = Array.isArray(full?.sitePhotos) ? full.sitePhotos : [];
  const sheetCase = full?.propertyDetails?.entryMode === 'sheet';
  const docCount = DOCS.reduce((n, [id]) => n + (Array.isArray(docs[id]) ? docs[id].length : 0), 0);
  const safeNo = String(c.fileNumber || c.id).replace(/[^A-Za-z0-9]+/g, '-');

  return (
    <div className="cf-bg" onClick={onClose}>
      <div className="cf" role="dialog" aria-modal="true" aria-label="Case files" data-no-reach onClick={(e) => e.stopPropagation()}>
        <div className="cf-h">
          <div><b>Files</b><span>{c.fileNumber || `#${c.id}`} · {c.clientName}</span></div>
          <button type="button" className="cf-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="cf-body">
          {err ? <div className="cf-empty"><FileWarning size={20} /> {err}</div> : !full ? <div className="cf-empty"><Loader2 className="spin" size={20} /> Loading…</div> : (
            <>
              <button type="button" className="cf-all" onClick={() => setAll(true)} disabled={!docCount && !photos.length}>
                <Download size={17} /> All documents &amp; photos as one PDF
              </button>
              {isValocityBank(banks, full.bankName) && <ValocityFilesCard caseInfo={full} documents={docs} photos={photos} />}
              <div className="cf-sec">Documents <small>{docCount} file{docCount === 1 ? '' : 's'}</small></div>
              {DOCS.map(([id, title]) => {
                const pages = Array.isArray(docs[id]) ? docs[id] : [];
                if ((id === 'officeSheet' || id === 'bankDocs') && !pages.length) return null;
                if (sheetCase && id !== 'officeSheet' && !pages.length) return null;
                return (
                  <div key={id} className="cf-doc">
                    <div className="cf-doc-t">{title}{!pages.length && <em>Not uploaded</em>}</div>
                    {pages.length > 0 && (
                      <div className="cf-files">
                        {pages.map((p, i) => {
                          const url = resolveDocUrl(pageUrl(p));
                          const pdf = isPdfPage(p); const word = isWordFile(p);
                          const name = p?.name || `${title} ${i + 1}`;
                          return (
                            <button type="button" key={i} className="cf-file" onClick={() => setView({ url, name, pdf, word })} disabled={!url}>
                              {pdf || word ? <span className={`cf-ico ${pdf ? 'pdf' : 'doc'}`}><FileText size={20} /><b>{pdf ? 'PDF' : 'DOC'}</b></span>
                                : <img src={url} alt="" loading="lazy" />}
                              <span className="cf-name">{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="cf-sec">Site photos <small>{photos.length}</small></div>
              {photos.length ? (
                <div className="cf-photos">
                  {photos.map((p, i) => {
                    const url = resolveDocUrl(pageUrl(p));
                    return (
                      <button type="button" key={i} className="cf-photo" onClick={() => setView({ url, name: `Site photo ${i + 1}`, pdf: false })}>
                        <img src={url} alt={`Site photo ${i + 1}`} loading="lazy" />
                      </button>
                    );
                  })}
                </div>
              ) : <div className="cf-none"><ImageIcon size={16} /> No site photos yet.</div>}
              {full.aiReview && full.aiReview.status !== 'skipped' && (<>
                <div className="cf-sec">Gouru AI review call <small>{full.aiReview.status === 'clear' ? 'no questions' : `${(full.aiReview.log || []).length} answers · ${Math.floor((full.aiReview.seconds || 0) / 60)}m ${(full.aiReview.seconds || 0) % 60}s`}</small></div>
                <div className="cf-ai">
                  {full.aiReview.status === 'clear' && <div className="cf-ai-ok"><Sparkles size={15} /> Gouru AI checked this case before submit — nothing needed the engineer's answer.</div>}
                  {(full.documents?.aiReviewCall || [])[0] && (
                    <audio controls preload="metadata" src={resolveDocUrl(full.documents.aiReviewCall[0].url)} style={{ width: '100%' }} aria-label="Gouru AI review call recording" />
                  )}
                  {(full.aiReview.log || []).map((e, k) => (
                    <div key={k} className="cf-ai-row">
                      <div className="cf-ai-q"><b>Q{k + 1}.</b> {e.question}</div>
                      <div className={`cf-ai-a ${e.decision}`}>
                        <span>{e.decision === 'change' ? <>Changed{e.label ? ` ${e.label}` : ''}: <s>{e.before || 'empty'}</s> → <b>{e.after}</b></>
                          : e.decision === 'keep' ? <>Confirmed as entered{e.before ? `: ${e.before}` : ''}</>
                            : <>Engineer's reason: {e.note}</>}</span>
                        <span className="cf-ai-via">{e.via === 'voice' ? `🎤 “${e.transcript || ''}”` : e.via === 'typed' ? '⌨️ typed' : '👆 tapped'} · {Math.floor((e.at || 0) / 60)}:{String((e.at || 0) % 60).padStart(2, '0')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>)}
              {Array.isArray(docs.voiceNotes) && docs.voiceNotes.length > 0 && (<>
                <div className="cf-sec">Voice notes <small>{docs.voiceNotes.length} · what the engineer said and what Gouru AI heard</small></div>
                <div className="cf-ai">
                  {docs.voiceNotes.map((v, k) => (
                    <div key={v.hash || v.id || k} className="cf-ai-row cf-vn">
                      <div className="cf-vn-h">
                        {v.source === 'upload' ? <Upload size={15} /> : <Mic size={15} />}
                        <b>{v.source === 'upload' ? 'Uploaded recording' : 'Spoken at the site'}</b>
                        <span>{[v.at ? new Date(v.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : v.uploadedAt, v.seconds ? `${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, '0')}` : '', v.filled ? `${v.filled} details filled` : ''].filter(Boolean).join(' · ')}</span>
                      </div>
                      <audio controls preload="metadata" src={resolveDocUrl(v.url)} style={{ width: '100%' }} aria-label={`Voice note ${k + 1}`} />
                      {v.transcript && (
                        <details className="cf-vn-t">
                          <summary>What Gouru AI heard</summary>
                          <p>{v.transcript}</p>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </>)}
              {full.siteSelfie && (<>
                <div className="cf-sec">Engineer selfie at the site</div>
                <div className="cf-photos">
                  <button type="button" className="cf-photo" onClick={() => setView({ url: resolveDocUrl(full.siteSelfie), name: 'Engineer selfie at the site', pdf: false })}>
                    <img src={resolveDocUrl(full.siteSelfie)} alt="Engineer selfie at the site" loading="lazy" />
                  </button>
                </div>
              </>)}
            </>
          )}
        </div>
      </div>

      {view && (
        <div className="cf-view" role="dialog" aria-modal="true" aria-label={view.name} data-no-reach onClick={(e) => e.stopPropagation()}>
          <div className="cf-view-h">
            <span>{view.name}</span>
            <a className="cf-view-b" href={view.url} target="_blank" rel="noreferrer" download={view.name} aria-label="Download"><Download size={18} /></a>
            <button type="button" className="cf-view-b" onClick={() => setView(null)} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="cf-view-body">
            {view.word ? (
              <div className="cf-empty light"><FileText size={40} /> Word file. Use Download to open it.</div>
            ) : view.pdf ? (
              <PdfPages url={view.url} />
            ) : (
              <img src={view.url} alt={view.name} />
            )}
          </div>
        </div>
      )}

      {all && (
        <div onClick={(e) => e.stopPropagation()}>
          <PdfSheet url={`${API_BASE_URL}/api/cases/${c.id}/annexure.pdf`} title="Documents & photos" fileName={reportFileName(c, 'pdf', 'Documents')} onClose={() => setAll(false)} />
        </div>
      )}

      <style>{`
        .cf-bg { position: fixed; inset: 0; z-index: 3000; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 640px) { .cf-bg { align-items: center; } .cf { border-radius: 18px !important; } }
        .cf { width: 100%; max-width: 560px; max-height: 92vh; display: flex; flex-direction: column; background: #f2f2f7; border-radius: 18px 18px 0 0; overflow: hidden; }
        .cf-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 14px 10px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
        .cf-h b { display: block; font-size: 17px; color: #0f172a; }
        .cf-h span { font-size: 12.5px; color: #64748b; }
        .cf-x { flex: 0 0 36px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: #f1f5f9; color: #334155; display: grid; place-items: center; cursor: pointer; }
        .cf-body { overflow-y: auto; overscroll-behavior: contain; padding: 12px 14px calc(18px + env(safe-area-inset-bottom)); }
        .cf-all { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; padding: 13px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .cf-all:disabled { opacity: .45; }
        .cf-sec { margin: 16px 2px 8px; font-size: 12.5px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; color: #64748b; display: flex; justify-content: space-between; }
        .cf-sec small { font-weight: 600; text-transform: none; letter-spacing: 0; }
        .cf-doc { background: #fff; border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
        .cf-doc-t { font-size: 14px; font-weight: 700; color: #0f172a; display: flex; justify-content: space-between; gap: 8px; }
        .cf-doc-t em { font-style: normal; font-size: 12px; font-weight: 600; color: #b91c1c; background: #fef2f2; border-radius: 999px; padding: 1px 8px; }
        .cf-files { display: flex; gap: 8px; overflow-x: auto; margin-top: 8px; padding-bottom: 2px; }
        .cf-file { flex: 0 0 92px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font-family: inherit; }
        .cf-file img, .cf-ico { width: 78px; height: 78px; border-radius: 7px; object-fit: cover; background: #e2e8f0; }
        .cf-ico { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
        .cf-ico.pdf { background: #fef2f2; color: #dc2626; } .cf-ico.doc { background: #eff6ff; color: #2563eb; }
        .cf-ico b { font-size: 10.5px; }
        .cf-name { font-size: 10.5px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
        .cf-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .cf-photo { border: 0; padding: 0; border-radius: 10px; overflow: hidden; aspect-ratio: 1; background: #e2e8f0; cursor: pointer; }
        .cf-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cf-ai { background: #fff; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
        .cf-ai-ok { display: flex; gap: 8px; align-items: center; color: #166534; font-size: 13.5px; font-weight: 600; }
        .cf-ai-row { border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 13.5px; }
        .cf-ai-row:first-of-type { border-top: 0; padding-top: 0; }
        .cf-vn { display: flex; flex-direction: column; gap: 6px; }
        .cf-vn-h { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: #4338ca; } .cf-vn-h b { color: #1e1b4b; } .cf-vn-h span { color: #64748b; font-size: 12.5px; }
        .cf-vn-t summary { cursor: pointer; font-size: 12.5px; font-weight: 700; color: #4f46e5; }
        .cf-vn-t p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: #334155; white-space: pre-wrap; }
        body.dark-theme .cf-vn-h b { color: #fff; } body.dark-theme .cf-vn-t p { color: #d1d5db; }
        .cf-ai-q { color: #0f172a; }
        .cf-ai-a { margin-top: 4px; padding: 6px 9px; border-radius: 8px; background: #f0fdf4; color: #166534; display: flex; flex-direction: column; gap: 2px; }
        .cf-ai-a.change { background: #fff7ed; color: #9a3412; }
        .cf-ai-a.explain { background: #eff6ff; color: #1e3a8a; }
        .cf-ai-via { font-size: 11.5px; color: #64748b; }
        .cf-none, .cf-empty { display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b; font-size: 13.5px; padding: 18px; }
        .cf-empty.light { color: #e2e8f0; flex-direction: column; }
        .cf-view { position: fixed; inset: 0; z-index: 3100; background: rgba(0,0,0,.94); display: flex; flex-direction: column; }
        .cf-view-h { display: flex; align-items: center; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px 16px; color: #fff; }
        .cf-view-h span { flex: 1; min-width: 0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cf-view-b { flex: 0 0 44px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; display: grid; place-items: center; cursor: pointer; }
        .cf-view-body { flex: 1; min-height: 0; overflow: auto; flex-direction: column; overscroll-behavior: contain; touch-action: pan-x pan-y pinch-zoom; display: flex; padding: 8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px); }
        .cf-view-body img { max-width: 100%; max-height: 100%; object-fit: contain; margin: auto; }
        .cf-view-body iframe { flex: 1; border: 0; border-radius: 8px; background: #fff; }
        body.dark-theme .cf { background: #000; }
        body.dark-theme .cf-h, body.dark-theme .cf-doc { background: #1c1c1e; border-color: #2c2c2e; }
        body.dark-theme .cf-h b, body.dark-theme .cf-doc-t { color: #fff; }
        body.dark-theme .cf-file { background: #2c2c2e; border-color: #3a3a3c; }
      `}</style>
    </div>
  );
}
