import { MAX_SITE_PHOTOS } from '../../../utils/sitePhotos';
import React from 'react';
import usePhotoLabels from './usePhotoLabels';
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
  handleRunSecurityExtraction,
  propertyType = '',
  needSelfie = false,
  siteSelfie = null,
  onTakeSelfie,
  onRemoveSelfie,
  selfieCamera = false,
}) {
  const { labels, missing, busy: labelling } = usePhotoLabels(siteImages, propertyType);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overscrollBehavior: 'contain' }}>
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
                Take photos at the site (up to {MAX_SITE_PHOTOS}). Each photo is stamped with its real GPS location, address, date and time. Gallery photos need the phone's own location record. <strong>{siteImages.length} / {MAX_SITE_PHOTOS}</strong> added.
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

          {siteImages.length > 0 && (
            <div className={`phl ${missing && missing.length === 0 ? 'ok' : ''}`}>
              {labelling && !missing ? 'Mahe AI is sorting your photos…'
                : missing === null ? null
                : missing.length === 0 ? '✓ All key photos are here.'
                : <>Still needed: <b>{missing.map(m => m.label).join(', ')}</b></>}
              {labelling && missing && <span className="phl-dot"> · checking…</span>}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            {siteImages.map((img) => (
              <div key={img.id} onClick={() => setPreviewImage(img)} style={{ position: 'relative', width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <img src={img.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {labels[img.id] && <span className="phl-tag">{labels[img.id].label}</span>}
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
            
            {siteImages.length < MAX_SITE_PHOTOS && (<>
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
            </>)}
          </div>

          <style>{`
            .phl { margin: -12px 0 14px; padding: 9px 12px; border-radius: 10px; background: #fff7ed; border: 1px solid #fed7aa; font-size: 12.5px; color: #9a3412; }
            .phl:empty { display: none; }
            .phl.ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 700; }
            .phl-dot { color: #94a3b8; font-weight: 400; }
            .phl-tag { position: absolute; top: 3px; left: 3px; right: 22px; background: rgba(37,99,235,.92); color: #fff; font-size: 8.5px; font-weight: 800; padding: 2px 4px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
          `}</style>
          {needSelfie && (
            <div className={`sfy ${siteSelfie ? 'ok' : ''}`}>
              {siteSelfie ? (
                <>
                  <button type="button" className="sfy-img" onClick={() => setPreviewImage && setPreviewImage({ url: siteSelfie.url, name: 'Selfie at the site' })}><img src={siteSelfie.url} alt="Your selfie at the site" /></button>
                  <div className="sfy-t"><b>Selfie at the site ✓</b><small>Stamped with location and time</small></div>
                  <button type="button" className="sfy-b ghost" onClick={onRemoveSelfie}>Retake</button>
                </>
              ) : (
                <>
                  <div className="sfy-t"><b>Your selfie at the site</b><small>Required. Stand at the property; the front camera opens.</small></div>
                  <button type="button" className="sfy-b" onClick={onTakeSelfie}><Camera size={16} /> Take selfie</button>
                </>
              )}
              <style>{`
                .sfy { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1.5px dashed #f59e0b; background: #fffbeb; margin-bottom: 14px; }
                .sfy.ok { border-style: solid; border-color: #bbf7d0; background: #f0fdf4; }
                .sfy-img { width: 52px; height: 52px; border-radius: 10px; overflow: hidden; border: 0; padding: 0; flex-shrink: 0; cursor: pointer; }
                .sfy-img img { width: 100%; height: 100%; object-fit: cover; }
                .sfy-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                .sfy-t b { font-size: 14.5px; color: #0f172a; } .sfy-t small { font-size: 12px; color: #64748b; }
                .sfy-b { display: inline-flex; align-items: center; gap: 6px; border: 0; background: #2563eb; color: #fff; border-radius: 10px; padding: 10px 13px; font-weight: 800; font-size: 13.5px; cursor: pointer; font-family: inherit; flex-shrink: 0; }
                .sfy-b.ghost { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
              `}</style>
            </div>
          )}
          <button 
            type="button"
            className="btn-primary" 
            onClick={handleRunSecurityExtraction} 
            disabled={siteImages.length === 0 || (needSelfie && !siteSelfie)} 
            style={{ opacity: siteImages.length === 0 || (needSelfie && !siteSelfie) ? 0.5 : 1, marginTop: 'auto' }}
          >
            <ScanLine size={18} /> Continue to Signature & Submit
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600' }}>
              {selfieCamera ? 'Your selfie at the site' : `Capturing Site Image ${siteImages.length + 1}`}
            </span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: selfieCamera ? 'scaleX(-1)' : undefined }}
            />
            {/* Small label in the corner so nothing covers what the camera is pointing at */}
            <div style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)', padding: '5px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={14} color="#fff" />
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>{selfieCamera ? 'Front camera · live' : 'Live camera'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={captureDocument}
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              <Camera size={20} /> {selfieCamera ? 'Take selfie' : `Capture Photo ${siteImages.length + 1}`}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={stopCamera}>Cancel</button>
              {/* The selfie proves the engineer is at the site: live camera only, no upload */}
              {!selfieCamera && <button
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
              </button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
