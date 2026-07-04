import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Building2, Users, CalendarClock, Mic, Plus, CalendarPlus, ChevronRight, AlertTriangle, FileText } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { NotificationBell } from '../components/NotificationBell';
import { StatCard } from '../components/StatCard';
import { SectionHeader } from '../components/SectionHeader';
import { Avatar } from '../components/Avatar';
import { LogoFull } from '../components/Logo';
import { propertiesApi } from '../api/properties';
import { leadsApi } from '../api/leads';
import { activitiesApi } from '../api/activities';
import { useAuthStore } from '../store/authStore';
import { Activity, Lead, Property, Ref } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
import { haptic } from '../lib/haptics';
import { TabScreenProps } from '../navigation/types';

function refName(r?: Ref | string) {
  return typeof r === 'object' && r ? r.name ?? r.title ?? '' : '';
}
function timeLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function HomeScreen({ navigation }: TabScreenProps<'HomeTab'>) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [today, setToday] = useState<Activity[]>([]);
  const [overdue, setOverdue] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l, a, o] = await Promise.all([
        propertiesApi.list(),
        leadsApi.list(),
        activitiesApi.list({ scope: 'today' }),
        activitiesApi.list({ scope: 'overdue' }),
      ]);
      setProperties(p.properties);
      setLeads(l.leads);
      setToday(a.activities);
      setOverdue(o.activities);
    } catch {
      // dashboard is best-effort; individual tabs surface their own errors
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeReqs = leads.filter((l) => l.status !== 'Closed').length;
  const initialLoading =
    loading && properties.length === 0 && leads.length === 0 && today.length === 0;

  const go = (fn: () => void) => () => { haptic('light'); fn(); };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <LogoFull width={150} />
          <View style={styles.topBarRight}>
            <NotificationBell onPress={() => navigation.navigate('Notifications')} />
            <Pressable onPress={go(() => navigation.navigate('ProfileTab'))}>
              <Avatar name={user?.name} size={40} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.greeting}>Hi {firstName} 👋</Text>
        <Text style={styles.subtitle}>Here's your day at a glance.</Text>

        {initialLoading ? (
          <View>
            <View style={styles.statRow}>
              <Skeleton height={78} radius={16} style={styles.flex1} />
              <Skeleton height={78} radius={16} style={styles.flex1} />
              <Skeleton height={78} radius={16} style={styles.flex1} />
            </View>
            <Skeleton width={120} height={12} style={styles.skLabel} />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
        <>
        {/* Stats */}
        <View style={styles.statRow}>
          <StatCard icon={Building2} value={properties.length} label="Properties" onPress={go(() => navigation.navigate('PropertiesTab'))} />
          <StatCard icon={Users} value={activeReqs} label="Active reqs" tint={colors.accentDark} bg={colors.accentTint} onPress={go(() => navigation.navigate('LeadsList'))} />
          <StatCard icon={CalendarClock} value={today.length} label="Today" tint={colors.success} bg={colors.successTint} onPress={go(() => navigation.navigate('ScheduleTab'))} />
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <QuickAction icon={Mic} label="Record lead" onPress={go(() => navigation.navigate('RecordLead'))} />
          <QuickAction icon={Plus} label="Add property" onPress={go(() => navigation.navigate('PropertyForm'))} />
          <QuickAction icon={CalendarPlus} label="Schedule" onPress={go(() => navigation.navigate('ActivityForm'))} />
          <QuickAction icon={FileText} label="Forms" onPress={go(() => navigation.navigate('FormsList'))} />
        </View>

        {/* Overdue nudge — the thing an agent most needs to see first. */}
        {overdue.length > 0 ? (
          <Pressable
            onPress={go(() => navigation.navigate('ScheduleTab'))}
            style={({ pressed }) => [styles.overdueCard, pressed && styles.overduePressed]}
          >
            <View style={styles.overdueIcon}>
              <AlertTriangle size={20} color={colors.danger} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueTitle}>
                {overdue.length} follow-up{overdue.length === 1 ? '' : 's'} overdue
              </Text>
              <Text style={styles.overdueDesc}>Tap to review and reschedule or close them out.</Text>
            </View>
            <ChevronRight size={18} color={colors.danger} />
          </Pressable>
        ) : null}

        {/* Today's agenda */}
        <View style={styles.sectionSpacer}>
          <SectionHeader title="Today's agenda" onAction={today.length ? go(() => navigation.navigate('ScheduleTab')) : undefined} />
        </View>
        {today.length === 0 ? (
          <Card variant="flat">
            <Text style={styles.muted}>Nothing scheduled today. Tap “Schedule” to add a visit or follow-up.</Text>
          </Card>
        ) : (
          today.slice(0, 3).map((a) => (
            <Card key={a._id} variant="elevated" style={styles.agendaCard}>
              <View style={styles.agendaRow}>
                <View style={styles.agendaTime}>
                  <Text style={styles.agendaTimeText}>{timeLabel(a.scheduledAt) || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agendaTitle}>{a.kind} · {refName(a.contactId)}</Text>
                  {refName(a.propertyId) ? <Text style={styles.muted}>{refName(a.propertyId)}</Text> : null}
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Recent properties */}
        <View style={styles.sectionSpacer}>
          <SectionHeader title="Recent properties" onAction={properties.length ? go(() => navigation.navigate('PropertiesTab')) : undefined} />
        </View>
        {properties.slice(0, 3).map((p) => (
          <Card key={p._id} variant="elevated" style={styles.listCard} onPress={go(() => navigation.navigate('PropertyDetail', { propertyId: p._id }))}>
            <View style={styles.listRow}>
              {p.images?.[0]?.url ? (
                <Image source={{ uri: p.images[0].url }} style={styles.listThumb} resizeMode="cover" />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.muted} numberOfLines={1}>{p.propertyType} · {p.location}</Text>
              </View>
              <Text style={styles.price}>{p.listingType === 'Rent' ? `${formatCurrency(p.monthlyRent)}/mo` : formatCurrency(p.price)}</Text>
              <ChevronRight size={18} color={colors.textSubtle} />
            </View>
          </Card>
        ))}
        {properties.length === 0 ? (
          <Card variant="flat"><Text style={styles.muted}>No properties yet.</Text></Card>
        ) : null}
        </>
        )}
      </ScrollView>
    </Screen>
  );
}

function QuickAction({ icon: Icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <View style={styles.actionIcon}>
        <Icon size={22} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex1: { flex: 1 },
  skLabel: { marginTop: spacing.sm, marginBottom: spacing.md },
  greeting: { ...typography.h1 },
  subtitle: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.lg },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },

  sectionLabel: { ...typography.overline, marginBottom: spacing.sm, marginLeft: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    gap: 8,
  },
  actionPressed: { backgroundColor: colors.primaryTint, transform: [{ scale: 0.98 }] },
  actionIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12.5, fontWeight: '700', color: colors.text, textAlign: 'center' },

  overdueCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerTint, borderRadius: radius.lg, borderWidth: 1, borderColor: '#F6C6C6', padding: spacing.md, marginTop: spacing.lg },
  overduePressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  overdueIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: '#FBD9D9', alignItems: 'center', justifyContent: 'center' },
  overdueTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  overdueDesc: { fontSize: 12.5, color: '#B33', marginTop: 1 },

  sectionSpacer: { marginTop: spacing.xl },
  agendaCard: { padding: spacing.md },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  agendaTime: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  agendaTimeText: { color: colors.primary, fontWeight: '800', fontSize: 12.5 },
  agendaTitle: { ...typography.bodyStrong },

  listCard: { padding: spacing.md },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listThumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  listTitle: { ...typography.bodyStrong, fontSize: 15.5 },
  price: { fontSize: 14, fontWeight: '800', color: colors.primary },

  muted: { ...typography.caption },
});
