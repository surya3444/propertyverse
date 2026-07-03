import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LogoFull } from '../../components/Logo';
import { User, Mail, Phone, Lock } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme';
import { AuthScreenProps } from '../../navigation/types';

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const shownError = localError || error;

  const onSubmit = async () => {
    setLocalError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setLocalError('Enter your name, email and a password of at least 6 characters.');
      return;
    }
    try {
      await register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined });
    } catch {
      // error surfaced from the store
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
            <LogoFull width={180} />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start capturing leads by voice in minutes</Text>
          </View>

          <Card style={styles.card}>
            <View style={styles.form}>
              <Input label="Full name" icon={User} value={name} onChangeText={setName} placeholder="Jane Agent" />
              <Input
                label="Email"
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                label="Phone (optional)"
                icon={Phone}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 90000 00000"
                keyboardType="phone-pad"
              />
              <Input
                label="Password"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                secureTextEntry
                error={!!shownError}
              />

              {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

              <Button title="Create account" onPress={onSubmit} loading={loading} style={styles.submit} />
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text style={styles.footerLink} onPress={() => navigation.goBack()}>
              Sign in
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
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, marginTop: spacing.md },
  subtitle: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs },
  card: { padding: spacing.xl },
  form: { width: '100%' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500', marginBottom: spacing.sm },
  submit: { marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { ...typography.caption },
  footerLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
