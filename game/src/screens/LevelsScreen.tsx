import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, LevelMap, RoundButton, type MapLevel, fonts } from "../ui";
import { store } from "../modules/store";
import { useBannerHeight } from "../modules/layout";
import { CHAPTERS, LEVELS } from "../game/levels";
import { STORY, currentLevel, starsAvailable } from "../game/meta";

/** The level map (from Home → Levels): the bazaar lane winding through 5 festival chapters, stars and story beats. */
export function LevelsScreen({ onPlay, onBack }: { onPlay: (levelNumber: number) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const leaving = useSharedValue(0);
  const leaveStyle = useAnimatedStyle(() => ({ opacity: 1 - leaving.value * 0.55, transform: [{ scale: 1 + leaving.value * 0.04 }] }));
  const play = (n: number) => {
    leaving.value = withTiming(1, { duration: 160 });
    onPlay(n);
  };
  const bannerH = useBannerHeight();
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const stars = s.stars ?? {};
  const current = currentLevel();
  const levels: MapLevel[] = LEVELS.map((l) => ({
    id: String(l.id),
    number: l.id,
    chapter: `${CHAPTERS[l.chapter - 1].n} · ${CHAPTERS[l.chapter - 1].name}`,
    stars: stars[l.id] !== undefined ? stars[l.id] : l.id === current ? 0 : -1,
    beat: STORY.some((b) => b.level === l.id),
  }));
  return (
    <Animated.View style={[styles.root, leaveStyle]}>
      <Background scene="bg_bazaar_street" dim={0.2} />
      <LevelMap levels={levels} current={current} onSelect={(l) => play(l.number)} padTop={insets.top + 120} padBottom={insets.bottom + bannerH + 170} />
      <LinearGradient pointerEvents="none" colors={["rgba(20,14,50,0.95)", "rgba(20,14,50,0.7)", "rgba(20,14,50,0)"]} locations={[0, 0.55, 1]} style={[styles.scrimTop, { height: insets.top + 140 }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(30,12,4,0)", "rgba(30,12,4,0.75)", "rgba(30,12,4,0.95)"]} style={[styles.scrimBottom, { height: insets.bottom + bannerH + 170 }]} />
      <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <RoundButton glyph="back" size={44} onPress={onBack} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Festival Map</Text>
        <CurrencyPill icon="cur_star" value={starsAvailable()} small />
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10) + bannerH + 12 }]} pointerEvents="box-none">
        <GameButton glyph="home" size="md" variant="secondary" label="Home" onPress={onBack} />
        <GameButton label={current > LEVELS.length ? "All lit!" : `Play · Level ${current}`} variant="primary" size="md" style={{ flex: 1 }} sound="whoosh" onPress={() => play(Math.min(current, LEVELS.length))} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, gap: 10 },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 28, color: "#FFF1D6", textShadowColor: "#3A1F14", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottom: { position: "absolute", left: 14, right: 14, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10 },
});
