import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';

// Easy-to-read starter password, e.g. "Mango-4827-Cloud"
export function suggestPassword() {
  const words = ['River', 'Mango', 'Tiger', 'Lotus', 'Cloud', 'Stone', 'Maple', 'Pearl', 'Comet', 'Cedar', 'Coral', 'Delta', 'Falcon', 'Harbor', 'Jasmine', 'Meadow'];
  const r = (n) => Math.floor(Math.random() * n);
  return `${words[r(words.length)]}-${2000 + r(7999)}-${words[r(words.length)]}`;
}

/**
 * iOS-style sheet to create an account.
 *   role: 'ENGINEER' | 'ADMIN' | 'BANK' (a bank employee who sends valuation requests)
 *   branches: list to choose from (Super Admin) — omit for a Branch Admin (their own branch is used)
 *   defaultBranchId: preselected branch
 */
export default function StaffFormSheet({ role = 'ENGINEER', branches, defaultBranchId = '', onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: suggestPassword(), branchId: defaultBranchId || branches?.[0]?.id || '',
    bankName: '', bankBranch: '', designation: '', email: '' });
  const isBank = role === 'BANK';
  const [banks, setBanks] = useState([]);
  useEffect(() => {
    if (!isBank) return;
    fetch(`${API_BASE_URL}/api/banks`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : []))
      .then((d) => setBanks((Array.isArray(d) ? d : d.banks || []).filter((b) => b.active !== false))).catch(() => {});
  }, [isBank]);
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }));
  const title = role === 'ADMIN' ? 'New Branch Admin' : isBank ? 'New Bank Employee' : 'New Engineer';
  const canSave = form.name.trim() && form.username.trim() && form.password.trim().length >= 6 && (!branches || form.branchId) && !busy
    && (!isBank || (form.bankName && form.bankBranch.trim() && form.phone.length === 10));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    if (form.phone && form.phone.length !== 10) { toast.error('Mobile number must be 10 digits'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(), username: form.username.trim(), password: form.password.trim(),
          phone: form.phone || undefined, role, branchId: branches ? form.branchId : undefined,
          ...(isBank ? { bankName: form.bankName, bankBranch: form.bankBranch.trim(), designation: form.designation.trim(), email: form.email.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create the account');
      toast.success(`${data.name} added`);
      onCreated?.(data, form.password.trim());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fs-bg" onClick={onClose}>
      <form className="fs-sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="fs-nav">
          <button type="button" className="fs-link" onClick={onClose}>Cancel</button>
          <span className="fs-title">{title}</span>
          <button type="submit" className="fs-link fs-strong" disabled={!canSave}>{busy ? <Loader2 size={17} className="spin" /> : 'Add'}</button>
        </div>

        {branches && (
          <>
            <div className="fs-section">Branch</div>
            <div className="fs-group">
              <label className="fs-row">
                <span>Branch</span>
                <select value={form.branchId} onChange={set('branchId')} required>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </label>
            </div>
          </>
        )}

        {isBank && (
          <>
            <div className="fs-section">Bank</div>
            <div className="fs-group">
              <label className="fs-row">
                <span>Bank</span>
                <select value={form.bankName} onChange={set('bankName')} required data-testid="bank-select">
                  <option value="">Choose…</option>
                  {banks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </label>
              <label className="fs-row"><span>Bank branch</span><input value={form.bankBranch} onChange={set('bankBranch')} placeholder="e.g. Kadapa Main" autoComplete="off" /></label>
              <label className="fs-row"><span>Designation</span><input value={form.designation} onChange={set('designation')} placeholder="e.g. Branch Manager" autoComplete="off" /></label>
            </div>
          </>
        )}

        <div className="fs-section">Details</div>
        <div className="fs-group">
          <label className="fs-row"><span>Full name</span><input value={form.name} onChange={set('name')} placeholder="Required" autoComplete="off" /></label>
          <label className="fs-row"><span>Mobile</span><input value={form.phone} onChange={set('phone')} placeholder={isBank ? 'Required, 10 digits' : '10 digits'} inputMode="numeric" autoComplete="off" /></label>
          {isBank && <label className="fs-row"><span>Email</span><input value={form.email} onChange={set('email')} placeholder="Optional" type="email" autoCapitalize="none" autoComplete="off" /></label>}
        </div>

        <div className="fs-section">Login</div>
        <div className="fs-group">
          <label className="fs-row"><span>Username</span><input value={form.username} onChange={set('username')} placeholder="e.g. ravi.kumar" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" /></label>
          <label className="fs-row">
            <span>Password</span>
            <input type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" />
            <button type="button" className="fs-icon" onClick={() => setForm((f) => ({ ...f, password: suggestPassword() }))} aria-label="Suggest a new password"><RefreshCw size={16} /></button>
            <button type="button" className="fs-icon" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </label>
        </div>
        <p className="fs-foot">
          {role === 'ADMIN'
            ? 'A Branch Admin manages only this branch: its cases, engineers, attendance and approvals.'
            : isBank
            ? 'This bank employee can send valuation requests to this GCR branch, follow their progress and download approved reports. They cannot see anything else.'
            : 'Share this login with the engineer. You can see it again anytime from their profile.'}
        </p>
      </form>
    </div>,
    document.body,
  );
}
