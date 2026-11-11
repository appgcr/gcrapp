import React, { useId } from 'react';

// Premium hero for the "Allow access" screen: a glossy shield tile (privacy) with the
// three things we ask for — location, camera, notifications — orbiting it.
export default function PermissionsHeroIcon({ size = 132 }) {
  const uid = useId().replace(/:/g, '');
  const id = (n) => `${n}-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id('tile')} x1="66" y1="30" x2="66" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5AC8FA" />
          <stop offset="0.55" stopColor="#1A8CFF" />
          <stop offset="1" stopColor="#0A60FF" />
        </linearGradient>
        <linearGradient id={id('gloss')} x1="66" y1="30" x2="66" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('shield')} x1="66" y1="44" x2="66" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E6F0FF" />
        </linearGradient>
        <linearGradient id={id('green')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4CD964" /><stop offset="1" stopColor="#28C840" /></linearGradient>
        <linearGradient id={id('gray')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A1A1A6" /><stop offset="1" stopColor="#7C7C82" /></linearGradient>
        <linearGradient id={id('red')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF6259" /><stop offset="1" stopColor="#FF3B30" /></linearGradient>
        <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0A60FF" floodOpacity="0.32" />
        </filter>
        <filter id={id('chip')} x="-40%" y="-40%" width="180%" height="190%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* faint orbit */}
      <circle cx="66" cy="67" r="58" stroke="#007AFF" strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="3 6" />

      {/* main tile */}
      <g filter={`url(#${id('soft')})`}>
        <rect x="30" y="31" width="72" height="72" rx="20" fill={`url(#${id('tile')})`} />
      </g>
      <rect x="30" y="31" width="72" height="36" rx="20" fill={`url(#${id('gloss')})`} />
      <rect x="30.75" y="31.75" width="70.5" height="70.5" rx="19.25" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />

      {/* shield + check */}
      <path d="M66 45.5 L84 52.2 V66.4 C84 77.6 76.5 85.4 66 89 C55.5 85.4 48 77.6 48 66.4 V52.2 Z" fill={`url(#${id('shield')})`} />
      <path d="M57.5 67.5 L63.5 73.5 L75 61.5" stroke="#0A6CFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* location chip (top-left) */}
      <g filter={`url(#${id('chip')})`}>
        <circle cx="22" cy="34" r="15" fill={`url(#${id('green')})`} />
      </g>
      <circle cx="22" cy="34" r="14.25" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M22 26.5c-3.6 0-6.2 2.7-6.2 6 0 4.4 6.2 9.6 6.2 9.6s6.2-5.2 6.2-9.6c0-3.3-2.6-6-6.2-6z" fill="#fff" />
      <circle cx="22" cy="32.6" r="2.3" fill="#28C840" />

      {/* camera chip (right) */}
      <g filter={`url(#${id('chip')})`}>
        <circle cx="113" cy="62" r="15" fill={`url(#${id('gray')})`} />
      </g>
      <circle cx="113" cy="62" r="14.25" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      <rect x="104" y="56.5" width="18" height="12.5" rx="3" fill="#fff" />
      <path d="M109.5 56.5 L111 54 H115 L116.5 56.5 Z" fill="#fff" />
      <circle cx="113" cy="62.7" r="3.6" fill="#8E8E93" />
      <circle cx="113" cy="62.7" r="1.8" fill="#fff" />

      {/* notification chip (bottom-left) */}
      <g filter={`url(#${id('chip')})`}>
        <circle cx="26" cy="104" r="15" fill={`url(#${id('red')})`} />
      </g>
      <circle cx="26" cy="104" r="14.25" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M26 96.5c-3.3 0-5.6 2.5-5.6 5.6v3.6l-1.7 2.4h14.6l-1.7-2.4v-3.6c0-3.1-2.3-5.6-5.6-5.6z" fill="#fff" />
      <path d="M23.8 109.8a2.3 2.3 0 0 0 4.4 0z" fill="#fff" />
    </svg>
  );
}
