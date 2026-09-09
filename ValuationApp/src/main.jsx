import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { API_BASE_URL } from './config/api'

// Dynamically route all API requests to configured API_BASE_URL
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (resource, init) {
    if (typeof resource === 'string' && resource.startsWith('https://gcr-9ys1.onrender.com')) {
      resource = resource.replace('https://gcr-9ys1.onrender.com', API_BASE_URL);
    }
    return originalFetch.call(this, resource, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
