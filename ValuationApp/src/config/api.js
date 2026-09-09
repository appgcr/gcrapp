// Centralized API configuration
// In production, set VITE_API_URL to your Render backend URL
// e.g. VITE_API_URL=https://gcrapp.onrender.com
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const getApiUrl = (endpoint) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};
