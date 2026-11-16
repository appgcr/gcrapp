import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';

/**
 * Best engineer for a new case — nearest on duty with the fewest open cases.
 * One tap assigns; the admin can still choose anyone from the list below.
 */
export default function SuggestedEngineer({ caseId, onAssign, busy }) {
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/cases/${caseId}/suggest-engineers`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setList(d && Array.isArray(d.list) ? d.list : []); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [caseId]);
  if (!list || !list.length) return null;
  const [best, ...rest] = list;
  return (
    <div className="sge">
      <div className="sge-row">
        <div className="sge-who">
          <span className="sge-tag">Best match</span>
          <b>{best.name}</b>
          <small>{best.why}</small>
        </div>
        <button type="button" className="sge-go" disabled={busy} onClick={() => onAssign(best.id)}>Assign</button>
      </div>
      {rest.length > 0 && (
        <button type="button" className="sge-more" onClick={() => setMore(!more)}>{more ? 'Hide others' : `Compare ${rest.length} other${rest.length > 1 ? 's' : ''}`}</button>
      )}
      {more && rest.map((e) => (
        <div key={e.id} className="sge-row sge-alt">
          <div className="sge-who"><b>{e.name}</b><small>{e.why}</small></div>
          <button type="button" className="sge-go ghost" disabled={busy} onClick={() => onAssign(e.id)}>Assign</button>
        </div>
      ))}
      <style>{`
        .sge { margin-top: 10px; padding: 10px; border-radius: 12px; background: #eff6ff; border: 1px solid #bfdbfe; }
        .sge-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .sge-alt { margin-top: 8px; padding-top: 8px; border-top: 1px solid #dbeafe; }
        .sge-who { display: flex; flex-direction: column; min-width: 0; font-size: 13.5px; color: #0f172a; }
        .sge-who small { font-size: 11.5px; color: #475569; margin-top: 1px; }
        .sge-tag { align-self: flex-start; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #1d4ed8; background: #dbeafe; padding: 2px 7px; border-radius: 999px; margin-bottom: 3px; }
        .sge-go { flex-shrink: 0; border: 0; background: #2563eb; color: #fff; font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 999px; cursor: pointer; }
        .sge-go.ghost { background: #fff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 6px 14px; font-size: 12px; }
        .sge-go:disabled { opacity: .5; }
        .sge-more { margin-top: 6px; border: 0; background: none; color: #1d4ed8; font-size: 12px; font-weight: 700; padding: 0; cursor: pointer; }
        body.dark-theme .sge { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .sge-who { color: #fff; }
      `}</style>
    </div>
  );
}
