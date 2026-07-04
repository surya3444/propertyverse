import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Mic, Square, Sparkles, Building2, IndianRupee, MapPin, Bed, ListChecks, FileText, Images, Paperclip, Plus, X } from 'lucide-react-native';
import * as recorder from '../../lib/audioRecorder';
import { Waveform } from '../../components/AudioViz';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LocationPicker } from '../../components/LocationPicker';
import { ContactPicker, PickedContact } from '../../components/ContactPicker';
import { CustomFieldsEditor } from '../../components/CustomFieldsEditor';
import { propertiesApi } from '../../api/properties';
import { uploadsApi } from '../../api/uploads';
import { pickFiles, filePickerSupported } from '../../lib/filePicker';
import { Contact, CustomFieldValues, Furnishing, ListingType, PROPERTY_TYPES, PropertyMedia, PropertyType, SelectedLocation } from '../../types';
import { colors, radius, shadow, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { playCue } from '../../lib/sound';
import { RootScreenProps } from '../../navigation/types';

const TYPES: PropertyType[] = PROPERTY_TYPES;
const FURNISHINGS: Furnishing[] = ['Unfurnished', 'Semi-furnished', 'Furnished'];
const FACINGS = ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
const AMENITIES = ['Lift', 'Parking', 'Power Backup', 'Security', 'Gym', 'Swimming Pool', 'Club House', 'Garden', 'Play Area', '24x7 Water'];
type VoiceState = 'idle' | 'recording' | 'processing';

export function PropertyFormScreen({ navigation, route }: RootScreenProps<'PropertyForm'>) {
  const propertyId = route.params?.propertyId;
  const isEdit = Boolean(propertyId);

  const [title, setTitle] = useState('');
  const [listingType, setListingType] = useState<ListingType>('Sale');
  const [price, setPrice] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('Apartment');
  const [owner, setOwner] = useState<PickedContact | null>(null);
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [existingLocationText, setExistingLocationText] = useState('');
  const [locationSeed, setLocationSeed] = useState<string | undefined>();
  const [openLocation, setOpenLocation] = useState(0);
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqFt, setAreaSqFt] = useState('');
  const [furnishing, setFurnishing] = useState<Furnishing | undefined>();
  const [floor, setFloor] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [facing, setFacing] = useState<string | undefined>();
  const [amenities, setAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<PropertyMedia[]>([]);
  const [documents, setDocuments] = useState<PropertyMedia[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [elapsed, setElapsed] = useState('00:00');
  const isRecording = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Property' : 'Add Property' });
  }, [navigation, isEdit]);

  useEffect(() => () => { if (isRecording.current) recorder.cancelRecording(); }, []);

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      try {
        const { property } = await propertiesApi.get(propertyId);
        setTitle(property.title);
        setListingType(property.listingType ?? 'Sale');
        setPrice(String(property.price ?? ''));
        setMonthlyRent(property.monthlyRent?.toString() ?? '');
        setDeposit(property.deposit?.toString() ?? '');
        setPropertyType(property.propertyType);
        const o = property.ownerId;
        if (o && typeof o === 'object') setOwner({ _id: (o as Contact)._id, name: (o as Contact).name, phone: (o as Contact).phone });
        setExistingLocationText(property.location);
        if (property.geo?.coordinates) {
          const [lng, lat] = property.geo.coordinates;
          setLocation({ label: property.geo.label || property.location, lat, lng, placeId: property.geo.placeId });
        } else setLocationSeed(property.location);
        setBedrooms(property.features?.bedrooms?.toString() ?? '');
        setBathrooms(property.features?.bathrooms?.toString() ?? '');
        setAreaSqFt(property.features?.areaSqFt?.toString() ?? '');
        setFurnishing(property.furnishing);
        setFloor(property.floor?.toString() ?? '');
        setTotalFloors(property.totalFloors?.toString() ?? '');
        setFacing(property.facing);
        setAmenities(property.amenities ?? []);
        setDescription(property.description ?? '');
        setImages(property.images ?? []);
        setDocuments(property.documents ?? []);
        setIsAvailable(property.isAvailable);
        setCustomFields(property.customFields ?? {});
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Could not load property.');
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId]);

  const startVoice = useCallback(async () => {
    const ok = await recorder.requestPermission();
    if (!ok) { Alert.alert('Permission needed', 'Microphone access is required.'); return; }
    try {
      await recorder.startRecording((ms) => setElapsed(recorder.formatElapsed(ms)));
      isRecording.current = true;
      setVoiceState('recording');
      haptic('medium');
      playCue('start');
    } catch { Alert.alert('Recording error', 'Could not start recording.'); }
  }, []);

  const stopVoice = useCallback(async () => {
    setVoiceState('processing');
    haptic('success');
    playCue('stop');
    try {
      const rec = await recorder.stopRecording();
      isRecording.current = false;
      const { draft } = await propertiesApi.draftFromVoice(rec);
      if (draft.title) setTitle(draft.title);
      // Sale vs rent: honour what the agent said and route the amount to the
      // right field. Fall back to the currently selected listing type.
      const listing = draft.listingType === 'Rent' || draft.listingType === 'Sale' ? draft.listingType : listingType;
      if (draft.listingType) setListingType(draft.listingType);
      if (draft.price != null) {
        if (listing === 'Rent') setMonthlyRent(String(draft.price));
        else setPrice(String(draft.price));
      }
      if (draft.deposit != null && listing === 'Rent') setDeposit(String(draft.deposit));
      if (draft.propertyType && TYPES.includes(draft.propertyType)) setPropertyType(draft.propertyType);
      if (draft.bedrooms != null) setBedrooms(String(draft.bedrooms));
      if (draft.bathrooms != null) setBathrooms(String(draft.bathrooms));
      if (draft.areaSqFt != null) setAreaSqFt(String(draft.areaSqFt));
      if (draft.location) { setLocationSeed(draft.location); setOpenLocation((n) => n + 1); }
      // Merge any AI-filled custom fields over the current values.
      if (draft.customFields && typeof draft.customFields === 'object') {
        setCustomFields((prev) => ({ ...prev, ...draft.customFields }));
      }
    } catch (err: any) {
      Alert.alert('Voice error', err.message ?? 'Could not process the recording.');
    } finally {
      setElapsed('00:00');
      setVoiceState('idle');
    }
  }, [listingType]);

  const toggleAmenity = (a: string) => {
    haptic('selection');
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const addMedia = useCallback(
    async (kind: 'image' | 'document') => {
      if (!filePickerSupported) {
        Alert.alert('Use the web app', 'Uploading photos and documents currently works in the PropertyVerse web app.');
        return;
      }
      const accept = kind === 'image' ? 'image/*' : 'application/pdf,.doc,.docx,.xls,.xlsx,image/*';
      const setBusy = kind === 'image' ? setUploadingImages : setUploadingDocs;
      try {
        const files = await pickFiles({ accept, multiple: true });
        if (!files.length) return;
        setBusy(true);
        haptic('light');
        const { media } = await uploadsApi.upload(files, kind);
        if (kind === 'image') setImages((prev) => [...prev, ...media]);
        else setDocuments((prev) => [...prev, ...media]);
        haptic('success');
      } catch (err: any) {
        haptic('error');
        Alert.alert('Upload failed', err.message ?? 'Could not upload. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const removeImage = (i: number) => { haptic('light'); setImages((prev) => prev.filter((_, idx) => idx !== i)); };
  const removeDoc = (i: number) => { haptic('light'); setDocuments((prev) => prev.filter((_, idx) => idx !== i)); };

  const save = async () => {
    const locationText = location?.label ?? existingLocationText;
    const priceValue = listingType === 'Rent' ? Number(monthlyRent || 0) : Number(price);
    if (!title.trim() || !locationText.trim() || (listingType === 'Sale' && !price.trim()) || (listingType === 'Rent' && !monthlyRent.trim())) {
      Alert.alert('Missing fields', 'Title, price/rent and location are required.');
      return;
    }
    const payload: Record<string, unknown> = {
      title: title.trim(),
      listingType,
      price: priceValue,
      propertyType,
      location: locationText.trim(),
      furnishing,
      floor: floor ? Number(floor) : undefined,
      totalFloors: totalFloors ? Number(totalFloors) : undefined,
      facing,
      amenities,
      images,
      documents,
      description: description.trim() || undefined,
      features: {
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqFt: areaSqFt ? Number(areaSqFt) : undefined,
      },
      isAvailable,
      customFields,
    };
    if (listingType === 'Rent') {
      payload.monthlyRent = Number(monthlyRent);
      payload.deposit = deposit ? Number(deposit) : undefined;
    }
    if (owner) payload.ownerId = owner._id;
    if (location) payload.geo = { lat: location.lat, lng: location.lng, label: location.label, placeId: location.placeId };

    setSaving(true);
    try {
      if (isEdit && propertyId) await propertiesApi.update(propertyId, payload);
      else await propertiesApi.create(payload);
      haptic('success');
      navigation.goBack();
    } catch (err: any) {
      haptic('error');
      Alert.alert('Save failed', err.message ?? 'Could not save property.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen><Text style={styles.muted}>Loading…</Text></Screen>;

  const recording = voiceState === 'recording';
  const processing = voiceState === 'processing';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Voice fill */}
        <Pressable onPress={recording ? stopVoice : startVoice} disabled={processing} style={[styles.voiceCard, recording && styles.voiceCardActive]}>
          <View style={[styles.voiceIcon, recording && styles.voiceIconActive]}>
            {processing ? <ActivityIndicator color={colors.primary} /> : recording ? <Square size={20} color={colors.white} fill={colors.white} /> : <Mic size={22} color={colors.primary} strokeWidth={2.2} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceTitle}>{processing ? 'Structuring your listing…' : recording ? `Recording…  ${elapsed}` : 'Fill with voice'}</Text>
            {recording ? (
              <Waveform active bars={18} height={22} color={colors.primary} align="flex-start" />
            ) : (
              <Text style={styles.voiceDesc}>{'Describe the property — type, price, size and area'}</Text>
            )}
          </View>
          {!recording && !processing ? <Sparkles size={18} color={colors.accent} /> : null}
        </Pressable>

        {/* Photos */}
        <Section icon={Images} title="Photos">
          <View style={styles.photoGrid}>
            {images.map((img, i) => (
              <View key={img.publicId ?? img.url ?? i} style={styles.photoTile}>
                <Image source={{ uri: img.url }} style={styles.photo} resizeMode="cover" />
                {i === 0 ? (
                  <View style={styles.coverBadge}><Text style={styles.coverText}>Cover</Text></View>
                ) : null}
                <Pressable onPress={() => removeImage(i)} style={styles.removeBadge} hitSlop={6}>
                  <X size={13} color={colors.white} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => addMedia('image')} disabled={uploadingImages} style={styles.addTile}>
              {uploadingImages ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Plus size={22} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.addTileText}>Add</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={styles.mediaHint}>
            {images.length ? 'The first photo is used as the cover.' : 'Add photos buyers will see first.'}
          </Text>
        </Section>

        {/* Basics */}
        <Section icon={Building2} title="Basics">
          <Text style={styles.label}>Listing</Text>
          <View style={styles.segment}>
            {(['Sale', 'Rent'] as ListingType[]).map((t) => (
              <Pressable key={t} onPress={() => { haptic('selection'); setListingType(t); }} style={[styles.segmentBtn, listingType === t && styles.segmentActive]}>
                <Text style={[styles.segmentText, listingType === t && styles.segmentTextActive]}>For {t}</Text>
              </Pressable>
            ))}
          </View>

          <Input label="Title *" value={title} onChangeText={setTitle} placeholder="3BHK Villa near Metro" />

          <Text style={styles.label}>Property type</Text>
          <View style={styles.chipWrap}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => { haptic('selection'); setPropertyType(t); }} style={[styles.chip, propertyType === t && styles.chipActive]}>
                <Text style={[styles.chipText, propertyType === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Pricing */}
        <Section icon={IndianRupee} title="Pricing">
          {listingType === 'Sale' ? (
            <Input label="Price *" value={price} onChangeText={setPrice} placeholder="12000000" keyboardType="numeric" />
          ) : (
            <View style={styles.row2}>
              <View style={styles.col}><Input label="Monthly rent *" value={monthlyRent} onChangeText={setMonthlyRent} placeholder="35000" keyboardType="numeric" /></View>
              <View style={styles.col}><Input label="Deposit" value={deposit} onChangeText={setDeposit} placeholder="100000" keyboardType="numeric" /></View>
            </View>
          )}
        </Section>

        {/* Owner & location */}
        <Section icon={MapPin} title="Owner & location">
          <ContactPicker label="Owner" value={owner} onChange={setOwner} placeholder="Link or add the owner" />
          <LocationPicker label="Location *" value={location} onChange={setLocation} initialQuery={locationSeed} openSignal={openLocation} placeholder={existingLocationText || 'Search for an area'} />
        </Section>

        {/* Configuration */}
        <Section icon={Bed} title="Configuration">
          <View style={styles.row3}>
            <View style={styles.col}><Input label="Beds" value={bedrooms} onChangeText={setBedrooms} keyboardType="numeric" placeholder="3" /></View>
            <View style={styles.col}><Input label="Baths" value={bathrooms} onChangeText={setBathrooms} keyboardType="numeric" placeholder="2" /></View>
            <View style={styles.col}><Input label="Area ft²" value={areaSqFt} onChangeText={setAreaSqFt} keyboardType="numeric" placeholder="1200" /></View>
          </View>

          <Text style={styles.label}>Furnishing</Text>
          <View style={styles.chipWrap}>
            {FURNISHINGS.map((f) => (
              <Pressable key={f} onPress={() => { haptic('selection'); setFurnishing(furnishing === f ? undefined : f); }} style={[styles.chip, furnishing === f && styles.chipActive]}>
                <Text style={[styles.chipText, furnishing === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row3}>
            <View style={styles.col}><Input label="Floor" value={floor} onChangeText={setFloor} keyboardType="numeric" placeholder="3" /></View>
            <View style={styles.col}><Input label="Of total" value={totalFloors} onChangeText={setTotalFloors} keyboardType="numeric" placeholder="12" /></View>
            <View style={styles.col} />
          </View>

          <Text style={styles.label}>Facing</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facingRow}>
            {FACINGS.map((f) => (
              <Pressable key={f} onPress={() => { haptic('selection'); setFacing(facing === f ? undefined : f); }} style={[styles.chip, facing === f && styles.chipActive]}>
                <Text style={[styles.chipText, facing === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        {/* Amenities */}
        <Section icon={ListChecks} title="Amenities">
          <View style={[styles.chipWrap, styles.noBottom]}>
            {AMENITIES.map((a) => {
              const on = amenities.includes(a);
              return (
                <Pressable key={a} onPress={() => toggleAmenity(a)} style={[styles.chip, on && styles.chipActive]}>
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Documents */}
        <Section icon={Paperclip} title="Documents">
          {documents.map((doc, i) => (
            <View key={doc.publicId ?? doc.url ?? i} style={styles.docRow}>
              <View style={styles.docIcon}><FileText size={16} color={colors.primary} strokeWidth={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName} numberOfLines={1}>{doc.name ?? 'Document'}</Text>
                {doc.bytes ? <Text style={styles.docMeta}>{formatBytes(doc.bytes)}</Text> : null}
              </View>
              <Pressable onPress={() => removeDoc(i)} hitSlop={8} style={styles.docRemove}>
                <X size={15} color={colors.textMuted} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => addMedia('document')} disabled={uploadingDocs} style={styles.addDocBtn}>
            {uploadingDocs ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Plus size={18} color={colors.primary} strokeWidth={2.4} />
                <Text style={styles.addDocText}>Add document (floor plan, agreement…)</Text>
              </>
            )}
          </Pressable>
        </Section>

        {/* Agent-defined custom fields (renders nothing if none configured). */}
        <CustomFieldsSection entityType="property" values={customFields} onChange={setCustomFields} />

        {/* Description & availability */}
        <Section icon={FileText} title="Description & status">
          <Input value={description} onChangeText={setDescription} placeholder="Highlights, nearby landmarks, condition…" multiline />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Available to show</Text>
              <Text style={styles.switchHint}>Only available listings appear in lead matches</Text>
            </View>
            <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ true: colors.primary }} />
          </View>
        </Section>

        <Button title={isEdit ? 'Save changes' : 'Add property'} onPress={save} loading={saving} style={styles.saveBtn} />
      </ScrollView>
    </Screen>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Wraps the shared CustomFieldsEditor in a titled Section, but renders nothing
// until we know the agent actually has custom fields for this entity type (so no
// empty "More details" header appears).
function CustomFieldsSection({
  entityType,
  values,
  onChange,
}: {
  entityType: 'property' | 'lead' | 'contact';
  values: CustomFieldValues;
  onChange: (v: CustomFieldValues) => void;
}) {
  const [hasFields, setHasFields] = useState(false);
  return (
    <View style={hasFields ? undefined : styles.hidden}>
      <Section icon={ListChecks} title="More details">
        <CustomFieldsEditor
          entityType={entityType}
          values={values}
          onChange={onChange}
          onSchemaLoaded={(fields) => setHasFields(fields.length > 0)}
        />
      </Section>
    </View>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}><Icon size={16} color={colors.primary} strokeWidth={2.4} /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },

  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, marginLeft: 2 },
  sectionIcon: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.h3, fontSize: 16.5 },
  sectionBody: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.sm },
  noBottom: { marginBottom: 0 },
  saveBtn: { marginTop: spacing.sm },

  voiceCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primaryTint, padding: spacing.md, marginBottom: spacing.lg, ...shadow.sm },
  voiceCardActive: { borderColor: colors.primary },
  voiceIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  voiceIconActive: { backgroundColor: colors.primary },
  voiceTitle: { ...typography.bodyStrong, fontSize: 16 },
  voiceDesc: { ...typography.caption, marginTop: 1 },

  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, ...shadow.sm },
  segmentText: { fontWeight: '700', color: colors.textMuted },
  segmentTextActive: { color: colors.primary },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  facingRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13.5 },
  chipTextActive: { color: colors.white },

  row2: { flexDirection: 'row', gap: spacing.sm },
  row3: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  photo: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  coverText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  removeBadge: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addTile: { width: 84, height: 84, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addTileText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  mediaHint: { fontSize: 12.5, color: colors.textMuted, marginTop: spacing.sm, marginLeft: 2 },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  docIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  docMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  docRemove: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  addDocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, marginTop: spacing.xs },
  addDocText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs },
  switchLabel: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  switchHint: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 14, color: colors.textMuted },
  hidden: { display: 'none' },
});
