import React from 'react';
import {
  ShieldAlert,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Camera,
  UploadCloud,
  Loader2,
  X,
  FileText,
  HardDrive,
  Clock,
  Eye,
  Trash2,
  Zap,
  ChevronRight,
  Terminal
} from 'lucide-react';
import { REQUIRED_DOCS, getPageDisplayInfo, getDocMetaPills } from './caseModalHelpers';

export default function Step2LegalDocs({
  uploadedDocs = {},
  scanningDocs = {},
  docErrors = {},
  scanProgress = {},
  setDocErrors,
  setScanningDocs,
  activeDocUpload,
  setActiveDocUpload,
  activeDocUploadRef,
  fileInputRef,
  isCameraActive,
  videoRef,
  startCamera,
  stopCamera,
  captureDocument,
  handleSimulateUpload,
  handleDeletePage,
  setPreviewImage,
  extractedDocsMeta = {},
  handleNextToPropertyDetails
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleSimulateUpload} 
        multiple 
        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" 
        style={{ display: 'none' }} 
      />

      {!isCameraActive ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(234, 179, 8, 0.08)', border: '1px solid #eab308', borderRadius: '10px', display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'flex-start' }}>
            <ShieldAlert size={18} color="#ca8a04" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '12px', color: '#854d0e', lineHeight: '1.45' }}>
              <strong>Strict Validation Active:</strong> Every upload is scanned by Mahe AI using OCR text analysis. Images and PDFs are both verified. Duplicate files are detected via content-hash — renaming a file will not bypass this. Irrelevant documents are rejected immediately. You can add multiple pages per document.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {REQUIRED_DOCS.map((doc) => {
              const pages = uploadedDocs[doc.id] || [];
              const fileCount = pages.length;
              const totalPages = pages.reduce((sum, p) => sum + (p.pageCount || 1), 0);
              const isScanning = scanningDocs[doc.id];
              
              return (
                <div key={doc.id} style={{ 
                  border: fileCount > 0 ? '1.5px solid #10b981' : (isScanning ? '1.5px solid var(--primary)' : '1px solid var(--border-color)'), 
                  borderRadius: '12px', 
                  padding: '12px 14px', 
                  backgroundColor: fileCount > 0 ? '#f0fdf4' : 'var(--bg-card)', 
                  display: 'flex', 
                  flexDirection: 'column',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: fileCount > 0 ? '#065f46' : 'var(--text-primary)', marginBottom: '6px', lineHeight: '1.35', wordBreak: 'break-word' }}>
                        {doc.label}
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {isScanning ? (
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <ScanLine size={12} className="spin" /> Scanning...
                          </span>
                        ) : fileCount > 0 ? (
                          <span style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> {totalPages} Page{totalPages > 1 ? 's' : ''} Uploaded{fileCount > 1 ? ` (${fileCount} files)` : ''}
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> Required
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, opacity: isScanning ? 0.3 : 1, pointerEvents: isScanning ? 'none' : 'auto' }}>
                      <button 
                        type="button"
                        onClick={() => startCamera(doc.id)}
                        title="Take photo with camera"
                        style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      >
                        <Camera size={16} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          if (activeDocUploadRef) activeDocUploadRef.current = doc.id; 
                          setActiveDocUpload(doc.id); 
                          fileInputRef.current.click(); 
                        }}
                        title="Upload file from device"
                        style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      >
                        <UploadCloud size={16} />
                      </button>
                    </div>
                  </div>

                  {/* High-Tech Laser Scanning Animation Box */}
                  {isScanning && (
                    <div style={{
                      marginTop: '12px',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1.5px dashed #60a5fa',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: '8px',
                        right: '8px',
                        height: '3px',
                        background: 'linear-gradient(90deg, transparent, #2563eb, #38bdf8, #2563eb, transparent)',
                        boxShadow: '0 0 10px #3b82f6',
                        animation: 'scanLaser 1.8s ease-in-out infinite'
                      }} />

                      {/* 1. Live Page Counter on Scanning Canvas */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1, padding: '0 2px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          color: '#1e40af',
                          backgroundColor: '#dbeafe',
                          border: '1px solid #bfdbfe',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <FileText size={11} color="#2563eb" /> Page {scanProgress[doc.id]?.currentPage || 1} of {scanProgress[doc.id]?.totalPages || scanProgress[doc.id]?.pageCount || 1}
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Zap size={11} color="#10b981" /> Live AI Extraction Active
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                        <Loader2 size={16} className="spin" color="#2563eb" />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                          {scanProgress[doc.id]?.status || 'Mahe AI OCR Scanning...'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontWeight: '500', zIndex: 1 }}>
                        {scanProgress[doc.id]?.detail || 'Analyzing document structure & details'}
                      </div>

                      {/* 2. Real-Time Extracted Text Stream (Live Terminal Box) */}
                      {scanProgress[doc.id]?.liveSnippets && scanProgress[doc.id].liveSnippets.length > 0 && (
                        <div style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          padding: '8px 10px',
                          marginTop: '2px',
                          zIndex: 1,
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                          maxHeight: '92px',
                          overflowY: 'auto'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', borderBottom: '1px solid #1e293b', paddingBottom: '3px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                              <Terminal size={11} color="#38bdf8" /> EXTRACTING DOCUMENT TEXT:
                            </span>
                            <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                              LIVE OCR STREAM
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace', fontSize: '10px', color: '#e2e8f0', lineHeight: '1.35' }}>
                            {scanProgress[doc.id].liveSnippets.map((snip, sIdx) => (
                              <div key={sIdx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: sIdx === 0 ? '#4ade80' : '#cbd5e1' }}>
                                <span style={{ color: '#64748b' }}>&gt;</span> {snip}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Live Extracted Fields Badge Container */}
                      {scanProgress[doc.id]?.extractedPairs && scanProgress[doc.id]?.extractedPairs.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          justifyContent: 'center',
                          marginTop: '4px',
                          maxWidth: '100%',
                          zIndex: 1
                        }}>
                          {scanProgress[doc.id].extractedPairs.map((pair, pIdx) => (
                            <span key={pIdx} style={{
                              backgroundColor: '#ffffff',
                              color: '#1d4ed8',
                              border: '1px solid #93c5fd',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                              <CheckCircle2 size={10} color="#2563eb" /> {pair}
                            </span>
                          ))}
                        </div>
                      )}
                      {scanProgress[doc.id]?.totalPages && scanProgress[doc.id]?.totalPages > 1 && (
                        <div style={{
                          width: '90%',
                          height: '4px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          marginTop: '4px',
                          zIndex: 1
                        }}>
                          <div style={{
                            width: `${Math.max(15, Math.min(100, Math.round(((scanProgress[doc.id]?.currentPage || 1) / scanProgress[doc.id]?.totalPages) * 100)))}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #2563eb, #10b981)',
                            borderRadius: '2px',
                            transition: 'width 0.4s ease-in-out'
                          }} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScanningDocs(prev => ({ ...prev, [doc.id]: false }));
                        }}
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          color: '#dc2626',
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          zIndex: 2,
                          fontWeight: '600'
                        }}
                      >
                        Cancel / Reset Scan
                      </button>
                    </div>
                  )}

                  {docErrors[doc.id] && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', marginBottom: '2px' }}>
                            Verification Alert
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#b91c1c', lineHeight: '1.4' }}>
                            {docErrors[doc.id]}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocErrors(prev => ({ ...prev, [doc.id]: null }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#991b1b',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Uploaded Files Detailed List */}
                  {pages.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      {pages.map((page, idx) => {
                        const info = getPageDisplayInfo(page, idx);
                        return (
                          <div 
                            key={page.id || idx}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: '6px',
                              padding: '8px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #d1fae5',
                              borderRadius: '8px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Card Top Row: Thumbnail + Name + Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* Thumbnail Preview or PDF Badge */}
                              <div 
                                onClick={() => setPreviewImage(page)}
                                title="Click to preview"
                                style={{ 
                                  width: '36px', 
                                  height: '36px', 
                                  borderRadius: '6px', 
                                  border: '1px solid #e2e8f0', 
                                  overflow: 'hidden', 
                                  flexShrink: 0,
                                  cursor: 'pointer', 
                                  position: 'relative', 
                                  backgroundColor: info.isPdf ? '#fef2f2' : '#f8fafc',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {info.isPdf ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={16} color="#dc2626" />
                                    <span style={{ fontSize: '8px', fontWeight: '800', color: '#dc2626', letterSpacing: '0.3px' }}>PDF</span>
                                  </div>
                                ) : page.url ? (
                                  <img src={page.url} alt={info.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <FileText size={16} color="#059669" />
                                )}
                                <div style={{ 
                                  position: 'absolute', 
                                  bottom: 0, 
                                  right: 0, 
                                  backgroundColor: 'rgba(15, 23, 42, 0.75)', 
                                  color: '#ffffff', 
                                  fontSize: '8px', 
                                  fontWeight: '700', 
                                  padding: '1px 3px', 
                                  borderTopLeftRadius: '3px' 
                                }}>
                                  {info.isPdf && (page.pageCount || 1) > 1 ? `${page.pageCount}p` : `#${idx + 1}`}
                                </div>
                              </div>

                              {/* Filename */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div 
                                  title={info.name}
                                  style={{ 
                                     fontSize: '12.5px', 
                                     fontWeight: '600', 
                                     color: '#0f172a', 
                                     whiteSpace: 'nowrap', 
                                     overflow: 'hidden', 
                                     textOverflow: 'ellipsis' 
                                   }}
                                >
                                  {info.name}
                                </div>
                              </div>

                              {/* Action Buttons: Preview & Delete */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button 
                                  type="button"
                                  onClick={() => setPreviewImage(page)}
                                  title="Preview file"
                                  style={{ 
                                    width: '28px', 
                                    height: '28px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #e2e8f0', 
                                    backgroundColor: '#f8fafc', 
                                    color: '#0284c7', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    cursor: 'pointer',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                >
                                  <Eye size={13} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => handleDeletePage(doc.id, page.id, e)}
                                  title="Delete file"
                                  style={{ 
                                    width: '28px', 
                                    height: '28px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #fee2e2', 
                                    backgroundColor: '#fff1f2', 
                                    color: '#e11d48', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    cursor: 'pointer',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffe4e6'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff1f2'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Card Bottom Row: Responsive Meta Pills */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              flexWrap: 'wrap', 
                              fontSize: '10.5px',
                              paddingTop: '4px',
                              borderTop: '1px dashed #e2e8f0'
                            }}>
                              <span style={{ 
                                backgroundColor: info.isPdf ? '#fee2e2' : '#e0e7ff', 
                                color: info.isPdf ? '#dc2626' : '#4338ca', 
                                fontWeight: '700', 
                                fontSize: '10px', 
                                padding: '1px 5px', 
                                borderRadius: '4px',
                                letterSpacing: '0.4px'
                              }}>
                                {info.ext}
                              </span>

                              {info.isPdf && (page.pageCount || 1) > 1 && (
                                <span style={{ 
                                  color: '#dc2626', 
                                  backgroundColor: '#fef2f2', 
                                  border: '1px solid #fecaca', 
                                  fontWeight: '700', 
                                  fontSize: '10px', 
                                  padding: '1px 5px', 
                                  borderRadius: '4px',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '2px'
                                }}>
                                  <FileText size={9} /> {page.pageCount} Pages
                                </span>
                              )}

                              {info.size && (
                                <span style={{ color: '#475569', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500', fontSize: '10px' }}>
                                  <HardDrive size={10} color="#94a3b8" />
                                  {info.size}
                                </span>
                              )}

                              {info.uploadedAt && (
                                <span style={{ color: '#64748b', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                  <Clock size={10} color="#94a3b8" />
                                  {info.uploadedAt}
                                </span>
                              )}

                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '2px', 
                                color: '#059669', 
                                backgroundColor: '#ecfdf5', 
                                border: '1px solid #a7f3d0',
                                padding: '1px 5px', 
                                borderRadius: '4px', 
                                fontWeight: '700',
                                fontSize: '10px'
                              }}>
                                <CheckCircle2 size={10} /> Verified
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Extracted Document Intelligence Summary Banner */}
                  {extractedDocsMeta[doc.id] && getDocMetaPills(extractedDocsMeta[doc.id]).length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', letterSpacing: '0.4px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Zap size={13} color="#059669" /> Extracted Document Intelligence ({getDocMetaPills(extractedDocsMeta[doc.id]).length} fields auto-filled)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {getDocMetaPills(extractedDocsMeta[doc.id]).map((pill, pIdx) => (
                          <span key={pIdx} style={{
                            backgroundColor: '#ffffff',
                            color: '#065f46',
                            border: '1px solid #6ee7b7',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}>
                            <span style={{ color: '#047857', fontWeight: '600' }}>{pill.label}:</span> {pill.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(() => {
            const allUploaded = REQUIRED_DOCS.every(doc => uploadedDocs[doc.id]?.length > 0);
            const anyScanningNow = Object.values(scanningDocs).some(Boolean);
            const canProceed = allUploaded && !anyScanningNow;
            return (
              <button
                className="btn-primary"
                onClick={handleNextToPropertyDetails}
                disabled={!canProceed}
                style={{
                  opacity: !canProceed ? 0.5 : 1,
                  marginTop: 'auto',
                  backgroundColor: !canProceed ? '#94a3b8' : '',
                  cursor: !canProceed ? 'not-allowed' : 'pointer'
                }}
              >
                {anyScanningNow ? (
                  <><Loader2 size={16} className="spin" /> Mahe AI Scanning...</>
                ) : allUploaded ? (
                  <>Next: Property Details <ChevronRight size={18} /></>
                ) : (
                  <>Upload All 5 Documents to Continue ({REQUIRED_DOCS.filter(d => uploadedDocs[d.id]?.length > 0).length}/5 Done)</>
                )}
              </button>
            );
          })()}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600' }}>
              Capturing Page {uploadedDocs[activeDocUpload]?.length + 1 || 1} for: {REQUIRED_DOCS.find(d => d.id === activeDocUpload)?.label}
            </span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: '32px', border: '2px solid rgba(255,255,255,0.7)', borderRadius: '8px' }}></div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ScanLine size={16} color="#fff" />
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Align Document Page</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={stopCamera}>Cancel</button>
            <button type="button" className="btn-primary" style={{ flex: 2 }} onClick={captureDocument}>
              <Camera size={18} /> Capture Page {uploadedDocs[activeDocUpload]?.length + 1 || 1}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
