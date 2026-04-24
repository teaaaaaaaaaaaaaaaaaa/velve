import { Ionicons } from '@expo/vector-icons'
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'

type Props = {
  visible: boolean
  title: string
  imageUri?: string | null
  onClose: () => void
}

export function FullscreenImageModal({ visible, title, imageUri, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          <Text className="font-sans text-sm font-semibold uppercase tracking-[1.2px] text-white/80">
            {title}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10"
          >
            <Ionicons name="close" size={22} color={colors.baseCanvas} />
          </TouchableOpacity>
        </View>

        <Pressable className="flex-1 items-center justify-center px-4 pb-6" onPress={onClose}>
          {imageUri ? (
            <RemoteImage
              uri={imageUri}
              className="h-full w-full"
              contentFit="contain"
              fallback={
                <View className="h-full w-full items-center justify-center rounded-[28px] bg-white/6">
                  <Ionicons name="image-outline" size={42} color={colors.baseCanvas} />
                </View>
              }
            />
          ) : (
            <View className="h-full w-full items-center justify-center rounded-[28px] bg-white/6">
              <Ionicons name="image-outline" size={42} color={colors.baseCanvas} />
            </View>
          )}
        </Pressable>
      </SafeAreaView>
    </Modal>
  )
}
