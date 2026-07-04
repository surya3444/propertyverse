import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Mail,
  Phone,
  CalendarDays,
  Users,
  Building2,
  ChevronRight,
  LogOut,
  ShieldCheck,
  FileText,
  Bell,
  SlidersHorizontal,
  LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Gradient } from '../components/Gradient';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { TabScreenProps } from '../navigation/types';

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** A read-only labelled detail row (icon + label + value). */
function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon size={18} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

/** A tappable navigation row (icon tile + title + chevron). */
function NavRow({
  icon: Icon,
  tint,
  bg,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  tint: string;
  bg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
    >
      <View style={[styles.navTile, { backgroundColor: bg }]}>
        <Icon size={20} color={tint} strokeWidth={2.2} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={22} color={colors.textSubtle} />
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: TabScreenProps<'ProfileTab'>) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initial = (user?.name?.trim()?.[0] ?? 'A').toUpperCase();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity header */}
        <View style={[styles.headerCard, shadow.md]}>
          <Gradient style={styles.banner} />
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.name ?? 'PropertyVerse Agent'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          <View style={styles.rolePill}>
            <ShieldCheck size={13} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.roleText}>Real estate agent</Text>
          </View>
        </View>

        {/* Account details */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <DetailRow icon={Mail} label="Email" value={user?.email ?? '—'} />
          <View style={styles.divider} />
          <DetailRow icon={Phone} label="Phone" value={user?.phone || 'Not added'} />
          <View style={styles.divider} />
          <DetailRow icon={CalendarDays} label="Member since" value={formatDate(user?.createdAt)} />
        </View>

        {/* Activity */}
        <Text style={styles.sectionLabel}>ACTIVITY</Text>
        <View style={styles.card}>
          <NavRow
            icon={Users}
            tint={colors.primary}
            bg={colors.primaryTint}
            title="My Leads"
            subtitle="Clients you've captured"
            onPress={() => navigation.navigate('LeadsList')}
          />
          <View style={styles.divider} />
          <NavRow
            icon={Building2}
            tint={colors.accentDark}
            bg={colors.accentTint}
            title="My Properties"
            subtitle="Your listed inventory"
            onPress={() => navigation.navigate('PropertiesTab')}
          />
        </View>

        {/* Tools */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <View style={styles.card}>
          <NavRow
            icon={FileText}
            tint={colors.primary}
            bg={colors.primaryTint}
            title="Capture Forms"
            subtitle="Collect leads & properties online"
            onPress={() => navigation.navigate('FormsList')}
          />
          <View style={styles.divider} />
          <NavRow
            icon={Bell}
            tint={colors.accentDark}
            bg={colors.accentTint}
            title="Notifications"
            subtitle="Form responses & alerts"
            onPress={() => navigation.navigate('Notifications')}
          />
          <View style={styles.divider} />
          <NavRow
            icon={SlidersHorizontal}
            tint={colors.primary}
            bg={colors.primaryTint}
            title="Custom fields"
            subtitle="Add your own fields to records"
            onPress={() => navigation.navigate('CustomFields')}
          />
        </View>

        <Button
          title="Log out"
          variant="danger"
          icon={LogOut}
          onPress={logout}
          style={styles.logout}
        />

        <Text style={styles.version}>PropertyVerse · v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    paddingBottom: spacing.lg,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  banner: { height: 84, alignSelf: 'stretch' },
  avatarRing: {
    marginTop: -44,
    padding: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: colors.primary },
  name: { ...typography.h2, marginTop: spacing.sm },
  email: { ...typography.caption, marginTop: 2 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  roleText: { color: colors.primary, fontWeight: '700', fontSize: 12.5 },

  sectionLabel: { ...typography.overline, marginBottom: spacing.sm, marginLeft: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailText: { flex: 1 },
  detailLabel: { ...typography.caption, fontSize: 12.5 },
  detailValue: { ...typography.bodyStrong, marginTop: 1 },

  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  navRowPressed: { opacity: 0.6 },
  navTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowTitle: { ...typography.bodyStrong, fontSize: 16 },
  rowSubtitle: { ...typography.caption, marginTop: 1 },

  logout: { marginTop: spacing.xs },
  version: { ...typography.caption, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.lg },
});
