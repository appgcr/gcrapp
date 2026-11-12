import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL } from '../../config/api';

// Registers this phone for push notifications (Firebase on Android, APNs via Firebase on iOS)
// and sends its push address to the server, so alerts arrive even when the app is closed.
// Tapping a notification opens the related case (via the 'gcr_open_case' window event).
// Runs only inside the installed phone app; the web version keeps using the in-app bell.

const TOKEN_KEY = 'gcr_push_token';

const authHeaders = (userId) => {
  const h = { 'Content-Type': 'application/json', 'x-user-id': userId };
  const jwt = localStorage.getItem('token');
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
};

// Call on logout so the old user's alerts stop going to this phone
export async function unregisterPush(userId) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !userId) return;
  try {
    await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/push-token`, {
      method: 'DELETE', headers: authHeaders(userId), body: JSON.stringify({ token }),
    });
  } catch { /* offline: server removes dead tokens on next send */ }
  localStorage.removeItem(TOKEN_KEY);
  if (PUSH_READY && Capacitor.isNativePlatform?.()) {
    try { await PushNotifications.unregister(); } catch { /* ignore */ }
  }
}

// Phone push needs the Firebase keys (google-services.json). Without them Android's push
// registration crashes the app, so it stays off until VITE_FCM_ENABLED=true at build time.
// iPhone push also needs the Firebase iOS app + an Apple push key (not set up yet), so phone push is Android-only for now;
// iPhone users still see every alert inside the app.
const PUSH_READY = import.meta.env.VITE_FCM_ENABLED === 'true' && Capacitor.getPlatform?.() === 'android';

export default function PushRegistration({ currentUser }) {
  // Bumped when the user allows notifications on the "Allow access" screen → register then
  const [permTick, setPermTick] = useState(0);
  useEffect(() => {
    const on = () => setPermTick((n) => n + 1);
    window.addEventListener('gcr_push_permission', on);
    return () => window.removeEventListener('gcr_push_permission', on);
  }, []);

  useEffect(() => {
    if (!PUSH_READY || !currentUser?.id || !Capacitor.isNativePlatform?.()) return undefined;
    let cancelled = false;
    const handles = [];

    const setup = async () => {
      try {
        // The system prompt is shown from the "Allow access" screen (PermissionsSetup),
        // after we've explained why — here we only register once it's granted.
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted' || cancelled) return;

        if (Capacitor.getPlatform() === 'android') {
          // Must match channelId used by the server (services/notify.js)
          await PushNotifications.createChannel({
            id: 'gcr_alerts',
            name: 'Case alerts',
            description: 'New assignments, reviews, returns and approvals',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true,
          });
        }

        handles.push(await PushNotifications.addListener('registration', async ({ value }) => {
          localStorage.setItem(TOKEN_KEY, value);
          try {
            await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser.id)}/push-token`, {
              method: 'POST',
              headers: authHeaders(currentUser.id),
              body: JSON.stringify({ token: value, platform: Capacitor.getPlatform() }),
            });
          } catch (err) {
            console.warn('Push token upload failed', err);
          }
        }));

        handles.push(await PushNotifications.addListener('registrationError', (err) => {
          console.warn('Push registration error', err);
        }));

        // App open: refresh the bell right away instead of waiting for the next poll
        handles.push(await PushNotifications.addListener('pushNotificationReceived', () => {
          window.dispatchEvent(new CustomEvent('gcr_refresh_notifications'));
        }));

        // User tapped a notification → open the related case
        handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const data = notification?.data || {};
          // Engagement tracking: record that this alert was opened from the phone
          const ids = [data.notificationId, ...(String(data.notificationIds || '').split(','))].filter(Boolean);
          if (ids.length) {
            fetch(`${API_BASE_URL}/api/notifications/opened`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
            }).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('gcr_open_case', { detail: { caseId: data.caseId || '', type: data.type || '' } }));
        }));

        await PushNotifications.register();
      } catch (err) {
        console.warn('Push setup failed', err);
      }
    };

    setup();
    return () => {
      cancelled = true;
      handles.forEach((h) => h?.remove?.());
    };
  }, [currentUser?.id, permTick]);

  return null;
}
