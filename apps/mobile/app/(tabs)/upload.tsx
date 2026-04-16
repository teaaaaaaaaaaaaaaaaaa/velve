import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { InteractionManager } from 'react-native'

import { BrandedLoader } from '@/components/BrandedLoader'

export default function UploadTabEntry() {
  const router = useRouter()

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Replace the temporary tab route so back navigation never gets stuck
      // on this loader screen.
      router.replace('/upload-flow')
    })
    return () => task.cancel()
  }, [router])

  return <BrandedLoader label="Otvaram Clean Cut studio" />
}
