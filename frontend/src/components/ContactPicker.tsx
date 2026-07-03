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
import { Search, X, UserPlus, Check, User as UserIcon } from 'lucide-react-native';
import { contactsApi } from '../api/contacts';
import { Avatar } from './Avatar';
import { Contact } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { haptic } from '../lib/haptics';

export interface PickedContact {
  _id: string;
  name: string;
  phone?: string;
}

interface Props {
  label?: string;
  value: PickedContact | null;
  onChange: (contact: PickedContact) => void;
  placeholder?: string;
  error?: boolean;
}

// Field that opens a sheet to search existing contacts or create a new one.
// Always yields a persisted contact (with _id).
export function ContactPicker({ label, value, onChange, placeholder, error }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await contactsApi.list({ q: query.trim() || undefined });
        setResults(res.contacts);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query, open]);

  const openSheet = () => {
    setQuery('');
    setResults([]);
    setCreating(false);
    setNewName('');
    setNewPhone('');
    setOpen(true);
  };

  const select = (c: Contact | PickedContact) => {
    haptic('selection');
    onChange({ _id: c._id, name: c.name, phone: c.phone });
    setOpen(false);
  };

  const createNew = async () => {
    if (!newName.trim() && !newPhone.trim()) return;
    setSaving(true);
    try {
      const { contact } = await contactsApi.create({ name: newName.trim() || 'Unknown', phone: newPhone.trim() });
      select(contact);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={openSheet} style={[styles.field, error && styles.fieldError]}>
        {value ? <Avatar name={value.name} size={26} /> : <UserIcon size={18} color={colors.textSubtle} strokeWidth={2} />}
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? `${value.name}${value.phone ? ` · ${value.phone}` : ''}` : placeholder ?? 'Select a contact'}
        </Text>
        {value ? <Check size={18} color={colors.success} strokeWidth={2.4} /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{creating ? 'New contact' : 'Select contact'}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}><X size={22} color={colors.textMuted} /></Pressable>
            </View>

            {creating ? (
              <View>
                <TextInput value={newName} onChangeText={setNewName} placeholder="Full name" placeholderTextColor={colors.textSubtle} style={styles.plainInput} autoFocus />
                <TextInput value={newPhone} onChangeText={setNewPhone} placeholder="Phone" placeholderTextColor={colors.textSubtle} style={styles.plainInput} keyboardType="phone-pad" />
                <Pressable onPress={createNew} style={styles.createBtn} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.createBtnText}>Save contact</Text>}
                </Pressable>
                <Pressable onPress={() => setCreating(false)} style={styles.backLink}><Text style={styles.backLinkText}>← Back to search</Text></Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchField}>
                  <Search size={18} color={colors.textSubtle} />
                  <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search name or phone" placeholderTextColor={colors.textSubtle} style={styles.searchInput} />
                  {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </View>
                <Pressable onPress={() => setCreating(true)} style={styles.newRow}>
                  <View style={styles.newIcon}><UserPlus size={18} color={colors.primary} strokeWidth={2.2} /></View>
                  <Text style={styles.newText}>Create new contact</Text>
                </Pressable>
                <FlatList
                  data={results}
                  keyExtractor={(i) => i._id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  renderItem={({ item }) => (
                    <Pressable style={({ pressed }) => [styles.result, pressed && styles.resultPressed]} onPress={() => select(item)}>
                      <Avatar name={item.name} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        <Text style={styles.resultPhone}>{item.phone || 'No phone'}{item.roles?.length ? ` · ${item.roles.join(', ')}` : ''}</Text>
                      </View>
                    </Pressable>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 54 },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  fieldText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textSubtle },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,14,10,0.4)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm, maxHeight: '82%', minHeight: '50%', ...(({ width: '100%', maxWidth: 520, alignSelf: 'center' } as unknown) as object) },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2 },

  searchField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%', ...(({ outlineStyle: 'none' } as unknown) as object) },
  plainInput: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, fontSize: 16, color: colors.text, marginBottom: spacing.sm, ...(({ outlineStyle: 'none' } as unknown) as object) },
  createBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  createBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  backLink: { alignItems: 'center', marginTop: spacing.md },
  backLinkText: { color: colors.primary, fontWeight: '600' },

  newRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  newIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  newText: { ...typography.bodyStrong, color: colors.primary },
  list: { marginTop: spacing.xs },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  resultPressed: { backgroundColor: colors.surfaceAlt },
  resultName: { ...typography.bodyStrong, fontSize: 15.5 },
  resultPhone: { ...typography.caption, marginTop: 1 },
});
