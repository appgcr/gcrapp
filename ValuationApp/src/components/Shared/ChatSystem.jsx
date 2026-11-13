import { API_BASE_URL } from '../../config/api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Send, Search, Check, CheckCheck, Plus, Camera, ImageIcon, FileText, MapPin, Loader2, X, Phone, ChevronDown, AlertCircle, Clock, Megaphone } from 'lucide-react';
import BranchSwitcher from '../AdminPortal/BranchSwitcher';
import toast from 'react-hot-toast';
import CryptoJS from 'crypto-js';
import { isAdminRole, isSuperAdmin } from '../../utils/session';
import './ChatSystem.css';

// Office ↔ staff chat. Each engineer has one conversation with their office (branch admins
// + Super Admin answer it together). Admins see every engineer they manage.

const POLL_MS = 3000;
const LEGACY_KEY = 'gcr-secure-chat-key-2024'; // only to read messages saved by the old chat

const legacyText = (t) => {
  if (!t || !t.startsWith('U2FsdGVkX1')) return t;
  try { return CryptoJS.AES.decrypt(t, LEGACY_KEY).toString(CryptoJS.enc.Utf8) || t; } catch { return t; }
};
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const hhmm = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (d) => {
  const x = new Date(d); const t = new Date(); const y = new Date(Date.now() - 86400000);
  if (x.toDateString() === t.toDateString()) return 'Today';
  if (x.toDateString() === y.toDateString()) return 'Yesterday';
  return x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: x.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
};
const listTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return x.toDateString() === new Date().toDateString() ? hhmm(x) : dayLabel(x);
};
// Indian mobile → international digits for WhatsApp (e.g. 9876543210 → 919876543210)
const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d.length >= 11 ? d : '';
};
const offDutyText = (at) => {
  const x = new Date(at);
  return x.toDateString() === new Date().toDateString() ? `Checked out at ${hhmm(x)}` : `Checked out ${dayLabel(x)}, ${hhmm(x)}`;
};
const WhatsAppGlyph = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.13-1.32A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.04.78.81-2.96-.2-.31A8.2 8.2 0 1 1 12 20.2zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-1.98-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.02-.38.11-.5l.37-.43c.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.47a.9.9 0 0 0-.66.31 2.77 2.77 0 0 0-.86 2.06 4.8 4.8 0 0 0 1 2.55 11 11 0 0 0 4.2 3.71c.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28z"/>
  </svg>
);

const preview = (m) => (m.attachmentType === 'photo' || m.attachmentType === 'gallery' ? '📷 Photo'
  : m.attachmentType === 'document' ? `📄 ${m.text || 'Document'}`
  : m.attachmentType === 'location' ? '📍 Location' : legacyText(m.text));

// Shrink photos before upload (max 1600 px, JPEG) — faster on field networks
const compressImage = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = r.result;
  };
  r.onerror = reject;
  r.readAsDataURL(file);
});
const readAsDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export default function ChatSystem({ currentUser, otherUserId, caseId, onBack, isMini }) {
  const admin = isAdminRole(currentUser);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const [active, setActive] = useState(admin ? null : currentUser?.id); // engineerId of the open conversation
  const [conversations, setConversations] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadList = useCallback(async () => {
    try { setConversations(await api('/api/chat/conversations')); } catch { /* offline */ } finally { setListLoaded(true); }
  }, []);
  useEffect(() => {
    loadList();
    const t = setInterval(() => { if (!document.hidden) loadList(); }, POLL_MS * 2);
    return () => clearInterval(t);
  }, [loadList]);

  const twoPane = admin && wide && !isMini;
  const activeConv = conversations.find((c) => c.engineerId === active);

  if (admin && !twoPane && !active) {
    return <ConversationList {...{ conversations, listLoaded, currentUser, onOpen: setActive, onBack, isMini }} />;
  }
  if (twoPane) {
    return (
      <div className="ch-split">
        <ConversationList {...{ conversations, listLoaded, currentUser, onOpen: setActive, activeId: active, embedded: true }} />
        {active
          ? <Thread key={active} {...{ currentUser, engineerId: active, conv: activeConv, caseId, onRead: loadList }} />
          : <div className="ch-pick"><div className="ch-pick-icon">💬</div><b>Choose a conversation</b><span>Messages with your field engineers appear here.</span></div>}
      </div>
    );
  }
  return (
    <Thread
      key={active}
      {...{ currentUser, engineerId: active, conv: activeConv, caseId, isMini, onRead: loadList }}
      onBack={admin ? () => setActive(null) : onBack}
    />
  );
}

/* ------------------------------ Conversation list (admins) ------------------------------ */
// Stable colour per person (Apple's system palette), so people are easy to recognise
const AVATAR_COLORS = [['#5AC8FA', '#007AFF'], ['#4CD964', '#28A745'], ['#FFB340', '#FF9500'], ['#FF6B8B', '#FF2D55'], ['#C77DFF', '#AF52DE'], ['#5AD2F0', '#30B0C7'], ['#7D7AFF', '#5856D6'], ['#FF8A80', '#FF3B30']];
export const avatarStyle = (key = '') => {
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return { background: `linear-gradient(180deg, ${a}, ${b})` };
};

function ConversationList({ conversations, listLoaded, currentUser, onOpen, activeId, onBack, embedded, isMini }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | unread | duty
  const superAdmin = isSuperAdmin(currentUser);
  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0);
  const unreadPeople = conversations.filter((c) => c.unread > 0).length;
  const onDuty = conversations.filter((c) => c.onDuty).length;
  const showBranch = superAdmin && (typeof window !== 'undefined' && (localStorage.getItem('gcr_branch_scope') || 'all') === 'all');

  const needle = q.trim().toLowerCase();
  const list = conversations
    .filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'duty' ? c.onDuty : true))
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.lastMessage || '').toLowerCase().includes(needle) || (c.phone || '').includes(needle));

  const statusLine = (c) => (c.onDuty
    ? `On duty since ${hhmm(c.dutyAt)}`
    : c.dutyAt ? offDutyText(c.dutyAt) : 'Not checked in yet');

  const empty = !listLoaded ? null
    : conversations.length === 0 ? 'No field engineers yet. Add them in Staff, then chat here.'
    : list.length === 0 ? (needle ? `No results for “${q.trim()}”.` : filter === 'unread' ? 'You’re all caught up — no unread messages.' : 'Nobody is on duty right now.')
    : null;

  return (
    <div className={`ch-list ${embedded ? 'embedded' : ''} ${isMini ? 'mini' : ''}`}>
      <div className="ch-list-head">
        {onBack && !embedded && <button className="ch-back" onClick={onBack} aria-label="Back"><ChevronLeft size={28} /></button>}
        <div className="ch-list-titles">
          <h1>Messages</h1>
          {superAdmin ? <BranchSwitcher currentUser={currentUser} /> : currentUser?.branchInfo && <span className="ch-branch-static">{currentUser.branchInfo.name} Branch</span>}
        </div>
        <button className="ch-compose-all" onClick={() => window.dispatchEvent(new CustomEvent('gcr_quick_action', { detail: { action: 'broadcast' } }))} aria-label="Message everyone" title="Message everyone">
          <Megaphone size={20} />
        </button>
      </div>

      {listLoaded && conversations.length > 0 && (
        <p className="ch-summary">
          <span><i className="dot green" />{onDuty} on duty</span>
          <span><i className="dot blue" />{unreadTotal} unread</span>
          <span>{conversations.length} engineer{conversations.length === 1 ? '' : 's'}</span>
        </p>
      )}

      <label className="ch-search">
        <Search size={16} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or message" />
        {q && <button className="ch-clear" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>}
      </label>

      <div className="ch-filters" role="tablist" aria-label="Filter conversations">
        {[['all', 'All', conversations.length], ['unread', 'Unread', unreadPeople], ['duty', 'On duty', onDuty]].map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label}{n > 0 && <span>{n}</span>}
          </button>
        ))}
      </div>

      <div className="ch-rows">
        {!listLoaded && <div className="ch-empty"><Loader2 size={20} className="spin" /></div>}
        {empty && (
          <div className="ch-empty">
            <div className="ch-empty-icon">{filter === 'unread' && !needle ? '✓' : '💬'}</div>
            {empty}
          </div>
        )}
        {list.map((c) => (
          <button key={c.engineerId} className={`ch-row ${activeId === c.engineerId ? 'active' : ''} ${c.unread ? 'unread' : ''}`} onClick={() => onOpen(c.engineerId)}>
            <span className="ch-avatar-wrap">
              <span className="ch-avatar" style={avatarStyle(c.engineerId)}>{initials(c.name)}</span>
              {c.onDuty && <span className="ch-duty-dot" aria-label="On duty" />}
            </span>
            <span className="ch-row-main">
              <span className="ch-row-top">
                <span className="ch-row-name">
                  {c.name}
                  {showBranch && c.branchCode && <span className="ch-chip">{c.branchCode}</span>}
                </span>
                <span className={`ch-row-time ${c.unread ? 'hot' : ''}`}>{listTime(c.lastAt)}</span>
              </span>
              <span className="ch-row-bottom">
                <span className="ch-row-msg">
                  {c.lastMessage ? (
                    <>
                      {c.lastFromMe && (c.lastRead ? <CheckCheck size={15} className="tick read" /> : <Check size={15} className="tick" />)}
                      {c.lastFromMe && <span className="ch-you">You:</span>}
                      {legacyText(c.lastMessage)}
                    </>
                  ) : (
                    <span className={c.onDuty ? 'ch-status on' : 'ch-status'}>{statusLine(c)}</span>
                  )}
                </span>
                {c.unread > 0 && <span className="ch-unread">{c.unread}</span>}
              </span>
              {c.lastMessage && <span className={`ch-row-status ${c.onDuty ? 'on' : ''}`}>{statusLine(c)}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------ Conversation ------------------------------------ */
function Thread({ currentUser, engineerId, conv, caseId, onBack, isMini, onRead }) {
  const admin = isAdminRole(currentUser);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]); // optimistic: { tempId, ...payload, status: 'sending' | 'failed' }
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const photoRef = useRef(null);
  const docRef = useRef(null);
  const myInbox = admin ? 'ADMIN' : currentUser.id;

  const title = admin ? (conv?.name || 'Engineer') : (conv?.officeName || `${currentUser.branchInfo?.name || 'Head'} Office`);
  const subtitle = admin
    ? (conv?.onDuty ? `On duty since ${hhmm(conv.dutyAt)}` : conv?.dutyAt ? offDutyText(conv.dutyAt) : 'Field engineer')
    : 'Your branch admin & head office';
  // Admins call the engineer; engineers call their office
  const phone = admin ? conv?.phone : conv?.officePhone;
  const wa = waNumber(phone);

  const load = useCallback(async () => {
    if (!engineerId) return;
    try {
      const rows = await api(`/api/chat/thread/${encodeURIComponent(engineerId)}`);
      setMessages(rows);
      setLoaded(true);
      const unseen = rows.some((m) => m.receiverId === myInbox && !m.isRead);
      if (unseen) api(`/api/chat/thread/${encodeURIComponent(engineerId)}/read`, { method: 'PUT' }).then(() => onRead?.()).catch(() => {});
    } catch { setLoaded(true); }
  }, [engineerId, myInbox, onRead]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Stick to the bottom when new messages arrive (unless reading older ones)
  const all = useMemo(() => [...messages, ...pending], [messages, pending]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [all.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };
  const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); };

  const send = async (payload) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic = { ...payload, _id: tempId, tempId, senderId: myInbox, sentBy: currentUser.id, timestamp: new Date().toISOString(), status: 'sending' };
    setPending((p) => [...p, optimistic]);
    setAtBottom(true);
    try {
      await api('/api/chat', { method: 'POST', body: JSON.stringify({ ...payload, engineerId: admin ? engineerId : undefined, caseId: caseId || null }) });
      await load();
      setPending((p) => p.filter((m) => m.tempId !== tempId));
      onRead?.();
    } catch (err) {
      setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'failed', error: err.message } : m)));
    }
  };
  const retry = (m) => { setPending((p) => p.filter((x) => x.tempId !== m.tempId)); const { text: t, attachmentUrl, attachmentType, attachmentMetadata } = m; send({ text: t, attachmentUrl, attachmentType, attachmentMetadata }); };

  const submit = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    if (inputRef.current) inputRef.current.style.height = '';
    send({ text: t });
  };

  const upload = async (dataUrl) => {
    const res = await api('/api/upload', { method: 'POST', body: JSON.stringify({ image: dataUrl, folder: 'chat_attachments' }) });
    if (!res.url) throw new Error('Upload failed');
    return res.url;
  };
  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setSheet(false); setBusy(true);
    try { send({ text: '', attachmentType: 'photo', attachmentUrl: await upload(await compressImage(file)) }); }
    catch (err) { toast.error(err.message || 'Could not send photo'); } finally { setBusy(false); }
  };
  const onDoc = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Files must be under 10 MB'); return; }
    setSheet(false); setBusy(true);
    try { send({ text: file.name, attachmentType: 'document', attachmentUrl: await upload(await readAsDataUrl(file)), attachmentMetadata: { size: file.size } }); }
    catch (err) { toast.error(err.message || 'Could not send file'); } finally { setBusy(false); }
  };
  const onLocation = () => {
    setSheet(false);
    if (!navigator.geolocation) { toast.error('Location is not available on this device'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); send({ text: 'Location', attachmentType: 'location', attachmentUrl: `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`, attachmentMetadata: { lat: p.coords.latitude, lng: p.coords.longitude } }); },
      () => { setBusy(false); toast.error('Turn on location to share it'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // Group into days; show the sender's name when the office side changes person
  const rows = [];
  let lastDay = '';
  all.forEach((m, i) => {
    const day = new Date(m.timestamp).toDateString();
    if (day !== lastDay) { rows.push({ sep: dayLabel(m.timestamp), key: `d-${day}` }); lastDay = day; }
    const mine = m.senderId === myInbox && (!admin || !m.sentBy || m.sentBy === currentUser.id || m.senderId === 'ADMIN');
    const prev = all[i - 1];
    const sameRun = prev && prev.senderId === m.senderId && (prev.sentBy || '') === (m.sentBy || '') && new Date(m.timestamp) - new Date(prev.timestamp) < 5 * 60000 && new Date(prev.timestamp).toDateString() === day;
    const showName = m.senderId === 'ADMIN' && m.sentByName && !sameRun && (!admin || m.sentBy !== currentUser.id);
    rows.push({ m, mine, sameRun, showName, key: m._id });
  });

  return (
    <div className={`ch-thread ${isMini ? 'mini' : ''}`}>
      <header className="ch-head">
        {onBack && <button className="ch-back" onClick={onBack} aria-label="Back"><ChevronLeft size={26} /></button>}
        <span className={`ch-avatar sm ${admin ? '' : 'office'}`} style={admin ? avatarStyle(engineerId) : undefined}>{admin ? initials(title) : 'GV'}</span>
        <div className="ch-head-text">
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
        {wa && (
          <a className="ch-icon wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${title}`} title="WhatsApp (chat or free call)">
            <WhatsAppGlyph size={21} />
          </a>
        )}
        {phone && <a className="ch-icon" href={`tel:${phone}`} aria-label={`Call ${title}`} title={`Call ${phone}`}><Phone size={20} /></a>}
      </header>

      <div className="ch-scroll" ref={scrollRef} onScroll={onScroll}>
        {loaded && all.length === 0 && (
          <div className="ch-hello">
            <div className="ch-hello-icon">💬</div>
            <b>No messages yet</b>
            <span>{admin ? `Send ${title.split(' ')[0]} a message.` : 'Messages here go to your branch admin and head office.'}</span>
          </div>
        )}
        {rows.map((r) => (r.sep ? (
          <div key={r.key} className="ch-day"><span>{r.sep}</span></div>
        ) : (
          <Bubble key={r.key} m={r.m} mine={r.mine} sameRun={r.sameRun} showName={r.showName} onOpenPhoto={setLightbox} onRetry={retry} />
        )))}
      </div>

      {!atBottom && <button className="ch-down" onClick={toBottom} aria-label="Scroll to latest"><ChevronDown size={20} /></button>}

      <form className="ch-compose" onSubmit={submit}>
        <button type="button" className="ch-plus" onClick={() => setSheet(true)} aria-label="Attach" disabled={busy}>
          {busy ? <Loader2 size={20} className="spin" /> : <Plus size={22} />}
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          placeholder="Message"
          onChange={(e) => { setText(e.target.value); e.target.style.height = ''; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); submit(); } }}
        />
        <button type="submit" className="ch-send" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf" hidden onChange={onDoc} />

      {sheet && (
        <div className="ch-sheet-bg" onClick={() => setSheet(false)}>
          <div className="ch-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ch-sheet-group">
              <button onClick={() => cameraRef.current?.click()}><span className="ch-tile blue"><Camera size={18} /></span>Camera</button>
              <button onClick={() => photoRef.current?.click()}><span className="ch-tile purple"><ImageIcon size={18} /></span>Photo</button>
              <button onClick={() => docRef.current?.click()}><span className="ch-tile indigo"><FileText size={18} /></span>Document</button>
              <button onClick={onLocation}><span className="ch-tile green"><MapPin size={18} /></span>My Location</button>
            </div>
            <button className="ch-sheet-cancel" onClick={() => setSheet(false)}>Cancel</button>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="ch-lightbox" onClick={() => setLightbox(null)}>
          <button className="ch-lightbox-x" aria-label="Close"><X size={22} /></button>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}

function Bubble({ m, mine, sameRun, showName, onOpenPhoto, onRetry }) {
  const type = m.attachmentType === 'gallery' ? 'photo' : m.attachmentType;
  const text = legacyText(m.text);
  const status = m.status === 'sending'
    ? <Clock size={12} className="tick" />
    : m.status === 'failed' ? null
    : mine ? (m.isRead ? <CheckCheck size={15} className="tick read" /> : <Check size={15} className="tick" />) : null;
  return (
    <div className={`ch-msg ${mine ? 'me' : 'them'} ${sameRun ? 'run' : ''}`}>
      {showName && <div className="ch-name">{m.sentByName}</div>}
      <div className={`ch-bubble ${type ? `att ${type}` : ''}`}>
        {type === 'photo' && (
          <button className="ch-photo" onClick={() => onOpenPhoto(m.attachmentUrl)}><img src={m.attachmentUrl} alt="Photo" loading="lazy" /></button>
        )}
        {type === 'document' && (
          <a className="ch-doc" href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
            <span className="ch-doc-icon"><FileText size={20} /></span>
            <span className="ch-doc-name">{text || 'Document'}</span>
          </a>
        )}
        {type === 'location' && (
          <a className="ch-loc" href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
            <span className="ch-loc-map"><MapPin size={26} /></span>
            <span className="ch-loc-text">Location<small>Open in Maps</small></span>
          </a>
        )}
        {type === 'contact' && <span>👤 {m.attachmentMetadata?.name} {m.attachmentMetadata?.phone}</span>}
        {!type && <span className="ch-text">{text}</span>}
        <span className="ch-meta">{hhmm(m.timestamp)} {status}</span>
      </div>
      {m.status === 'failed' && (
        <button className="ch-failed" onClick={() => onRetry(m)}><AlertCircle size={14} /> Not sent — tap to retry</button>
      )}
    </div>
  );
}
