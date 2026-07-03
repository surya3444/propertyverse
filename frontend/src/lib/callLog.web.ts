// Web stub for the call-log module. Browsers have no access to the device call
// history, so everything here is a no-op and callers fall back to the contact
// picker. Mirrors the API of callLog.ts (native) so imports resolve on web.
export interface RecentCall {
  phoneNumber: string;
  name: string | null;
  type: string;
  timestamp: number;
}

export const callLogSupported = false;

export type CallLogStatus = 'ok' | 'empty' | 'unavailable';

export async function getCallLogDiagnostic(): Promise<{ status: CallLogStatus; count: number; error?: string }> {
  return { status: 'unavailable', count: 0 };
}

export async function hasCallLogPermission(): Promise<boolean> {
  return false;
}

export async function requestReminderPermissions(): Promise<void> {
  // No call log / notifications pipeline on web — nothing to request.
}

export async function requestCallLogPermission(): Promise<boolean> {
  return false;
}

export async function getRecentCalls(_limit = 50): Promise<RecentCall[]> {
  return [];
}

export async function getLatestCall(): Promise<RecentCall | null> {
  return null;
}
