import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { InteractionManager } from 'react-native'

import { BrandedLoader } from '@/components/BrandedLoader'

export default function UploadTabEntry() {
  const router = useRouter()
  const [navigated, setNavigated] = useState(false)

  useEffect(() => {
    if (navigated) return
    const task = InteractionManager.runAfterInteractions(() => {
      setNavigated(true)
      router.push('/upload-flow')
    })
    return () => task.cancel()
  }, [router, navigated])

  return <BrandedLoader label="Otvaram Clean Cut studio" />
}
