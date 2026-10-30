import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { NineSlice } from "./NineSlice";
import { palette, radius, shadow, springs, type } from "./theme";
import { feedback, type Sfx } from "../audio/sfx";
import { glyphs, type Glyph } from "../pieces";

type Variant = "primary" | "secondary" | "accent" | "danger" | "light";
// primary / secondary use the painted plates from the art set (btn_primary marigold, btn_secondary indigo + brass).
const COLORS: Record<Variant, { top: string; bottom: string; lip: string; text: string; outline: string }> = {
  primary: { top: "#FFD36A", bottom: palette.primary, lip: palette.primaryDark, text: "#FFF6E0", outline: "#7A3A06" },
  secondary: { top: "#4A50A8", bottom: palette.secondary, lip: palette.secondaryDark, text: "#FFF6E0", outline: "#0E0F33" },
  accent: { top: "#3FC2B0", bottom: palette.accent, lip: palette.accentDark, text: "#FFF6E0", outline: "#0B4A43" },
  danger: { top: "#F07068", bottom: palette.danger, lip: palette.dangerDark, text: "#FFF6E0", outline: "#5A0E0A" },
  light: { top: "#FFF8EA", bottom: "#F3DDB4", lip: "#C9A26A", text: palette.ink, outline: "transparent" },
};

/**
 * Chunky festival button: painted marigold / indigo plate (or a gradient face), darker lip, tap sound + haptic.
 * Touch-down (within 50 ms): the face sinks the full lip depth onto its lip and squashes, the face DARKENS (it is in
 * shadow, pushed in), and a warm glow halo flashes out around the button and fades (~0.7 s). Release springs it back
 * with a small overshoot. The button's own box never changes size. Use for EVERY tappable action.
 */
export function GameButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  glyph,
  disabled,
  sound = "tap",
  style,
}: {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  glyph?: Glyph;
  disabled?: boolean;
  sound?: Sfx;
  style?: ViewStyle;
}) {
  const c = COLORS[variant];
  const press = useSharedValue(0);
  const flash = useSharedValue(0);
  const glow = useSharedValue(0);
  const h = size === "lg" ? 66 : size === "sm" ? 48 : 56;
  const lip = size === "sm" ? 4 : size === "lg" ? 8 : 6;
  // press-in: the face sinks onto its lip (full lip depth) and squashes wide + short; release springs it back tall
  const face = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, press.value) * lip }, { scaleX: 1 + press.value * 0.04 }, { scaleY: 1 - press.value * 0.12 }],
  }));
  // pushed in = in shadow: the face darkens while held; a bright rim flicks on at touch-down and fades at once
  const darkSt = useAnimatedStyle(() => ({ opacity: Math.max(0, press.value) }));
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value }));
  // the glow halo: flashes out around the whole button at touch-down, growing a little as it fades
  const glowSt = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scaleX: 1 + (1 - glow.value) * 0.08 }, { scaleY: 1 + (1 - glow.value) * 0.28 }] }));
  const plate = variant === "primary" || variant === "secondary";
  const fs = size === "lg" ? 25 : size === "sm" ? 16 : 21;
  const content = (
    <>
      {icon}
      {glyph ? <Image source={glyphs[glyph]} style={{ width: fs * 1.15, height: fs * 1.15 }} /> : null}
      {label ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[type.button, { color: c.text, fontSize: fs, textShadowColor: c.outline, textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } }]}
        >
          {label}
        </Text>
      ) : null}
    </>
  );
  return (
    <Pressable
      disabled={disabled}
      // answers on touch-down: 50 ms press-down + sound + haptic; the release pops back with a small overshoot
      onPressIn={() => {
        press.value = withTiming(1, { duration: 50 });
        flash.value = withSequence(withTiming(1, { duration: 40 }), withDelay(120, withTiming(0, { duration: 320 })));
        glow.value = withSequence(withTiming(1, { duration: 50 }), withDelay(160, withTiming(0, { duration: 520 })));
        feedback(sound, size === "lg" ? "medium" : "light");
      }}
      onPressOut={() => {
        press.value = withSequence(withTiming(-0.35, { duration: 90 }), withSpring(0, springs.pop));
      }}
      onPress={onPress}
      style={[{ height: h + lip, opacity: disabled ? 0.5 : 1 }, style]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { height: h + lip + 12, borderRadius: plate ? (h + 12) / 2 : radius.md + 6 }, glowSt]} />
      <View style={[styles.lip, { height: h, top: lip, backgroundColor: c.lip, borderRadius: radius.md }, shadow]} />
      <Animated.View style={[{ height: h }, face]}>
        {plate ? (
          <NineSlice name={variant === "primary" ? "btn_primary" : "btn_secondary"} inset={h / 2} style={[styles.face, { paddingHorizontal: size === "sm" ? 8 : 22 }]}>
            {content}
          </NineSlice>
        ) : (
          <View style={{ flex: 1, borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: variant === "light" ? "#C9A26A" : "rgba(255,240,200,0.5)" }}>
            <LinearGradient colors={[c.top, c.bottom]} style={[styles.face, { paddingHorizontal: size === "sm" ? 8 : 22 }]}>
              <View style={styles.shine} />
              {content}
            </LinearGradient>
          </View>
        )}
        <Animated.View pointerEvents="none" style={[styles.dark, { borderRadius: plate ? h / 2 : radius.md }, darkSt]} />
        <Animated.View pointerEvents="none" style={[styles.flash, { borderRadius: plate ? h / 2 : radius.md }, flashSt]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: { position: "absolute", left: 2, right: 2 },
  face: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  flash: { position: "absolute", left: 3, right: 3, top: 2, bottom: 2, borderWidth: 3, borderColor: "rgba(255,255,236,0.95)" },
  dark: { position: "absolute", left: 1, right: 1, top: 1, bottom: 1, backgroundColor: "rgba(70,24,0,0.28)" },
  glow: { position: "absolute", left: -6, right: -6, top: -6, backgroundColor: "rgba(255,214,100,0.5)", borderWidth: 3, borderColor: "rgba(255,244,190,1)" },
  shine: { position: "absolute", top: 3, left: 10, right: 10, height: "36%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)" },
});
