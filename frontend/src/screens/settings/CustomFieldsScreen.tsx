import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { customFieldsApi } from '../../api/customFields';
import { CustomFieldDef, CustomFieldType, EntityType } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

const ENTITY_TABS: { key: EntityType; label: string }[] = [
  { key: 'property', label: 'Properties' },
  { key: 'lead', label: 'Requirements' },
  { key: 'contact', label: 'Contacts' },
];

const FIELD_TYPES: CustomFieldType[] = ['text', 'textarea', 'number', 'select', 'date', 'boolean'];

export function CustomFieldsScreen(_props: RootScreenProps<'CustomFields'>) {
  const [entityType, setEntityType] = useState<EntityType>('property');
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(
    async (type: EntityType) => {
      setLoading(true);
      setError(null);
      setSavedMsg(null);
      try {
        const res = await customFieldsApi.get(type);
        setFields([...res.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      } catch (err: any) {
        setError(err.message ?? 'Failed to load custom fields.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load(entityType);
    }, [entityType, load])
  );

  const switchTab = (type: EntityType) => {
    if (type === entityType) return;
    haptic('selection');
    setEntityType(type);
  };

  const patch = (index: number, p: Partial<CustomFieldDef>) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...p } : f)));

  const move = (index: number, dir: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));

  const addField = () => {
    haptic('light');
    setFields((prev) => [
      ...prev,
      {
        key: `cf_${Date.now()}`,
        label: '',
        type: 'text',
        options: [],
        required: false,
        aiExtract: true,
      },
    ]);
  };

  const save = async () => {
    // Drop blank-label fields before saving (backend does too).
    const clean = fields
      .filter((f) => f.label.trim())
      .map((f, i) => ({ ...f, label: f.label.trim(), order: i }));
    setSaving(true);
    setError(null);
    try {
      const res = await customFieldsApi.update(entityType, clean);
      setFields([...res.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      haptic('success');
      setSavedMsg('Saved.');
    } catch (err: any) {
      haptic('error');
      setError(err.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      {/* Entity type tabs */}
      <View style={styles.tabs}>
        {ENTITY_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => switchTab(t.key)}
            style={[styles.tab, entityType === t.key && styles.tabOn]}
          >
            <Text style={[styles.tabText, entityType === t.key && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Fields you add here appear on every {tabNoun(entityType)} you create or edit. Voice
            notes fill AI-enabled fields automatically.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}

          {fields.map((field, index) => (
            <FieldCard
              key={field.key}
              field={field}
              index={index}
              count={fields.length}
              onPatch={(p) => patch(index, p)}
              onMove={(dir) => move(index, dir)}
              onRemove={() => remove(index)}
            />
          ))}

          {fields.length === 0 ? (
            <Text style={styles.empty}>No custom fields yet. Add one below.</Text>
          ) : null}

          <Button
            title="Add field"
            icon={Plus}
            variant="secondary"
            size="md"
            onPress={addField}
            style={styles.add}
          />
          <Button title="Save changes" loading={saving} onPress={save} style={styles.save} />
        </ScrollView>
      )}
    </Screen>
  );
}

function tabNoun(t: EntityType) {
  return t === 'property' ? 'property' : t === 'lead' ? 'requirement' : 'contact';
}

function FieldCard({
  field,
  index,
  count,
  onPatch,
  onMove,
  onRemove,
}: {
  field: CustomFieldDef;
  index: number;
  count: number;
  onPatch: (p: Partial<CustomFieldDef>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isSelect = field.type === 'select';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <TextInput
          style={styles.labelInput}
          value={field.label}
          onChangeText={(t) => onPatch({ label: t })}
          placeholder="Field label (e.g. Preferred locality)"
          placeholderTextColor={colors.textSubtle}
        />
        <View style={styles.reorder}>
          <TouchableOpacity onPress={() => onMove(-1)} disabled={index === 0} hitSlop={6}>
            <ArrowUp size={18} color={index === 0 ? colors.textSubtle : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onMove(1)} disabled={index === count - 1} hitSlop={6}>
            <ArrowDown size={18} color={index === count - 1 ? colors.textSubtle : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={6}>
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.miniLabel}>TYPE</Text>
      <View style={styles.chipRow}>
        {FIELD_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => onPatch({ type: t })}
            style={[styles.typeChip, field.type === t && styles.typeChipOn]}
          >
            <Text style={[styles.typeChipText, field.type === t && styles.typeChipTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isSelect ? (
        <>
          <Text style={styles.miniLabel}>OPTIONS (comma-separated)</Text>
          <TextInput
            style={styles.optionsInput}
            value={(field.options || []).join(', ')}
            onChangeText={(t) =>
              onPatch({ options: t.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="e.g. Furnished, Semi, Unfurnished"
            placeholderTextColor={colors.textSubtle}
          />
        </>
      ) : null}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Required</Text>
        <Switch
          value={!!field.required}
          onValueChange={(v) => onPatch({ required: v })}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <View style={styles.toggleRow}>
        <View style={styles.flex1}>
          <Text style={styles.toggleLabel}>Fill from voice (AI)</Text>
          <Text style={styles.toggleHint}>Let voice notes populate this field</Text>
        </View>
        <Switch
          value={field.aiExtract !== false}
          onValueChange={(v) => onPatch({ aiExtract: v })}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {field.aiExtract !== false ? (
        <TextInput
          style={styles.hintInput}
          value={field.aiHint ?? ''}
          onChangeText={(t) => onPatch({ aiHint: t })}
          placeholder="AI hint (optional) — how to recognise this in speech"
          placeholderTextColor={colors.textSubtle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextOn: { color: colors.primary },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...typography.caption, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
  empty: { ...typography.caption, textAlign: 'center', marginVertical: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  reorder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  miniLabel: { ...typography.overline, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typeChipOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'capitalize' },
  typeChipTextOn: { color: colors.primary },

  optionsInput: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: spacing.xs,
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  hintInput: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: spacing.sm,
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  flex1: { flex: 1 },
  toggleLabel: { ...typography.bodyStrong, fontSize: 14.5 },
  toggleHint: { ...typography.caption, marginTop: 1 },

  add: { marginTop: spacing.sm },
  save: { marginTop: spacing.md },
});
