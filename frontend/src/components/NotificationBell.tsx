import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { notificationsApi } from '../api/notifications';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../lib/haptics';
import { onUnreadChanged } from '../lib/notificationEvents';

// Header bell with an unread-count badge. Refreshes its count whenever the
// hosting screen regains focus (e.g. returning from the Notifications screen or
// after a new form response arrives).
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    notificationsApi
      .list(true)
      .then((res) => setUnread(res.unreadCount))
      .catch(() => {
        /* best-effort; the badge just stays as-is */
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Refresh instantly when a real-time push arrives while the app is open.
  useEffect(() => onUnreadChanged(refresh), [refresh]);

  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={styles.wrap}
      hitSlop={8}
    >
      <Bell size={22} color={colors.text} strokeWidth={2.2} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
