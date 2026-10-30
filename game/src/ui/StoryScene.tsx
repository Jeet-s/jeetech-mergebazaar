import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Background, type Scene } from "./Background";
import { GameButton } from "./GameButton";
import { Panel } from "./Panel";
import { Medallion } from "./StoryPopup";
import { Tappable } from "./Tappable";
import { fonts, palette, springs } from "./theme";
import { play, haptic } from "../audio/sfx";
import { CAST, type Beat } from "../game/meta";

/** How long a line stays before it turns the page by itself (reading time, 3.2-6.5 s). */
const readMs = (text: string) => Math.max(3200, Math.min(6500, 1600 + text.length * 38));

/**
 * The story beat before a level, as its own full-screen page (not a sheet over the board): the chapter scene behind a
 * deep wash, the speaker's medallion over a parchment letter, the whole line (never clipped), page dots and a thin
 * timer that turns the page by itself. Tap ANYWHERE for the next line; "Skip" (top right) ends it in one tap.
 *
 * Why (QA 2026-10-29): a translucent bottom sheet over the board was caught mid-fade with the toolbar labels and its
 * own buttons ghosted together, and it hid the board's bottom row. This page is opaque from its first frame (nothing
 * fades in from 0 — the card pops by scale), covers the whole game, and leaves by sliding up like a curtain, so no
 * frame ever shows two layers of text through each other. Only `onDone` (after the curtain is up) starts the level.
 */
export function StoryScene({ beat, scene = "bg_courtyard_dusk", tint, onDone, reduce }: {
  beat: Beat | null; scene?: Scene; tint?: string; onDone: (skipped: boolean) => void; reduce?: boolean;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [gone, setGone] = useState(!beat);
  const leaving = useRef(false);
  const curtain = useSharedValue(0);
  const card = useSharedValue(reduce ? 1 : 0.9);
  const lineX = useSharedValue(0);
  const timer = useSharedValue(0);
  const hint = useSharedValue(0);
  const line = beat ? beat.lines[Math.min(i, beat.lines.length - 1)] : null;
  const end = !!beat && i >= beat.lines.length - 1;

  useEffect(() => {
    if (!beat) return;
    setI(0);
    setGone(false);
    leaving.current = false;
    curtain.value = 0;
    card.value = reduce ? 1 : withSpring(1, springs.pop);
    hint.value = withRepeat(withSequence(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 650, easing: Easing.inOut(Easing.sin) })), -1);
    play("whoosh", 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  // a new line slides in from the right (transform only — the text is fully opaque on every frame)
  useEffect(() => {
    if (!beat || !line) return;
    if (i > 0 && !reduce) {
      lineX.value = withSequence(withTiming(36, { duration: 0 }), withSpring(0, springs.press));
      card.value = withSequence(withTiming(0.97, { duration: 60 }), withSpring(1, springs.pop));
    }
    if (end) {
      timer.value = 1;
      return;
    }
    const ms = readMs(line.text);
    timer.value = 0;
    timer.value = withTiming(1, { duration: ms, easing: Easing.linear });
    const id = setTimeout(() => next(), ms);
    return () => {
      clearTimeout(id);
      cancelAnimation(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, beat]);

  function next() {
    if (!beat || leaving.current) return;
    if (end) return close(false);
    play("tap", 0.6, 1.1);
    haptic("select");
    setI((k) => Math.min(k + 1, beat.lines.length - 1));
  }
  function close(skipped: boolean) {
    if (leaving.current) return;
    leaving.current = true;
    play("whoosh", 0.7);
    haptic("light");
    curtain.value = reduce ? 1 : withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) });
    // a JS timer (not an animation callback) hands over to the level, so the page can never stick over the board
    setTimeout(() => {
      setGone(true);
      onDone(skipped);
    }, reduce ? 60 : 400);
  }

  const pageSt = useAnimatedStyle(() => ({ transform: [{ translateY: -curtain.value * (height + 40) }] }));
  const cardSt = useAnimatedStyle(() => ({ transform: [{ scale: card.value }] }));
  const lineSt = useAnimatedStyle(() => ({ transform: [{ translateX: lineX.value }] }));
  const timerSt = useAnimatedStyle(() => ({ width: `${Math.round(timer.value * 100)}%` }));
  const hintSt = useAnimatedStyle(() => ({ transform: [{ translateX: hint.value * 6 }] }));

  if (!beat || gone || !line) return null;
  const who = CAST[line.who];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.page, pageSt]}>
      <Background scene={scene} tint={tint} dim={0.55} />
      <LinearGradient pointerEvents="none" colors={["rgba(16,12,48,0.55)", "rgba(16,12,48,0.25)", "rgba(30,12,4,0.7)"]} style={StyleSheet.absoluteFill} />
      <Tappable onPress={next} containerStyle={StyleSheet.absoluteFill} style={{ flex: 1 }} scaleTo={1} sound={null} hapticKind={null} accessibilityLabel="Next line">
        <View style={{ flex: 1 }} />
      </Tappable>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Tappable onPress={() => close(true)} style={styles.skip} scaleTo={0.9} accessibilityLabel="Skip story">
          <Text style={styles.skipText}>Skip</Text>
        </Tappable>
      </View>

      <View pointerEvents="box-none" style={[styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.ribbon} pointerEvents="none">
          <View style={styles.ribbonGlow} />
          <LinearGradient colors={["#454BB0", "#23266A"]} style={styles.ribbonFace}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>{beat.title}</Text>
          </LinearGradient>
        </View>

        <Animated.View style={[styles.cardWrap, cardSt]} pointerEvents="box-none">
          <Panel pad={18} style={styles.panel}>
            <Tappable onPress={next} scaleTo={0.98} sound={null} hapticKind={null} accessibilityLabel="Next line">
            <Animated.View style={[styles.body, lineSt]} pointerEvents="none">
              <View style={styles.speaker}>
                <Medallion who={line.who} size={76} />
                <Text style={styles.role} numberOfLines={2}>{who.role}</Text>
              </View>
              <Text style={styles.text}>{line.text}</Text>
            </Animated.View>
            </Tappable>
            <View style={styles.dots} pointerEvents="none">
              {beat.lines.map((_, k) => (
                <View key={k} style={[styles.dot, k < i && styles.dotOn, k === i && styles.dotNow]}>
                  {k === i ? <Animated.View style={[styles.dotFill, timerSt]} /> : null}
                </View>
              ))}
            </View>
            {end ? (
              <GameButton label="Let's go!" variant="primary" size="md" onPress={() => close(false)} />
            ) : (
              <Animated.View style={[styles.tapHint, hintSt]} pointerEvents="none">
                <Text style={styles.tapText}>Tap anywhere to continue  ›</Text>
              </Animated.View>
            )}
          </Panel>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { zIndex: 50, elevation: 50, backgroundColor: palette.secondaryDark },
  top: { position: "absolute", top: 0, right: 0, left: 0, alignItems: "flex-end", paddingHorizontal: 14 },
  skip: { backgroundColor: "rgba(26,28,77,0.85)", borderRadius: 20, borderWidth: 2, borderColor: palette.brass, paddingHorizontal: 18, minHeight: 44, justifyContent: "center" },
  skipText: { fontFamily: fonts.display, fontSize: 17, color: palette.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  ribbon: { alignItems: "center", justifyContent: "center", marginBottom: -14, zIndex: 2 },
  ribbonGlow: { position: "absolute", width: 260, height: 90, borderRadius: 60, backgroundColor: "rgba(255,196,84,0.28)" },
  ribbonFace: { minWidth: 220, paddingHorizontal: 28, height: 52, borderRadius: 16, borderWidth: 3, borderColor: palette.brass, justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 26, color: palette.cream, textAlign: "center", textShadowColor: "#0E0F33", textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
  cardWrap: { width: "100%", maxWidth: 420 },
  panel: { paddingTop: 34 },
  body: { alignItems: "center", gap: 10 },
  speaker: { alignItems: "center" },
  role: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 4, textAlign: "center" },
  text: { fontFamily: fonts.body, fontSize: 18, lineHeight: 25, color: palette.ink, textAlign: "center", alignSelf: "stretch" },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginVertical: 14 },
  dot: { width: 22, height: 7, borderRadius: 4, backgroundColor: "rgba(122,82,64,0.22)", overflow: "hidden" },
  dotOn: { backgroundColor: palette.primaryDark },
  dotNow: { backgroundColor: "rgba(194,110,10,0.3)" },
  dotFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: palette.primaryDark },
  tapHint: { alignSelf: "center", minHeight: 48, justifyContent: "center" },
  tapText: { fontFamily: fonts.display, fontSize: 16, color: palette.primaryDark },
});
