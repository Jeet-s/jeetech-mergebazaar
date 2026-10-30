import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Panel } from "./Panel";
import { fonts, palette, springs } from "./theme";
import { play } from "../audio/sfx";
import { Tappable } from "./Tappable";
import { glyphs } from "../pieces";

const RIBBON_H = 48;
/** The ribbon's centre sits on the parchment frame's outer (indigo) band, ~7dp in from the card's top edge. */
const RIBBON_TOP = -RIBBON_H / 2 + 7;

/**
 * Modal parchment card that springs in over a dimmed backdrop, with an indigo brass-edged title ribbon centred on
 * the frame's top edge and a round brass close disc. `footer` stays pinned under the (scrollable) body so the main
 * action never scrolls away. The card is laid out completely before it appears (no frame-less first frame, no
 * reflow): only the whole card's scale/opacity animate in, and out again (fade + shrink) when it closes.
 * `placement="bottom"` + a light `dim` keep the scene behind visible (story dialogue over the board).
 * The Modal gets its own SafeAreaProvider (a Modal is a separate window: the root provider reads 0 insets there).
 * `underlay` draws over the dim but BEHIND the card (confetti, rays): fx outside the Modal end up under its window,
 * and fx drawn over the card cover its title and numbers.
 */
export function Popup({ visible, title, onClose, children, footer, placement = "center", dim = 0.72, underlay }: {
  visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode; footer?: React.ReactNode;
  placement?: "center" | "bottom"; dim?: number; underlay?: React.ReactNode;
}) {
  // Stay mounted while the card animates out; keep showing the last content during that exit.
  const [mounted, setMounted] = useState(visible);
  const last = useRef({ title, children, footer });
  if (visible) last.current = { title, children, footer };
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  if (!mounted) return null;
  const c = visible ? { title, children, footer } : last.current;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <PopupBody visible={visible} title={c.title} onClose={onClose} footer={c.footer} placement={placement} dim={dim} underlay={underlay} onHidden={() => setMounted(false)}>
          {c.children}
        </PopupBody>
      </SafeAreaProvider>
    </Modal>
  );
}

function PopupBody({ visible, title, onClose, children, footer, placement, dim, underlay, onHidden }: {
  visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode; footer?: React.ReactNode;
  placement: "center" | "bottom"; dim: number; underlay?: React.ReactNode; onHidden: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const s = useSharedValue(0);
  const d = useSharedValue(0);
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => {
    if (!visible) {
      d.value = withTiming(0, { duration: 180 });
      s.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
      // a JS timer (not an animation callback) unmounts the Modal, so an invisible Modal can never stay over the game
      const id = setTimeout(onHidden, 200);
      return () => clearTimeout(id);
    }
    if (!laidOut) return;
    play("whoosh", 0.6);
    d.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    s.value = withSpring(1, springs.pop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, laidOut]);
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, s.value * 3), // opaque within the first ~third of the pop: no ghosted, see-through card frames
    transform: [{ translateY: (1 - s.value) * (placement === "bottom" ? 60 : 18) }, { scale: 0.82 + 0.18 * s.value }],
  }));
  const dimSt = useAnimatedStyle(() => ({ opacity: d.value }));
  const bottom = Math.max(insets.bottom, 24);
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, placement === "center" && { backgroundColor: `rgba(20,10,30,${dim})` }, dimSt]}>
        {placement === "bottom" ? (
          // a card rising from the bottom: the dim deepens only toward the card, so the HUD, the order tray and the lit
          // board above it stay bright (the finished board is part of the moment)
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(20,10,30,0)", `rgba(20,10,30,${dim * 0.5})`, `rgba(20,10,30,${Math.min(0.85, dim * 1.6)})`]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      {underlay ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {underlay}
        </View>
      ) : null}
      <View
        style={[styles.center, placement === "bottom" && styles.bottom, { paddingTop: insets.top + 30, paddingBottom: bottom + 8 }]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.cardWrap, card]} onLayout={() => setLaidOut(true)}>
          <Panel pad={18} style={{ paddingTop: title ? RIBBON_H / 2 + 7 + 14 : 22, maxHeight: height - insets.top - bottom - 50 }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }} style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
            {footer ? <View style={{ marginTop: 14 }}>{footer}</View> : null}
          </Panel>
          {title ? (
            <View style={styles.ribbonWrap} pointerEvents="none">
              <LinearGradient colors={["#454BB0", "#23266A"]} style={styles.ribbon}>
                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
              </LinearGradient>
            </View>
          ) : null}
          {onClose ? (
            <Tappable onPress={onClose} hitSlop={10} containerStyle={styles.close} scaleTo={0.85} accessibilityLabel="Close">
              <LinearGradient colors={["#F7D27A", "#C98A2A"]} style={styles.closeFace}>
                <Image source={glyphs.close} style={{ width: 24, height: 24 }} />
              </LinearGradient>
            </Tappable>
          ) : null}
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  bottom: { justifyContent: "flex-end" },
  cardWrap: { width: "100%", maxWidth: 420 },
  ribbonWrap: { position: "absolute", top: RIBBON_TOP, left: 0, right: 0, alignItems: "center" },
  ribbon: { height: RIBBON_H, minWidth: "62%", maxWidth: "88%", paddingHorizontal: 26, borderRadius: 16, borderWidth: 3, borderColor: "#D9A441", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 24, color: palette.cream, textAlign: "center", textShadowColor: "#0E0F33", textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
  close: { position: "absolute", top: -16, right: -6 },
  closeFace: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#7A4A12" },
});
