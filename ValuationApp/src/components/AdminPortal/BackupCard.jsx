import React, { useEffect, useState } from 'react';
import { Download, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';
import { saveBlobToDevice } from '../../utils/fileDownload';

// Super Admin: download the whole database as one file, to keep safe away from the server (routes/backup.js).
export default function BackupCard() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  // If the check fails (no signal / server waking up) say so, instead of "Checking…" for ever
  const load = () => { setSt(null); return fetch(`${API_BASE_URL}/api/backup/status`, { headers: authHeaders() })
    .then((r) => (r.ok ? r.json() : Promise.reject())).then(setSt).catch(() => setSt({ failed: true })); };
  useEffect(() => { load(); }, []);
  const download = async (full) => {
    setBusy(full ? 'full' : 'data');
    try {
      const r = await fetch(`${API_BASE_URL}/api/backup/download${full ? '?files=1' : ''}`, { headers: authHeaders() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not make the backup.');
      const name = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || 'gouru-backup.jsonl.gz';
      const blob = await r.blob();
      await saveBlobToDevice(blob, name, { successMsg: `Backup saved (${(blob.size / 1048576).toFixed(1)} MB). Keep it safe — it has every customer's details.` });
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const old = !st || st.failed || st.daysSince === null || st.daysSince >= 7;
  return (
    <>
      <div className="ios-group bk-card">
        <div className={`bk-st ${old ? 'old' : ''}`}>
          {old ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          <span>{!st ? 'Checking…' : st.failed ? <>Couldn’t check the last backup. <button type="button" className="bk-retry" onClick={load}>Try again</button></> : st.lastAt
            ? `Last backup ${st.daysSince === 0 ? 'today' : `${st.daysSince} day${st.daysSince === 1 ? '' : 's'} ago`} (${st.lastKind === 'full' ? 'with files' : 'data'}) by ${st.lastBy}`
            : 'No backup taken yet'}</span>
        </div>
        <button type="button" className="bk-btn" disabled={!!busy} onClick={() => download(false)}>
          {busy === 'data' ? <Loader2 size={17} className="spin" /> : <Download size={17} />} Download data backup <small>cases, users, banks, invoices, settings</small>
        </button>
        <button type="button" className="bk-btn ghost" disabled={!!busy} onClick={() => download(true)}>
          {busy === 'full' ? <Loader2 size={17} className="spin" /> : <Download size={17} />} Download full backup <small>also every document and photo — large, takes longer</small>
        </button>
      </div>
      <p className="ios-footnote">Take a data backup every week (you get a reminder after 7 days) and a full one every month. Keep the files on a computer or drive — not on the same phone — because they hold every customer's details. Restoring is done by your developer with scripts/restore-backup.js, into an empty database.</p>
      <style>{`
        .bk-card { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .bk-st { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #15803d; font-weight: 600; }
        .bk-st.old { color: #b45309; }
        .bk-retry { border: 0; background: none; color: #2563eb; font-weight: 700; font-size: 13.5px; padding: 0; cursor: pointer; font-family: inherit; }
        .bk-btn { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; text-align: left; border: 0; border-radius: 12px; padding: 12px 14px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .bk-btn small { width: 100%; font-size: 12px; font-weight: 500; opacity: .85; }
        .bk-btn.ghost { background: #eff6ff; color: #1d4ed8; }
        .bk-btn:disabled { opacity: .6; }
      `}</style>
    </>
  );
}
