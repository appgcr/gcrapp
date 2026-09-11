import React from 'react';
import { UploadCloud, X, Camera, ScanLine } from 'lucide-react';

export default function Step4SiteImages({
  siteImages = [],
  setSiteImages,
  siteImageFileInputRef,
  handleSiteImageUpload,
  isCameraActive,
  startCamera,
  stopCamera,
  captureDocument,
  videoRef,
  setPreviewImage,
  handleRunSecurityExtraction
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <input
        ref={siteImageFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSiteImageUpload}
        style={{ display: 'none' }}
      />

      {!isCameraActive ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#0369a1', fontSize: '15px' }}>Live Site Capture & Photos</h4>
              <p style={{ margin: 0, color: '#0284c7', fontSize: '13px', lineHeight: '1.4' }}>
                Take live photos or upload property images from your device. All photos will be automatically watermarked with GPS coordinates and timestamps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => siteImageFileInputRef.current?.click()}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                backgroundColor: '#fff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                color: '#0369a1',
                fontWeight: '600'
              }}
            >
              <UploadCloud size={16} />
              <span>Upload Photos</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            {siteImages.map((img) => (
              <div key={img.id} onClick={() => setPreviewImage(img)} style={{ position: 'relative', width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <img src={img.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                  <span style={{ color: '#fde047', fontSize: '7px', fontWeight: '800', letterSpacing: '0.5px' }}>VERIFIED</span>
                  <span style={{ color: 'white', fontSize: '6px', marginTop: '1px' }}>Timestamped</span>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSiteImages(prev => prev.filter(i => i.id !== img.id)); 
                    if (img.url && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url); 
                  }} 
                  style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white', border: 'none', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
            
            <button 
              type="button"
              onClick={() => startCamera('SITE_IMAGES')} 
              style={{ width: '80px', height: '100px', borderRadius: '8px', border: '2px dashed var(--primary)', backgroundColor: 'rgba(0,82,204,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', gap: '4px' }}
            >
              <Camera size={24} strokeWidth={2.2} />
              <span style={{ fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>Take<br/>Photo</span>
            </button>

            <button
              type="button"
              onClick={() => siteImageFileInputRef.current?.click()}
              style={{
                width: '80px',
                height: '100px',
                borderRadius: '8px',
                border: '2px dashed #0284c7',
                backgroundColor: 'rgba(2,132,199,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#0284c7',
                gap: '4px'
              }}
            >
              <UploadCloud size={24} strokeWidth={2.2} />
              <span style={{ fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>Upload<br/>Photos</span>
            </button>
          </div>

          <button 
            type="button"
            className="btn-primary" 
            onClick={handleRunSecurityExtraction} 
            disabled={siteImages.length === 0} 
            style={{ opacity: siteImages.length === 0 ? 0.5 : 1, marginTop: 'auto' }}
          >
            <ScanLine size={18} /> Verify & Extract Documents
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600' }}>
              Capturing Site Image {siteImages.length + 1}
            </span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={16} color="#fff" />
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Live Camera View</span>
              </div>
              <button
                type="button"
                onClick={() => siteImageFileInputRef.current?.click()}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0052cc',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
                }}
              >
                <UploadCloud size={16} color="#0052cc" />
                <span>Or Upload From Device</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={captureDocument}
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              <Camera size={20} /> Capture Photo {siteImages.length + 1}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={stopCamera}>Cancel</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => siteImageFileInputRef.current?.click()}
                style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#f0f9ff',
                  borderColor: '#bae6fd',
                  color: '#0369a1',
                  fontWeight: '600',
                  padding: '10px'
                }}
              >
                <UploadCloud size={16} /> Upload Photo(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
