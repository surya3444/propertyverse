// Web haptics via the Vibration API. Supported on Android Chrome; a silent
// no-op elsewhere (desktop, iOS Safari). Never imports the native-only lib.
export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 5,
  success: [10, 40, 10],
  warning: [12, 60, 12],
  error: [20, 50, 20, 50, 20],
};

export function haptic(kind: HapticKind = 'light') {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    // best-effort only
  }
}
