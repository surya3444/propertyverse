import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, X } from 'lucide-react-native';
import { callLogSupported, getCallLogDiagnostic, getRecentCalls, requestCallLogPermission, RecentCall } from '../lib/callLog';
import { colors, radius, spacing, typography } from '../theme';
import { haptic } from '../lib/haptics';

interface Props {
  onPick: (call: { phoneNumber: string; name: string | null }) => void;
}

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function typeIcon(type: string) {
  if (type === 'MISSED' || type === 'REJECTED') return PhoneMissed;
  if (type === 'OUTGOING' || type === 'WIFI_OUTGOING') return PhoneOutgoing;
  return PhoneIncoming;
}

// A button that opens a sheet of the device's recent calls (Android only) so a
// number can be picked when capturing a requirement. Renders nothing on
// platforms without call-log access.
export function CallLogPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!callLogSupported) return null;

  const openSheet = async () => {
    haptic('light');
    setOpen(true);
    setLoading(true);
    setError(null);
    const granted = await requestCallLogPermission();
    if (!granted) {
      setError('Call access denied. Enable it in Settings to pick from recent calls.');
      setLoading(false);
      return;
    }
    try {
      const diag = await getCallLogDiagnostic();
      if (diag.status === 'unavailable') {
        setError(
          /link|rebuild/i.test(diag.error || '')
            ? 'Call log needs a fresh app build to work. Rebuild with: npx react-native run-android'
            : diag.error || 'Could not read recent calls.'
        );
      } else if (diag.status === 'empty') {
        setError('No calls in this device’s history yet. (Emulators usually have none — try a real phone.)');
      } else {
        setCalls(await getRecentCalls(50));
      }
    } catch {
      setError('Could not read recent calls.');
    } finally {
      setLoading(false);
    }
  };

  const pick = (c: RecentCall) => {
    haptic('selection');
    onPick({ phoneNumber: c.phoneNumber, name: c.name });
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openSheet} style={styles.trigger}>
        <Phone size={16} color={colors.primary} strokeWidth={2.2} />
        <Text style={styles.triggerText}>Recent calls</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Recent calls</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}><X size={22} color={colors.textMuted} /></Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : calls.length === 0 ? (
              <Text style={styles.empty}>No recent calls found.</Text>
            ) : (
              <FlatList
                data={calls}
                keyExtractor={(_, i) => String(i)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const Icon = typeIcon(item.type);
                  const missed = item.type === 'MISSED' || item.type === 'REJECTED';
                  return (
                    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => pick(item)}>
                      <View style={styles.iconTile}>
                        <Icon size={18} color={missed ? colors.danger : colors.primary} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>{item.name || item.phoneNumber}</Text>
                        <Text style={styles.rowMeta}>{item.name ? `${item.phoneNumber} · ` : ''}{relativeTime(item.timestamp)}</Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primaryTint, backgroundColor: colors.surface },
  triggerText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,14,10,0.4)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm, maxHeight: '82%', minHeight: '50%', ...(({ width: '100%', maxWidth: 520, alignSelf: 'center' } as unknown) as object) },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2 },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg, textAlign: 'center' },
  empty: { ...typography.caption, marginTop: spacing.lg, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  iconTile: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowName: { ...typography.bodyStrong, fontSize: 15.5 },
  rowMeta: { ...typography.caption, marginTop: 1 },
});
