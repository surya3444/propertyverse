import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, CalendarPlus, Check, Clock, MapPin, RotateCcw, User as UserIcon } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonScheduleList } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { activitiesApi, ActivityScope } from '../../api/activities';
import { Activity, ActivityStatus, Ref } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { TabScreenProps } from '../../navigation/types';

const SCOPES: { label: string; value: ActivityScope }[] = [
  { label: 'Overdue', value: 'overdue' },
  { label: 'Today', value: 'today' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
];

const statusTone: Record<ActivityStatus, 'primary' | 'success' | 'muted' | 'danger'> = {
  Scheduled: 'primary',
  Done: 'success',
  Cancelled: 'muted',
  Missed: 'danger',
};

function refName(r?: Ref | string) {
  return typeof r === 'object' && r ? r.name ?? r.title ?? '' : '';
}
function whenLabel(iso?: string) {
  if (!iso) return 'No date';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
// A friendly "how far off" hint: "in 3h", "in 2 days", "5 days ago".
function relLabel(iso?: string) {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let unit: string;
  if (mins < 60) unit = `${mins} min`;
  else if (hrs < 24) unit = `${hrs}h`;
  else unit = `${days} day${days === 1 ? '' : 's'}`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

// Fades + rises each card in on mount, staggered by list position.
function FadeInItem({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 8) * 45,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function ScheduleScreen({ navigation }: TabScreenProps<'ScheduleTab'>) {
  const [scope, setScope] = useState<ActivityScope>('overdue');
  const [items, setItems] = useState<Activity[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, overdue] = await Promise.all([
        activitiesApi.list({ scope }),
        // Cheap count for the tab badge regardless of the active scope.
        scope === 'overdue' ? null : activitiesApi.list({ scope: 'overdue' }),
      ]);
      setItems(res.activities);
      if (scope === 'overdue') setOverdueCount(res.total ?? res.activities.length);
      else if (overdue) setOverdueCount(overdue.total ?? overdue.activities.length);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markDone = async (a: Activity) => {
    haptic('success');
    // Optimistic: drop it from the current list immediately.
    setItems((prev) => prev.filter((x) => x._id !== a._id));
    const wasOverdue =
      (a.status === 'Scheduled' || a.status === 'Missed') &&
      !!a.scheduledAt &&
      new Date(a.scheduledAt).getTime() < Date.now();
    if (wasOverdue) setOverdueCount((c) => Math.max(0, c - 1));
    try {
      await activitiesApi.update(a._id, { status: 'Done' });
    } catch {
      load();
    }
  };

  const reschedule = (a: Activity) => {
    haptic('light');
    navigation.navigate('ActivityForm', { activityId: a._id });
  };

  const isOverdueScope = scope === 'overdue';

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.h1}>Schedule</Text>
        <Pressable onPress={() => { haptic('light'); navigation.navigate('ActivityForm'); }} style={styles.addBtn}>
          <CalendarPlus size={20} color={colors.white} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        {SCOPES.map((s) => {
          const active = s.value === scope;
          const showCount = s.value === 'overdue' && overdueCount > 0;
          return (
            <Pressable
              key={s.value}
              onPress={() => { haptic('selection'); setScope(s.value); }}
              style={[styles.chip, active && styles.chipActive, showCount && !active && styles.chipAlert]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive, showCount && !active && styles.chipTextAlert]}>
                {s.label}
              </Text>
              {showCount ? (
                <View style={[styles.countPill, active && styles.countPillOnActive]}>
                  <Text style={[styles.countText, active && styles.countTextOnActive]}>{overdueCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <SkeletonScheduleList count={5} />
          ) : (
            <EmptyState
              icon={isOverdueScope ? Check : CalendarDays}
              title={isOverdueScope ? 'All caught up' : scope === 'past' ? 'Nothing here yet' : 'No visits scheduled'}
              description={
                isOverdueScope
                  ? 'Nothing is past due. Nicely done — every follow-up is on track.'
                  : 'Schedule site visits, follow-ups and calls to stay on top of every deal.'
              }
              actionLabel={isOverdueScope ? undefined : 'Schedule something'}
              onAction={isOverdueScope ? undefined : () => navigation.navigate('ActivityForm')}
            />
          )
        }
        renderItem={({ item, index }) => {
          const overdue = (item.status === 'Scheduled' || item.status === 'Missed') && !!item.scheduledAt && new Date(item.scheduledAt).getTime() < Date.now();
          const actionable = item.status === 'Scheduled' || item.status === 'Missed';
          return (
            <FadeInItem index={index}>
              <Card
                variant="elevated"
                style={[styles.card, overdue && styles.cardOverdue]}
                onPress={() => { haptic('light'); navigation.navigate('ActivityForm', { activityId: item._id }); }}
              >
                <View style={styles.topRow}>
                  <Badge label={item.kind} tone="primary" />
                  <Badge label={overdue ? 'Overdue' : item.status} tone={overdue ? 'danger' : statusTone[item.status]} />
                </View>
                <View style={styles.whenRow}>
                  <Text style={styles.when}>{whenLabel(item.scheduledAt)}</Text>
                  <View style={styles.relPill}>
                    <Clock size={11} color={overdue ? colors.danger : colors.textMuted} strokeWidth={2.4} />
                    <Text style={[styles.relText, overdue && styles.relTextOverdue]}>{relLabel(item.scheduledAt)}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <UserIcon size={14} color={colors.textMuted} strokeWidth={2.2} />
                  <Text style={styles.meta}>{refName(item.contactId) || 'Contact'}</Text>
                </View>
                {refName(item.propertyId) ? (
                  <View style={styles.metaRow}>
                    <MapPin size={14} color={colors.textMuted} strokeWidth={2.2} />
                    <Text style={styles.meta} numberOfLines={1}>{refName(item.propertyId)}</Text>
                  </View>
                ) : null}
                {actionable ? (
                  <View style={styles.actions}>
                    <Pressable onPress={() => markDone(item)} style={[styles.actionBtn, styles.doneBtn]}>
                      <Check size={15} color={colors.success} strokeWidth={2.6} />
                      <Text style={[styles.actionText, { color: colors.success }]}>Done</Text>
                    </Pressable>
                    <Pressable onPress={() => reschedule(item)} style={[styles.actionBtn, styles.snoozeBtn]}>
                      <RotateCcw size={14} color={colors.primary} strokeWidth={2.6} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Reschedule</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            </FadeInItem>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  h1: { ...typography.h1 },
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipAlert: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  chipTextAlert: { color: colors.danger },
  countPill: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  countPillOnActive: { backgroundColor: colors.white },
  countText: { fontSize: 11, fontWeight: '800', color: colors.white },
  countTextOnActive: { color: colors.primary },

  list: { padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },
  card: { padding: spacing.md, gap: 6 },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  whenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2 },
  when: { ...typography.bodyStrong, fontSize: 15.5, flexShrink: 1 },
  relPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  relText: { ...typography.caption, fontSize: 12, fontWeight: '600' },
  relTextOverdue: { color: colors.danger },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { ...typography.caption, fontSize: 13 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  doneBtn: { backgroundColor: colors.successTint },
  snoozeBtn: { backgroundColor: colors.primaryTint },
  actionText: { fontWeight: '700', fontSize: 13 },
});
