import React, { useEffect, useState } from 'react';
import { Fingerprint, LogOut } from 'lucide-react';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import GcrLogo from '../Shared/GcrLogo';
import './LoginScreen.css';
import toast from 'react-hot-toast';

export default function AppLock({ onUnlock, onFallback }) {
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        setIsAvailable(false);
      } else {
        // Automatically prompt on load
        handleBiometricUnlock();
      }
    } catch (e) {
      console.warn("Biometrics check failed", e);
      setIsAvailable(false);
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Unlock Gouru Valuations",
        title: "App Locked",
        subtitle: "Verify your identity to open the app",
        description: "Use your fingerprint or FaceID"
      });
      onUnlock();
    } catch (e) {
      console.error(e);
      toast.error("Biometric authentication failed or was cancelled.");
    }
  };

  return (
    <div className="lg-root lk-root">
      <main className="lg-main">
        <div className="lg-form-wrap" style={{ textAlign: 'center' }}>
          <header className="lg-head">
            <div className="lg-logo"><GcrLogo size={76} /></div>
            <h2>Gouru is locked</h2>
            <p>Verify it’s you to continue.</p>
          </header>
          {isAvailable ? (
            <button className="lg-primary" onClick={handleBiometricUnlock}>
              <Fingerprint size={20} /> Unlock with Face ID or Fingerprint
            </button>
          ) : (
            <div className="lk-note">Face ID / fingerprint isn’t set up on this device.</div>
          )}
          <button className="lg-secondary" style={{ marginTop: 12 }} onClick={onFallback}>
            <LogOut size={18} /> Sign in with Password
          </button>
        </div>
      </main>
    </div>
  );
}
