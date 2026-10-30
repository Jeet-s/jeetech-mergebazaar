import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { art } from "../art";
import { palette } from "./theme";

export type Scene = "bg_courtyard_dusk" | "bg_home_room" | "bg_bazaar_street";

/**
 * Full-bleed painted scene (assets/art backgrounds) with a soft vignette that keeps focus on the content.
 * `dim` darkens it (behind a busy board), `tint` washes it toward a chapter mood.
 */
export function Background({ scene = "bg_courtyard_dusk", dim = 0.15, tint, children, colors }: {
  scene?: Scene; dim?: number; tint?: string; children?: React.ReactNode; colors?: [string, string];
}) {
  const { width, height } = useWindowDimensions();
  // cover: the art is 1080x1920; scale to fill the window, centred (explicit px sizes — never absoluteFill on Images)
  const s = Math.max(width / 1080, height / 1920);
  const w = Math.ceil(1080 * s), h = Math.ceil(1920 * s);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.secondaryDark, overflow: "hidden" }]}>
      {colors ? (
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      ) : (
        <Image source={art[scene]} style={{ position: "absolute", width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 }} resizeMode="cover" fadeDuration={0} />
      )}
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(16,12,48,${0.35 + dim})`, `rgba(16,12,48,${dim * 0.4})`, `rgba(30,12,4,${dim * 0.5})`, `rgba(30,12,4,${0.3 + dim})`]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
