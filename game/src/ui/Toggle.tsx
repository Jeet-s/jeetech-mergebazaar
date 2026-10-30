import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { fonts, palette, springs } from "./theme";
import { feedback } from "../audio/sfx";

export function Toggle({ label, value, onChange, note }: { label: string; value: boolean; onChange: (v: boolean) => void; note?: string }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 26 : 0, springs.press) }] }));
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        feedback("tap", "select");
        onChange(!value);
      }}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? palette.accent : "#D9C29A" }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, minHeight: 48, borderBottomWidth: 1, borderBottomColor: "rgba(122,82,64,0.18)" },
  note: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  label: { fontFamily: fonts.body, fontSize: 18, color: palette.ink },
  track: { width: 58, height: 32, borderRadius: 16, padding: 3, borderWidth: 2, borderColor: "#7A4A12" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", elevation: 3 },
});
