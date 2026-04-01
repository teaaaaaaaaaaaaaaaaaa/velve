import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function Index() {
  console.log('[Index] Rendering')
  const { currentUser, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('[Index] Auth check:', { user: !!currentUser, loading })
    if (loading) return

    if (currentUser) {
      console.log('[Index] User logged in, redirecting to feed')
      router.replace('/(tabs)/feed')
    } else {
      console.log('[Index] No user, redirecting to login')
      router.replace('/(auth)/login')
    }
  }, [currentUser, loading])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8ED' }}>
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
