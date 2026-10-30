import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { pieces } from "../pieces";
import { art } from "../art";
import { springs } from "../ui/theme";

/**
 * The board's own win beat, before any card: a warm full-screen pulse, then a great brass diya rises out of the board
 * centre and lights — flame flare, turning light rays, a soft bloom — and hangs there glowing until the result card
 * takes over. `trigger` > 0 starts it (bump it to replay). `on` false (the result card opened, or a Retry) fades the
 * big diya and its rays out over ~0.35 s, so the lit, finished board shows behind the card (never an instant cut).
 * Keep it MOUNTED with the board (invisible at rest): views mounted in the same frame their animation starts can miss
 * the first updates (seen on RN-web).
 * Everything is pointerEvents="none".
 */
export function WinStage({ trigger, on = true, at, size, reduce }: { trigger: number; on?: boolean; at: { x: number; y: number }; size: number; reduce?: boolean }) {
  const flash = useSharedValue(0);
  const rise = useSharedValue(0);
  const rays = useSharedValue(0);
  const spin = useSharedValue(0);
  const flame = useSharedValue(0);
  useEffect(() => {
    if (on) return;
    const out = { duration: 350, easing: Easing.inOut(Easing.quad) };
    flash.value = withTiming(0, out);
    rise.value = withTiming(0, out);
    rays.value = withTiming(0, out);
    flame.value = withTiming(0, out);
    spin.value = withDelay(360, withTiming(0, { duration: 0 })); // ends the turning rays' loop once they are gone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  useEffect(() => {
    if (!trigger || !on) return;
    flash.value = withSequence(withTiming(reduce ? 0.25 : 0.5, { duration: 120, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }));
    if (reduce) {
      rise.value = withTiming(1, { duration: 300 });
      rays.value = withTiming(0.7, { duration: 300 });
      return;
    }
    // each beat starts by holding its rest value (a timed hold, not withDelay, so it can't be skipped or stall)
    rise.value = withSequence(withTiming(0, { duration: 120 }), withSpring(1, springs.pop));
    rays.value = withSequence(withTiming(0, { duration: 200 }), withTiming(1, { duration: 240 }), withTiming(0.8, { duration: 900 }));
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    flame.value = withSequence(withTiming(0, { duration: 300 }), withTiming(1, { duration: 140 }), withRepeat(withSequence(withTiming(0.82, { duration: 260 }), withTiming(1, { duration: 260 })), 4, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value }));
  const lampSt = useAnimatedStyle(() => ({ opacity: Math.min(1, rise.value * 2), transform: [{ translateY: (1 - rise.value) * size * 0.8 }, { scale: 0.4 + 0.6 * rise.value }] }));
  const raySt = useAnimatedStyle(() => ({ opacity: rays.value, transform: [{ rotate: `${spin.value * 360}deg` }, { scale: 0.5 + 0.5 * rays.value }] }));
  const flameSt = useAnimatedStyle(() => ({ opacity: flame.value, transform: [{ scale: 0.6 + 0.5 * flame.value }] }));
  const lamp = size * 1.5;
  const ray = size * 3.6;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashSt]} />
      <Animated.View style={[styles.abs, { left: at.x - ray / 2, top: at.y - ray / 2, width: ray, height: ray }, raySt]}>
        <View style={[styles.bloom, { width: ray * 0.55, height: ray * 0.55, borderRadius: ray, left: ray * 0.225, top: ray * 0.225 }]} />
        <Image source={art.fx_sparkle_glow} style={{ width: ray, height: ray }} resizeMode="contain" fadeDuration={0} />
      </Animated.View>
      <Animated.View style={[styles.abs, { left: at.x - lamp / 2, top: at.y - lamp / 2, width: lamp, height: lamp }, lampSt]}>
        <Image source={pieces.L3 ?? pieces.L2} style={{ width: lamp, height: lamp }} fadeDuration={0} />
        <Animated.View style={[styles.abs, { left: lamp * 0.3, top: -lamp * 0.12, width: lamp * 0.4, height: lamp * 0.4 }, flameSt]}>
          <Image source={art.fx_sparkle_glow} style={{ width: lamp * 0.4, height: lamp * 0.4 }} fadeDuration={0} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  flash: { backgroundColor: "rgba(255,220,140,1)" },
  bloom: { position: "absolute", backgroundColor: "rgba(255,206,84,0.35)" },
});
