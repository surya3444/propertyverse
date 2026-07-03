import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, UserPlus, Users, ChevronRight, Phone } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonList } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { FilterChips } from '../../components/FilterChips';
import { EmptyState } from '../../components/EmptyState';
import { contactsApi } from '../../api/contacts';
import { Contact, ContactRole } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { TabScreenProps } from '../../navigation/types';

type RoleFilter = 'All' | ContactRole;
const FILTERS = [
  { label: 'All', value: 'All' as const },
  { label: 'Owners', value: 'Owner' as const },
  { label: 'Buyers', value: 'Buyer' as const },
  { label: 'Tenants', value: 'Tenant' as const },
];

const roleTone: Record<ContactRole, 'primary' | 'accent' | 'success' | 'warning'> = {
  Owner: 'primary',
  Buyer: 'accent',
  Tenant: 'success',
  Seller: 'warning',
};

export function ContactsListScreen({ navigation }: TabScreenProps<'ContactsTab'>) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [role, setRole] = useState<RoleFilter>('All');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactsApi.list({
        role: role === 'All' ? undefined : role,
        q: q.trim() || undefined,
      });
      setContacts(res.contacts);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [role, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.h1}>Contacts</Text>
        <Pressable
          onPress={() => { haptic('light'); navigation.navigate('ContactForm'); }}
          style={styles.addBtn}
        >
          <UserPlus size={20} color={colors.white} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <Search size={18} color={colors.textSubtle} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            returnKeyType="search"
            placeholder="Search by name or phone"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
          />
        </View>
        <FilterChips options={FILTERS} value={role} onChange={setRole} style={styles.chips} />
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={6} />
          ) : (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Owners and clients you add or capture will appear here."
              actionLabel="Add contact"
              onAction={() => navigation.navigate('ContactForm')}
            />
          )
        }
        renderItem={({ item }) => (
          <Card variant="elevated" style={styles.card} onPress={() => { haptic('light'); navigation.navigate('ContactDetail', { contactId: item._id }); }}>
            <View style={styles.row}>
              <Avatar name={item.name} size={46} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={styles.metaRow}>
                  {item.phone ? (
                    <View style={styles.phoneRow}>
                      <Phone size={12} color={colors.textMuted} strokeWidth={2.2} />
                      <Text style={styles.phone}>{item.phone}</Text>
                    </View>
                  ) : <Text style={styles.phone}>No phone</Text>}
                </View>
                {item.roles?.length ? (
                  <View style={styles.badges}>
                    {item.roles.map((r) => <Badge key={r} label={r} tone={roleTone[r]} />)}
                  </View>
                ) : null}
              </View>
              <ChevronRight size={20} color={colors.textSubtle} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  h1: { ...typography.h1 },
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: spacing.lg, paddingtop: spacing.sm },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%', ...(({ outlineStyle: 'none' } as unknown) as object) },
  chips: { marginTop: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  card: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 3 },
  name: { ...typography.h3, fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phone: { ...typography.caption, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
