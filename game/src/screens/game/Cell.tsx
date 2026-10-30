import { memo, useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { pieces } from "../../pieces";
import { fonts, springs } from "../../ui/theme";

/** Draws one engine cell string ("L2", "g0", "c|L2", "t2|k1|L4", "j3|W3" …) as layered art, derived only from it. */
export function CellArt({ cell, size, next, cost, dim, gen }: { cell: string; size: number; next?: string; cost?: number; dim?: boolean; gen?: string }) {
  const parts = cell.split("|");
  // the art sits inset in its tile (its base disc and pattern badge never touch the tile edge); chips and badges
  // are laid out over the full tile, inside its corners
  // a stall sits higher and a little smaller: its price tag (Spark cost → next piece) runs along the tile's bottom,
  // clear of the stall art — no corner badges over the awning or the counter
  const stall = /^g\d+$/.test(parts[parts.length - 1]);
  const art = Math.round(size * (stall ? STALL_K : ART_K));
  const off = (size - art) / 2;
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.3 : 1 }}>
      <View style={{ position: "absolute", left: off, top: stall ? size * 0.03 : off + size * 0.02, width: art, height: art }}>{layer(parts, art, undefined, undefined, gen)}</View>
      {badges(parts, size, next, cost)}
    </View>
  );
}
/** Share of the tile a piece's art fills (the rest is breathing room inside the tile frame). */
const ART_K = 0.8;
const STALL_K = 0.7;
/** Height of a stall's price tag, as a share of the tile. */
export const TAG_K = 0.27;

/** Corner chips/badges for a cell (next product, Spark cost, layer counts), all inside the tile. */
function badges(parts: string[], size: number, next?: string, cost?: number): React.ReactNode {
  const [h, ...rest] = parts;
  if (/^g\d+$/.test(h)) {
    if (!next && !cost) return null;
    const th = Math.round(size * TAG_K);
    return (
      <View style={[styles.tag, { height: th, borderRadius: th / 2, left: size * 0.06, right: size * 0.06, bottom: size * 0.02 }]}>
        {cost ? (
          <>
            <Image source={pieces.cur_spark} style={{ width: th * 0.8, height: th * 0.8 }} fadeDuration={0} />
            <Text style={[styles.tagText, { fontSize: Math.max(10, th * 0.62), lineHeight: th }]}>{cost}</Text>
          </>
        ) : null}
        {next && pieces[next] ? (
          <>
            <Text style={[styles.tagArrow, { fontSize: Math.max(9, th * 0.55), lineHeight: th }]}>›</Text>
            <Image source={pieces[next]} style={{ width: th * 1.05, height: th * 1.05 }} fadeDuration={0} />
          </>
        ) : null}
      </View>
    );
  }
  if (h === "c") return <Chip code={rest[rest.length - 1]} size={size} corner="c" />;
  if (/^t\d$/.test(h)) {
    const n = Number(h[1]);
    return (
      <>
        {badges(rest, size, next, cost)}
        {n > 1 ? <Count n={n} size={size} /> : null}
      </>
    );
  }
  if (/^j\d$/.test(h) || /^k\d$/.test(h)) {
    return (
      <>
        <Chip code={rest[rest.length - 1]} size={size} />
        {/^j/.test(h) ? <Count n={Number(h[1])} size={size} left /> : null}
      </>
    );
  }
  return null;
}

function Img({ src, size, style }: { src: number; size: number; style?: object }) {
  return <Image source={src} style={[{ position: "absolute", width: size, height: size }, style]} fadeDuration={0} />;
}

function Chip({ code, size, corner = "tr" }: { code: string; size: number; corner?: "tr" | "c" }) {
  if (!pieces[code]) return null;
  const s = corner === "c" ? size * 0.42 : size * 0.34;
  const pos = corner === "c" ? { left: (size - s) / 2, top: size * 0.3 } : { right: size * 0.03, top: size * 0.03 };
  return (
    <View style={[styles.chip, pos, { width: s, height: s, borderRadius: s / 2 }, corner === "c" && styles.chipCenter]}>
      <Image source={pieces[code]} style={{ width: s * 1.05, height: s * 1.05 }} fadeDuration={0} />
    </View>
  );
}

function layer(parts: string[], size: number, next?: string, cost?: number, gen?: string): React.ReactNode {
  const [h, ...rest] = parts;
  if (h === "." || h === "#" || !h) return null;
  if (/^g\d+$/.test(h)) {
    return (
      <>
        <GenBody size={size} gen={gen ?? "lamp"} />
      </>
    );
  }
  if (h === "c") {
    return (
      <>
        <Img src={pieces.crate} size={size} />
      </>
    );
  }
  if (/^t\d$/.test(h)) {
    const n = Number(h[1]);
    return (
      <>
        <View style={{ position: "absolute", width: size, height: size, opacity: 0.8 }}>{layer(rest, size, next, cost, gen)}</View>
        <Img src={pieces[`thread${Math.min(2, n)}`]} size={size} />
      </>
    );
  }
  if (/^j\d$/.test(h)) {
    return (
      <>
        <Img src={pieces[`jar${h[1]}`]} size={size} />
      </>
    );
  }
  if (/^k\d$/.test(h)) {
    return (
      <>
        <Img src={pieces[`trunk${h[1]}`]} size={size} />
      </>
    );
  }
  return pieces[h] ? <Img src={pieces[h]} size={size} /> : null;
}

function Count({ n, size, left }: { n: number; size: number; left?: boolean }) {
  const s = Math.max(18, size * 0.26);
  return (
    <View style={[styles.count, { width: s, height: s, borderRadius: s / 2 }, left ? { left: 2, bottom: 2 } : { right: 2, bottom: 2 }]}>
      <Text style={[styles.countText, { fontSize: s * 0.6 }]}>{n}</Text>
    </View>
  );
}

export type Poke = { k: number; kind: "bump" | "nope" | "merge" };

const TILE = require("../../../assets/art/ui/tile_slot.png");
const GLOW = require("../../../assets/art/fx_sparkle_glow.png");

/**
 * One board cell: tile + content, drawn only from the engine's cell string. When the content changes the new piece
 * pops in (0.6 → 1.15 → 1) with a short warm "fresh" glow under it; a produced piece flies in from its generator
 * (`spawn`); pulses when a target; lifts under a dragged piece
 * (`hover`); `pressAt` (a shared value = the cell index under the finger, -1 none) squashes it and lights a press ring on
 * the UI thread the instant the finger lands — no React render in between; bobs while selected; squashes on a generator tap / wobbles "no" (`poke`); lights up when its turn in
 * the win wave comes (`wave` = start delay in ms; a tile-sized soft glow, never bigger than the tile).
 * Every animation ends at the resting pose (scale 1, no offset) and lasts ≤ ~600 ms (`fast` halves it: QA replay).
 */
export const Cell = memo(function Cell({ index, pressAt, cell, size, alt, selected, target, hint, dragging, hover, next, cost, gen, spawn, poke, wave, reduceMotion, fast }: {
  index: number; pressAt: SharedValue<number>;
  cell: string; size: number; alt: boolean; selected: boolean; target: boolean; hint: boolean; dragging: boolean; hover?: boolean;
  next?: string; cost?: number; gen?: string; spawn?: { dx: number; dy: number; k: number; hide?: number }; poke?: Poke; wave?: number; reduceMotion: boolean; fast?: boolean;
}) {
  const f = fast ? 0.5 : 1;
  const s = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const hop = useSharedValue(0);
  const pulse = useSharedValue(0);
  const lift = useSharedValue(0);
  const bob = useSharedValue(0);
  const rot = useSharedValue(0);
  const sq = useSharedValue(0);
  const press = useSharedValue(1);
  const lit = useSharedValue(0);
  const fresh = useSharedValue(0);
  const mounted = useRef(false);
  const heat = useSharedValue(0);
  const mg = useSharedValue(0);
  const flash = useSharedValue(0);
  const denied = useSharedValue(0);
  useEffect(() => {
    lift.value = withSpring(hover && !reduceMotion ? 1 : 0, springs.press);
  }, [hover, reduceMotion, lift]);
  const pressGlow = useSharedValue(0);
  const empty = cell === "." || cell === "#";
  const isGenCell = !!gen;
  useAnimatedReaction(
    () => pressAt.value === index,
    (on, was) => {
      if (on === was) return;
      if (on && !empty) {
        // a stall SQUATS under the finger (wide + short) the instant it lands; a piece just dips
        press.value = reduceMotion ? 1 : withTiming(isGenCell ? 0.95 : 0.86, { duration: 50 });
        if (isGenCell && !reduceMotion) sq.value = withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) });
        pressGlow.value = withTiming(1, { duration: 50 });
      } else {
        // release: overshoot then settle, so the lift-off reads as a pop (a stall that worked gets its stretch from `poke`)
        press.value = reduceMotion ? 1 : withSequence(withTiming(1.06, { duration: 90 }), withSpring(1, springs.pop));
        if (isGenCell && !reduceMotion) sq.value = withSpring(0, springs.pop);
        pressGlow.value = withTiming(0, { duration: 220 });
      }
    },
    [index, empty, reduceMotion, isGenCell],
  );
  useEffect(() => {
    bob.value = selected && !reduceMotion ? withRepeat(withSequence(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 420, easing: Easing.inOut(Easing.sin) })), -1) : withTiming(0, { duration: 120 });
  }, [selected, reduceMotion, bob]);
  useEffect(() => {
    if (!poke || reduceMotion) return;
    if (poke.kind === "merge") {
      // the merge snap: the result squashes in, overshoots big and settles, while a golden flash blooms in the tile
      // (held big for a beat, so the punch is still visible in a 2 fps recording)
      mg.value = withSequence(withTiming(-0.2, { duration: 70 * f }), withTiming(0.5, { duration: 130 * f, easing: Easing.out(Easing.quad) }), withTiming(0.38, { duration: 170 * f }), withSpring(0, springs.pop));
      flash.value = withSequence(withTiming(1, { duration: 90 * f }), withDelay(200 * f, withTiming(0, { duration: 600 * f, easing: Easing.in(Easing.quad) })));
      return;
    }
    if (poke.kind === "bump") {
      // squash-and-stretch: the stall squats on the tap, springs up tall as the piece leaves, then settles
      // (0 → 0.13 s squat, then a long stretch: visible for ~0.4 s even at 2 fps)
      sq.value = withSequence(withTiming(1.35, { duration: 130 * f }), withTiming(-1, { duration: 170 * f, easing: Easing.out(Easing.quad) }), withTiming(-0.7, { duration: 120 * f }), withSpring(0, springs.pop));
      // the stall glows warm after it works, then cools down slowly
      heat.value = withSequence(withTiming(1, { duration: 90 }), withDelay(2400, withTiming(0, { duration: 900 })));
    }
    else {
      if (gen) denied.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0.4, { duration: 120 }), withTiming(1, { duration: 120 }), withDelay(300, withTiming(0, { duration: 300 })));
      rot.value = withSequence(withTiming(-9, { duration: 50 }), withTiming(9, { duration: 70 }), withTiming(-6, { duration: 60 }), withTiming(4, { duration: 60 }), withTiming(0, { duration: 50 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poke?.k]);
  useEffect(() => {
    if (wave === undefined) {
      lit.value = withTiming(0, { duration: 200 });
      return;
    }
    lit.value = withDelay(wave * f, withSequence(withTiming(1, { duration: 160 * f }), withTiming(0.45, { duration: 600 * f })));
    if (!reduceMotion && cell !== "." && cell !== "#") {
      hop.value = withDelay(wave * f, withSequence(withTiming(-size * 0.16, { duration: 140 * f, easing: Easing.out(Easing.quad) }), withSpring(0, springs.pop)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave]);
  useEffect(() => {
    if (cell === "." || cell === "#") {
      mounted.current = true;
      fresh.value = 0;
      s.value = 1;
      return;
    }
    const first = !mounted.current;
    mounted.current = true;
    if (first) {
      // the board's first appearance: a plain pop, no "new piece" glow on every tile
      if (!reduceMotion) s.value = withSequence(withTiming(0.6, { duration: 0 }), withTiming(1.12, { duration: 160 }), withTiming(1, { duration: 120 }));
      return;
    }
    if (reduceMotion) {
      s.value = 1;
      fresh.value = withSequence(withTiming(0.8, { duration: 0 }), withTiming(0, { duration: 900 }));
    } else {
      s.value = withSequence(withTiming(0.6, { duration: 0 }), withTiming(1.28, { duration: 140 * f, easing: Easing.out(Easing.quad) }), withSpring(1, springs.pop));
      fresh.value = withSequence(withTiming(1, { duration: 0 }), withDelay(1300, withTiming(0, { duration: 900 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell]);
  useEffect(() => {
    if (!spawn || reduceMotion) return;
    if (spawn.hide) {
      // the piece is in flight as an overlay (GameScreen Flyer, above every tile): the tile waits empty, then the
      // piece lands with a big squash-pop the moment the flyer arrives
      s.value = withSequence(withTiming(0, { duration: 0 }), withDelay(spawn.hide, withTiming(1.32, { duration: 130 * f, easing: Easing.out(Easing.quad) })), withSpring(1, springs.pop));
      fresh.value = withSequence(withTiming(0, { duration: 0 }), withDelay(spawn.hide, withTiming(1, { duration: 0 })), withDelay(1300, withTiming(0, { duration: 900 })));
      return;
    }
    // flies in from the generator: starts at its offset and always ends at rest (0, 0)
    // a real arc out of the stall: up to an apex above the midpoint, then down into the tile (it lands with a
    // squash from the content pop and a sparkle burst from GameScreen)
    const apex = Math.min(spawn.dy, 0) / 2 - size * 0.7;
    tx.value = withSequence(withTiming(spawn.dx, { duration: 0 }), withTiming(0, { duration: 280 * f, easing: Easing.linear }));
    ty.value = withSequence(
      withTiming(spawn.dy, { duration: 0 }),
      withTiming(apex, { duration: 140 * f, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 140 * f, easing: Easing.in(Easing.quad) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawn?.k]);
  useEffect(() => {
    pulse.value = target || hint ? withRepeat(withSequence(withTiming(1, { duration: 520 }), withTiming(0.25, { duration: 520 })), -1) : withTiming(0, { duration: 150 });
  }, [target, hint, pulse]);
  const st = useAnimatedStyle(() => {
    const k = s.value * press.value * (1 + lift.value * 0.1) * (1 + mg.value);
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + hop.value - lift.value * size * 0.08 - bob.value * size * 0.05 },
        { rotate: `${rot.value}deg` },
        { scaleX: k * (selected ? 1.08 : 1) * (1 + sq.value * 0.2) },
        { scaleY: k * (selected ? 1.08 : 1) * (1 - sq.value * 0.22) },
      ],
    };
  });
  const ring = useAnimatedStyle(() => ({ opacity: Math.max(pulse.value, lift.value) }));
  const pressSt = useAnimatedStyle(() => ({ opacity: pressGlow.value }));
  const glow = useAnimatedStyle(() => ({ opacity: lit.value }));
  const heatSt = useAnimatedStyle(() => ({ opacity: heat.value }));
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value, transform: [{ scale: 0.7 + 0.3 * flash.value }, { rotate: `${flash.value * 40}deg` }] }));
  const freshSt = useAnimatedStyle(() => ({ opacity: fresh.value * 0.9, transform: [{ scale: 0.75 + 0.25 * fresh.value }] }));
  const deniedSt = useAnimatedStyle(() => ({ opacity: denied.value }));
  const pad = Math.max(1, Math.round(size * 0.03));
  const inner = size - pad * 2;
  const r = size * 0.16;
  if (cell === "#") return <View style={{ width: size, height: size }} />;
  return (
    <View style={{ width: size, height: size, padding: pad }}>
      <Image source={TILE} style={{ position: "absolute", left: pad, top: pad, width: inner, height: inner }} fadeDuration={0} />
      {alt ? <View style={[styles.alt, { left: pad, top: pad, width: inner, height: inner, borderRadius: r }]} /> : null}
      <Animated.View pointerEvents="none" style={[styles.ring, { left: pad - 1, top: pad - 1, width: inner + 2, height: inner + 2, borderRadius: r, borderColor: hint ? "#3FD1C2" : "#FFC93A" }, ring]} />
      {wave !== undefined ? (
        <Animated.View pointerEvents="none" style={[styles.lit, { left: pad, top: pad, width: inner, height: inner, borderRadius: r }, glow]} />
      ) : null}
      {gen ? (
        <Animated.View pointerEvents="none" style={[styles.heat, { left: pad, top: pad, width: inner, height: inner, borderRadius: r }, heatSt]}>
          <Image source={GLOW} style={{ width: inner, height: inner }} fadeDuration={0} />
        </Animated.View>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.pressed, { left: pad - 2, top: pad - 2, width: inner + 4, height: inner + 4, borderRadius: r + 2 }, pressSt]} />
      {selected ? <View style={[styles.sel, { left: pad - 2, top: pad - 2, width: inner + 4, height: inner + 4, borderRadius: r + 2 }]} /> : null}
      {cell !== "." ? <Animated.View pointerEvents="none" style={[styles.fresh, { left: pad + inner * 0.1, top: pad + inner * 0.1, width: inner * 0.8, height: inner * 0.8, borderRadius: inner }, freshSt]} /> : null}
      {poke?.kind === "merge" ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: pad, top: pad, width: inner, height: inner }, flashSt]}>
          <Image source={GLOW} style={{ width: inner, height: inner }} fadeDuration={0} />
        </Animated.View>
      ) : null}
      {dragging ? (
        <View pointerEvents="none" style={[styles.socket, { left: pad + inner * 0.2, top: pad + inner * 0.2, width: inner * 0.6, height: inner * 0.6, borderRadius: inner }]} />
      ) : null}
      <Animated.View style={[{ width: inner, height: inner, opacity: dragging ? 0 : 1 }, st]}>
        <CellArt cell={cell} size={inner} next={next} cost={cost} gen={gen} />
        {gen ? (
          // can't pay: the price tag flashes red (twice) while the stall wobbles "no"
          <Animated.View pointerEvents="none" style={[styles.tagDeny, { height: Math.round(inner * TAG_K), borderRadius: inner, left: inner * 0.06, right: inner * 0.06, bottom: inner * 0.02 }, deniedSt]} />
        ) : null}
      </Animated.View>
    </View>
  );
});

function GenBody({ size, gen }: { size: number; gen: string }) {
  const b = useSharedValue(0);
  useEffect(() => {
    b.value = withDelay(Math.random() * 600, withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [b]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 0.98 + b.value * 0.04 }, { translateY: -b.value * 1.5 }] }));
  return (
    <Animated.View style={[{ position: "absolute", width: size, height: size }, st]}>
      <Image source={pieces[`gen_${gen}`] ?? pieces.gen_lamp} style={{ width: size, height: size }} fadeDuration={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  alt: { position: "absolute", backgroundColor: "rgba(30,12,4,0.14)" },
  socket: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,226,160,0.35)", backgroundColor: "rgba(20,8,2,0.22)" },
  lit: { position: "absolute", backgroundColor: "rgba(255,214,110,0.42)", borderWidth: 2, borderColor: "rgba(255,236,170,0.9)" },
  heat: { position: "absolute", overflow: "hidden", backgroundColor: "rgba(255,170,60,0.30)", borderWidth: 2.5, borderColor: "rgba(255,214,120,0.95)" },
  fresh: { position: "absolute", backgroundColor: "rgba(255,214,120,0.38)", borderWidth: 2, borderColor: "rgba(255,232,160,0.75)" },
  ring: { position: "absolute", borderWidth: 3 },
  pressed: { position: "absolute", borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "rgba(255,236,170,0.45)" },
  sel: { position: "absolute", borderWidth: 3, borderColor: "#FFF3B0", backgroundColor: "rgba(255,201,58,0.28)" },
  chip: { position: "absolute", backgroundColor: "#FFF6E0", borderWidth: 2, borderColor: "#7A4A12", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chipCenter: { backgroundColor: "transparent", borderWidth: 0 },
  count: { position: "absolute", backgroundColor: "#2B2F77", borderWidth: 2, borderColor: "#FFF6E0", alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: fonts.display, color: "#FFF6E0" },
  tag: { position: "absolute", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: "#2B2F77", borderWidth: 1.5, borderColor: "#FFE6A8" },
  tagText: { fontFamily: fonts.display, color: "#FFF6E0", includeFontPadding: false },
  tagArrow: { fontFamily: fonts.display, color: "#FFD27A", marginHorizontal: 1, includeFontPadding: false },
  tagDeny: { position: "absolute", backgroundColor: "rgba(216,67,59,0.9)", borderWidth: 2, borderColor: "#FFE0D0" },
});
