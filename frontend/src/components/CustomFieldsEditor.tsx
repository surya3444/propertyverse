import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Input } from './Input';
import { customFieldsApi } from '../api/customFields';
import { CustomFieldDef, CustomFieldValues, EntityType } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { haptic } from '../lib/haptics';

interface Props {
  entityType: EntityType;
  values: CustomFieldValues;
  onChange: (values: CustomFieldValues) => void;
  // Called once the schema loads so a parent can know whether any fields exist.
  onSchemaLoaded?: (fields: CustomFieldDef[]) => void;
}

// Renders the agent's custom fields for an entity type as editable inputs. Fetches
// the schema itself so every edit screen just drops it in. Values are keyed by
// field key and merged into the record's `customFields` on save. Managed at
// Profile → Custom fields (CustomFieldsScreen).
export function CustomFieldsEditor({ entityType, values, onChange, onSchemaLoaded }: Props) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    customFieldsApi
      .get(entityType)
      .then((res) => {
        if (!active) return;
        const sorted = [...res.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setFields(sorted);
        onSchemaLoaded?.(sorted);
      })
      .catch(() => {
        /* best-effort; no custom fields shown if the schema can't load */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const set = (key: string, v: string | number | boolean | undefined) => {
    const next = { ...values };
    if (v === undefined || v === '') delete next[key];
    else next[key] = v;
    onChange(next);
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (!fields.length) return null;

  return (
    <View>
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </View>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean | undefined) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === 'boolean') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Switch
          value={value === true}
          onValueChange={(v) => onChange(v)}
          trackColor={{ true: colors.primary }}
        />
      </View>
    );
  }

  if (field.type === 'select') {
    return (
      <View style={styles.selectWrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.chipWrap}>
          {(field.options || []).map((opt) => {
            const on = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  haptic('selection');
                  onChange(on ? undefined : opt);
                }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // text / textarea / number / date → text input
  return (
    <Input
      label={label}
      value={value === undefined ? '' : String(value)}
      onChangeText={(t) => onChange(field.type === 'number' ? (t === '' ? undefined : Number(t)) : t)}
      placeholder={field.aiHint || undefined}
      multiline={field.type === 'textarea'}
      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
    />
  );
}

// Read-only display of a record's populated custom fields (detail screens).
// Fetches the schema for labels/formatting; renders nothing until there's at
// least one populated value.
export function CustomFieldsDisplay({
  entityType,
  values,
  title,
}: {
  entityType: EntityType;
  values?: CustomFieldValues;
  // When set, a small section heading renders above the rows (only if populated).
  title?: string;
}) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    let active = true;
    customFieldsApi
      .get(entityType)
      .then((res) => active && setFields(res.fields))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entityType]);

  const rows = fields
    .filter((f) => values && values[f.key] !== undefined && values[f.key] !== '')
    .map((f) => ({
      label: f.label,
      value:
        f.type === 'boolean'
          ? values![f.key] === true || values![f.key] === 'true'
            ? 'Yes'
            : 'No'
          : String(values![f.key]),
    }));

  if (!rows.length) return null;

  return (
    <View style={styles.displayWrap}>
      {title ? <Text style={styles.displayTitle}>{title}</Text> : null}
      <View style={styles.display}>
        {rows.map((r) => (
          <View key={r.label} style={styles.displayRow}>
            <Text style={styles.displayLabel}>{r.label}</Text>
            <Text style={styles.displayValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.md },
  displayWrap: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  displayTitle: { ...typography.overline, marginBottom: spacing.sm },
  display: { gap: spacing.xs },
  displayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  displayLabel: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  displayValue: { ...typography.bodyStrong, fontSize: 14.5, textAlign: 'right', flexShrink: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  selectWrap: { marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13.5 },
  chipTextOn: { color: colors.white },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  switchLabel: { ...typography.bodyStrong, fontSize: 15, flex: 1 },
});
