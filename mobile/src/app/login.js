import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { Banner, Button, Form, Input } from '../components/ui';
import { colors } from '../lib/theme';

export default function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(phone, password);   // on success the navigator switches to the home screen
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const pending = error?.code === 'ACCOUNT_PENDING';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Form>
          <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 32 }}>
            <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.accent, fontSize: 48, fontWeight: '800' }}>π</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 12 }}>π-class</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Cours · Exercices · Examens</Text>
          </View>

          {error && <Banner type={pending ? 'warning' : 'error'}>{error.message}</Banner>}

          <Input label="Téléphone" placeholder="36 12 34 56" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} />
          <Input label="Mot de passe" placeholder="••••••••" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />

          <Button title="Se connecter" onPress={submit} loading={busy} disabled={!phone || !password} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: colors.muted }}>Pas encore de compte ? </Text>
            <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>S'inscrire</Link>
          </View>
        </Form>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
