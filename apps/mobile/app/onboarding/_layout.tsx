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
      <Stack.Screen name="categories" />
      <Stack.Screen name="brands" />
      <Stack.Screen name="about" />
      <Stack.Screen name="success" />
      <Stack.Screen name="sizes" />
      <Stack.Screen name="location" />
    </Stack>
  )
}
