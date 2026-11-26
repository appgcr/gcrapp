import { searchBanks } from '../../../utils/banks';
import React from 'react';
import { User, Building, ChevronDown, ChevronRight, Lock, UserPlus, X } from 'lucide-react';

export default function Step1CaseSetup({
  top = null, // route choice + "Tell customer": scrolls with the form instead of staying pinned
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
  bankRecords = [],
  availableDistricts = [],
  handleAddCustomBank,
  handleNextToUpload,
  propertyTypes = [],
  propertyType = '',
  setPropertyType = () => {},
  lockedFields = {},
  coOwners = [],
  setCoOwners = () => {},
  maxCoOwners = 5,
  officeName = ''          // the engineer's own office (Kadapa, Proddatur…), for its bank branches first
}) {
  const lockStyle = { backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', cursor: 'not-allowed' };
  const LockNote = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
      <Lock size={12} /> Set by your admin
    </div>
  );
  // Branches of the chosen bank (Settings → Banks), offered as suggestions
  const chosenBank = bankRecords.find(b => b.name === bankName);
  const bankBranchOptions = chosenBank?.branches || [];
  // Chips: this engineer's own office first (Kadapa / Proddatur / Vempalle…) plus branches for every office;
  // other towns' branches stay behind "Other towns"
  const [moreTowns, setMoreTowns] = React.useState(false);
  const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const groups = (chosenBank?.officeBranches || []).filter((g) => (g.names || []).length);
  const filed = new Set(groups.flatMap((g) => g.names).map(normName));
  const ownGroup = officeName ? groups.find((g) => normName(g.office) === normName(officeName)) : null;
  const everyOffice = bankBranchOptions.filter((b) => !filed.has(normName(b)));   // names for every office
  const myChips = !groups.length ? bankBranchOptions : [...(ownGroup ? ownGroup.names : []), ...everyOffice];
  const otherTowns = groups.filter((g) => g !== ownGroup);
  const showOtherTowns = moreTowns || (myChips.length === 0 && otherTowns.length > 0);
  const setShowOtherTowns = setMoreTowns;
  const filteredBanks = (bankRecords.length ? searchBanks(bankRecords, bankName).map(b => b.name)
    : availableBanks.filter(b => b.toLowerCase().includes(bankName.toLowerCase())));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {top}
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
            readOnly={!!lockedFields.clientName}
            autoFocus={!lockedFields.clientName}
            style={{ width: '100%', padding: '16px 16px 16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', ...(lockedFields.clientName ? lockStyle : {}) }}
          />
        </div>
        {lockedFields.clientName && <LockNote />}
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

      {/* Joint owners: the property may belong to several people; every one is printed in the bank report */}
      <div style={{ marginBottom: '20px' }}>
        {coOwners.map((o, i) => (
          <div key={i} style={{ border: '1.5px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px', marginBottom: '10px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Owner {i + 2}</span>
              <button type="button" aria-label={`Remove owner ${i + 2}`} onClick={() => setCoOwners(coOwners.filter((_, j) => j !== i))}
                style={{ border: 0, background: 'transparent', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}>
                <X size={15} /> Remove
              </button>
            </div>
            <input type="text" placeholder="Owner's full name" value={o.name} autoFocus={!o.name}
              onChange={(e) => setCoOwners(coOwners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: '8px' }} />
            <input type="text" placeholder="S/o or W/o (Optional)" value={o.rel}
              onChange={(e) => setCoOwners(coOwners.map((x, j) => (j === i ? { ...x, rel: e.target.value } : x)))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
        ))}
        {coOwners.length < maxCoOwners && (
          <button type="button" onClick={() => setCoOwners([...coOwners, { name: '', rel: '' }])}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '12px', border: '1.5px dashed var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <UserPlus size={17} /> {coOwners.length ? 'Add another owner' : 'Add joint owner'}
          </button>
        )}
        {coOwners.length > 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>All {coOwners.length + 1} owners are printed in the bank report.</div>}
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
              if (lockedFields.bankName) return;
              setBankName(e.target.value);
              setShowBankDropdown(true);
            }}
            readOnly={!!lockedFields.bankName}
            onFocus={() => { if (!lockedFields.bankName) setShowBankDropdown(true); }}
            onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
            style={{ width: '100%', padding: '16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', ...(lockedFields.bankName ? lockStyle : {}) }}
          />
          {lockedFields.bankName
            ? <Lock size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            : <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />}
        </div>
        {lockedFields.bankName && <LockNote />}
        
        {!lockedFields.bankName && showBankDropdown && (filteredBanks.length > 0 || bankName.trim() !== '') && (
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

            {bankName.trim() !== '' && filteredBanks.length === 0 && (
              <div style={{ margin: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                “{bankName.trim()}” isn’t in the bank list. Ask the Super Admin to add it.
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
            readOnly={!!lockedFields.bankBranch}
            list={!lockedFields.bankBranch && bankBranchOptions.length ? 'bank-branch-suggestions' : undefined}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', ...(lockedFields.bankBranch ? lockStyle : {}) }}
          />
          {lockedFields.bankBranch && <LockNote />}
          {/* The bank's branches (Settings → Banks) as one-tap chips — the typing suggestions alone are easy to miss on phones */}
          {!lockedFields.bankBranch && bankBranchOptions.length > 0 && (() => {
            const chip = (b) => {
              const on = bankBranch.trim().toLowerCase() === b.toLowerCase();
              return (
                <button key={b} type="button" aria-pressed={on} onClick={() => setBankBranch(on ? '' : b)}
                  style={{ border: `1.5px solid ${on ? '#2563eb' : 'var(--border-color)'}`, background: on ? '#2563eb' : 'var(--bg-card)', color: on ? '#fff' : 'var(--text-primary)',
                    borderRadius: '999px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {b}
                </button>
              );
            };
            const linkStyle = { border: 0, background: 'transparent', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '6px 4px', fontFamily: 'inherit' };
            return (
              <div style={{ marginTop: '8px' }}>
                <div role="group" aria-label="Branches of this bank" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {myChips.map(chip)}
                  {!showOtherTowns && otherTowns.length > 0 && (
                    <button type="button" style={linkStyle} onClick={() => setShowOtherTowns(true)}>Other towns ›</button>
                  )}
                </div>
                {showOtherTowns && otherTowns.map((g) => (
                  <div key={g.office} style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: '6px' }}>{g.office}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{g.names.map(chip)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          {bankBranchOptions.length > 0 && (
            <datalist id="bank-branch-suggestions">
              {bankBranchOptions.map(b => <option key={b} value={b} />)}
            </datalist>
          )}
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
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Report Type (Property Category) <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          data-testid="step1-property-type"
          value={propertyType}
          onChange={e => setPropertyType(e.target.value)}
          style={{ width: '100%', padding: '14px 12px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '15px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
        >
          <option value="">Select the report type…</option>
          {propertyTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
        </select>
      </div>

      <button className="btn-primary" onClick={handleNextToUpload}>
        Next step <ChevronRight size={18} />
      </button>
    </div>
  );
}
