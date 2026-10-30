import { useEffect, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";
import { art } from "../art";
import { pieces } from "../pieces";

const PETALS = ["#F6A81C", "#FFD24A", "#E8590C", "#D8433B", "#FFF1D6"];

function Petal({ t, a, d, size, color, spin }: { t: SharedValue<number>; a: number; d: number; size: number; color: string; spin: number }) {
  const st = useAnimatedStyle(() => {
    const k = t.value;
    return {
      opacity: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3,
      transform: [{ translateX: Math.cos(a) * d * k }, { translateY: Math.sin(a) * d * k + 40 * k * k }, { rotate: `${spin * k}deg` }, { scale: 1 - 0.4 * k }],
    };
  });
  return <Animated.View style={[styles.petal, { width: size, height: size * 0.55, borderRadius: size, backgroundColor: color, marginLeft: -size / 2, marginTop: -size / 4 }, st]} />;
}

/** A crisp four-point spark (two crossed diamonds) flying out from the burst centre, turning as it fades. */
function Star({ t, a, d, size }: { t: SharedValue<number>; a: number; d: number; size: number }) {
  const st = useAnimatedStyle(() => {
    const k = t.value;
    return {
      opacity: k < 0.08 ? k / 0.08 : k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.35),
      transform: [{ translateX: Math.cos(a) * d * k }, { translateY: Math.sin(a) * d * k }, { rotate: `${45 + k * 90}deg` }, { scale: 1.2 - 0.6 * k }],
    };
  });
  return (
    <Animated.View style={[styles.petal, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, alignItems: "center", justifyContent: "center" }, st]}>
      <View style={[styles.spark, { width: size * 0.34, height: size }]} />
      <View style={[styles.spark, { width: size, height: size * 0.34 }]} />
    </Animated.View>
  );
}

/** Soft dust puff for a press / generator tap: a few cream motes drifting out and fading. */
function Puff({ x, y, size }: { x: number; y: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
  }, [t]);
  const motes = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * Math.PI * 2 + Math.random() * 0.5, d: size * (0.38 + Math.random() * 0.2), s: size * (0.08 + Math.random() * 0.05) })), [size]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <View style={{ position: "absolute", left: x, top: y }}>
        {motes.map((m, i) => (
          <Mote key={i} t={t} a={m.a} d={m.d} s={m.s} />
        ))}
      </View>
    </View>
  );
}
function Mote({ t, a, d, s }: { t: SharedValue<number>; a: number; d: number; s: number }) {
  const st = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ translateX: Math.cos(a) * d * t.value }, { translateY: Math.sin(a) * d * t.value - 6 * t.value }, { scale: 0.6 + t.value * 0.8 }],
  }));
  return <Animated.View style={[styles.petal, { width: s, height: s, borderRadius: s, marginLeft: -s / 2, marginTop: -s / 2, backgroundColor: "#FFF1D6" }, st]} />;
}

/**
 * Merge burst at (x, y) in window coords: a soft light bloom (fx_sparkle_glow art), marigold petals and — for a
 * Big Merge — an expanding rangoli ring. `reduce` (Reduce Motion) keeps only a short gentle bloom.
 * `kind="puff"` = a small dust puff (press feedback); `fast` halves the timings (QA replay).
 */
export function Burst({ x, y, size, big, reduce, kind = "merge", fast }: { x: number; y: number; size: number; big?: boolean; reduce?: boolean; kind?: "merge" | "puff"; fast?: boolean }) {
  if (kind === "puff") return reduce ? null : <Puff x={x} y={y} size={size} />;
  return <MergeBurst x={x} y={y} size={size} big={big} reduce={reduce} fast={fast} />;
}

function MergeBurst({ x, y, size, big, reduce, fast }: { x: number; y: number; size: number; big?: boolean; reduce?: boolean; fast?: boolean }) {
  const t = useSharedValue(0);
  const ring = useSharedValue(0);
  const f = fast ? 0.5 : 1;
  useEffect(() => {
    // long enough to be caught in a 2 fps recording: the bloom + petals run ~1 s, the ring ~1.1 s
    t.value = withTiming(1, { duration: (reduce ? 380 : 1050) * f, easing: Easing.out(Easing.cubic) });
    if (!reduce) ring.value = withDelay(40 * f, withTiming(1, { duration: (big ? 1150 : 800) * f, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, ring, big, reduce]);
  const petals = useMemo(
    () => Array.from({ length: reduce ? 0 : big ? 22 : 12 }, (_, i) => ({ a: (i / (big ? 22 : 12)) * Math.PI * 2 + Math.random() * 0.4, d: size * (0.7 + Math.random() * 0.6) * (big ? 1.5 : 1), color: PETALS[i % PETALS.length], spin: (Math.random() - 0.5) * 400, s: size * (0.14 + Math.random() * 0.08) })),
    [big, reduce, size],
  );
  // bright four-point sparks shoot out ahead of the petals: they read even in a single sampled frame
  const stars = useMemo(
    () => Array.from({ length: reduce ? 0 : big ? 10 : 6 }, (_, i) => ({ a: (i / (big ? 10 : 6)) * Math.PI * 2 + 0.3, d: size * (big ? 1.35 : 0.9), s: size * (big ? 0.28 : 0.2) })),
    [big, reduce, size],
  );
  const bloom = useAnimatedStyle(() => ({ opacity: t.value < 0.3 ? t.value / 0.3 : 1 - (t.value - 0.3) / 0.7, transform: [{ scale: 0.5 + t.value * (big ? 1.4 : 0.9) }, { rotate: `${t.value * 40}deg` }] }));
  const flash = useAnimatedStyle(() => ({ opacity: t.value < 0.12 ? t.value / 0.12 : Math.max(0, 1 - (t.value - 0.12) / 0.35), transform: [{ scale: 0.6 + t.value * 0.7 }] }));
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.value < 0.1 ? ring.value / 0.1 : ring.value < 0.55 ? 1 : 1 - (ring.value - 0.55) / 0.45, transform: [{ scale: 0.3 + ring.value * (big ? 2.4 : 1.4) }] }));
  const b = size * 1.6;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <View style={{ position: "absolute", left: x, top: y }}>
        {!reduce ? (
          // a crisp rangoli ring (solid strokes: a dashed ring read as a rendering defect); a merge gets the bold double ring
          <Animated.View style={[{ position: "absolute", left: -size, top: -size, width: size * 2, height: size * 2, borderRadius: size, borderWidth: big ? 7 : 4, borderColor: "#FFD24A" }, ringSt]}>
            {big ? <View style={{ flex: 1, margin: 8, borderRadius: size, borderWidth: 4, borderColor: "#E14C6A" }} /> : null}
          </Animated.View>
        ) : null}
        <Animated.View style={[{ position: "absolute", left: -b / 2, top: -b / 2, width: b, height: b }, bloom]}>
          <Image source={art.fx_sparkle_glow} style={{ width: b, height: b }} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", left: -size * 0.42, top: -size * 0.42, width: size * 0.84, height: size * 0.84, borderRadius: size, backgroundColor: "rgba(255,246,214,0.85)" }, flash]} />
        {petals.map((p, i) => (
          <Petal key={i} t={t} a={p.a} d={p.d} size={p.s} color={p.color} spin={p.spin} />
        ))}
        {stars.map((p, i) => (
          <Star key={`s${i}`} t={t} a={p.a} d={p.d} size={p.s} />
        ))}
      </View>
    </View>
  );
}

/**
 * A piece flying from one window point to another: delivering to the order tray (an arc with a trail of light
 * motes), or sliding into a merge target (`arc` 0, short). `endScale` = its size on arrival relative to the start.
 */
export function Flyer({ piece, from, to, size, onDone, duration = 420, arc = 80, endScale = 0.55, trail = false }: {
  piece: string; from: { x: number; y: number }; to: { x: number; y: number }; size: number; onDone?: () => void; duration?: number; arc?: number; endScale?: number; trail?: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) });
    const id = setTimeout(() => onDone?.(), duration + 20);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => {
    const k = t.value;
    return {
      opacity: k > 0.92 ? (1 - k) / 0.08 : 1,
      transform: [{ translateX: from.x + (to.x - from.x) * k - size / 2 }, { translateY: from.y + (to.y - from.y) * k - arc * Math.sin(Math.PI * k) - size / 2 }, { scale: 1 - (1 - endScale) * k }],
    };
  });
  return (
    <>
      {trail ? [0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32].map((lag, i) => <TrailMote key={i} t={t} lag={lag} from={from} to={to} arc={arc} r={size * (0.26 - i * 0.026)} />) : null}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, st]}>
        <Image source={pieces[piece]} style={{ width: size, height: size }} />
      </Animated.View>
    </>
  );
}

function TrailMote({ t, lag, from, to, arc, r }: { t: SharedValue<number>; lag: number; from: { x: number; y: number }; to: { x: number; y: number }; arc: number; r: number }) {
  const st = useAnimatedStyle(() => {
    const k = Math.max(0, t.value - lag);
    return {
      opacity: t.value <= lag || k >= 0.98 ? 0 : 0.95 - lag * 1.4,
      transform: [{ translateX: from.x + (to.x - from.x) * k - r }, { translateY: from.y + (to.y - from.y) * k - arc * Math.sin(Math.PI * k) - r }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: "#FFE08A", borderWidth: Math.max(1, r * 0.25), borderColor: "#FFF8DC", shadowColor: "#FFC93A", shadowOpacity: 0.9, shadowRadius: 6 }, st]} />;
}

const styles = StyleSheet.create({
  petal: { position: "absolute", left: 0, top: 0 },
  spark: { position: "absolute", borderRadius: 999, backgroundColor: "#FFF6C8", borderWidth: 1, borderColor: "#FFC93A" },
});
