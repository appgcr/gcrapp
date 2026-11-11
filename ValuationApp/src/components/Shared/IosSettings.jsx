import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import IconTile from './IconTile';

// Shared iPhone Settings building blocks used by Admin and Engineer Settings.
// Components are top-level so React keeps them mounted between renders
// (switch animations play and keyboard focus is kept).

export function Row({ icon, glyph, color, label, value, onClick, danger, children }) {
  return (
    <button type="button" className={`ios-row ${onClick ? 'is-link' : ''}`} onClick={onClick} disabled={!onClick && !children}>
      {(icon || glyph) && <IconTile icon={icon} glyph={glyph} color={color} size={30} />}
      <span className={`ios-row-label ${danger ? 'danger' : ''}`}>{label}</span>
      {value && <span className="ios-row-value">{value}</span>}
      {children}
      {onClick && <ChevronRight size={18} className="ios-chev" aria-hidden="true" />}
    </button>
  );
}

export function Switch({ on, onChange, label }) {
  return (
    <span
      role="switch"
      tabIndex={0}
      aria-checked={on}
      aria-label={label}
      className={`ios-switch ${on ? 'on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
    >
      <span />
    </span>
  );
}


export function BackBar({ label = 'Settings', onBack, title }) {
  return (
    <>
      <button type="button" className="ios-back" onClick={onBack}>
        <ChevronLeft size={22} strokeWidth={2.4} /> {label}
      </button>
      {title && <h1 className="ios-large-title">{title}</h1>}
    </>
  );
}

export function IosSettingsStyles() {
  return (
    <style>{`
      .admin-main-content:has(.ios-settings) { background: #f2f2f7; }
      .ios-settings { max-width: 640px; margin: 0 auto; font-family: var(--gcr-font, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif); padding-bottom: 24px; }
      .ios-section { padding: 22px 16px 7px; font-size: 13px; color: #6d6d72; text-transform: uppercase; letter-spacing: 0.2px; }
      .ios-group { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.04); }
      .ios-group-gap { margin-top: 28px; }
      .ios-footnote { margin: 7px 16px 0; font-size: 13px; color: #6d6d72; line-height: 1.35; }
      .ios-row {
        width: 100%; min-height: 48px; display: flex; align-items: center; gap: 12px; padding: 8px 14px 8px 16px;
        background: #fff; border: none; text-align: left; font: inherit; color: #000; position: relative;
        -webkit-tap-highlight-color: transparent;
      }
      .ios-row:disabled { opacity: 1; cursor: default; }
      .ios-row.is-link { cursor: pointer; }
      .ios-row.is-link:active { background: #e5e5ea; }
      .ios-row + .ios-row::before, .ios-row + div.ios-row::before {
        content: ''; position: absolute; top: 0; left: 58px; right: 0; border-top: 0.5px solid rgba(60,60,67,0.22);
      }
      .ios-row-label { flex: 1; min-width: 0; font-size: 16px; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ios-row-label.danger { color: #ff3b30; }
      .ios-row-value { font-size: 16px; color: #8e8e93; letter-spacing: -0.3px; }
      .ios-chev { color: #c4c4c7; flex-shrink: 0; margin-left: -4px; }

      .ios-profile { min-height: 78px; padding: 12px 14px 12px 16px; gap: 14px; }
      .ios-avatar {
        width: 58px; height: 58px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(180deg, #a3a8b8, #7d8396); color: #fff;
        display: flex; align-items: center; justify-content: center; font-size: 23px; font-weight: 600; letter-spacing: 0.5px;
      }
      .ios-profile-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .ios-profile-name { font-size: 20px; font-weight: 600; letter-spacing: -0.4px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ios-profile-sub { font-size: 13px; color: #8e8e93; }

      .ios-signout { justify-content: center; color: #ff3b30; font-size: 16px; cursor: pointer; }
      .ios-signout:active { background: #e5e5ea; }
      .ios-version { text-align: center; margin-top: 22px; font-size: 12px; line-height: 1.6; color: #aeaeb2; }

      .ios-switch {
        flex-shrink: 0; width: 51px; height: 31px; border-radius: 16px; cursor: pointer; display: inline-block;
        background: rgba(120,120,128,0.16); position: relative; transition: background 0.2s ease;
      }
      .ios-switch > span {
        position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff;
        box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16); transition: transform 0.22s cubic-bezier(0.3, 0.7, 0.4, 1.2);
      }
      .ios-switch.on { background: #34c759; }
      .ios-switch.on > span { transform: translateX(20px); }
      .ios-switch:focus-visible { outline: 2px solid #007aff; outline-offset: 2px; }

      /* Detail pages */
      .ios-subpage { animation: iosPush 0.32s cubic-bezier(0.2, 0.9, 0.25, 1); }
      @keyframes iosPush { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
      @media (prefers-reduced-motion: reduce) { .ios-subpage { animation: none; } }
      .ios-back {
        display: inline-flex; align-items: center; gap: 0; margin: 0 0 2px -6px; padding: 4px 4px 4px 0;
        background: none; border: none; color: #007aff; font: inherit; font-size: 17px; cursor: pointer; letter-spacing: -0.3px;
      }
      .ios-large-title { margin: 2px 4px 14px; font-size: 30px; font-weight: 700; letter-spacing: -0.6px; color: #000; }
      /* Cards inside a detail page: the page title already names them */
      .ios-subpage .np-head, .ios-subpage .ni-head { display: none; }
      .ios-subpage .np-card, .ios-subpage .rs-card, .ios-subpage .ni-card { margin-top: 0 !important; border-radius: 12px; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.04); }
      .ios-subpage .ios-footnote + .np-card { margin-top: 22px !important; }
      .ios-subpage .ni-periods { margin-top: 14px; }
    
      /* Engineer app container + dark mode */
      .main-content:has(.ios-settings) { background: #f2f2f7; }
      .dark-theme .admin-main-content:has(.ios-settings), .dark-theme .main-content:has(.ios-settings) { background: #000; }
      .dark-theme .ios-group, .dark-theme .ios-row { background: #1c1c1e; color: #fff; }
      .dark-theme .ios-row.is-link:active, .dark-theme .ios-signout:active { background: #2c2c2e; }
      .dark-theme .ios-row + .ios-row::before { border-top-color: rgba(84,84,88,0.6); }
      .dark-theme .ios-profile-name, .dark-theme .ios-large-title { color: #fff; }
      .dark-theme .ios-section, .dark-theme .ios-footnote { color: #8e8e93; }
      .dark-theme .ios-switch { background: rgba(120,120,128,0.32); }
      .dark-theme .ios-switch.on { background: #30d158; }
      .dark-theme .ios-back { color: #0a84ff; }
      /* Cards placed inside settings pages: no extra borders (iOS grouped style) */
      .ios-settings .np-card, .ios-settings .rs-card, .ios-settings .ni-card { border: none !important; }
      .dark-theme .ios-settings .np-card, .dark-theme .ios-settings .rs-card, .dark-theme .ios-settings .ni-card { background: #1c1c1e !important; color: #fff; }
      .dark-theme .ios-settings .np-row + .np-row::before { border-top-color: rgba(84,84,88,0.6); }
    `}</style>
  );
}
