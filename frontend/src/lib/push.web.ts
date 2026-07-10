import { notificationsApi } from '../api/notifications';

// Web push registration via the standard Web Push API (VAPID) — our own backend
// sends notifications straight to the browser's push service, no Firebase.
//
// Best-effort: if the backend has no VAPID key configured, the browser lacks
// support, or the user denies permission, this silently no-ops and the in-app
// bell/badge still delivers every response.

// Convert a base64url VAPID key into the Uint8Array the Push API expects.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// Signature mirrors the native push.ts (token, onMessage). The token isn't
// needed on web — the api client attaches auth to the subscribe call itself.
export async function registerForPush(
  _token?: string | null,
  _onMessage?: () => void
): Promise<void> {
  try {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return;
    }

    // Ask the backend for its public VAPID key; absent = web push not configured.
    const { publicKey } = await notificationsApi.vapidPublicKey();
    if (!publicKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Reuse an existing subscription or create one bound to our VAPID key.
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await notificationsApi.subscribeWebPush(subscription.toJSON());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[push] web push not enabled:', (err as Error)?.message);
  }
}

// Tear the browser's push subscription down and tell the backend to forget it.
//
// This used to be a no-op, on the grounds that "the subscription persists across
// sessions" — which is exactly the problem. The PushToken row stayed bound to
// the agent who signed out, so the next agent to use this browser received the
// previous one's notifications. Called before the token is cleared, because
// /notifications/unsubscribe is an authenticated endpoint.
export async function unregisterFromPush(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    // Drop the server record first: after unsubscribe() we no longer have an
    // endpoint to name, and a stale row would keep receiving sends.
    await notificationsApi.unsubscribeWebPush(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch (err) {
    console.log('[push] web push teardown failed:', (err as Error)?.message);
  }
}
