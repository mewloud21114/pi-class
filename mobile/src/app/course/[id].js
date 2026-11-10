import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Player from '../../components/Player';
import Comments from '../../components/Comments';
import { Banner, Card, Loading, styles } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useContent } from '../../lib/content';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { duration } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function CourseScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const { data, patchCourse } = useContent();
  const course = data?.courses.find((c) => c.id === id);
  const related = data?.exercises.filter((e) => e.courseId === id) ?? [];
  const { url, viewId, error } = useSignedUrl(`/content/courses/${id}/playback`);
  const [liking, setLiking] = useState(false);

  // Best-effort: a lost heartbeat only makes the statistics slightly less precise.
  const reportProgress = (positionSeconds, durationSeconds) => {
    if (!viewId) return;
    api(`/content/views/${viewId}`, { method: 'PATCH', token, body: { positionSeconds, ...(durationSeconds && { durationSeconds }) } })
      .catch(() => {});
  };

  async function toggleLike() {
    if (!course || liking) return;
    const liked = !course.likedByMe;
    // Optimistic update, rolled back if the server refuses.
    patchCourse(id, (c) => ({ likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) }));
    setLiking(true);
    try {
      const r = await api(`/content/courses/${id}/like`, { method: liked ? 'PUT' : 'DELETE', token });
      patchCourse(id, () => ({ likedByMe: r.liked, likeCount: r.likeCount }));
    } catch (err) {
      patchCourse(id, (c) => ({ likedByMe: !liked, likeCount: c.likeCount + (liked ? -1 : 1) }));
      Alert.alert('Erreur', err.message);
    } finally {
      setLiking(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: course?.title ?? 'Cours' }} />
        <View style={{ backgroundColor: '#000', aspectRatio: 16 / 9, justifyContent: 'center' }}>
          {url ? <Player url={url} onProgress={reportProgress} /> : !error && <Loading />}
        </View>

        <View style={{ padding: 16 }}>
          {error && <Banner>{error.message}</Banner>}
          {course && (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{course.title}</Text>
              <Text style={styles.meta}>{[course.chapter, duration(course.durationSeconds)].filter(Boolean).join(' · ')}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 }}>
                <Pressable onPress={toggleLike} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={course.likedByMe ? 'heart' : 'heart-outline'} size={26} color={course.likedByMe ? colors.danger : colors.text} />
                  <Text style={{ fontWeight: '700', color: colors.text }}>{course.likeCount}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chatbubble-outline" size={23} color={colors.text} />
                  <Text style={{ fontWeight: '700', color: colors.text }}>{course.commentCount}</Text>
                </View>
              </View>

              {course.description && <Text style={{ marginTop: 14, fontSize: 15, lineHeight: 22, color: colors.text }}>{course.description}</Text>}
            </>
          )}

          {related.length > 0 && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 }}>Exercices liés</Text>
              {related.map((e) => (
                <Card key={e.id} onPress={() => router.push(`/exercise/${e.id}`)}>
                  <Text style={styles.title}>{e.title}</Text>
                </Card>
              ))}
            </>
          )}

          <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 10 }}>Commentaires</Text>
          <Comments courseId={id} onCountChange={(d) => patchCourse(id, (c) => ({ commentCount: c.commentCount + d }))} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
