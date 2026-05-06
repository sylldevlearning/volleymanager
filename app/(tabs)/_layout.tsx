import { Tabs } from 'expo-router';
import { Home, List, Users, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../src/theme/tokens';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accentPrimary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.backgroundElevated,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
        },
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: {
          fontFamily: 'Inter_700Bold',
          color: palette.textPrimary,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={1.5} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarIcon: ({ color, size }) => <List size={size} color={color} strokeWidth={1.5} />,
          headerTitle: t('history.title'),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: t('tabs.teams'),
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={1.5} />,
          headerTitle: t('tabs.teams'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} strokeWidth={1.5} />,
          headerTitle: t('settings.title'),
        }}
      />
    </Tabs>
  );
}
