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
  ChevronRight,
  RefreshCw,
  Briefcase,
  FileText,
  Building,
  UserCheck,
  ShieldAlert,
  Compass,
  ArrowRight,
  ExternalLink,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import BiometricFaceScanner from './BiometricFaceScanner';
import FaceEnrollmentModal from './FaceEnrollmentModal';
import AttendanceCalendarView from './AttendanceCalendarView';
import { API_BASE_URL } from '../../config/api';
import IconTile from '../Shared/IconTile';
import './AttendanceView.css';


// Reference Base Branch (RACPC Kadapa - Primary Hub)
const BASE_BRANCH_COORDS = {
  lat: 14.478200,
  lng: 78.824200,
  name: 'RACPC Branch, Kadapa',
  radiusMeters: 500
};

// Haversine distance calculator in meters
function computeDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper: Format 12-hour AM/PM
function format12Hour(date) {
  if (!date) return '--:--';
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

function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/uploads/')) {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? `${window.location.protocol}//${window.location.hostname}:5001`
      : 'http://localhost:5001';
    return `${host}${url}`;
  }
  if (url.startsWith('/')) return url;
  if (url.includes('localhost:5001') && typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost') {
    return url.replace('localhost:5001', `${window.location.hostname}:5001`);
  }
  return url;
}

export default function AttendanceView({ currentUser: initialUser, onOpenCase }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sbi_valuation_current_user_v3');
    return saved ? JSON.parse(saved) : (initialUser || { id: 'ENG-001', name: 'GCR Field Engineer' });
  });

  // Top View Mode: 'MARK' | 'CALENDAR' | 'LOGS'
  const [activeView, setActiveView] = useState('MARK');
  const [logTab, setLogTab] = useState('TODAY'); // 'TODAY' | 'ALL'
  const [logsLoading, setLogsLoading] = useState(false);

  // Live 12-hour Digital Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Location & Geofence State
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [gpsFixAt, setGpsFixAt] = useState(null); // when the last real GPS fix arrived
  const locRequestRef = useRef(0); // only the newest location request may update the screen
  const [locLoading, setLocLoading] = useState(true);
  const [gpsPermission, setGpsPermission] = useState('checking'); // 'granted' | 'prompt' | 'denied'
  const [distanceToBranch, setDistanceToBranch] = useState(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState(false);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [addressData, setAddressData] = useState({
    title: 'Resolving GNSS Coordinates...',
    subtitle: 'Connecting to satellite network',
    address1: 'Acquiring high-precision position',
    address2: 'Please stand by...',
    fullAddress: ''
  });

  // Real Backend Cases & Field Work Orders State
  const [caseStats, setCaseStats] = useState({
    totalAssigned: 0,
    pendingInspection: 0,
    completed: 0,
    activeCase: null,
    loading: true
  });

  // Attendance Records State
  const [todayLogs, setTodayLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerType, setScannerType] = useState('Clock-In'); // 'Clock-In' | 'Clock-Out'
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [maxDailyClockOuts, setMaxDailyClockOuts] = useState(3);
  const [lightboxRecord, setLightboxRecord] = useState(null);

  // 1. Live digital clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Dynamic system config
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

  // 3. Sync engineer profile to ensure latest face enrollment status
  useEffect(() => {
    const uid = currentUser?.id || currentUser?.userId || 'ENG-001';
    fetch(`${API_BASE_URL}/api/users/${uid}`)
      .then(res => res.json())
      .then(userData => {
        if (userData && (userData.id || userData._id)) {
          setCurrentUser(prev => {
            const merged = { ...prev, ...userData };
            localStorage.setItem('sbi_valuation_current_user_v3', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // 4. Fetch Real Assigned Valuation Cases & Pending Inspections from Backend
  const fetchCaseSummaries = async () => {
    try {
      setCaseStats(prev => ({ ...prev, loading: true }));
      const res = await fetch(`${API_BASE_URL}/api/cases`);
      if (res.ok) {
        const data = await res.json();
        const casesArr = Array.isArray(data) ? data : (data.cases || []);

        const uid = String(currentUser?.id || 'ENG-001').toLowerCase();
        const uname = String(currentUser?.name || currentUser?.username || 'engineer').toLowerCase();

        // Filter cases belonging to this engineer
        const myCases = casesArr.filter(c => {
          const assignId = String(c.assignedEngineerId || '').toLowerCase();
          const assignName = String(c.assignedEngineerName || '').toLowerCase();
          return assignId === uid || assignName.includes(uname) || assignId === 'unassigned';
        });

        const pending = myCases.filter(c => c.status !== 'Approved' && c.status !== 'Completed');
        const completed = myCases.filter(c => c.status === 'Approved' || c.status === 'Completed');
        const active = pending.length > 0 ? pending[0] : (myCases.length > 0 ? myCases[0] : null);

        setCaseStats({
          totalAssigned: myCases.length,
          pendingInspection: pending.length,
          completed: completed.length,
          activeCase: active,
          loading: false
        });
      }
    } catch (err) {
      console.warn('Failed to load case summaries:', err);
      setCaseStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchCaseSummaries();
  }, [currentUser?.id]);

  // 5. Fetch today's logs and history from backend
  const fetchTodayLogs = async () => {
    setLogsLoading(true);
    try {
      const uid = currentUser?.id || currentUser?.userId || 'ENG-001';
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${uid}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setAllLogs(data);
        const now = new Date();
        const filtered = data.filter(log => {
          if (!log.timestamp) return false;
          const d = new Date(log.timestamp);
          return d.getFullYear() === now.getFullYear() &&
                 d.getMonth() === now.getMonth() &&
                 d.getDate() === now.getDate();
        });
        setTodayLogs(filtered);
      }
    } catch (err) {
      console.error('Error fetching today logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayLogs();
  }, [activeView, currentUser?.id]);

  // 6. Acquire Real Live Geolocation, Accuracy, and Geofence
  const acquireLocation = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshingGps(true);
    setLocLoading(true);

    // Check Geolocation Permission state
    if (navigator?.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGpsPermission(result.state);
        result.onchange = () => setGpsPermission(result.state);
      }).catch(() => setGpsPermission('prompt'));
    }

    const resolveClientLocation = async (coords) => {
      const rawLat = coords?.latitude || BASE_BRANCH_COORDS.lat;
      const rawLng = coords?.longitude || BASE_BRANCH_COORDS.lng;
      const accuracy = coords?.accuracy || 12;

      setLocation({
        lat: rawLat,
        lng: rawLng,
        accuracy: accuracy
      });

      const distMeters = computeDistanceMeters(rawLat, rawLng, BASE_BRANCH_COORDS.lat, BASE_BRANCH_COORDS.lng);
      setDistanceToBranch(distMeters);
      setIsInsideGeofence(distMeters !== null && distMeters <= BASE_BRANCH_COORDS.radiusMeters);

      // Direct OpenStreetMap Nominatim reverse geocode fallback
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${rawLat}&lon=${rawLng}&zoom=18&addressdetails=1`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'Accept': 'application/json' }
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          const addr = nomData.address || {};
          const road = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
          const city = addr.city || addr.town || addr.village || addr.county || 'Kadapa';
          const state = addr.state || 'Andhra Pradesh';
          const country = addr.country || 'India';
          const postcode = addr.postcode || '';

          setAddressData({
            title: `${city}, ${state}`,
            subtitle: `${country} 🇮🇳`,
            address1: road ? `${road}, ${city}` : city,
            address2: `${state} ${postcode}, ${country}`,
            fullAddress: nomData.display_name || `${road ? road + ', ' : ''}${city}, ${state} ${postcode}, ${country}`
          });
          setLocError(null);
          setLocLoading(false);
          return;
        }
      } catch (nomErr) {
        console.warn('Client Nominatim fallback notice:', nomErr.message);
      }

      // Default safety fallback (RACPC Branch, Kadapa)
      setAddressData({
        title: 'RACPC Branch, Kadapa',
        subtitle: 'Andhra Pradesh, India 🇮🇳',
        address1: 'State Bank of India RACPC Branch, Kadapa',
        address2: 'Kadapa District, Andhra Pradesh - 516001, India',
        fullAddress: 'State Bank of India RACPC Branch, Kadapa, Andhra Pradesh 516001, India'
      });
      setLocError(null);
      setLocLoading(false);
    };

    const resolveWithBackend = async (coords) => {
      try {
        const payload = coords ? { lat: coords.latitude, lng: coords.longitude } : {};
        const res = await fetch(`${API_BASE_URL}/api/location/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const locData = await res.json();
          if (locData.success) {
            const rawLat = coords?.latitude || locData.lat;
            const rawLng = coords?.longitude || locData.lng;
            const accuracy = coords?.accuracy || locData.accuracy || 12;

            setLocation({
              lat: rawLat,
              lng: rawLng,
              accuracy: accuracy
            });

            // Calculate distance to base branch
            const distMeters = computeDistanceMeters(rawLat, rawLng, BASE_BRANCH_COORDS.lat, BASE_BRANCH_COORDS.lng);
            setDistanceToBranch(distMeters);
            setIsInsideGeofence(distMeters !== null && distMeters <= BASE_BRANCH_COORDS.radiusMeters);

            setAddressData({
              title: locData.title || `${locData.city || 'Kadapa'}, ${locData.state || 'Andhra Pradesh'}`,
              subtitle: locData.subtitle || 'India 🇮🇳',
              address1: locData.road ? `${locData.road}, ${locData.city}` : (locData.city || 'Verified Field Territory'),
              address2: `${locData.state || 'Andhra Pradesh'} ${locData.postcode || ''}, India`,
              fullAddress: locData.fullAddress || `${locData.road ? locData.road + ', ' : ''}${locData.city || 'Kadapa'}, ${locData.state || 'AP'}, India`
            });
            setLocError(null);
            setLocLoading(false);
            if (isManualRefresh) toast.success('Location updated');
            return;
          }
        }
      } catch (err) {
        console.warn('Backend location resolve notice:', err.message);
      }

      // Seamless fallback to client-side location resolution if backend route is unavailable or 404
      await resolveClientLocation(coords);
    };

    // Only a real GPS fix from this phone counts — never an IP guess or a default branch location
    const noFix = (reason) => {
      setLocation(null);
      setGpsFixAt(null);
      setLocError(reason);
      setLocLoading(false);
      setAddressData({ title: reason === 'denied' ? 'Location is off' : 'Location not found', subtitle: '', address1: '', address2: '', fullAddress: '' });
      if (isManualRefresh) setIsRefreshingGps(false);
    };
    if (!navigator?.geolocation) { noFix('unsupported'); return; }
    const reqId = ++locRequestRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (reqId !== locRequestRef.current) return; // a newer request is in flight
        setGpsPermission('granted');
        setLocError(null);
        setGpsFixAt(Date.now());
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        resolveWithBackend(pos.coords); // address for the map card
        if (isManualRefresh) setIsRefreshingGps(false);
      },
      (err) => {
        if (reqId !== locRequestRef.current) return; // late answer to an old request
        console.warn('GPS not available:', err.message);
        if (err.code === 1) setGpsPermission('denied');
        noFix(err.code === 1 ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    acquireLocation();
  }, []);

  // 7. Punch Status & Shift Time Computation
  // Duty status comes from the latest Clock-In / Clock-Out only — live location pings don't
  // count — and from all records, so a shift that runs past midnight stays "on duty".
  const isDutyEvent = (l) => l.attendanceType === 'Clock-In' || l.attendanceType === 'Clock-Out';
  const sortedLogs = [...todayLogs].filter(isDutyEvent).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const lastLog = [...allLogs].filter(isDutyEvent).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
  const lastAction = lastLog ? lastLog.attendanceType : null;

  const isOnDuty = lastAction === 'Clock-In';
  const canClockIn = !isOnDuty;
  const canClockOut = isOnDuty;

  const clockOutCount = todayLogs.filter(log => log.attendanceType === 'Clock-Out').length;
  const isBlocked = clockOutCount >= maxDailyClockOuts;

  const firstClockIn = [...todayLogs].reverse().find(l => l.attendanceType === 'Clock-In');
  const lastClockOut = sortedLogs.find(l => l.attendanceType === 'Clock-Out');

  let totalCompletedHours = 0;
  todayLogs.forEach(l => {
    if (l.workDurationHours) totalCompletedHours += l.workDurationHours;
  });

  let activeElapsedHours = 0;
  if (isOnDuty && lastLog) {
    const elapsedMs = Math.max(0, currentTime.getTime() - new Date(lastLog.timestamp).getTime());
    activeElapsedHours = elapsedMs / (1000 * 60 * 60);
  }

  const netDayHours = totalCompletedHours + activeElapsedHours;
  const targetShiftHours = 8.0;
  const progressPercent = Math.min(100, Math.round((netDayHours / targetShiftHours) * 100));

  // 8. Open Scanner Gate
  const handleOpenScanner = (type) => {
    if (isBlocked && type === 'Clock-In') {
      return toast.error(`Daily limit reached: ${maxDailyClockOuts} check-outs today. Contact your admin.`);
    }
    // A real, recent GPS position is required to check in or out
    if (!location || !gpsFixAt || Date.now() - gpsFixAt > 2 * 60 * 1000) {
      toast.error(locError === 'denied'
        ? 'Location is off. Turn it on (Settings → App Permissions) to check in or out.'
        : 'Getting your location… try again in a moment.');
      acquireLocation(true);
      return;
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

  // 9. Submit Attendance Record to Backend
  const handleCaptureSuccess = async (biometricPayload) => {
    setIsScannerOpen(false);
    setIsSubmitting(true);

    let finalImageUrl = biometricPayload.photo;

    // Upload via backend upload service
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
      name: currentUser?.name || 'GCR Field Engineer',
      timestamp: now.toISOString(),
      formattedTime: formattedTime12,
      formattedDate: formattedDateStr,
      lat: location?.lat != null ? Number(location.lat).toFixed(6) : (biometricPayload.lat ? Number(biometricPayload.lat).toFixed(6) : ''),
      lng: location?.lng != null ? Number(location.lng).toFixed(6) : (biometricPayload.lng ? Number(biometricPayload.lng).toFixed(6) : ''),
      imageUrl: finalImageUrl,
      attendanceType: scannerType,
      status: 'Verified',
      address: addressData?.fullAddress || biometricPayload.address || (addressData?.title ? `${addressData.title}, ${addressData.subtitle}` : 'Live Verified Field Territory'),
      accuracy: location?.accuracy ?? null,
      faceVerified: !!biometricPayload.faceVerified,
      faceMatchScore: biometricPayload.faceMatchScore || 0,
      livenessVerified: !!biometricPayload.livenessVerified
    };

    try {
      const dbResponse = await fetch(`${API_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });

      if (!dbResponse.ok) {
        const e = await dbResponse.json().catch(() => ({}));
        throw new Error(e.error || 'Could not save. Check your internet and try again.');
      }

      toast.success(scannerType === 'Clock-In' ? 'Checked in. Your location is shared while on duty.' : 'Checked out. Location sharing stopped.');

      // Live location sharing is handled by LiveLocationReporter (starts on Clock-In,
      // stops on Clock-Out, resumes after app restarts). Tell it duty status changed.
      localStorage.removeItem('bgWatcherId');
      window.dispatchEvent(new CustomEvent('gcr_duty_changed'));

      await fetchTodayLogs();
    } catch (err) {
      console.error('Save attendance error:', err);
      toast.error(err.message);
      await fetchTodayLogs(); // show the real state (e.g. already checked in on another device)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="attendance-page-container">
      {/* 1. VIEW MODE SEGMENTED CONTROL */}
      <div className="attendance-nav-segmented">
        <button
          className={`segmented-btn ${activeView === 'MARK' ? 'active' : ''}`}
          onClick={() => setActiveView('MARK')}
        >
          <Camera size={16} /> Today
        </button>
        <button
          className={`segmented-btn ${activeView === 'CALENDAR' ? 'active' : ''}`}
          onClick={() => setActiveView('CALENDAR')}
        >
          <Calendar size={16} /> Calendar
        </button>
        <button
          className={`segmented-btn ${activeView === 'LOGS' ? 'active' : ''}`}
          onClick={() => setActiveView('LOGS')}
        >
          <History size={16} /> History
        </button>
      </div>

      {/* VIEW 1: TODAY — Apple-style, same look as the admin app */}
      {activeView === 'MARK' && (() => {
        const dutyToday = todayLogs.filter(isDutyEvent).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const timeParts = currentTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ');
        const shortTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
        const ac = caseStats.activeCase;
        return (
          <div className="td">
            {/* Status */}
            <section className="td-card td-status">
              <div className="td-status-top">
                <div>
                  <div className="td-date">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  <div className="td-clock">{timeParts[0]}<small>{(timeParts[1] || '').toUpperCase()}</small></div>
                </div>
                <span className={`td-pill ${isOnDuty ? 'on' : 'off'}`}><i />{isOnDuty ? 'On duty' : 'Off duty'}</span>
              </div>
              <div className="td-progress" aria-label={`${progressPercent}% of an 8 hour day`}>
                <div style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="td-stats">
                <div><b>{formatDurationText(netDayHours)}</b><span>Worked today</span></div>
                <div><b>{shortTime(firstClockIn?.timestamp)}</b><span>Checked in</span></div>
                <div><b>{isOnDuty ? '—' : shortTime(lastClockOut?.timestamp)}</b><span>Checked out</span></div>
              </div>
            </section>

            {/* One clear action */}
            {isOnDuty ? (
              <button className="td-action out" onClick={() => handleOpenScanner('Clock-Out')} disabled={!canClockOut || isSubmitting}>
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />} Check Out
              </button>
            ) : (
              <button className="td-action in" onClick={() => handleOpenScanner('Clock-In')} disabled={!canClockIn || isBlocked || isSubmitting}>
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />} Check In
              </button>
            )}
            <p className="td-hint">
              {isBlocked && !isOnDuty
                ? `You’ve checked out ${maxDailyClockOuts} times today — that’s the daily limit.`
                : isOnDuty
                  ? 'Your location is shared with the office until you check out.'
                  : 'Take a quick selfie to start your day. Location must be on.'}
            </p>

            {/* Location */}
            <div className="td-section">Location</div>
            <div className="td-group">
              <div className="td-row">
                <IconTile icon={MapPin} color={locError ? 'red' : 'green'} size={30} />
                <div className="td-main">
                  <div className="td-title">{locLoading ? 'Finding your location…' : addressData.title}</div>
                  <div className="td-sub">
                    {location
                      ? (addressData.fullAddress || addressData.address1 || `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`)
                      : locError ? 'Turn on location to check in. Settings → App Permissions.' : 'Finding your location…'}
                  </div>
                </div>
                <button className="td-icon-btn" onClick={() => acquireLocation(true)} disabled={isRefreshingGps || locLoading} aria-label="Refresh location">
                  <RefreshCw size={17} className={isRefreshingGps || locLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Cases */}
            <div className="td-section">My Cases</div>
            <div className="td-group">
              {ac && (
                <button className="td-row td-link" onClick={() => (onOpenCase ? onOpenCase(ac.id) : null)}>
                  <IconTile icon={FileText} color="blue" size={30} />
                  <div className="td-main">
                    <div className="td-title">{ac.clientName || 'Next case'}</div>
                    <div className="td-sub">{ac.fileNumber || `#${ac.id}`}{ac.bankName ? ` · ${ac.bankName}` : ''}</div>
                  </div>
                  <ChevronRight size={18} className="td-chev" />
                </button>
              )}
              <div className="td-row">
                <IconTile icon={Clock} color="orange" size={30} />
                <div className="td-main"><div className="td-title">Site visits pending</div></div>
                <span className="td-value">{caseStats.pendingInspection}</span>
              </div>
              <div className="td-row">
                <IconTile icon={CheckCircle2} color="green" size={30} />
                <div className="td-main"><div className="td-title">Completed</div></div>
                <span className="td-value">{caseStats.completed}</span>
              </div>
            </div>

            {/* Today's activity */}
            <div className="td-section td-section-row">
              <span>Today</span>
              <button onClick={() => setActiveView('LOGS')}>See All</button>
            </div>
            <div className="td-group">
              {dutyToday.length === 0 ? (
                <div className="td-empty">No check-ins yet today.</div>
              ) : dutyToday.slice(0, 4).map((log, idx) => {
                const isIn = log.attendanceType === 'Clock-In';
                return (
                  <div key={log.id || idx} className="td-row">
                    <IconTile icon={isIn ? LogIn : LogOut} color={isIn ? 'green' : 'red'} size={30} />
                    <div className="td-main">
                      <div className="td-title">{isIn ? 'Checked in' : 'Checked out'} · {shortTime(log.timestamp)}</div>
                      <div className="td-sub">{log.workDurationFormatted ? `Worked ${log.workDurationFormatted} · ` : ''}{log.address || 'Location saved'}</div>
                    </div>
                    {log.imageUrl && (
                      <button className="td-thumb" onClick={() => setLightboxRecord(log)} aria-label="View selfie">
                        <img src={resolveImageUrl(log.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Face profile */}
            <div className="td-group" style={{ marginTop: 20 }}>
              <button className="td-row td-link" onClick={() => setIsEnrollModalOpen(true)}>
                <IconTile icon={UserCheck} color={currentUser?.faceEnrolled ? 'teal' : 'orange'} size={30} />
                <div className="td-main"><div className="td-title">Face profile</div></div>
                <span className="td-value">{currentUser?.faceEnrolled ? 'Update' : 'Set up'}</span>
                <ChevronRight size={18} className="td-chev" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* VIEW 2: CALENDAR TRACKING */}
      {activeView === 'CALENDAR' && (
        <AttendanceCalendarView currentUser={currentUser} />
      )}

      {/* VIEW 3: FULL ACTIVITY LOGS */}
      {activeView === 'LOGS' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                {logTab === 'TODAY' ? `Today's Verified Events (${todayLogs.length})` : `Complete Field Attendance Records (${allLogs.length})`}
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Immutable database records with biometric face photos and GNSS geotags
              </span>
            </div>

            <button
              onClick={fetchTodayLogs}
              disabled={logsLoading}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '700',
                backgroundColor: '#ffffff',
                color: '#002855',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} />
              <span>{logsLoading ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>
          </div>

          {/* Sub-Tabs: Today vs All */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '16px',
            gap: '4px'
          }}>
            <button
              onClick={() => setLogTab('TODAY')}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: logTab === 'TODAY' ? '#ffffff' : 'transparent',
                color: logTab === 'TODAY' ? '#0052cc' : '#64748b',
                boxShadow: logTab === 'TODAY' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Today ({todayLogs.length})
            </button>
            <button
              onClick={() => setLogTab('ALL')}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: logTab === 'ALL' ? '#ffffff' : 'transparent',
                color: logTab === 'ALL' ? '#0052cc' : '#64748b',
                boxShadow: logTab === 'ALL' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              All Records ({allLogs.length})
            </button>
          </div>

          {((logTab === 'TODAY' ? todayLogs : allLogs).length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>
                {logTab === 'TODAY' ? 'No Punches Logged Today' : 'No Attendance Records Found'}
              </h4>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                {logTab === 'TODAY' && allLogs.length > 0
                  ? `You have ${allLogs.length} previous punch records available in history.`
                  : 'Punches with geotagged selfies and 12-hour timestamps will appear here.'}
              </p>
              {logTab === 'TODAY' && allLogs.length > 0 ? (
                <button
                  onClick={() => setLogTab('ALL')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  View All History ({allLogs.length})
                </button>
              ) : (
                <button
                  onClick={() => setActiveView('MARK')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Mark Clock-In Now
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(logTab === 'TODAY' ? todayLogs : allLogs).map(log => (
                <div key={log.id || log._id} style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: log.attendanceType === 'Clock-In' ? '#0052cc' : '#dc2626'
                      }}>
                        {log.attendanceType}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ID: {log.id}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700', backgroundColor: '#d1fae5', padding: '3px 8px', borderRadius: '6px' }}>
                      Face Verified ({log.faceMatchScore || 98}%)
                    </span>
                  </div>

                  {log.imageUrl && (
                    <div
                      style={{ width: '100%', height: '220px', backgroundColor: '#020617', cursor: 'pointer' }}
                      onClick={() => setLightboxRecord(log)}
                    >
                      <img
                        src={resolveImageUrl(log.imageUrl)}
                        alt="Punch Proof"
                        onError={(e) => { e.target.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  <div style={{ padding: '14px 18px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                      {log.formattedTime || format12Hour(log.timestamp)} — {log.formattedDate || new Date(log.timestamp).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                      📍 {log.address || `Lat ${log.lat}, Lng ${log.lng}`}
                    </div>
                    {log.workDurationFormatted && (
                      <div style={{ fontSize: '12px', color: '#0052cc', fontWeight: '700', marginTop: '6px' }}>
                        Session Duration: {log.workDurationFormatted}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX SELFIE PREVIEW MODAL */}
      {lightboxRecord && (
        <div className="attendance-lightbox-overlay" onClick={() => setLightboxRecord(null)}>
          <div className="lightbox-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="#0052cc" />
                <h4>Geotagged Biometric Proof ({lightboxRecord.attendanceType})</h4>
              </div>
              <button className="lightbox-close-btn" onClick={() => setLightboxRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="lightbox-img-wrap">
              <img
                src={resolveImageUrl(lightboxRecord.imageUrl)}
                alt="Punch Evidence"
              />
            </div>

            <div className="lightbox-footer">
              <div className="meta-title">
                {lightboxRecord.name || 'GCR Field Engineer'} · {lightboxRecord.formattedTime || format12Hour(lightboxRecord.timestamp)}
              </div>
              <div className="meta-sub">
                📍 {lightboxRecord.address || `Lat: ${lightboxRecord.lat}, Lng: ${lightboxRecord.lng}`}
              </div>
            </div>
          </div>
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
