import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Popup } from "./Popup";
import { Stars } from "./Stars";
import { GameButton } from "./GameButton";
import { AnimatedNumber } from "./AnimatedNumber";
import { Confetti } from "../fx/Confetti";
import { fonts, palette, springs } from "./theme";
import { play, haptic } from "../audio/sfx";
import { share } from "../modules/share";
import { qa } from "../modules/qa";
import { pieces } from "../pieces";
import { art } from "../art";

/** Slowly turning light burst + warm bloom behind the stars (or the fail art). `warm=false` = a cooler, dimmer glow. */
function Glow({ size, warm = true, reduce }: { size: number; warm?: boolean; reduce?: boolean }) {
  const r = useSharedValue(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    if (!reduce) r.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
  }, [r, p, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: p.value * (warm ? 0.95 : 0.45), transform: [{ rotate: `${r.value * 360}deg` }, { scale: 0.6 + 0.4 * p.value }] }));
  return (
    <View pointerEvents="none" style={[styles.glowWrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      <View style={[styles.bloom, { width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: warm ? "rgba(255,206,84,0.38)" : "rgba(120,140,220,0.22)" }]} />
      <Animated.View style={[StyleSheet.absoluteFill, st]}>
        <Image source={art.fx_sparkle_glow} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/**
 * Level complete: a turning light burst behind the Marigold stars, which stamp in one by one with rising chimes;
 * petal confetti; the Lamp reward counts up from 0 with coin ticks the moment the card lands (never a static "+0").
 * The layout is fixed from the first frame (every row has its space reserved — nothing reflows as the numbers or
 * the heirloom card appear). `extra` shows what else the win unlocked (an heirloom, a story teaser). A labelled
 * "Share" button (src/modules/share.ts) sits next to Replay/Home — hidden in QA level replay.
 */
export function WinPopup({ visible, stars, coins, onNext, onReplay, onMap, title = "Level Complete!", nextLabel = "Next Level", showShare = true, extra, subtitle, reduceMotion, placement = "center", dim }: {
  visible: boolean; stars: number; coins: number; onNext: () => void; onReplay?: () => void; onMap?: () => void; title?: string; nextLabel?: string; showShare?: boolean; extra?: React.ReactNode; subtitle?: string; reduceMotion?: boolean;
  /** "bottom" + a light `dim`: the card rises from the bottom and the lit, finished board stays visible above it. */
  placement?: "center" | "bottom"; dim?: number;
}) {
  const [burst, setBurst] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setRound((r) => r + 1);
    play("success");
    haptic("success");
    // petal waves keep the card alive for ~5 s: the first with the card, then one per landed star beat and a last
    // shower as the Lamps finish counting (alternating sides)
    const ids = [180, 1250, 2500, 3900].map((ms) => setTimeout(() => setBurst((b) => b + 1), ms));
    return () => ids.forEach(clearTimeout);
  }, [visible]);
  const { width: sw, height: sh } = useWindowDimensions();
  const side = burst % 3 === 2 ? 0.22 : burst % 3 === 0 ? 0.78 : 0.5;
  // beats: the card pops → stars stamp one by one → the Lamps row springs up and counts → the extra slides in
  const starDelay = reduceMotion ? 120 : 380;
  const rowDelay = reduceMotion ? 150 : starDelay + Math.max(1, stars) * 300 + 120;
  const countDelay = rowDelay; // the count starts the instant its row lands: never a static "+0"
  const countMs = reduceMotion ? 400 : 1100;
  return (
    <>
      <Popup
        visible={visible}
        title={title}
        placement={placement}
        dim={dim}
        // petals burst BEHIND the card (over the dim): never over the title, subtitle or the numbers
        underlay={visible ? <Confetti trigger={reduceMotion ? 0 : burst} origin={{ x: sw * side, y: sh * 0.4 }} /> : null}
        footer={
          <>
            <Breathe reduce={reduceMotion}>
              <GameButton label={nextLabel} variant="primary" size="lg" sound="whoosh" onPress={onNext} />
            </Breathe>
            <View style={styles.row}>
              {onReplay ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Replay" onPress={onReplay} /> : null}
              {onMap ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Home" onPress={onMap} /> : null}
              {showShare && qa.level == null ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Share" onPress={() => void share.app("win")} /> : null}
            </View>
          </>
        }
      >
        {/* the light burst stays inside the stars band (clipped), so it never covers the subtitle above it */}
        {subtitle ? <Text style={styles.sub} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{subtitle}</Text> : null}
        <View style={styles.starsBox}>
          <View pointerEvents="none" style={styles.glowClip}>
            {visible ? <Glow key={round} size={190} reduce={reduceMotion} /> : null}
          </View>
          <Stars key={round} count={stars} animate={visible} size={54} delay={starDelay} />
        </View>
        <Reveal key={`r${round}`} show={visible} delay={rowDelay}>
        <View style={styles.reward}>
          <Image source={pieces.cur_lamp} style={{ width: 40, height: 40 }} />
          <Text style={styles.plus}>+</Text>
          <View style={[styles.num, { minWidth: 18 * String(coins).length }]}>
            <AnimatedNumber
              key={round}
              from={0}
              value={visible ? coins : 0}
              delay={countDelay}
              duration={countMs}
              style={styles.coinText}
              onTick={(t) => {
                play("coin", 0.35 + 0.4 * t, 0.9 + t * 0.5);
                if (t >= 1) haptic("medium");
                else haptic("select");
              }}
            />
          </View>
          <Text style={styles.unit}>Lamps</Text>
        </View>
        </Reveal>
        {extra ? (
          <Reveal key={`x${round}`} show={visible} delay={countDelay + countMs * 0.6} from="right">
            {extra}
          </Reveal>
        ) : null}
      </Popup>
    </>
  );
}

/**
 * A row of the win card that arrives on its own beat: it sits (space reserved, nothing reflows) scaled down and
 * slid aside, then springs in at `delay` ms. Transform only — never faded in from 0 on a remounting view.
 */
function Reveal({ show, delay, from = "below", children }: { show: boolean; delay: number; from?: "below" | "right"; children: React.ReactNode }) {
  const v = useSharedValue(show ? 0 : 1);
  useEffect(() => {
    if (!show) return;
    v.value = 0;
    v.value = withDelay(delay, withSpring(1, springs.pop));
  }, [show, delay, v]);
  const st = useAnimatedStyle(() => ({
    opacity: v.value > 0.02 ? 1 : 0,
    transform: from === "right" ? [{ translateX: (1 - v.value) * 120 }, { scale: 0.85 + 0.15 * v.value }] : [{ translateY: (1 - v.value) * 24 }, { scale: 0.6 + 0.4 * v.value }],
  }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/**
 * The main action keeps inviting a tap with a soft light sweep across its face every couple of seconds. Never a
 * scale or width change (QA 2026-10-29: a 4 % "breathing" swell read as the button jittering between win frames):
 * the sweep is clipped to the button's own pill, so its box is identical in every frame.
 */
function Breathe({ children, reduce }: { children: React.ReactNode; reduce?: boolean }) {
  const b = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!reduce) b.value = withDelay(1400, withRepeat(withSequence(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), withDelay(1500, withTiming(0, { duration: 0 }))), -1, false));
  }, [b, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: b.value > 0 && b.value < 1 ? 1 : 0, transform: [{ translateX: -80 + b.value * (w + 160) }, { skewX: "-20deg" }] }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {children}
      {w ? (
        <View pointerEvents="none" style={styles.sweepClip}>
          <Animated.View style={[styles.sweep, st]} />
        </View>
      ) : null}
    </View>
  );
}

/** Slow "breathing" of the unlit diya on the fail card. */
function DimDiya() {
  const b = useSharedValue(0);
  useEffect(() => {
    b.value = withDelay(300, withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1, false));
  }, [b]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 0.97 + b.value * 0.05 }] }));
  return (
    <Animated.View style={st}>
      <Image source={pieces.L1} style={styles.failArt} />
    </Animated.View>
  );
}

/**
 * Level failed / stuck ("Out of moves"): the same parchment card family as the win, a one-line reason, then the
 * free fixes first — Undo the last move, Retry the board — and an optional opt-in "+3 Sparks" rewarded ad. Never
 * forces an ad. `gift` = a line about a free booster Dadi just gave (third fail).
 */
export function FailPopup({ visible, title = "Out of moves", message = "So close! Undo a step or try the board again.", gift, onRetry, onContinue, continueLabel = "+3 Sparks (watch ad)", onUndo, onMap }: {
  visible: boolean; title?: string; message?: string; gift?: string | null; onRetry: () => void; onContinue?: () => void; continueLabel?: string; onUndo?: () => void; onMap?: () => void;
}) {
  useEffect(() => {
    if (visible) {
      play("fail");
      haptic("warning");
    }
  }, [visible]);
  return (
    <Popup
      visible={visible}
      title={title}
      footer={
        <>
          <GameButton label="Retry" variant="primary" size="lg" onPress={onRetry} />
          <View style={styles.row}>
            {onUndo ? <GameButton style={{ flex: 1 }} size="sm" variant="light" glyph="undo" label="Undo move" onPress={onUndo} /> : null}
            {onMap ? <GameButton style={{ flex: onUndo ? 0.7 : 1 }} size="sm" variant="light" glyph="home" label="Home" onPress={onMap} /> : null}
          </View>
          {onContinue ? <GameButton style={{ marginTop: 12 }} label={continueLabel} variant="accent" size="sm" onPress={onContinue} /> : null}
        </>
      }
    >
      <View style={styles.failBox}>
        {visible ? <Glow size={170} warm={false} /> : null}
        <DimDiya />
      </View>
      <Text style={styles.msg}>{message}</Text>
      {gift ? (
        <View style={styles.gift}>
          <Text style={styles.giftText}>{gift}</Text>
        </View>
      ) : null}
    </Popup>
  );
}

const styles = StyleSheet.create({
  starsBox: { height: 112, alignItems: "center", justifyContent: "center", marginTop: 4 },
  glowClip: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden", borderRadius: 24 },
  glowWrap: { position: "absolute", left: "50%", top: "50%", alignItems: "center", justifyContent: "center" },
  bloom: { position: "absolute" },
  reward: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: 8, backgroundColor: "rgba(122,74,18,0.12)", borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(122,74,18,0.25)" },
  num: { alignItems: "flex-start" },
  plus: { fontFamily: fonts.display, fontSize: 26, color: palette.primaryDark },
  coinText: { fontFamily: fonts.display, fontSize: 30, color: palette.primaryDark, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: fonts.body, fontSize: 15, color: palette.inkSoft, marginLeft: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  msg: { fontFamily: fonts.body, fontSize: 16, color: palette.inkSoft, textAlign: "center", marginBottom: 6 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: palette.ink, textAlign: "center", backgroundColor: "rgba(255,246,224,0.9)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "center", zIndex: 2 },
  sweepClip: { position: "absolute", left: 3, right: 3, top: 2, height: 62, borderRadius: 31, overflow: "hidden" },
  sweep: { position: "absolute", top: 0, bottom: 0, left: 0, width: 46, backgroundColor: "rgba(255,255,255,0.38)" },
  failBox: { height: 110, alignItems: "center", justifyContent: "center" },
  failArt: { width: 88, height: 88, opacity: 0.8, tintColor: undefined },
  gift: { alignSelf: "center", backgroundColor: "#1F9E8F", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: "#FFF6E0", marginTop: 4 },
  giftText: { fontFamily: fonts.body, fontSize: 14, color: "#FFF6E0", textAlign: "center" },
});
