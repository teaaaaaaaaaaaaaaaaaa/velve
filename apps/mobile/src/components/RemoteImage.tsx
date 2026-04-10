import { Ionicons } from '@expo/vector-icons'
import type { ImageProps as ExpoImageProps } from 'expo-image'
import { memo, ReactNode, useMemo } from 'react'
import {
  Image as RNImage,
  ImageProps as RNImageProps,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'

import { colors } from '@/design/tokens'
import { getExpoImageComponent } from '@/lib/expoImage'
import { getRemoteImageSource, normalizeImageUri } from '@/lib/images'

type RemoteImageProps = Omit<ExpoImageProps, 'source' | 'style'> & {
  uri?: string | null
  className?: string
  style?: StyleProp<ViewStyle>
  imageStyle?: StyleProp<ImageStyle>
  fallback?: ReactNode
  loaderColor?: string
}

function toResizeMode(
  contentFit: ExpoImageProps['contentFit']
): RNImageProps['resizeMode'] {
  switch (contentFit) {
    case 'contain':
    case 'scale-down':
      return 'contain'
    case 'fill':
      return 'stretch'
    case 'none':
      return 'center'
    case 'cover':
    default:
      return 'cover'
  }
}

export const RemoteImage = memo(function RemoteImage({
  uri,
  className,
  style,
  imageStyle,
  fallback,
  contentFit = 'cover',
  transition = 200,
  ...imageProps
}: RemoteImageProps) {
  const normalizedUri = useMemo(() => normalizeImageUri(uri), [uri])
  const ExpoImage = getExpoImageComponent()

  if (!normalizedUri) {
    return (
      <View className={className} style={[styles.container, style]}>
        {fallback ?? (
          <View style={styles.defaultFallback}>
            <Ionicons name="shirt-outline" size={32} color={colors.baseCanvas} />
          </View>
        )}
      </View>
    )
  }

  if (ExpoImage) {
    return (
      <View className={className} style={[styles.container, style]}>
        <ExpoImage
          {...imageProps}
          source={normalizedUri}
          contentFit={contentFit}
          transition={transition}
          recyclingKey={normalizedUri}
          style={[styles.image, imageStyle]}
          cachePolicy="memory-disk"
        />
      </View>
    )
  }

  return (
    <View className={className} style={[styles.container, style]}>
      <RNImage
        accessibilityLabel={imageProps.accessibilityLabel}
        accessible={imageProps.accessible}
        blurRadius={imageProps.blurRadius}
        fadeDuration={typeof transition === 'number' ? transition : undefined}
        onError={imageProps.onError as RNImageProps['onError']}
        onLayout={imageProps.onLayout}
        onLoad={imageProps.onLoad as RNImageProps['onLoad']}
        onLoadEnd={imageProps.onLoadEnd}
        onLoadStart={imageProps.onLoadStart}
        progressiveRenderingEnabled
        resizeMode={toResizeMode(contentFit)}
        source={getRemoteImageSource(normalizedUri) ?? { uri: normalizedUri }}
        style={[styles.image, imageStyle]}
        testID={imageProps.testID}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  defaultFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDeep,
  },
})
