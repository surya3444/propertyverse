import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  /** Max content width on wide (web) viewports. */
  maxWidth?: number;
}

// Consistent safe-area + background wrapper for every screen. On web the content
// is centred in a max-width column so it doesn't stretch edge-to-edge on desktop.
export function Screen({ children, style, padded = true, maxWidth = 520 }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.center}>
        <View
          style={[
            styles.container,
            padded && styles.padded,
            Platform.OS === 'web' && { maxWidth, width: '100%' },
            style,
          ]}
        >
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center' },
  container: { flex: 1, width: '100%' },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
