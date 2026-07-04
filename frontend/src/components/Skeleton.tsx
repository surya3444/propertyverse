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

// A card-shaped container matching the app's list Card (surface, rounded, hairline
// border). Every list skeleton below composes on top of this so the placeholder
// footprint matches the real card exactly.
function SkeletonCardShell({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Render N copies of a card with stable keys.
function repeat(count: number, render: (i: number) => React.ReactNode) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{render(i)}</View>
      ))}
    </View>
  );
}

// ---- Generic (kept for Home + anything without a bespoke layout) ----

export function SkeletonCard() {
  return (
    <SkeletonCardShell>
      <View style={styles.rowBetween}>
        <Skeleton width="55%" height={18} />
        <Skeleton width={64} height={20} radius={999} />
      </View>
      <Skeleton width="40%" style={styles.mt10} />
      <Skeleton width="80%" style={styles.mt8} />
    </SkeletonCardShell>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return repeat(count, () => <SkeletonCard />);
}

// ---- Properties: thumbnail + title + price + meta + feature strip ----

export function SkeletonPropertyList({ count = 5 }: { count?: number }) {
  return repeat(count, () => (
    <SkeletonCardShell>
      <View style={styles.rowTop}>
        {/* Photo thumbnail (matches the 52×52 image/placeholder). */}
        <Skeleton width={52} height={52} radius={radius.md} />
        <View style={styles.flex1}>
          <Skeleton width="65%" height={16} />
          <Skeleton width="35%" height={16} style={styles.mt8} />
          <Skeleton width="80%" height={12} style={styles.mt8} />
        </View>
      </View>
      {/* Feature strip (beds · baths · area) under a hairline divider. */}
      <View style={styles.featStrip}>
        <Skeleton width={44} height={12} />
        <Skeleton width={44} height={12} />
        <Skeleton width={44} height={12} />
      </View>
    </SkeletonCardShell>
  ));
}

// ---- Contacts: round avatar + name + phone + role badge ----

export function SkeletonContactList({ count = 6 }: { count?: number }) {
  return repeat(count, () => (
    <SkeletonCardShell>
      <View style={styles.rowCenter}>
        <Skeleton width={46} height={46} radius={999} />
        <View style={styles.flex1}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="35%" height={12} style={styles.mt8} />
          <Skeleton width={70} height={18} radius={999} style={styles.mt8} />
        </View>
      </View>
    </SkeletonCardShell>
  ));
}

// ---- Leads: name (left) + status badge (right) + requirement meta ----

export function SkeletonLeadList({ count = 6 }: { count?: number }) {
  return repeat(count, () => (
    <SkeletonCardShell>
      <View style={styles.rowBetween}>
        <Skeleton width="45%" height={18} />
        <Skeleton width={64} height={22} radius={999} />
      </View>
      <Skeleton width="85%" height={12} style={styles.mt10} />
    </SkeletonCardShell>
  ));
}

// ---- Schedule: kind badge + time + title + meta + action pills ----

export function SkeletonScheduleList({ count = 5 }: { count?: number }) {
  return repeat(count, () => (
    <SkeletonCardShell>
      <View style={styles.rowBetween}>
        <Skeleton width={72} height={22} radius={999} />
        <Skeleton width={54} height={14} />
      </View>
      <Skeleton width="55%" height={16} style={styles.mt10} />
      <Skeleton width="40%" height={12} style={styles.mt8} />
      <View style={styles.pillRow}>
        <Skeleton width={92} height={30} radius={999} />
        <Skeleton width={92} height={30} radius={999} />
      </View>
    </SkeletonCardShell>
  ));
}

// ---- Forms: leading icon + title + type badge + response count ----

export function SkeletonFormList({ count = 4 }: { count?: number }) {
  return repeat(count, () => (
    <SkeletonCardShell>
      <View style={styles.rowBetween}>
        <View style={styles.rowCenterTight}>
          <Skeleton width={20} height={20} radius={6} />
          <Skeleton width={140} height={16} />
        </View>
        <Skeleton width={78} height={20} radius={999} />
      </View>
      <Skeleton width="60%" height={12} style={styles.mt10} />
    </SkeletonCardShell>
  ));
}

// ---- Notifications: unread dot + title + body + time (flatter row) ----

export function SkeletonNotificationList({ count = 5 }: { count?: number }) {
  return repeat(count, () => (
    <View style={styles.notifRow}>
      <Skeleton width={8} height={8} radius={4} style={styles.notifDot} />
      <View style={styles.flex1}>
        <Skeleton width="55%" height={15} />
        <Skeleton width="85%" height={12} style={styles.mt8} />
        <Skeleton width="30%" height={11} style={styles.mt8} />
      </View>
    </View>
  ));
}

// ---- Property detail: big photo gallery + title + price + features + sections ----

export function SkeletonPropertyDetail() {
  return (
    <View>
      <Skeleton height={230} radius={radius.lg} />
      <Skeleton width="45%" height={12} style={styles.mt8} />
      <Skeleton width="70%" height={24} style={styles.mt16} />
      <Skeleton width="45%" height={20} style={styles.mt8} />
      <View style={styles.detailFeatRow}>
        <Skeleton width={64} height={52} radius={radius.md} />
        <Skeleton width={64} height={52} radius={radius.md} />
        <Skeleton width={64} height={52} radius={radius.md} />
      </View>
      <DetailSections />
    </View>
  );
}

// ---- Record detail (contact / lead): avatar header + sections ----

export function SkeletonRecordDetail() {
  return (
    <View>
      <View style={styles.rowCenter}>
        <Skeleton width={56} height={56} radius={999} />
        <View style={styles.flex1}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={12} style={styles.mt8} />
        </View>
      </View>
      <DetailSections />
    </View>
  );
}

// ---- Form detail: header block + a list of response rows ----

export function SkeletonFormDetail() {
  return (
    <View>
      <Skeleton width="60%" height={22} />
      <Skeleton width="85%" height={12} style={styles.mt8} />
      <Skeleton width={140} height={40} radius={radius.md} style={styles.mt16} />
      <Skeleton width="30%" height={12} style={styles.mt24} />
      <View style={styles.mt10}>
        <SkeletonLeadList count={4} />
      </View>
    </View>
  );
}

// Two placeholder "section" blocks (header + a couple of lines) shared by the
// detail skeletons.
function DetailSections() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.mt24}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={12} style={styles.mt10} />
          <Skeleton width="80%" height={12} style={styles.mt8} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt },
  full: { alignSelf: 'stretch' },
  flex1: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowCenterTight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  featStrip: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  detailFeatRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  notifRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  notifDot: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },
});
