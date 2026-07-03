import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography } from '../theme';

export function SectionHeader({
  title,
  actionLabel = 'See all',
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onAction ? (
        <Pressable onPress={onAction} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, fontSize: 17 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
