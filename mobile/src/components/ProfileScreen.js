import { Text, View } from 'react-native';
import { Alert } from '../lib/dialog';
import { useAuth } from '../lib/auth';
import { Button, Card, Form, styles } from './ui';
import { colors } from '../lib/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const confirmLogout = () =>
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: logout },
    ]);

  return (
    <Form>
      <Card>
        <Row label="Nom" value={user.fullName || '—'} />
        <Row label="Téléphone" value={user.phone} />
        <Row label="Rôle" value={user.role === 'ADMIN' ? 'Administrateur' : 'Élève'} />
        {user.level && <Row label="Niveau" value={user.level.code} />}
      </Card>
      <Button title="Se déconnecter" variant="danger" onPress={confirmLogout} style={{ marginTop: 8 }} />
    </Form>
  );
}

const Row = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <Text style={styles.meta}>{label}</Text>
    <Text style={{ fontWeight: '600', color: colors.text }}>{value}</Text>
  </View>
);
