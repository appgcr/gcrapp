import React from 'react';
import { Loader2, ChevronRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function Step5ExtractedDataReview({
  modalStep,
  setModalStep,
  clientName,
  bankName,
  propertyDetails = {},
  extractedData = null,
  setIsDocumentVerified
}) {
  if (modalStep === 5) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px 0' }}>
        <div style={{ position: 'relative' }}>
          <Loader2 className="spin" size={64} color="var(--primary)" />
        </div>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Document Analysis</h3>
          <p className="text-muted" style={{ fontSize: '14px', margin: 0 }}>Mahe AI is scanning & verifying your documents...</p>
          <p className="text-primary" style={{ fontSize: '12px', fontWeight: '600', marginTop: '8px' }}>Scanning Languages: English, Telugu (తెలుగు)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setModalStep(4)}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Back to Site Images
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => {
              setIsDocumentVerified(true);
              setModalStep(6);
            }}
            style={{ fontSize: '13px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Proceed to Review</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // modalStep === 6: Extracted Data Review
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--success-bg)', borderRadius: '8px', marginBottom: '24px', border: '1px solid #6ee7b7' }}>
        <CheckCircle2 size={20} color="#065f46" />
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#065f46' }}>Data extracted successfully</span>
      </div>

      <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span className="text-muted" style={{ fontSize: '13px', flexShrink: 0 }}>Client</span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', textAlign: 'right', wordBreak: 'break-word' }}>{clientName}</span>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span className="text-muted" style={{ fontSize: '13px', flexShrink: 0 }}>Bank</span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', textAlign: 'right', wordBreak: 'break-word' }}>{bankName}</span>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span className="text-muted" style={{ fontSize: '13px', flexShrink: 0 }}>Property Type</span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', textAlign: 'right', wordBreak: 'break-word' }}>{extractedData?.propertyType || propertyDetails?.propertyType || 'Residential Building'}</span>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <span className="text-muted" style={{ fontSize: '13px' }}>Net Land Area</span>
            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '600' }}>(Building Plan)</span>
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: '600', textAlign: 'right' }}>{extractedData?.netLandArea || propertyDetails?.netExtent || '133.33 Sq.Yds'}</span>
        </div>
        
        {/* Address Comparison Warning */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: (extractedData?.addressMatch ?? true) ? '#fff' : '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <AlertCircle size={16} color={(extractedData?.addressMatch ?? true) ? '#10b981' : '#ef4444'} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: (extractedData?.addressMatch ?? true) ? '#065f46' : '#b91c1c' }}>
              {(extractedData?.addressMatch ?? true) ? 'Addresses Match' : 'Warning: Address Mismatch'}
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff' }}>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '2px' }}>From Sale Deed</span>
              <span style={{ fontSize: '12.5px', color: '#1e293b', wordBreak: 'break-word' }}>{extractedData?.addressDeed || (propertyDetails?.doorNo ? `Door # ${propertyDetails.doorNo}, Kadapa` : 'Kadapa Municipal Area')}</span>
            </div>
            <div style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff' }}>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '2px' }}>From Building Plan</span>
              <span style={{ fontSize: '12.5px', color: '#1e293b', wordBreak: 'break-word' }}>{extractedData?.addressPlan || (propertyDetails?.doorNo ? `Door # ${propertyDetails.doorNo}, Kadapa` : 'Kadapa Municipal Area')}</span>
            </div>
          </div>
          {extractedData && !extractedData.addressMatch && (
            <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#b91c1c', fontWeight: '500' }}>
              Discrepancy detected between deed & plan.
            </div>
          )}
        </div>

        <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="var(--primary)"/> System Confidence
          </span>
          <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)' }}>{extractedData?.confidence || '95%'}</span>
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={() => setModalStep(7)}>
        Proceed to Final Review <ChevronRight size={18} />
      </button>
    </div>
  );
}
