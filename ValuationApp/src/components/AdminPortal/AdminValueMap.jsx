import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, Marker, TileLayer, AttributionControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, FileText, Navigation, MapPin, Loader2, Building2, CalendarDays, User } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import SmoothBaseMap from '../Shared/SmoothBaseMap';
import ReportViewer, { fetchReport } from '../Shared/ReportViewer';

/**
 * Value Map — every finished valuation as a landmark on the map, labelled with its value.
 * Super Admin sees all branches (or the branch picked at the top); a branch admin sees their own.
 */

const DEFAULT_CENTER = [14.4673, 78.8242]; // Kadapa

const shortInr = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 2).replace(/\.?0+$/, '')} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
  if (v > 0) return `₹${Math.round(v / 1000)}K`;
  return '—';
};
const fullInr = (n) => (Number(n) ? `₹${Number(n).toLocaleString('en-IN')}` : '—');
const dateStr = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Colour by value band, so big properties stand out at a glance
const band = (v) => (v >= 1e7 ? '#7c3aed' : v >= 5e6 ? '#1d4ed8' : v >= 2e6 ? '#0f766e' : '#475569');

const pinIcon = (g, selected) => L.divIcon({
  className: 'vm-pin-wrap',
  html: `<div class="vm-pin ${selected ? 'sel' : ''}" style="--c:${band(g.items.length > 1 ? g.total / g.items.length : g.total)}"><span>${shortInr(g.total)}</span>${g.items.length > 1 ? `<em>${g.items.length}</em>` : ''}</div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function FitTo({ points, focus }) {
  const map = useMap();
  const fitted = useRef('');
  useEffect(() => {
    if (focus) {
      // Keep the pin in the upper part of the map, above the detail card
      const z = Math.max(map.getZoom(), 15);
      const pt = map.project([focus.lat, focus.lng], z);
      map.flyTo(map.unproject(pt.add([0, Math.min(140, map.getSize().y * 0.28)]), z), z, { duration: 0.6 });
      return;
    }
    const key = points.map((p) => p.join(',')).join('|');
    if (!points.length || key === fitted.current) return;
    fitted.current = key;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
  }, [points, focus, map]);
  return null;
}

const PERIODS = [['all', 'All time'], ['30', '30 days'], ['90', '3 months'], ['365', '12 months']];

export default function AdminValueMap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [bank, setBank] = useState('all');
  const [period, setPeriod] = useState('all');
  const [sel, setSel] = useState(null);
  const [report, setReport] = useState(null);
  const [fallbackTiles, setFallbackTiles] = useState(false);
  const onMapError = useCallback(() => setFallbackTiles(true), []);

  const load = useCallback(() => {
    fetch(`${API_BASE_URL}/api/cases/value-map`)
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error || 'Could not load')))))
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    const onScope = () => { setData(null); setSel(null); load(); };
    window.addEventListener('gcr_branch_scope', onScope);
    return () => window.removeEventListener('gcr_branch_scope', onScope);
  }, [load]);

  const banks = useMemo(() => [...new Set((data?.cases || []).map((c) => c.bankName).filter(Boolean))].sort(), [data]);
  const shown = useMemo(() => {
    const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400000;
    return (data?.cases || []).filter((c) => (bank === 'all' || c.bankName === bank) && (!since || new Date(c.date).getTime() >= since));
  }, [data, bank, period]);
  const total = shown.reduce((s, c) => s + (Number(c.fmv) || 0), 0);
  const points = useMemo(() => shown.map((c) => [c.lat, c.lng]), [shown]);
  // Valuations at the same spot (within ~10 m, e.g. flats in one building) share one pin
  const groups = useMemo(() => {
    const m = new Map();
    for (const c of shown) {
      const k = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
      if (!m.has(k)) m.set(k, { key: k, lat: c.lat, lng: c.lng, items: [], total: 0 });
      const g = m.get(k); g.items.push(c); g.total += Number(c.fmv) || 0;
    }
    return [...m.values()];
  }, [shown]);
  const [selGroup, setSelGroup] = useState(null);
  const group = groups.find((g) => g.key === selGroup) || null;
  const selected = shown.find((c) => c.id === sel) || (group && group.items.length === 1 ? group.items[0] : null);
  const listing = group && group.items.length > 1 && !shown.find((c) => c.id === sel) ? group : null;

  return (
    <div className="vm">
      <div className="vm-head">
        <div>
          <h2>Value Map</h2>
          <p>Every finished valuation, pinned where the property is.</p>
        </div>
      </div>

      <div className="vm-stats">
        <div><b>{shown.length}</b><span>valuations</span></div>
        <div><b>{shortInr(total)}</b><span>total value</span></div>
        <div><b>{shown.length ? shortInr(total / shown.length) : '—'}</b><span>average</span></div>
      </div>

      <div className="vm-filters">
        <select value={bank} onChange={(e) => { setBank(e.target.value); setSel(null); setSelGroup(null); }} aria-label="Bank">
          <option value="all">All banks</option>
          {banks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="vm-seg" role="tablist" aria-label="Period">
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" className={period === k ? 'on' : ''} onClick={() => { setPeriod(k); setSel(null); setSelGroup(null); }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="vm-map">
        {!data && !error && <div className="vm-overlay"><Loader2 size={22} className="spin" /> Loading valuations…</div>}
        {error && <div className="vm-overlay">{error}</div>}
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
          <AttributionControl position="bottomleft" prefix={false} />
          {fallbackTiles
            ? <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            : <SmoothBaseMap onError={onMapError} />}
          {groups.map((g) => (
            <Marker key={g.key} position={[g.lat, g.lng]} icon={pinIcon(g, g.key === selGroup)} zIndexOffset={g.key === selGroup ? 1000 : Math.round(g.total / 1e5)}
              eventHandlers={{ click: () => { setSelGroup(g.key); setSel(null); } }} />
          ))}
          <FitTo points={points} focus={group} />
        </MapContainer>
        {data && !shown.length && <div className="vm-overlay soft">No finished valuations {bank !== 'all' || period !== 'all' ? 'for this filter' : 'yet'}.</div>}

        {listing && (
          <div className="vm-card" role="dialog" aria-label="Valuations here">
            <button type="button" className="vm-x" aria-label="Close" onClick={() => setSelGroup(null)}><X size={18} /></button>
            <div className="vm-value" style={{ color: band(listing.total / listing.items.length) }}>{fullInr(listing.total)}</div>
            <div className="vm-sub">{listing.items.length} valuations at this spot</div>
            <div className="vm-list">
              {listing.items.slice().sort((a, b) => (b.fmv || 0) - (a.fmv || 0)).map((c) => (
                <button key={c.id} type="button" onClick={() => setSel(c.id)}>
                  <span><b>{c.clientName || 'Client'}</b><small>{c.bankName} · {dateStr(c.date)}</small></span>
                  <strong>{shortInr(c.fmv)}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="vm-card" role="dialog" aria-label={selected.clientName}>
            <button type="button" className="vm-x" aria-label="Close" onClick={() => { setSel(null); setSelGroup(null); }}><X size={18} /></button>
            {group && group.items.length > 1 && <button type="button" className="vm-back" onClick={() => setSel(null)}>‹ All {group.items.length} here</button>}
            <div className="vm-value" style={{ color: band(selected.fmv) }}>{fullInr(selected.fmv)}</div>
            <div className="vm-sub">Fair market value{selected.realizable ? ` · Realizable ${shortInr(selected.realizable)}` : ''}{selected.distress ? ` · Distress ${shortInr(selected.distress)}` : ''}</div>
            <div className="vm-name">{selected.clientName || 'Client'}</div>
            <div className="vm-rows">
              <span><Building2 size={14} /> {selected.bankName || '—'}{selected.propertyType ? ` · ${selected.propertyType}` : ''}{selected.extent ? ` · ${selected.extent}` : ''}</span>
              {selected.address && <span><MapPin size={14} /> {selected.address}</span>}
              <span><CalendarDays size={14} /> {selected.status} {dateStr(selected.date)} · {selected.fileNumber}</span>
              {selected.engineer && <span><User size={14} /> {selected.engineer}</span>}
            </div>
            <div className="vm-actions">
              <button type="button" className="primary" onClick={() => setReport(selected)}><FileText size={16} /> View report</button>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> Directions</a>
            </div>
          </div>
        )}
      </div>

      {data?.noLocation > 0 && (
        <p className="vm-note">{data.noLocation} finished valuation{data.noLocation > 1 ? 's have' : ' has'} no site location saved, so {data.noLocation > 1 ? 'they are' : 'it is'} not on the map.</p>
      )}

      <div className="vm-legend">
        <span><i style={{ background: '#475569' }} /> under ₹20 L</span>
        <span><i style={{ background: '#0f766e' }} /> ₹20 L–50 L</span>
        <span><i style={{ background: '#1d4ed8' }} /> ₹50 L–1 Cr</span>
        <span><i style={{ background: '#7c3aed' }} /> over ₹1 Cr</span>
      </div>

      {report && (
        <ReportViewer
          title={report.clientName || 'Valuation Report'}
          subtitle={[report.fileNumber, report.bankName].filter(Boolean).join(' · ')}
          fileName={`Report_${String(report.fileNumber || report.id).replace(/[^a-zA-Z0-9]+/g, '-')}.docx`}
          load={() => fetchReport(`${API_BASE_URL}/api/cases/${report.id}/report?format=docx`)}
          onClose={() => setReport(null)}
        />
      )}

      <style>{`
        .vm { display: flex; flex-direction: column; gap: 12px; }
        .vm-head h2 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.4px; color: #0f172a; }
        .vm-head p { margin: 2px 0 0; font-size: 13.5px; color: #64748b; }
        .vm-stats { display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border-radius: 16px; border: 1px solid #e7ebf1; overflow: hidden; }
        .vm-stats > div { padding: 12px 10px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
        .vm-stats > div + div { border-left: 1px solid #eef2f7; }
        .vm-stats b { font-size: 19px; color: #0f172a; letter-spacing: -.3px; }
        .vm-stats span { font-size: 12px; color: #64748b; }
        .vm-filters { display: flex; flex-direction: column; gap: 8px; }
        .vm-filters select { height: 40px; border-radius: 11px; border: 1px solid #dbe2ea; background: #fff; padding: 0 12px; font: inherit; font-size: 14.5px; color: #0f172a; }
        .vm-seg { display: grid; grid-template-columns: repeat(4, 1fr); background: #eceff4; border-radius: 11px; padding: 3px; gap: 2px; }
        .vm-seg button { border: 0; background: none; border-radius: 9px; padding: 7px 4px; font: inherit; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; }
        .vm-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .vm-map { position: relative; height: 58vh; min-height: 360px; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; background: #eef2f6; }
        .vm-overlay { position: absolute; inset: 0; z-index: 500; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(248,250,252,.75); color: #475569; font-size: 14px; pointer-events: none; }
        .vm-overlay.soft { background: transparent; align-items: flex-start; padding-top: 18px; }
        .vm-pin-wrap { background: none; border: 0; }
        .vm-pin { position: absolute; transform: translate(-50%, calc(-100% - 7px)); background: var(--c); color: #fff; font: 800 12.5px/1 -apple-system, 'Inter', sans-serif; padding: 6px 9px; border-radius: 999px; white-space: nowrap; box-shadow: 0 3px 10px rgba(15,23,42,.3); border: 2px solid #fff; cursor: pointer; transition: transform .15s; }
        .vm-pin::after { content: ''; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #fff; border-bottom: 0; }
        .vm-pin::before { content: ''; position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%); border: 4px solid transparent; border-top-color: var(--c); border-bottom: 0; z-index: 1; }
        .vm-pin em { position: absolute; top: -9px; right: -9px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #f59e0b; color: #fff; font: 800 11px/18px -apple-system, 'Inter', sans-serif; font-style: normal; text-align: center; border: 2px solid #fff; z-index: 2; }
        .vm-list { display: flex; flex-direction: column; margin-top: 8px; max-height: 210px; overflow-y: auto; }
        .vm-list button { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 2px; border: 0; border-top: 1px solid #eef2f7; background: none; font: inherit; text-align: left; cursor: pointer; }
        .vm-list b { display: block; font-size: 14.5px; color: #0f172a; }
        .vm-list small { display: block; font-size: 12px; color: #64748b; margin-top: 1px; }
        .vm-list strong { font-size: 14.5px; color: #1d4ed8; white-space: nowrap; }
        .vm-back { border: 0; background: none; padding: 0 0 4px; font: inherit; font-size: 13px; font-weight: 600; color: #2563eb; cursor: pointer; }
        .vm-pin.sel { transform: translate(-50%, calc(-100% - 7px)) scale(1.18); box-shadow: 0 0 0 4px rgba(37,99,235,.25), 0 6px 16px rgba(15,23,42,.35); }
        .vm-card { position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 600; background: #fff; border-radius: 16px; padding: 14px 14px 12px; box-shadow: 0 10px 30px rgba(15,23,42,.25); }
        .vm-x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 50%; border: 0; background: #f1f5f9; color: #475569; display: grid; place-items: center; cursor: pointer; }
        .vm-value { font-size: 24px; font-weight: 800; letter-spacing: -.4px; padding-right: 36px; }
        .vm-sub { font-size: 12px; color: #64748b; margin-top: 1px; }
        .vm-name { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 8px; }
        .vm-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 13px; color: #475569; }
        .vm-rows span { display: flex; align-items: flex-start; gap: 6px; line-height: 1.35; }
        .vm-rows svg { flex: none; margin-top: 2px; color: #94a3b8; }
        .vm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .vm-actions button, .vm-actions a { height: 42px; border-radius: 11px; border: 0; background: #eef2ff; color: #1d4ed8; font: inherit; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; cursor: pointer; }
        .vm-actions .primary { background: #2563eb; color: #fff; }
        .vm-note { margin: 0; font-size: 12.5px; color: #64748b; }
        .vm-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: #475569; }
        .vm-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .vm-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .vm .spin { animation: vmspin 1s linear infinite; }
        @keyframes vmspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
