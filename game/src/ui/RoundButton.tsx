import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, shadow, springs } from "./theme";
import { feedback, type Sfx } from "../audio/sfx";
import { glyphs, pieces, type Glyph } from "../pieces";

/**
 * Round brass disc button with an inset glyph (or a painted piece icon), an optional count badge and label —
 * home secondary actions, the in-level tool bar and boosters.
 */
export function RoundButton({ glyph, piece, label, onPress, size = 58, badge, active, disabled, sound = "tap", dot, labelColor = "#FFF6E0" }: {
  glyph?: Glyph; piece?: string; label?: string; onPress: () => void; size?: number; badge?: string | number; active?: boolean; disabled?: boolean; sound?: Sfx; dot?: boolean; labelColor?: string;
}) {
  const p = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, p.value) * 3 }, { scale: 1 - p.value * 0.1 }] }));
  return (
    <Pressable
      // answers on touch-down: 50 ms squash + sound + haptic; the release pops back with a small overshoot
      onPressIn={() => {
        p.value = withTiming(1, { duration: 50 });
        feedback(sound, "light");
      }}
      onPressOut={() => (p.value = withSequence(withTiming(-0.4, { duration: 90 }), withSpring(0, springs.pop)))}
      onPress={onPress}
      hitSlop={6}
      style={[styles.wrap, { opacity: disabled ? 0.45 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[{ width: size, height: size + 4 }]}>
        <View style={[styles.lip, { width: size, height: size, borderRadius: size / 2, top: 4 }, shadow]} />
        <Animated.View style={st}>
          <LinearGradient
            colors={active ? ["#FFF3B0", "#F6A81C"] : ["#F4C870", "#B8762A"]}
            style={[styles.face, { width: size, height: size, borderRadius: size / 2, borderColor: active ? "#FFF6E0" : "#7A4A12" }]}
          >
            <View style={[styles.inner, { width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }]}>
              {glyph ? <Image source={glyphs[glyph]} style={{ width: size * 0.56, height: size * 0.56 }} /> : null}
              {piece ? <Image source={pieces[piece]} style={{ width: size * 0.78, height: size * 0.78 }} /> : null}
            </View>
          </LinearGradient>
        </Animated.View>
        {badge !== undefined && badge !== "" ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {dot ? <View style={styles.dot} /> : null}
      </View>
      {label ? <Text style={[styles.label, { color: labelColor, maxWidth: size + 14 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  lip: { position: "absolute", backgroundColor: "#5A3010" },
  face: { alignItems: "center", justifyContent: "center", borderWidth: 2.5 },
  inner: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(122,62,20,0.35)", borderWidth: 1.5, borderColor: "rgba(255,240,200,0.45)" },
  badge: { position: "absolute", right: -4, bottom: 0, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#2B2F77", borderWidth: 2, borderColor: "#FFF6E0", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.display, fontSize: 12, color: "#FFF6E0" },
  dot: { position: "absolute", right: 0, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "#D8433B", borderWidth: 2, borderColor: "#FFF6E0" },
  label: { fontFamily: fonts.body, fontSize: 12, marginTop: 3, textShadowColor: "rgba(30,10,0,0.9)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
