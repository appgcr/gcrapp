import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, AlertTriangle, CheckCircle2, Loader2, Check, Clock, ShieldCheck, LogIn, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { registerPlugin } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export default function AttendanceView({ currentUser }) {
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [locLoading, setLocLoading] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState(null);
  const [camLoading, setCamLoading] = useState(true);
  const [photoCaptured, setPhotoCaptured] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [attendanceType, setAttendanceType] = useState('Clock-In');
  const [todayLogs, setTodayLogs] = useState([]);
  
  const [addressData, setAddressData] = useState({
    title: 'Fetching Location...',
    subtitle: '',
    address1: 'Please wait while we determine',
    address2: 'your exact address...'
  });

  const fetchTodayLogs = async () => {
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      
      const today = new Date().toLocaleDateString();
      const filtered = data.filter(log => 
        new Date(log.timestamp).toLocaleDateString() === today
      );
      setTodayLogs(filtered);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTodayLogs();

    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser");
      setLocLoading(false);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({
            lat: lat,
            lng: lng,
            accuracy: position.coords.accuracy
          });
          setLocLoading(false);
          
          // Reverse Geocoding
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
            .then(res => res.json())
            .then(data => {
              const addr = data.address || {};
              const city = addr.city || addr.town || addr.village || addr.county || 'Unknown City';
              const state = addr.state || '';
              const country = addr.country || '';
              const road = addr.road || addr.suburb || addr.neighbourhood || '';
              const postcode = addr.postcode || '';
              
              setAddressData({
                title: `${city}, ${state}`.replace(/(^, |, $)/g, ''),
                subtitle: `${country} 🇮🇳`,
                address1: `${road ? road + ', ' : ''}${city},`,
                address2: `${state} ${postcode}, ${country}`
              });
            })
            .catch(err => {
              console.error(err);
              setAddressData({
                title: 'Location Acquired',
                subtitle: 'GPS Active',
                address1: 'Address lookup failed due to network',
                address2: 'Coordinates are safely captured.'
              });
            });
        },
        (err) => {
          setLocError("Location permission required to geotag photo.");
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setCamLoading(false);
      } catch (err) {
        setCamError("Camera permission denied or no camera found.");
        setCamLoading(false);
      }
    }
    
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
  const lastAction = lastLog ? lastLog.attendanceType : null;
  
  const canClockIn = lastAction !== 'Clock-In';
  const canClockOut = lastAction === 'Clock-In';

  useEffect(() => {
    if (canClockIn && !canClockOut) setAttendanceType('Clock-In');
    if (canClockOut && !canClockIn) setAttendanceType('Clock-Out');
  }, [canClockIn, canClockOut]);

  const clockOutCount = todayLogs.filter(log => log.attendanceType === 'Clock-Out').length;
  const isBlocked = clockOutCount >= 3;

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Realistic GPS Map Camera Watermark (copied from CaseListView)
      const timestamp = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      
      const overlayHeight = Math.max(160, canvas.height * 0.22);
      const mapSize = overlayHeight - 20; 
      const boxX = 10;
      const boxY = canvas.height - overlayHeight - 10;
      
      // 1. Draw Translucent Black Box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, canvas.width - 20, overlayHeight, 12);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, canvas.width - 20, overlayHeight);
      }
      
      // 2. Draw Map Area (Left side)
      const mapX = boxX + 10;
      const mapY = boxY + 10;
      
      ctx.fillStyle = '#475569';
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(mapX, mapY, mapSize, mapSize, 8); ctx.fill();
      } else {
        ctx.fillRect(mapX, mapY, mapSize, mapSize);
      }
      
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      for(let i = 10; i < mapSize; i+= 15) {
          ctx.beginPath(); ctx.moveTo(mapX + i, mapY); ctx.lineTo(mapX + i, mapY + mapSize); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(mapX, mapY + i); ctx.lineTo(mapX + mapSize, mapY + i); ctx.stroke();
      }
      
      const pinX = mapX + mapSize / 2;
      const pinY = mapY + mapSize / 2 - 8;
      ctx.fillStyle = '#ea4335';
      ctx.beginPath(); ctx.arc(pinX, pinY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(pinX - 6, pinY); ctx.lineTo(pinX + 6, pinY); ctx.lineTo(pinX, pinY + 12); ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(pinX, pinY, 2, 0, Math.PI * 2); ctx.fill(); 
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Google', mapX + 5, mapY + mapSize - 8);

      // 3. Draw Text Area (Right side)
      const textX = mapX + mapSize + 15;
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('🗺️ GPS Map Camera', canvas.width - 25, boxY + 25);
      ctx.textAlign = 'left'; 

      ctx.font = '500 18px sans-serif';
      ctx.fillText(addressData.title, textX, boxY + 30);
      ctx.fillText(addressData.subtitle, textX, boxY + 52);
      
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#e2e8f0';
      
      ctx.fillText(addressData.address1, textX, boxY + 75);
      ctx.fillText(addressData.address2, textX, boxY + 92);
      
      const latLongText = location 
        ? `Lat ${location.lat.toFixed(6)}° Long ${location.lng.toFixed(6)}°` 
        : 'Lat 14.467982° Long 78.836882°';
      ctx.fillText(latLongText, textX, boxY + 115);
      
      ctx.fillText(timestamp, textX, boxY + 132);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoCaptured(dataUrl);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleRetake = async () => {
    setPhotoCaptured(null);
    setCamLoading(true);
    setCamError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCamLoading(false);
    } catch (err) {
      setCamError("Camera permission denied.");
      setCamLoading(false);
    }
  };

  const handleSubmitAttendance = async () => {
    setIsSubmitting(true);
    let finalImageUrl = photoCaptured;

    try {
      const formData = new FormData();
      formData.append('file', photoCaptured);
      formData.append('upload_preset', 'KHlIU89A3_r07XZlaT1wSr5dd4U');
      
      const response = await fetch('https://api.cloudinary.com/v1_1/GCR/image/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        finalImageUrl = data.secure_url;
      }
    } catch (e) {
      console.warn("Cloudinary upload failed (possibly incorrect preset), falling back to Base64", e);
    }

    const newRecord = {
      id: 'ATT-' + Math.random().toString(36).substr(2, 9),
      userId: currentUser?.id || 'ENG-001', 
      name: currentUser?.name || 'Staff Engineer', 
      timestamp: new Date().toISOString(),
      lat: location?.lat || 'N/A',
      lng: location?.lng || 'N/A',
      imageUrl: finalImageUrl,
      attendanceType: attendanceType,
      status: 'Verified'
    };

    try {
      const dbResponse = await fetch('https://gcr-9ys1.onrender.com/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      
      if (!dbResponse.ok) {
        throw new Error('Failed to save attendance in MongoDB');
      }
      
      setIsSubmitting(false);
      toast.success(`${attendanceType} successfully logged!`);
      
      if (attendanceType === 'Clock-In') {
        BackgroundGeolocation.addWatcher(
          {
            requestPermissions: true,
            stale: false,
            distanceFilter: 50
          },
          function callback(location, error) {
            if (error) {
              if (error.code === 'NOT_AUTHORIZED') {
                if (window.confirm('This app needs your location, but does not have permission.\n\nOpen settings now?')) {
                  BackgroundGeolocation.openSettings();
                }
              }
              return console.error(error);
            }
            
            fetch('https://gcr-9ys1.onrender.com/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: 'BGL-' + Math.random().toString(36).substr(2, 9),
                userId: currentUser?.id || 'ENG-001',
                name: currentUser?.name || 'Staff Engineer',
                timestamp: new Date().toISOString(),
                lat: location.latitude,
                lng: location.longitude,
                imageUrl: null,
                attendanceType: 'Location Update',
                status: 'Background'
              })
            }).catch(console.error);
          }
        ).then(watcherId => {
          localStorage.setItem('bgWatcherId', watcherId);
        });
      } else if (attendanceType === 'Clock-Out') {
        const watcherId = localStorage.getItem('bgWatcherId');
        if (watcherId) {
          BackgroundGeolocation.removeWatcher({ id: watcherId });
          localStorage.removeItem('bgWatcherId');
        }
      }
      
      setPhotoCaptured(null);
      await fetchTodayLogs();
      handleRetake();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      toast.error('Error saving attendance to Database: ' + err.message);
    }
  };

  return (
    <div className="attendance-view animate-fade-in" style={{ paddingBottom: '80px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Mark Attendance</h1>
      <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
        Capture a geotagged selfie to verify your location.
      </p>

      {isBlocked ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', marginBottom: '8px' }}>
            <AlertTriangle size={20} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Maximum Daily Limit Reached</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#991b1b', margin: 0, lineHeight: '1.4' }}>
            You have already reached the limit of 3 Clock-Outs for today. You cannot log any more attendance events until tomorrow.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            {locLoading ? (
              <><Loader2 className="spin" size={16} color="var(--primary)" /> <span style={{ fontSize: '13px', fontWeight: '500' }}>Acquiring GPS...</span></>
            ) : locError ? (
              <><AlertTriangle size={16} color="var(--danger)" /> <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--danger)' }}>{locError}</span></>
            ) : (
              <><MapPin size={16} color="var(--success)" /> <span style={{ fontSize: '13px', fontWeight: '500', color: '#065f46' }}>GPS Locked (Accuracy: {Math.round(location.accuracy)}m)</span></>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Attendance Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                className={`btn-secondary ${attendanceType === 'Clock-In' ? 'active' : ''}`}
                onClick={() => setAttendanceType('Clock-In')}
                disabled={!canClockIn}
                style={{ 
                  backgroundColor: attendanceType === 'Clock-In' ? 'var(--primary)' : '#fff',
                  color: attendanceType === 'Clock-In' ? '#fff' : 'var(--text-primary)',
                  borderColor: attendanceType === 'Clock-In' ? 'var(--primary)' : 'var(--border-color)',
                  opacity: canClockIn ? 1 : 0.4,
                  cursor: canClockIn ? 'pointer' : 'not-allowed'
                }}
              >
                <LogIn size={18} /> Clock-In
              </button>
              <button 
                className={`btn-secondary ${attendanceType === 'Clock-Out' ? 'active' : ''}`}
                onClick={() => setAttendanceType('Clock-Out')}
                disabled={!canClockOut}
                style={{ 
                  backgroundColor: attendanceType === 'Clock-Out' ? '#ef4444' : '#fff',
                  color: attendanceType === 'Clock-Out' ? '#fff' : 'var(--text-primary)',
                  borderColor: attendanceType === 'Clock-Out' ? '#ef4444' : 'var(--border-color)',
                  opacity: canClockOut ? 1 : 0.4,
                  cursor: canClockOut ? 'pointer' : 'not-allowed'
                }}
              >
                <LogOut size={18} /> Clock-Out
              </button>
            </div>
            {!canClockIn && canClockOut && (
              <p style={{ fontSize: '12px', color: '#059669', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> You are currently clocked in. You can only clock out.
              </p>
            )}
            {!canClockOut && canClockIn && todayLogs.length > 0 && (
              <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> You are currently clocked out. You must clock in first.
              </p>
            )}
          </div>

          <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Geotagged Selfie</h3>
              {photoCaptured ? (
                <span className="badge badge-success" style={{ fontWeight: '600' }}>
                  <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Verified
                </span>
              ) : (
                <span className="badge badge-danger" style={{ fontWeight: '600' }}>
                  <Camera size={12} style={{ marginRight: '4px' }} /> Required
                </span>
              )}
            </div>
            
            <div style={{ position: 'relative', height: '380px', backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {camLoading && !photoCaptured && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <Loader2 className="spin" size={32} />
                  <span style={{ fontWeight: '500', fontSize: '13px' }}>Starting Camera...</span>
                </div>
              )}

              {camError && !photoCaptured && !camLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>
                  <AlertTriangle size={40} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px' }}>{camError}</p>
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
                  display: (photoCaptured || camError || camLoading) ? 'none' : 'block',
                  transform: 'scaleX(-1)'
                }} 
              />
              
              {photoCaptured && (
                <img 
                  src={photoCaptured} 
                  alt="Geotagged Selfie" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              )}

              {!photoCaptured && !camError && !camLoading && (
                <>
                  <div style={{ position: 'absolute', inset: '40px', border: '2px dashed rgba(255, 255, 255, 0.6)', borderRadius: '50%', pointerEvents: 'none' }}></div>
                </>
              )}
              
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
              {photoCaptured ? (
                <button className="btn-secondary" onClick={handleRetake} style={{ width: '100%' }}>
                  Retake Photo
                </button>
              ) : (
                <button 
                  className="btn-primary" 
                  onClick={handleCapturePhoto} 
                  disabled={camLoading || camError || locLoading || locError} 
                  style={{ width: '100%', opacity: (camLoading || camError || locLoading || locError) ? 0.5 : 1 }}
                >
                  <Camera size={18} />
                  {locLoading ? "Waiting for GPS..." : "Capture Geotagged Selfie"}
                </button>
              )}
            </div>
          </div>
          
          <button 
            className="btn-primary" 
            onClick={handleSubmitAttendance}
            disabled={!photoCaptured || isSubmitting} 
            style={{ 
              opacity: (photoCaptured && !isSubmitting) ? 1 : 0.5,
              marginBottom: '32px'
            }}
          >
            {isSubmitting ? <Loader2 className="spin" size={20} /> : (photoCaptured ? <Check size={20} /> : <AlertTriangle size={20} />)}
            {isSubmitting ? 'Uploading...' : (photoCaptured ? `Submit ${attendanceType}` : `Capture Selfie to Submit`)}
          </button>
        </>
      )}

      {/* TODAY'S LOGS */}
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>Today's Activity</h2>
      
      {todayLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>No Attendance Logged</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>You haven't logged any clock-ins or clock-outs today.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {todayLogs.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: '16px', backgroundColor: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                <img src={log.imageUrl} alt="Geotag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '700', 
                    color: log.attendanceType === 'Clock-In' ? 'var(--primary)' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {log.attendanceType === 'Clock-In' ? <LogIn size={14}/> : <LogOut size={14}/>} 
                    {log.attendanceType}
                  </span>
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '12px' }}>
                    <ShieldCheck size={12} /> Verified
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Clock size={12} /> {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ID: {log.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
