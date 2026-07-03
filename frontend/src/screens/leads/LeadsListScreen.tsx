import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Mic } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonList } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { leadsApi } from '../../api/leads';
import { Lead } from '../../types';
import { colors, spacing } from '../../theme';
import { displayName, formatCurrency, statusTone } from '../../utils/format';
import { RootScreenProps } from '../../navigation/types';

export function LeadsListScreen({ navigation }: RootScreenProps<'LeadsList'>) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await leadsApi.list();
      setLeads(res.leads);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={leads}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={6} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No leads yet</Text>
              <Text style={styles.emptyDesc}>
                {error ?? 'Record a voice note to capture your first client.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('LeadDetail', { leadId: item._id })}>
            <View style={styles.row}>
              <Text style={styles.name}>{displayName(item.clientName)}</Text>
              <View style={styles.badges}>
                {item.source === 'form' ? <Badge label="Form" tone="accent" /> : null}
                <Badge label={item.status} tone={statusTone(item.status)} />
              </View>
            </View>
            <Text style={styles.phone}>{item.phoneNumber}</Text>
            <Text style={styles.meta}>
              {item.requirements?.propertyType ?? 'Any'} ·{' '}
              {item.requirements?.location ?? 'Any location'} ·{' '}
              {formatCurrency(item.requirements?.budgetMax)}
            </Text>
          </Card>
        )}
      />
      <View style={styles.footer}>
        <Button title="Record New Lead" icon={Mic} onPress={() => navigation.navigate('RecordLead')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  phone: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
