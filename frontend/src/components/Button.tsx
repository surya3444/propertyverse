import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow, spacing } from '../theme';
import { haptic } from '../lib/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  /** Optional leading icon (a lucide icon component, e.g. `Mic`). */
  icon?: LucideIcon;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const solid = variant === 'primary' || variant === 'danger';

  const handlePress = () => {
    haptic(variant === 'danger' ? 'warning' : 'light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'md' ? styles.md : styles.lg,
        fullWidth && styles.fullWidth,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        variant === 'primary' && shadow.brand,
        variant === 'danger' && styles.dangerShadow,
        pressed && (solid ? styles.pressedSolid : styles.pressedSoft),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? colors.white : colors.primary} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={19} color={solid ? colors.white : colors.primary} strokeWidth={2.4} /> : null}
          <Text
            style={[
              styles.text,
              variant === 'secondary' && styles.softText,
              variant === 'ghost' && styles.softText,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  lg: { height: 54 },
  md: { height: 44, borderRadius: radius.sm },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: colors.primaryTint },
  danger: { backgroundColor: colors.danger },
  dangerShadow: Platform.select({
    web: { boxShadow: '0px 8px 20px rgba(220,38,38,0.28)' },
    default: { shadowColor: colors.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 },
  }) as object,

  pressedSolid: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  pressedSoft: { backgroundColor: colors.primaryTint, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },

  text: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  softText: { color: colors.primary },
});
