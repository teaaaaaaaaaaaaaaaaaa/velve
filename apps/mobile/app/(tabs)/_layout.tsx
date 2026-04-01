import { Tabs } from 'expo-router'

export default function TabsLayout() {
  console.log('[TabsLayout] Rendering tabs')

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
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
      {/* Sakrij chat rute iz tab bar-a */}
      <Tabs.Screen
        name="chat/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="chat/[id]"
        options={{ href: null }}
      />
    </Tabs>
  )
}
