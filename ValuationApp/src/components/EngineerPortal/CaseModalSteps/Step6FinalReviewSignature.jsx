import React, { useMemo } from 'react';
import { CheckSquare, Eye, UploadCloud, PenTool, ShieldAlert, Coins, TrendingDown, Building, ShieldCheck } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { getPageDisplayInfo } from './caseModalHelpers';
import { calculateValuation } from '../../../utils/valuationCalculator';

export default function Step6FinalReviewSignature({
  clientName,
  bankName,
  propertyDetails = {},
  uploadedDocs = {},
  siteImages = [],
  showSummaryDocs,
  setShowSummaryDocs,
  showSummaryImages,
  setShowSummaryImages,
  setPreviewImage,
  setModalStep,
  activeSignatureTab,
  setActiveSignatureTab,
  sigCanvas,
  signatureUploadUrl,
  setSignatureUploadUrl,
  setSignatureDataUrl,
  termsAccepted,
  setTermsAccepted,
  showSubmitModal,
  setShowSubmitModal,
  handleCreateCase,
  onReviewReport,
  savedSignature = '',
  bankValues
}) {
  const [applySignature, setApplySignature] = React.useState(false);
  const totalDocPages = Object.values(uploadedDocs).flat().reduce((sum, p) => sum + (p.pageCount || 1), 0);

  const valSummary = useMemo(() => {
    const v = calculateValuation({ ...propertyDetails, bankName }) || {};
    // The quick on-device estimate may not have every figure (e.g. bank % not known here)
    return typeof v.fairMarketValue === 'number' ? v : null;
  }, [propertyDetails, bankName]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={16} /> Application Summary
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', gap: '8px' }}>
            <span className="text-muted" style={{ flexShrink: 0 }}>Client & Bank:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, justifyContent: 'flex-end' }}>
              <span style={{ fontWeight: '600', textAlign: 'right', wordBreak: 'break-word' }}>
                {clientName}<br/>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bankName}</span>
              </span>
              <button 
                type="button"
                onClick={() => setModalStep(1)} 
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: 'var(--primary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', flexShrink: 0 }}
              >
                Edit
              </button>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span className="text-muted">Legal Documents:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>
                  {totalDocPages} Page{totalDocPages > 1 ? 's' : ''}
                </span>
                <button 
                  type="button"
                  onClick={() => setShowSummaryDocs(!showSummaryDocs)} 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
                >
                  Preview
                </button>
                <button 
                  type="button"
                  onClick={() => setModalStep(2)} 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
                >
                  Edit
                </button>
              </div>
            </div>
            {showSummaryDocs && Object.values(uploadedDocs).flat().length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {Object.values(uploadedDocs).flat().map((page, idx) => {
                  const info = getPageDisplayInfo(page, idx);
                  return (
                    <div 
                      key={page.id || idx} 
                      onClick={() => setPreviewImage(page)} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '6px 10px', 
                        backgroundColor: '#f8fafc', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        cursor: 'pointer' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{ 
                          backgroundColor: info.isPdf ? '#fee2e2' : '#e0e7ff', 
                          color: info.isPdf ? '#dc2626' : '#4338ca', 
                          fontSize: '9px', 
                          fontWeight: '700', 
                          padding: '1px 5px', 
                          borderRadius: '3px' 
                        }}>
                          {info.ext}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {info.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, fontSize: '11px', color: '#64748b' }}>
                        {info.isPdf && (page.pageCount || 1) > 1 && (
                          <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '10px', backgroundColor: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                            {page.pageCount} Pages
                          </span>
                        )}
                        {info.size && <span>{info.size}</span>}
                        <Eye size={13} color="var(--primary)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <span className="text-muted">Property Details:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '600', textAlign: 'right' }}>
                {propertyDetails.propertyType || 'Residential'}<br/>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {propertyDetails.siteValue?.plinthArea ? `Plinth ${propertyDetails.siteValue.plinthArea} sft` : (propertyDetails.netExtent || propertyDetails.totalExtent || propertyDetails.landArea) ? `Extent ${propertyDetails.netExtent || propertyDetails.totalExtent || propertyDetails.landArea}` : (propertyDetails.roadWidth ? `Road ${propertyDetails.roadWidth} ft` : '')}
                </span>
              </span>
              <button 
                type="button"
                onClick={() => setModalStep(3)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
              >
                Edit
              </button>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span className="text-muted">Site Images:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{siteImages.length} Photos</span>
                <button 
                  type="button"
                  onClick={() => setShowSummaryImages(!showSummaryImages)} 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
                >
                  Preview
                </button>
                <button 
                  type="button"
                  onClick={() => setModalStep(4)} 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
                >
                  Edit
                </button>
              </div>
            </div>
            {showSummaryImages && siteImages.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {siteImages.map((img) => (
                  <div key={img.id} onClick={() => setPreviewImage(img)} style={{ width: '40px', height: '50px', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                    <img src={img.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The bank's own report calculates the values — show exactly its figures */}
      {bankValues ? (
        <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={16} /> Values in the {bankName} report
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[['Fair Market Value', bankValues.fairMarketValue, '#166534'], ['Realizable Value', bankValues.realizableValue, '#1e40af'], ['Distress Value', bankValues.distressSaleValue, '#92400e']].map(([label, v, color]) => (
              <div key={label} style={{ padding: '10px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7', minWidth: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>{label}</span>
                <div style={{ fontSize: '17px', fontWeight: '800', color }}>₹{Number(v || 0).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#4b5563' }}>Sign below — you’ll see the full bank report before it is submitted.</p>
        </div>
      ) : !valSummary ? (
        <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={16} /> Values are calculated in the bank report — you’ll see them after signing.
        </div>
      ) : (
      <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={16} /> Valuation Assessment Summary
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7' }}>
            <span style={{ fontSize: '11px', color: '#4b5563' }}>Land Value:</span>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d' }}>
              ₹{valSummary.landValue.toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              {valSummary.netExtentSqYards} Sq. Yds @ ₹{valSummary.landRate.toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7' }}>
            <span style={{ fontSize: '11px', color: '#4b5563' }}>Net Structure:</span>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d' }}>
              ₹{valSummary.netStructureValue.toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              Depr: {valSummary.depreciationPercent}% ({valSummary.buildingAge} yrs)
            </span>
          </div>

          <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dcfce7' }}>
            <span style={{ fontSize: '11px', color: '#4b5563' }}>Proposed additions:</span>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#c2410c' }}>
              ₹{(valSummary.proposedAdditionsValue || 0).toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Estimate only · not in market value</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px dashed #86efac' }}>
          <div style={{ flex: 1, minWidth: '130px', padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#166534' }}>Fair Market Value</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#14532d' }}>
              ₹{valSummary.fairMarketValue.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '130px', padding: '8px 12px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#0369a1' }}>Realizable Value (90%)</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#075985' }}>
              ₹{valSummary.realizableValue.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '130px', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#92400e' }}>Distress Sale Value</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#78350f' }}>
              ₹{valSummary.distressSaleValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      )}

      <div style={{ marginBottom: '24px' }} data-testid="final-signature">
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Digital Signature</h4>
        {savedSignature ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '12px', border: applySignature ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: applySignature ? 'rgba(0,82,204,0.04)' : '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={applySignature} onChange={e => setApplySignature(e.target.checked)} style={{ width: '22px', height: '22px', cursor: 'pointer' }} data-testid="apply-signature" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Apply my digital signature to this report</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Saved in Settings → Digital Signature</div>
            </div>
            <img src={savedSignature} alt="Your signature" style={{ height: '48px', maxWidth: '120px', objectFit: 'contain', background: '#fff', borderRadius: '6px' }} />
          </label>
        ) : (
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', fontSize: '13px', color: '#991b1b', lineHeight: 1.45 }}>
            You have no digital signature saved. Open <strong>Settings → Digital Signature</strong>, save your signature, then come back to this case (your work here is kept as a draft).
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(234, 179, 8, 0.05)', borderRadius: '12px', border: '1px solid #fef08a' }}>
        <input 
          type="checkbox" 
          id="terms" 
          checked={termsAccepted} 
          onChange={(e) => setTermsAccepted(e.target.checked)} 
          style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }}
        />
        <label htmlFor="terms" style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--text-primary)', cursor: 'pointer' }}>
          I have thoroughly reviewed all submitted data and documents. I hereby declare that the information provided is correct to the best of my knowledge and belief, and I agree to all terms and conditions of the valuation policy.
        </label>
      </div>

      <button 
        type="button"
        className="btn-primary" 
        onClick={() => {
          if (!savedSignature) { toast.error('Save your digital signature in Settings first.'); return; }
          if (!applySignature) { toast.error('Tick “Apply my digital signature” to sign this report.'); return; }
          setSignatureDataUrl(savedSignature);
          // Preview the finished bank report with the signature; submit from the preview
          if (onReviewReport) onReviewReport(savedSignature); else setShowSubmitModal(true);
        }} 
        disabled={!termsAccepted || !savedSignature || !applySignature}
        style={{ opacity: (!termsAccepted || !savedSignature || !applySignature) ? 0.5 : 1, marginTop: 'auto' }}
        data-testid="preview-submit"
      >
        <PenTool size={18} /> {onReviewReport ? 'Preview Report & Submit' : 'Sign & Submit Application'}
      </button>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
          <ShieldAlert size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>Are you sure you want to submit?</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px', lineHeight: '1.5' }}>
            By clicking "Yes", this application will be digitally signed and securely submitted to the Admin Portal. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { setShowSubmitModal(false); handleCreateCase(); }}>Yes, Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}
