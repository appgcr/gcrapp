import React, { useEffect, useRef } from 'react';
import { Megaphone, Check, ImagePlus, X, Loader2, ChevronRight, Send } from 'lucide-react';
import IconTile from '../Shared/IconTile';

// iOS-style compose sheet for admin announcements.
// Phone: slides up from the bottom with a grabber. Desktop: centred card.
// All data/sending logic stays in AdminPortal; this component is presentation only.

const MAX_LEN = 1000;
const AVATAR_COLORS = [
  ['#5AC8FA', '#007AFF'], ['#FF9F0A', '#FF6B00'], ['#34C759', '#248A3D'],
  ['#AF52DE', '#8944AB'], ['#FF2D55', '#D70015'], ['#5E5CE6', '#3634A3'],
];

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
const colorFor = (key = '') => AVATAR_COLORS[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function BroadcastSheet({
  onClose,
  message, setMessage,
  image, setImage,
  target, setTarget,
  staff,
  isBroadcasting, isUploadingImage,
  fileInputRef, onImageChange,
  onSend,
}) {
  const textRef = useRef(null);
  const allSelected = target.includes('ALL');
  const recipientCount = allSelected ? staff.length : target.length;
  const canSend = (message.trim() || image) && recipientCount > 0 && !isBroadcasting && !isUploadingImage;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !isBroadcasting) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, isBroadcasting]);

  const selectAll = () => setTarget(['ALL']);
  const toggleStaff = (id) => {
    // Tapping a person while "All" is on narrows the selection to just that person
    let next = allSelected ? [] : target.filter((t) => t !== 'ALL');
    next = next.includes(id) ? next.filter((t) => t !== id) : [...next, id];
    setTarget(next.length ? next : ['ALL']);
  };

  return (
    <div className="bs-backdrop" onClick={() => !isBroadcasting && onClose()}>
      <div
        className="bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bs-grabber" aria-hidden="true" />

        {/* Navigation bar */}
        <div className="bs-nav">
          <button className="bs-nav-btn" onClick={onClose} disabled={isBroadcasting}>Cancel</button>
          <div id="bs-title" className="bs-title">New Announcement</div>
          <button className="bs-nav-btn bs-nav-send" onClick={onSend} disabled={!canSend}>
            {isBroadcasting ? <Loader2 size={18} className="spin" /> : 'Send'}
          </button>
        </div>

        <div className="bs-body">
          {/* Recipients */}
          <div className="bs-section-label">
            <span>To</span>
            <span className="bs-section-hint">
              {recipientCount} {recipientCount === 1 ? 'person' : 'people'}
            </span>
          </div>
          <div className="bs-group bs-recipients">
            <button className="bs-row" onClick={selectAll} aria-pressed={allSelected}>
              <IconTile icon={Megaphone} color="orange" size={32} />
              <div className="bs-row-text">
                <div className="bs-row-title">All Staff</div>
                <div className="bs-row-sub">Every field engineer{staff.length ? ` · ${staff.length}` : ''}</div>
              </div>
              {allSelected && <Check className="bs-check" size={20} strokeWidth={2.6} />}
            </button>

            {staff.map((s) => {
              const name = s.name || s.id;
              const [c1, c2] = colorFor(s.id || name);
              const on = !allSelected && target.includes(s.id);
              return (
                <button key={s.id} className="bs-row" onClick={() => toggleStaff(s.id)} aria-pressed={on}>
                  <span className="bs-avatar" style={{ background: `linear-gradient(180deg, ${c1}, ${c2})` }}>{initials(name)}</span>
                  <div className="bs-row-text">
                    <div className="bs-row-title">{name}</div>
                    <div className="bs-row-sub">Field Engineer</div>
                  </div>
                  {on && <Check className="bs-check" size={20} strokeWidth={2.6} />}
                </button>
              );
            })}

            {staff.length === 0 && (
              <div className="bs-empty">Loading staff…</div>
            )}
          </div>

          {/* Message */}
          <div className="bs-section-label"><span>Message</span></div>
          <div className="bs-group bs-message" onClick={() => textRef.current?.focus()}>
            <textarea
              ref={textRef}
              value={message}
              maxLength={MAX_LEN}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement…"
              disabled={isBroadcasting}
              rows={5}
            />
            <div className={`bs-counter ${message.length > MAX_LEN * 0.9 ? 'warn' : ''}`}>
              {message.length}/{MAX_LEN}
            </div>
          </div>

          {/* Attachment */}
          <input type="file" accept="image/*" ref={fileInputRef} onChange={onImageChange} style={{ display: 'none' }} />
          {image ? (
            <div className="bs-group bs-image">
              <img src={image} alt="Attachment preview" />
              <button className="bs-image-remove" onClick={() => setImage('')} aria-label="Remove photo" disabled={isBroadcasting}>
                <X size={16} strokeWidth={2.6} />
              </button>
            </div>
          ) : (
            <div className="bs-group">
              <button
                className="bs-row"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBroadcasting || isUploadingImage}
              >
                <IconTile icon={ImagePlus} color="blue" size={32} />
                <div className="bs-row-text">
                  <div className="bs-row-title">{isUploadingImage ? 'Uploading photo…' : 'Add Photo'}</div>
                  <div className="bs-row-sub">Optional image shown with the message</div>
                </div>
                {isUploadingImage
                  ? <Loader2 size={18} className="spin bs-chevron" />
                  : <ChevronRight size={18} className="bs-chevron" />}
              </button>
            </div>
          )}
        </div>

        {/* Primary action */}
        <div className="bs-footer">
          <button className="bs-send" onClick={onSend} disabled={!canSend}>
            {isBroadcasting
              ? <><Loader2 size={18} className="spin" /> Sending…</>
              : <><Send size={18} strokeWidth={2.4} /> Send to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}</>}
          </button>
        </div>
      </div>

      <style>{`
        .bs-backdrop {
          position: fixed; inset: 0; z-index: 10002;
          background: rgba(0, 0, 0, 0.32);
          display: flex; align-items: flex-end; justify-content: center;
          animation: bsFade 0.22s ease-out;
        }
        .bs-sheet {
          width: 100%; max-width: 560px; max-height: 92vh;
          display: flex; flex-direction: column;
          background: #f2f2f7;
          border-radius: 14px 14px 0 0;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.18);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', sans-serif;
          animation: bsUp 0.34s cubic-bezier(0.2, 0.9, 0.25, 1);
        }
        @media (min-width: 768px) {
          .bs-backdrop { align-items: center; padding: 24px; }
          .bs-sheet { border-radius: 16px; max-height: 86vh; animation: bsPop 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.1); }
          .bs-grabber { display: none; }
        }
        .bs-grabber { width: 36px; height: 5px; border-radius: 3px; background: #c7c7cc; margin: 6px auto 0; flex-shrink: 0; }

        .bs-nav {
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
          padding: 10px 16px 10px; flex-shrink: 0;
          border-bottom: 0.5px solid rgba(60, 60, 67, 0.2);
          background: rgba(242, 242, 247, 0.94);
        }
        .bs-title { font-size: 17px; font-weight: 600; color: #000; letter-spacing: -0.2px; }
        .bs-nav-btn {
          background: none; border: none; padding: 6px 0; cursor: pointer;
          font-size: 17px; color: #007aff; font-family: inherit; justify-self: start;
          display: inline-flex; align-items: center;
        }
        .bs-nav-send { justify-self: end; font-weight: 600; }
        .bs-nav-btn:disabled { color: #c7c7cc; cursor: default; }

        .bs-body { overflow-y: auto; padding: 4px 16px 12px; -webkit-overflow-scrolling: touch; }
        .bs-section-label {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 18px 16px 7px; font-size: 13px; color: #6d6d72;
          text-transform: uppercase; letter-spacing: 0.2px;
        }
        .bs-section-hint { text-transform: none; letter-spacing: 0; }

        .bs-group { background: #fff; border-radius: 12px; overflow: hidden; }
        .bs-recipients { max-height: 232px; overflow-y: auto; }

        .bs-row {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 9px 16px; min-height: 56px;
          background: #fff; border: none; text-align: left; cursor: pointer;
          font-family: inherit; position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .bs-row:active { background: #e5e5ea; }
        .bs-row:disabled { cursor: default; }
        .bs-row + .bs-row::before {
          content: ''; position: absolute; top: 0; right: 0; left: 60px;
          border-top: 0.5px solid rgba(60, 60, 67, 0.22);
        }
        .bs-row-text { flex: 1; min-width: 0; }
        .bs-row-title { font-size: 16px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bs-row-sub { font-size: 13px; color: #8e8e93; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bs-check { color: #007aff; flex-shrink: 0; }
        .bs-chevron { color: #c7c7cc; flex-shrink: 0; }
        .bs-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          color: #fff; font-size: 13px; font-weight: 600; letter-spacing: 0.3px;
        }
        .bs-empty { padding: 14px 16px; font-size: 14px; color: #8e8e93; }

        .bs-message { padding: 12px 16px 8px; cursor: text; }
        .bs-message textarea {
          width: 100%; box-sizing: border-box; border: none; outline: none; resize: none;
          font-family: inherit; font-size: 16px; line-height: 1.4; color: #000;
          background: transparent; min-height: 110px; padding: 0;
        }
        .bs-message textarea::placeholder { color: #c7c7cc; }
        .bs-counter { text-align: right; font-size: 12px; color: #aeaeb2; font-variant-numeric: tabular-nums; }
        .bs-counter.warn { color: #ff9500; }

        .bs-image { position: relative; margin-top: 16px; aspect-ratio: 16 / 9; }
        .bs-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bs-image-remove {
          position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 50%;
          border: none; cursor: pointer; color: #fff;
          background: rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
        }
        .bs-message + input + .bs-group, .bs-message ~ .bs-group { margin-top: 16px; }

        .bs-footer {
          padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
          background: #f2f2f7; flex-shrink: 0;
        }
        .bs-send {
          width: 100%; height: 50px; border: none; border-radius: 14px; cursor: pointer;
          background: #007aff; color: #fff; font-family: inherit;
          font-size: 17px; font-weight: 600; letter-spacing: -0.2px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.15s ease, transform 0.12s ease;
        }
        .bs-send:active:not(:disabled) { transform: scale(0.98); opacity: 0.85; }
        .bs-send:disabled { background: #b4d5ff; cursor: default; }

        .bs-nav-btn:focus-visible, .bs-row:focus-visible, .bs-send:focus-visible, .bs-image-remove:focus-visible {
          outline: 2px solid #007aff; outline-offset: -2px;
        }

        @keyframes bsFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bsUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bsPop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .bs-backdrop, .bs-sheet { animation: none; } }
      `}</style>
    </div>
  );
}
