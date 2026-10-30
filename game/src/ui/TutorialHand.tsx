import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

/**
 * Animated pointer demonstrating the real next touch. It never PARKS on the board: every loop it glides in, presses,
 * lifts away and is gone for the last third of the loop, so the badges, counts and coach text it passes over are
 * covered only for a moment (QA 2026-10-29: a hand resting on a tile hid its badges, the order count and the hint).
 * The tiles it points at light up themselves (Cell `hint`) and keep glowing while the hand is away.
 * A tap (`to` absent): in from below-right, press the tile's centre, retreat, fade. A drag (`from` → `to`): press,
 * slide, release, fade. `point` (a delivery to an order card): it only sets off toward the card and fades on the way —
 * the glowing card is the target, so the hand never crosses the coach banner or sits on the card's count.
 * `emphasis` (idle nudge) makes the press deeper and the loop quicker.
 * The fingertip always sits on the tile's LOWER-RIGHT CORNER, never its centre, and the hand hangs off the tile below
 * and to the right, so the piece it points at stays fully visible (QA 2026-10-30: the hand hid the diya being dragged).
 * On a drag a train of three warm glints runs A → B twice per loop (also while the hand is away), lit only on the
 * stretch BETWEEN the tiles, so every frame shows motion toward the target without a piece copy or covering any art.
 * The loop is short (1.45 s drag / 1.25 s tap, the hand away for only ~0.3 s): the prompt never lingers static.
 */
export function TutorialHand({ from, to, cell = 64, emphasis, point }: {
  from: { x: number; y: number }; to?: { x: number; y: number }; cell?: number; emphasis?: boolean; point?: boolean;
}) {
  const t = useSharedValue(0);
  const drag = !!to;
  const cycle = (drag ? 1450 : 1250) * (emphasis ? 0.8 : 1);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: cycle, easing: Easing.linear }), -1, false);
  }, [t, cycle]);
  const depth = emphasis ? 10 : 6;
  const restX = cell * 0.5, restY = cell * 0.6;
  // fingertip on the tile's lower-right corner (inside the frame), so the hand never covers the piece art
  // (0.48: on the tile's very corner, past the piece's base disc and pattern badge)
  const off = cell * 0.48;
  const ease = (p: number) => {
    "worklet";
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  };
  const hand = useAnimatedStyle(() => {
    const k = t.value;
    let x = from.x, y = from.y, press = 0, op = 0;
    if (drag) {
      const dest = to!;
      const reach = point ? 0.42 : 1;
      // in .00-.06 · press .06-.14 · slide .14-.62 · release .62-.70 · fade .70-.80 · away .80-1
      const p = ease(k < 0.14 ? 0 : k < 0.62 ? (k - 0.14) / 0.48 : 1) * reach;
      x = from.x + off + (dest.x - from.x) * p;
      y = from.y + off + (dest.y - from.y) * p;
      press = k < 0.06 ? 0 : k < 0.14 ? (k - 0.06) / 0.08 : k < 0.62 ? 1 : k < 0.7 ? 1 - (k - 0.62) / 0.08 : 0;
      op = k < 0.06 ? k / 0.06 : k < 0.7 ? (point && k > 0.3 ? 1 - (k - 0.3) / 0.28 : 1) : k < 0.8 ? (point ? 0 : 1 - (k - 0.7) / 0.1) : 0;
    } else {
      // in from rest .00-.22 · press .22-.34 · lift .34-.46 · retreat + fade .46-.72 · away .72-1
      const inP = k < 0.22 ? ease(k / 0.22) : k < 0.46 ? 1 : k < 0.72 ? 1 - ease((k - 0.46) / 0.26) : 0;
      // the fingertip presses the tile's corner: the art and a stall's price tag stay clear
      x = from.x + off + restX * (1 - inP);
      y = from.y + off + restY * (1 - inP);
      press = k < 0.22 ? 0 : k < 0.34 ? (k - 0.22) / 0.12 : k < 0.46 ? 1 - (k - 0.34) / 0.12 : 0;
      op = k < 0.1 ? k / 0.1 : k < 0.46 ? 1 : k < 0.72 ? 1 - (k - 0.46) / 0.26 : 0;
    }
    // the emoji's fingertip is ~14 px right of and ~4 px below its box corner
    return { opacity: op, transform: [{ translateX: x - 14 }, { translateY: y - 4 - depth + press * depth }, { rotate: "-12deg" }, { scale: 1 - press * 0.1 }] };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {drag && !point ? [0, 0.16, 0.32].map((lag) => <Glint key={lag} t={t} lag={lag} from={from} to={to!} />) : null}
      <Animated.View style={[styles.hand, hand]}>
        <Text style={styles.emoji}>👆</Text>
      </Animated.View>
    </View>
  );
}

/** One glint of the drag-path train: runs A → B twice per hand loop, lit only between the two tiles. */
function Glint({ t, lag, from, to }: { t: SharedValue<number>; lag: number; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const st = useAnimatedStyle(() => {
    const p = (t.value * 2 + 1 - lag) % 1;
    const op = p < 0.26 ? 0 : p < 0.36 ? (p - 0.26) / 0.1 : p < 0.64 ? 1 : p < 0.74 ? 1 - (p - 0.64) / 0.1 : 0;
    const gx = from.x + (to.x - from.x) * p;
    const gy = from.y + (to.y - from.y) * p;
    return { opacity: op * (1 - lag), transform: [{ translateX: gx - 9 }, { translateY: gy - 9 }, { scale: 1 - lag }] };
  });
  return <Animated.View style={[styles.glint, st]} />;
}
const styles = StyleSheet.create({
  hand: { position: "absolute", left: 0, top: 0 },
  glint: { position: "absolute", left: 0, top: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,236,170,0.95)", borderWidth: 2, borderColor: "#FFC93A", shadowColor: "#FFC93A", shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 },
  emoji: { fontSize: 36, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
});
