import { Capacitor, registerPlugin } from '@capacitor/core';

// Android: the app's own MicPermission plugin (MainActivity) shows the system prompt.
// iPhone / web: the browser asks when recording starts (Info.plist has the reason text).
const Mic = registerPlugin('MicPermission');
const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** 'granted' | 'denied' | 'prompt' | 'unavailable' */
export async function micState() {
  try {
    if (isAndroid()) return (await Mic.check()).microphone || 'prompt';
    if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
    const r = await navigator.permissions?.query({ name: 'microphone' });
    return r?.state || 'prompt';
  } catch { return 'prompt'; }
}

/** Ask for the microphone now. → 'granted' | 'denied' | 'unavailable' */
export async function requestMic() {
  try {
    if (isAndroid()) {
      const s = (await Mic.request()).microphone;
      if (s !== 'granted') return 'denied';
    }
    if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
    // Also lets the in-app browser (WebView / WKWebView) ask, then releases the mic at once
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err) {
    return err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'denied' : 'unavailable';
  }
}

/** Open this app's page in the phone settings (Android); iPhone users go to Settings → Gouru Valuations. */
export async function openMicSettings() {
  if (isAndroid()) { try { await Mic.openSettings(); return true; } catch { /* ignore */ } }
  return false;
}
