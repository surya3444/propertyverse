import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from './Badge';
import { MatchQuality, MatchReason } from '../types';
import { colors, spacing } from '../theme';

// The score is a sort key; these are what an agent actually acts on. A `warning`
// reason is the caveat they need before they pick up the phone — "6% over
// budget" is worth knowing before you pitch, not after.

const QUALITY_LABEL: Record<MatchQuality, string> = {
  excellent: 'Excellent match',
  strong: 'Strong match',
  fair: 'Fair match',
  weak: 'Weak match',
  unknown: 'Not enough detail',
};

const QUALITY_TONE: Record<MatchQuality, 'success' | 'primary' | 'accent' | 'muted'> = {
  excellent: 'success',
  strong: 'success',
  fair: 'accent',
  weak: 'muted',
  unknown: 'muted',
};

const REASON_COLOR: Record<MatchReason['tone'], string> = {
  positive: colors.success,
  neutral: colors.textMuted,
  warning: colors.warning,
};

export function MatchBadge({ score, quality }: { score?: number; quality?: MatchQuality }) {
  if (score == null) return null;
  const q = quality ?? 'unknown';
  const label = q === 'unknown' ? QUALITY_LABEL.unknown : `${score}% · ${QUALITY_LABEL[q]}`;
  return <Badge label={label} tone={QUALITY_TONE[q]} />;
}

// Show at most `limit` reasons so a card stays a card. Reasons arrive sorted
// with warnings last, so truncating never hides a positive behind a caveat —
// but a warning is important enough that we always keep it.
export function MatchReasons({ reasons, limit = 3 }: { reasons?: MatchReason[]; limit?: number }) {
  if (!reasons?.length) return null;

  const warnings = reasons.filter((r) => r.tone === 'warning');
  const rest = reasons.filter((r) => r.tone !== 'warning');
  const shown = [...rest.slice(0, Math.max(0, limit - warnings.length)), ...warnings];

  return (
    <View style={styles.list}>
      {shown.map((reason) => (
        <View key={reason.code + reason.label} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: REASON_COLOR[reason.tone] }]} />
          <Text style={[styles.text, reason.tone === 'warning' && styles.warning]} numberOfLines={1}>
            {reason.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.xs, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  text: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  warning: { color: colors.warning, fontWeight: '600' },
});
