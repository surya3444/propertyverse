import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

// Deterministic warm-palette color per name so a contact always looks the same.
const PALETTE = [
  { bg: '#FDEDE1', fg: '#E9591C' },
  { bg: '#FEF3E2', fg: '#EE7C19' },
  { bg: '#E7F6EC', fg: '#16A34A' },
  { bg: '#E9EEFF', fg: '#3B5BDB' },
  { bg: '#F3E8FF', fg: '#8B3DCB' },
  { bg: '#FDE7EF', fg: '#C81E5B' },
];

function pick(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

export function Avatar({
  name,
  size = 44,
  style,
}: {
  name?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const label = (name?.trim()?.[0] ?? '?').toUpperCase();
  const { bg, fg } = pick(name || '?');
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.4 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
