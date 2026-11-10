import { useState } from 'react';
import { Alert } from '../lib/dialog';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { describeValidation } from '../lib/api';
import { LEVELS } from '../lib/levels';
import { Banner, Button, Chips, Form, Input, Label } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ phone: '', fullName: '', password: '', confirm: '', levelCode: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Same rules as the server, checked early for a friendlier message.
  function localError() {
    if (!form.levelCode) return 'Choisissez votre niveau.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return 'Le mot de passe doit contenir au moins 8 caractères, avec des lettres et des chiffres.';
    }
    if (form.password !== form.confirm) return 'Les mots de passe ne correspondent pas.';
    return null;
  }

  async function submit() {
    const local = localError();
    if (local) return setError(local);
    setError(null);
    setBusy(true);
    try {
      await register({
        phone: form.phone,
        password: form.password,
        levelCode: form.levelCode,
        ...(form.fullName.trim() && { fullName: form.fullName.trim() }),
      });
      Alert.alert(
        'Inscription envoyée',
        "Votre compte doit être validé par un administrateur. Vous pourrez vous connecter dès qu'il sera activé.",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      setError(err.code === 'VALIDATION_ERROR' ? describeValidation(err) : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form>
      {error && <Banner>{error}</Banner>}
      <Input label="Téléphone" placeholder="36 12 34 56" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} hint="Numéro mauritanien (Mattel, Mauritel, Chinguitel)" />
      <Input label="Nom complet (facultatif)" placeholder="Sidi Ahmed" value={form.fullName} onChangeText={set('fullName')} />
      <Label>Niveau</Label>
      <Chips options={LEVELS.map((l) => ({ value: l.code, label: l.label }))} value={form.levelCode} onChange={set('levelCode')} />
      <Input label="Mot de passe" secureTextEntry value={form.password} onChangeText={set('password')} hint="8 caractères minimum, lettres et chiffres" />
      <Input label="Confirmer le mot de passe" secureTextEntry value={form.confirm} onChangeText={set('confirm')} />
      <Button title="Créer mon compte" onPress={submit} loading={busy} disabled={!form.phone || !form.password} />
    </Form>
  );
}
