import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { brandGradient, colors } from '../theme';

interface GradientProps {
  children?: React.ReactNode;
  /** Gradient stops. Defaults to the brand orange gradient. */
  colors?: readonly string[];
  /** Angle in degrees (CSS convention: 180 = top→bottom). */
  angle?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A lightweight linear gradient.
 *
 * On web (react-native-web) it uses a CSS `backgroundImage` gradient. On native,
 * where CSS gradients aren't available without an extra dependency, it falls back
 * to a solid brand colour so the app still renders correctly everywhere.
 */
export function Gradient({
  children,
  colors: stops = brandGradient,
  angle = 135,
  style,
}: GradientProps) {
  const webStyle =
    Platform.OS === 'web'
      ? { backgroundImage: `linear-gradient(${angle}deg, ${stops.join(', ')})` }
      : { backgroundColor: stops[Math.floor(stops.length / 2)] ?? colors.primary };

  return <View style={[style, webStyle as ViewStyle]}>{children}</View>;
}
