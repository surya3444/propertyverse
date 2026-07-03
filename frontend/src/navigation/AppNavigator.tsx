import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { colors } from '../theme';
import { MainTabs } from './MainTabs';
import { PropertyDetailScreen } from '../screens/properties/PropertyDetailScreen';
import { PropertyFormScreen } from '../screens/properties/PropertyFormScreen';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { ContactFormScreen } from '../screens/contacts/ContactFormScreen';
import { LeadsListScreen } from '../screens/leads/LeadsListScreen';
import { LeadDetailScreen } from '../screens/leads/LeadDetailScreen';
import { RecordLeadScreen } from '../screens/leads/RecordLeadScreen';
import { ActivityFormScreen } from '../screens/schedule/ActivityFormScreen';
import { FormsListScreen } from '../screens/forms/FormsListScreen';
import { FormBuilderScreen } from '../screens/forms/FormBuilderScreen';
import { FormDetailScreen } from '../screens/forms/FormDetailScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Root stack: the bottom tabs, plus full-screen detail/form screens that push
// on top of the tab bar from anywhere.
export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '800', color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
      <Stack.Screen name="PropertyForm" component={PropertyFormScreen} options={{ title: 'Property' }} />
      <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ title: 'Contact' }} />
      <Stack.Screen name="ContactForm" component={ContactFormScreen} options={{ title: 'Contact' }} />
      <Stack.Screen name="LeadsList" component={LeadsListScreen} options={{ title: 'Requirements' }} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Requirement' }} />
      <Stack.Screen name="RecordLead" component={RecordLeadScreen} options={{ title: 'New Requirement' }} />
      <Stack.Screen name="ActivityForm" component={ActivityFormScreen} options={{ title: 'Schedule' }} />
      <Stack.Screen name="FormsList" component={FormsListScreen} options={{ title: 'Capture Forms' }} />
      <Stack.Screen name="FormBuilder" component={FormBuilderScreen} options={{ title: 'Customize form' }} />
      <Stack.Screen name="FormDetail" component={FormDetailScreen} options={{ title: 'Form' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
