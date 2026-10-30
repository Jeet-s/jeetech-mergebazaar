import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Popup } from "./Popup";
import { GameButton } from "./GameButton";
import { fonts, palette, springs } from "./theme";
import { Tappable } from "./Tappable";
import { pieces } from "../pieces";
import { CAST, type Beat, type Speaker } from "../game/meta";

/** Portrait art per cast member, if the art set has it (assets/art/ui/cast_<id>.png); else the keepsake medallion. */
const PORTRAITS: Partial<Record<Speaker, number>> = {};

/**
 * A cast member's medallion: a brass-ringed cameo in their colour with a soft inner glow, their keepsake (Dadi's
 * brass diya, Aarav's key…) painted large in the middle, and a name plate below. Everything stays inside the ring.
 */
export function Medallion({ who, size = 64, label = true }: { who: Speaker; size?: number; label?: boolean }) {
  const c = CAST[who];
  const face = size - 10;
  const portrait = PORTRAITS[who];
  return (
    <View style={{ alignItems: "center", width: size + 24 }}>
      <LinearGradient colors={["#FBE3A0", "#C98A2A", "#8A5418"]} style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.face, { width: face, height: face, borderRadius: face / 2, backgroundColor: c.color }]}>
          <LinearGradient colors={["rgba(255,241,214,0.55)", "rgba(255,241,214,0)"]} start={{ x: 0.3, y: 0.1 }} end={{ x: 0.6, y: 0.9 }} style={StyleSheet.absoluteFill} />
          {portrait ? (
            <Image source={portrait} style={{ width: face, height: face }} />
          ) : (
            <Image source={pieces[c.piece]} style={{ width: face * 0.86, height: face * 0.86, marginTop: face * 0.04 }} />
          )}
        </View>
      </LinearGradient>
      {label ? (
        <View style={styles.plate}>
          <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Story reader: one line at a time (tap to continue), always skippable in one tap. A compact strip (speaker
 * medallion beside the speech bubble) low over a lightly dimmed board, so the level it leads into — its stalls
 * included — stays visible above it; it slides away into play. A new line nudges in on a stable view (no remounting
 * `entering`, never from opacity 0).
 */
export function StoryPopup({ beat, onDone }: { beat: Beat | null; onDone: (skipped: boolean) => void }) {
  const [i, setI] = useState(0);
  const last = useRef<Beat | null>(beat);
  if (beat) last.current = beat;
  useEffect(() => {
    if (beat) setI(0);
  }, [beat]);
  const o = useSharedValue(1);
  const y = useSharedValue(0);
  useEffect(() => {
    // transform only: the line is fully opaque on every frame (no half-faded text over the scene)
    o.value = 1;
    y.value = 10;
    y.value = withSpring(0, springs.press);
  }, [i, beat, o, y]);
  const lineSt = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  const b = beat ?? last.current;
  if (!b) return null;
  const line = b.lines[Math.min(i, b.lines.length - 1)];
  const end = i >= b.lines.length - 1;
  return (
    <Popup
      visible={!!beat}
      title={b.title}
      placement="bottom"
      dim={0.38}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!end ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Skip" onPress={() => onDone(true)} /> : null}
          <GameButton style={{ flex: 2 }} size="sm" label={end ? "Let's go!" : "Next"} variant="primary" onPress={() => (end ? onDone(false) : setI(i + 1))} />
        </View>
      }
    >
      <Tappable onPress={() => (end ? undefined : setI(i + 1))} scaleTo={0.98} sound="tap" hapticKind="select" style={styles.body}>
        <Animated.View style={[styles.line, lineSt]}>
          <Medallion who={line.who} size={50} label={false} />
          <View style={styles.bubble}>
            <Text style={styles.role} numberOfLines={1}>{CAST[line.who].name} · {CAST[line.who].role}</Text>
            <Text style={styles.text}>{line.text}</Text>
          </View>
        </Animated.View>
        <View style={styles.dots}>
          {b.lines.map((_, k) => (
            <View key={k} style={[styles.dot, k <= i && styles.dotOn]} />
          ))}
        </View>
      </Tappable>
    </Popup>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#6A3A0E" },
  face: { alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#FFF6E0", overflow: "hidden" },
  plate: { marginTop: -8, backgroundColor: "#2B2F77", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 2, borderColor: "#D9A441" },
  name: { fontFamily: fonts.display, fontSize: 14, color: "#FFF1D6" },
  body: { alignItems: "center", gap: 8, paddingBottom: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "stretch" },
  bubble: { flex: 1, minWidth: 0, flexShrink: 1, backgroundColor: "#FFFBF0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: "#E0C79A", minHeight: 70, justifyContent: "center" },
  role: { fontFamily: fonts.bodyRegular, fontSize: 11, color: palette.inkSoft, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: palette.ink },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(122,82,64,0.25)" },
  dotOn: { backgroundColor: palette.primaryDark },
});
