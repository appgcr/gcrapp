import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Camera, X, Loader2, ListChecks, FileText, Image as ImageIcon, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { DOC_ACCEPT, resolveDocUrl } from '../../utils/docFiles';
import { loadValocityFiles, addValocityUploads, addValocityFromCase, removeValocityFile } from '../../utils/valocityFiles';

const DOC_LABEL = {
  bankDocs: 'From the bank', officeSheet: 'Office sheet', saleDeed: 'Sale deed', buildingPlan: 'Building plan',
  propertyTax: 'Property tax', marketValue: 'Market value', layoutPlan: 'Layout plan',
};
const urlOf = (p) => (typeof p === 'string' ? p : (p && p.url) || '');
const stored = (u) => /^\/api\/files\/[a-f0-9]{24}\?k=/i.test(String(u || '').replace(/^https?:\/\/[^/]+/, ''));
const relative = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '');

/**
 * The case's "Valocity files": only these go to the bank's Valocity portal (the Gouru Autofill extension lists
 * and attaches just these there). Add new files / photos, or tick files already on the case.
 * caseInfo: { id, fileNumber, clientName, createdAt } · documents: { saleDeed: [page…] … } · photos: [url | { url }]
 */
export default function ValocityFilesCard({ caseInfo, documents = {}, photos = [] }) {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState('');
  const [picking, setPicking] = useState(false);
  const [ticked, setTicked] = useState([]);
  const fileInput = useRef(null);
  const camInput = useRef(null);
  const id = caseInfo?.id;

  useEffect(() => {
    if (!id) return;
    loadValocityFiles(id).then(setFiles).catch(() => setFiles([]));
  }, [id]);

  const upload = async (list) => {
    if (!list.length) return;
    setBusy(`Uploading ${list.length} file${list.length > 1 ? 's' : ''}…`);
    try { setFiles(await addValocityUploads(caseInfo, list, (files || []).length)); toast.success('Added to Valocity files'); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };

  // Files already on the case that can be ticked
  const have = new Set((files || []).map((f) => f.url));
  const choices = [
    ...Object.entries(documents || {}).flatMap(([k, pages]) => (Array.isArray(pages) && DOC_LABEL[k] ? pages : []).map((p, i) => ({
      key: `${k}-${i}`, url: relative(urlOf(p)), name: (p && p.name) || `${DOC_LABEL[k]} ${i + 1}`, label: DOC_LABEL[k],
      type: p && (p.isPdf || /\.pdf$/i.test(p.name || '')) ? 'application/pdf' : /\.png$/i.test((p && p.name) || '') ? 'image/png' : 'image/jpeg', size: (p && p.size) || 0,
    }))),
    ...(photos || []).map((p, i) => ({ key: `photo-${i}`, url: relative(urlOf(p)), name: `Site photo ${i + 1}`, label: 'Site photo', type: 'image/jpeg', size: 0 })),
  ].filter((c) => stored(c.url) && !have.has(c.url));

  const addTicked = async () => {
    const items = choices.filter((c) => ticked.includes(c.key)).map(({ name, url, type, size }) => ({ name, url, type, size }));
    if (!items.length) return;
    setBusy('Adding…');
    try { setFiles(await addValocityFromCase(id, items)); setTicked([]); setPicking(false); toast.success(`${items.length} added to Valocity files`); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };
  const remove = async (f) => {
    setBusy('Removing…');
    try { setFiles(await removeValocityFile(id, f.id)); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  if (!id) return null;
  return (
    <div className="vf">
      <div className="vf-h">
        <div><b>Valocity files</b><small>Only these go to the Valocity portal. The sale deed, selfie and other files stay in Gouru.</small></div>
      </div>
      <input ref={fileInput} type="file" multiple hidden accept={DOC_ACCEPT} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; upload(l); }} />
      <input ref={camInput} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; upload(l); }} />

      {files === null ? <div className="vf-empty"><Loader2 size={16} className="spin" /></div> : files.length === 0 ? (
        <div className="vf-empty">No Valocity files yet.</div>
      ) : (
        <div className="vf-list">
          {files.map((f) => (
            <div className="vf-row" key={f.id}>
              {/pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? <FileText size={16} /> : <ImageIcon size={16} />}
              <a href={resolveDocUrl(f.url)} target="_blank" rel="noreferrer">{f.name}</a>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(f)} disabled={!!busy}><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="vf-btns">
        <button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy}><Paperclip size={15} /> Add</button>
        <button type="button" onClick={() => camInput.current?.click()} disabled={!!busy}><Camera size={15} /> Camera</button>
        <button type="button" onClick={() => setPicking((x) => !x)} disabled={!!busy || !choices.length} aria-expanded={picking}><ListChecks size={15} /> From this case</button>
      </div>
      {busy && <div className="vf-busy"><Loader2 size={14} className="spin" /> {busy}</div>}

      {picking && choices.length > 0 && (
        <div className="vf-pick">
          {choices.map((c) => {
            const on = ticked.includes(c.key);
            return (
              <button type="button" key={c.key} className={`vf-opt${on ? ' on' : ''}`} aria-pressed={on}
                onClick={() => setTicked((t) => (on ? t.filter((k) => k !== c.key) : [...t, c.key]))}>
                <span className="vf-box">{on && <Check size={13} />}</span>
                <span className="vf-opt-t">{c.label}<small>{c.name}</small></span>
              </button>
            );
          })}
          <button type="button" className="vf-add" onClick={addTicked} disabled={!ticked.length || !!busy}>Add {ticked.length || ''} to Valocity files</button>
        </div>
      )}

      <style>{`
        .vf { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
        .vf-h b { display: block; font-size: 15px; color: #0f172a; } .vf-h small { font-size: 12.5px; color: #64748b; line-height: 1.35; }
        .vf-empty { color: #94a3b8; font-size: 13.5px; display: flex; justify-content: center; padding: 6px; }
        .vf-list { display: flex; flex-direction: column; border: 1px solid #eef2f7; border-radius: 10px; overflow: hidden; }
        .vf-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid #f1f5f9; color: #475569; }
        .vf-row:first-child { border-top: 0; }
        .vf-row a { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #0f172a; font-size: 13.5px; text-decoration: none; }
        .vf-row button { border: 0; background: none; color: #94a3b8; cursor: pointer; padding: 2px; display: inline-flex; }
        .vf-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .vf-btns button { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 7px 12px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .vf-btns button:disabled { opacity: .45; cursor: default; }
        .vf-busy { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4f46e5; }
        .vf-pick { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #eef2f7; padding-top: 8px; }
        .vf-opt { display: flex; align-items: center; gap: 10px; border: 0; background: none; text-align: left; padding: 6px 4px; cursor: pointer; font-family: inherit; border-radius: 8px; }
        .vf-opt.on { background: #eff6ff; }
        .vf-box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #94a3b8; display: grid; place-items: center; flex: none; color: #fff; }
        .vf-opt.on .vf-box { background: #2563eb; border-color: #2563eb; }
        .vf-opt-t { display: flex; flex-direction: column; font-size: 13.5px; color: #0f172a; min-width: 0; }
        .vf-opt-t small { color: #64748b; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vf-add { margin-top: 4px; border: 0; background: #2563eb; color: #fff; border-radius: 10px; padding: 10px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
        .vf-add:disabled { opacity: .45; }
        body.dark-theme .vf, body.dark-theme .vf-list { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .vf-h b, body.dark-theme .vf-row a, body.dark-theme .vf-opt-t { color: #fff; }
        body.dark-theme .vf-opt.on { background: #1e293b; }
      `}</style>
    </div>
  );
}
