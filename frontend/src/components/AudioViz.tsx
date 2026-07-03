import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

// Native driver keeps transform/opacity animations off the JS thread; on web
// react-native-web has no native driver, so we opt out there.
const NATIVE = Platform.OS !== 'web';

/**
 * Concentric rings that expand and fade out behind a circular button while a
 * recording is active — the classic "listening" pulse. Sized to sit centered
 * behind a `size`×`size` control (place it as the first child of a centered,
 * relatively-positioned parent).
 */
export function PulseRings({
  active,
  size = 96,
  color = colors.danger,
  rings = 3,
}: {
  active: boolean;
  size?: number;
  color?: string;
  rings?: number;
}) {
  const anims = useRef(Array.from({ length: rings }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) => a.stopAnimation(() => a.setValue(0)));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * 1600) / rings),
          Animated.timing(a, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: NATIVE,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, anims, rings]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={[styles.ringLayer, { width: size, height: size }]}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * A lively equaliser: a row of bars that breathe up and down while recording,
 * each on its own phase so it reads as a live waveform rather than a metronome.
 */
export function Waveform({
  active,
  bars = 24,
  height = 40,
  color = colors.primary,
  align = 'center',
}: {
  active: boolean;
  bars?: number;
  height?: number;
  color?: string;
  align?: 'center' | 'flex-start';
}) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!active) {
      values.forEach((v) => Animated.timing(v, { toValue: 0.15, duration: 220, useNativeDriver: false }).start());
      return;
    }
    // A gentle standing-wave envelope (taller in the middle) keeps it elegant,
    // and a per-bar random target adds the organic flicker of a real signal.
    const loops = values.map((v, i) => {
      const envelope = 0.45 + 0.55 * Math.sin((Math.PI * i) / (bars - 1)); // 0.45 → 1 → 0.45
      const step = () =>
        Animated.sequence([
          Animated.timing(v, {
            toValue: (0.35 + Math.random() * 0.65) * envelope,
            duration: 260 + Math.random() * 260,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false, // animating height/scaleY of layout → JS driver
          }),
          Animated.timing(v, {
            toValue: (0.2 + Math.random() * 0.3) * envelope,
            duration: 260 + Math.random() * 260,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]);
      const loop = Animated.loop(step());
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [active, values, bars]);

  return (
    <View style={[styles.wave, { height, justifyContent: align }]} pointerEvents="none">
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: v.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ringLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 3, borderRadius: 2, minHeight: 4 },
});
