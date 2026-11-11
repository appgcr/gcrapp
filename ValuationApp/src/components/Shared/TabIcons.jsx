import React from 'react';

// SF Symbols-inspired tab bar glyphs.
// Each icon draws an outline when inactive and a filled version when `active`,
// the same way iOS tab bars switch between "symbol" and "symbol.fill".
// Cut-outs on filled icons use the --tab-cut colour (tab bar background).

const SW = 1.8; // outline stroke width
const CUT = 'var(--tab-cut, #ffffff)';

const Svg = ({ size = 26, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);

export function GridIcon({ active, size }) {
  const p = active
    ? { fill: 'currentColor' }
    : { stroke: 'currentColor', strokeWidth: SW };
  return (
    <Svg size={size}>
      <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" {...p} />
      <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2" {...p} />
      <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2" {...p} />
      <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2" {...p} />
    </Svg>
  );
}

export function DocIcon({ active, size }) {
  const line = active ? CUT : 'currentColor';
  return (
    <Svg size={size}>
      <rect
        x="4.5" y="2.8" width="15" height="18.4" rx="3.2"
        {...(active ? { fill: 'currentColor' } : { stroke: 'currentColor', strokeWidth: SW })}
      />
      <path d="M8.3 8.2h7.4M8.3 12h7.4M8.3 15.8h4.6" stroke={line} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({ active, size }) {
  const cut = active ? CUT : 'currentColor';
  return (
    <Svg size={size}>
      <rect
        x="3.3" y="4.6" width="17.4" height="16.4" rx="3.4"
        {...(active ? { fill: 'currentColor' } : { stroke: 'currentColor', strokeWidth: SW })}
      />
      {!active && <path d="M3.6 9.4h16.8" stroke="currentColor" strokeWidth={SW} />}
      <path d="M8 2.8v3.4M16 2.8v3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.6 14.6l2.3 2.3 4.6-4.6" stroke={cut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PeopleIcon({ active, size }) {
  const p = active
    ? { fill: 'currentColor' }
    : { stroke: 'currentColor', strokeWidth: SW, strokeLinejoin: 'round' };
  return (
    <Svg size={size}>
      {/* back person */}
      <circle cx="16.6" cy="8.3" r="2.9" {...p} />
      <path d="M15.4 13.6c.4-.1.8-.1 1.2-.1 2.9 0 5 1.9 5 4.6 0 .7-.5 1.2-1.2 1.2h-3.2" {...(active ? { fill: 'currentColor' } : { stroke: 'currentColor', strokeWidth: SW, strokeLinecap: 'round' })} />
      {/* front person */}
      <circle cx="9" cy="7.8" r="3.6" {...p} />
      <path d="M2.6 19c0-3.4 2.8-5.9 6.4-5.9s6.4 2.5 6.4 5.9c0 .8-.6 1.4-1.4 1.4H4c-.8 0-1.4-.6-1.4-1.4Z" {...p} />
    </Svg>
  );
}

export function GearIcon({ active, size }) {
  const teeth = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    const x1 = 12 + Math.cos(a) * 6.6;
    const y1 = 12 + Math.sin(a) * 6.6;
    const x2 = 12 + Math.cos(a) * 9.1;
    const y2 = 12 + Math.sin(a) * 9.1;
    teeth.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />,
    );
  }
  return (
    <Svg size={size}>
      {teeth}
      {active ? (
        <>
          <circle cx="12" cy="12" r="7.3" fill="currentColor" />
          <circle cx="12" cy="12" r="2.7" fill={CUT} />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="6.6" fill={CUT} stroke="currentColor" strokeWidth={SW} />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth={SW} />
        </>
      )}
    </Svg>
  );
}

export function ChatIcon({ active, size }) {
  return (
    <Svg size={size}>
      <path
        d="M12 3.6c-4.9 0-8.6 3.3-8.6 7.6 0 2.3 1.1 4.3 2.9 5.7-.2 1.3-.9 2.6-1.8 3.4 2 .1 3.8-.6 5-1.6.8.2 1.6.3 2.5.3 4.9 0 8.6-3.4 8.6-7.8S16.9 3.6 12 3.6Z"
        strokeLinejoin="round"
        {...(active ? { fill: 'currentColor' } : { stroke: 'currentColor', strokeWidth: SW })}
      />
    </Svg>
  );
}
