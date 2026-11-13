import React from 'react';
import logo from '../../assets/gcr_logo.png';

/** The Gouru Valuations brand logo — the same image as the app icon (made by ValuationApp/make_icon.py). */
export default function GcrLogo({ size = 96, className = '' }) {
  return (
    <img
      src={logo}
      width={size}
      height={size}
      alt="Gouru Valuations"
      className={className}
      draggable="false"
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  );
}
