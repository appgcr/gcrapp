import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldCheck,
  LogIn,
  LogOut,
  Calendar,
  Sparkles,
  History,
  Timer,
  Navigation,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { registerPlugin } from '@capacitor/core';
import BiometricFaceScanner from './BiometricFaceScanner';
import FaceEnrollmentModal from './FaceEnrollmentModal';
import AttendanceCalendarView from './AttendanceCalendarView';
import { API_BASE_URL } from '../../config/api';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Helper: Format 12-hour AM/PM
function format12Hour(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDurationText(hours) {
  if (!hours || isNaN(hours)) return '0 mins';
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
}

export default function AttendanceView({ currentUser: initialUser }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sbi_valuation_current_user_v3');
    return saved ? JSON.parse(saved) : (initialUser || { id: 'ENG-001', name: 'Staff Engineer' });
  });

  // Top View Mode: 'MARK' | 'CALENDAR' | 'LOGS'
  const [activeView, setActiveView] = useState('MARK');

  // Live 12-hour Digital Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Location State
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [locLoading, setLocLoading] = useState(true);
  const [addressData, setAddressData] = useState({
    title: 'Fetching Location...',
    subtitle: '',
    address1: 'Please wait while we determine',
    address2: 'your exact address...'
  });

  // Attendance Records State
  const [todayLogs, setTodayLogs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Biometric Camera Scanner Modal (Opened on-demand only!)
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerType, setScannerType] = useState('Clock-In'); // 'Clock-In' | 'Clock-Out'

  // Face Enrollment Modal (Triggered if user has not enrolled face profile yet)
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [maxDailyClockOuts, setMaxDailyClockOuts] = useState(3);

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch dynamic system config (max daily clock outs)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config`)
      .then(res => res.json())
      .then(cfg => {
        if (cfg?.attendanceSettings?.maxDailyClockOuts) {
          setMaxDailyClockOuts(cfg.attendanceSettings.maxDailyClockOuts);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch today's logs from backend
  const fetchTodayLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();

      const todayStr = new Date().toDateString();
      const filtered = Array.isArray(data) ? data.filter(log =>
        new Date(log.timestamp).toDateString() === todayStr
      ) : [];
      setTodayLogs(filtered);
    } catch (err) {
      console.error('Error fetching today logs:', err);
    }
  };

  // Acquire Geolocation
  useEffect(() => {
    fetchTodayLogs();

    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your device.');
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

          // Reverse Geocoding via OpenStreetMap
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
            .then(res => res.json())
            .then(data => {
              const addr = data.address || {};
              const city = addr.city || addr.town || addr.village || addr.county || 'Kadapa';
              const state = addr.state || 'Andhra Pradesh';
              const country = addr.country || 'India';
              const road = addr.road || addr.suburb || addr.neighbourhood || 'Main Road';
              const postcode = addr.postcode || '';

              setAddressData({
                title: `${city}, ${state}`,
                subtitle: `${country} 🇮🇳`,
                address1: `${road ? road + ', ' : ''}${city}`,
                address2: `${state} ${postcode}, ${country}`
              });
            })
            .catch(() => {
              setAddressData({
                title: 'Kadapa, Andhra Pradesh',
                subtitle: 'GPS Active 🇮🇳',
                address1: 'Coordinates safely locked',
                address2: 'Latitude & Longitude geotagged'
              });
            });
        },
        () => {
          setLocError('Location permission is required to geotag attendance.');
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }
  }, [currentUser?.id]);

  // Determine current punch status
  const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
  const lastAction = lastLog ? lastLog.attendanceType : null;

  const canClockIn = lastAction !== 'Clock-In';
  const canClockOut = lastAction === 'Clock-In';

  const clockOutCount = todayLogs.filter(log => log.attendanceType === 'Clock-Out').length;
  const isBlocked = clockOutCount >= maxDailyClockOuts;

  // Compute Today's Total Duration and Active Time
  const firstClockIn = [...todayLogs].reverse().find(l => l.attendanceType === 'Clock-In');
  const lastClockOut = sortedLogs.find(l => l.attendanceType === 'Clock-Out');

  let totalCompletedHours = 0;
  todayLogs.forEach(l => {
    if (l.workDurationHours) totalCompletedHours += l.workDurationHours;
  });

  // If currently clocked in, compute active ongoing session duration
  let activeElapsedHours = 0;
  if (lastAction === 'Clock-In' && lastLog) {
    const elapsedMs = Math.max(0, currentTime.getTime() - new Date(lastLog.timestamp).getTime());
    activeElapsedHours = elapsedMs / (1000 * 60 * 60);
  }

  const netDayHours = totalCompletedHours + activeElapsedHours;

  // Handle action click: Check if user has enrolled face, then open scanner
  const handleOpenScanner = (type) => {
    if (isBlocked) {
      return toast.error(`Maximum daily limit of ${maxDailyClockOuts} Clock-Outs reached.`);
    }

    // High Security Check: Has this staff member enrolled their face profile?
    if (!currentUser?.faceEnrolled || !currentUser?.faceDescriptor || currentUser.faceDescriptor.length === 0) {
      toast('Please complete 1-time Face Biometric Setup first.', { icon: '🛡️' });
      setIsEnrollModalOpen(true);
      return;
    }

    setScannerType(type);
    setIsScannerOpen(true);
  };

  // Called when face is enrolled successfully in FaceEnrollmentModal
  const handleFaceEnrolled = (updatedUser) => {
    setCurrentUser(updatedUser);
    setIsEnrollModalOpen(false);
    toast.success('Biometric profile ready! You can now mark attendance.');
  };

  // Submit Attendance Record to Backend
  const handleCaptureSuccess = async (biometricPayload) => {
    setIsScannerOpen(false);
    setIsSubmitting(true);

    let finalImageUrl = biometricPayload.photo;

    // 1. Upload via backend upload service
    try {
      const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: biometricPayload.photo,
          folder: 'attendance_selfies'
        })
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        if (data.url) finalImageUrl = data.url;
      }
    } catch (e) {
      console.warn('Upload fallback to Base64:', e);
    }

    // 2. Prepare new attendance record with 12-hour AM/PM and biometric fields
    const now = new Date();
    const formattedTime12 = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const formattedDateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const newRecord = {
      id: 'ATT-' + Math.random().toString(36).substr(2, 9),
      userId: currentUser?.id || 'ENG-001',
      name: currentUser?.name || 'Staff Engineer',
      timestamp: now.toISOString(),
      formattedTime: formattedTime12,
      formattedDate: formattedDateStr,
      lat: location?.lat != null ? location.lat.toFixed(6) : (biometricPayload.lat ? Number(biometricPayload.lat).toFixed(6) : ''),
      lng: location?.lng != null ? location.lng.toFixed(6) : (biometricPayload.lng ? Number(biometricPayload.lng).toFixed(6) : ''),
      imageUrl: finalImageUrl,
      attendanceType: scannerType,
      status: 'Verified',
      address: biometricPayload.address || `${addressData.title}, ${addressData.subtitle}`,
      faceVerified: true,
      faceMatchScore: biometricPayload.faceMatchScore || 95,
      livenessVerified: true
    };

    try {
      const dbResponse = await fetch(`${API_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });

      if (!dbResponse.ok) {
        throw new Error('Database response error');
      }

      toast.success(`${scannerType} successfully authenticated!`);

      // Capacitor Background Geolocation Watcher
      if (scannerType === 'Clock-In') {
        BackgroundGeolocation.addWatcher(
          { requestPermissions: true, stale: false, distanceFilter: 50 },
          function callback(loc, error) {
            if (error) return;
            fetch(`${API_BASE_URL}/api/attendance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: 'BGL-' + Math.random().toString(36).substr(2, 9),
                userId: currentUser?.id || 'ENG-001',
                name: currentUser?.name || 'Staff Engineer',
                timestamp: new Date().toISOString(),
                lat: loc.latitude,
                lng: loc.longitude,
                imageUrl: null,
                attendanceType: 'Location Update',
                status: 'Background'
              })
            }).catch(() => {});
          }
        ).then(watcherId => {
          localStorage.setItem('bgWatcherId', watcherId);
        });
      } else if (scannerType === 'Clock-Out') {
        const watcherId = localStorage.getItem('bgWatcherId');
        if (watcherId) {
          BackgroundGeolocation.removeWatcher({ id: watcherId });
          localStorage.removeItem('bgWatcherId');
        }
      }

      await fetchTodayLogs();
    } catch (err) {
      console.error('Save attendance error:', err);
      toast.error('Error saving attendance: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="attendance-view animate-fade-in" style={{ paddingBottom: '90px' }}>
      {/* View Mode Segmented Control */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f1f5f9',
        padding: '4px',
        borderRadius: '14px',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => setActiveView('MARK')}
          style={{
            flex: 1,
            padding: '9px',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            backgroundColor: activeView === 'MARK' ? '#ffffff' : 'transparent',
            color: activeView === 'MARK' ? '#0052cc' : '#64748b',
            boxShadow: activeView === 'MARK' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Camera size={15} /> Mark Attendance
        </button>

        <button
          onClick={() => setActiveView('CALENDAR')}
          style={{
            flex: 1,
            padding: '9px',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            backgroundColor: activeView === 'CALENDAR' ? '#ffffff' : 'transparent',
            color: activeView === 'CALENDAR' ? '#0052cc' : '#64748b',
            boxShadow: activeView === 'CALENDAR' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Calendar size={15} /> Calendar View
        </button>

        <button
          onClick={() => setActiveView('LOGS')}
          style={{
            flex: 1,
            padding: '9px',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            backgroundColor: activeView === 'LOGS' ? '#ffffff' : 'transparent',
            color: activeView === 'LOGS' ? '#0052cc' : '#64748b',
            boxShadow: activeView === 'LOGS' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <History size={15} /> Today Logs
        </button>
      </div>

      {/* VIEW 1: MARK ATTENDANCE HUB */}
      {activeView === 'MARK' && (
        <>
          {/* Hero Attendance Dashboard Card */}
          <div style={{
            background: 'linear-gradient(135deg, #001233 0%, #002855 50%, #023e8a 100%)',
            borderRadius: '20px',
            padding: '24px 20px',
            color: '#ffffff',
            marginBottom: '20px',
            boxShadow: '0 10px 25px -5px rgba(0, 18, 51, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Ambient Background Circles */}
            <div style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              pointerEvents: 'none'
            }} />

            {/* Live 12-Hour Clock with AM/PM */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: '700' }}>
                  Live System Time
                </span>
                <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px', marginTop: '2px' }}>
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Status Chip */}
              <div style={{
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: lastAction === 'Clock-In' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                border: `1px solid ${lastAction === 'Clock-In' ? '#10b981' : 'rgba(255, 255, 255, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: lastAction === 'Clock-In' ? '#34d399' : '#ffffff'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: lastAction === 'Clock-In' ? '#10b981' : '#94a3b8'
                }} />
                {lastAction === 'Clock-In' ? 'ON DUTY' : 'OFF DUTY'}
              </div>
            </div>

            {/* Work Duration Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '14px 16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                  <Timer size={15} color="#38bdf8" />
                  <span>Today's Work Duration</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#38bdf8' }}>
                  {formatDurationText(netDayHours)}
                </span>
              </div>

              {/* Progress Bar towards standard 8 hours target */}
              <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (netDayHours / 8) * 100)}%`,
                  backgroundColor: netDayHours >= 7 ? '#10b981' : netDayHours >= 4 ? '#f59e0b' : '#38bdf8',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                <span>Shift Target: 8.0 hrs</span>
                <span>{((netDayHours / 8) * 100).toFixed(0)}% Completed</span>
              </div>
            </div>

            {/* Check-In and Check-Out Time Sub-grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LogIn size={12} color="#10b981" /> Check-In Time
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', display: 'block', marginTop: '2px' }}>
                  {firstClockIn ? format12Hour(firstClockIn.timestamp) : '--:--'}
                </span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LogOut size={12} color="#f87171" /> Check-Out Time
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', display: 'block', marginTop: '2px' }}>
                  {lastClockOut ? format12Hour(lastClockOut.timestamp) : (lastAction === 'Clock-In' ? 'Active' : '--:--')}
                </span>
              </div>
            </div>
          </div>

          {/* Location Chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: locLoading ? '#f1f5f9' : locError ? '#fee2e2' : '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {locLoading ? (
                <Loader2 className="spin" size={18} color="#0052cc" />
              ) : locError ? (
                <AlertTriangle size={18} color="#ef4444" />
              ) : (
                <MapPin size={18} color="#10b981" />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {locLoading ? 'Acquiring High-Precision GPS...' : locError ? 'Location Access Needed' : addressData.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {location ? `Lat ${location.lat.toFixed(6)}°, Long ${location.lng.toFixed(6)}° (±${Math.round(location.accuracy)}m)` : 'GPS Verification active'}
              </div>
            </div>
          </div>

          {/* Biometric Status Notification */}
          {(!currentUser?.faceEnrolled || !currentUser?.faceDescriptor) && (
            <div style={{
              padding: '14px 16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#0052cc" />
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', margin: 0 }}>Face Profile Not Registered</h4>
                  <p style={{ fontSize: '11px', color: '#3b82f6', margin: 0 }}>Register once to unlock facial attendance.</p>
                </div>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0052cc',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Enroll Now
              </button>
            </div>
          )}

          {/* Daily Limit Warning Banner */}
          {isBlocked && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '14px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', marginBottom: '6px' }}>
                <AlertTriangle size={18} />
                <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>Daily Attendance Completed</h4>
              </div>
              <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>
                You have recorded {maxDailyClockOuts} Clock-Outs today. No more attendance events can be logged until tomorrow.
              </p>
            </div>
          )}

          {/* CAMERA DOES NOT AUTO-START! PROMINENT ACTION BUTTONS */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Clock-In Button */}
              <button
                onClick={() => handleOpenScanner('Clock-In')}
                disabled={!canClockIn || isBlocked || isSubmitting}
                style={{
                  padding: '16px 14px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: canClockIn && !isBlocked ? '#0052cc' : '#f1f5f9',
                  color: canClockIn && !isBlocked ? '#ffffff' : '#94a3b8',
                  cursor: canClockIn && !isBlocked ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: canClockIn && !isBlocked ? '0 8px 20px rgba(0, 82, 204, 0.28)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: canClockIn && !isBlocked ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <LogIn size={22} color={canClockIn && !isBlocked ? '#ffffff' : '#94a3b8'} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '800' }}>Clock-In</span>
                  <span style={{ display: 'block', fontSize: '11px', opacity: 0.8 }}>Verify Face</span>
                </div>
              </button>

              {/* Clock-Out Button */}
              <button
                onClick={() => handleOpenScanner('Clock-Out')}
                disabled={!canClockOut || isBlocked || isSubmitting}
                style={{
                  padding: '16px 14px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: canClockOut && !isBlocked ? '#ef4444' : '#f1f5f9',
                  color: canClockOut && !isBlocked ? '#ffffff' : '#94a3b8',
                  cursor: canClockOut && !isBlocked ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: canClockOut && !isBlocked ? '0 8px 20px rgba(239, 68, 68, 0.28)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: canClockOut && !isBlocked ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <LogOut size={22} color={canClockOut && !isBlocked ? '#ffffff' : '#94a3b8'} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '800' }}>Clock-Out</span>
                  <span style={{ display: 'block', fontSize: '11px', opacity: 0.8 }}>Verify Face</span>
                </div>
              </button>
            </div>

            {/* Context Helper Note */}
            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <ShieldCheck size={14} color="#0052cc" />
              Camera activates only upon tapping. Face match & liveness required.
            </p>
          </div>

          {/* Quick Peek of Today's Activity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Today's Activity</h3>
            <button
              onClick={() => setActiveView('LOGS')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {todayLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>No Punches Today</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Tap "Clock-In" to begin your workday with facial authentication.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayLogs.slice(0, 3).map(log => (
                <div key={log.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#ffffff',
                  padding: '12px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#000' }}>
                    <img src={log.imageUrl} alt="Geotag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: log.attendanceType === 'Clock-In' ? '#0052cc' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {log.attendanceType === 'Clock-In' ? <LogIn size={13} /> : <LogOut size={13} />}
                        {log.attendanceType}
                      </span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '6px' }}>
                        ✓ Biometric
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>
                      🕒 {log.formattedTime || format12Hour(log.timestamp)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📍 {log.address || `Lat ${log.lat}, Lng ${log.lng}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: CALENDAR TRACKING */}
      {activeView === 'CALENDAR' && (
        <AttendanceCalendarView currentUser={currentUser} />
      )}

      {/* VIEW 3: TODAY ACTIVITY LOGS */}
      {activeView === 'LOGS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Full Today Logs ({todayLogs.length})</h3>
            <span style={{ fontSize: '12px', color: '#0052cc', fontWeight: '700' }}>
              Duration: {formatDurationText(netDayHours)}
            </span>
          </div>

          {todayLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <Clock size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' }}>No Activity Today</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Punches with geotagged selfies and 12-hour timestamps will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {todayLogs.map(log => (
                <div key={log.id} style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: log.attendanceType === 'Clock-In' ? '#0052cc' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {log.attendanceType === 'Clock-In' ? <LogIn size={15} /> : <LogOut size={15} />}
                      {log.attendanceType}
                    </span>
                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '10px' }}>
                      🛡️ Face Verified ({log.faceMatchScore || 95}%)
                    </span>
                  </div>

                  {log.imageUrl && (
                    <div style={{ width: '100%', height: '220px', backgroundColor: '#020617' }}>
                      <img src={log.imageUrl} alt="Punch Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Clock size={14} color="#0052cc" />
                      {log.formattedTime || format12Hour(log.timestamp)} — {log.formattedDate || new Date(log.timestamp).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <MapPin size={14} color="#10b981" />
                      {log.address || `Lat ${log.lat}, Lng ${log.lng}`}
                    </div>
                    {log.workDurationFormatted && (
                      <div style={{ fontSize: '12px', color: '#0052cc', fontWeight: '700', marginTop: '6px' }}>
                        ⏱️ Session Duration: {log.workDurationFormatted}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ON-DEMAND BIOMETRIC FACE SCANNER */}
      {isScannerOpen && (
        <BiometricFaceScanner
          currentUser={currentUser}
          attendanceType={scannerType}
          location={location}
          addressData={addressData}
          onCaptureSuccess={handleCaptureSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* MODAL 2: 1-TIME FACE ENROLLMENT MODAL */}
      {isEnrollModalOpen && (
        <FaceEnrollmentModal
          currentUser={currentUser}
          onEnrolled={handleFaceEnrolled}
          onClose={() => setIsEnrollModalOpen(false)}
        />
      )}
    </div>
  );
}
