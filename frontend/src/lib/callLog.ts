import { Platform } from 'react-native';
// PermissionsAndroid is Android-only and is NOT a named export on
// react-native-web, so a static `import { PermissionsAndroid }` throws at
// module-eval on web. Reach it through the namespace at runtime instead — the
// only place it's used is guarded by `Platform.OS === 'android'`.
import * as ReactNative from 'react-native';

// Access to the device call history. Android-only: iOS provides no public API
// for the call log, and on web there is none. Callers should check
// `callLogSupported` and fall back to the contact picker elsewhere.
export interface RecentCall {
  phoneNumber: string;
  name: string | null;
  type: string; // OUTGOING | INCOMING | MISSED | ...
  timestamp: number; // ms since epoch
}

export const callLogSupported = Platform.OS === 'android';

// Set when the native module fails to load — usually because the app hasn't been
// rebuilt since react-native-call-log was added (its import throws "not linked").
let moduleLoadError: string | null = null;

// Lazy require so importing this module never triggers react-native-call-log's
// import-time "not linked" throw (e.g. before the native rebuild, or on a
// platform without the native module).
function callLogsModule(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('react-native-call-log');
    return m?.default ?? m ?? null;
  } catch (err: any) {
    moduleLoadError = err?.message || 'native module not linked';
    console.warn('[callLog] react-native-call-log unavailable:', moduleLoadError);
    return null;
  }
}

export type CallLogStatus = 'ok' | 'empty' | 'unavailable';

// Tells the UI *why* there are no calls, so "rebuild needed" isn't shown as the
// same thing as "you have no call history".
export async function getCallLogDiagnostic(): Promise<{ status: CallLogStatus; count: number; error?: string }> {
  if (Platform.OS !== 'android') return { status: 'unavailable', count: 0, error: 'Call log is Android-only.' };
  const mod = callLogsModule();
  if (!mod) return { status: 'unavailable', count: 0, error: moduleLoadError ?? 'Call log module not linked — rebuild the app.' };
  try {
    const logs = await mod.load(50);
    const count = Array.isArray(logs) ? logs.length : 0;
    return { status: count ? 'ok' : 'empty', count };
  } catch (err: any) {
    return { status: 'unavailable', count: 0, error: err?.message || 'Failed to read call log.' };
  }
}

// Silent check — is READ_CALL_LOG already granted? Used by the post-call nudge
// so it only activates once the agent has enabled call access (never prompts on
// its own). Returns false on non-Android.
export async function hasCallLogPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const { PermissionsAndroid } = ReactNative as any;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  } catch {
    return false;
  }
}

// Request every permission the post-call reminder needs, in one prompt sequence:
//  - READ_CALL_LOG  → read the caller's number/name to prefill the recorder
//  - READ_PHONE_STATE → the native receiver detects when a call ends
//  - POST_NOTIFICATIONS (Android 13+) → post the "log this call?" reminder
// Only prompts for what isn't already granted; safe to call on every launch.
export async function requestReminderPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { PermissionsAndroid } = ReactNative as any;
  try {
    const perms = [
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ].filter(Boolean);
    // POST_NOTIFICATIONS only exists on API 33+ builds of PermissionsAndroid.
    if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    await PermissionsAndroid.requestMultiple(perms);
  } catch {
    // best-effort — the feature simply stays off if denied
  }
}

export async function requestCallLogPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const { PermissionsAndroid } = ReactNative as any;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      {
        title: 'Access recent calls',
        message: 'PropertyVerse shows your recent calls so you can pick a client number quickly.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// Returns the most recent calls, de-duplicated by phone number (keeping the
// latest call per number). Requires permission to have been granted.
export async function getRecentCalls(limit = 50): Promise<RecentCall[]> {
  const mod = callLogsModule();
  if (!mod) return [];
  try {
    const logs = await mod.load(limit);
    if (!Array.isArray(logs) || logs.length === 0) {
      console.warn('[callLog] load() returned no entries (device has no call history, or permission/build issue).');
    }
    const byNumber = new Map<string, RecentCall>();
    for (const l of logs as Array<Record<string, unknown>>) {
      const phoneNumber = String(l.phoneNumber ?? '').trim();
      if (!phoneNumber) continue;
      const key = phoneNumber.replace(/[^\d]/g, '');
      const call: RecentCall = {
        phoneNumber,
        name: (l.name as string) || null,
        type: String(l.type ?? 'UNKNOWN'),
        timestamp: Number(l.timestamp ?? 0),
      };
      const existing = byNumber.get(key);
      if (!existing || call.timestamp > existing.timestamp) byNumber.set(key, call);
    }
    return Array.from(byNumber.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (err: any) {
    console.warn('[callLog] getRecentCalls failed:', err?.message || err);
    return [];
  }
}

// The single most recent call (any number), or null. Powers the post-call nudge.
export async function getLatestCall(): Promise<RecentCall | null> {
  const recent = await getRecentCalls(5);
  return recent[0] ?? null;
}
