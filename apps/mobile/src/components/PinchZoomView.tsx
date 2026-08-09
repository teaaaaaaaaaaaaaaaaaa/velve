import { ReactNode, useRef } from 'react';
import { Animated, PanResponder, View, ViewStyle, StyleProp } from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** Style for the inner animated wrapper — pass {width:'100%',height:'100%'} when the parent has fixed dimensions. */
  contentStyle?: StyleProp<ViewStyle>;
  maxScale?: number;
};

/**
 * Instagram-style pinch-to-zoom: two-finger pinch scales the content around
 * the gesture focal point, then springs back to place on release.
 * Pure JS (PanResponder + Animated) so it works identically on iOS and
 * Android without extra native dependencies.
 */
export function PinchZoomView({ children, style, className, contentStyle, maxScale = 4 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartCenter = useRef<{ x: number; y: number } | null>(null);
  const zoomingRef = useRef(false);

  const resetRef = useRef(() => {
    pinchStartDistance.current = null;
    pinchStartCenter.current = null;
    zoomingRef.current = false;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
      onPanResponderTerminationRequest: () => !zoomingRef.current,
      onPanResponderMove: (event) => {
        const touches = event.nativeEvent.touches;
        if (touches.length < 2) return;

        const [first, second] = touches;
        const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
        const center = {
          x: (first.pageX + second.pageX) / 2,
          y: (first.pageY + second.pageY) / 2,
        };

        if (pinchStartDistance.current == null || pinchStartCenter.current == null) {
          pinchStartDistance.current = distance;
          pinchStartCenter.current = center;
          zoomingRef.current = true;
          return;
        }

        const nextScale = Math.min(Math.max(distance / pinchStartDistance.current, 1), maxScale);
        scale.setValue(nextScale);
        translateX.setValue(center.x - pinchStartCenter.current.x);
        translateY.setValue(center.y - pinchStartCenter.current.y);
      },
      onPanResponderRelease: () => resetRef.current(),
      onPanResponderTerminate: () => resetRef.current(),
    })
  ).current;

  return (
    <View className={className} style={style} {...panResponder.panHandlers}>
      <Animated.View
        style={[contentStyle, { transform: [{ translateX }, { translateY }, { scale }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
