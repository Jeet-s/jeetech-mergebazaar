import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { fonts } from "../ui/theme";

/** "+40", "Perfect!", "Combo x3" — rises and fades at (x, y). Re-key to replay. */
export function FloatingText({ text, x, y, color = "#FFD24A", duration = 900 }: { text: string; x: number; y: number; color?: string; duration?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [t, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [{ translateY: -60 * t.value }, { scale: 0.6 + Math.min(1, t.value * 3) * 0.5 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { left: x - 130, top: y - 24 }, style]}>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </Animated.View>
  );
}

export function Pop({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.back(2.2)) }));
  }, [s, delay]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value * 2), transform: [{ scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  // a roomy box (line height above the glyphs' ascent, side padding for the shadow) so no glyph is ever clipped
  wrap: { position: "absolute", width: 260, alignItems: "center" },
  text: { fontFamily: fonts.display, fontSize: 26, lineHeight: 38, paddingHorizontal: 10, paddingVertical: 2, textAlign: "center", includeFontPadding: false, textShadowColor: "rgba(58,31,20,0.95)", textShadowRadius: 5, textShadowOffset: { width: 0, height: 2 } },
});
