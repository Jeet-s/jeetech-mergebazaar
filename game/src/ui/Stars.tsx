import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { pieces } from "../pieces";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { play, haptic } from "../audio/sfx";

/** One star: stamps down from above (big → slightly squashed → 1) with a chime + haptic on impact. */
function Star({ on, index, animate, size, delay0 }: { on: boolean; index: number; animate: boolean; size: number; delay0: number }) {
  const s = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      s.value = 1;
      return;
    }
    const delay = delay0 + index * 300;
    s.value = 0;
    s.value = withDelay(delay, withSequence(withTiming(1.06, { duration: 230, easing: Easing.in(Easing.quad) }), withTiming(0.96, { duration: 80 }), withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })));
    const id = setTimeout(() => {
      if (on) {
        play(`star${index + 1}` as "star1");
        haptic(index === 2 ? "heavy" : "medium");
      } else play("tap", 0.5, 0.8);
    }, delay + 230);
    return () => clearTimeout(id);
  }, [animate, index, on, s, delay0]);
  // an earned star keeps twinkling after it lands (a soft swell + tilt, staggered per star) — the card never
  // freezes into a static frame
  const tw = useSharedValue(0);
  useEffect(() => {
    if (!animate || !on) {
      tw.value = 0;
      return;
    }
    tw.value = withDelay(delay0 + index * 300 + 700 + index * 180, withRepeat(withSequence(withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 500 })), -1));
  }, [animate, on, index, delay0, tw]);
  const style = useAnimatedStyle(() => {
    // s 0→1.06: falls from 2.2x scale onto the panel; opacity is full almost at once (no ghost frames)
    const k = Math.min(1, s.value);
    const scale = s.value <= 1.0 && k < 1 ? 2.2 - 1.2 * k : s.value;
    return {
      opacity: Math.min(1, k * 4),
      transform: [{ translateY: index === 1 ? -14 : 0 }, { scale: scale * (1 + tw.value * 0.12) }, { rotate: `${(1 - k) * -25 + tw.value * 8}deg` }],
    };
  });
  const big = index === 1 ? size * 1.3 : size;
  return (
    <View style={{ width: big, height: big }}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={pieces.cur_star} style={{ width: "100%", height: "100%", opacity: on ? 1 : 0.28, tintColor: on ? undefined : "#7A5240" }} />
      </Animated.View>
    </View>
  );
}

/** Three-star award with staggered stamps + rising chimes. `animate` for the win screen (`delay` before the first). */
export function Stars({ count, animate = false, size = 48, delay = 250 }: { count: number; animate?: boolean; size?: number; delay?: number }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2].map((i) => (
        <Star key={i} index={i} on={i < count} animate={animate} size={size} delay0={delay} />
      ))}
    </View>
  );
}

/** Small static stars under level nodes. */
export function MiniStars({ count }: { count: number }) {
  return (
    <View style={styles.mini}>
      {[0, 1, 2].map((i) => (
        <Image key={i} source={pieces.cur_star} style={{ width: 14, height: 14, opacity: i < count ? 1 : 0.35, tintColor: i < count ? undefined : "#3A1F14" }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8, marginVertical: 8 },
  mini: { flexDirection: "row", gap: 1, marginTop: 2, backgroundColor: "rgba(26,28,77,0.85)", borderRadius: 9, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: "#B8862B" },
});
