import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Landmark, KeyRound, Power, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';
import StaffFormSheet from './StaffFormSheet';

/**
 * Bank employees who send valuation requests to this Gouru branch (Super Admin: the branch being viewed,
 * or all). They log in on the website / app and only see their own requests.
 */
export default function BankUsersPanel({ superAdmin, branches = [], scope = 'all' }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [issued, setIssued] = useState(null); // { name, username, password } shown once

  const load = useCallback(() => {
    fetch(`${API_BASE_URL}/api/users`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows((Array.isArray(d) ? d : d.users || []).filter((u) => u.role === 'BANK')))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load, scope]);

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '';

  const resetPassword = async (u) => {
    if (!window.confirm(`Give ${u.name} a new password? The old one stops working.`)) return;
    setBusyId(u.id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(u.id)}/reset-password`, { method: 'POST', headers: authHeaders(), body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not reset the password.');
      setIssued({ name: u.name, username: u.username, password: d.temporaryPassword || '' });
    } catch (e) { toast.error(e.message); } finally { setBusyId(''); }
  };

  const toggle = async (u) => {
    const next = u.status === 'Inactive' ? 'Active' : 'Inactive';
    if (next === 'Inactive' && !window.confirm(`Turn off ${u.name}'s login? Their past requests stay.`)) return;
    setBusyId(u.id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(u.username)}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not update.');
      toast.success(next === 'Active' ? 'Login turned on' : 'Login turned off');
      load();
    } catch (e) { toast.error(e.message); } finally { setBusyId(''); }
  };

  return (
    <div className="animate-fade-in" data-testid="bank-users">
      <div className="gcr-section-head" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 className="gcr-section-title" style={{ fontSize: 22 }}>Bank Users</h2>
          <p className="gcr-section-sub">Bank employees who send you valuation requests</p>
        </div>
        <button className="st-add" onClick={() => setAdding(true)}><Plus size={17} strokeWidth={2.4} /> Add Bank Employee</button>
      </div>

      {issued && (
        <div className="admin-card" style={{ padding: 14, marginBottom: 12, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
          <b>New login for {issued.name}</b>
          <div style={{ fontSize: 14, marginTop: 6 }}>Username: <code>{issued.username}</code> · Password: <code>{issued.password}</code></div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Share it with them privately. It is shown only now.</div>
          <button className="fs-link" style={{ marginTop: 8 }} onClick={() => setIssued(null)}>Done</button>
        </div>
      )}

      {rows === null ? (
        <p className="gcr-section-sub">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="admin-card" style={{ padding: 24, textAlign: 'center' }}>
          <Landmark size={28} color="#94a3b8" />
          <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>No bank employees yet</p>
          <p className="gcr-section-sub" style={{ margin: 0 }}>Add a bank manager or loan officer so they can send requests directly to your branch.</p>
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderTop: i ? '1px solid #eef0f4' : 'none', opacity: u.status === 'Inactive' ? 0.55 : 1 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: '#eef2ff', color: '#3730a3', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Landmark size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{u.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}>@{u.username}</span></div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {[u.designation, u.bankName, u.bankBranch].filter(Boolean).join(' · ')}{u.phone ? ` · ${u.phone}` : ''}
                </div>
                {superAdmin && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sends to Gouru {branchName(u.branchId) || u.branchId}</div>}
              </div>
              <button className="fs-icon" title="New password" aria-label={`New password for ${u.name}`} onClick={() => resetPassword(u)} disabled={busyId === u.id}>
                {busyId === u.id ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />}
              </button>
              <button className="fs-icon" title={u.status === 'Inactive' ? 'Turn login on' : 'Turn login off'} aria-label="Turn login on or off" onClick={() => toggle(u)} disabled={busyId === u.id}>
                <Power size={16} color={u.status === 'Inactive' ? '#16a34a' : '#dc2626'} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <StaffFormSheet
          role="BANK"
          branches={superAdmin ? branches.filter((b) => b.status !== 'Inactive') : undefined}
          defaultBranchId={scope !== 'all' ? scope : ''}
          onClose={() => setAdding(false)}
          onCreated={(u, pw) => { setAdding(false); setIssued({ name: u.name, username: u.username, password: pw }); load(); }}
        />
      )}
    </div>
  );
}
