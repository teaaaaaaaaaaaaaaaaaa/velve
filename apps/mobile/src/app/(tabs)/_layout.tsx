import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          // Glassmorphism — biće dorađeno u Nedelji 1
          backgroundColor: 'rgba(246, 248, 237, 0.85)',
          borderTopColor: 'rgba(246, 248, 237, 0.2)',
          elevation: 0,
        },
        tabBarActiveTintColor: '#431A43',
        tabBarInactiveTintColor: '#2B2A2B',
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="upload"
        options={{ title: 'Upload', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: () => null }}
      />
    </Tabs>
  )
}
