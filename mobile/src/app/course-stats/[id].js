import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Banner, Button, Card, Loading, styles } from '../../components/ui';
import StatTile from '../../components/StatTile';
import Comments from '../../components/Comments';
import { colors } from '../../lib/theme';

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });

/** 14 vertical bars, one per day; the tallest day fills the chart. */
function DailyChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 4 }}>
        {daily.map((d) => (
          <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {d.views > 0 && <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 2 }}>{d.views}</Text>}
            <View style={{ width: '100%', height: `${(d.views / max) * 80}%`, minHeight: 2, backgroundColor: d.views ? colors.primary : colors.border, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {daily.map((d) => (
          <Text key={d.day} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: colors.muted }}>
            {DAY.format(new Date(`${d.day.slice(0, 10)}T12:00:00Z`))}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ProgressBar({ pct }) {
  return (
    <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ width: `${pct ?? 0}%`, height: '100%', backgroundColor: pct >= 90 ? colors.primary : colors.accent }} />
    </View>
  );
}

export default function CourseStats() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await api(`/admin/stats/courses/${id}`, { token }), loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  if (!state.data && state.loading) return <Loading />;
  const d = state.data;
  const c = d?.course;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <Stack.Screen options={{ title: c?.title ?? 'Statistiques' }} />
        {state.error && <Banner>{state.error.message}</Banner>}
        {c && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{c.title}</Text>
              <Badge label={c.level} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <StatTile label="Vues" value={c.views} />
              <StatTile label="Élèves" value={c.viewers} />
              <StatTile label="Progression moyenne" value={c.avgProgressPct != null ? `${c.avgProgressPct}%` : '—'} />
              <StatTile label="Terminé (≥ 90%)" value={c.completions} />
              <StatTile label="J'aime" value={c.likes} />
              <StatTile label="Commentaires" value={c.comments} />
            </View>

            <Card>
              <Text style={[styles.title, { marginBottom: 12 }]}>Vues — 14 derniers jours</Text>
              <DailyChart daily={d.daily} />
            </Card>

            <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Élèves ayant regardé ({d.viewers.length})</Text>
            {d.viewers.length === 0 && <Text style={styles.meta}>Personne n'a encore regardé ce cours.</Text>}
            {d.viewers.map((v) => (
              <Card key={v.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.title, { flex: 1 }]}>{v.name || v.phone}</Text>
                  {v.liked && <Ionicons name="heart" size={16} color={colors.danger} />}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{v.progressPct ?? 0}%</Text>
                </View>
                <Text style={styles.meta}>
                  {[v.name && v.phone, v.level, `${v.views} vue(s)`, `vu le ${new Date(v.lastSeenAt).toLocaleString('fr-FR')}`].filter(Boolean).join(' · ')}
                </Text>
                <ProgressBar pct={v.progressPct} />
              </Card>
            ))}

            <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 10 }}>Commentaires</Text>
            <Comments courseId={id} onCountChange={load} />

            <Button variant="secondary" title="Modifier ce cours" onPress={() => router.push(`/edit/courses/${id}`)} style={{ marginTop: 16 }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
