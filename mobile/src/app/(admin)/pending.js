import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LEVELS } from '../../lib/levels';
import { Badge, Banner, Button, Card, Chips, Empty, styles } from '../../components/ui';
import { colors } from '../../lib/theme';

const FILTERS = [{ value: null, label: 'Tous' }, ...LEVELS.map((l) => ({ value: l.code, label: l.label }))];

export default function Pending() {
  const { token } = useAuth();
  const [level, setLevel] = useState(null);
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: null });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const q = `?pageSize=100${level ? `&level=${level}` : ''}`;
      const r = await api(`/admin/users/pending${q}`, { token });
      setState({ items: r.items, total: r.pagination.total, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [level, token]);

  // Reload whenever the tab gets focus or the filter changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function decide(user, action) {
    setBusyId(user.id);
    try {
      await api(`/admin/users/${user.id}/${action}`, { method: 'PATCH', token, body: {} });
      setState((s) => ({ ...s, items: s.items.filter((u) => u.id !== user.id), total: s.total - 1 }));
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setBusyId(null);
    }
  }

  const confirmReject = (user) =>
    Alert.alert('Refuser cette inscription ?', user.phone, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => decide(user, 'reject') },
    ]);

  return (
    <FlatList
      data={state.items}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          <Chips options={FILTERS} value={level} onChange={setLevel} />
          {state.error && <Banner>{state.error.message}</Banner>}
          <Text style={[styles.meta, { marginBottom: 10 }]}>{state.total} inscription(s) en attente</Text>
        </>
      }
      ListEmptyComponent={!state.loading && !state.error ? <Empty title="Aucune inscription en attente" /> : null}
      renderItem={({ item: u }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{u.fullName || u.phone}</Text>
            <Badge label={u.level?.code} />
          </View>
          {u.fullName && <Text style={styles.meta}>{u.phone}</Text>}
          <Text style={styles.meta}>Inscrit le {new Date(u.createdAt).toLocaleString('fr-FR')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small title="Activer" onPress={() => decide(u, 'activate')} loading={busyId === u.id} style={{ flex: 1 }} />
            <Button small variant="danger" title="Refuser" onPress={() => confirmReject(u)} disabled={busyId === u.id} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
    />
  );
}
