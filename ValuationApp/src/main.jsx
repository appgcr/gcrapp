import { installNativeGeolocation } from './utils/nativeGeolocation';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiAuth } from './utils/session'
import { installTestServerBadge } from './utils/testServerBadge'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// Attach the login token (and branch being viewed) to every API request
installApiAuth()
installTestServerBadge() // "TEST SERVER" tag when not on the live server
installNativeGeolocation() // iPhone: native location prompt instead of the web view's 'localhost' one

// Phone keyboard: the screen shrinks above it (capacitor.config.json → Keyboard.resize "native");
// while it is open the bottom tab bar steps aside so the form has the room
if (Capacitor.isNativePlatform()) {
  Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('kb-open')).catch(() => {})
  Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('kb-open')).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
