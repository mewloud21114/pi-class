import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../lib/theme';

const icon = (name) => ({ color, size }) => <Ionicons name={name} color={color} size={size} />;

export default function StudentTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="courses" options={{ title: 'الدروس · Cours', tabBarLabel: 'Cours', tabBarIcon: icon('play-circle') }} />
      <Tabs.Screen name="exercises" options={{ title: 'التمارين · Exercices', tabBarLabel: 'Exercices', tabBarIcon: icon('create') }} />
      <Tabs.Screen name="exams" options={{ title: 'الامتحانات · Examens', tabBarLabel: 'Examens', tabBarIcon: icon('school') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
