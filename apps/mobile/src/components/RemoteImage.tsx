import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageErrorEventData,
  ImageProps,
  ImageStyle,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors } from '@/design/tokens';
import { getRemoteImageSource } from '@/lib/images';

type RemoteImageProps = Omit<ImageProps, 'source' | 'style'> & {
  uri?: string | null;
  className?: string;
  style?: StyleProp<ViewStyle>;
  imageClassName?: string;
  imageStyle?: StyleProp<ImageStyle>;
  fallback?: ReactNode;
  loaderColor?: string;
};

export function RemoteImage({
  uri,
  className,
  style,
  imageClassName,
  imageStyle,
  fallback,
  loaderColor = colors.baseCanvas,
  resizeMode = 'cover',
  onError,
  onLoadStart,
  onLoadEnd,
  ...imageProps
}: RemoteImageProps) {
  const source = useMemo(() => getRemoteImageSource(uri), [uri]);
  const [hasError, setHasError] = useState(!source);
  const [isLoading, setIsLoading] = useState(Boolean(source));

  useEffect(() => {
    setHasError(!source);
    setIsLoading(Boolean(source));
  }, [source]);

  return (
    <View className={className} style={[styles.container, style]}>
      {source && !hasError ? (
        <Image
          {...imageProps}
          source={source}
          resizeMode={resizeMode}
          className={imageClassName}
          style={[styles.image, imageStyle]}
          onLoadStart={() => {
            setIsLoading(true);
            onLoadStart?.();
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            onLoadEnd?.();
          }}
          onError={(event: NativeSyntheticEvent<ImageErrorEventData>) => {
            setHasError(true);
            setIsLoading(false);
            onError?.(event);
          }}
        />
      ) : null}

      {!source || hasError
        ? (fallback ?? (
            <View style={styles.defaultFallback}>
              <Ionicons name="shirt-outline" size={32} color={colors.baseCanvas} />
            </View>
          ))
        : null}

      {source && !hasError && isLoading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      ) : null}
    </View>
  );
}

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
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,26,67,0.18)',
  },
});
