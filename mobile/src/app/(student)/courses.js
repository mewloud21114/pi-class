import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import ContentList from '../../components/ContentList';
import { Card, styles } from '../../components/ui';
import { duration } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Courses() {
  return (
    <ContentList
      select={(d) => d.courses}
      emptyTitle="Aucun cours pour votre niveau pour le moment."
      renderItem={({ item }) => (
        <Card onPress={() => router.push(`/course/${item.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="play-circle" size={40} color={colors.primary} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{[item.chapter, duration(item.durationSeconds)].filter(Boolean).join(' · ') || item.subject}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
              <Counter icon={item.likedByMe ? 'heart' : 'heart-outline'} color={item.likedByMe ? colors.danger : colors.muted} value={item.likeCount} />
              <Counter icon="chatbubble-outline" color={colors.muted} value={item.commentCount} />
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const Counter = ({ icon, color, value }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name={icon} size={15} color={color} />
    <Text style={{ fontSize: 13, color: colors.muted }}>{value}</Text>
  </View>
);
