import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Building2, Check, MapPin, Search, X } from 'lucide-react-native';
import { propertiesApi } from '../api/properties';
import { Property } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
import { haptic } from '../lib/haptics';

export interface PickedProperty {
  _id: string;
  title: string;
  location?: string;
  price?: number;
  listingType?: string;
  monthlyRent?: number;
}

interface Props {
  label?: string;
  value: PickedProperty | null;
  onChange: (property: PickedProperty | null) => void;
  placeholder?: string;
}

function priceLabel(p: PickedProperty | Property) {
  if (p.listingType === 'Rent') return `${formatCurrency(p.monthlyRent)}/mo`;
  return formatCurrency(p.price);
}

// A field that opens a sheet to search the agent's inventory and attach a
// specific property (e.g. the one being shown on a site visit). Clearable.
export function PropertyPicker({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await propertiesApi.list({ q: query.trim() || undefined });
        setResults(res.properties);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query, open]);

  const select = (p: Property) => {
    haptic('selection');
    onChange({ _id: p._id, title: p.title, location: p.location, price: p.price, listingType: p.listingType, monthlyRent: p.monthlyRent });
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldRow}>
        <Pressable onPress={() => { setQuery(''); setResults([]); setOpen(true); }} style={styles.field}>
          <View style={[styles.leadingIcon, value && styles.leadingIconActive]}>
            <Building2 size={18} color={value ? colors.primary : colors.textSubtle} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
              {value ? value.title : placeholder ?? 'Attach a property'}
            </Text>
            {value ? (
              <Text style={styles.fieldSub} numberOfLines={1}>
                {priceLabel(value)}{value.location ? ` · ${value.location}` : ''}
              </Text>
            ) : null}
          </View>
          {value ? <Check size={18} color={colors.success} strokeWidth={2.4} /> : null}
        </Pressable>
        {value ? (
          <Pressable onPress={() => { haptic('light'); onChange(null); }} hitSlop={10} style={styles.clearBtn}>
            <X size={16} color={colors.textMuted} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Attach property</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}><X size={22} color={colors.textMuted} /></Pressable>
            </View>

            <View style={styles.searchField}>
              <Search size={18} color={colors.textSubtle} />
              <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search by title or area" placeholderTextColor={colors.textSubtle} style={styles.searchInput} />
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            <FlatList
              data={results}
              keyExtractor={(i) => i._id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                loading ? null : (
                  <Text style={styles.empty}>{query ? 'No properties match.' : 'No properties yet — add one first.'}</Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable style={({ pressed }) => [styles.result, pressed && styles.resultPressed]} onPress={() => select(item)}>
                  <View style={styles.thumb}><Building2 size={20} color={colors.primary} strokeWidth={2.2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.resultMeta}>
                      <MapPin size={12} color={colors.textSubtle} strokeWidth={2.2} />
                      <Text style={styles.resultSub} numberOfLines={1}>{item.propertyType} · {item.location}</Text>
                    </View>
                  </View>
                  <Text style={styles.resultPrice}>{priceLabel(item)}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingRight: spacing.md, minHeight: 58, paddingVertical: 8 },
  leadingIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  leadingIconActive: { backgroundColor: colors.primaryTint },
  fieldText: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  fieldSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  placeholder: { color: colors.textSubtle, fontWeight: '400', fontSize: 16 },
  clearBtn: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,14,10,0.4)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm, maxHeight: '82%', minHeight: '50%', ...(({ width: '100%', maxWidth: 520, alignSelf: 'center' } as unknown) as object) },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2 },

  searchField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%', ...(({ outlineStyle: 'none' } as unknown) as object) },

  list: { marginTop: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg, fontSize: 14 },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  resultPressed: { backgroundColor: colors.surfaceAlt },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { ...typography.bodyStrong, fontSize: 15.5 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  resultSub: { ...typography.caption, fontSize: 12.5, flexShrink: 1 },
  resultPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
});
