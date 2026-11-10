import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../lib/theme';

const icon = (name) => ({ color, size }) => <Ionicons name={name} color={color} size={size} />;

export default function AdminTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primaryDark,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="pending" options={{ title: 'Inscriptions en attente', tabBarLabel: 'Inscriptions', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="manage" options={{ title: 'Contenus', tabBarIcon: icon('library') }} />
      <Tabs.Screen name="add" options={{ title: 'Ajouter un contenu', tabBarLabel: 'Ajouter', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="stats" options={{ title: 'Statistiques', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
