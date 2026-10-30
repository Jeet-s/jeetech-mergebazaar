import { useState } from "react";
import { Image, PixelRatio, View, type ViewStyle } from "react-native";
import { nine } from "../pieces";

/**
 * Draws an art frame (assets/art/nine/<name>_*.png) at any size without stretching its corners: corners stay square
 * at `inset` dp, edges stretch (or tile when `tileEdges`, for the studded board frame) and the centre fills.
 * Every Image gets explicit pixel sizes (absolute-fill Images draw at intrinsic size on Android).
 *
 * Seam-free: every slice edge is snapped to a whole device pixel, and each stretched slice reaches 1 device pixel
 * under its neighbours (centre under the edges, edges under the corners, tiles under the next tile), so filtering
 * at a slice border can never leave a dark hairline.
 */
export function NineSlice({ name, inset, style, children, tileEdges, center = true, onLayout }: {
  name: "board_frame" | "hud_panel" | "btn_primary" | "btn_secondary" | "tile_cell";
  inset: number;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  /** Tile the edges instead of stretching them: a repeat length in dp, or true = the edge art's own aspect at this inset. */
  tileEdges?: number | boolean;
  center?: boolean;
  onLayout?: (w: number, h: number) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const px = 1 / PixelRatio.get(); // one device pixel in dp
  const snap = PixelRatio.roundToNearestPixel;
  const k = snap(Math.min(inset, w / 2, h / 2));
  const mw = Math.max(0, w - 2 * k), mh = Math.max(0, h - 2 * k);
  const img = (part: string, left: number, top: number, width: number, height: number, key?: string) => {
    const l = snap(left), t = snap(top);
    const r = snap(left + width), b = snap(top + height);
    return r - l > 0 && b - t > 0 ? (
      <Image key={key ?? part} source={nine[`${name}_${part}`]} style={{ position: "absolute", left: l, top: t, width: r - l, height: b - t }} resizeMode="stretch" fadeDuration={0} />
    ) : null;
  };
  const edge = (part: "t" | "b" | "l" | "r") => {
    const horizontal = part === "t" || part === "b";
    const len = horizontal ? mw : mh;
    if (len <= 0) return null;
    if (!tileEdges) {
      // reaches 1px under both corners
      return horizontal
        ? img(part, k - px, part === "t" ? 0 : h - k, mw + 2 * px, k)
        : img(part, part === "l" ? 0 : w - k, k - px, k, mh + 2 * px);
    }
    let unit = typeof tileEdges === "number" ? tileEdges : k;
    if (tileEdges === true) {
      const a = typeof Image.resolveAssetSource === "function" ? Image.resolveAssetSource(nine[`${name}_${part}`]) : null;
      if (a?.width && a?.height) unit = horizontal ? (a.width * k) / a.height : (a.height * k) / a.width;
      else if (name === "board_frame") unit = (horizontal ? 71 / 108 : 60 / 108) * k; // the stud repeat units
      else if (name === "hud_panel") unit = (horizontal ? 62 / 84 : 66 / 84) * k; // the stitch repeat units
    }
    const n = Math.max(1, Math.round(len / Math.max(4, unit)));
    const step = len / n;
    return Array.from({ length: n }, (_, i) => {
      const a = k + i * step - px, b = k + (i + 1) * step + px;
      return horizontal
        ? img(part, a, part === "t" ? 0 : h - k, b - a, k, `${part}${i}`)
        : img(part, part === "l" ? 0 : w - k, a, k, b - a, `${part}${i}`);
    });
  };
  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const next = { w: snap(width), h: snap(height) };
        if (next.w !== w || next.h !== h) setSize(next);
        onLayout?.(next.w, next.h);
      }}
    >
      {w > 0 ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
          {center ? img("c", k - 2 * px, k - 2 * px, mw + 4 * px, mh + 4 * px) : null}
          {edge("t")}
          {edge("b")}
          {edge("l")}
          {edge("r")}
          {img("tl", 0, 0, k, k)}
          {img("tr", w - k, 0, k, k)}
          {img("bl", 0, h - k, k, k)}
          {img("br", w - k, h - k, k, k)}
        </View>
      ) : null}
      {children}
    </View>
  );
}
