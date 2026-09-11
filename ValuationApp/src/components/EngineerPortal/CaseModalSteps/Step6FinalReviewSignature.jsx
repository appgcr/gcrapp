import React from 'react';
import { CheckSquare, Eye, UploadCloud, PenTool, ShieldAlert } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { getPageDisplayInfo } from './caseModalHelpers';

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
  handleCreateCase
}) {
  const totalDocPages = Object.values(uploadedDocs).flat().reduce((sum, p) => sum + (p.pageCount || 1), 0);

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
                  {propertyDetails.siteValue?.plinthArea || 'No Value'}
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

      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Digital Signature</h4>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <button 
            type="button"
            onClick={() => setActiveSignatureTab('draw')} 
            style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: activeSignatureTab === 'draw' ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: activeSignatureTab === 'draw' ? 'rgba(0,82,204,0.05)' : 'transparent', color: activeSignatureTab === 'draw' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            Draw Signature
          </button>
          <button 
            type="button"
            onClick={() => setActiveSignatureTab('upload')} 
            style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: activeSignatureTab === 'upload' ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: activeSignatureTab === 'upload' ? 'rgba(0,82,204,0.05)' : 'transparent', color: activeSignatureTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            Upload Signature
          </button>
        </div>

        {activeSignatureTab === 'draw' && (
          <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', backgroundColor: '#fff', position: 'relative', height: '150px' }}>
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="black"
              canvasProps={{ style: { width: '100%', height: '100%', borderRadius: '12px' }, className: 'sigCanvas' }}
              onEnd={() => {
                if (sigCanvas.current && typeof sigCanvas.current.getTrimmedCanvas === 'function') {
                  setSignatureDataUrl(sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'));
                }
              }}
            />
            <button 
              type="button"
              onClick={() => { 
                if (sigCanvas.current && typeof sigCanvas.current.clear === 'function') {
                  sigCanvas.current.clear(); 
                }
                setSignatureDataUrl(null); 
              }} 
              style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}

        {activeSignatureTab === 'upload' && (
          <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', backgroundColor: '#f8fafc', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSignatureUploadUrl(URL.createObjectURL(e.target.files[0]));
                }
              }} 
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
            />
            {signatureUploadUrl ? (
              <img src={signatureUploadUrl} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <UploadCloud size={24} style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '13px', fontWeight: '600' }}>Tap to upload signature image</div>
              </div>
            )}
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
          try {
            if (activeSignatureTab === 'draw') {
              if (sigCanvas.current && typeof sigCanvas.current.isEmpty === 'function' && !sigCanvas.current.isEmpty()) {
                const canvas = sigCanvas.current.getCanvas();
                setSignatureDataUrl(canvas.toDataURL('image/png'));
                setShowSubmitModal(true);
              } else {
                toast.error("Please draw your signature before submitting.");
              }
            } else {
              if (!signatureUploadUrl) {
                toast.error("Please upload your signature before submitting.");
              } else {
                setShowSubmitModal(true);
              }
            }
          } catch (err) {
            toast.error("Error capturing signature: " + err.message);
            console.error(err);
          }
        }} 
        disabled={!termsAccepted}
        style={{ opacity: !termsAccepted ? 0.5 : 1, marginTop: 'auto' }}
      >
        <PenTool size={18} /> Sign & Submit Application
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
