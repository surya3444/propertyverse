import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <Icon size={30} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconTile: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, textAlign: 'center' },
  desc: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs, maxWidth: 300, lineHeight: 20 },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});
