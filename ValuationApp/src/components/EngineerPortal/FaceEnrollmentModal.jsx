import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Camera, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadFaceApiModels, analyzeFaceFrame } from '../../services/faceApiService';

export default function FaceEnrollmentModal({ currentUser, onEnrolled, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  const [faceStatus, setFaceStatus] = useState('LOOKING'); // LOOKING, NOT_CENTERED, MULTIPLE, READY, ENROLLING, SUCCESS
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isRunningRef = useRef(true);

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // Start Camera and Load Models
  useEffect(() => {
    isRunningRef.current = true;

    async function init() {
      try {
        setIsModelLoading(true);
        await loadFaceApiModels();
        setIsModelLoading(false);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera or Model Init Error:', err);
        setCameraError(err.message || 'Failed to access camera.');
        setIsModelLoading(false);
      }
    }

    init();

    return () => {
      isRunningRef.current = false;
      stopCameraStream();
    };
  }, []);

  // Frame Analysis Loop
  useEffect(() => {
    if (!stream || isModelLoading || isProcessing) return;

    const interval = setInterval(async () => {
      if (!isRunningRef.current || !videoRef.current || isProcessing) return;

      try {
        const result = await analyzeFaceFrame(videoRef.current);
        setLastAnalysis(result);

        if (result.faceCount === 0) {
          setFaceStatus('LOOKING');
        } else if (result.faceCount > 1) {
          setFaceStatus('MULTIPLE');
        } else if (result.status === 'NOT_CENTERED') {
          setFaceStatus('NOT_CENTERED');
        } else if (result.status === 'ALIGNED') {
          setFaceStatus('READY');
        }
      } catch (e) {
        // Ignored frame glitch
      }
    }, 300);

    return () => clearInterval(interval);
  }, [stream, isModelLoading, isProcessing]);

  const handleEnrollFace = async () => {
    if (!lastAnalysis || !lastAnalysis.descriptor || faceStatus !== 'READY') {
      return toast.error('Please align your face inside the circle first.');
    }

    setIsProcessing(true);
    setFaceStatus('ENROLLING');

    try {
      // Capture reference photo on canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1); // mirror
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Save to Backend
      const targetId = currentUser?.id || currentUser?.username || 'ENG-001';
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/users/${targetId}/face-enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: lastAnalysis.descriptor,
          facePhotoUrl: photoDataUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save biometric profile.');
      }

      setFaceStatus('SUCCESS');
      toast.success('Facial Biometric Profile Registered Successfully!');

      // Update LocalStorage User
      const updatedUser = {
        ...currentUser,
        faceEnrolled: true,
        faceDescriptor: lastAnalysis.descriptor,
        facePhotoUrl: photoDataUrl
      };
      localStorage.setItem('sbi_valuation_current_user_v3', JSON.stringify(updatedUser));

      stopCameraStream();

      setTimeout(() => {
        if (onEnrolled) onEnrolled(updatedUser);
      }, 1000);
    } catch (err) {
      console.error('Enrollment error:', err);
      toast.error('Enrollment failed: ' + err.message);
      setIsProcessing(false);
      setFaceStatus('READY');
    }
  };

  const handleCloseModal = () => {
    stopCameraStream();
    if (onClose) onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #001233 0%, #002855 100%)',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Face Biometric Setup</h3>
              <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>1-Time Staff Identity Enrollment</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div style={{ position: 'relative', width: '100%', height: '340px', backgroundColor: '#020617', overflow: 'hidden' }}>
          {isModelLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', gap: '12px', zIndex: 10 }}>
              <Loader2 className="spin" size={32} color="#38bdf8" />
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Loading Biometric AI Models...</span>
            </div>
          )}

          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', padding: '24px', textAlign: 'center', zIndex: 10 }}>
              <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '10px' }} />
              <p style={{ fontSize: '13px', color: '#fca5a5' }}>{cameraError}</p>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)'
            }}
          />

          {/* Biometric Oval Guide with Animated Feedback */}
          <div style={{
            position: 'absolute',
            inset: '30px 50px',
            borderRadius: '50%',
            border: `3px dashed ${
              faceStatus === 'READY' ? '#10b981' :
              faceStatus === 'MULTIPLE' ? '#ef4444' :
              faceStatus === 'NOT_CENTERED' ? '#f59e0b' : '#38bdf8'
            }`,
            boxShadow: faceStatus === 'READY' ? '0 0 25px rgba(16, 185, 129, 0.6)' : 'none',
            pointerEvents: 'none',
            transition: 'all 0.25s ease'
          }} />

          {/* Status Badge overlay */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}>
            {faceStatus === 'READY' && (
              <>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ color: '#10b981' }}>Face Aligned Perfectly!</span>
              </>
            )}
            {faceStatus === 'NOT_CENTERED' && (
              <>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ color: '#f59e0b' }}>Center face inside oval</span>
              </>
            )}
            {faceStatus === 'MULTIPLE' && (
              <>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ color: '#ef4444' }}>Multiple faces! Only 1 allowed</span>
              </>
            )}
            {faceStatus === 'LOOKING' && (
              <>
                <Loader2 className="spin" size={16} color="#38bdf8" />
                <span>Position your face in the oval</span>
              </>
            )}
            {faceStatus === 'ENROLLING' && (
              <>
                <Loader2 className="spin" size={16} color="#38bdf8" />
                <span>Registering biometric profile...</span>
              </>
            )}
            {faceStatus === 'SUCCESS' && (
              <>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ color: '#10b981' }}>Enrolled!</span>
              </>
            )}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Content & Action */}
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#0f172a' }}>
            <Sparkles size={16} color="#0052cc" />
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>Enrolling for {currentUser?.name || 'Staff Engineer'}</h4>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
            This photo will become your official biometric baseline. Future attendance check-ins will verify your face against this profile with bank-grade security.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCloseModal}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleEnrollFace}
              disabled={faceStatus !== 'READY' || isProcessing}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: faceStatus === 'READY' ? '#0052cc' : '#94a3b8',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: faceStatus === 'READY' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: faceStatus === 'READY' ? '0 4px 12px rgba(0, 82, 204, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="spin" size={16} /> Enrolling...
                </>
              ) : (
                <>
                  <Camera size={16} /> Register Face Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
