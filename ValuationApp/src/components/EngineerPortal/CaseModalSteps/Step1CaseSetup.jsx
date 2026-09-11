import React from 'react';
import { User, Building, ChevronDown, ChevronRight } from 'lucide-react';

export default function Step1CaseSetup({
  clientName,
  setClientName,
  clientFatherName,
  setClientFatherName,
  bankName,
  setBankName,
  bankBranch,
  setBankBranch,
  bankDistrict,
  setBankDistrict,
  showBankDropdown,
  setShowBankDropdown,
  availableBanks = [],
  availableDistricts = [],
  handleAddCustomBank,
  handleNextToUpload
}) {
  const filteredBanks = availableBanks.filter(b =>
    b.toLowerCase().includes(bankName.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Client Name
        </label>
        <div style={{ position: 'relative' }}>
          <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
          <input 
            type="text" 
            placeholder="Enter client's full name"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            autoFocus
            style={{ width: '100%', padding: '16px 16px 16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Father's / Husband's Name
        </label>
        <div style={{ position: 'relative' }}>
          <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.5 }} />
          <input 
            type="text" 
            placeholder="S/o or W/o (Optional)"
            value={clientFatherName}
            onChange={e => setClientFatherName(e.target.value)}
            style={{ width: '100%', padding: '16px 16px 16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '24px', flex: 1, position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Bank / Institution Name
        </label>
        <div style={{ position: 'relative' }}>
          <Building size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
          <input 
            type="text" 
            placeholder="Search or type bank name..."
            value={bankName}
            onChange={e => {
              setBankName(e.target.value);
              setShowBankDropdown(true);
            }}
            onFocus={() => setShowBankDropdown(true)}
            onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
            style={{ width: '100%', padding: '16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
        
        {showBankDropdown && (filteredBanks.length > 0 || bankName.trim() !== '') && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50,
            maxHeight: '220px', overflowY: 'auto'
          }}>
            {filteredBanks.map(bank => (
              <div 
                key={bank}
                onClick={() => {
                  setBankName(bank);
                  setShowBankDropdown(false);
                }}
                onMouseDown={(e) => e.preventDefault()} 
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                  fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {bank}
              </div>
            ))}

            {bankName.trim() !== '' && !filteredBanks.some(b => b.toLowerCase() === bankName.toLowerCase()) && (
              <div 
                onClick={() => handleAddCustomBank(bankName)}
                onMouseDown={(e) => e.preventDefault()} 
                style={{ 
                  margin: '8px', padding: '12px', fontSize: '13px', color: '#0346c8', 
                  fontWeight: '700', cursor: 'pointer', textAlign: 'center', 
                  backgroundColor: '#eff6ff', borderRadius: '8px', 
                  border: '1px dashed #93c5fd', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
              >
                + Use "{bankName}" as custom bank
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Branch Name
          </label>
          <input 
            type="text" 
            placeholder="e.g. Police Lane Branch"
            value={bankBranch}
            onChange={e => setBankBranch(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
            District
          </label>
          <input 
            type="text" 
            placeholder="e.g. Kadapa, Y.S.R..."
            value={bankDistrict}
            onChange={e => setBankDistrict(e.target.value)}
            list="district-suggestions"
            style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          {availableDistricts.length > 0 && (
            <datalist id="district-suggestions">
              {availableDistricts.map(d => (
                <option key={d} value={d} />
              ))}
            </datalist>
          )}
        </div>
      </div>
      
      <button className="btn-primary" onClick={handleNextToUpload}>
        Next step <ChevronRight size={18} />
      </button>
    </div>
  );
}
