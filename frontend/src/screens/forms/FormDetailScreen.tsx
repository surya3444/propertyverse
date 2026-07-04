import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Copy, ExternalLink, Settings2, Trash2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SkeletonFormDetail } from '../../components/Skeleton';
import { formsApi } from '../../api/forms';
import { Form, FormResponse } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { haptic } from '../../lib/haptics';
import { RootScreenProps } from '../../navigation/types';

// Copy to clipboard on web; fall back to the native share sheet elsewhere.
async function shareLink(url: string): Promise<'copied' | 'shared' | null> {
  try {
    if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
      await (navigator as any).clipboard.writeText(url);
      return 'copied';
    }
    await Share.share({ message: url });
    return 'shared';
  } catch {
    return null;
  }
}

function summarize(r: FormResponse): { primary: string; secondary: string } {
  const d = r.data || {};
  const primary = d.name || d.ownerName || d.title || 'Response';
  const secondary = d.phone || d.ownerPhone || d.location || d.email || '';
  return { primary, secondary };
}

export function FormDetailScreen({ navigation, route }: RootScreenProps<'FormDetail'>) {
  const { formId } = route.params;
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([formsApi.get(formId), formsApi.responses(formId)]);
      setForm(f.form);
      setResponses(r.responses);
    } catch {
      // surfaced via empty state
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: form?.type === 'property' ? 'Property form' : 'Lead form' });
  }, [navigation, form]);

  const shareUrl = form ? formsApi.shareUrl(form.publicId) : '';

  const onCopy = async () => {
    haptic('light');
    const result = await shareLink(shareUrl);
    if (result === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const openResponse = (r: FormResponse) => {
    if (r.leadId) navigation.navigate('LeadDetail', { leadId: r.leadId });
    else if (r.propertyId) navigation.navigate('PropertyDetail', { propertyId: r.propertyId });
  };

  const confirmDelete = () => {
    const doDelete = async () => {
      try {
        await formsApi.remove(formId);
        navigation.goBack();
      } catch (err: any) {
        Alert.alert('Delete failed', err.message ?? 'Please try again.');
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      const ok = (globalThis as any).confirm?.('Delete this form? Responses already in your CRM are kept.');
      if (ok) doDelete();
    } else {
      Alert.alert('Delete form?', 'Responses already in your CRM are kept.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonFormDetail />
      </Screen>
    );
  }

  if (!form) {
    return (
      <Screen>
        <Text style={styles.emptyTitle}>Form not found</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card variant="flat">
          <View style={styles.titleRow}>
            <Text style={styles.title}>{form.title}</Text>
            <Badge label={form.isActive ? 'Active' : 'Off'} tone={form.isActive ? 'success' : 'muted'} />
          </View>
          {form.description ? <Text style={styles.desc}>{form.description}</Text> : null}

          <Text style={styles.linkLabel}>SHARE LINK</Text>
          <Pressable onPress={onCopy} style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>
              {shareUrl}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Button
              title={copied ? 'Copied!' : Platform.OS === 'web' ? 'Copy link' : 'Share link'}
              icon={Copy}
              variant="secondary"
              size="md"
              onPress={onCopy}
              style={styles.actionBtn}
            />
            <Button
              title="Open"
              icon={ExternalLink}
              size="md"
              onPress={() => Linking.openURL(shareUrl)}
              style={styles.actionBtn}
            />
          </View>
          <Button
            title="Customize"
            icon={Settings2}
            variant="ghost"
            size="md"
            onPress={() => navigation.navigate('FormBuilder', { formId })}
            style={styles.customize}
          />
        </Card>

        <Text style={styles.sectionLabel}>
          RESPONSES ({form.responseCount})
        </Text>
        {responses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No responses yet</Text>
            <Text style={styles.emptyDesc}>Share the link — submissions will appear here.</Text>
          </View>
        ) : (
          responses.map((r) => {
            const { primary, secondary } = summarize(r);
            return (
              <Card key={r._id} onPress={() => openResponse(r)}>
                <View style={styles.titleRow}>
                  <Text style={styles.respName}>{primary}</Text>
                  <Text style={styles.respTime}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
                {secondary ? <Text style={styles.respMeta}>{secondary}</Text> : null}
              </Card>
            );
          })
        )}

        <Button
          title="Delete form"
          icon={Trash2}
          variant="danger"
          onPress={confirmDelete}
          style={styles.delete}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, flexShrink: 1 },
  desc: { ...typography.caption, marginTop: spacing.xs },
  linkLabel: { ...typography.overline, marginTop: spacing.md, marginBottom: spacing.xs },
  linkBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkText: { ...typography.body, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
  customize: { marginTop: spacing.sm },
  sectionLabel: { ...typography.overline, marginTop: spacing.lg, marginBottom: spacing.sm },
  respName: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  respTime: { ...typography.caption },
  respMeta: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  delete: { marginTop: spacing.xl },
});
