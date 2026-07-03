import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, PhoneIncoming, PhoneMissed, PhoneOutgoing, X } from 'lucide-react-native';
import {
  callLogSupported,
  getLatestCall,
  hasCallLogPermission,
  requestReminderPermissions,
  RecentCall,
} from '../lib/callLog';
import { storage } from '../lib/storage';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { haptic } from '../lib/haptics';

// Only nudge for a call that ended within this window — after a while the agent
// has moved on and an unprompted popup would just be noise.
const WINDOW_MS = 30 * 60 * 1000;
// Remembers the timestamp of the last call we've already surfaced, so the same
// call never nags twice (across app restarts).
const LAST_KEY = 'callNudge.lastHandledTs';

interface Props {
  onRecord: (call: { phoneNumber: string; clientName?: string }) => void;
}

function typeIcon(type: string) {
  if (type === 'MISSED' || type === 'REJECTED') return PhoneMissed;
  if (type === 'OUTGOING' || type === 'WIFI_OUTGOING') return PhoneOutgoing;
  return PhoneIncoming;
}

function relTime(ts: number) {
  const min = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)}h ago`;
}

// Watches for the app returning to the foreground and, on Android with call
// access granted, offers to turn the most recent call into a lead. Renders
// nothing on web/iOS or until there's a fresh call to act on.
export function CallNudge({ onRecord }: Props) {
  const [call, setCall] = useState<RecentCall | null>(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (!callLogSupported || busy.current) return;
    busy.current = true;
    try {
      if (!(await hasCallLogPermission())) return;
      const latest = await getLatestCall();
      if (!latest || Date.now() - latest.timestamp > WINDOW_MS) return;
      const lastTs = Number((await storage.getItem(LAST_KEY)) || 0);
      if (latest.timestamp <= lastTs) return; // already handled this call
      console.log('[callNudge] surfacing recent call', latest.phoneNumber);
      setCall(latest);
    } catch (err: any) {
      console.warn('[callNudge] check failed:', err?.message || err);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!callLogSupported) return;
    // Enable the whole reminder pipeline on first run: call log (read number/name),
    // phone state (native receiver detects call end), notifications (post the
    // reminder). Only prompts for what isn't already granted.
    requestReminderPermissions();

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Android writes a call to the log a moment AFTER it disconnects, so a single
    // check the instant we regain focus often misses the call the agent just made.
    // Re-check a few times over the first several seconds to catch it. This is
    // what runs when the app is opened — including by tapping the native
    // call-end notification.
    const runChecks = () => {
      check();
      timers.push(setTimeout(check, 2500), setTimeout(check, 6000));
    };
    runChecks(); // on mount (app just opened)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') runChecks();
    });
    return () => {
      sub.remove();
      timers.forEach(clearTimeout);
    };
  }, [check]);

  const clear = useCallback(async (c: RecentCall) => {
    await storage.setItem(LAST_KEY, String(c.timestamp));
    setCall(null);
  }, []);

  if (!call) return null;

  const Icon = typeIcon(call.type);
  const missed = call.type === 'MISSED' || call.type === 'REJECTED';
  const title = call.name || call.phoneNumber;

  const record = () => {
    haptic('medium');
    clear(call);
    onRecord({ phoneNumber: call.phoneNumber, clientName: call.name || undefined });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => clear(call)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => clear(call)} />
        <View style={styles.card}>
          <Pressable onPress={() => clear(call)} hitSlop={10} style={styles.close}>
            <X size={20} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.iconWrap, missed && styles.iconWrapMissed]}>
            <Icon size={26} color={missed ? colors.danger : colors.primary} strokeWidth={2.2} />
          </View>

          <Text style={styles.eyebrow}>{missed ? 'MISSED CALL' : 'RECENT CALL'} · {relTime(call.timestamp)}</Text>
          <Text style={styles.name} numberOfLines={1}>{title}</Text>
          {call.name ? <Text style={styles.phone}>{call.phoneNumber}</Text> : null}

          <Text style={styles.prompt}>Capture this as a lead while it's fresh?</Text>

          <Pressable onPress={record} style={styles.recordBtn}>
            <Mic size={18} color={colors.white} strokeWidth={2.4} />
            <Text style={styles.recordText}>Record requirement</Text>
          </Pressable>
          <Pressable onPress={() => clear(call)} style={styles.laterBtn}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,14,10,0.5)', padding: spacing.lg },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', ...shadow.lg },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, padding: 4 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  iconWrapMissed: { backgroundColor: colors.dangerTint },
  eyebrow: { ...typography.overline, fontSize: 11, color: colors.textMuted },
  name: { ...typography.h2, fontSize: 20, marginTop: 4, textAlign: 'center' },
  phone: { ...typography.caption, fontSize: 14, marginTop: 2 },
  prompt: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 52, borderRadius: radius.md, backgroundColor: colors.primary, ...shadow.brand },
  recordText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  laterBtn: { alignSelf: 'stretch', height: 46, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  laterText: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
});
