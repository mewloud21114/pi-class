import { Text, View } from 'react-native';
import ContentList from '../../components/ContentList';
import { Button, Card, styles } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { openPdf } from '../../lib/openPdf';
import { SESSION_LABELS } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Exams() {
  const { token } = useAuth();
  return (
    <ContentList
      select={(d) => d.exams}
      emptyTitle="Aucun examen archivé pour votre niveau."
      renderItem={({ item: group }) => (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primaryDark, marginBottom: 8 }}>{group.year}</Text>
          {group.exams.map((exam) => (
            <Card key={exam.id}>
              <Text style={styles.title}>{exam.title}</Text>
              <Text style={styles.meta}>{exam.type} · {SESSION_LABELS[exam.session]}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button small title="Sujet (PDF)" onPress={() => openPdf(`/content/exams/${exam.id}/file?file=paper`, token)} style={{ flex: 1 }} />
                {exam.hasCorrection && (
                  <Button small variant="secondary" title="Corrigé" onPress={() => openPdf(`/content/exams/${exam.id}/file?file=correction`, token)} style={{ flex: 1 }} />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
    />
  );
}
