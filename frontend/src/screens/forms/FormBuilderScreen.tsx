import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
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
import { Loading } from '../../components/Loading';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { formsApi } from '../../api/forms';
import { Form, FormField } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { RootScreenProps } from '../../navigation/types';

// Custom-question input types the builder can add (select is reserved for the
// mapped defaults, which need options wiring).
const CUSTOM_TYPES: FormField['type'][] = ['text', 'textarea', 'number', 'tel', 'email'];

export function FormBuilderScreen({ navigation, route }: RootScreenProps<'FormBuilder'>) {
  const { formId } = route.params;
  const [form, setForm] = useState<Form | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FormField['type']>('text');

  const load = useCallback(async () => {
    try {
      const res = await formsApi.get(formId);
      setForm(res.form);
      setTitle(res.form.title);
      setDescription(res.form.description ?? '');
      setIsActive(res.form.isActive);
      setFields([...res.form.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load form.');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const patchField = (index: number, patch: Partial<FormField>) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const move = (index: number, dir: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeField = (index: number) =>
    setFields((prev) => prev.filter((_, i) => i !== index));

  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    setFields((prev) => [
      ...prev,
      {
        key: `custom_${Date.now()}`,
        label,
        type: newType,
        required: false,
        enabled: true,
        custom: true,
        options: [],
      },
    ]);
    setNewLabel('');
    setNewType('text');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim() || form?.title,
        description: description.trim(),
        isActive,
        fields: fields.map((f, i) => ({ ...f, order: i })),
      };
      await formsApi.update(formId, payload);
      navigation.goBack();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save form.');
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Customize form' });
  }, [navigation]);

  if (loading) return <Screen><Loading label="Loading form…" /></Screen>;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Input label="Form title" value={title} onChangeText={setTitle} placeholder="Form title" />
        <Input
          label="Intro / description"
          value={description}
          onChangeText={setDescription}
          placeholder="Shown under the title on the public form"
          multiline
          style={styles.multiline}
        />

        <View style={styles.activeRow}>
          <View style={styles.flex1}>
            <Text style={styles.activeTitle}>Accepting responses</Text>
            <Text style={styles.activeDesc}>Turn off to disable the public link.</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
        </View>

        <Text style={styles.sectionLabel}>QUESTIONS</Text>
        {fields.map((field, index) => (
          <View key={field.key} style={styles.fieldCard}>
            <View style={styles.fieldTop}>
              <TextInput
                style={styles.labelInput}
                value={field.label}
                onChangeText={(t) => patchField(index, { label: t })}
                placeholder="Question label"
                placeholderTextColor={colors.textSubtle}
              />
              <View style={styles.reorder}>
                <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0} hitSlop={6}>
                  <ArrowUp size={18} color={index === 0 ? colors.textSubtle : colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(index, 1)}
                  disabled={index === fields.length - 1}
                  hitSlop={6}
                >
                  <ArrowDown
                    size={18}
                    color={index === fields.length - 1 ? colors.textSubtle : colors.textMuted}
                  />
                </TouchableOpacity>
                {field.custom ? (
                  <TouchableOpacity onPress={() => removeField(index)} hitSlop={6}>
                    <Trash2 size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <View style={styles.fieldMeta}>
              <Text style={styles.fieldType}>
                {field.type}
                {field.custom ? ' · custom' : ''}
              </Text>
              <View style={styles.toggles}>
                <Toggle
                  label="Shown"
                  value={field.enabled !== false}
                  onChange={(v) => patchField(index, { enabled: v })}
                />
                <Toggle
                  label="Required"
                  value={!!field.required}
                  onChange={(v) => patchField(index, { required: v })}
                  disabled={field.enabled === false}
                />
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.sectionLabel}>ADD A QUESTION</Text>
        <View style={styles.addCard}>
          <TextInput
            style={styles.labelInput}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="e.g. Preferred move-in date"
            placeholderTextColor={colors.textSubtle}
          />
          <View style={styles.typeRow}>
            {CUSTOM_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setNewType(t)}
                style={[styles.typeChip, newType === t && styles.typeChipOn]}
              >
                <Text style={[styles.typeChipText, newType === t && styles.typeChipTextOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Add question" icon={Plus} variant="secondary" size="md" onPress={addCustom} />
        </View>

        <Button title="Save changes" loading={saving} onPress={save} style={styles.save} />
      </ScrollView>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleOn, disabled && styles.toggleDisabled]}
      onPress={() => !disabled && onChange(!value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: 8 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  flex1: { flex: 1 },
  activeTitle: { ...typography.bodyStrong },
  activeDesc: { ...typography.caption, marginTop: 2 },
  sectionLabel: { ...typography.overline, marginTop: spacing.sm, marginBottom: spacing.sm },
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  fieldMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  fieldType: { ...typography.caption, textTransform: 'capitalize' },
  toggles: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  toggleOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  toggleDisabled: { opacity: 0.4 },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  toggleTextOn: { color: colors.primary },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.xs },
  typeChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typeChipOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  typeChipTextOn: { color: colors.primary },
  save: { marginTop: spacing.sm },
});
