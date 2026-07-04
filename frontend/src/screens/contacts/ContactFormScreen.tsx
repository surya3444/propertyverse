import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { User, Phone, Mail, FileText } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CallLogPicker } from '../../components/CallLogPicker';
import { CustomFieldsEditor } from '../../components/CustomFieldsEditor';
import { contactsApi } from '../../api/contacts';
import { CustomFieldValues } from '../../types';
import { colors, spacing } from '../../theme';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

export function ContactFormScreen({ navigation, route }: RootScreenProps<'ContactForm'>) {
  const contactId = route.params?.contactId;
  const isEdit = Boolean(contactId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Contact' : 'New Contact' });
  }, [navigation, isEdit]);

  useEffect(() => {
    if (!contactId) return;
    (async () => {
      try {
        const { contact } = await contactsApi.get(contactId);
        setName(contact.name);
        setPhone(contact.phone ?? '');
        setEmail(contact.email ?? '');
        setNotes(contact.notes ?? '');
        setCustomFields(contact.customFields ?? {});
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Could not load contact.');
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId]);

  // Prefill from a recent call. Phone is always taken; the name only when the
  // call carries one and the field is still empty — so edits are never clobbered
  // and an untouched prefill is kept as-is on save.
  const onPickCall = (call: { phoneNumber: string; name: string | null }) => {
    setPhone(call.phoneNumber);
    if (call.name) setName((prev) => (prev.trim() ? prev : call.name!));
  };

  const save = async () => {
    if (!name.trim() && !phone.trim()) {
      Alert.alert('Missing info', 'Enter at least a name or a phone number.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || 'Unknown',
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
        customFields,
      };
      if (isEdit && contactId) await contactsApi.update(contactId, payload);
      else await contactsApi.create(payload);
      haptic('success');
      navigation.goBack();
    } catch (err: any) {
      haptic('error');
      Alert.alert('Save failed', err.message ?? 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Screen><Text style={styles.muted}>Loading…</Text></Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.callLogRow}>
          <CallLogPicker onPick={onPickCall} />
        </View>
        <Input label="Full name" icon={User} value={name} onChangeText={setName} placeholder="Ramesh Kumar" />
        <Input label="Phone" icon={Phone} value={phone} onChangeText={setPhone} placeholder="+91 90000 00000" keyboardType="phone-pad" />
        <Input label="Email (optional)" icon={Mail} value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
        <Input label="Notes (optional)" icon={FileText} value={notes} onChangeText={setNotes} placeholder="Prefers weekend visits…" multiline />

        <CustomFieldsEditor entityType="contact" values={customFields} onChange={setCustomFields} />

        <Button title={isEdit ? 'Save changes' : 'Add contact'} onPress={save} loading={saving} style={styles.save} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  callLogRow: { marginBottom: spacing.md },
  save: { marginTop: spacing.sm },
  muted: { fontSize: 14, color: colors.textMuted },
});
