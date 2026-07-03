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
import { MapPin, Search, X, Check } from 'lucide-react-native';
import { locationsApi, newSessionToken } from '../api/locations';
import { ApiError } from '../api/client';
import { PlaceCandidate, SelectedLocation } from '../types';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  label?: string;
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation) => void;
  placeholder?: string;
  /** Prefill the search when the picker opens (e.g. a spoken location). */
  initialQuery?: string;
  error?: boolean;
  /** Bump this number to programmatically open the picker (e.g. after a voice draft). */
  openSignal?: number;
}

// A field that opens a searchable list of real-world locations. The user types
// (or arrives from a voice transcript), sees the ambiguous matches, and picks
// the exact one — which resolves to coordinates for geofencing.
export function LocationPicker({
  label,
  value,
  onChange,
  placeholder,
  initialQuery,
  error,
  openSignal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const sessionToken = useRef(newSessionToken());

  const openModal = () => {
    sessionToken.current = newSessionToken();
    setQuery(initialQuery ?? '');
    setResults([]);
    setMessage(null);
    setOpen(true);
  };

  useEffect(() => {
    if (openSignal) openModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // Debounced autocomplete while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setMessage(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { results: found } = await locationsApi.autocomplete(q, sessionToken.current);
        setResults(found);
        setMessage(found.length ? null : 'No matching places.');
      } catch (err) {
        setResults([]);
        setMessage(
          err instanceof ApiError && err.status === 503
            ? "Location search isn't set up yet. Add a Google Maps key on the server."
            : (err as Error).message ?? 'Search failed.'
        );
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, open]);

  const pick = async (candidate: PlaceCandidate) => {
    setResolving(candidate.placeId);
    try {
      const { place } = await locationsApi.details(candidate.placeId, sessionToken.current);
      onChange(place);
      setOpen(false);
    } catch (err) {
      setMessage((err as Error).message ?? 'Could not resolve that place.');
    } finally {
      setResolving(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable onPress={openModal} style={[styles.field, error && styles.fieldError]}>
        <MapPin size={18} color={value ? colors.primary : colors.textSubtle} strokeWidth={2} />
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value?.label ?? placeholder ?? 'Search for a location'}
        </Text>
        {value ? <Check size={18} color={colors.success} strokeWidth={2.4} /> : null}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose location</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <X size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>
              Many areas share a name — pick the exact one so we can match nearby properties.
            </Text>

            <View style={styles.searchField}>
              <Search size={18} color={colors.textSubtle} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. Gandhi Nagar"
                placeholderTextColor={colors.textSubtle}
                style={styles.searchInput}
              />
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <FlatList
              data={results}
              keyExtractor={(i) => i.placeId}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
                  onPress={() => pick(item)}
                  disabled={!!resolving}
                >
                  <View style={styles.pinTile}>
                    <MapPin size={18} color={colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.resultText}>
                    <Text style={styles.resultPrimary}>{item.primary}</Text>
                    {item.secondary ? (
                      <Text style={styles.resultSecondary} numberOfLines={1}>
                        {item.secondary}
                      </Text>
                    ) : null}
                  </View>
                  {resolving === item.placeId ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  fieldText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textSubtle },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,14,10,0.4)' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '82%',
    minHeight: '55%',
    ...(({ width: '100%', maxWidth: 520, alignSelf: 'center' } as unknown) as object),
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...typography.h2 },
  sheetHint: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.md },

  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  message: { ...typography.caption, marginTop: spacing.md, marginLeft: 2 },

  list: { marginTop: spacing.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultPressed: { backgroundColor: colors.surfaceAlt },
  pinTile: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1 },
  resultPrimary: { ...typography.bodyStrong, fontSize: 15.5 },
  resultSecondary: { ...typography.caption, marginTop: 1 },
});
