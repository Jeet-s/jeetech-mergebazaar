import { memo, useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { glyphs, pieces } from "../pieces";
import { Canvas, Group, Path, Skia, DashPathEffect, type SkPath } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MiniStars } from "./Stars";
import { fonts, palette, shadow } from "./theme";
import { feedback } from "../audio/sfx";

const NODE = 70;
const GAP = 112;
const BANNER_GAP = 76; // extra room where a chapter starts, so its banner never covers a node
// The path is drawn in canvas tiles: one canvas the height of a long map exceeds the GPU's texture limit (16384 px —
// 120 levels at 2.6x density is ~35000 px), which draws nothing on phones and crashed the QA emulator (2026-10-26).
const TILE = 2000;

export interface MapLevel {
  id: string;
  number: number;
  stars: number; // 0-3, -1 = locked
  chapter?: string; // shown as a banner where it changes
  beat?: boolean; // a story beat opens before this level
}

function Pulse() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(withTiming(1.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2 - s.value * 1.2 }));
  return <Animated.View style={[styles.pulse, style]} />;
}

/** "You are here": a brass diya bobbing above the current level, its flame glow breathing. */
function HereMarker() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0, { duration: 650 })), -1);
  }, [t]);
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -t.value * 8 }, { rotate: `${-4 + t.value * 8}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.4, transform: [{ scale: 0.85 + t.value * 0.25 }] }));
  return (
    <View pointerEvents="none" style={styles.here}>
      <Animated.View style={[styles.hereGlow, glow]} />
      <Animated.View style={bob}>
        <Image source={pieces.L2} style={{ width: 44, height: 44 }} />
      </Animated.View>
    </View>
  );
}

/**
 * Candy-style winding level map (bottom = level 1). Done levels show stars,
 * the current level pulses, future levels are locked.
 */
/** The trail drawn in ≤ TILE-tall Skia tiles (GPU texture limit); memoised so map re-renders never redraw it. */
const PathTiles = memo(function PathTiles({ path, width, height }: { path: SkPath; width: number; height: number }) {
  return (
    <>
      {Array.from({ length: Math.ceil(height / TILE) }, (_, k) => (
        <Canvas key={k} style={{ position: "absolute", left: 0, top: k * TILE, width, height: Math.min(TILE, height - k * TILE) }} pointerEvents="none">
          <Group transform={[{ translateY: -k * TILE }]}>
            <Path path={path} style="stroke" strokeWidth={22} color="rgba(40,16,4,0.45)" strokeCap="round" />
            <Path path={path} style="stroke" strokeWidth={14} color="rgba(232,194,122,0.85)" strokeCap="round" />
            <Path path={path} style="stroke" strokeWidth={6} color="rgba(242,163,27,0.95)" strokeCap="round">
              <DashPathEffect intervals={[3, 16]} />
            </Path>
          </Group>
        </Canvas>
      ))}
    </>
  );
});

export function LevelMap({
  levels,
  current,
  onSelect,
  header,
  padTop = 120,
  padBottom = 200,
}: {
  levels: MapLevel[];
  current: number;
  onSelect: (l: MapLevel) => void;
  header?: React.ReactNode;
  padTop?: number; // space covered by the HUD
  padBottom?: number; // space covered by the bottom buttons
}) {
  const { width, height: winH } = useWindowDimensions();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { pos, height } = useMemo(() => {
    // Distance of each node above the bottom of the map; chapter starts get extra room for their banner.
    let up = 0;
    const offs = levels.map((l, i) => {
      if (i > 0) up += GAP;
      if (l.chapter && l.chapter !== levels[i - 1]?.chapter) up += BANNER_GAP;
      return up;
    });
    const h = padBottom + NODE / 2 + up + NODE / 2 + padTop;
    return {
      height: Math.max(h, winH),
      pos: offs.map((o, i) => ({ x: width / 2 + Math.sin(i * 0.9) * (width * 0.28), y: Math.max(h, winH) - padBottom - NODE / 2 - o })),
    };
  }, [levels, width, winH, padTop, padBottom]);
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    pos.forEach((q, i) => {
      if (i === 0) b.moveTo(q.x, q.y);
      else {
        const prev = pos[i - 1];
        b.cubicTo(prev.x, prev.y - GAP / 2, q.x, q.y + GAP / 2, q.x, q.y);
      }
    });
    return b.detach();
  }, [pos]);
  useEffect(() => {
    // Centre the current level in the visible band between the HUD and the bottom buttons.
    const y = pos[Math.max(0, current - 1)]?.y ?? 0;
    const target = Math.min(height - winH, Math.max(0, y - (padTop + (winH - padTop - padBottom) / 2)));
    const id = setTimeout(() => scroll.current?.scrollTo({ y: target, animated: false }), 50);
    return () => clearTimeout(id);
  }, [current, pos, height, winH, padTop, padBottom]);

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ height }} showsVerticalScrollIndicator={false}>
      {header}
      <PathTiles path={path} width={width} height={height} />
      {levels.map((l, i) => {
        const locked = l.stars < 0;
        const isCurrent = l.number === current;
        const showBanner = l.chapter && l.chapter !== levels[i - 1]?.chapter;
        return (
          <View key={l.id}>
            {showBanner ? (
              <View style={[styles.banner, { top: pos[i].y + NODE / 2 + (GAP + BANNER_GAP - NODE) / 2 - 22 }]}>
                <Text style={styles.bannerText}>{l.chapter}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                if (locked) return feedback("error", "warning");
                feedback("pop", "medium");
                onSelect(l);
              }}
              accessibilityLabel={locked ? `Level ${l.number}, locked` : `Level ${l.number}`}
              style={({ pressed }) => [
                styles.nodeWrap,
                { left: pos[i].x - NODE / 2, top: pos[i].y - NODE / 2, transform: [{ scale: pressed ? 0.9 : 1 }] },
              ]}
            >
              {isCurrent ? <Pulse /> : null}
              <View style={[styles.lip, { backgroundColor: locked ? "#2A1C14" : isCurrent ? "#8A3A06" : "#5A3010" }]} />
              <LinearGradient
                colors={locked ? ["#7A6A5E", "#4A3A30"] : isCurrent ? ["#FFE38A", "#F6A81C"] : ["#F4C870", "#B8762A"]}
                style={[styles.node, shadow, isCurrent && { borderColor: "#FFF6E0" }]}
              >
                {locked ? <Image source={glyphs.lock} style={{ width: 30, height: 30, opacity: 0.85 }} /> : <Text style={[styles.num, { color: isCurrent ? "#5A2205" : "#FFF6E0" }]}>{l.number}</Text>}
              </LinearGradient>
              {l.beat ? (
                <View style={styles.beat}>
                  <Image source={glyphs.story} style={{ width: 20, height: 20 }} />
                </View>
              ) : null}
              {!locked && !isCurrent ? <MiniStars count={l.stars} /> : null}
              {isCurrent ? <HereMarker /> : null}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nodeWrap: { position: "absolute", width: NODE, alignItems: "center" },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#7A4A12" },
  beat: { position: "absolute", left: -8, top: -6, width: 30, height: 30, borderRadius: 15, backgroundColor: "#2B2F77", borderWidth: 2, borderColor: "#D9A441", alignItems: "center", justifyContent: "center" },
  lip: { position: "absolute", top: 6, width: NODE, height: NODE, borderRadius: NODE / 2 },
  num: { fontFamily: fonts.display, fontSize: 26, textShadowColor: "rgba(60,20,0,0.6)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
  pulse: { position: "absolute", width: NODE + 26, height: NODE + 26, top: -13, borderRadius: (NODE + 26) / 2, backgroundColor: "rgba(255,201,58,0.45)" },
  here: { position: "absolute", top: -50, width: 60, height: 52, alignItems: "center", justifyContent: "flex-end" },
  hereGlow: { position: "absolute", bottom: 4, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,190,80,0.55)" },
  banner: { position: "absolute", alignSelf: "center", backgroundColor: palette.secondary, paddingHorizontal: 22, paddingVertical: 8, borderRadius: 14, borderWidth: 3, borderColor: "#D9A441" },
  bannerText: { fontFamily: fonts.display, fontSize: 18, color: "#FFF1D6" },
});
