import React, { useState } from 'react';
import { Landmark, Zap, ShieldAlert, CheckCircle2, ExternalLink, HelpCircle, ChevronDown } from 'lucide-react';
import { INDIAN_BANKS } from '../EngineerPortal/EngineerPortal';

export default function DemoBankPortal({ approvedCases }) {
  const [selectedBank, setSelectedBank] = useState(INDIAN_BANKS[0]);
  const [formData, setFormData] = useState({
    borrowerName: '',
    bankBranch: INDIAN_BANKS[0],
    accountNo: '',
    estimationValue: '',
    surveyNo: '',
    doorNo: '',
    wardNo: '',
    locality: '',
    village: '',
    district: '',
    landArea: '',
    builtupArea: '',
    marketRate: '',
    taxAssessmentNo: '',
    taxAmount: '',
    planApprovalNo: '',
    planApprovalDate: '',
    valuerName: '',
    valuerRegNo: '',
    valuerPhone: '',
    gpsCoordinates: ''
  });

  const [isSimulatedAutoFilling, setIsSimulatedAutoFilling] = useState(false);

  const handleQuickDemoFill = () => {
    const caseToFill = approvedCases[0] || {
      borrowerName: "Smt. M. Sujatha, W/o. M. Venkata Subbaiah",
      bankBranch: selectedBank,
      accountNo: "111 461 837 79",
      estimationValue: "Rs 2,02,50,000/-",
      surveyNo: "740/20, 740/21",
      doorNo: "42/337-7-2-2",
      wardNo: "42",
      locality: "Bhagya Nagar Colony, Near Gurukul Vidyapeeth EM High School",
      village: "Chinnachowk Village Field",
      district: "Kadapa Municipal Corporation Of Y.S.R. (Dt)",
      landArea: "3200 Sq. Ft.",
      builtupArea: "4500 Sq. Ft. (Stilt+GF+FF+SF)",
      marketRate: "Rs 4,500 / Sq. Ft.",
      taxAssessmentNo: "1084920192",
      taxAmount: "Rs 14,500/-",
      planApprovalNo: "KMC/BLD/2025/8891",
      planApprovalDate: "15-04-2025",
      valuerName: "Er. G. Neelakanta Reddy",
      valuerRegNo: "Indian Institution of Valuers F – 13622",
      valuerPhone: "9440164412",
      gpsCoordinates: "14°28'04.4\"N 78°50'13.2\"E (14.467879, 78.836991)"
    };

    setIsSimulatedAutoFilling(true);
    setTimeout(() => {
      setFormData({
        ...caseToFill,
        bankBranch: selectedBank,
        locality: `${caseToFill.doorNo}, ${caseToFill.locality}`
      });
      setIsSimulatedAutoFilling(false);
      alert(`⚡ Auto-Fill Success! All 20+ property valuation fields populated instantly into [${selectedBank.split(' - ')[0]}].`);
    }, 600);
  };

  return (
    <div className="demo-bank-portal">
      {/* Instructions Banner */}
      <div className="extension-guide-banner glass-card">
        <div className="guide-icon">
          <Zap size={36} className="text-blue" />
        </div>
        <div className="guide-text">
          <h3>Phase 5: Chrome Extension Auto-Fill Live Testing (All 14 Banks)</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>This page simulates the official **Intranet Loan Valuation Portal** for all 14 major banks. Select any bank below to switch the portal theme and test auto-filling!</p>
          <div className="guide-methods">
            <div className="method-chip">
              <strong>Method A (Chrome Extension):</strong> Open our installed Chrome Extension popup, select an Approved Case, and click <em>"⚡ Auto-Fill into Bank Form"</em>.
            </div>
            <div className="method-chip">
              <strong>Method B (Quick In-App Demo):</strong> Click the button below to see the instant auto-fill magic right now!
            </div>
          </div>
        </div>
        <div className="guide-action">
          <button className="btn-primary quick-fill-btn" onClick={handleQuickDemoFill} disabled={isSimulatedAutoFilling}>
            <Zap size={20} />
            <span>{isSimulatedAutoFilling ? "⚡ Injecting Data..." : "⚡ Try Quick Auto-Fill Demo"}</span>
          </button>
        </div>
      </div>

      {/* Simulated Bank Form */}
      <div className="sbi-bank-form-card glass-card" style={{ marginTop: '32px' }}>
        <div className="sbi-form-header">
          <div className="sbi-logo-circle">{selectedBank.split('.')[1]?.trim().split(' ')[0] || "BANK"}</div>
          <div style={{ flex: 1 }}>
            <h2>{selectedBank.toUpperCase()} - LOAN PROCESSING PORTAL</h2>
            <p>Technical Property Valuation Verification & Panel Entry Form</p>
          </div>
          
          {/* Bank Selector Dropdown */}
          <div style={{ minWidth: '320px', position: 'relative' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '800' }}>
              Switch Bank Portal (14 Banks):
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={selectedBank}
                onChange={e => {
                  setSelectedBank(e.target.value);
                  setFormData(prev => ({ ...prev, bankBranch: e.target.value }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: 'var(--sbi-blue)',
                  backgroundColor: 'var(--bg-primary)',
                  border: '2px solid var(--sbi-blue)',
                  borderRadius: '8px',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                {INDIAN_BANKS.map((bankName, idx) => (
                  <option key={idx} value={bankName} style={{ color: 'var(--text-primary)' }}>
                    {bankName}
                  </option>
                ))}
              </select>
              <div style={{
                position: 'absolute',
                right: '8px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--sbi-blue)',
                color: 'white',
                width: '26px',
                height: '26px',
                borderRadius: '6px'
              }}>
                <ChevronDown size={16} strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={e => { e.preventDefault(); alert(`✅ Loan Valuation Form Submitted successfully to ${selectedBank} Core Banking System!`); }} className="sbi-form-body">
          <div className="form-section-header">1. Borrower & Loan Account Details</div>
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="borrowerName">Borrower / Applicant Name *</label>
              <input id="borrowerName" name="borrowerName" placeholder="Borrower Name" value={formData.borrowerName} onChange={e => setFormData({ ...formData, borrowerName: e.target.value })} />
            </div>

            {/* Form Bank Branch Dropdown */}
            <div className="form-group">
              <label htmlFor="bankBranch">Branch Name / RACPC (14 Banks) *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  id="bankBranch"
                  name="bankBranch"
                  value={formData.bankBranch}
                  onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 14px',
                    fontSize: '14px',
                    fontWeight: '700',
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {INDIAN_BANKS.map((bankName, idx) => (
                    <option key={idx} value={bankName}>{bankName}</option>
                  ))}
                </select>
                <div style={{
                  position: 'absolute',
                  right: '10px',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--sbi-blue)'
                }}>
                  <ChevronDown size={18} strokeWidth={3} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="accountNo">Loan Account Number *</label>
              <input id="accountNo" name="accountNo" placeholder="Account No" value={formData.accountNo} onChange={e => setFormData({ ...formData, accountNo: e.target.value })} />
            </div>
          </div>

          <div className="form-section-header">2. Property Location & Survey Identifiers</div>
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="surveyNo">Survey / Plot Numbers *</label>
              <input id="surveyNo" name="surveyNo" placeholder="Survey No" value={formData.surveyNo} onChange={e => setFormData({ ...formData, surveyNo: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="doorNo">Door / House Number *</label>
              <input id="doorNo" name="doorNo" placeholder="Door No" value={formData.doorNo} onChange={e => setFormData({ ...formData, doorNo: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="wardNo">Ward Number</label>
              <input id="wardNo" name="wardNo" placeholder="Ward No" value={formData.wardNo} onChange={e => setFormData({ ...formData, wardNo: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="property_address">Locality & Street Address *</label>
              <input id="property_address" name="property_address" placeholder="Locality Address" value={formData.locality} onChange={e => setFormData({ ...formData, locality: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="district">District & State *</label>
              <input id="district" name="district" placeholder="District" value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} />
            </div>
          </div>

          <div className="form-section-header">3. Technical Measurements & Valuation Rates</div>
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="landArea">Total Land Area (Extent) *</label>
              <input id="landArea" name="landArea" placeholder="Land Area" value={formData.landArea} onChange={e => setFormData({ ...formData, landArea: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="builtupArea">Total Built-up Area (Plinth) *</label>
              <input id="builtupArea" name="builtupArea" placeholder="Builtup Area" value={formData.builtupArea} onChange={e => setFormData({ ...formData, builtupArea: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="marketRate">Guideline / Market Rate *</label>
              <input id="marketRate" name="marketRate" placeholder="Market Rate" value={formData.marketRate} onChange={e => setFormData({ ...formData, marketRate: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="taxAssessmentNo">Property Tax Assessment No</label>
              <input id="taxAssessmentNo" name="taxAssessmentNo" placeholder="Tax Assessment No" value={formData.taxAssessmentNo} onChange={e => setFormData({ ...formData, taxAssessmentNo: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="taxAmount">Annual Tax Paid Amount</label>
              <input id="taxAmount" name="taxAmount" placeholder="Tax Amount" value={formData.taxAmount} onChange={e => setFormData({ ...formData, taxAmount: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="planApprovalNo">Building Plan Approval No</label>
              <input id="planApprovalNo" name="planApprovalNo" placeholder="Plan Approval No" value={formData.planApprovalNo} onChange={e => setFormData({ ...formData, planApprovalNo: e.target.value })} />
            </div>
          </div>

          <div className="form-section-header">4. Valuation Final Estimation & Valuer Sign-off</div>
          <div className="form-grid-3">
            <div className="form-group highlight-box" style={{ gridColumn: 'span 1' }}>
              <label htmlFor="estimationValue" style={{ color: '#0a192f', fontWeight: '800', fontSize: '13px' }}>FINAL ESTIMATION VALUE *</label>
              <input id="estimationValue" name="estimationValue" placeholder="Rs 0/-" style={{ fontSize: '20px', fontWeight: '900', color: '#0052cc', borderColor: '#0080ff' }} value={formData.estimationValue} onChange={e => setFormData({ ...formData, estimationValue: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="valuerName">Approved Panel Valuer Name *</label>
              <input id="valuerName" name="valuerName" placeholder="Valuer Name" value={formData.valuerName} onChange={e => setFormData({ ...formData, valuerName: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="valuerRegNo">Valuer Panel / License No *</label>
              <input id="valuerRegNo" name="valuerRegNo" placeholder="Reg No" value={formData.valuerRegNo} onChange={e => setFormData({ ...formData, valuerRegNo: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="gpsCoordinates">Geotagged Site GPS Coordinates *</label>
              <input id="gpsCoordinates" name="gpsCoordinates" placeholder="14°28'04.4 N, 78°50'13.2 E" value={formData.gpsCoordinates} onChange={e => setFormData({ ...formData, gpsCoordinates: e.target.value })} />
            </div>
          </div>

          <div className="form-submit-row" style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '18px' }}>
            <button type="button" className="btn-secondary" onClick={() => setFormData({})}>Reset Form</button>
            <button type="submit" className="btn-success" style={{ fontSize: '16px', padding: '16px 36px' }}>
              <CheckCircle2 size={22} />
              <span>Submit Valuation to {selectedBank.split(' - ')[0]} System</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
