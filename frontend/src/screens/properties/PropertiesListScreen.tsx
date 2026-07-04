import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Building2, BedDouble, Maximize, MapPin } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonPropertyList } from '../../components/Skeleton';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { FilterChips } from '../../components/FilterChips';
import { EmptyState } from '../../components/EmptyState';
import { propertiesApi } from '../../api/properties';
import { Property } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { haptic } from '../../lib/haptics';
import { TabScreenProps } from '../../navigation/types';

const FILTERS = [
  { label: 'All', value: 'All' as const },
  { label: 'For Sale', value: 'Sale' as const },
  { label: 'For Rent', value: 'Rent' as const },
];

export function PropertiesListScreen({ navigation }: TabScreenProps<'PropertiesTab'>) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState<'All' | 'Sale' | 'Rent'>('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await propertiesApi.list();
      setProperties(res.properties);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = properties.filter((p) => filter === 'All' || (p.listingType ?? 'Sale') === filter);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.h1}>Properties</Text>
        <Pressable onPress={() => { haptic('light'); navigation.navigate('PropertyForm'); }} style={styles.addBtn}>
          <Plus size={20} color={colors.white} strokeWidth={2.6} />
        </Pressable>
      </View>
      <View style={styles.chipsWrap}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <SkeletonPropertyList count={5} />
          ) : (
            <EmptyState
              icon={Building2}
              title="No properties yet"
              description="Add your first listing — by voice or by hand — to start matching leads."
              actionLabel="Add property"
              onAction={() => navigation.navigate('PropertyForm')}
            />
          )
        }
        renderItem={({ item }) => {
          const isRent = item.listingType === 'Rent';
          return (
            <Card variant="elevated" style={styles.card} onPress={() => { haptic('light'); navigation.navigate('PropertyDetail', { propertyId: item._id }); }}>
              <View style={styles.cardTop}>
                {item.images?.[0]?.url ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <View style={styles.thumb}><Building2 size={22} color={colors.primary} strokeWidth={2} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    {item.source === 'form' ? <Badge label="Form" tone="accent" /> : null}
                    <Badge label={isRent ? 'Rent' : 'Sale'} tone={isRent ? 'accent' : 'primary'} />
                  </View>
                  <Text style={styles.price}>{isRent ? `${formatCurrency(item.monthlyRent)}/mo` : formatCurrency(item.price)}</Text>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color={colors.textMuted} strokeWidth={2.2} />
                    <Text style={styles.meta} numberOfLines={1}>{item.propertyType} · {item.location}</Text>
                  </View>
                </View>
              </View>
              {(item.features?.bedrooms != null || item.features?.areaSqFt != null || !item.isAvailable) ? (
                <View style={styles.featRow}>
                  {item.features?.bedrooms != null ? (
                    <View style={styles.feat}><BedDouble size={14} color={colors.textMuted} strokeWidth={2.2} /><Text style={styles.featText}>{item.features.bedrooms} BHK</Text></View>
                  ) : null}
                  {item.features?.areaSqFt != null ? (
                    <View style={styles.feat}><Maximize size={14} color={colors.textMuted} strokeWidth={2.2} /><Text style={styles.featText}>{item.features.areaSqFt} ft²</Text></View>
                  ) : null}
                  {!item.isAvailable ? <Badge label="Sold/Rented" tone="muted" /> : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  h1: { ...typography.h1 },
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  card: { padding: spacing.md },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.h3, fontSize: 16, flex: 1 },
  price: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { ...typography.caption, flex: 1 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  featText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
