import { Text } from 'react-native'
import { Tabs } from 'expo-router'

export default function TabsLayout() {
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
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
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
