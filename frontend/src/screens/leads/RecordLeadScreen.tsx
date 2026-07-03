import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Mic, Check, Sparkles, Square, User as UserIcon } from 'lucide-react-native';
import * as recorder from '../../lib/audioRecorder';
import { PulseRings, Waveform } from '../../components/AudioViz';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ContactPicker, PickedContact } from '../../components/ContactPicker';
import { CallLogPicker } from '../../components/CallLogPicker';
import { leadsApi } from '../../api/leads';
import { contactsApi } from '../../api/contacts';
import { colors, radius, shadow, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { playCue } from '../../lib/sound';
import { RootScreenProps } from '../../navigation/types';

type RecordState = 'idle' | 'recording' | 'recorded';

export function RecordLeadScreen({ navigation, route }: RootScreenProps<'RecordLead'>) {
  // Prefill from the post-call nudge (or any caller) when provided.
  const prefill = route.params ?? {};
  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState('00:00');
  const [phoneNumber, setPhoneNumber] = useState(prefill.phoneNumber ?? '');
  const [clientName, setClientName] = useState(prefill.clientName ?? '');
  const [transactionType, setTransactionType] = useState<'Buy' | 'Rent'>('Buy');
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<PickedContact | null>(null);
  // Name of an existing contact matched by the entered phone number, if any.
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const recording = useRef<recorder.Recording | null>(null);
  const isRecording = useRef(false);
  // Tracks whether the current name was auto-filled (so manual edits stick).
  const nameAutoFilled = useRef(Boolean(prefill.clientName));

  // When a phone number is entered, look up an existing contact and, if found,
  // prefill the client's name from it — so a known number never becomes "null".
  useEffect(() => {
    const digits = phoneNumber.replace(/[^\d]/g, '');
    if (digits.length < 7) {
      setMatchedName(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await contactsApi.list({ q: digits });
        const match = res.contacts.find(
          (c) => c.phone && c.phone.replace(/[^\d]/g, '').endsWith(digits.slice(-7))
        );
        if (cancelled) return;
        setMatchedName(match?.name ?? null);
        // Fill the name only if the user hasn't typed their own.
        if (match?.name && (!clientName.trim() || nameAutoFilled.current)) {
          nameAutoFilled.current = true;
          setClientName(match.name);
        }
      } catch {
        // best-effort lookup
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  const onPickContact = useCallback((c: PickedContact) => {
    setPicked(c);
    if (c.phone) setPhoneNumber(c.phone);
    nameAutoFilled.current = true;
    setClientName(c.name);
    setMatchedName(c.name);
  }, []);

  const onPickCall = useCallback((call: { phoneNumber: string; name: string | null }) => {
    setPhoneNumber(call.phoneNumber);
    if (call.name) {
      nameAutoFilled.current = true;
      setClientName(call.name);
    }
  }, []);

  const onEditName = useCallback((text: string) => {
    nameAutoFilled.current = false;
    setClientName(text);
  }, []);

  // Ensure recording stops if the user leaves mid-record.
  useEffect(() => {
    return () => {
      if (isRecording.current) recorder.cancelRecording();
    };
  }, []);

  const startRecording = useCallback(async () => {
    const ok = await recorder.requestPermission();
    if (!ok) {
      Alert.alert('Permission needed', 'Microphone access is required to record a lead.');
      return;
    }
    try {
      await recorder.startRecording((ms) => setElapsed(recorder.formatElapsed(ms)));
      isRecording.current = true;
      setState('recording');
      haptic('medium');
      playCue('start');
    } catch {
      Alert.alert('Recording error', 'Could not start recording.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      recording.current = await recorder.stopRecording();
      isRecording.current = false;
      setState('recorded');
      haptic('success');
      playCue('stop');
    } catch {
      Alert.alert('Recording error', 'Could not stop recording.');
    }
  }, []);

  const reset = useCallback(() => {
    recording.current = null;
    setElapsed('00:00');
    setState('idle');
  }, []);

  const submit = useCallback(async () => {
    if (!recording.current) return;
    if (!phoneNumber.trim()) {
      Alert.alert('Phone required', "Enter the client's phone number to link this lead.");
      return;
    }
    if (!clientName.trim()) {
      Alert.alert(
        'Name required',
        "Add the client's name — pick a contact, choose a recent call, or type it. A known number fills this automatically."
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await leadsApi.createFromVoice({
        recording: recording.current,
        phoneNumber: phoneNumber.trim(),
        clientName: clientName.trim(),
        transactionType,
      });
      navigation.replace('LeadDetail', { leadId: res.lead._id });
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not process the voice note.');
    } finally {
      setSubmitting(false);
    }
  }, [phoneNumber, clientName, transactionType, navigation]);

  const recorded = state === 'recorded';
  const isRec = state === 'recording';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* AI hint pill */}
        <View style={styles.aiPill}>
          <Sparkles size={14} color={colors.accentDark} strokeWidth={2.4} />
          <Text style={styles.aiPillText}>AI structures budget, area, type & urgency automatically</Text>
        </View>

        {/* Step 1 — Record */}
        <StepHeader n={1} title="Record the requirement" done={recorded} />
        <View style={[styles.recorderBox, isRec && styles.recorderBoxActive, recorded && styles.recorderBoxDone]}>
          <View style={styles.micWrap}>
            <PulseRings active={isRec} size={104} color={colors.danger} />
            <Pressable
              onPress={isRec ? stopRecording : startRecording}
              disabled={recorded}
              style={({ pressed }) => [
                styles.micButton,
                isRec && styles.micRecording,
                recorded && styles.micDone,
                pressed && !recorded && styles.micPressed,
              ]}
            >
              {recorded ? (
                <Check size={44} color={colors.white} strokeWidth={2.6} />
              ) : isRec ? (
                <Square size={34} color={colors.white} fill={colors.white} />
              ) : (
                <Mic size={44} color={colors.white} strokeWidth={2.2} />
              )}
            </Pressable>
          </View>

          <Text style={[styles.timer, isRec && styles.timerActive, recorded && styles.timerDone]}>{elapsed}</Text>

          <View style={styles.waveSlot}>
            {isRec ? <Waveform active bars={32} height={40} color={colors.danger} /> : null}
          </View>

          <Text style={styles.recordState}>
            {state === 'idle' && 'Tap the mic and speak the client’s requirement'}
            {isRec && 'Listening… tap to stop'}
            {recorded && 'Captured — review the client details below'}
          </Text>

          {recorded ? (
            <Pressable onPress={reset} style={styles.rerecordChip}>
              <Mic size={14} color={colors.primary} strokeWidth={2.4} />
              <Text style={styles.rerecordText}>Re-record</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Step 2 — Client */}
        <StepHeader n={2} title="Who is this for?" done={Boolean(phoneNumber.trim() && clientName.trim())} />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Looking to</Text>
          <View style={styles.segment}>
            {(['Buy', 'Rent'] as const).map((t) => (
              <Pressable key={t} onPress={() => { haptic('selection'); setTransactionType(t); }} style={[styles.segmentBtn, transactionType === t && styles.segmentActive]}>
                <Text style={[styles.segmentText, transactionType === t && styles.segmentTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <ContactPicker label="Client" value={picked} onChange={onPickContact} placeholder="Pick from contacts" />
          <View style={styles.callLogRow}>
            <CallLogPicker onPick={onPickCall} />
          </View>

          <Input
            label="Client phone number *"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+91 90000 00000"
            keyboardType="phone-pad"
          />
          <Input
            label="Client name *"
            icon={UserIcon}
            value={clientName}
            onChangeText={onEditName}
            placeholder="Pick a contact or type the name"
          />
          {matchedName ? (
            <View style={styles.matchRow}>
              <Check size={14} color={colors.success} strokeWidth={2.6} />
              <Text style={styles.matchHint}>Matched contact: {matchedName}</Text>
            </View>
          ) : null}
        </View>

        <Button
          title={recorded ? 'Save lead' : 'Record first to save'}
          icon={recorded ? Check : undefined}
          onPress={submit}
          loading={submitting}
          disabled={!recorded}
          style={styles.saveBtn}
        />
      </ScrollView>
    </Screen>
  );
}

function StepHeader({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
        {done ? <Check size={14} color={colors.white} strokeWidth={3} /> : <Text style={styles.stepNum}>{n}</Text>}
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.accentTint, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.lg },
  aiPillText: { fontSize: 12.5, fontWeight: '700', color: colors.accentDark, flexShrink: 1 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepBadgeDone: { backgroundColor: colors.success },
  stepNum: { color: colors.white, fontWeight: '800', fontSize: 13 },
  stepTitle: { ...typography.h3, fontSize: 17 },

  recorderBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.md,
  },
  recorderBoxActive: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  recorderBoxDone: { borderColor: colors.success, backgroundColor: colors.successTint },
  micWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  micButton: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.brand,
  },
  micRecording: { backgroundColor: colors.danger },
  micDone: { backgroundColor: colors.success },
  micPressed: { transform: [{ scale: 0.96 }] },
  timer: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: spacing.sm, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  timerActive: { color: colors.danger },
  timerDone: { color: colors.success },
  waveSlot: { height: 40, justifyContent: 'center', marginTop: spacing.xs },
  recordState: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', fontWeight: '500' },
  rerecordChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primaryTint, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill },
  rerecordText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, ...shadow.sm },
  segmentText: { fontWeight: '700', color: colors.textMuted },
  segmentTextActive: { color: colors.primary },
  callLogRow: { marginTop: -spacing.xs, marginBottom: spacing.md },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -spacing.xs },
  matchHint: { fontSize: 13, color: colors.success, fontWeight: '600' },

  saveBtn: { marginTop: spacing.xs },
});
