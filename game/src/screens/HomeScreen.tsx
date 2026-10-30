import { useEffect, useMemo, useState } from "react";
import { Tappable } from "../ui/Tappable";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, RoundButton, feedback, fonts } from "../ui";
import { art } from "../art";
import { decor, glyphs } from "../pieces";
import { store } from "../modules/store";
import { useBannerHeight } from "../modules/layout";
import {
  SCENE_OF, TASKS, allDone, chapterProgress, currentLevel, festivalClaimable, giftReady, heirloomsNew, meta, nextBeat, nextTask, starsAvailable,
} from "../game/meta";

/** What the chapter card showed last time Home was on screen: a win since then animates in from there. */
let lastHome = { chapter: 0, done: -1 };

/**
 * HOME = the title screen. Dadi's courtyard at dusk (the chapter's scene) with living lamps and drifting petals,
 * the logo, everything restored so far standing in the scene, currencies, chapter progress and ONE big
 * "Play · Level N". Levels / Shop / Settings are the round buttons below; two columns of round buttons sit at the
 * scene's edges (Daily gift, Story, Bazaar Day | Decorate, Heirlooms, Festival) and a small "Restore progress" pill
 * sits between the currencies.
 * Layout is computed from the real space: on short phones (360x640) the logo shrinks to fit between the side
 * columns, which then start right under the currency bar; nothing overlaps the chapter card.
 */
export function HomeScreen({ onPlay, onLevels, onShop, onSettings, onRestore, onGift, onStory, onHeirlooms, onBazaarDay, onFestival, onSaveProgress, bazaarDone }: {
  onPlay: (levelNumber: number) => void; onLevels: () => void; onShop: () => void; onSettings: () => void;
  onRestore?: () => void; onGift?: () => void; onStory?: () => void; onHeirlooms?: () => void;
  onBazaarDay?: () => void; onFestival?: () => void; onSaveProgress?: () => void; bazaarDone?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bannerH = useBannerHeight();
  const { width, height } = useWindowDimensions();
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  const [bottomTop, setBottomTop] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const s = store.get();
  const level = currentLevel();
  const finished = allDone();
  const cp = chapterProgress(level);
  const scene = SCENE_OF[cp.chapter.n];
  const task = nextTask(cp.chapter.n);
  const beat = nextBeat();
  const restored = TASKS.filter((t) => t.chapter === cp.chapter.n && meta().rooms[t.id] !== undefined);
  // FTUE: no red dots before the first level is won; afterwards only for something really claimable / new.
  const started = s.level >= 2;

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + float.value * 10 }, { rotate: `${-1 + float.value * 2}deg` }] }));

  // progress since the last visit fills in (and the count pops), so a win visibly moves the chapter forward
  const from = lastHome.chapter === cp.chapter.n && lastHome.done >= 0 && lastHome.done <= cp.done ? lastHome.done : cp.done;
  const fill = useSharedValue(from / cp.total);
  const countPop = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(550, withTiming(cp.done / cp.total, { duration: 900, easing: Easing.out(Easing.cubic) }));
    if (cp.done > from) {
      countPop.value = withDelay(1350, withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 380 })));
      setTimeout(() => feedback("star2", "light"), 1350);
    }
    lastHome = { chapter: cp.chapter.n, done: cp.done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp.chapter.n, cp.done]);
  const fillSt = useAnimatedStyle(() => ({ width: `${Math.max(5, fill.value * 100)}%` }));
  const countSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 + countPop.value * 0.45 }] }));
  // enough stars for the next restore: the card says so and a pulsing "Restore!" chip takes the player there
  const canRestore = started && !finished && !!task && starsAvailable() >= task.cost;
  const chip = useSharedValue(0);
  useEffect(() => {
    chip.value = canRestore ? withDelay(1500, withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })), -1)) : 0;
  }, [canRestore, chip]);
  // the chip calls with a pulsing gold rim around it — its own size never changes (no scale-breathing CTAs)
  const chipSt = useAnimatedStyle(() => ({ opacity: chip.value }));

  /* ── layout from the real space ── */
  const compact = height < 700;
  const hudBottom = insets.top + 8 + 40;
  const estBottom = height - (insets.bottom + bannerH + (compact ? 262 : 300));
  const bTop = bottomTop ?? estBottom;
  const fullLogoW = Math.min(width * 0.8, 400);
  const fullLogoH = fullLogoW * (391 / 900) + 24;
  const LABEL = 18, GAP = compact ? 8 : 12;
  const colNeed = (size: number) => 3 * (size + 4 + LABEL) + 2 * GAP;
  const belowLogo = hudBottom + 6 + fullLogoH + 6;
  const roomBelow = bTop - belowLogo - 8;
  let btn = 54;
  let logoW = fullLogoW;
  let colTop = belowLogo;
  if (roomBelow < colNeed(48)) {
    // Not enough room under the logo: the columns start under the currency bar, the logo fits between them.
    colTop = hudBottom + 10;
    const avail = bTop - colTop - 8;
    btn = Math.max(44, Math.min(54, Math.floor((avail - 2 * GAP) / 3 - 4 - LABEL)));
    const colW = Math.max(btn, 66) + 12;
    logoW = Math.min(fullLogoW, width - 2 * colW - 4);
  } else {
    btn = Math.min(60, Math.max(48, Math.floor((roomBelow - 2 * GAP) / 3 - 4 - LABEL)));
  }
  const logoH = logoW * (391 / 900);
  const sub = logoW < 260 ? 15 : 20;

  return (
    <View style={styles.root}>
      <Background scene={scene.scene} tint={scene.tint} dim={0.05} />
      {scene.scene === "bg_courtyard_dusk" ? <LampGlows width={width} height={height} /> : null}
      <Petals width={width} height={height} />
      {/* restored decor stands in the scene, softly lit */}
      {restored.map((t, i) => (
        <Decor key={t.id} piece={t.options[meta().rooms[t.id]].piece} x={width * (0.12 + t.x * 0.76)} y={height * (0.47 + t.y * 0.13)} size={Math.min(76, width * 0.19)} delay={i * 260} />
      ))}
      <LinearGradient pointerEvents="none" colors={["rgba(14,12,50,0.75)", "rgba(14,12,50,0)"]} style={[styles.topScrim, { height: insets.top + 260 }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(30,12,4,0)", "rgba(30,12,4,0.88)"]} style={[styles.bottomScrim, { height: 330 + insets.bottom + bannerH }]} />

      <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        <CurrencyPill icon="cur_star" value={starsAvailable()} onPress={onRestore} />
        <Tappable
          onPress={() => {
            onSaveProgress?.();
          }}
          hitSlop={8}
          style={styles.savePill}
          accessibilityLabel="Restore progress"
        >
          <Image source={glyphs.book} style={{ width: 18, height: 18 }} />
          <Text style={styles.saveText} numberOfLines={2}>{width < 400 ? "Restore\nprogress" : "Restore progress"}</Text>
        </Tappable>
        <CurrencyPill icon="cur_lamp" value={s.coins} onPress={onShop} />
      </View>

      <Animated.View entering={FadeInDown.duration(600)} style={[styles.logoWrap, { marginTop: 6 }]} pointerEvents="none">
        <Animated.View style={[{ alignItems: "center" }, logoStyle]}>
          <Image source={art.logo} style={{ width: logoW, height: logoH }} resizeMode="contain" />
          <View style={styles.subRibbon}>
            <Text style={[styles.subtitle, { fontSize: sub }]}>Festival Homes</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* side columns on the scene */}
      <View style={[styles.side, { left: 6, top: colTop, gap: GAP }]}>
        <RoundButton glyph="gift" label="Daily gift" size={btn} dot={started && giftReady()} onPress={() => onGift?.()} />
        <RoundButton glyph="story" label="Story" size={btn} dot={started && !!beat && !meta().storySeen.includes(beat.id) && beat.level <= level} onPress={() => onStory?.()} />
        <RoundButton
          piece="Mb"
          label={bazaarDone ? "Done today ✓" : "Bazaar Day"}
          size={btn}
          dot={started && !bazaarDone}
          onPress={() => {
            if (bazaarDone) setToast("Bazaar Day done today ✓ · back tomorrow for a new board");
            else onBazaarDay?.();
          }}
        />
      </View>
      <View style={[styles.side, { right: 6, top: colTop, gap: GAP }]}>
        <RoundButton glyph="decor" label="Decorate" size={btn} dot={started && !!task && starsAvailable() >= task.cost} onPress={() => onRestore?.()} />
        <RoundButton glyph="book" label="Heirlooms" size={btn} dot={started && heirloomsNew() > 0} onPress={() => onHeirlooms?.()} />
        <RoundButton piece="F4" label="Festival" size={btn} dot={started && festivalClaimable() > 0} onPress={() => onFestival?.()} />
      </View>

      <View style={{ flex: 1 }} pointerEvents="none" />

      {toast ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={[styles.toast, { top: Math.max(colTop, bTop - 64) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <View
        style={[styles.bottom, { width: Math.min(width, 540), alignSelf: "center", gap: compact ? 8 : 12, paddingBottom: Math.max(insets.bottom, 10) + bannerH + (compact ? 6 : 12) }]}
        onLayout={(e) => setBottomTop(e.nativeEvent.layout.y)}
      >
        <Animated.View entering={FadeInUp.delay(150).duration(450)} style={[styles.chapterCard, compact && { paddingVertical: 7, gap: 4 }]}>
          <View style={styles.chapterTop}>
            <Text style={styles.chapterName} numberOfLines={1}>Chapter {cp.chapter.n} · {cp.chapter.name}</Text>
            <Animated.Text style={[styles.chapterCount, countSt]}>{cp.done}/{cp.total}</Animated.Text>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillSt]}>
              <LinearGradient colors={["#FFE07A", "#F6A81C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <View style={styles.chapterBottom}>
            <Text style={[styles.chapterNext, { flex: 1 }]} numberOfLines={2}>
              {finished ? "Every lamp is lit — replay any level from the map." : canRestore && task ? `Stars ready: ${task.name}!` : task ? `Next restore: ${task.name} · ${task.cost}★` : beat ? `Story at level ${beat.level}: ${beat.title}` : `${scene.place} is fully restored!`}
            </Text>
            {canRestore ? (
              <View>
                <Animated.View pointerEvents="none" style={[styles.chipRim, chipSt]} />
                <Tappable onPress={() => onRestore?.()} style={styles.restoreChip} scaleTo={0.9} accessibilityLabel="Restore now">
                  <Text style={styles.restoreText} numberOfLines={1}>Restore! {task!.cost}★</Text>
                </Tappable>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(250)} style={styles.playWrap}>
          {/* the Play button calls with a light sweep only (its size never breathes); GameButton gives the press */}
          <View>
            <PlayShine />
            <GameButton
              label={finished ? (bazaarDone ? "Replay · Level 64" : "Play · Bazaar Day") : `Play · Level ${level}`}
              variant="primary"
              size="lg"
              sound="whoosh"
              onPress={() => {
                // the press (sink + glow flash) is seen for a beat before the board opens
                if (going) return;
                setGoing(true);
                setTimeout(() => (finished && !bazaarDone && onBazaarDay ? onBazaarDay() : onPlay(level)), 200);
                setTimeout(() => setGoing(false), 1200);
              }}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[styles.iconRow, { gap: width < 380 ? 26 : 34 }]}>
          <RoundButton glyph="map" label="Levels" size={compact ? 54 : 60} onPress={onLevels} />
          <RoundButton glyph="shop" label="Shop" size={compact ? 54 : 60} onPress={onShop} />
          <RoundButton glyph="gear" label="Settings" size={compact ? 54 : 60} onPress={onSettings} />
        </Animated.View>
      </View>
    </View>
  );
}

function Decor({ piece, x, y, size, delay }: { piece: string; x: number; y: number; size: number; delay: number }) {
  const g = useSharedValue(0);
  useEffect(() => {
    g.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [g, delay]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + g.value * 0.45, transform: [{ scale: 0.9 + g.value * 0.15 }] }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      <Animated.View style={[{ position: "absolute", left: -size * 0.3, top: -size * 0.3 }, glow]}>
        <Image source={art.fx_sparkle_glow} style={{ width: size * 1.6, height: size * 1.6, opacity: 0.6 }} />
      </Animated.View>
      <Image source={decor[piece]} style={{ width: size, height: size }} />
    </View>
  );
}

/** A soft light sweep across the Play button every few seconds (the button "calls" the player). */
function PlayShine() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(1200, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withDelay(2400, withTiming(0, { duration: 0 }))), -1));
  }, [t]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: -120 + t.value * 560 }, { rotate: "18deg" }] }));
  return (
    <View pointerEvents="none" style={styles.shineClip}>
      <Animated.View style={[styles.shineBand, st]} />
    </View>
  );
}

/** The string-light bulbs painted in bg_courtyard_dusk (art px, 1080x1920). */
const BULBS: [number, number][] = [
  [115, 355], [237, 385], [380, 412], [525, 420], [712, 405], [850, 378], [983, 342],
  [50, 560], [140, 585], [238, 606], [343, 627], [470, 625], [600, 601], [718, 573], [843, 546], [947, 516], [1063, 469],
];
/**
 * Warm flicker ON the scene's own painted bulbs (mapped through Background's cover crop), so each glow sits exactly on
 * a lamp: a small crisp core + tight halo. No large translucent discs floating in the scene (QA 2026-10-30: soft
 * blobs over the doorway read as a smeared rendering artifact).
 */
function LampGlows({ width, height }: { width: number; height: number }) {
  const spots = useMemo(() => {
    const k = Math.max(width / 1080, height / 1920);
    const ox = (width - 1080 * k) / 2, oy = (height - 1920 * k) / 2;
    return BULBS.map(([bx, by], i) => ({ x: ox + bx * k, y: oy + by * k, d: (i * 530) % 1700 })).filter((p) => p.x > 4 && p.x < width - 4);
  }, [width, height]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {spots.map((p, i) => (
        <Glow key={i} x={p.x} y={p.y} delay={p.d} />
      ))}
    </View>
  );
}
function Glow({ x, y, delay }: { x: number; y: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400 + (delay % 500), easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.65, transform: [{ scale: 0.85 + t.value * 0.3 }] }));
  return (
    <Animated.View style={[styles.glow, { left: x - 14, top: y - 14 }, st]}>
      <View style={styles.glowHalo} />
      <View style={styles.glowCore} />
    </Animated.View>
  );
}

/** Marigold petals drifting down through the scene (idle motion). */
function Petals({ width, height }: { width: number; height: number }) {
  const ps = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ x: (i * 0.37) % 1, d: i * 900, dur: 7000 + (i % 4) * 1400, c: ["#F6A81C", "#FFD24A", "#E8590C", "#D8433B"][i % 4] })), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ps.map((p, i) => (
        <Petal key={i} x={p.x * width} h={height} delay={p.d} dur={p.dur} color={p.c} />
      ))}
    </View>
  );
}
function Petal({ x, h, delay, dur, color }: { x: number; h: number; delay: number; dur: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1));
  }, [t, delay, dur]);
  const st = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value * 10 : t.value > 0.85 ? (1 - t.value) / 0.15 : 0.9,
    transform: [{ translateX: x + Math.sin(t.value * 12) * 22 }, { translateY: -20 + t.value * (h * 0.75) }, { rotate: `${t.value * 720}deg` }],
  }));
  return <Animated.View style={[styles.petal, { backgroundColor: color }, st]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  hud: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, gap: 6 },
  logoWrap: { alignItems: "center" },
  savePill: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40, marginTop: 1, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 18, backgroundColor: "rgba(26,28,77,0.88)", borderWidth: 2, borderColor: "#D9A441", flexShrink: 1, maxWidth: 150 },
  saveText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 14, color: "#FFF1D6", flexShrink: 1, textAlign: "center" },
  toast: { position: "absolute", left: 24, right: 24, alignItems: "center", backgroundColor: "rgba(26,28,77,0.94)", borderRadius: 16, borderWidth: 2, borderColor: "#D9A441", paddingVertical: 10, paddingHorizontal: 12 },
  toastText: { fontFamily: fonts.body, fontSize: 14, color: "#FFF1D6", textAlign: "center" },
  subRibbon: { marginTop: -10, backgroundColor: "rgba(26,28,77,0.88)", paddingHorizontal: 18, paddingVertical: 3, borderRadius: 12, borderWidth: 2, borderColor: "#D9A441" },
  subtitle: { fontFamily: fonts.display, fontSize: 20, color: "#FFF1D6", letterSpacing: 0.5 },
  side: { position: "absolute", alignItems: "center", width: 74 },
  bottom: { paddingHorizontal: 22, gap: 12 },
  chapterCard: { backgroundColor: "rgba(26,28,77,0.86)", borderRadius: 18, borderWidth: 2.5, borderColor: "#D9A441", paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chapterTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chapterName: { fontFamily: fonts.display, fontSize: 16, color: "#FFF1D6", flex: 1 },
  chapterCount: { fontFamily: fonts.display, fontSize: 15, color: "#FFC93A" },
  track: { height: 12, borderRadius: 6, backgroundColor: "#12133A", borderWidth: 1.5, borderColor: "#7A4A12", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 6, overflow: "hidden" },
  chapterNext: { fontFamily: fonts.bodyRegular, fontSize: 13, color: "rgba(255,241,214,0.85)" },
  chapterBottom: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  restoreChip: { backgroundColor: "#2E9A45", borderRadius: 16, borderWidth: 2, borderColor: "#FFE9A8", paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  chipRim: { position: "absolute", left: -4, right: -4, top: -4, bottom: -4, borderRadius: 20, borderWidth: 3, borderColor: "#FFE07A", backgroundColor: "rgba(255,214,90,0.25)" },
  restoreText: { fontFamily: fonts.display, fontSize: 15, color: "#FFF6E0" },
  playWrap: { alignSelf: "stretch" },
  iconRow: { flexDirection: "row", justifyContent: "center", gap: 34 },
  glow: { position: "absolute", width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  glowHalo: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,150,40,0.45)" },
  glowCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFD873", borderWidth: 1, borderColor: "#FFF6D8" },
  shineClip: { position: "absolute", left: 4, right: 4, top: 2, height: 60, borderRadius: 16, overflow: "hidden", zIndex: 2 },
  shineBand: { position: "absolute", top: -30, width: 46, height: 130, backgroundColor: "rgba(255,255,240,0.35)" },
  petal: { position: "absolute", left: 0, top: 0, width: 10, height: 6, borderRadius: 5 },
});
