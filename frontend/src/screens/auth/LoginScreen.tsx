import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LogoFull } from '../../components/Logo';
import { Mail, Lock } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme';
import { AuthScreenProps } from '../../navigation/types';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const onSubmit = async () => {
    try {
      await login(email.trim(), password);
    } catch {
      // error is surfaced from the store
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <LogoFull width={230} />
            <Text style={styles.tagline}>Voice-first lead capture for real estate agents</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your agent account</Text>

            <View style={styles.form}>
              <Input
                label="Email"
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                error={!!error}
              />
              <Input
                label="Password"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                error={!!error}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Sign In" onPress={onSubmit} loading={loading} style={styles.submit} />
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to PropertyVerse? </Text>
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Register')}>
              Create an account
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...(Platform.OS === 'web' ? { maxWidth: 460, alignSelf: 'center' } : {}),
  },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  tagline: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 280,
    lineHeight: 20,
  },
  card: { padding: spacing.xl },
  cardTitle: { ...typography.h2 },
  cardSubtitle: { ...typography.caption, marginTop: 2, marginBottom: spacing.lg },
  form: { width: '100%' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500', marginBottom: spacing.sm },
  submit: { marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { ...typography.caption },
  footerLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
