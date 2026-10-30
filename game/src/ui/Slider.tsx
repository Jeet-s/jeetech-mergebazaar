import { useMemo, useRef, useState } from "react";
import { Image, PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, palette } from "./theme";
import { glyphs } from "../pieces";

/**
 * Brass volume slider (no native deps): a parchment row with a label, the % value, and a 48dp-tall touch strip —
 * a sunken indigo track, a marigold fill and a round brass knob. Tap anywhere on the strip or drag the knob.
 * 0 reads "Off". onChange fires while dragging; onCommit once on release (persist / preview sound there).
 */
export function Slider({ label, value, onChange, onCommit, note }: {
  label: string; value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; note?: string;
}) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const last = useRef(value);
  const cb = useRef({ onChange, onCommit });
  cb.current = { onChange, onCommit };
  const at = (x: number) => {
    const ww = wRef.current;
    if (ww <= 0) return last.current;
    const v = Math.max(0, Math.min(1, (x - KNOB / 2) / Math.max(1, ww - KNOB)));
    return v < 0.03 ? 0 : v > 0.97 ? 1 : v;
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          last.current = at(e.nativeEvent.locationX);
          cb.current.onChange(last.current);
        },
        onPanResponderMove: (e) => {
          last.current = at(e.nativeEvent.locationX);
          cb.current.onChange(last.current);
        },
        onPanResponderRelease: () => cb.current.onCommit?.(last.current),
        onPanResponderTerminate: () => cb.current.onCommit?.(last.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const v = Math.max(0, Math.min(1, value));
  last.current = v;
  const step = (d: number) => {
    const n = Math.max(0, Math.min(1, Math.round((v + d) * 10) / 10));
    onChange(n);
    onCommit?.(n);
  };
  const knobX = v * Math.max(0, w - KNOB);
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, v === 0 && { color: palette.danger }]}>{v === 0 ? "Off" : `${Math.round(v * 100)}%`}</Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View
        style={styles.strip}
        onLayout={(e: LayoutChangeEvent) => {
          wRef.current = e.nativeEvent.layout.width;
          setW(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100), text: v === 0 ? "Off" : `${Math.round(v * 100)} percent` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 0.1 : -0.1)}
        {...pan.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <LinearGradient colors={["#FFE07A", "#F6A81C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: knobX + 4 }]} />
        </View>
        <View pointerEvents="none" style={[styles.knobWrap, { left: knobX }]}>
          <LinearGradient colors={["#F7D27A", "#B8762A"]} style={styles.knob}>
            {v === 0 ? <Image source={glyphs.close} style={{ width: 14, height: 14, opacity: 0.8 }} /> : <View style={styles.knobDot} />}
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const KNOB = 34;
const styles = StyleSheet.create({
  row: { paddingTop: 8, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: "rgba(122,82,64,0.18)" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: fonts.body, fontSize: 18, color: palette.ink },
  value: { fontFamily: fonts.display, fontSize: 15, color: palette.accentDark },
  note: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  strip: { height: 48, justifyContent: "center" },
  track: { height: 14, marginHorizontal: KNOB / 2 - 4, borderRadius: 7, backgroundColor: "#2B2F77", borderWidth: 2, borderColor: "#7A4A12", overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  knobWrap: { position: "absolute", top: (48 - KNOB) / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: "#5A3010", paddingBottom: 3, elevation: 4, shadowColor: "#1A0A04", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  knob: { flex: 1, borderRadius: KNOB / 2, borderWidth: 2.5, borderColor: "#7A4A12", alignItems: "center", justifyContent: "center" },
  knobDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,246,224,0.85)", borderWidth: 1.5, borderColor: "#7A4A12" },
});
