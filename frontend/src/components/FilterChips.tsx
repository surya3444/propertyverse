import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { haptic } from '../lib/haptics';

export interface ChipOption<T extends string> {
  label: string;
  value: T;
}

// A horizontal row of selectable pills (segmented filter).
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: object;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              haptic('selection');
              onChange(opt.value);
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 13.5, fontWeight: '600', color: colors.textMuted },
  textActive: { color: colors.white },
});
