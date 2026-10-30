import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedNumber } from "./AnimatedNumber";
import { fonts, palette } from "./theme";
import { pieces } from "../pieces";

/** HUD pill: a painted currency icon + animated count in a cream capsule (Lamps, stars, Sparks…). */
export function CurrencyPill({ icon, value, suffix, onPress, small }: { icon: "cur_lamp" | "cur_star" | "cur_spark" | "cur_jewel" | string; value: number; suffix?: string; onPress?: () => void; small?: boolean; color?: string }) {
  const h = small ? 32 : 38;
  const body = (
    <View style={[styles.pill, { height: h, paddingLeft: h * 0.82 }]}>
      <AnimatedNumber value={value} style={small ? { ...styles.value, fontSize: 16 } : styles.value} />
      {suffix ? <Text style={[styles.value, { fontSize: small ? 13 : 15, color: palette.inkSoft }]}>{suffix}</Text> : null}
      <Image source={pieces[icon]} style={[styles.icon, { width: h + 8, height: h + 8, left: -10, top: -4 }]} />
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={8}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: palette.cream, borderRadius: 999, paddingRight: 14, borderWidth: 2.5, borderColor: "#B8862B", marginLeft: 10, gap: 2 },
  icon: { position: "absolute" },
  value: { fontFamily: fonts.display, fontSize: 18, color: palette.ink, minWidth: 22, textAlign: "center" },
});
