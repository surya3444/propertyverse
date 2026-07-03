import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// The five bottom tabs.
export type TabParamList = {
  HomeTab: undefined;
  PropertiesTab: undefined;
  ContactsTab: undefined;
  ScheduleTab: undefined;
  ProfileTab: undefined;
};

// Detail & form screens live in the root stack (full-screen, above the tab bar),
// so any tab can push them.
export type RootStackParamList = {
  MainTabs: undefined;
  PropertyDetail: { propertyId: string };
  PropertyForm: { propertyId?: string } | undefined;
  ContactDetail: { contactId: string };
  ContactForm: { contactId?: string } | undefined;
  LeadsList: undefined;
  LeadDetail: { leadId: string };
  // Capture forms (public lead/property forms).
  FormsList: undefined;
  FormBuilder: { formId: string };
  FormDetail: { formId: string };
  Notifications: undefined;
  // Optional prefill — e.g. opened from the post-call nudge with the caller's number.
  RecordLead: { phoneNumber?: string; clientName?: string } | undefined;
  ActivityForm:
    | {
        activityId?: string;
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        propertyId?: string;
        propertyTitle?: string;
        kind?: string;
        notes?: string;
        scheduledAt?: string;
      }
    | undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// Tab screens can navigate to both sibling tabs and root-stack screens.
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
