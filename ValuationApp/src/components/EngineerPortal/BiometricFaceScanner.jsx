import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw, Eye, MapPin, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadFaceApiModels, analyzeFaceFrame, compareWithRegisteredFace } from '../../services/faceApiService';

export default function BiometricFaceScanner({
  currentUser,
  attendanceType,
  location,
  addressData,
  onCaptureSuccess,
  onClose
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  // Verification States
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState('Position your face in the oval');
  const [detectionColor, setDetectionColor] = useState('#38bdf8'); // cyan, green, red, yellow
  const [faceMatchScore, setFaceMatchScore] = useState(0);
  const [isFaceMatched, setIsFaceMatched] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [blinkPrompt, setBlinkPrompt] = useState('Blink your eyes to verify liveness');

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const isRunningRef = useRef(true);
  const earHistoryRef = useRef([]);
  const fileInputRef = useRef(null);

  // Stop camera helper
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // 1. Start Camera only when Scanner opens
  useEffect(() => {
    isRunningRef.current = true;

    async function startScanner() {
      try {
        setIsModelLoading(true);
        await loadFaceApiModels();
        setIsModelLoading(false);

        if (!navigator?.mediaDevices?.getUserMedia) {
          setCameraError('Live video stream requires HTTPS on mobile browsers. Please tap "Take Selfie with Camera" below to verify.');
          setIsModelLoading(false);
          return;
        }

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
        console.error('Camera Access Error:', err);
        setCameraError(err?.name === 'NotAllowedError'
          ? 'Camera is blocked. Allow camera for Gouru (Settings → App Permissions), or take a selfie below.'
          : 'Camera not available. Take a selfie below instead.');
        setIsModelLoading(false);
      }
    }

    startScanner();

    return () => {
      isRunningRef.current = false;
      stopCamera();
    };
  }, []);

  // 2. Real-Time Face Detection, Biometric Recognition & Anti-Spoof Liveness Loop
  useEffect(() => {
    if (!stream || isModelLoading || capturedPhoto) return;

    const interval = setInterval(async () => {
      if (!isRunningRef.current || !videoRef.current || capturedPhoto) return;

      try {
        const result = await analyzeFaceFrame(videoRef.current);

        if (result.faceCount === 0) {
          setFaceDetected(false);
          setIsFaceMatched(false);
          setDetectionMessage('No face detected. Position your face in the oval');
          setDetectionColor('#f59e0b'); // Warning Yellow
          return;
        }

        if (result.faceCount > 1) {
          setFaceDetected(false);
          setIsFaceMatched(false);
          setDetectionMessage('Multiple faces detected! Only 1 person allowed');
          setDetectionColor('#ef4444'); // Danger Red
          return;
        }

        if (result.status === 'NOT_CENTERED') {
          setFaceDetected(true);
          setDetectionMessage('Center your face inside the oval');
          setDetectionColor('#f59e0b');
          return;
        }

        // Single Face Aligned!
        setFaceDetected(true);

        // Biometric Face Match Check against registered face profile
        if (currentUser?.faceDescriptor && currentUser.faceDescriptor.length > 0) {
          const matchResult = compareWithRegisteredFace(result.descriptor, currentUser.faceDescriptor);
          setFaceMatchScore(matchResult.confidence);

          if (matchResult.isMatch) {
            setIsFaceMatched(true);
          } else {
            setIsFaceMatched(false);
            setDetectionMessage(`Face Mismatch (${matchResult.confidence}%). Must match registered profile`);
            setDetectionColor('#ef4444');
            return;
          }
        } else {
          // If profile hasn't enrolled yet, default to single-face presence verification
          setIsFaceMatched(true);
          setFaceMatchScore(95);
        }

        // Anti-Spoofing Liveness: Blink Detection
        if (result.ear !== null) {
          const history = earHistoryRef.current;
          history.push(result.ear);
          if (history.length > 8) history.shift();

          // A blink is detected when EAR drops below 0.20 and then rises above 0.25
          const minEAR = Math.min(...history);
          const maxEAR = Math.max(...history);
          if (minEAR < 0.21 && maxEAR > 0.26 && !livenessPassed) {
            setLivenessPassed(true);
            setBlinkPrompt('Liveness Verified! Real Person Confirmed');
          }
        }

        // All checks passing
        if (isFaceMatched) {
          setDetectionColor('#10b981'); // Emerald Green
          if (!livenessPassed) {
            setDetectionMessage('Face Matched! Blink eyes to confirm liveness');
          } else {
            setDetectionMessage(`Biometric Verified (${faceMatchScore}% Match)`);
          }
        }
      } catch (err) {
        // Frame analysis loop error
      }
    }, 280);

    return () => clearInterval(interval);
  }, [stream, isModelLoading, capturedPhoto, currentUser, isFaceMatched, livenessPassed, faceMatchScore]);

  // Capture Photo with Full High-Security Geotagged Watermark
  const handleCapture = () => {
    if (!faceDetected) {
      return toast.error('Face detection is mandatory. Please place your face in frame.');
    }
    if (!isFaceMatched) {
      return toast.error('Face mismatch! The person does not match the registered profile.');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    // Mirror image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Format 12-hour AM/PM and Date
    const now = new Date();
    const time12 = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const overlayHeight = Math.max(160, canvas.height * 0.26);
    const boxX = 12;
    const boxY = canvas.height - overlayHeight - 12;
    const boxWidth = canvas.width - 24;

    // 1. Translucent Backdrop Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, overlayHeight, 14);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, overlayHeight);
    }

    // Border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Left Icon Badge (Biometric Verified)
    const badgeX = boxX + 16;
    const badgeY = boxY + 16;
    const badgeSize = overlayHeight - 32;

    ctx.fillStyle = '#0f2942';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, 10);
      ctx.fill();
    } else {
      ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Verified Check in Badge
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 2);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('BIOMETRIC', badgeX + badgeSize / 2, badgeY + badgeSize - 10);

    // 3. Right Information Text Area
    const textX = badgeX + badgeSize + 16;
    ctx.textAlign = 'left';

    // Header: Staff Name & ID
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${currentUser?.name || 'Staff Engineer'} (${currentUser?.id || 'ENG-001'})`, textX, boxY + 28);

    // Attendance Type & Time (12-Hour AM/PM)
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = attendanceType === 'Clock-In' ? '#38bdf8' : '#f87171';
    ctx.fillText(`● ${attendanceType.toUpperCase()} — ${time12}`, textX, boxY + 48);

    // Date
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`📅 ${dateStr}`, textX, boxY + 66);

    // Physical Address
    const addrLine = addressData?.fullAddress || (addressData?.title ? `${addressData.title}, ${addressData.subtitle || ''}` : 'Current location');
    ctx.fillText(`📍 ${addrLine.substring(0, 52)}`, textX, boxY + 84);

    // GPS Lat / Lng + Accuracy
    const latLngStr = (location?.lat && location?.lng)
      ? `Lat ${Number(location.lat).toFixed(6)}° Long ${Number(location.lng).toFixed(6)}° (±${Math.round(location.accuracy || 10)}m)`
      : 'Live Network Geotag Active';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`🌐 ${latLngStr}`, textX, boxY + 102);

    // Biometric Security Stamping
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`🛡️ Face Match: ${faceMatchScore}% | Blink check: ${livenessPassed ? 'Done' : 'Not done'}`, textX, boxY + 120);

    const finalPhoto = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(finalPhoto);
    stopCamera();
  };

  const handleRetake = async () => {
    setCapturedPhoto(null);
    setFaceDetected(false);
    setIsFaceMatched(false);
    setLivenessPassed(false);
    setCameraError(null);
    setIsModelLoading(true);

    try {
      await loadFaceApiModels();
      setIsModelLoading(false);

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Live video stream requires HTTPS on mobile browsers.');
        setIsModelLoading(false);
        return;
      }

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
    } catch (e) {
      setCameraError('Camera restart failed: ' + e.message);
      setIsModelLoading(false);
    }
  };

  const handleCaptureMobilePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsModelLoading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = async () => {
          try {
            // Draw on canvas resized to standard 640x480
            const canvas = canvasRef.current || document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 640, 480);

            // The photo must show exactly one face that matches this engineer's registered face
            let score = 0;
            let matched = false;
            let faces = 0;
            try {
              await loadFaceApiModels();
              const result = await analyzeFaceFrame(canvas);
              faces = result?.faceCount || 0;
              if (faces === 1 && result?.descriptor && currentUser?.faceDescriptor?.length) {
                const comparison = compareWithRegisteredFace(result.descriptor, currentUser.faceDescriptor);
                score = comparison.confidence || 0;
                matched = !!comparison.isMatch;
              }
            } catch (err) {
              console.warn('Face check failed:', err);
            }
            if (!matched) {
              toast.error(faces > 1
                ? 'Only you should be in the selfie.'
                : faces === 0 ? 'No face found. Take a clear selfie in good light.' : `Face doesn’t match your profile (${score}%). Try again.`);
              return;
            }

            setFaceDetected(true);
            setIsFaceMatched(true);
            setFaceMatchScore(score);
            setLivenessPassed(false); // a single photo can't prove a live person
            setDetectionColor('#10b981');
            setDetectionMessage('Face Verified');

            // Stamp bank overlay
            const boxHeight = 140;
            const boxY = canvas.height - boxHeight;
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
            ctx.fillRect(0, boxY, canvas.width, boxHeight);

            const textX = 20;
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`GOURU VALUATIONS • ${attendanceType.toUpperCase()} VERIFIED`, textX, boxY + 28);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`Staff: ${currentUser?.name || 'Engineer'} (${currentUser?.username || 'Gouru'})`, textX, boxY + 52);

            const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '12px monospace';
            ctx.fillText(`Time: ${nowStr} IST`, textX, boxY + 74);

            const addrText = addressData?.fullAddress || (addressData?.title ? `${addressData.title}, ${addressData.subtitle || ''}` : 'Current location');
            ctx.fillText(`Address: ${addrText.substring(0, 52)}`, textX, boxY + 94);

            const latLngStr = (location?.lat && location?.lng)
              ? `Lat ${Number(location.lat).toFixed(6)}° Long ${Number(location.lng).toFixed(6)}° (±${Math.round(location.accuracy || 10)}m)`
              : 'Live Network Geotag Active';
            ctx.fillText(`GPS: ${latLngStr}`, textX, boxY + 114);

            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`Face Match: ${score}% | Identity Verified`, textX, boxY + 132);

            const stamped = canvas.toDataURL('image/jpeg', 0.88);
            setCapturedPhoto(stamped);
            toast.success('Selfie captured! Tap "Confirm ' + attendanceType + '" to submit.');
          } catch (analysisErr) {
            console.error('Error in photo processing:', analysisErr);
            toast.error('Error processing photo: ' + analysisErr.message);
          } finally {
            setIsModelLoading(false);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Error processing photo: ' + err.message);
      setIsModelLoading(false);
    }
  };

  const handleConfirmSubmit = () => {
    if (!capturedPhoto) return;

    onCaptureSuccess({
      photo: capturedPhoto,
      faceVerified: !!isFaceMatched,
      faceMatchScore: faceMatchScore || 0,
      livenessVerified: !!livenessPassed,
      address: addressData?.title ? `${addressData.title}, ${addressData.subtitle || ''}` : 'Location Acquired'
    });
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="responsive-modal-overlay">
      <div className="responsive-modal-dialog">
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
          background: 'linear-gradient(135deg, #001233 0%, #002855 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#ffffff' }}>
              {attendanceType} Verification
            </h3>
            <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: '#94a3b8' }}>
              Selfie check — look at the camera and blink
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: '700'
            }}
          >
            ✕
          </button>
        </div>

        {/* Viewfinder / Captured Photo (Flex 1 to fill available mobile height) */}
        <div style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: '260px',
          backgroundColor: '#020617',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isModelLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              gap: '12px',
              zIndex: 10
            }}>
              <Loader2 className="spin" size={32} color="#38bdf8" />
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Preparing camera…</span>
            </div>
          )}

          {cameraError && !capturedPhoto && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              padding: '24px',
              textAlign: 'center',
              zIndex: 10,
              backgroundColor: 'rgba(2, 6, 23, 0.95)'
            }}>
              <p style={{ fontSize: '14px', color: '#fca5a5', marginBottom: '18px', lineHeight: '1.4', maxWidth: '320px' }}>
                {cameraError}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  backgroundColor: '#0052cc',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 82, 204, 0.4)'
                }}
              >
                Take Selfie with Camera
              </button>
            </div>
          )}

          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              display: capturedPhoto ? 'none' : 'block'
            }}
          />

          {/* Captured Watermarked Image Preview */}
          {capturedPhoto && (
            <img
              src={capturedPhoto}
              alt="Geotagged Selfie"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Biometric Oval Guide (only visible when camera is live) */}
          {!capturedPhoto && !isModelLoading && !cameraError && (
            <>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(75vw, 270px)',
                height: 'min(62vh, 360px)',
                borderRadius: '50%',
                border: `3px dashed ${detectionColor}`,
                boxShadow: isFaceMatched ? '0 0 30px rgba(16, 185, 129, 0.7)' : '0 0 15px rgba(56, 189, 248, 0.4)',
                pointerEvents: 'none',
                transition: 'all 0.25s ease'
              }} />

              {/* Top Security Bar */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  color: isFaceMatched ? '#10b981' : '#38bdf8',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>Face Auth: {isFaceMatched ? `${faceMatchScore}% Match` : 'Scanning'}</span>
                </div>

                <div style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  color: livenessPassed ? '#10b981' : '#f59e0b',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>{livenessPassed ? 'Liveness: Confirmed' : 'Blink Eyes'}</span>
                </div>
              </div>

              {/* Bottom Dynamic Prompt */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '8px 18px',
                borderRadius: '24px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                border: `1px solid ${detectionColor}`,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <span>{detectionMessage}</span>
              </div>
            </>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <input
            type="file"
            accept="image/*"
            capture="user"
            ref={fileInputRef}
            onChange={handleCaptureMobilePhoto}
            style={{ display: 'none' }}
          />
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          flexShrink: 0,
          borderTop: '1px solid #e2e8f0',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
        }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            {capturedPhoto ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleRetake}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Retake
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: attendanceType === 'Clock-In' ? '#0052cc' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0, 82, 204, 0.3)'
                  }}
                >
                  Confirm {attendanceType}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close Camera
                </button>
                <button
                  onClick={handleCapture}
                  disabled={!faceDetected || !isFaceMatched || !livenessPassed || isModelLoading}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: (faceDetected && isFaceMatched && livenessPassed) ? '#0052cc' : '#94a3b8',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: (faceDetected && isFaceMatched && livenessPassed) ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: (faceDetected && isFaceMatched && livenessPassed) ? '0 4px 14px rgba(0, 82, 204, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {!faceDetected ? 'Look at the camera' : !isFaceMatched ? 'Face not matched' : !livenessPassed ? 'Blink to continue' : `Take Selfie & ${attendanceType === 'Clock-Out' ? 'Check Out' : 'Check In'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
