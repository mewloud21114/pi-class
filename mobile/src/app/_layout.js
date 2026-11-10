import { Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { ContentProvider } from '../lib/content';
import { Loading } from '../components/ui';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { loading, user } = useAuth();
  if (loading) return <Loading />;

  const isStudent = user?.role === 'STUDENT';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: 'Retour',
      }}
    >
      {/* index redirects to the right home for the current session */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Inscription' }} />
      </Stack.Protected>

      <Stack.Protected guard={isStudent}>
        <Stack.Screen name="(student)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: 'Cours' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercice' }} />
      </Stack.Protected>

      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="edit/[type]/[id]" options={{ title: 'Modifier' }} />
        <Stack.Screen name="course-stats/[id]" options={{ title: 'Statistiques du cours' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="video" options={{ title: 'Vidéo' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ContentProvider>
        <StatusBar style="light" />
        {/* On a PC the app is a centered column rather than stretched across the whole screen. */}
        <View style={web.page}>
          <View style={web.column}>
            <RootNavigator />
          </View>
        </View>
      </ContentProvider>
    </AuthProvider>
  );
}

const web = StyleSheet.create(
  Platform.OS === 'web'
    ? {
        page: { flex: 1, backgroundColor: '#DCE5E1' },
        column: {
          flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', backgroundColor: colors.bg,
          boxShadow: '0 0 24px rgba(0,0,0,0.08)',
        },
      }
    : { page: { flex: 1 }, column: { flex: 1 } },
);
