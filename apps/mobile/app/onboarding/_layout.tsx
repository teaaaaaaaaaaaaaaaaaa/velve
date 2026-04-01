import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="style" />
      <Stack.Screen name="brands" />
      <Stack.Screen name="sizes" />
      <Stack.Screen name="location" />
    </Stack>
  )
}
