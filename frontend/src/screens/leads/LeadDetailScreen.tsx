import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarPlus, ChevronRight, Pencil, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonRecordDetail } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LocationPicker } from '../../components/LocationPicker';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../../components/CustomFieldsEditor';
import { MatchBadge, MatchReasons } from '../../components/MatchReasons';
import { leadsApi } from '../../api/leads';
import {
  CustomFieldValues,
  Lead,
  LeadStatus,
  PropertyMatch,
  REQUIREMENT_TYPES,
  RequirementType,
  SelectedLocation,
  TransactionType,
  Urgency,
} from '../../types';
import { colors, radius, spacing } from '../../theme';
import { displayName, formatCurrency, urgencyTone } from '../../utils/format';
import { RootScreenProps } from '../../navigation/types';

const REQ_TYPES: RequirementType[] = REQUIREMENT_TYPES;
const URGENCIES: Urgency[] = ['Low', 'Medium', 'High'];

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Closed'];

export function LeadDetailScreen({ route, navigation }: RootScreenProps<'LeadDetail'>) {
  const { leadId } = route.params;
  const [lead, setLead] = useState<Lead | null>(null);
  const [matches, setMatches] = useState<PropertyMatch[]>([]);
  // How many matched in total; the endpoint returns only the strongest page.
  const [matchTotal, setMatchTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);

  // Manual editing of the structured requirements.
  const [editingReq, setEditingReq] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [edTxn, setEdTxn] = useState<TransactionType>('Buy');
  const [edBudget, setEdBudget] = useState('');
  const [edBeds, setEdBeds] = useState('');
  const [edType, setEdType] = useState<RequirementType>('Any');
  const [edUrgency, setEdUrgency] = useState<Urgency | undefined>();
  const [edCustom, setEdCustom] = useState<CustomFieldValues>({});

  // The endpoint ranks every match but returns only the strongest page, so keep
  // the total alongside the rows.
  const refreshMatches = useCallback(async (id: string) => {
    const res = await leadsApi.matches(id);
    setMatches(res.matches);
    setMatchTotal(res.total);
  }, []);

  const load = useCallback(async () => {
    try {
      const [leadRes, matchRes] = await Promise.all([
        leadsApi.get(leadId),
        leadsApi.matches(leadId),
      ]);
      setLead(leadRes.lead);
      setMatches(matchRes.matches);
      setMatchTotal(matchRes.total);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = useCallback(
    async (status: LeadStatus) => {
      if (!lead || lead.status === status) return;
      setUpdating(true);
      try {
        const res = await leadsApi.update(lead._id, { status });
        setLead(res.lead);
      } finally {
        setUpdating(false);
      }
    },
    [lead]
  );

  // Refine the desired area to an exact, geocoded location, then re-run matching.
  const setExactLocation = useCallback(
    async (loc: SelectedLocation) => {
      if (!lead) return;
      setSavingLoc(true);
      try {
        const res = await leadsApi.update(lead._id, {
          requirements: {
            ...lead.requirements,
            location: loc.label,
            geo: { lat: loc.lat, lng: loc.lng, label: loc.label, placeId: loc.placeId },
          },
        });
        setLead(res.lead);
        await refreshMatches(lead._id);
      } finally {
        setSavingLoc(false);
      }
    },
    [lead, refreshMatches]
  );

  // Seed the edit form from the current requirements and open it.
  const startEditReq = useCallback(() => {
    const r = lead?.requirements ?? {};
    setEdTxn(r.transactionType ?? 'Buy');
    setEdBudget(r.budgetMax != null ? String(r.budgetMax) : '');
    setEdBeds(r.bedrooms != null ? String(r.bedrooms) : '');
    setEdType(r.propertyType ?? 'Any');
    setEdUrgency(r.urgency);
    setEdCustom(lead?.customFields ?? {});
    setEditingReq(true);
  }, [lead]);

  const saveReq = useCallback(async () => {
    if (!lead) return;
    setSavingReq(true);
    try {
      const res = await leadsApi.update(lead._id, {
        requirements: {
          ...lead.requirements,
          transactionType: edTxn,
          budgetMax: edBudget.trim() ? Number(edBudget) : undefined,
          bedrooms: edBeds.trim() ? Number(edBeds) : undefined,
          propertyType: edType,
          urgency: edUrgency,
        },
        customFields: edCustom,
      });
      setLead(res.lead);
      setEditingReq(false);
      await refreshMatches(lead._id);
    } finally {
      setSavingReq(false);
    }
  }, [lead, edTxn, edBudget, edBeds, edType, edUrgency, edCustom, refreshMatches]);

  if (loading) {
    return (
      <Screen>
        <SkeletonRecordDetail />
      </Screen>
    );
  }

  if (!lead) {
    return (
      <Screen>
        <Text style={styles.muted}>Lead not found.</Text>
      </Screen>
    );
  }

  const req = lead.requirements ?? {};
  const currentLoc: SelectedLocation | null = req.geo?.coordinates
    ? {
        label: req.geo.label || req.location || 'Selected area',
        lat: req.geo.coordinates[1],
        lng: req.geo.coordinates[0],
        placeId: req.geo.placeId,
      }
    : null;

  // contactId may be a raw id or a populated { _id, name, phone } ref.
  const contactRef = typeof lead.contactId === 'object' ? lead.contactId : null;
  const contactId = contactRef?._id ?? (typeof lead.contactId === 'string' ? lead.contactId : undefined);
  const clientName = displayName(contactRef?.name ?? lead.clientName);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{clientName}</Text>
          <Text style={styles.phone}>{lead.phoneNumber}</Text>
          <View style={styles.badgeRow}>
            <Badge label={req.transactionType === 'Rent' ? 'Wants to Rent' : 'Wants to Buy'} tone={req.transactionType === 'Rent' ? 'success' : 'accent'} />
            {req.urgency ? <Badge label={`${req.urgency} urgency`} tone={urgencyTone(req.urgency)} /> : null}
            {lead.source === 'form' ? <Badge label="From form" tone="primary" /> : null}
            {lead.source === 'voice' && !lead.reviewed ? (
              <Badge label="AI-extracted · review" tone="warning" />
            ) : null}
          </View>
          {lead.source === 'voice' && !lead.reviewed ? (
            <Text style={styles.reviewHint}>
              These details were read from your voice note. Tap Edit to confirm them.
            </Text>
          ) : null}
        </View>

        <View style={styles.quickRow}>
          {contactId ? (
            <Button
              title="Schedule follow-up"
              variant="secondary"
              icon={CalendarPlus}
              onPress={() => navigation.navigate('ActivityForm', { contactId, contactName: clientName, contactPhone: lead.phoneNumber, kind: 'Follow-up' })}
            />
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <Pressable onPress={editingReq ? () => setEditingReq(false) : startEditReq} hitSlop={10} style={styles.editBtn}>
            {editingReq ? <X size={16} color={colors.textMuted} /> : <Pencil size={15} color={colors.primary} />}
            <Text style={[styles.editBtnText, editingReq && styles.editBtnCancel]}>{editingReq ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        </View>
        <Card>
          {editingReq ? (
            <View>
              <Text style={styles.editLabel}>Looking to</Text>
              <View style={styles.segment}>
                {(['Buy', 'Rent'] as TransactionType[]).map((t) => (
                  <Pressable key={t} onPress={() => setEdTxn(t)} style={[styles.segmentBtn, edTxn === t && styles.segmentActive]}>
                    <Text style={[styles.segmentText, edTxn === t && styles.segmentTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Input label="Budget (max)" value={edBudget} onChangeText={setEdBudget} placeholder="e.g. 8000000" keyboardType="numeric" />

              <Input label="Bedrooms (BHK)" value={edBeds} onChangeText={setEdBeds} placeholder="e.g. 3" keyboardType="numeric" />

              <Text style={styles.editLabel}>Property type</Text>
              <View style={styles.chipWrap}>
                {REQ_TYPES.map((t) => (
                  <Pressable key={t} onPress={() => setEdType(t)} style={[styles.chip, edType === t && styles.chipActive]}>
                    <Text style={[styles.chipText, edType === t && styles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.editLabel}>Urgency</Text>
              <View style={styles.chipWrap}>
                {URGENCIES.map((u) => (
                  <Pressable key={u} onPress={() => setEdUrgency(edUrgency === u ? undefined : u)} style={[styles.chip, edUrgency === u && styles.chipActive]}>
                    <Text style={[styles.chipText, edUrgency === u && styles.chipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>

              <CustomFieldsEditor entityType="lead" values={edCustom} onChange={setEdCustom} />

              <Button title="Save requirements" onPress={saveReq} loading={savingReq} style={styles.saveReqBtn} />
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => contactId && navigation.navigate('ContactDetail', { contactId })}
                disabled={!contactId}
                style={[styles.detailRow, styles.detailBorder]}
              >
                <Text style={styles.detailLabel}>Client</Text>
                <View style={styles.clientValue}>
                  <Text style={[styles.detailValue, contactId && styles.clientLink]} numberOfLines={1}>{clientName}</Text>
                  {contactId ? <ChevronRight size={16} color={colors.primary} /> : null}
                </View>
              </Pressable>
              <DetailRow label="Looking to" value={req.transactionType ?? 'Buy'} />
              <DetailRow label="Budget (max)" value={formatCurrency(req.budgetMax)} />
              <DetailRow label="Bedrooms" value={req.bedrooms != null ? `${req.bedrooms} BHK` : '—'} />
              <DetailRow label="Property type" value={req.propertyType ?? 'Any'} />
              <DetailRow label="Urgency" value={req.urgency ?? '—'} last />
            </>
          )}
        </Card>

        {!editingReq ? (
          <CustomFieldsDisplay entityType="lead" values={lead.customFields} title="More details" />
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Desired area</Text>
          <Badge
            label={currentLoc ? 'Geofenced' : 'Approximate'}
            tone={currentLoc ? 'success' : 'warning'}
          />
        </View>
        <Card>
          <LocationPicker
            value={currentLoc}
            onChange={setExactLocation}
            initialQuery={req.location}
            placeholder={req.location || 'Set the exact area'}
          />
          <Text style={styles.locNote}>
            {currentLoc
              ? 'Matching uses properties within ~15 km of this point.'
              : `Heard “${req.location ?? 'no area'}”. Pick the exact one to geofence matches.`}
          </Text>
          {savingLoc ? <ActivityIndicator color={colors.primary} style={styles.locSpinner} /> : null}
        </Card>

        {req.rawAudioTranscript ? (
          <>
            <Text style={styles.sectionTitle}>Voice note transcript</Text>
            <Card>
              <Text style={styles.transcript}>{req.rawAudioTranscript}</Text>
            </Card>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => (
            <Button
              key={s}
              title={s}
              variant={lead.status === s ? 'primary' : 'secondary'}
              onPress={() => changeStatus(s)}
              loading={updating && lead.status !== s}
              style={styles.statusBtn}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Matching properties {matchTotal ? `(${matchTotal})` : ''}
        </Text>
        {matches.length === 0 ? (
          <Card>
            <Text style={styles.muted}>
              No available properties fit this lead yet. Add inventory and it'll show up here.
            </Text>
          </Card>
        ) : (
          matches.map((p) => (
            <Card key={p._id}>
              <View style={styles.matchRow}>
                <Text style={styles.matchTitle}>{p.title}</Text>
                <Text style={styles.matchPrice}>{formatCurrency(p.price)}</Text>
              </View>
              <View style={styles.matchMetaRow}>
                <Text style={styles.muted}>
                  {p.propertyType} · {p.location}
                  {p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}
                </Text>
                <MatchBadge score={p.matchScore} quality={p.matchQuality} />
              </View>
              <MatchReasons reasons={p.matchReasons} />
            </Card>
          ))
        )}
        {matchTotal > matches.length ? (
          <Text style={styles.muted}>
            Showing the {matches.length} strongest of {matchTotal} matches.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  loader: { marginTop: spacing.xl },
  header: { marginBottom: spacing.md },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  phone: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  reviewHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  matchMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  quickRow: { marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  locNote: { fontSize: 13, color: colors.textMuted, marginTop: -spacing.xs },
  locSpinner: { marginTop: spacing.sm },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  editBtnCancel: { color: colors.textMuted },
  editLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontWeight: '700', color: colors.textMuted },
  segmentTextActive: { color: colors.primary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13.5 },
  chipTextActive: { color: colors.white },
  saveReqBtn: { marginTop: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontSize: 14, color: colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  clientValue: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, marginLeft: spacing.md },
  clientLink: { color: colors.primary },
  transcript: { fontSize: 14, color: colors.text, lineHeight: 20 },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusBtn: { flex: 1, height: 44, paddingHorizontal: spacing.sm },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  matchPrice: { fontSize: 15, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 14, color: colors.textMuted },
});
