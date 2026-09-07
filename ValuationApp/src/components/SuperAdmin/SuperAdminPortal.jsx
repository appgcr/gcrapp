import React, { useState } from 'react';
import { UserPlus, Users, Trash2, Key, ShieldCheck, CheckCircle2, Phone, Building, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { INDIAN_BANKS } from '../EngineerPortal/EngineerPortal';
import toast from 'react-hot-toast';

export default function SuperAdminPortal({ users, onCreateUser, onDeleteUser }) {
  const [showModal, setShowModal] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    licenseNo: 'Indian Institution of Valuers F – ',
    branch: INDIAN_BANKS[0],
    role: 'ENGINEER'
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const newUser = {
      ...formData,
      id: `ENG-${String(Math.floor(Math.random() * 900) + 100)}`,
      createdAt: new Date().toLocaleDateString('en-IN'),
      status: 'Active'
    };

    try {
      const response = await fetch('https://gcr-9ys1.onrender.com/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (!response.ok) {
        throw new Error('Failed to create user. Username might already exist.');
      }

      if (onCreateUser) onCreateUser(newUser);
      setShowModal(false);
      setFormData({
        name: '',
        username: '',
        password: '',
        phone: '',
        licenseNo: 'Indian Institution of Valuers F – ',
        branch: INDIAN_BANKS[0],
        role: 'ENGINEER'
      });
      toast.success(`Field Engineer account [${newUser.username}] created successfully in MongoDB Database!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const togglePasswordVisibility = (username) => {
    setShowPasswords(prev => ({ ...prev, [username]: !prev[username] }));
  };

  return (
    <div className="super-admin-portal">
      {/* Header Banner */}
      <div className="super-admin-header glass-card">
        <div className="sa-title-area">
          <div className="sa-icon-box">
            <ShieldCheck size={36} />
          </div>
          <div>
            <h2>👑 Super Admin: Engineer Credential & User Management</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Create, view, and manage login passwords and branch assignments for all panel field valuation engineers.
            </p>
          </div>
        </div>

        <button className="btn-primary create-eng-btn" onClick={() => setShowModal(true)}>
          <UserPlus size={20} />
          <span>+ Create Engineer Login</span>
        </button>
      </div>

      {/* Engineers List Table */}
      <div className="admin-table-container glass-card" style={{ marginTop: '28px' }}>
        <div className="section-header-box" style={{ padding: '8px 8px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <div>
            <h3>Registered Users & Engineers ({users.length})</h3>
            <p style={{ fontSize: '13px' }}>All active credentials authorized to access the SBI Valuation Portal.</p>
          </div>
          <span className="badge badge-success">● Intranet Security Active</span>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Full Name & License</th>
              <th>Username (Login ID)</th>
              <th>Assigned Password</th>
              <th>Phone Number</th>
              <th>Assigned Bank Branch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.username}>
                <td>
                  <span className={`badge ${u.role === 'SUPER_ADMIN' ? 'badge-blue' : 'badge-success'}`}>
                    {u.role === 'SUPER_ADMIN' ? '👑 Super Admin' : '👷 Engineer'}
                  </span>
                </td>
                <td>
                  <strong>{u.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.licenseNo || "Chief Panel Authority"}</div>
                </td>
                <td><strong style={{ color: 'var(--sbi-blue)', fontSize: '15px' }}>{u.username}</strong></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '14px' }}>
                      {showPasswords[u.username] ? u.password : '••••••••'}
                    </code>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(u.username)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Show/Hide Password"
                    >
                      {showPasswords[u.username] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </td>
                <td>{u.phone || "9440164412"}</td>
                <td style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.branch || "All Branches"}
                </td>
                <td>
                  <span className="status-tag approved">● Active</span>
                </td>
                <td>
                  {u.role !== 'SUPER_ADMIN' && (
                    <button
                      className="delete-btn"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete engineer login "${u.username}"?`)) {
                          onDeleteUser(u.username);
                        }
                      }}
                      title="Delete Engineer Account"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Engineer Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Create New Field Engineer Credentials</h4>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-body form-grid-2" style={{ gap: '18px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Engineer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Er. K. Suresh Kumar"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Login Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. suresh_val"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Assign Login Password *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. suresh123"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Valuer Panel License No *</label>
                <input
                  type="text"
                  required
                  value={formData.licenseNo}
                  onChange={e => setFormData({ ...formData, licenseNo: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Assigned Bank & Branch (14 Banks Available) *</label>
                <select
                  value={formData.branch}
                  onChange={e => setFormData({ ...formData, branch: e.target.value })}
                >
                  {INDIAN_BANKS.map((b, i) => (
                    <option key={i} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '14px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
                  <UserPlus size={18} />
                  <span>Create Engineer Login</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
