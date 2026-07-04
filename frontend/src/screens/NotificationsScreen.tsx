import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, CheckCheck } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { SkeletonNotificationList } from '../components/Skeleton';
import { notificationsApi } from '../api/notifications';
import { AppNotification } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { RootScreenProps } from '../navigation/types';

function relTime(iso: string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      // empty state handles it
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread > 0 ? (
          <TouchableOpacity onPress={markAll} style={styles.headerBtn} hitSlop={8}>
            <CheckCheck size={18} color={colors.primary} />
            <Text style={styles.headerBtnText}>Mark all</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, unread, markAll]);

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(n._id).catch(() => {});
    }
    if (n.entityType === 'Lead' && n.entityId) navigation.navigate('LeadDetail', { leadId: n.entityId });
    else if (n.entityType === 'Property' && n.entityId)
      navigation.navigate('PropertyDetail', { propertyId: n.entityId });
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.pad}>
              <SkeletonNotificationList count={5} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Bell size={30} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>You’re all caught up</Text>
              <Text style={styles.emptyDesc}>Form responses will show up here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={[styles.row, !item.read && styles.rowUnread]}
          >
            {!item.read ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
            <View style={styles.flex1}>
              <Text style={styles.title}>{item.title}</Text>
              {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
              <Text style={styles.time}>{relTime(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, flexGrow: 1 },
  pad: { paddingTop: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnread: { backgroundColor: colors.primaryTint, borderColor: colors.primaryTint },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  dotSpacer: { width: 8 },
  flex1: { flex: 1 },
  title: { ...typography.bodyStrong },
  body: { ...typography.caption, marginTop: 2 },
  time: { ...typography.caption, color: colors.textSubtle, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm },
  headerBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
