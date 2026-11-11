import React from 'react';

// iOS Settings-style icon tile: white glyph on a softly graded, continuous-corner
// colour tile. Colours follow Apple's system palette.
export const TILE_COLORS = {
  blue:   ['#3D9BFF', '#0A7AFF'],
  red:    ['#FF6259', '#FF3B30'],
  orange: ['#FFB340', '#FF9500'],
  green:  ['#4CD964', '#28C840'],
  teal:   ['#5AD2F0', '#30B0D7'],
  indigo: ['#7D7AFF', '#5856D6'],
  purple: ['#C77DFF', '#AF52DE'],
  pink:   ['#FF6B8B', '#FF2D55'],
  gray:   ['#A1A1A6', '#8E8E93'],
  graphite: ['#5C5C63', '#3A3A3F'],
};

export default function IconTile({ icon: Icon, glyph, color = 'blue', size = 30, style }) {
  const [top, bottom] = TILE_COLORS[color] || TILE_COLORS.blue;
  const glyphSize = Math.round(size * 0.6);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: Math.round(size * 0.27),
        background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(15,23,42,0.18)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        flexShrink: 0,
        ...style,
      }}
    >
      {glyph || (Icon && <Icon size={glyphSize} strokeWidth={2.25} color="#FFFFFF" />)}
    </span>
  );
}

// Glyph that matches the floating Assistive Touch button (concentric rings)
export function AssistiveGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" fill="#FFFFFF" fillOpacity="0.35" />
      <circle cx="12" cy="12" r="7" fill="#FFFFFF" fillOpacity="0.55" />
      <circle cx="12" cy="12" r="4.6" fill="#FFFFFF" />
    </svg>
  );
}
