import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect } from 'react';
import { Navigation, FileText, CloudUpload, RefreshCw, WifiOff, AlertTriangle, ChevronRight, Phone, CalendarCheck, Clock, MapPin, Send } from 'lucide-react';
import IconTile from '../Shared/IconTile';
import './AttendanceView.css';
import localforage from 'localforage';
import toast from 'react-hot-toast';
import { getPendingOfflineQueue, syncPendingCases, subscribeSyncStatus } from '../../services/offlineSyncService';

export default function EngineerDashboard({ currentUser, onOpenCase }) {
  // Greeting name: the person's first real name — skips initials ("K.") and placeholder words
  // from a default account name like "GCR Field Engineer"; falls back to the login name
  const firstName = (() => {
    const GENERIC = /^(gcr|gouru|field|engineer|admin|staff|user|test|valuer|mr|mrs|ms|dr|sri|smt)\.?$/i;
    const word = String(currentUser?.name || '').split(/\s+/).find((w) => w.replace(/\./g, '').length > 2 && !GENERIC.test(w));
    if (word) return word.charAt(0).toUpperCase() + word.slice(1);
    const login = String(currentUser?.username || '').split(/[@._]/)[0];
    return login ? login.charAt(0).toUpperCase() + login.slice(1) : 'there';
  })();

  const [cases, setCases] = useState([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const checkOfflineQueue = async () => {
    try {
      const queue = await getPendingOfflineQueue();
      setOfflineCount(queue.length);
    } catch (e) {
      console.warn('Could not read offline queue:', e);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkOfflineQueue();
    const unsubscribe = subscribeSyncStatus((status) => {
      if (status.status === 'syncing') setIsSyncing(true);
      else {
        setIsSyncing(false);
        checkOfflineQueue();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast.error('Device is still offline. Please connect to internet to sync.');
      return;
    }
    setIsSyncing(true);
    toast.loading('Syncing offline cases to server...', { id: 'manual-sync' });
    try {
      await syncPendingCases();
      await checkOfflineQueue();
      toast.success('Offline inspections synced successfully!', { id: 'manual-sync' });
      // Refresh case list
      fetchCases();
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`, { id: 'manual-sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCases = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases`);
      if (res.ok) {
        const data = await res.json();
        // Filter cases assigned to this user
        const userCases = data.filter(c => c.assignedEngineerId === currentUser?.id || c.assignedEngineerName === currentUser?.name);
        setCases(userCases);
        // Cache to localforage for offline viewing
        await localforage.setItem(`cached_cases_${currentUser?.id || 'guest'}`, userCases);
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (err) {
      console.warn("Failed to fetch online cases, loading local offline cache:", err);
      try {
        const cached = await localforage.getItem(`cached_cases_${currentUser?.id || 'guest'}`);
        if (cached && Array.isArray(cached)) {
          setCases(cached);
        }
      } catch (cacheErr) {
        console.error("Cache read error:", cacheErr);
      }
    }
  };

  useEffect(() => {
    fetchCases();
  }, [currentUser]);

  // This week (Monday → today): days present, hours, site visits, reports
  const [week, setWeek] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/attendance/week-summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setWeek(d))
      .catch(() => setWeek(null));
  }, [currentUser?.id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greeting = getGreeting();

  // Case counts by real status: Pending = in the field, Reviewing = with the admin
  const inField = cases.filter(c => !c.status || c.status === 'Pending');
  const withAdmin = cases.filter(c => c.status === 'Reviewing' || c.status === 'Completed');
  const returned = cases.filter(c => c.status === 'Returned');
  const approved = cases.filter(c => c.status === 'Approved');

  // Next inspections: open cases in the field, soonest first
  const when = (c) => new Date(`${String(c.inspectionDate || '').slice(0, 10)}T${(c.inspectionTime || '23:59').slice(0, 5)}`).getTime() || Infinity;
  const upcoming = [...inField].sort((a, b) => when(a) - when(b)).slice(0, 5);
  const fmtWhen = (c) => {
    if (!c.inspectionDate) return 'Not scheduled';
    const t = when(c);
    if (!Number.isFinite(t)) return c.inspectionDate;
    const d = new Date(t);
    const today = new Date(); const tmr = new Date(Date.now() + 86400000);
    const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tmr.toDateString() ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return c.inspectionTime ? `${day}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : day;
  };
  const navigateTo = (c) => {
    const addr = [c.address, c.locationData].find(v => v && !/fetching|pending/i.test(v));
    if (!addr) { toast.error('No address on this case yet. Ask your admin to add it.'); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
  };

  return (
    <div className="td animate-fade-in">
      <div className="ed-greet">
        <h1>{greeting}, {firstName}</h1>
        <p>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Offline / waiting to upload */}
      {(!isOnline || offlineCount > 0) && (
        <div className="td-group" style={{ marginBottom: 16 }}>
          <div className="td-row">
            <IconTile icon={!isOnline ? WifiOff : CloudUpload} color={!isOnline ? 'orange' : 'green'} size={30} />
            <div className="td-main">
              <div className="td-title">{!isOnline ? 'You’re offline' : `${offlineCount} case${offlineCount === 1 ? '' : 's'} ready to upload`}</div>
              <div className="td-sub">{!isOnline ? 'Your work is saved on this phone and uploads when you’re back online.' : 'Saved on this phone while offline.'}</div>
            </div>
            {isOnline && offlineCount > 0 && (
              <button className="ed-pill-btn" onClick={handleManualSync} disabled={isSyncing}>
                {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : 'Upload'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="ed-tiles">
        <div><b style={{ color: '#2a78d6' }}>{inField.length}</b><span>In field</span></div>
        <div><b style={{ color: '#eb6834' }}>{withAdmin.length}</b><span>With admin</span></div>
        <div><b style={{ color: '#6250d6' }}>{returned.length}</b><span>Returned</span></div>
        <div><b style={{ color: '#008300' }}>{approved.length}</b><span>Approved</span></div>
      </div>

      {/* Sent back by the admin */}
      {returned.length > 0 && (
        <>
          <div className="td-section">Needs your attention</div>
          <div className="td-group">
            {returned.map(c => (
              <button key={c.id} className="td-row td-link" onClick={() => onOpenCase(c.id)}>
                <IconTile icon={AlertTriangle} color="red" size={30} />
                <div className="td-main">
                  <div className="td-title">{c.clientName || 'Case'} · {c.fileNumber || `#${c.id}`}</div>
                  <div className="td-sub">“{c.rejectionReason || 'Please review and resubmit.'}”{c.returnedBy ? ` — ${c.returnedBy}` : ''}</div>
                </div>
                <ChevronRight size={18} className="td-chev" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* This week */}
      {week && (
        <>
          <div className="td-section">This week</div>
          <div className="ed-week">
            <div>
              <IconTile icon={CalendarCheck} color="green" size={28} />
              <b>{week.daysPresent}<small> / {week.workingDays}</small></b>
              <span>Days present</span>
            </div>
            <div>
              <IconTile icon={Clock} color="blue" size={28} />
              <b>{week.hoursWorked < 1 ? <>{Math.round(week.hoursWorked * 60)}<small> min</small></> : <>{week.hoursWorked}<small> h</small></>}</b>
              <span>Hours worked</span>
            </div>
            <div>
              <IconTile icon={MapPin} color="orange" size={28} />
              <b>{week.siteVisits}</b>
              <span>Site visits done</span>
            </div>
            <div>
              <IconTile icon={Send} color="indigo" size={28} />
              <b>{week.reportsSubmitted}</b>
              <span>Reports submitted</span>
            </div>
          </div>
        </>
      )}

      {/* Next inspections */}
      <div className="td-section">Next inspections</div>
      <div className="td-group">
        {upcoming.length === 0 ? (
          <div className="td-empty">No inspections pending.</div>
        ) : upcoming.map(c => (
          <div key={c.id} className="td-row">
            <button className="ed-row-main" onClick={() => onOpenCase(c.id)}>
              <IconTile icon={FileText} color="blue" size={30} />
              <div className="td-main">
                <div className="td-title">{c.clientName || c.borrowerName || 'Client'}</div>
                <div className="td-sub">{fmtWhen(c)}{c.bankName ? ` · ${c.bankName}` : ''}</div>
                <div className="td-sub">{c.address || c.locationData || 'Address not added yet'}</div>
              </div>
            </button>
            {c.clientPhone && (
              <a className="td-icon-btn" href={`tel:${c.clientPhone}`} aria-label={`Call ${c.clientName || 'client'}`}><Phone size={16} /></a>
            )}
            <button className="td-icon-btn" onClick={() => navigateTo(c)} aria-label="Directions"><Navigation size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
