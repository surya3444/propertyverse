import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  /** Optional leading icon (a lucide icon component, e.g. `Mail`). */
  icon?: LucideIcon;
  error?: boolean;
}

export function Input({ label, icon: Icon, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const iconColor = error ? colors.danger : focused ? colors.primary : colors.textSubtle;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error && styles.fieldError,
        ]}
      >
        {Icon ? <Icon size={18} color={iconColor} strokeWidth={2} style={styles.icon} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
    // NOTE: do NOT add `elevation` on Android here. Toggling elevation on a
    // focused TextInput's wrapper recreates the native view under Fabric,
    // which blurs the field and causes the keyboard to flicker open/closed
    // and focus to jump between inputs. Border + background convey focus fine.
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(233,89,28,0.12)' }
      : Platform.OS === 'ios'
      ? { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 }
      : null),
  },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
    // Remove the default web focus outline (the field itself shows focus).
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
});
