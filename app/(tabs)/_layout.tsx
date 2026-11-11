import { Tabs } from 'expo-router';
import { Home, List, Users, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function TabLayout() {
  const colors = useAppTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.color,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundElevated,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontFamily: 'Inter_700Bold',
          color: colors.textPrimary,
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
