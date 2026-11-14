import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Loader2, X, Eye, EyeOff, Maximize2, Copy, Lock, KeyRound, MessageCircle, Navigation, Phone } from 'lucide-react';
import { authHeaders } from '../Shared/authHeaders';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Circle, AttributionControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SmoothBaseMap from '../Shared/SmoothBaseMap';
import BranchesPanel from './BranchesPanel';
import StaffFormSheet from './StaffFormSheet';
import BankUsersPanel from './BankUsersPanel';
import { isSuperAdmin, getBranchScope } from '../../utils/session';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LIVE_POLL_MS = 5000;          // admin map refresh
const STALE_MS = 5 * 60 * 1000;      // no update for 5 min while on duty = "Signal lost"
const DEFAULT_CENTER = [14.4673, 78.8242]; // Kadapa

const localYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const timeAgoShort = (date) => {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hr ago`;
};

// Straight-line distance in km between two { lat, lng } points
const kmBetween = (a, b) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// "5:43 pm", "Yesterday 5:43 pm" or "12 Nov, 5:43 pm"
const clockTime = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const time = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (t.toDateString() === today.toDateString()) return time;
  if (t.toDateString() === y.toDateString()) return `Yesterday ${time}`;
  return `${t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
};
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);
const fmtMin = (m) => (m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`);

// "You are here" marker for the person viewing the map
const meIcon = L.divIcon({
  className: 'gcr-me-marker',
  html: '<span class="me-halo"></span><span class="me-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Initials avatar marker with a pulsing ring while live
const createLiveIcon = (initials, color, live) => L.divIcon({
  className: 'gcr-live-marker',
  html: `${live ? `<span class="pulse" style="background:${color}33"></span>` : ''}<div style="position:relative;width:34px;height:34px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:600 13px -apple-system,BlinkMacSystemFont,'Inter',sans-serif;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${initials}</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Fits all live engineers once (and when asked), and flies to a selected engineer.
// Never re-centres on its own after that, so the admin can pan/zoom freely.
function MapController({ points, focus, fittedOnce }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.lastLog) {
      // Put the person in the lower part of the map, so their pop-up opens fully above them
      const zoom = 16;
      const pin = map.project([parseFloat(focus.lastLog.lat), parseFloat(focus.lastLog.lng)], zoom);
      const lift = Math.min(150, map.getSize().y * 0.32);
      map.flyTo(map.unproject(pin.subtract([0, lift]), zoom), zoom, { duration: 0.6 });
      return;
    }
    if (!fittedOnce.current && points.length > 0) {
      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
      fittedOnce.current = true;
    }
  }, [focus, points, map, fittedOnce]);
  return null;
}


// Map pop-up: who, status with the exact time, distance from you, and Directions / Call / Message
function PersonPopup({ eng, dist, hasMyPos }) {
  const fixAt = eng.lastLog?.timestamp;
  const seen = eng.seenAt || fixAt;
  const st = eng.status;
  const statusLine =
    st === 'No signal' ? `No signal since ${clockTime(seen)}`
    : st === 'Location off' ? `Location off${eng.offSince ? ` since ${clockTime(eng.offSince)}` : ''}`
    : st === 'Signal lost' ? `No update since ${clockTime(fixAt)}`
    : st === 'On Duty' ? 'On duty · sharing live'
    : st === 'Off duty · live' ? 'Off duty · sharing live'
    : st;
  const lat = parseFloat(eng.lastLog.lat), lng = parseFloat(eng.lastLog.lng);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const phone = String(eng.phone || '').replace(/[^\d+]/g, '');
  const openChat = () => window.dispatchEvent(new CustomEvent('gcr_quick_action', { detail: { action: 'open_chat', engineer: { id: eng.id, name: eng.displayName } } }));
  return (
    <div className="pp">
      <div className="pp-name">{eng.displayName}{eng.isAdmin && <span className="pp-role">Branch Admin</span>}</div>
      <div className="pp-status"><span className="pp-dot" style={{ background: eng.statusColor }} />{statusLine}</div>
      <div className="pp-time">Last location: <b>{clockTime(fixAt)}</b> · {timeAgoShort(new Date(fixAt))}</div>
      <div className="pp-dist">
        {dist ? (dist.road
          ? <><b>{fmtKm(dist.road.km)}</b> by road · {fmtMin(dist.road.min)} drive<span>{fmtKm(dist.km)} straight line</span></>
          : <><b>{fmtKm(dist.km)}</b> from you<span>straight line · road distance loading…</span></>)
          : <span>{hasMyPos ? 'Distance unavailable' : 'Allow your location to see the distance'}</span>}
      </div>
      <div className="pp-actions">
        <a className="pp-btn primary" href={directions} target="_blank" rel="noopener noreferrer"><Navigation size={15} /> Directions</a>
        {phone ? <a className="pp-btn" href={`tel:${phone}`}><Phone size={15} /> Call</a> : <span className="pp-btn off" title="No phone number saved"><Phone size={15} /> Call</span>}
        <button type="button" className="pp-btn" onClick={openChat}><MessageCircle size={15} /> Message</button>
      </div>
    </div>
  );
}

export default function AdminStaff({ currentUser }) {
  const [engineers, setEngineers] = useState([]);
  const [branchAdmins, setBranchAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const superAdmin = isSuperAdmin(currentUser);
  const scope = getBranchScope();
  // Super Admin: "Team" (live map + people) or "Branches"
  const [segment, setSegment] = useState('team');
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    if (!superAdmin) return;
    fetch(`${API_BASE_URL}/api/branches`).then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {});
  }, [superAdmin, segment]);
  const branchCode = (id) => branches.find((b) => b.id === id)?.code || '';
  const showBranchChip = superAdmin && scope === 'all';

  // Add Staff sheet
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Profile Details Modal State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  // Password the admin issued: fetched only when the admin taps Show, hidden again after 30 s
  const [pwInfo, setPwInfo] = useState(null); // { password, changedByUserAt }
  const [pwLoading, setPwLoading] = useState(false);
  const pwTimer = useRef(null);
  const hidePassword = () => { clearTimeout(pwTimer.current); setPwInfo(null); };
  const closeProfile = () => { setSelectedStaff(null); setResetResult(null); hidePassword(); };
  const handleShowPassword = async () => {
    if (!selectedStaff) return;
    setPwLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(selectedStaff.id)}/issued-password`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load the password');
      setPwInfo(data);
      clearTimeout(pwTimer.current);
      pwTimer.current = setTimeout(() => setPwInfo(null), 30000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };
  useEffect(() => () => clearTimeout(pwTimer.current), []);
  const copyText = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg); } catch { toast.error('Could not copy'); }
  };
  const handleResetPassword = async () => {
    if (!selectedStaff) return;
    if (!window.confirm(`Reset ${selectedStaff.displayName}'s password? Their current password will stop working.`)) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(selectedStaff.id)}/reset-password`, { method: 'POST', headers: authHeaders(), body: '{}' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset the password');
      setResetResult(data.temporaryPassword);
      hidePassword();
      toast.success('Password reset');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  const [lastSync, setLastSync] = useState(null);
  const [savingSelfCase, setSavingSelfCase] = useState(false);
  const [, setTick] = useState(0); // re-render every few seconds so "x sec ago" stays fresh
  const [focusId, setFocusId] = useState(null);
  const fittedOnce = useRef(false);
  const [useFallbackTiles, setUseFallbackTiles] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const handleMapError = useCallback(() => setUseFallbackTiles(true), []);

  // Where the viewer (Super Admin / admin) is right now — distances are measured from here
  const [myPos, setMyPos] = useState(null);
  const [myPosError, setMyPosError] = useState('');
  useEffect(() => {
    if (!navigator.geolocation) { setMyPosError('Location not available on this device'); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setMyPosError(''); },
      (e) => setMyPosError(e.code === 1 ? 'Allow location to see distances' : 'Finding your location…'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Road distance + drive time from the viewer to each person (refreshed every 2 min, or when someone moves)
  const [road, setRoad] = useState({});
  // When the viewer's own position first arrives, fit the map again so it includes them
  const hadPos = useRef(false);
  useEffect(() => {
    if (!myPos || hadPos.current) return undefined;
    hadPos.current = true;
    setTimeout(() => { fittedOnce.current = false; setTick((n) => n + 1); }, 900);
    return undefined;
  }, [myPos]);
  const roadReq = useRef({ at: 0, key: '' });
  useEffect(() => {
    if (!myPos) return;
    const people = [...engineers, ...branchAdmins].filter((p) => p.lastLog)
      .map((p) => ({ id: p.id, lat: Number(parseFloat(p.lastLog.lat).toFixed(3)), lng: Number(parseFloat(p.lastLog.lng).toFixed(3)) }));
    if (!people.length) return;
    // ~100 m grid: only ask again when someone (or the viewer) has really moved, or every 2 minutes
    const key = `${myPos.lat.toFixed(3)},${myPos.lng.toFixed(3)}|${people.map((p) => `${p.id}:${p.lat},${p.lng}`).join(';')}`;
    if (key === roadReq.current.key && Date.now() - roadReq.current.at < 2 * 60 * 1000) return;
    if (Date.now() - roadReq.current.at < 20 * 1000) return; // never more than every 20 s
    roadReq.current = { at: Date.now(), key };
    const exact = [...engineers, ...branchAdmins].filter((p) => p.lastLog).map((p) => ({ id: p.id, lat: parseFloat(p.lastLog.lat), lng: parseFloat(p.lastLog.lng) }));
    fetch(`${API_BASE_URL}/api/live/road`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: { lat: myPos.lat, lng: myPos.lng }, to: exact }),
    }).then((r) => (r.ok ? r.json() : {})).then((d) => { if (d && typeof d === 'object') setRoad(d); }).catch(() => {});
  }, [myPos, engineers, branchAdmins]);

  const fetchStaffData = async () => {
      try {
        const [usersRes, attRes, liveRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/attendance?date=${localYMD(new Date())}`), // today only
          fetch(`${API_BASE_URL}/api/live`).catch(() => null), // 24/7 latest positions
        ]);
        const users = await usersRes.json();
        const attendances = await attRes.json();
        const liveRows = liveRes && liveRes.ok ? await liveRes.json().catch(() => []) : [];
        const liveBy = new Map((Array.isArray(liveRows) ? liveRows : []).map((r) => [r.userId, r]));
        // Latest 24/7 position as a map point (same shape as an attendance record)
        const liveFix = (l) => (l && l.lat != null && l.lng != null && l.at
          ? { lat: String(l.lat), lng: String(l.lng), accuracy: l.accuracy, timestamp: l.at } : null);
        const offDutyState = (l) => (!l ? null : l.state === 'off' ? ['Location off', '#ff3b30'] : l.state === 'silent' ? ['No signal', '#ff9500'] : ['Off duty · live', '#5856d6']);

        const staff = users.filter(u => u.role === 'ENGINEER');
        setBranchAdmins(users.filter(u => u.role === 'ADMIN').map(u => {
          const l = liveBy.get(u.id);
          const st = !l ? ['No location yet', '#8e8e93'] : l.state === 'off' ? ['Location off', '#ff3b30'] : l.state === 'silent' ? ['No signal', '#ff9500'] : ['Live', '#1e3a8a'];
          return {
            ...u,
            displayName: u.name || u.username,
            initials: (u.name || u.username).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            lastLog: liveFix(l),
            seenAt: l?.lastSeenAt || null,
            offSince: l?.offSince || null,
            liveState: l?.state || null,
            mapStatus: st[0],
            statusColor: st[1],
          };
        }));

        const enrichedStaff = staff.map(user => {
          const userLogs = (Array.isArray(attendances) ? attendances : [])
            .filter(a => a.userId === user.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          // On duty = latest Clock-In/Clock-Out today is a Clock-In.
          // (Location Updates do NOT change duty status.)
          const lastDutyEvent = userLogs.find(l => l.attendanceType === 'Clock-In' || l.attendanceType === 'Clock-Out');
          const onDuty = lastDutyEvent?.attendanceType === 'Clock-In';
          // Position = newest record with coordinates (live updates included)
          const attFix = userLogs.find(l => l.lat && l.lng && !isNaN(parseFloat(l.lat)) && !isNaN(parseFloat(l.lng))) || null;
          const live = liveBy.get(user.id);
          const lf = liveFix(live);
          const lastFix = lf && (!attFix || new Date(lf.timestamp) > new Date(attFix.timestamp)) ? lf : attFix;
          const ageMs = lastFix ? Date.now() - new Date(lastFix.timestamp).getTime() : null;
          const isStale = onDuty && (ageMs === null || ageMs > STALE_MS);

          // Engineer switched location off while on duty (latest tracking event)
          const lastTrack = userLogs.find(l => ['Location Off', 'Location On', 'Location Update', 'Clock-In'].includes(l.attendanceType));
          const locationOff = onDuty && lastTrack?.attendanceType === 'Location Off';
          const off = offDutyState(live);
          const status = !onDuty ? (off ? off[0] : 'Off Duty') : (locationOff || live?.state === 'off') ? 'Location off' : isStale ? 'Signal lost' : 'On Duty';
          const statusColor = !onDuty ? (off ? off[1] : '#8e8e93') : (locationOff || live?.state === 'off') ? '#ff3b30' : isStale ? '#ff9500' : '#34c759';

          const names = (user.name || user.username).split(' ');
          let initials = names[0].charAt(0).toUpperCase();
          if (names.length > 1) initials += names[1].charAt(0).toUpperCase();

          return {
            ...user,
            displayName: user.name || user.username,
            initials,
            onDuty,
            status,
            statusColor,
            checkedInAt: onDuty ? lastDutyEvent.timestamp : null,
            lastLog: lastFix,
            seenAt: live?.lastSeenAt || null,
            offSince: live?.offSince || null,
            pings: userLogs.filter(l => l.attendanceType === 'Location Update').length,
          };
        });

        setEngineers(enrichedStaff);
        setLastSync(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Staff fetch error", err);
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchStaffData();
    const poll = setInterval(fetchStaffData, LIVE_POLL_MS);
    const tick = setInterval(() => setTick(t => t + 1), 5000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="skeleton skeleton-text" style={{ width: '120px', height: '24px' }}></div>
          <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }}></div>
        </div>
        
        <div className="skeleton-card" style={{ height: '300px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton skeleton-text" style={{ width: '100px', height: '20px', margin: 0 }}></div>
            <div className="skeleton skeleton-text" style={{ width: '60px', height: '20px', margin: 0 }}></div>
          </div>
          <div className="skeleton" style={{ flex: 1, borderRadius: 0 }}></div>
        </div>
        
        <div className="skeleton-card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', margin: 0 }}></div>
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
              <div className="skeleton skeleton-avatar"></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '20%' }}></div>
                </div>
                <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 24/7: everyone with a known position is on the map (Super Admin also sees branch admins)
  const onMap = [
    ...engineers.filter(e => e.lastLog),
    ...(superAdmin ? branchAdmins.filter(a => a.lastLog).map(a => ({ ...a, status: a.mapStatus, isAdmin: true })) : []),
  ];
  const activeStaffCount = engineers.filter(e => e.onDuty).length;
  const points = onMap.map(e => [parseFloat(e.lastLog.lat), parseFloat(e.lastLog.lng)]);
  if (myPos && points.length) points.push([myPos.lat, myPos.lng]);
  const posOf = (p) => (p?.lastLog ? { lat: parseFloat(p.lastLog.lat), lng: parseFloat(p.lastLog.lng) } : null);
  const distOf = (p) => {
    const q = posOf(p);
    if (!myPos || !q) return null;
    return { km: kmBetween(myPos, q), road: road[p.id] || null };
  };
  const distText = (p) => {
    const d = distOf(p);
    if (!d) return '';
    return d.road ? `${fmtKm(d.road.km)} by road · ${fmtMin(d.road.min)} drive · ${fmtKm(d.km)} straight` : `${fmtKm(d.km)} away (straight line)`;
  };


  // Profile sheet for an engineer or branch admin (password, reset, contact)
  // Admin switches "Self cases" on/off for an engineer
  const toggleSelfCase = async (on) => {
    const who = selectedStaff;
    setSavingSelfCase(true);
    setSelectedStaff((s) => ({ ...s, canSelfCase: on }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(who.id)}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ canSelfCase: on }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save');
      setEngineers((list) => list.map((e) => (e.id === who.id ? { ...e, canSelfCase: on } : e)));
      toast.success(on ? `${who.displayName} can now file their own cases` : `Self cases turned off for ${who.displayName}`);
    } catch (err) {
      setSelectedStaff((s) => ({ ...s, canSelfCase: !on }));
      toast.error(err.message);
    } finally {
      setSavingSelfCase(false);
    }
  };

  const renderProfile = () => (
        <div className="pf-backdrop" onClick={closeProfile}>
          <div className="pf-sheet" role="dialog" aria-modal="true" aria-label={`${selectedStaff.displayName} profile`} onClick={(e) => e.stopPropagation()}>
            <div className="pf-nav">
              <span />
              <span className="pf-nav-title">{selectedStaff.role === 'ADMIN' ? 'Branch Admin' : 'Engineer'}</span>
              <button className="pf-done" onClick={closeProfile}>Done</button>
            </div>

            <div className="pf-hero">
              <div className="pf-avatar">{selectedStaff.initials}</div>
              <div className="pf-name">{selectedStaff.displayName}</div>
              <div className="pf-sub">{selectedStaff.id} · {selectedStaff.status}</div>
            </div>

            {(selectedStaff.phone || (superAdmin && selectedStaff.branchId)) && (
              <div className="pf-group">
                {superAdmin && selectedStaff.branchId && (
                  <div className="pf-row"><span>Branch</span><span className="pf-muted" style={{ color: '#3c3c43' }}>{branches.find((b) => b.id === selectedStaff.branchId)?.name || selectedStaff.branchId}</span></div>
                )}
                {selectedStaff.phone && <a className="pf-row pf-link" href={`tel:${selectedStaff.phone}`}><span>Phone</span><span>{selectedStaff.phone}</span></a>}
              </div>
            )}

            {selectedStaff.role === 'ENGINEER' && (
              <>
                <div className="pf-section">Permissions</div>
                <div className="pf-group">
                  <label className="pf-row fs-row-switch" style={{ cursor: 'pointer' }}>
                    <span>Self cases<small>Can file their own cases and submit them to you</small></span>
                    <span className="gv-switch">
                      <input type="checkbox" checked={!!selectedStaff.canSelfCase} disabled={savingSelfCase} onChange={(e) => toggleSelfCase(e.target.checked)} aria-label="Allow self cases" />
                      <i />
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="pf-section">Login</div>
            <div className="pf-group">
              <div className="pf-row">
                <span>Username</span>
                <span className="pf-value">
                  {selectedStaff.username}
                  <button className="pf-mini" onClick={() => copyText(selectedStaff.username, 'Username copied')} aria-label="Copy username"><Copy size={14} /></button>
                </span>
              </div>
              <div className="pf-row">
                <span>Password</span>
                {pwInfo?.password ? (
                  <span className="pf-value">
                    <span className="pf-pw">{pwInfo.password}</span>
                    <button className="pf-mini" onClick={() => copyText(`Username: ${selectedStaff.username}\nPassword: ${pwInfo.password}`, 'Login details copied')} aria-label="Copy login details"><Copy size={14} /></button>
                    <button className="pf-mini" onClick={hidePassword} aria-label="Hide password"><EyeOff size={14} /></button>
                  </span>
                ) : pwInfo ? (
                  <span className="pf-muted"><Lock size={13} /> {pwInfo.changedByUserAt ? 'Changed by engineer' : 'Not on record'}</span>
                ) : (
                  <span className="pf-value">
                    <span className="pf-dots">••••••••</span>
                    <button className="pf-show" onClick={handleShowPassword} disabled={pwLoading}>
                      {pwLoading ? <Loader2 size={14} className="spin" /> : <Eye size={14} />} Show
                    </button>
                  </span>
                )}
              </div>
              {pwInfo?.password && selectedStaff.phone && (
                <a className="pf-row pf-action" href={`https://wa.me/${String(selectedStaff.phone).replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Your Gouru Valuations login\nUsername: ${selectedStaff.username}\nPassword: ${pwInfo.password}`)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={16} /> Send Login on WhatsApp
                </a>
              )}
            </div>
            <p className="pf-foot">
              {pwInfo && !pwInfo.password
                ? (pwInfo.changedByUserAt
                    ? `${selectedStaff.displayName} set their own password on ${new Date(pwInfo.changedByUserAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, so it isn't on record. Reset it to issue a new one.`
                    : 'This account was created before passwords were kept on record. Reset it to issue a new one.')
                : 'Only admins can see this. It hides again after 30 seconds, and every view is logged.'}
            </p>

            {!resetResult ? (
              <div className="pf-group">
                <button className="pf-row pf-action" onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} Reset Password
                </button>
              </div>
            ) : (
              <div className="pf-group pf-result">
                <div className="pf-result-label">New temporary password</div>
                <div className="pf-result-pw">{resetResult}</div>
                <div className="pf-result-actions">
                  <button onClick={() => copyText(`Username: ${selectedStaff.username}\nPassword: ${resetResult}`, 'Login details copied')}><Copy size={15} /> Copy</button>
                  {selectedStaff.phone && (
                    <a href={`https://wa.me/${String(selectedStaff.phone).replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Your Gouru Valuations login\nUsername: ${selectedStaff.username}\nTemporary password: ${resetResult}\nPlease change it after you sign in.`)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  )}
                </div>
                <div className="pf-result-note">The old password no longer works. You can view this one again anytime with Show.</div>
              </div>
            )}
          </div>
          <style>{`
            .pf-backdrop { position: fixed; inset: 0; z-index: 10002; background: rgba(0,0,0,0.32); display: flex; align-items: flex-end; justify-content: center; animation: pfFade .2s ease-out; }
            .pf-sheet { width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; background: #f2f2f7; border-radius: 14px 14px 0 0; padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 20px); font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); animation: pfUp .32s cubic-bezier(.2,.9,.25,1); }
            @media (min-width: 768px) { .pf-backdrop { align-items: center; } .pf-sheet { border-radius: 16px; } }
            .pf-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 14px 0 6px; position: sticky; top: 0; background: #f2f2f7; z-index: 1; }
            .pf-nav-title { font-size: 17px; font-weight: 600; }
            .pf-done { justify-self: end; border: none; background: none; color: #007aff; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer; }
            .pf-hero { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 18px; }
            .pf-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(180deg, #5ac8fa, #007aff); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 600; margin-bottom: 6px; }
            .pf-name { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; }
            .pf-sub { font-size: 14px; color: #8e8e93; }
            .pf-section { padding: 16px 16px 7px; font-size: 13px; color: #6d6d72; text-transform: uppercase; }
            .pf-group { background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 4px; }
            .pf-row { width: 100%; min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; font: inherit; font-size: 16px; color: #000; background: #fff; border: none; text-decoration: none; position: relative; }
            .pf-row + .pf-row::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: .5px solid rgba(60,60,67,.22); }
            .pf-link span:last-child, .pf-value { color: #007aff; display: inline-flex; align-items: center; gap: 8px; }
            .pf-value { color: #3c3c43; }
            .pf-pw { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 15px; font-weight: 600; letter-spacing: .2px; user-select: all; }
            .pf-dots { color: #8e8e93; letter-spacing: 2px; }
            .pf-show { border: none; background: rgba(0,122,255,.1); color: #007aff; height: 28px; padding: 0 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
            .pf-muted { display: inline-flex; align-items: center; gap: 5px; color: #8e8e93; font-size: 15px; }
            .pf-mini { border: none; background: rgba(0,122,255,.1); color: #007aff; width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
            .pf-foot { margin: 7px 16px 16px; font-size: 13px; color: #6d6d72; line-height: 1.35; }
            .pf-action { justify-content: center; gap: 8px; color: #007aff; font-weight: 600; cursor: pointer; }
            .pf-action:disabled { opacity: .5; }
            .pf-result { padding: 16px; display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; }
            .pf-result-label { font-size: 13px; color: #6d6d72; }
            .pf-result-pw { font-size: 24px; font-weight: 700; letter-spacing: .5px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; color: #000; user-select: all; }
            .pf-result-actions { display: flex; gap: 8px; }
            .pf-result-actions button, .pf-result-actions a { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 10px; border: none; background: rgba(0,122,255,.1); color: #007aff; font: inherit; font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer; }
            .pf-result-actions a { background: rgba(37,211,102,.14); color: #128c4a; }
            .pf-result-note { font-size: 12px; color: #c93400; }
            @keyframes pfFade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes pfUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          `}</style>
        </div>
  );

  const openPerson = (p) => {
    const name = p.name || p.username;
    setSelectedStaff({ ...p, displayName: name, initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), status: p.status || 'Active' });
    setResetResult(null);
  };

  const segmentBar = (
    <div className="st-seg" role="tablist" aria-label="Staff view">
      {[['team', 'Team'], ['bank', 'Bank Users'], ...(superAdmin ? [['branches', 'Branches']] : [])].map(([k, label]) => (
        <button key={k} role="tab" aria-selected={segment === k} className={segment === k ? 'on' : ''} onClick={() => setSegment(k)}>{label}</button>
      ))}
    </div>
  );

  if (segment === 'bank') {
    return (
      <div className="animate-fade-in">
        {segmentBar}
        <BankUsersPanel superAdmin={superAdmin} branches={branches} scope={scope} />
        <StaffStyles />
      </div>
    );
  }

  if (superAdmin && segment === 'branches') {
    return (
      <div className="animate-fade-in">
        {segmentBar}
        <BranchesPanel onOpenPerson={openPerson} />
        {selectedStaff && renderProfile()}
        <StaffStyles />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {segmentBar}
      <div className="gcr-section-head" style={{ alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 className="gcr-section-title" style={{ fontSize: '22px' }}>Live Tracking</h2>
          <p className="gcr-section-sub">Staff locations are shared 24/7 from the phone app</p>
        </div>
        <button className="st-add" onClick={() => setIsModalOpen(true)}>
          <Plus size={17} strokeWidth={2.4} /> Add Engineer
        </button>
      </div>

      <div className="admin-card st-map-card">
        <div className="st-map-head">
          <span className="st-live"><span className="st-live-dot" /> Live</span>
          <span className="st-map-meta">
            {activeStaffCount} on duty{lastSync ? ` · updated ${timeAgoShort(lastSync)}` : ''}
          </span>
        </div>
        <div className="st-me-line">
          {myPos ? <><span className="st-me-dot" /> Distances from your location (±{Math.round(myPos.accuracy || 0)} m)</> : <>📍 {myPosError || 'Finding your location…'}</>}
        </div>

        <div className={`st-map ${showCredits ? 'show-credits' : ''}`}>
          <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
            {/* Small credit required by the map data licence (no Leaflet prefix) */}
            <AttributionControl position="bottomleft" prefix={false} />
            {useFallbackTiles ? (
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            ) : (
              <SmoothBaseMap onError={handleMapError} />
            )}
            {onMap.map((eng) => (
              <React.Fragment key={eng.id}>
                {eng.lastLog.accuracy && Number(eng.lastLog.accuracy) < 500 ? (
                  <Circle
                    center={[parseFloat(eng.lastLog.lat), parseFloat(eng.lastLog.lng)]}
                    radius={Number(eng.lastLog.accuracy)}
                    pathOptions={{ color: eng.statusColor, weight: 1, fillOpacity: 0.08 }}
                  />
                ) : null}
                <Marker
                  position={[parseFloat(eng.lastLog.lat), parseFloat(eng.lastLog.lng)]}
                  icon={createLiveIcon(eng.initials, eng.statusColor, eng.status === 'On Duty' || eng.status === 'Live' || eng.status === 'Off duty · live')}
                  eventHandlers={{ click: () => setFocusId(eng.id) }}
                >
                  <Popup minWidth={250} maxWidth={290}>
                    <PersonPopup eng={eng} dist={distOf(eng)} hasMyPos={!!myPos} />
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
            {myPos && (
              <>
                {myPos.accuracy && myPos.accuracy < 500 ? <Circle center={[myPos.lat, myPos.lng]} radius={myPos.accuracy} pathOptions={{ color: '#007aff', weight: 1, fillOpacity: 0.08 }} /> : null}
                <Marker position={[myPos.lat, myPos.lng]} icon={meIcon} zIndexOffset={1000}>
                  <Popup><strong>You are here</strong><br />Distances are measured from this point</Popup>
                </Marker>
              </>
            )}
            <MapController points={points} focus={onMap.find(e => e.id === focusId)} fittedOnce={fittedOnce} />
          </MapContainer>

          {onMap.length === 0 && (
            <div className="st-map-empty">
              <strong>No locations yet</strong>
              <span>People appear here once they sign in on the phone app.</span>
            </div>
          )}
          {/* Map credits are required by the free map's licence. Like Apple Maps / Mapbox,
              they're collapsed behind a small "i" button instead of always showing. */}
          <button
            className="st-credits-btn"
            onClick={() => setShowCredits(v => !v)}
            aria-label={showCredits ? 'Hide map credits' : 'Show map credits'}
            aria-expanded={showCredits}
          >
            i
          </button>
          {onMap.length > 0 && (
            <button className="st-fit" onClick={() => { setFocusId(null); fittedOnce.current = false; setTick(t => t + 1); }} aria-label="Show all engineers">
              <Maximize2 size={17} />
            </button>
          )}
        </div>
      </div>

      <div className="admin-card st-roster">
        <div className="gcr-section-head" style={{ padding: '14px 16px 0', marginBottom: '6px' }}>
          <h3 className="gcr-section-title">Engineers</h3>
          <span className="gcr-section-sub" style={{ margin: 0 }}>{activeStaffCount} of {engineers.length} on duty</span>
        </div>

        {engineers.length === 0 && (
          <div style={{ padding: '8px 16px 18px', fontSize: '14px', color: 'var(--gcr-label-3)' }}>No engineers added yet.</div>
        )}

        {engineers.map((eng) => (
          <div
            key={eng.id}
            className="st-row"
            onClick={() => {
              setSelectedStaff(eng);
              setResetResult(null);
              if (eng.lastLog) setFocusId(eng.id);
            }}
          >
            <div className="st-avatar" style={{ boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${eng.statusColor}` }}>{eng.initials}</div>
            <div className="st-main">
              <div className="st-name">{eng.displayName}{showBranchChip && branchCode(eng.branchId) && <span className="st-chip">{branchCode(eng.branchId)}</span>}</div>
              <div className="st-sub">
                {eng.onDuty && eng.lastLog
                  ? <>Updated {timeAgoShort(new Date(eng.lastLog.timestamp))} · checked in {new Date(eng.checkedInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</>
                  : eng.onDuty
                    ? 'Checked in · waiting for first location'
                    : eng.lastLog
                      ? <>Off duty · seen {timeAgoShort(new Date(eng.seenAt || eng.lastLog.timestamp))}</>
                      : 'No location yet — not signed in on the app'}
              </div>
              {distText(eng) && <div className="st-dist">{distText(eng)}</div>}
            </div>
            <span className={`gcr-badge ${eng.status === 'On Duty' ? 'green' : (eng.status === 'Signal lost' || eng.status === 'No signal') ? 'orange' : eng.status === 'Location off' ? 'red' : eng.status === 'Off duty · live' ? 'blue' : 'gray'}`}>{eng.status === 'Off duty · live' ? 'Off duty' : eng.status}</span>
          </div>
        ))}
      </div>

      {superAdmin && (
        <div className="admin-card st-roster" style={{ marginTop: 16 }}>
          <div className="gcr-section-head" style={{ padding: '14px 16px 0', marginBottom: '6px' }}>
            <h3 className="gcr-section-title">Branch Admins</h3>
            <button className="st-textbtn" onClick={() => setSegment('branches')}>Manage</button>
          </div>
          {branchAdmins.length === 0 && (
            <div style={{ padding: '8px 16px 18px', fontSize: '14px', color: 'var(--gcr-label-3)' }}>No branch admins yet. Open Branches to add one.</div>
          )}
          {branchAdmins.map((a) => (
            <div key={a.id} className="st-row" onClick={() => { openPerson(a); if (a.lastLog) setFocusId(a.id); }}>
              <div className="st-avatar st-avatar-admin">{a.initials}</div>
              <div className="st-main">
                <div className="st-name">{a.displayName}{showBranchChip && branchCode(a.branchId) && <span className="st-chip">{branchCode(a.branchId)}</span>}</div>
                <div className="st-sub">@{a.username}{a.seenAt ? <> · seen {timeAgoShort(new Date(a.seenAt))}</> : ' · no location yet'}</div>
                {distText(a) && <div className="st-dist">{distText(a)}</div>}
              </div>
              <span className={`gcr-badge ${a.status === 'Inactive' ? 'gray' : a.liveState === 'off' ? 'red' : a.liveState === 'silent' ? 'orange' : a.liveState === 'live' ? 'green' : 'gray'}`}>{a.status === 'Inactive' ? 'Inactive' : a.mapStatus}</span>
            </div>
          ))}
        </div>
      )}

      <StaffStyles />

      {isModalOpen && (
        <StaffFormSheet
          role="ENGINEER"
          branches={superAdmin ? branches.filter((b) => b.status !== 'Inactive') : undefined}
          defaultBranchId={scope !== 'all' ? scope : ''}
          onClose={() => setIsModalOpen(false)}
          onCreated={() => { setIsModalOpen(false); fetchStaffData(); }}
        />
      )}

      {selectedStaff && renderProfile()}
    </div>
  );
}

function StaffStyles() {
  return (
  <>
    <style>{`
        .st-seg { display: flex; background: rgba(118,118,128,.12); border-radius: 9px; padding: 2px; margin-bottom: 16px; max-width: 360px; }
        .st-seg button { flex: 1; height: 32px; border: none; background: none; border-radius: 7px; font: inherit; font-family: var(--gcr-font); font-size: 14px; font-weight: 500; color: var(--gcr-label); cursor: pointer; }
        .st-seg button.on { background: #fff; font-weight: 600; box-shadow: 0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04); }
        .st-chip { display: inline-block; margin-left: 8px; padding: 1px 6px; border-radius: 5px; background: rgba(0,122,255,.1); color: #007aff; font-size: 11px; font-weight: 700; letter-spacing: .3px; vertical-align: 2px; }
        .st-textbtn { border: none; background: none; color: var(--gcr-accent); font: inherit; font-family: var(--gcr-font); font-size: 15px; cursor: pointer; padding: 0; }
        .st-avatar-admin { background: linear-gradient(180deg, #7D7AFF, #5856D6) !important; }
        .st-add {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          background: var(--gcr-accent); color: #fff; border: none; border-radius: 10px;
          padding: 9px 14px; font-family: var(--gcr-font); font-size: 15px; font-weight: 600; cursor: pointer;
        }
        .st-add:active { opacity: 0.85; }
        .st-map-card { padding: 0 !important; overflow: hidden; }
        .st-map-head { display: flex; justify-content: space-between; align-items: center; padding: 11px 14px; font-family: var(--gcr-font); }
        .st-live { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #248a3d; text-transform: uppercase; letter-spacing: 0.4px; }
        .st-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #34c759; box-shadow: 0 0 0 0 rgba(52,199,89,0.6); animation: stPulse 1.8s infinite; }
        .st-map-meta { font-size: 13px; color: var(--gcr-label-3); }
        .st-map { position: relative; height: 340px; }
        @media (min-width: 900px) { .st-map { height: 460px; } }
        .st-map-empty {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 500;
          background: rgba(255,255,255,0.94); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
          border-radius: 14px; padding: 14px 18px; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.12);
          display: flex; flex-direction: column; gap: 3px; font-family: var(--gcr-font); width: max-content; max-width: 80%;
        }
        .st-map-empty strong { font-size: 15px; color: var(--gcr-label); }
        .st-map-empty span { font-size: 13px; color: var(--gcr-label-3); }
        .st-fit {
          position: absolute; right: 12px; top: 12px; z-index: 500; width: 38px; height: 38px; border-radius: 10px;
          border: none; background: rgba(255,255,255,0.95); color: var(--gcr-accent); cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center;
        }
        .st-map .leaflet-control-attribution { display: none !important; }
        .st-map.show-credits .leaflet-control-attribution {
          display: block !important; margin: 0 0 8px 40px !important; padding: 4px 8px !important; border-radius: 8px;
          background: rgba(255,255,255,0.92) !important; box-shadow: 0 1px 4px rgba(0,0,0,0.12) !important;
          font-size: 10px !important; color: #6d6d72 !important; font-family: var(--gcr-font);
        }
        .st-credits-btn {
          position: absolute; left: 10px; bottom: 10px; z-index: 500; width: 22px; height: 22px; border-radius: 50%;
          border: none; cursor: pointer; padding: 0;
          background: rgba(255,255,255,0.85); color: #8e8e93; box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          font: italic 600 13px/22px Georgia, 'Times New Roman', serif; text-align: center;
        }
        .st-map.show-credits .st-credits-btn { color: var(--gcr-accent); }
        .st-map .leaflet-control-attribution a { color: inherit !important; text-decoration: none; }
        .st-roster { padding: 0 !important; overflow: hidden; }
        .st-row {
          display: flex; align-items: center; gap: 12px; padding: 11px 16px; cursor: pointer; position: relative;
          font-family: var(--gcr-font); -webkit-tap-highlight-color: transparent;
        }
        .st-row:active { background: var(--gcr-fill); }
        .st-row + .st-row::before { content: ''; position: absolute; top: 0; left: 68px; right: 0; border-top: 0.5px solid var(--gcr-separator); }
        .st-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin: 2px;
          background: linear-gradient(180deg, #5ac8fa, #007aff); color: #fff;
          display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px;
        }
        .st-main { flex: 1; min-width: 0; }
        .st-name { font-size: 16px; font-weight: 600; color: var(--gcr-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .st-dist { font-size: 13px; font-weight: 600; color: #0062cc; margin-top: 2px; white-space: normal; line-height: 1.35; }
        .st-me-line { display: flex; align-items: center; gap: 6px; padding: 0 16px 10px; font-size: 12.5px; color: var(--gcr-label-3); }
        .st-me-dot { width: 9px; height: 9px; border-radius: 50%; background: #007aff; box-shadow: 0 0 0 3px rgba(0,122,255,.2); }
        .pp { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #0f172a; }
        .pp-name { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-right: 14px; }
        .pp-role { font-size: 11px; font-weight: 600; color: #1e40af; background: #dbeafe; border-radius: 6px; padding: 1px 6px; }
        .pp-status { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 13.5px; font-weight: 600; }
        .pp-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
        .pp-time { margin-top: 3px; font-size: 13px; color: #475569; }
        .pp-time b { color: #0f172a; }
        .pp-dist { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: #f1f5f9; font-size: 13px; color: #0f172a; }
        .pp-dist span { display: block; font-size: 12px; color: #64748b; margin-top: 1px; }
        .pp-dist > span:only-child { margin: 0; }
        .pp-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
        .pp-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 52px; border-radius: 12px; border: 0; background: #eef2ff; color: #1d4ed8 !important; font: inherit; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; }
        .pp-btn.primary { background: #2563eb; color: #fff !important; }
        .pp-btn.off { opacity: .4; cursor: not-allowed; }
        .gcr-me-marker { position: relative; }
        .gcr-me-marker .me-dot { position: absolute; left: 4px; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: #007aff; border: 2.5px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
        .gcr-me-marker .me-halo { position: absolute; inset: -6px; border-radius: 50%; background: rgba(0,122,255,.22); animation: mePulse 2s ease-out infinite; }
        @keyframes mePulse { 0% { transform: scale(.5); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        .st-sub { font-size: 13px; color: var(--gcr-label-3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gcr-live-marker { position: relative; }
        .gcr-live-marker .pulse {
          position: absolute; inset: -8px; border-radius: 50%; animation: stRing 2s ease-out infinite;
        }
        @keyframes stPulse { 0% { box-shadow: 0 0 0 0 rgba(52,199,89,0.55); } 70% { box-shadow: 0 0 0 8px rgba(52,199,89,0); } 100% { box-shadow: 0 0 0 0 rgba(52,199,89,0); } }
        @keyframes stRing { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.4); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .st-live-dot, .gcr-live-marker .pulse { animation: none; } }
    `}</style>
  </>
  );
}
