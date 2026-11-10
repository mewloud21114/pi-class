import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LEVELS } from '../../lib/levels';
import { Badge, Banner, Card, Chips, Empty, styles } from '../../components/ui';
import StatTile from '../../components/StatTile';
import { colors } from '../../lib/theme';

const FILTERS = [{ value: null, label: 'Tous' }, ...LEVELS.map((l) => ({ value: l.code, label: l.label }))];

const Metric = ({ icon, value }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name={icon} size={14} color={colors.muted} />
    <Text style={{ fontSize: 13, color: colors.text }}>{value}</Text>
  </View>
);

export default function Stats() {
  const { token } = useAuth();
  const [level, setLevel] = useState(null);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(`/admin/stats/courses${level ? `?level=${level}` : ''}`, { token });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [level, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const t = state.data?.totals;
  return (
    <FlatList
      data={state.data?.courses ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          {state.error && <Banner>{state.error.message}</Banner>}
          {t && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <StatTile label="Élèves actifs" value={t.activeStudents} hint={t.pendingStudents ? `${t.pendingStudents} en attente` : null} />
              <StatTile label="Vues (7 jours)" value={t.views7d} hint={`${t.viewers7d} élève(s)`} />
              <StatTile label="J'aime" value={t.likes} />
              <StatTile label="Commentaires" value={t.comments} />
            </View>
          )}
          <Chips options={FILTERS} value={level} onChange={setLevel} />
          <Text style={[styles.meta, { marginBottom: 10 }]}>Cours classés par nombre de vues</Text>
        </>
      }
      ListEmptyComponent={!state.loading && !state.error ? <Empty title="Aucun cours" /> : null}
      renderItem={({ item: c }) => (
        <Card onPress={() => router.push(`/course-stats/${c.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[styles.title, { flex: 1 }]}>{c.title}</Text>
            <Badge label={c.level} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
            <Metric icon="eye-outline" value={`${c.views} vue(s)`} />
            <Metric icon="people-outline" value={`${c.viewers} élève(s)`} />
            <Metric icon="speedometer-outline" value={c.avgProgressPct != null ? `${c.avgProgressPct}% regardé` : '—'} />
            <Metric icon="heart-outline" value={c.likes} />
            <Metric icon="chatbubble-outline" value={c.comments} />
          </View>
          {!c.isPublished && <Text style={[styles.meta, { color: colors.accent }]}>Brouillon (non visible par les élèves)</Text>}
        </Card>
      )}
    />
  );
}
