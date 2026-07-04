import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, Home, Plus } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SkeletonFormList } from '../../components/Skeleton';
import { formsApi } from '../../api/forms';
import { Form, FormType } from '../../types';
import { colors, spacing, typography } from '../../theme';
import { RootScreenProps } from '../../navigation/types';

export function FormsListScreen({ navigation }: RootScreenProps<'FormsList'>) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await formsApi.list();
      setForms(res.forms);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const create = async (type: FormType) => {
    setCreating(true);
    try {
      const res = await formsApi.create({ type });
      await load();
      navigation.navigate('FormBuilder', { formId: res.form._id });
    } catch (err: any) {
      setError(err.message ?? 'Failed to create form.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={forms}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Share these links to collect leads and properties. Every response lands
            in your CRM, tagged as a form submission.
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.pad}>
              <SkeletonFormList count={4} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No forms yet</Text>
              <Text style={styles.emptyDesc}>{error ?? 'Create your first capture form below.'}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const Icon = item.type === 'property' ? Home : FileText;
          return (
            <Card onPress={() => navigation.navigate('FormDetail', { formId: item._id })}>
              <View style={styles.row}>
                <View style={styles.titleWrap}>
                  <Icon size={18} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Badge
                  label={item.isActive ? 'Active' : 'Off'}
                  tone={item.isActive ? 'success' : 'muted'}
                />
              </View>
              <Text style={styles.meta}>
                {item.type === 'property' ? 'Property capture' : 'Lead capture'} ·{' '}
                {item.responseCount} {item.responseCount === 1 ? 'response' : 'responses'}
              </Text>
            </Card>
          );
        }}
      />
      <View style={styles.footer}>
        <Button
          title="New lead form"
          icon={Plus}
          variant="secondary"
          loading={creating}
          onPress={() => create('lead')}
          style={styles.footerBtn}
        />
        <Button
          title="New property form"
          icon={Plus}
          loading={creating}
          onPress={() => create('property')}
          style={styles.footerBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, flexGrow: 1 },
  intro: { ...typography.caption, marginBottom: spacing.md, paddingHorizontal: spacing.xs },
  pad: { paddingTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerBtn: { flex: 1 },
});
