import { Text } from 'react-native';
import { router } from 'expo-router';
import ContentList from '../../components/ContentList';
import { Card, styles } from '../../components/ui';
import { stars } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Exercises() {
  return (
    <ContentList
      select={(d) => d.exercises}
      emptyTitle="Aucun exercice pour votre niveau pour le moment."
      renderItem={({ item }) => (
        <Card onPress={() => router.push(`/exercise/${item.id}`)}>
          <Text style={styles.title}>{item.title}</Text>
          {item.chapter && <Text style={styles.meta}>{item.chapter}</Text>}
          <Text style={[styles.meta, { color: colors.accent }]}>{stars(item.difficulty)}</Text>
          <Text style={styles.meta}>
            {[item.hasCorrection && 'Corrigé disponible', item.solutions.length > 0 && `Solution en ${item.solutions.length} étape(s)`]
              .filter(Boolean).join(' · ') || 'Pas encore de corrigé'}
          </Text>
        </Card>
      )}
    />
  );
}
