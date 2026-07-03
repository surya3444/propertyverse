import { trigger } from 'react-native-haptic-feedback';

// Native haptics via react-native-haptic-feedback. A single `haptic(kind)` entry
// point keeps call sites simple; the web build swaps in a navigator.vibrate shim.
export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const MAP: Record<HapticKind, string> = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
  selection: 'selection',
  success: 'notificationSuccess',
  warning: 'notificationWarning',
  error: 'notificationError',
};

const OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export function haptic(kind: HapticKind = 'light') {
  try {
    trigger(MAP[kind], OPTIONS);
  } catch {
    // Haptics are best-effort; never let them break an interaction.
  }
}
