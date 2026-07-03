import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

// Centered loading indicator for initial data fetches. Keeps the spinner
// consistent across every screen instead of each one rolling its own.
export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  label: { ...typography.caption, marginTop: spacing.md },
});
