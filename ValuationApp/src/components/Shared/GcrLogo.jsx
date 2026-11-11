import React, { useId } from 'react';

export default function GcrLogo({ size = 96, className = '' }) {
  // Unique per instance: duplicate ids break gradients when the logo renders twice on one page
  const uid = useId().replace(/:/g, '');
  const id = (name) => `${name}-${uid}`;
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', willChange: 'transform' }}
    >
      <defs>
        {/* Rich Blue Gradient Background */}
        <linearGradient id={id('gcrBgGrad')} x1="60" y1="20" x2="452" y2="492" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="45%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>

        {/* Golden Roof Gradient */}
        <linearGradient id={id('gcrGoldGrad')} x1="100" y1="100" x2="412" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Outer Glass Border */}
        <linearGradient id={id('gcrGlassBorder')} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.08" />
        </linearGradient>

        {/* Premium Ambient Drop Shadow */}
        <filter id={id('gcrBadgeShadow')} x="0" y="8" width="512" height="504" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#1E3A8A" floodOpacity="0.35" />
        </filter>

        {/* Pill Shadow for 3D Pop */}
        <filter id={id('pillShadow')} x="90" y="365" width="332" height="84" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Rounded Squircle Base */}
      <rect x="16" y="16" width="480" height="480" rx="112" fill={`url(#${id('gcrBgGrad')})`} filter={`url(#${id('gcrBadgeShadow')})`} />
      <rect x="17.5" y="17.5" width="477" height="477" rx="110.5" stroke={`url(#${id('gcrGlassBorder')})`} strokeWidth="3" />

      {/* Inner Ambient Arc */}
      <path d="M32 128C32 75 75 32 128 32H384C437 32 480 75 480 128V175C420 155 300 145 256 145C200 145 90 155 32 175V128Z" fill="white" fillOpacity="0.08" />

      {/* 1. Architectural Apex Chevron (Gold) */}
      <path d="M116 210L256 114L396 210" stroke={`url(#${id('gcrGoldGrad')})`} strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />

      {/* 2. Luminous Cyan Diamond Crest */}
      <path d="M256 156L288 188L256 220L224 188Z" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="3" />

      {/* 3. Bold High-Contrast Typography "GCR" */}
      <text x="256" y="338" fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', 'Segoe UI', Arial, sans-serif" fontWeight="900" fontSize="128" fill="#FFFFFF" textAnchor="middle" letterSpacing="4">GCR</text>

      {/* 4. Ultra-Clear Solid White "VALUATION" Badge with Bold Navy Text */}
      <rect x="96" y="370" width="320" height="66" rx="33" fill="#FFFFFF" filter={`url(#${id('pillShadow')})`} />
      <text 
        x="256" 
        y="415" 
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', Arial, sans-serif" 
        fontWeight="900" 
        fontSize="34" 
        fill="#1E3A8A" 
        textAnchor="middle" 
        letterSpacing="5.5"
      >
        VALUATION
      </text>
    </svg>
  );
}
