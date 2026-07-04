import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Phone, CalendarPlus, Pencil, Building2, Mic, ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonRecordDetail } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { SectionHeader } from '../../components/SectionHeader';
import { CustomFieldsDisplay } from '../../components/CustomFieldsEditor';
import { contactsApi } from '../../api/contacts';
import { Activity, Contact, ContactRole, Lead, Property, Ref } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

const roleTone: Record<ContactRole, 'primary' | 'accent' | 'success' | 'warning'> = {
  Owner: 'primary', Buyer: 'accent', Tenant: 'success', Seller: 'warning',
};
const refName = (r?: Ref | string) => (typeof r === 'object' && r ? r.title ?? r.name ?? '' : '');
const whenLabel = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export function ContactDetailScreen({ navigation, route }: RootScreenProps<'ContactDetail'>) {
  const { contactId } = route.params;
  const [contact, setContact] = useState<Contact | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [requirements, setRequirements] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await contactsApi.get(contactId);
      setContact(res.contact);
      setProperties(res.properties);
      setRequirements(res.requirements);
      setActivities(res.activities);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => { haptic('light'); navigation.navigate('ContactForm', { contactId }); }} hitSlop={10}>
          <Pencil size={20} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
      ),
    });
  }, [navigation, contactId]);

  if (loading) return <Screen><SkeletonRecordDetail /></Screen>;
  if (!contact) return <Screen><Text style={styles.muted}>Contact not found.</Text></Screen>;

  const schedule = () => navigation.navigate('ActivityForm', { contactId: contact._id, contactName: contact.name, contactPhone: contact.phone });

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar name={contact.name} size={72} />
          <Text style={styles.name}>{contact.name}</Text>
          {contact.phone ? <Text style={styles.phone}>{contact.phone}</Text> : null}
          {contact.roles?.length ? (
            <View style={styles.badges}>{contact.roles.map((r) => <Badge key={r} label={r} tone={roleTone[r]} />)}</View>
          ) : null}
        </View>

        {/* Quick actions */}
        <View style={styles.actionRow}>
          {contact.phone ? (
            <Pressable style={styles.action} onPress={() => { haptic('light'); Linking.openURL(`tel:${contact.phone}`); }}>
              <Phone size={20} color={colors.primary} strokeWidth={2.2} /><Text style={styles.actionText}>Call</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.action} onPress={() => { haptic('light'); schedule(); }}>
            <CalendarPlus size={20} color={colors.primary} strokeWidth={2.2} /><Text style={styles.actionText}>Schedule</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => { haptic('light'); navigation.navigate('RecordLead'); }}>
            <Mic size={20} color={colors.primary} strokeWidth={2.2} /><Text style={styles.actionText}>Requirement</Text>
          </Pressable>
        </View>

        {contact.notes ? <Card variant="flat"><Text style={styles.notes}>{contact.notes}</Text></Card> : null}

        <CustomFieldsDisplay entityType="contact" values={contact.customFields} title="More details" />


        {/* Owned properties */}
        <View style={styles.section}><SectionHeader title={`Properties (${properties.length})`} /></View>
        {properties.length === 0 ? <Card variant="flat"><Text style={styles.muted}>No properties owned.</Text></Card> :
          properties.map((p) => (
            <Card key={p._id} style={styles.rowCard} onPress={() => navigation.navigate('PropertyDetail', { propertyId: p._id })}>
              <View style={styles.rowInner}>
                <View style={styles.tile}><Building2 size={18} color={colors.primary} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.muted}>{p.listingType ?? 'Sale'} · {formatCurrency(p.listingType === 'Rent' ? p.monthlyRent : p.price)}</Text>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </Card>
          ))}

        {/* Requirements */}
        <View style={styles.section}><SectionHeader title={`Requirements (${requirements.length})`} /></View>
        {requirements.length === 0 ? <Card variant="flat"><Text style={styles.muted}>No buy/rent requirements.</Text></Card> :
          requirements.map((l) => (
            <Card key={l._id} style={styles.rowCard} onPress={() => navigation.navigate('LeadDetail', { leadId: l._id })}>
              <View style={styles.rowInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.requirements?.transactionType ?? 'Buy'} · {l.requirements?.propertyType ?? 'Any'}</Text>
                  <Text style={styles.muted}>{formatCurrency(l.requirements?.budgetMax)} · {l.requirements?.location ?? 'Any area'}</Text>
                </View>
                <Badge label={l.status} tone={l.status === 'New' ? 'primary' : l.status === 'Contacted' ? 'warning' : 'muted'} />
              </View>
            </Card>
          ))}

        {/* Activity timeline */}
        <View style={styles.section}><SectionHeader title={`Activity (${activities.length})`} onAction={() => schedule()} actionLabel="Add" /></View>
        {activities.length === 0 ? <Card variant="flat"><Text style={styles.muted}>No visits or follow-ups yet.</Text></Card> :
          activities.slice(0, 8).map((a) => (
            <Card key={a._id} style={styles.rowCard} onPress={() => navigation.navigate('ActivityForm', { activityId: a._id, contactId: contact._id, contactName: contact.name, kind: a.kind, notes: a.notes, scheduledAt: a.scheduledAt })}>
              <View style={styles.rowInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{a.kind}{refName(a.propertyId) ? ` · ${refName(a.propertyId)}` : ''}</Text>
                  <Text style={styles.muted}>{whenLabel(a.scheduledAt)}</Text>
                </View>
                <Badge label={a.status} tone={a.status === 'Done' ? 'success' : a.status === 'Scheduled' ? 'primary' : 'muted'} />
              </View>
            </Card>
          ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  name: { ...typography.h1, fontSize: 24, marginTop: spacing.md },
  phone: { ...typography.caption, fontSize: 14, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  action: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
  actionText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  notes: { ...typography.body, lineHeight: 20 },
  section: { marginTop: spacing.xl },
  rowCard: { padding: spacing.md, marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.bodyStrong, fontSize: 15 },
  muted: { ...typography.caption },
});
