import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Player from '../components/Player';
import { useSignedUrl } from '../lib/useSignedUrl';
import { Banner, Loading } from '../components/ui';

/** Full-screen-ish player for a solution video step: /video?exerciseId=..&step=..&title=.. */
export default function VideoScreen() {
  const { exerciseId, step, title } = useLocalSearchParams();
  const { url, error } = useSignedUrl(`/content/exercises/${exerciseId}/solutions/${step}/playback`);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
      <Stack.Screen options={{ title: title || `Solution — étape ${step}` }} />
      {error ? <View style={{ padding: 16 }}><Banner>{error.message}</Banner></View> : url ? <Player url={url} /> : <Loading />}
      {url && <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 12 }}>Étape {step}</Text>}
    </View>
  );
}
