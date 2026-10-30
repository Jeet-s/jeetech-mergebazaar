import { useEffect, useState } from "react";
import { Tappable } from "../ui/Tappable";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Background, Confetti, CurrencyPill, FloatingText, GameButton, Popup, RoundButton, feedback, fonts, palette, play } from "../ui";
import { art } from "../art";
import { decor, pieces } from "../pieces";
import { store } from "../modules/store";
import { useBannerHeight } from "../modules/layout";
import { CHAPTERS } from "../game/levels";
import { SCENE_OF, TASKS, chapterOfLevel, chapterRestored, chapterUnlocked, currentLevel, meta, restore, starsAvailable, type RestoreTask } from "../game/meta";

/**
 * Home restoration: each chapter's place (Dadi's courtyard, Meera's loom room, Imran's lane, the pavilion, the Mela)
 * with six restore tasks. Marigold stars from levels unlock a task; the player picks one of three decor styles
 * (style only, no power) and it appears in the scene, lit. The sixth task triggers the lighting ceremony.
 */
export function RestoreScreen({ onBack, onPlay }: { onBack: () => void; onPlay: () => void }) {
  const insets = useSafeAreaInsets();
  const bannerH = useBannerHeight();
  const { width, height } = useWindowDimensions();
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  const [ch, setCh] = useState(chapterOfLevel(currentLevel()).n);
  const [pick, setPick] = useState<RestoreTask | null>(null);
  const [ceremony, setCeremony] = useState(0);
  const [flash, setFlash] = useState<{ id: string; k: number } | null>(null);
  const scene = SCENE_OF[ch];
  const tasks = TASKS.filter((t) => t.chapter === ch);
  const rooms = meta().rooms;
  const prog = chapterRestored(ch);
  const sceneH = Math.min(height * 0.5, width * 1.15);

  function choose(t: RestoreTask, option: number) {
    const wasDone = chapterRestored(ch).done;
    if (!restore(t, option)) {
      feedback("error", "warning");
      return;
    }
    setPick(null);
    play("unlock");
    setFlash({ id: t.id, k: Date.now() });
    if (wasDone === tasks.length - 1 && chapterRestored(ch).done === tasks.length) {
      setTimeout(() => {
        setCeremony((c) => c + 1);
        play("success");
      }, 400);
    }
  }

  return (
    <View style={styles.root}>
      <Background colors={["#23266A", "#4A2410"]} />
      <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        <RoundButton glyph="back" size={44} onPress={onBack} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Home Decor</Text>
        <CurrencyPill icon="cur_star" value={starsAvailable()} small />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {CHAPTERS.map((c) => {
          const open = chapterUnlocked(c.n);
          return (
            <Tappable
              key={c.n}
              disabled={!open}
              onPress={() => {
                setCh(c.n);
              }}
              style={[styles.tab, ch === c.n && styles.tabOn, !open && { opacity: 0.45 }]}
            >
              <Text style={[styles.tabText, ch === c.n && { color: "#4A2205" }]} numberOfLines={1}>{open ? c.name : `${c.name} · L${c.first}`}</Text>
            </Tappable>
          );
        })}
      </ScrollView>

      {/* the scene, with what has been restored standing in it */}
      <View style={[styles.sceneFrame, { height: sceneH }]}>
        <Image source={art[scene.scene]} style={{ position: "absolute", width: width - 24, height: (width - 24) * (1920 / 1080), top: -(width - 24) * 0.45 }} resizeMode="cover" />
        {scene.tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: scene.tint }]} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(10,8,30,${0.45 - (prog.done / prog.total) * 0.4})` }]} />
        {tasks.map((t, i) => {
          const done = rooms[t.id] !== undefined;
          const size = Math.min(78, width * 0.18);
          const x = t.x * (width - 24) - size / 2;
          const y = t.y * sceneH - size / 2;
          return (
            <Tappable key={t.id} onPress={() => { setPick(t); }} containerStyle={{ position: "absolute", left: x, top: y, width: size, height: size }} style={{ width: size, height: size }} scaleTo={0.88} accessibilityLabel={t.name}>
              {done ? (
                <DecorPiece piece={t.options[rooms[t.id]].piece} size={size} lit delay={ceremony ? i * 260 : 0} key={`${rooms[t.id]}-${ceremony}-${flash?.id === t.id ? flash.k : 0}`} />
              ) : (
                <View style={styles.spot}>
                  <Image source={decor[t.options[0].piece]} style={{ width: size * 0.7, height: size * 0.7, tintColor: "#1A0E06", opacity: 0.55 }} />
                  <View style={styles.costTag}>
                    <Image source={pieces.cur_star} style={{ width: 16, height: 16 }} />
                    <Text style={styles.costText}>{t.cost}</Text>
                  </View>
                </View>
              )}
            </Tappable>
          );
        })}
        {flash ? <FloatingText key={flash.k} text="Restored!" x={(width - 24) / 2} y={sceneH * 0.4} /> : null}
        <View style={styles.sceneLabel}>
          <Text style={styles.sceneText}>{scene.place} · {prog.done}/{prog.total}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + bannerH + 20, gap: 8 }}>
        {tasks.map((t) => {
          const done = rooms[t.id] !== undefined;
          const afford = starsAvailable() >= t.cost;
          return (
            <View key={t.id} style={[styles.taskRow, done && { borderColor: "#3E8E41", backgroundColor: "#F4F0DA" }]}>
              <Image source={pieces[done ? t.options[rooms[t.id]].piece : t.options[0].piece]} style={[{ width: 44, height: 44 }, !done && { opacity: 0.5 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.taskName}>{t.name}</Text>
                <Text style={styles.taskNote}>{done ? `${t.options[rooms[t.id]].label} · tap to change style` : `${t.cost} stars · choose 1 of 3 styles`}</Text>
              </View>
              <GameButton
                size="sm"
                variant={done ? "light" : afford ? "primary" : "secondary"}
                label={done ? "Style" : afford ? `Restore ${t.cost}★` : `${t.cost}★`}
                onPress={() => (done || afford ? setPick(t) : onPlay())}
              />
            </View>
          );
        })}
        {starsAvailable() < Math.min(...tasks.filter((t) => rooms[t.id] === undefined).map((t) => t.cost), 99) ? (
          <GameButton label="Earn stars · Play" variant="primary" onPress={onPlay} />
        ) : null}
      </ScrollView>

      <Popup visible={!!pick} title={pick?.name} onClose={() => setPick(null)}>
        {pick ? (
          <>
            <Text style={styles.pickNote}>{rooms[pick.id] !== undefined ? "Pick a new style — free." : `Costs ${pick.cost} Marigold stars. You have ${starsAvailable()}.`}</Text>
            <View style={styles.options}>
              {pick.options.map((o, i) => (
                <Tappable
                  key={i}
                  onPress={() => choose(pick, i)}
                  style={[styles.option, rooms[pick.id] === i && styles.optionOn, rooms[pick.id] === undefined && starsAvailable() < pick.cost && { opacity: 0.5 }]}
                  accessibilityLabel={o.label}
                >
                  <Image source={pieces[o.piece]} style={{ width: 72, height: 72 }} />
                  <Text style={styles.optionText} numberOfLines={2}>{o.label}</Text>
                </Tappable>
              ))}
            </View>
            {rooms[pick.id] === undefined && starsAvailable() < pick.cost ? (
              <GameButton label="Earn stars · Play" variant="primary" onPress={() => { setPick(null); onPlay(); }} />
            ) : null}
          </>
        ) : null}
      </Popup>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti trigger={ceremony} count={90} />
      </View>
      {ceremony ? (
        <Animated.View entering={ZoomIn.springify()} pointerEvents="none" style={[styles.ceremony, { top: insets.top + 120 }]}>
          <Text style={styles.ceremonyText}>Lighting ceremony!</Text>
          <Text style={styles.ceremonySub}>{scene.place} glows again.</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function DecorPiece({ piece, size, lit, delay }: { piece: string; size: number; lit: boolean; delay: number }) {
  const g = useSharedValue(0);
  const pop = useSharedValue(0.4);
  useEffect(() => {
    pop.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2)) }));
    if (lit) g.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1500 }), withTiming(0.4, { duration: 1500 })), -1));
  }, [g, pop, lit, delay]);
  const glow = useAnimatedStyle(() => ({ opacity: g.value * 0.8 }));
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, st]}>
      <Animated.View style={[{ position: "absolute", left: -size * 0.35, top: -size * 0.35 }, glow]}>
        <Image source={art.fx_sparkle_glow} style={{ width: size * 1.7, height: size * 1.7, opacity: 0.5 }} />
      </Animated.View>
      <Image source={decor[piece]} style={{ width: size, height: size }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 26, color: "#FFF1D6", textShadowColor: "#120C33", textShadowRadius: 4 },
  tabs: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  tab: { paddingHorizontal: 14, height: 40, justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(43,47,119,0.9)", borderWidth: 2, borderColor: "#B8862B" },
  tabOn: { backgroundColor: "#F6A81C", borderColor: "#FFF6E0" },
  tabText: { fontFamily: fonts.display, fontSize: 14, color: "#FFF1D6" },
  sceneFrame: { marginHorizontal: 12, borderRadius: 20, overflow: "hidden", borderWidth: 3, borderColor: "#D9A441", backgroundColor: "#1A1C4D" },
  spot: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,241,214,0.7)", borderStyle: "dashed", backgroundColor: "rgba(255,241,214,0.12)" },
  costTag: { position: "absolute", bottom: -8, flexDirection: "row", alignItems: "center", backgroundColor: "#2B2F77", borderRadius: 10, paddingHorizontal: 5, borderWidth: 1.5, borderColor: "#FFF6E0" },
  costText: { fontFamily: fonts.display, fontSize: 12, color: "#FFF6E0" },
  sceneLabel: { position: "absolute", left: 10, bottom: 10, backgroundColor: "rgba(26,28,77,0.85)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1.5, borderColor: "#D9A441" },
  sceneText: { fontFamily: fonts.display, fontSize: 13, color: "#FFF1D6" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,241,214,0.92)", borderRadius: 16, padding: 8, borderWidth: 2, borderColor: "#C9A26A" },
  taskName: { fontFamily: fonts.display, fontSize: 15, color: palette.ink },
  taskNote: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  pickNote: { fontFamily: fonts.body, fontSize: 15, color: palette.inkSoft, textAlign: "center", marginBottom: 10 },
  options: { flexDirection: "row", gap: 8, marginBottom: 12 },
  option: { flex: 1, alignItems: "center", backgroundColor: "#FFFBF0", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 2, borderColor: "#E0C79A", minHeight: 120 },
  optionOn: { borderColor: "#F6A81C", backgroundColor: "#FFF0C8" },
  optionText: { fontFamily: fonts.body, fontSize: 13, color: palette.ink, textAlign: "center" },
  ceremony: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(26,28,77,0.92)", borderRadius: 20, paddingHorizontal: 22, paddingVertical: 12, borderWidth: 3, borderColor: "#FFC93A", alignItems: "center" },
  ceremonyText: { fontFamily: fonts.display, fontSize: 26, color: "#FFC93A" },
  ceremonySub: { fontFamily: fonts.body, fontSize: 14, color: "#FFF1D6" },
});
