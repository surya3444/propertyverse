import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** `flat` = hairline border only; `elevated` = soft drop shadow. */
  variant?: 'flat' | 'elevated';
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, variant = 'elevated', style }: CardProps) {
  const cardStyle = [
    styles.card,
    variant === 'elevated' ? shadow.md : styles.flat,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  flat: { borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
