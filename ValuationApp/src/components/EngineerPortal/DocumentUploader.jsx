import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Eye } from 'lucide-react';

const DOC_TYPES = [
  { id: 'registration', title: '1. Registration Deed (Sale Deed)', desc: 'Title Deed / Owners Proof & Extent Verification', icon: '📜' },
  { id: 'planApproval', title: '2. Municipal / Panchayat Building Plan Approval', desc: 'Approved B.A. Number & Construction Permission', icon: '🏛️' },
  { id: 'marketValue', title: '3. Guideline / Market Value Rate Certificate', desc: 'Sub-Registrar Office Guideline Value Rate', icon: '📈' },
  { id: 'propertyTax', title: '4. Property Tax Paid Receipt', desc: 'Latest Municipal / Panchayat Tax Receipt Assessment', icon: '🧾' },
  { id: 'locationMap', title: '5. Hand-drawn Site Sketch / Location Map', desc: 'Field Sketch with Demarcated Boundaries & Landmarks', icon: '🗺️' }
];

export default function DocumentUploader({ uploadedDocs, onUploadDoc, onExtractData, isExtracting }) {
  const [selectedPreview, setSelectedPreview] = useState(null);

  const handleFileChange = (docId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onUploadDoc(docId, reader.result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const allUploaded = DOC_TYPES.every(doc => uploadedDocs[doc.id]?.url);

  return (
    <div className="doc-uploader-section">
      <div className="section-header-box">
        <div>
          <h3>Phase 1: Mandatory Document Upload & AI OCR Extraction</h3>
          <p>Upload scans or field photos of the 5 required documents. Our AI engine will auto-extract borrower, survey, tax, and valuation rates.</p>
        </div>
        <button
          className="btn-primary"
          onClick={onExtractData}
          disabled={isExtracting}
        >
          {isExtracting ? (
            <>
              <RefreshCw className="spin" size={18} />
              <span>⚡ AI OCR Scanning Documents...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <span>Auto-Extract Data according to Documents</span>
            </>
          )}
        </button>
      </div>

      <div className="doc-grid">
        {DOC_TYPES.map(doc => {
          const docData = uploadedDocs[doc.id];
          return (
            <div key={doc.id} className={`doc-card glass-card ${docData?.url ? 'uploaded' : ''}`}>
              <div className="doc-card-header">
                <span className="doc-icon">{doc.icon}</span>
                <div className="doc-titles">
                  <h4>{doc.title}</h4>
                  <p>{doc.desc}</p>
                </div>
              </div>

              <div className="doc-card-body">
                {docData?.url ? (
                  <div className="preview-container">
                    <img src={docData.url} alt={doc.title} className="doc-thumbnail" />
                    <div className="preview-overlay">
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> Ready
                      </span>
                      <button className="view-btn" onClick={() => setSelectedPreview({ ...docData, title: doc.title })}>
                        <Eye size={16} /> View
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="upload-dropzone">
                    <Upload size={28} className="upload-icon" />
                    <span>Click or Tap to Upload Photo</span>
                    <small>Supports JPG, PNG, PDF scans</small>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileChange(doc.id, e)}
                    />
                  </label>
                )}
              </div>

              {docData?.url && (
                <div className="doc-card-footer">
                  <span className="filename" title={docData.name}>{docData.name}</span>
                  <label className="change-link">
                    Change
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileChange(doc.id, e)}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Preview */}
      {selectedPreview && (
        <div className="modal-backdrop" onClick={() => setSelectedPreview(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h4>{selectedPreview.title}</h4>
              <button className="close-btn" onClick={() => setSelectedPreview(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img src={selectedPreview.url} alt="Document Preview" style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '12px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
