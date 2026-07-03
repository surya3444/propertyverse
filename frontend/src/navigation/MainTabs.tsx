import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutGrid, Building2, Users, CalendarDays, User } from 'lucide-react-native';
import { TabParamList } from './types';
import { colors, shadow } from '../theme';
import { haptic } from '../lib/haptics';
import { HomeScreen } from '../screens/HomeScreen';
import { PropertiesListScreen } from '../screens/properties/PropertiesListScreen';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { ScheduleScreen } from '../screens/schedule/ScheduleScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  // Reserve space for the system navigation bar / home indicator so the tab bar
  // is never clipped behind it (needed on edge-to-edge Android and iOS home-bar
  // devices). We set height + paddingBottom explicitly instead of relying on the
  // navigator's automatic inset handling, which wasn't clearing the nav bar.
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const baseHeight = Platform.OS === 'web' ? 64 : 60;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: baseHeight + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
          ...shadow.sm,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
      screenListeners={{
        tabPress: () => haptic('selection'),
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: 'Home', tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} strokeWidth={2.2} /> }}
      />
      <Tab.Screen
        name="PropertiesTab"
        component={PropertiesListScreen}
        options={{ title: 'Properties', tabBarIcon: ({ color }) => <Building2 size={22} color={color} strokeWidth={2.2} /> }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsListScreen}
        options={{ title: 'Contacts', tabBarIcon: ({ color }) => <Users size={22} color={color} strokeWidth={2.2} /> }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={ScheduleScreen}
        options={{ title: 'Schedule', tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} strokeWidth={2.2} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2.2} /> }}
      />
    </Tab.Navigator>
  );
}
