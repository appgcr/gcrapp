// Dynamically resolve API URL:
// 1. If explicit non-localhost env var is set, use it
// 2. If running on a local network IP (e.g. mobile phone on Wi-Fi), connect to that host IP:5001
// 3. Otherwise default to live production server (Render) for mobile, and localhost for web dev
function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  // If running on local computer browser at localhost or in Capacitor webview
  if (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    // If running in Capacitor native Android/iOS wrapper
    if (window?.Capacitor?.isNativePlatform?.()) {
      // Mobile device cannot reach laptop's localhost directly; point to live production server
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return 'https://gcrapp-api.onrender.com';
      }
      return envUrl;
    }
    // Browser testing on laptop
    return envUrl || 'http://localhost:5001';
  }

  // If running on a local network IP (e.g. mobile phone on Wi-Fi)
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    if (window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.') || window.location.hostname.startsWith('172.')) {
      return `${window.location.protocol}//${window.location.hostname}:5001`;
    }
  }

  // Hosted website (Vercel), mobile native, and anything else: the live Render server
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  return 'https://gcrapp-api.onrender.com';
}

export const API_BASE_URL = getApiBaseUrl();


export const getApiUrl = (endpoint) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};
