import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

// A single shimmering placeholder block. A looping opacity pulse (works on both
// native and react-native-web via the JS-driven Animated timing) reads as
// "loading" without a heavyweight gradient library.
export function Skeleton({
  width,
  height = 14,
  radius: r = 8,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { height, borderRadius: r, opacity: pulse },
        width !== undefined ? ({ width } as ViewStyle) : styles.full,
        style,
      ]}
    />
  );
}

// A card-shaped placeholder that mirrors the list Card layout (title row + a
// couple of meta lines). Used while list data is loading.
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width="55%" height={18} />
        <Skeleton width={64} height={20} radius={999} />
      </View>
      <Skeleton width="40%" style={styles.mt10} />
      <Skeleton width="80%" style={styles.mt8} />
    </View>
  );
}

// A list of skeleton cards for first-load states on list screens.
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt },
  full: { alignSelf: 'stretch' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mt10: { marginTop: 10 },
  mt8: { marginTop: 8 },
});
