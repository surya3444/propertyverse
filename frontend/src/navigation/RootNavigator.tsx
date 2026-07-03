import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';
import { CallNudge } from '../components/CallNudge';
import { registerForPush } from '../lib/push';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const initializing = useAuthStore((s) => s.initializing);
  const hydrate = useAuthStore((s) => s.hydrate);
  const navRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Once authenticated, best-effort register for push (no-op unless Firebase is
  // configured). The in-app bell/badge works regardless.
  useEffect(() => {
    if (token) registerForPush();
  }, [token]);

  // Stable so CallNudge's detector/notification effect doesn't restart each render.
  const goRecord = useCallback(
    (call: { phoneNumber: string; clientName?: string }) => {
      if (navRef.isReady()) {
        navRef.navigate('RecordLead', { phoneNumber: call.phoneNumber, clientName: call.clientName });
      }
    },
    [navRef]
  );

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      {token ? <AppNavigator /> : <AuthNavigator />}
      {/* Post-call reminder (Android): in-app popup when open, notification when
          backgrounded — both deep-link into the recorder. */}
      {token ? <CallNudge onRecord={goRecord} /> : null}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
