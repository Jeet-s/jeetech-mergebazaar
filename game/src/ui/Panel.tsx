import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NineSlice } from "./NineSlice";
import { radius, shadow } from "./theme";

// The parchment art carries its own edge shading; an Android elevation shadow on this transparent, rounded view
// drew a dark outline through the art's transparent corners (the "hairline" on dialog edges) — iOS-style shadow only.
const { elevation: _elevation, ...softShadow } = shadow;

/** Cream parchment card in an indigo stitched frame (hud_panel art) — popups, menus, HUD groups.
 *  `dark` = an indigo-and-brass plate for HUD numbers over the scene. */
export function Panel({ children, style, dark, pad = 22 }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; dark?: boolean; pad?: number }) {
  if (dark) {
    return (
      <View style={[styles.darkWrap, shadow, style]}>
        <LinearGradient colors={["#3E43A0", "#23266A"]} style={[styles.darkFace, { padding: pad / 2 }]}>
          {children}
        </LinearGradient>
      </View>
    );
  }
  return (
    // Side padding clears the painted frame (its border is ~83% of the slice inset wide): QA tour_5 saw row labels
    // clipped under the frame ("SOUND" → "OUND") when content sat at `pad` only.
    <NineSlice name="hud_panel" inset={44} tileEdges style={[styles.wrap, softShadow, { padding: pad, paddingHorizontal: Math.max(pad, Math.ceil(44 * 0.85)) }, ...(Array.isArray(style) ? style : style ? [style] : [])]}>
      {children}
    </NineSlice>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg },
  darkWrap: { borderRadius: radius.md, borderWidth: 2.5, borderColor: "#D9A441", backgroundColor: "#7A4A12" },
  darkFace: { borderRadius: radius.md - 2 },
});
