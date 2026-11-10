import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Empty, Form, styles } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useContent } from '../../lib/content';
import { openPdf } from '../../lib/openPdf';
import { stars } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const { data } = useContent();
  const [showSolution, setShowSolution] = useState(false);
  const exercise = data?.exercises.find((e) => e.id === id);
  if (!exercise) return <Empty title="Exercice introuvable" />;

  return (
    <Form>
      <Stack.Screen options={{ title: exercise.title }} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{exercise.title}</Text>
      {exercise.chapter && <Text style={styles.meta}>{exercise.chapter}</Text>}
      <Text style={[styles.meta, { color: colors.accent, marginBottom: 16 }]}>{stars(exercise.difficulty)}</Text>

      <Button title="Ouvrir l'énoncé (PDF)" onPress={() => openPdf(`/content/exercises/${id}/pdf?file=paper`, token)} />
      {exercise.hasCorrection && (
        <Button
          variant="secondary"
          title="Corrigé (PDF)"
          onPress={() => openPdf(`/content/exercises/${id}/pdf?file=correction`, token)}
          style={{ marginTop: 10 }}
        />
      )}

      {exercise.solutions.length > 0 && (
        <Button
          variant="secondary"
          title={showSolution ? 'Masquer la solution' : 'Voir la solution'}
          onPress={() => setShowSolution((s) => !s)}
          style={{ marginTop: 10 }}
        />
      )}

      {showSolution && (
        <View style={{ marginTop: 16 }}>
          {exercise.solutions.map((s) => (
            <Card key={s.step}>
              <Text style={{ fontWeight: '700', color: colors.primary, marginBottom: 6 }}>Étape {s.step}</Text>
              {s.type === 'TEXT' ? (
                <Text style={{ fontSize: 15, lineHeight: 22, color: colors.text }}>{s.body}</Text>
              ) : (
                <Button
                  small
                  title="▶  Regarder la vidéo"
                  onPress={() => router.push({ pathname: '/video', params: { exerciseId: id, step: s.step, title: `Étape ${s.step}` } })}
                />
              )}
            </Card>
          ))}
        </View>
      )}
    </Form>
  );
}
