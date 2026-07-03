import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';

const tones: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: colors.primary, bg: colors.primaryTint },
  accent: { fg: colors.accentDark, bg: colors.accentTint },
  success: { fg: colors.success, bg: colors.successTint },
  warning: { fg: colors.warning, bg: colors.warningTint },
  danger: { fg: colors.danger, bg: colors.dangerTint },
  muted: { fg: colors.textMuted, bg: colors.surfaceAlt },
};

export function Badge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  const { fg, bg } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
