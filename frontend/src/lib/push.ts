// Native push registration (Android) — self-hosted, NO Firebase.
//
// Real device notifications are delivered by a foreground service
// (NotificationStreamService.kt) that holds a Server-Sent Events connection to
// our own backend (GET /api/notifications/stream). This module just starts/stops
// that service and relays foreground stream events to a callback so the in-app
// badge can refresh instantly. The in-app bell/badge works regardless.
import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { API_BASE_URL } from '../api/config';

const { NotificationStream } = NativeModules as {
  NotificationStream?: { start: (token: string, baseUrl: string) => void; stop: () => void };
};

let subscription: { remove: () => void } | null = null;

// Start listening for pushes. Call once the agent is authenticated, passing the
// current auth token (the service authenticates the SSE stream with it).
// `onMessage` fires when an event arrives while the app is running (badge refresh).
export async function registerForPush(
  token?: string | null,
  onMessage?: () => void
): Promise<void> {
  try {
    if (Platform.OS !== 'android' || !token || !NotificationStream) return;

    // Android 13+ needs runtime permission to show notifications. We still start
    // the stream if denied — the OS just withholds the visible notification.
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch {
        /* best-effort */
      }
    }

    // Relay native foreground events to the caller (e.g. refresh the bell badge).
    subscription?.remove();
    subscription = onMessage ? DeviceEventEmitter.addListener('pvNotification', onMessage) : null;

    // API_BASE_URL already includes the /api suffix; the service appends
    // /notifications/stream.
    NotificationStream.start(token, API_BASE_URL);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[push] native stream not started:', (err as Error)?.message);
  }
}

// Stop the stream + foreground service (e.g. on logout).
export function unregisterFromPush(): void {
  try {
    subscription?.remove();
    subscription = null;
    if (Platform.OS === 'android' && NotificationStream) NotificationStream.stop();
  } catch {
    /* ignore */
  }
}
