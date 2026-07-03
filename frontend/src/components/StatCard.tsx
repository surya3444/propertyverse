import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';

// A compact dashboard metric tile: icon + big value + label.
export function StatCard({
  icon: Icon,
  value,
  label,
  tint = colors.primary,
  bg = colors.primaryTint,
  onPress,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tint?: string;
  bg?: string;
  onPress?: () => void;
}) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Icon size={18} color={tint} strokeWidth={2.4} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: { ...typography.h2, fontSize: 24 },
  label: { ...typography.caption, fontSize: 12.5, marginTop: 1 },
});
