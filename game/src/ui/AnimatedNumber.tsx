import { useEffect, useRef, useState } from "react";
import { Text, type TextStyle } from "react-native";

/**
 * Counts smoothly to `value` (coins, score) — rewards should never just "snap". `from` = where the first count
 * starts (default: the value itself, i.e. no count on mount); `delay` holds the start; `onTick(progress)` fires on
 * every shown change (throttled to ~70 ms) for a tick sound / haptic.
 */
export function AnimatedNumber({ value, style, duration = 600, from, delay = 0, onTick }: {
  value: number; style?: TextStyle; duration?: number; from?: number; delay?: number; onTick?: (progress: number) => void;
}) {
  const [shown, setShown] = useState(from ?? value);
  const cur = useRef(from ?? value);
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    const a = cur.current;
    if (a === value) return;
    let raf = 0;
    let lastTick = 0;
    let start = 0;
    const step = () => {
      const now = Date.now();
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (value - a) * eased);
      if (v !== cur.current) {
        cur.current = v;
        setShown(v);
        if (tick.current && (now - lastTick > 70 || t >= 1)) {
          lastTick = now;
          tick.current(t);
        }
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const id = setTimeout(() => (raf = requestAnimationFrame(step)), delay);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);
  return <Text style={style}>{shown.toLocaleString()}</Text>;
}
