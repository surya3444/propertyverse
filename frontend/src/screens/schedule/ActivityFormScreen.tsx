import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, Check, Trash2, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { ContactPicker, PickedContact } from '../../components/ContactPicker';
import { PickedProperty, PropertyPicker } from '../../components/PropertyPicker';
import { activitiesApi } from '../../api/activities';
import { Activity, ActivityKind, ActivityStatus, Ref } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

const KINDS: ActivityKind[] = ['Visit', 'Follow-up', 'Call', 'Note'];

// A month of selectable date chips — enough runway to plan real site visits and
// follow-ups without a heavyweight calendar.
function nextDays(n: number) {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

const COMMON_TIMES = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00'];

function refField(r: Ref | string | undefined, key: 'name' | 'phone' | 'title' | 'location') {
  return typeof r === 'object' && r ? (r[key] as string | undefined) : undefined;
}

// Valid HH:MM in 24h. Returns [h, m] or null.
function parseTime(t: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return [h, min];
}

export function ActivityFormScreen({ navigation, route }: RootScreenProps<'ActivityForm'>) {
  const p = route.params ?? {};
  const isEdit = Boolean(p.activityId);

  const [loadingActivity, setLoadingActivity] = useState(isEdit);
  const [kind, setKind] = useState<ActivityKind>((p.kind as ActivityKind) || 'Visit');
  const [contact, setContact] = useState<PickedContact | null>(
    p.contactId ? { _id: p.contactId, name: p.contactName || 'Contact', phone: p.contactPhone } : null
  );
  const [property, setProperty] = useState<PickedProperty | null>(
    p.propertyId ? { _id: p.propertyId, title: p.propertyTitle || 'Property' } : null
  );
  const initial = p.scheduledAt ? new Date(p.scheduledAt) : new Date();
  const [dateKey, setDateKey] = useState<string>(dateOnly(initial));
  const [time, setTime] = useState<string>(p.scheduledAt ? initial.toTimeString().slice(0, 5) : '10:30');
  const [notes, setNotes] = useState(p.notes ?? '');
  const [status, setStatus] = useState<ActivityStatus>('Scheduled');
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);

  const days = useMemo(() => nextDays(30), []);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Schedule' : 'New Schedule' });
  }, [navigation, isEdit]);

  // On edit, hydrate every field from the server so nothing is silently lost.
  useEffect(() => {
    if (!isEdit || !p.activityId) return;
    let cancelled = false;
    (async () => {
      try {
        const { activity } = await activitiesApi.get(p.activityId!);
        if (cancelled) return;
        setKind(activity.kind);
        const cName = refField(activity.contactId, 'name');
        const cId = typeof activity.contactId === 'object' ? activity.contactId._id : activity.contactId;
        if (cId) setContact({ _id: cId, name: cName || 'Contact', phone: refField(activity.contactId, 'phone') });
        const pId = typeof activity.propertyId === 'object' ? activity.propertyId?._id : activity.propertyId;
        if (pId) {
          setProperty({
            _id: pId,
            title: refField(activity.propertyId, 'title') || 'Property',
            location: refField(activity.propertyId, 'location'),
          });
        }
        setStatus(activity.status);
        setNotes(activity.notes ?? '');
        if (activity.scheduledAt) {
          const d = new Date(activity.scheduledAt);
          setDateKey(dateOnly(d));
          setTime(d.toTimeString().slice(0, 5));
        }
      } catch (err: any) {
        Alert.alert('Could not load', err.message ?? 'This schedule item could not be loaded.');
        navigation.goBack();
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, p.activityId, navigation]);

  const buildWhen = () => {
    const parsed = parseTime(time);
    if (!parsed) return null;
    const [h, m] = parsed;
    const when = new Date(dateKey);
    when.setHours(h, m, 0, 0);
    return when;
  };

  const whenPreview = () => {
    const when = buildWhen();
    if (!when) return 'Enter a valid time (HH:MM)';
    return when.toLocaleString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const save = async () => {
    if (!contact) {
      Alert.alert('Contact required', 'Pick who this is for.');
      return;
    }
    const when = buildWhen();
    if (!when) {
      Alert.alert('Invalid time', 'Enter the time as HH:MM, e.g. 15:30.');
      return;
    }
    // Guard against silently booking a brand-new visit in the past.
    if (!isEdit && when.getTime() < Date.now() - 60_000 && kind !== 'Note') {
      Alert.alert('That time is in the past', 'Pick an upcoming date and time, or change the type to “Note” to log something that already happened.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Activity> & { contactId: string } = {
        contactId: contact._id,
        propertyId: property?._id,
        kind,
        scheduledAt: when.toISOString(),
        notes: notes.trim() || undefined,
      };
      // Let the backend revive a Missed/Cancelled item when we reschedule ahead.
      if (isEdit && when.getTime() > Date.now() && (status === 'Missed' || status === 'Cancelled')) {
        payload.status = 'Scheduled';
      }
      if (isEdit && p.activityId) await activitiesApi.update(p.activityId, payload);
      else await activitiesApi.create(payload);
      haptic('success');
      navigation.goBack();
    } catch (err: any) {
      haptic('error');
      Alert.alert('Failed', err.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const setActivityStatus = async (next: ActivityStatus) => {
    if (!p.activityId) return;
    setWorking(true);
    try {
      await activitiesApi.update(p.activityId, { status: next });
      haptic(next === 'Done' ? 'success' : 'light');
      navigation.goBack();
    } catch (err: any) {
      haptic('error');
      Alert.alert('Failed', err.message ?? 'Could not update.');
    } finally {
      setWorking(false);
    }
  };

  const remove = () => {
    if (!p.activityId) return;
    Alert.alert('Delete schedule', 'Remove this item from your schedule? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            await activitiesApi.remove(p.activityId!);
            haptic('warning');
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Failed', err.message ?? 'Could not delete.');
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  if (loadingActivity) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </Screen>
    );
  }

  const isOpen = status === 'Scheduled' || status === 'Missed';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Status banner on edit — one glance tells the agent where this stands. */}
        {isEdit ? (
          <View style={[styles.statusBanner, statusBannerStyle(status)]}>
            <Text style={[styles.statusBannerText, { color: statusColor(status) }]}>
              {statusLabel(status)}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Type</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable key={k} onPress={() => { haptic('selection'); setKind(k); }} style={[styles.kindChip, kind === k && styles.kindChipActive]}>
              <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>{k}</Text>
            </Pressable>
          ))}
        </View>

        <ContactPicker label="For contact *" value={contact} onChange={setContact} placeholder="Pick a client or owner" />

        <PropertyPicker
          label={kind === 'Visit' ? 'Property to show' : 'Related property'}
          value={property}
          onChange={setProperty}
          placeholder={kind === 'Visit' ? 'Which property are you showing?' : 'Attach a property (optional)'}
        />

        <Text style={styles.label}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {days.map((d, idx) => {
            const key = dateOnly(d);
            const active = key === dateKey;
            const rel = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <Pressable key={key} onPress={() => { haptic('selection'); setDateKey(key); }} style={[styles.dateChip, active && styles.dateChipActive]}>
                <Text style={[styles.dateDow, active && styles.dateTextActive]} numberOfLines={1}>{rel}</Text>
                <Text style={[styles.dateNum, active && styles.dateTextActive]}>{d.getDate()}</Text>
                <Text style={[styles.dateMon, active && styles.dateTextActive]}>{d.toLocaleDateString(undefined, { month: 'short' })}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Time</Text>
        <View style={styles.timeRow}>
          {COMMON_TIMES.map((t) => (
            <Pressable key={t} onPress={() => { haptic('selection'); setTime(t); }} style={[styles.timeChip, time === t && styles.timeChipActive]}>
              <Text style={[styles.timeText, time === t && styles.timeTextActive]}>{t}</Text>
            </Pressable>
          ))}
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={colors.textSubtle} style={styles.timeInput} />
        </View>

        <View style={styles.whenRow}>
          <CalendarClock size={15} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.whenText}>{whenPreview()}</Text>
        </View>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="e.g. Show the 3BHK and the terrace" placeholderTextColor={colors.textSubtle} style={styles.notes} multiline />

        <Button title={isEdit ? 'Save changes' : 'Add to schedule'} onPress={save} loading={saving} style={styles.save} />

        {/* Quick outcome actions for an open item — the day-to-day workflow. */}
        {isEdit && isOpen ? (
          <View style={styles.actionRow}>
            <Pressable onPress={() => setActivityStatus('Done')} disabled={working} style={[styles.action, styles.actionDone]}>
              <Check size={17} color={colors.success} strokeWidth={2.6} />
              <Text style={[styles.actionText, { color: colors.success }]}>Mark done</Text>
            </Pressable>
            <Pressable onPress={() => setActivityStatus('Cancelled')} disabled={working} style={[styles.action, styles.actionCancel]}>
              <X size={17} color={colors.textMuted} strokeWidth={2.6} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {isEdit ? (
          <Pressable onPress={remove} disabled={working} style={styles.deleteRow} hitSlop={8}>
            <Trash2 size={16} color={colors.danger} strokeWidth={2.2} />
            <Text style={styles.deleteText}>Delete schedule</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function dateOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function statusColor(s: ActivityStatus) {
  return s === 'Done' ? colors.success : s === 'Missed' ? colors.danger : s === 'Cancelled' ? colors.textMuted : colors.primary;
}
function statusBannerStyle(s: ActivityStatus) {
  const bg = s === 'Done' ? colors.successTint : s === 'Missed' ? colors.dangerTint : s === 'Cancelled' ? colors.surfaceAlt : colors.primaryTint;
  return { backgroundColor: bg };
}
function statusLabel(s: ActivityStatus) {
  return s === 'Scheduled' ? 'Scheduled · open' : s === 'Missed' ? 'Overdue · reschedule or mark done' : s === 'Done' ? 'Completed' : 'Cancelled';
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  loader: { marginTop: spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },

  statusBanner: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.lg },
  statusBannerText: { fontSize: 13.5, fontWeight: '700' },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  kindChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { color: colors.text, fontWeight: '600' },
  kindTextActive: { color: colors.white },

  dateRow: { gap: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.md },
  dateChip: { width: 62, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', paddingVertical: spacing.sm },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDow: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  dateNum: { fontSize: 20, color: colors.text, fontWeight: '800', marginVertical: 1 },
  dateMon: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dateTextActive: { color: colors.white },

  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  timeChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  timeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { color: colors.textMuted, fontWeight: '600', fontSize: 13.5 },
  timeTextActive: { color: colors.white },
  timeInput: { width: 80, height: 40, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, color: colors.text, textAlign: 'center', ...(({ outlineStyle: 'none' } as unknown) as object) },

  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, backgroundColor: colors.primaryTint, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  whenText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 13.5 },

  notes: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, minHeight: 90, fontSize: 15, color: colors.text, textAlignVertical: 'top', ...(({ outlineStyle: 'none' } as unknown) as object) },
  save: { marginTop: spacing.xl },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1.5 },
  actionDone: { borderColor: colors.success, backgroundColor: colors.successTint },
  actionCancel: { borderColor: colors.border, backgroundColor: colors.surface },
  actionText: { fontWeight: '700', fontSize: 14 },

  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
