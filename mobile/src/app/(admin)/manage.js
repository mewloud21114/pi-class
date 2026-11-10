import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CONTENT_TYPES } from '../../lib/contentTypes';
import { Badge, Banner, Button, Card, Chips, Empty, styles } from '../../components/ui';
import { colors } from '../../lib/theme';

function subtitle(type, item) {
  if (type === 'exams') return `${item.year} · ${item.examType} · ${item.session === 'NORMALE' ? 'normale' : 'complémentaire'}`;
  if (type === 'exercises') {
    const steps = item.solutions?.length ?? 0;
    return [item.chapter, item.correctionPdfKey && 'corrigé PDF', steps > 0 && `${steps} étape(s) de solution`].filter(Boolean).join(' · ');
  }
  return [item.chapter, item.videoProvider].filter(Boolean).join(' · ');
}

export default function Manage() {
  const { token } = useAuth();
  const [type, setType] = useState('courses');
  // itemsType = the type `items` were loaded for; it lags behind `type` while a new list loads.
  const [state, setState] = useState({ items: [], itemsType: type, loading: true, error: null });
  const latestType = useRef(type);
  latestType.current = type;

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await api(`/admin/${type}?pageSize=100`, { token });
      if (latestType.current !== type) return;   // a newer tab was picked meanwhile; drop this response
      setState({ items: r.items, itemsType: type, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [type, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function togglePublish(item) {
    try {
      const updated = await api(`/admin/${type}/${item.id}`, { method: 'PATCH', token, body: { isPublished: !item.isPublished } });
      setState((s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? updated : i)) }));
    } catch (err) {
      Alert.alert('Erreur', err.message);
    }
  }

  const confirmDelete = (item) =>
    Alert.alert('Supprimer ?', item.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/admin/${type}/${item.id}`, { method: 'DELETE', token });
            setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
          } catch (err) {
            Alert.alert('Erreur', err.message);
          }
        },
      },
    ]);

  return (
    <FlatList
      data={state.itemsType === type ? state.items : []}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          <Chips options={CONTENT_TYPES} value={type} onChange={(t) => { setState((s) => ({ ...s, items: [] })); setType(t); }} />
          {state.error && <Banner>{state.error.message}</Banner>}
        </>
      }
      ListEmptyComponent={!state.loading && !state.error ? <Empty title="Rien ici pour l'instant" subtitle="Ajoutez du contenu depuis l'onglet Ajouter." /> : null}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[styles.title, { flex: 1 }]}>{item.title}</Text>
            <Badge label={item.level.code} />
          </View>
          <Text style={styles.meta}>{subtitle(type, item)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Badge label={item.isPublished ? 'Publié' : 'Brouillon'} color={item.isPublished ? colors.primary : colors.muted} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Button small title="Modifier" onPress={() => router.push(`/edit/${type}/${item.id}`)} />
            {type === 'courses' && <Button small variant="secondary" title="Stats" onPress={() => router.push(`/course-stats/${item.id}`)} />}
            <Button small variant="secondary" title={item.isPublished ? 'Dépublier' : 'Publier'} onPress={() => togglePublish(item)} />
            <Button small variant="danger" title="Supprimer" onPress={() => confirmDelete(item)} />
          </View>
        </Card>
      )}
    />
  );
}
