import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

/** Screen/element shake for mistakes and impacts: `const { style, shake } = useShake()`; `shake(0.4)` = a light one. */
export function useShake(intensity = 10) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const shake = (scale = 1) => {
    const i = intensity * scale;
    x.value = withSequence(
      withTiming(i, { duration: 40 }),
      withTiming(-i, { duration: 50 }),
      withTiming(i * 0.6, { duration: 50 }),
      withTiming(-i * 0.4, { duration: 50 }),
      withTiming(0, { duration: 40 }),
    );
    y.value = withSequence(withTiming(i * 0.35, { duration: 45 }), withTiming(-i * 0.25, { duration: 60 }), withTiming(0, { duration: 70 }));
  };
  return { style, shake };
}
