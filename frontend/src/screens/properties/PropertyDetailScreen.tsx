import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, MapPin, BedDouble, Bath, Maximize, Compass, Building, CalendarPlus, ChevronRight, User as UserIcon, FileText, ImageOff, Download } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { SkeletonPropertyDetail } from '../../components/Skeleton';
import { CustomFieldsDisplay } from '../../components/CustomFieldsEditor';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { SectionHeader } from '../../components/SectionHeader';
import { propertiesApi } from '../../api/properties';
import { Contact, Lead, Property } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

export function PropertyDetailScreen({ navigation, route }: RootScreenProps<'PropertyDetail'>) {
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    try {
      const [{ property: p }, m] = await Promise.all([
        propertiesApi.get(propertyId),
        propertiesApi.matchingLeads(propertyId).catch(() => ({ leads: [] as Lead[] })),
      ]);
      setProperty(p);
      setLeads(m.leads);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => { haptic('light'); navigation.navigate('PropertyForm', { propertyId }); }} hitSlop={10}>
          <Pencil size={20} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
      ),
    });
  }, [navigation, propertyId]);

  if (loading) return <Screen><SkeletonPropertyDetail /></Screen>;
  if (!property) return <Screen><Text style={styles.muted}>Property not found.</Text></Screen>;

  const owner = typeof property.ownerId === 'object' ? (property.ownerId as Contact) : null;
  const isRent = property.listingType === 'Rent';
  const facts = [
    property.features?.bedrooms != null && { icon: BedDouble, label: `${property.features.bedrooms} Beds` },
    property.features?.bathrooms != null && { icon: Bath, label: `${property.features.bathrooms} Baths` },
    property.features?.areaSqFt != null && { icon: Maximize, label: `${property.features.areaSqFt} ft²` },
    property.furnishing && { icon: Building, label: property.furnishing },
    property.facing && { icon: Compass, label: `${property.facing} facing` },
    property.floor != null && { icon: Building, label: `Floor ${property.floor}${property.totalFloors ? `/${property.totalFloors}` : ''}` },
  ].filter(Boolean) as { icon: any; label: string }[];

  const scheduleVisit = () =>
    navigation.navigate('ActivityForm', {
      propertyId: property._id,
      propertyTitle: property.title,
      contactId: owner?._id,
      contactName: owner?.name,
      kind: 'Visit',
    });

  const images = property.images ?? [];
  const documents = property.documents ?? [];
  const galleryW = Math.max(200, Math.round(width - spacing.lg * 2));

  const openDoc = (url?: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo gallery */}
        {images.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.gallery, { width: galleryW }]}
            snapToInterval={galleryW}
            decelerationRate="fast"
          >
            {images.map((img, i) => (
              <Image key={img.publicId ?? img.url ?? i} source={{ uri: img.url }} style={{ width: galleryW, height: 230, borderRadius: radius.lg }} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.noPhoto, { width: galleryW }]}>
            <ImageOff size={26} color={colors.textSubtle} strokeWidth={2} />
            <Text style={styles.noPhotoText}>No photos yet</Text>
          </View>
        )}
        {images.length > 1 ? <Text style={styles.galleryCount}>{images.length} photos · swipe to browse</Text> : null}

        <View style={styles.badgeRow}>
          <Badge label={isRent ? 'For Rent' : 'For Sale'} tone={isRent ? 'accent' : 'primary'} />
          <Badge label={property.status ?? (property.isAvailable ? 'Available' : 'Sold')} tone={property.isAvailable ? 'success' : 'muted'} />
          {property.source === 'form' ? <Badge label="From form" tone="primary" /> : null}
        </View>
        <Text style={styles.title}>{property.title}</Text>
        <Text style={styles.price}>
          {isRent ? `${formatCurrency(property.monthlyRent)}/mo` : formatCurrency(property.price)}
          {isRent && property.deposit ? <Text style={styles.deposit}>  ·  {formatCurrency(property.deposit)} deposit</Text> : null}
        </Text>
        <View style={styles.locRow}>
          <MapPin size={15} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={styles.loc}>{property.location}</Text>
        </View>

        {/* Facts grid */}
        {facts.length ? (
          <View style={styles.factsGrid}>
            {facts.map((f, i) => (
              <View key={i} style={styles.fact}>
                <f.icon size={16} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.factText}>{f.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {property.description ? (
          <>
            <View style={styles.section}><SectionHeader title="Description" /></View>
            <Card variant="flat"><Text style={styles.desc}>{property.description}</Text></Card>
          </>
        ) : null}

        <CustomFieldsDisplay entityType="property" values={property.customFields} title="More details" />


        {property.amenities?.length ? (
          <>
            <View style={styles.section}><SectionHeader title="Amenities" /></View>
            <View style={styles.amenities}>
              {property.amenities.map((a) => <View key={a} style={styles.amChip}><Text style={styles.amText}>{a}</Text></View>)}
            </View>
          </>
        ) : null}

        {/* Owner */}
        {owner ? (
          <>
            <View style={styles.section}><SectionHeader title="Owner" /></View>
            <Card style={styles.rowCard} onPress={() => navigation.navigate('ContactDetail', { contactId: owner._id })}>
              <View style={styles.rowInner}>
                <Avatar name={owner.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{owner.name}</Text>
                  <Text style={styles.muted}>{owner.phone || 'No phone'}</Text>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </Card>
          </>
        ) : null}

        {/* Documents */}
        {documents.length ? (
          <>
            <View style={styles.section}><SectionHeader title="Documents" /></View>
            {documents.map((doc, i) => (
              <Card key={doc.publicId ?? doc.url ?? i} style={styles.rowCard} onPress={() => openDoc(doc.url)}>
                <View style={styles.rowInner}>
                  <View style={styles.tile}><FileText size={18} color={colors.primary} strokeWidth={2.2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{doc.name ?? 'Document'}</Text>
                    <Text style={styles.muted}>Tap to open</Text>
                  </View>
                  <Download size={18} color={colors.textSubtle} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {/* Matching leads */}
        <View style={styles.section}><SectionHeader title={`Matching leads (${leads.length})`} /></View>
        {leads.length === 0 ? <Card variant="flat"><Text style={styles.muted}>No matching requirements yet.</Text></Card> :
          leads.map((l) => (
            <Card key={l._id} style={styles.rowCard} onPress={() => navigation.navigate('LeadDetail', { leadId: l._id })}>
              <View style={styles.rowInner}>
                <View style={styles.tile}><UserIcon size={18} color={colors.primary} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.clientName}</Text>
                  <Text style={styles.muted}>{formatCurrency(l.requirements?.budgetMax)} · {l.requirements?.location ?? 'Any area'}</Text>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </Card>
          ))}

        <Button title="Schedule a visit" icon={CalendarPlus} onPress={scheduleVisit} style={styles.cta} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  gallery: { borderRadius: radius.lg, marginBottom: spacing.sm },
  galleryCount: { ...typography.caption, fontSize: 12.5, marginBottom: spacing.md, marginLeft: 2 },
  noPhoto: { height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
  noPhotoText: { ...typography.caption, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.h1, fontSize: 24 },
  price: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  deposit: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  loc: { ...typography.caption, fontSize: 14 },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  factText: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  section: { marginTop: spacing.xl },
  desc: { ...typography.body, lineHeight: 21 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amChip: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  amText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
  rowCard: { padding: spacing.md, marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.bodyStrong, fontSize: 15 },
  muted: { ...typography.caption },
  cta: { marginTop: spacing.xl },
});
