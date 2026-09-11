import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, CloudUpload, Loader2, FileText, MapPin, Building, Phone, Calendar, Clock, StickyNote, MessageCircle, Navigation, Map, MessageSquare, Eye, X, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';
import ChatSystem from '../Shared/ChatSystem';
import { API_BASE_URL } from '../../config/api';

const REQUIRED_DOCS = [
  { id: 'saleDeed', label: '1. Registered Document / Sale Deed' },
  { id: 'buildingPlan', label: '2. Approved Building Plan / Permit Order' },
  { id: 'propertyTax', label: '3. Property Tax Assessment / Receipt' },
  { id: 'marketValue', label: '4. Market Value / Guideline Certificate' },
  { id: 'layoutPlan', label: '5. Layout / Approval Plan (Site & Architectural Drawings)' },
];

export default function CaseDetailsView({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const watchIdRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    if (bytes < k) return `${bytes} B`;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  const handleToggleTracking = () => {
    if (isTracking) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      fetch(`${API_BASE_URL}/api/cases/${caseId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' })
      });
      toast('Trip Paused', { icon: '⏸️' });
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Trip Started 🚗',
        message: `Engineer has started the trip for Case #${caseId} (${caseData?.clientName || 'Client'})`,
        type: 'info',
        targetUser: 'ADMIN'
      })
    });
    
    fetch(`${API_BASE_URL}/api/cases/${caseId}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });

    setIsTracking(true);
    toast.success('Trip Started! Admin is tracking your location.');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        fetch(`${API_BASE_URL}/api/cases/${caseId}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        });
      },
      (error) => { console.error('Location error:', error); },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cases/${caseId}`)
      .then(res => res.json())
      .then(data => {
        setCaseData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching case:", err);
        setLoading(false);
      });
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={40} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
        <p>Loading case details...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Case not found or error loading.</p>
      </div>
    );
  }

  const { clientName, borrowerName, clientPhone, bankName, locationData, inspectionDate, inspectionTime, note, sitePhotos, signatureDataUrl, propertyDetails, status, documents } = caseData;
  const displayName = clientName || borrowerName || 'Unknown Client';

  // Use the actual photos or pad with required placeholders if fewer than 4 were taken
  const actualPhotos = sitePhotos || [];
  const minRequiredPhotos = 4;
  
  const photoRequirements = [];
  
  for (let i = 0; i < Math.max(actualPhotos.length, minRequiredPhotos); i++) {
    if (i < actualPhotos.length) {
      photoRequirements.push({
        title: `Site Photo ${i + 1}`,
        status: 'Uploaded',
        imgUrl: actualPhotos[i],
        size: 'Captured'
      });
    } else {
      photoRequirements.push({
        title: `Additional Photo`,
        status: 'Required',
        icon: 'Required'
      });
    }
  }

  return (
    <div className="case-details-view animate-fade-in" style={{ paddingBottom: '160px' }}>
      
      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="badge badge-gray">{caseId}</span>
          <span className={`badge ${status === 'Approved' ? 'badge-success' : 'badge-primary'}`} style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 8px' }}>
             <CheckCircle2 size={14} /> {status}
          </span>
        </div>
        
        <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px', color: '#0f172a' }}>{displayName}</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>
            <Building size={16} /> {bankName || 'Unknown Bank'}
          </p>
          
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
            <Phone size={16} color="#64748b" /> {clientPhone || 'No Mobile'}
          </p>

          <p className="text-muted" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px' }}>
            <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#64748b' }} /> 
            <span>{locationData && locationData !== 'Fetching location...' && locationData !== 'Address pending' ? locationData : 'Address pending'}</span>
          </p>
          
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
            <Calendar size={16} color="#64748b" /> 
            {inspectionDate ? new Date(inspectionDate).toLocaleDateString() : 'Date TBD'} 
            <Clock size={16} color="#64748b" style={{ marginLeft: '4px' }} /> 
            {inspectionTime || 'Time TBD'}
          </p>
          
          <div style={{ marginTop: '8px', padding: '12px', backgroundColor: note ? '#fef9c3' : '#f8fafc', borderRadius: '8px', border: note ? '1px solid #fef08a' : '1px solid #e2e8f0' }}>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: note ? '#854d0e' : '#64748b', margin: 0 }}>
              <StickyNote size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> 
              <span style={{ fontWeight: '500' }}>Admin Note: {note || 'None'}</span>
            </p>
          </div>
        </div>
      </div>
      
      {!isStarted && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
          
          <div style={{ textAlign: 'center', margin: '8px 0 16px 0' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '36px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.15)' }}>
              <FileText size={32} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>Ready to Begin</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>Review the details above and start the valuation process when you arrive at the property.</p>
          </div>

          <button 
            onClick={handleToggleTracking}
            style={{ 
              background: isTracking ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '16px', 
              padding: '18px', 
              fontSize: '16px', 
              fontWeight: '700', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer', 
              boxShadow: isTracking ? '0 10px 25px -5px rgba(239, 68, 68, 0.4)' : '0 10px 25px -5px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              animation: isTracking ? 'pulse 2s infinite' : 'none'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isTracking ? (
              <><MapPin size={22} /> Stop Tracking Trip</>
            ) : (
              <><Map size={22} /> Start Trip (Enable GPS)</>
            )}
          </button>

          <button 
            onClick={() => setIsStarted(true)}
            style={{ 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '16px', 
              padding: '18px', 
              fontSize: '16px', 
              fontWeight: '700', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer', 
              boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4), 0 8px 10px -6px rgba(37, 99, 235, 0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(37, 99, 235, 0.5)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.4)'; }}
          >
            <CheckCircle2 size={22} /> Start Valuation Process
          </button>

          <style>{`
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
              70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
              100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
          `}</style>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <button 
              onClick={() => {
                const isValid = (val) => val && !['fetching location...', 'address pending', 'to be updated', 'unknown bank', 'bank'].includes(val.trim().toLowerCase());
                const addr = isValid(locationData) ? locationData : (isValid(bankName) ? bankName : 'Kadapa, Andhra Pradesh');
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
              }}
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '16px', 
                padding: '16px', 
                fontSize: '14px', 
                fontWeight: '600', 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Navigation size={24} /> 
              <span>Get Directions</span>
            </button>
            <button 
              onClick={() => setIsChatOpen(true)}
              style={{ 
                background: 'linear-gradient(135deg, #128C7E 0%, #075E54 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '16px', 
                padding: '16px', 
                fontSize: '14px', 
                fontWeight: '600', 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                boxShadow: '0 10px 15px -3px rgba(18, 140, 126, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <MessageSquare size={24} /> 
              <span>In-App Chat</span>
            </button>
          </div>
        </div>
      )}
        
      {isStarted && propertyDetails && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Property Details</h3>
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Property Type</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.propertyType || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Plot Type</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.plotType || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Building Age</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.buildingAge || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Structure Type</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.structureType || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Flooring Type</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.flooringType || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Road Width</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.roadWidth || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Road Type</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.roadType || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Plinth Area</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{propertyDetails.siteValue?.plinthArea || 'N/A'}</div>
              </div>
            </div>

            {/* Legal & Registration Details */}
            {(propertyDetails.deedNo || propertyDetails.surveyNo || propertyDetails.assessmentNo || propertyDetails.approvalPlanNo || propertyDetails.khathaNo) && (
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>Legal & Registration</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {propertyDetails.deedNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Deed Number</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.deedNo} {propertyDetails.deedYear ? `(${propertyDetails.deedYear})` : ''}</div>
                    </div>
                  )}
                  {propertyDetails.netExtent && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Extent</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.netExtent}</div>
                    </div>
                  )}
                  {propertyDetails.surveyNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Survey Number</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.surveyNo}</div>
                    </div>
                  )}
                  {propertyDetails.plotNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Plot Number</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.plotNo}</div>
                    </div>
                  )}
                  {propertyDetails.assessmentNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Property Tax / Assessment No.</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0346c8' }}>{propertyDetails.assessmentNo}</div>
                    </div>
                  )}
                  {propertyDetails.doorNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Door / House Number</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.doorNo}</div>
                    </div>
                  )}
                  {propertyDetails.khathaNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Khatha Number</div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{propertyDetails.khathaNo}</div>
                    </div>
                  )}
                  {propertyDetails.approvalPlanNo && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Building Permit / Approval No.</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#065f46' }}>{propertyDetails.approvalPlanNo}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>Boundaries (Document vs Actual)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>North</div>
                  <div style={{ fontSize: '13px' }}>Doc: {propertyDetails.boundariesDoc?.north || 'N/A'}</div>
                  <div style={{ fontSize: '13px' }}>Act: {propertyDetails.boundariesActual?.north || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>South</div>
                  <div style={{ fontSize: '13px' }}>Doc: {propertyDetails.boundariesDoc?.south || 'N/A'}</div>
                  <div style={{ fontSize: '13px' }}>Act: {propertyDetails.boundariesActual?.south || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>East</div>
                  <div style={{ fontSize: '13px' }}>Doc: {propertyDetails.boundariesDoc?.east || 'N/A'}</div>
                  <div style={{ fontSize: '13px' }}>Act: {propertyDetails.boundariesActual?.east || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>West</div>
                  <div style={{ fontSize: '13px' }}>Doc: {propertyDetails.boundariesDoc?.west || 'N/A'}</div>
                  <div style={{ fontSize: '13px' }}>Act: {propertyDetails.boundariesActual?.west || 'N/A'}</div>
                </div>
              </div>
            </div>

            {propertyDetails.siteValue?.floors && propertyDetails.siteValue.floors.length > 0 && (
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>Floor Details</h4>
                {propertyDetails.siteValue.floors.map((floor, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{floor.label}</span>
                    <span style={{ fontWeight: '500' }}>{floor.value || 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {isStarted && (
        <>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Site Photos ({actualPhotos.length})</h3>
          
          {/* Photo Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        {photoRequirements.map((req, idx) => (
          <div key={idx} style={{ 
            backgroundColor: req.imgUrl ? '#fff' : '#f1f5f9',
            border: req.imgUrl ? '2px solid var(--primary)' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            height: '160px'
          }}>
            {req.status === 'Required' && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#fff', border: '1px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontWeight: '700', fontSize: '14px' }}>!</div>
            )}
            
            {req.status === 'Uploaded' && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#fff', border: '1px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', zIndex: 10 }}>
                <CheckCircle2 size={16} />
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
              {req.imgUrl ? (
                <img src={req.imgUrl} alt={req.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
              ) : (
                <>
                  <Camera size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Required</span>
                </>
              )}
            </div>

            <div style={{ backgroundColor: '#fff', borderTop: '1px solid var(--border-color)', padding: '10px 12px', fontSize: '13px', fontWeight: '500', display: 'flex', justifyContent: 'space-between', zIndex: 1 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.title}</span>
              {req.size && <span className="text-muted" style={{ fontSize: '11px' }}>{req.size}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Scanned Documents (5 Required)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {REQUIRED_DOCS.map(reqDoc => {
            const uploadedPages = (documents && documents[reqDoc.id]) ? documents[reqDoc.id] : [];
            const isUploaded = uploadedPages.length > 0;

            return (
              <div key={reqDoc.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', backgroundColor: isUploaded ? '#f8fafc' : '#fff', border: isUploaded ? '1px solid var(--border-color)' : '1px dashed var(--danger)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isUploaded ? '8px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color={isUploaded ? "var(--primary)" : "var(--text-muted)"} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: isUploaded ? 'var(--text-primary)' : 'var(--text-muted)' }}>{reqDoc.label}</div>
                      {isUploaded && <div className="text-muted" style={{ fontSize: '12px' }}>{uploadedPages.length} Page(s) Scanned</div>}
                    </div>
                  </div>
                  {isUploaded ? (
                    <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}><CheckCircle2 size={12} style={{ marginRight: '2px' }}/> Verified</span>
                  ) : (
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>Missing</span>
                  )}
                </div>
                
                {isUploaded && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {uploadedPages.map((page, idx) => {
                      const ext = (page.extension || (page.name && page.name.includes('.') ? page.name.split('.').pop() : (page.isPdf ? 'PDF' : 'JPG'))).toUpperCase();
                      const size = page.sizeFormatted || (page.size ? formatFileSize(page.size) : '');
                      return (
                        <div 
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <span style={{
                              backgroundColor: page.isPdf || ext === 'PDF' ? '#fee2e2' : '#e0e7ff',
                              color: page.isPdf || ext === 'PDF' ? '#dc2626' : '#4338ca',
                              fontWeight: '700',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              {ext}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={page.name}>
                                {page.name || `Document Page ${idx + 1}`}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {size && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <HardDrive size={10} /> {size}
                                  </span>
                                )}
                                {page.uploadedAt && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Clock size={10} /> {page.uploadedAt}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {page.url && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(page)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  color: '#0284c7',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                <Eye size={12} /> View
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* Preview Modal in CaseDetailsView */}
      {previewDoc && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
          display: 'flex', flexDirection: 'column', padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', marginBottom: '12px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {previewDoc.name}
            </span>
            <button 
              onClick={() => setPreviewDoc(null)} 
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {previewDoc.isPdf ? (
              <iframe src={previewDoc.url} title={previewDoc.name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }} />
            ) : (
              <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
            )}
          </div>
        </div>
      )}

      {isStarted && signatureDataUrl && (
        <div style={{ marginBottom: '24px' }}>
           <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Engineer Signature</h3>
           <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: '#fff', textAlign: 'center' }}>
             <img src={signatureDataUrl} alt="Signature" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
           </div>
        </div>
      )}

      {/* Sticky Bottom Action Bar - Only show when started */}
      {isStarted && (
        <div style={{ position: 'fixed', bottom: '66px', left: 0, right: 0, padding: '10px 14px', backgroundColor: '#fff', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', zIndex: 90, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
          <button className="btn-secondary" style={{ flex: 1, backgroundColor: '#f1f5f9', border: '1px solid var(--border-color)', padding: '10px 8px', fontSize: '13px', fontWeight: '600', minWidth: 0, whiteSpace: 'nowrap' }} onClick={() => window.print()}>
            <FileText size={16} /> Export PDF
          </button>
          <a href={`${API_BASE_URL}/api/cases/${caseId}/report`} download style={{ flex: 1.2, textDecoration: 'none', minWidth: 0 }}>
            <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', fontSize: '13px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <FileText size={16} /> Report (.docx)
            </button>
          </a>
        </div>
      )}
      {isChatOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
          <ChatSystem 
            currentUser={JSON.parse(localStorage.getItem('sbi_valuation_current_user_v3'))}
            otherUserId="ADMIN"
            caseId={caseId}
            onBack={() => setIsChatOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
