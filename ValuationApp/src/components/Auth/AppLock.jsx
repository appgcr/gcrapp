import React, { useEffect, useState } from 'react';
import { Fingerprint, LogOut, ShieldAlert } from 'lucide-react';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
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
        reason: "Unlock GCR App",
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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#f8fafc',
      zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: '#0346c8', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 10px 25px rgba(3, 70, 200, 0.3)' }}>
          <ShieldAlert size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px' }}>GCR App Locked</h2>
        <p style={{ color: '#64748b', margin: 0 }}>Please verify your identity to continue.</p>
      </div>

      {isAvailable ? (
        <button 
          onClick={handleBiometricUnlock}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#0346c8', color: '#fff',
            border: 'none', borderRadius: '12px',
            padding: '16px 32px', fontSize: '16px', fontWeight: '600',
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(3, 70, 200, 0.4)',
            marginBottom: '24px'
          }}
        >
          <Fingerprint size={24} />
          Unlock with Biometrics
        </button>
      ) : (
        <div style={{ marginBottom: '24px', color: '#b91c1c', fontSize: '14px', textAlign: 'center', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          Biometrics are not set up or not available on this device.
        </div>
      )}

      <button 
        onClick={onFallback}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'transparent', color: '#475569',
          border: '1px solid #cbd5e1', borderRadius: '8px',
          padding: '12px 24px', fontSize: '14px', fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <LogOut size={18} />
        Log Out & Use Password
      </button>
    </div>
  );
}
