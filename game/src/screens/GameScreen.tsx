import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, PanResponder, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, FadeInDown, FadeOut, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Background, Confetti, FailPopup, FloatingText, GameButton, NineSlice, Popup, RoundButton, Tappable, TutorialHand, WinPopup, feedback, fonts, palette, play, haptic, springs, useShake,
} from "../ui";
import { StoryScene } from "../ui/StoryScene";
import { Cell, CellArt, type Poke } from "./game/Cell";
import { Burst, Flyer } from "../fx/Burst";
import { WinStage } from "../fx/WinStage";
import { pieces } from "../pieces";
import { canMerge, itemName, isChainItem, recipeInputs, tierOf, up } from "../game/catalog";
import {
  BOOSTERS, apply, boardSize, coreMoves, dropKind, dropPreview, hasTrunk, isCrate, isFreeItem, isGen, isJar, isThread, isTrunk, legal, nextProduct,
  orderActive, orderFor, startState, starsFor, status, type Booster, type LevelDef, type Move, type State,
} from "../game/engine";
import { LEVELS } from "../game/levels";
import { decodeMove, nextMove, solve } from "../game/solver";
import { dailyLamps, dailyLevel, dailySolution, markDailyDone, dailyKey } from "../game/daily";
import { isRare, parOf, sellValue, sortBoard, storedSolution } from "../game/boardops";
import {
  BOOSTER_INFO, SCENE_OF, addBoosters, beatFor, buyBooster, claimHeirloom, lampsFor, markSeen, meta, noteBazaarDayWin, noteFail, type Beat, type Heirloom,
} from "../game/meta";
import { store } from "../modules/store";
import { ads } from "../modules/ads";
import { analytics } from "../modules/analytics";
import { review } from "../modules/review";
import { qa, reportNext, type QaTouch } from "../modules/qa";
import { useBannerHeight } from "../modules/layout";

type Rect = { x: number; y: number; w: number; h: number };
type ViewRef = React.ComponentRef<typeof View>;
type Hist = { s: State; lamps: number };
/** Long-press merge preview: the held piece, its twins on the board and what merging makes (or a stall's next piece). */
type Peek = { at: number; piece: string; twins: number; kind: "merge" | "big" | "recipe" | "key" | "none" | "top" | "gen"; result?: string; bonus?: string; count?: number; cost?: number };
const BAG_MAX = 12;
const measure = (r: { current: ViewRef | null | undefined }) =>
  new Promise<Rect | null>((res) => {
    if (!r.current) return res(null);
    r.current!.measureInWindow((x: number, y: number, w: number, h: number) => res(w ? { x, y, w, h } : null));
  });
const inside = (r: Rect | null | undefined, x: number, y: number, slop = 6) => !!r && x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The booster tray is there on every board after the first-level tutorial: owned boosters (Dadi's welcome gift, the
 *  daily gift, the Shop) can be used anywhere; a booster not yet taught shows only once owned. Level 1 (the tutorial)
 *  never shows booster slots — not even on a replay after it was won (QA 2026-10-30: 4 tool buttons in play, 6 on the
 *  win card). A Bazaar Day board (its own def objects) follows the player's progress. */
function boosterTray(def: LevelDef, lvl: number) {
  return def.id >= 2 || (lvl >= 2 && def !== LEVELS[0]);
}
/** Starting state with the player's owned boosters (unlocked ones) added to the level's own gift. */
function freshState(def: LevelDef, inv: Record<Booster, number>, lvl: number): State {
  const s = startState(def, def.id - 1);
  s.boosters = BOOSTERS.map((b, i) => s.boosters[i] + (boosterTray(def, lvl) ? inv[b] : 0));
  return s;
}

function blockerText(cell: string): string {
  if (isThread(cell)) return "Tangled thread: merge in a cell beside it to pull a layer loose.";
  if (isJar(cell)) return `Sealed jar: ${cell[1]} more merge${cell[1] === "1" ? "" : "s"} beside it cracks it open.`;
  if (isTrunk(cell)) return `Locked trunk: drop a ${["Brass", "Silver", "Filigree"][Number(cell[1]) - 1]} Key (or better) on it.`;
  if (isCrate(cell)) return "Crate: tap to open it for 1 Spark.";
  return "";
}

/** One level of Merge Bazaar: order tray, merge board, Bag, Sort, Undo, boosters, the "Stuck?" helper, win/fail flow. */
export function GameScreen({ levelNumber, onExit, onSettings, onNextLevel, demo, daily }: {
  levelNumber: number; onExit: () => void; onSettings: () => void; onNextLevel: (n: number) => void;
  /** Bazaar Day: play today's daily board (src/game/daily.ts) instead of `levelNumber`; a win goes back home. */
  daily?: boolean;
  /** Screenshot mode: replay the first `moves` of the proven solution; `win` opens the win popup; `burst` replays the last merge fx. */
  demo?: { moves: number; win?: boolean; burst?: boolean; select?: boolean };
}) {
  const def = useMemo(() => (daily ? dailyLevel() : LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelNumber - 1))]), [daily, levelNumber]);
  const { w: bw, h: bh } = boardSize(def);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bannerH = useBannerHeight();
  const settings = meta().settings;
  const reduce = settings.reduceMotion;
  const sol = useMemo(() => (daily ? dailySolution(def) : storedSolution(def)), [def, daily]);
  /** Sparks the proof spends (efficiency star). */
  const par = useMemo(() => {
    if (!daily) return parOf(def);
    let t = startState(def, def.id - 1);
    for (const x of sol) t = apply(def, t, decodeMove(x));
    return def.sparks - t.sparks;
  }, [def, daily, sol]);
  /** QA level replay: every animation runs at double speed so the next touch can follow promptly. */
  const fast = qa.level != null;

  const invAtStart = useRef(meta().boosters);
  /** The player's progress when this attempt began: the booster tray is decided from it, never from the live store
   *  (a win raises store.level and would grow the tray from 4 to 6 buttons under the result card). */
  const lvlAtStart = useRef(store.get().level);
  const [s, setS] = useState<State>(() => freshState(def, invAtStart.current, lvlAtStart.current));
  /** The tool bar's booster slots, fixed for the whole attempt (and its result card): decided once from the attempt's
   *  start (owned / gifted / taught), so the bar never grows or shrinks while a board or its result is on screen. A
   *  booster used up keeps its slot ("+" opens the Shop offer). Recomputed only by Retry / Replay. */
  const trayFor = () => {
    const start = freshState(def, invAtStart.current, lvlAtStart.current).boosters;
    return boosterTray(def, lvlAtStart.current) ? BOOSTERS.filter((b, i) => start[i] > 0 || lvlAtStart.current >= BOOSTER_INFO[b].from) : [];
  };
  const [tray, setTray] = useState<Booster[]>(trayFor);
  const [hist, setHist] = useState<Hist[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [armed, setArmed] = useState<Booster | null>(null);
  /** Bumped when a stall / crate tap can't be paid: the Sparks bar shakes, flashes red and its "+" pulses. */
  const [deny, setDeny] = useState(0);
  const [bagOpen, setBagOpen] = useState(false);
  const [hint, setHint] = useState<Move | null>(null);
  const [helperUses, setHelperUses] = useState(0);
  const [result, setResult] = useState<"win" | "fail" | null>(null);
  const [toast, setToast] = useState<{ text: string; k: number } | null>(null);
  const [bursts, setBursts] = useState<{ k: number; x: number; y: number; big: boolean }[]>([]);
  const [flyers, setFlyers] = useState<{ k: number; piece: string; from: { x: number; y: number }; to: { x: number; y: number }; duration: number; arc: number; endScale: number; trail?: boolean; size?: number }[]>([]);
  const [puffs, setPuffs] = useState<{ k: number; x: number; y: number }[]>([]);
  const [floaters, setFloaters] = useState<{ k: number; text: string; x: number; y: number; combo?: boolean }[]>([]);
  const [spawn, setSpawn] = useState<Record<number, { dx: number; dy: number; k: number; hide?: number }>>({});
  const [pokes, setPokes] = useState<Record<number, Poke>>({});
  const [wave, setWave] = useState(false);
  const combo = useRef({ n: 0, t: 0 });
  const [drag, setDrag] = useState<{ from: number; piece: string } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [confirmSell, setConfirmSell] = useState<number | null>(null);
  const [buyAsk, setBuyAsk] = useState<Booster | null>(null);
  const [story, setStory] = useState<Beat | null>(() => {
    const b = beatFor(levelNumber);
    return b && !daily && !demo && qa.level == null && !meta().storySeen.includes(b.id) ? b : null;
  });
  const [winInfo, setWinInfo] = useState<{ stars: number; lamps: number; heirloom: Heirloom | null; setDone: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [winSparks, setWinSparks] = useState<{ k: number; x: number; y: number }[]>([]);
  /** Board fireworks during the win staging: each bump fires a confetti shell from a board corner. */
  const [shell, setShell] = useState<{ n: number; x: number; y: number }>({ n: 0, x: 0, y: 0 });
  const boardPulse = useSharedValue(0);
  const boardPulseSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 + boardPulse.value * 0.045 }] }));
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [handAt, setHandAt] = useState<{ from: { x: number; y: number }; to?: { x: number; y: number }; piece?: string; point?: boolean } | null>(null);
  /** Cell under the finger (-1 none): a shared value, so the press squash starts on the UI thread with no React render. */
  const pressAt = useSharedValue(-1);
  /** Sparks the stall / crate under the finger would cost: the Sparks bar ghosts that much before the tap lands. */
  const ghostCost = useSharedValue(0);
  /** Long-press merge preview: what this piece becomes and how many twins are on the board. */
  const [peek, setPeek] = useState<Peek | null>(null);
  const [refillOpen, setRefillOpen] = useState(false);
  /** The coach row's box (window coords): the peek card sits over it, and the hand's path dots skip it. */
  const [coachBox, setCoachBox] = useState<Rect | null>(null);
  /** One +3 Sparks refill per attempt (Retry restores the full budget anyway). */
  const [refillUsed, setRefillUsed] = useState(false);
  const [failInfo, setFailInfo] = useState<{ title: string; message: string; gift: string | null; sparks?: boolean }>({ title: "Out of moves", message: "", gift: null });
  const failTracked = useRef(false);
  const lastDrop = useRef<{ x: number; y: number } | null>(null);
  // Level 1's coach line already explains Sparks (and it is marked seen there); later boards get the bubble once.
  const [sparkTip, setSparkTip] = useState(() => !demo && qa.level == null && !store.get().tips?.sparks && def.gens.length > 0 && !(def.id === 1 && !daily));
  const kRef = useRef(1);
  const k = () => kRef.current++;
  const settled = useRef(false);
  const { style: shakeStyle, shake } = useShake(8);

  // geometry: the whole framed board (cells + cell field + carved frame) fits the area with a small margin
  const cell = area.w ? Math.max(30, Math.floor(Math.min((area.w - 18) / (bw + 0.56), (area.h - 18) / (bh + 0.56), 96))) : 0;
  const frameK = Math.max(16, Math.round(cell * 0.46)); // frame corner size (dp)
  const pad = Math.round(frameK * 0.6); // frame band + gap before the cell field
  const gridRef = useRef<ViewRef>(null);
  const trayRef = useRef<ViewRef>(null);
  const bagRef = useRef<ViewRef>(null);
  const cardRefs = useRef<(ViewRef | null)[]>([]);
  const boostRefs = useRef<Partial<Record<Booster, ViewRef | null>>>({});
  const slotRef = useRef<ViewRef>(null);
  const sparkRef = useRef<ViewRef>(null);
  const origin = useRef({ x: 0, y: 0 });
  const zones = useRef<{ tray: Rect | null; bag: Rect | null; cards: (Rect | null)[] }>({ tray: null, bag: null, cards: [] });
  const refreshOrigin = useCallback(() => {
    gridRef.current?.measureInWindow((x: number, y: number) => (origin.current = { x, y }));
  }, []);
  const cellCentre = (i: number) => ({ x: origin.current.x + ((i % bw) + 0.5) * cell, y: origin.current.y + (Math.floor(i / bw) + 0.5) * cell });

  /* ───────── start / demo ───────── */
  useEffect(() => {
    if (daily) analytics.track("daily_start", { day: dailyKey(), board: def.id });
    else analytics.track("level_start", { level: def.id });
    if (demo) {
      let t = freshState(def, invAtStart.current, lvlAtStart.current);
      for (const x of sol.slice(0, demo.moves)) {
        const m = decode(x);
        if (legal(def, t, m)) t = apply(def, t, m);
      }
      setS(t);
      if (demo.select) {
        const i = t.cells.findIndex((c, j) => isFreeItem(c) && t.cells.some((d, q) => q !== j && dropKind(def, t, j, q) === "merge"));
        if (i >= 0) setSel(i);
      }
      if (demo.win) {
        setWave(true);
        setTimeout(() => finishWin(t), 250);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cell) return;
    const id = setTimeout(() => {
      refreshOrigin();
      setReady(true);
      if (demo?.burst) {
        const last = sol[Math.max(0, demo.moves - 1)];
        const m = last ? decode(last) : null;
        if (m && m.k === "drop") {
          fxAt(m.to, true, "Big Merge!");
          const loop = setInterval(() => fxAt(m.to, true, "Big Merge!"), 1600);
          setTimeout(() => clearInterval(loop), 60000);
        }
      }
    }, 480);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, area.w, area.h]);

  /* ───────── fx helpers ───────── */
  function fxAt(i: number, big: boolean, text?: string) {
    const c = cellCentre(i);
    const kk = k();
    setBursts((b) => [...b.slice(-4), { k: kk, x: c.x, y: c.y, big }]);
    if (text) setFloaters((f) => [...f.slice(-2), { k: kk, text, x: c.x, y: c.y - cell * 0.4 }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.k !== kk)), 1300);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.k !== kk)), 1700);
  }
  function puffAt(i: number) {
    if (reduce || i < 0) return;
    const c = cellCentre(i);
    const kk = k();
    setPuffs((p) => [...p.slice(-3), { k: kk, x: c.x, y: c.y + cell * 0.25 }]);
    setTimeout(() => setPuffs((p) => p.filter((x) => x.k !== kk)), 420);
  }
  function fly(piece: string, from: { x: number; y: number }, to: { x: number; y: number }, opts: { duration: number; arc: number; endScale: number; trail?: boolean; size?: number }) {
    const kk = k();
    setFlyers((f) => [...f.slice(-6), { k: kk, piece, from, to, ...opts }]);
  }
  function say(text: string) {
    setToast({ text, k: k() });
  }
  function comboCall(n: number) {
    const kk = k();
    const x = origin.current.x + (bw * cell) / 2;
    const y = origin.current.y + cell * 0.6;
    setFloaters((f) => [...f.slice(-2), { k: kk, text: `Combo ×${n}!`, x, y, combo: true }]);
    setTimeout(() => setFloaters((f) => f.filter((q) => q.k !== kk)), 1300);
  }
  /** Win lighting wave: every cell lights up in rings spreading from the board's centre. */
  function waveDelay(i: number) {
    const dx = (i % bw) - (bw - 1) / 2, dy = Math.floor(i / bw) - (bh - 1) / 2;
    return Math.round(Math.hypot(dx, dy) * 85);
  }
  function poke(i: number, kind: Poke["kind"]) {
    if (i >= 0) setPokes((p) => ({ ...p, [i]: { k: k(), kind } }));
  }
  /** Back-to-back merges (within 3 s) build a combo: rising pitch, a "Combo ×N" call-out, a bigger bloom. */
  function bumpCombo() {
    const now = Date.now();
    combo.current = { n: now - combo.current.t < 3000 ? combo.current.n + 1 : 1, t: now };
    return combo.current.n;
  }

  /* ───────── committing moves ───────── */
  function commit(next: State, m: Move | { k: "sort" } | { k: "sellx"; from: number }, lamps = 0) {
    setHist((h) => [...h, { s, lamps }]);
    setS(next);
    setSel(null);
    setHint(null);
    setArmed(null);
    analytics.qa("move", { level: def.id });
    if (lamps) store.set({ coins: store.get().coins + lamps });
    // fx + sounds per move kind
    if (m.k === "tap") {
      if (isGen(s.cells[m.at])) {
        const at = next.cells.findIndex((c, i) => c !== s.cells[i] && i !== m.at);
        if (at >= 0) {
          // the new piece flies out of the stall on a high arc with a light trail (an overlay above every tile, so the
          // stall's own tile never hides the start of the flight), lands with a pop and a sparkle burst where it settles
          const flight = reduce ? 0 : fast ? 200 : 480;
          setSpawn((p) => ({ ...p, [at]: { dx: ((m.at % bw) - (at % bw)) * cell, dy: (Math.floor(m.at / bw) - Math.floor(at / bw)) * cell, k: k(), hide: flight } }));
          if (flight) fly(next.cells[at], cellCentre(m.at), cellCentre(at), { duration: flight, arc: cell * 0.95, endScale: 1, trail: true, size: Math.round(cell * 0.76) });
          setTimeout(() => fxAt(at, false), flight);
        }
        poke(m.at, "bump");
        puffAt(m.at);
        // the paid Spark visibly leaves the bar and lands in the stall, which rings and sparkles as it works
        const sc = cellCentre(m.at);
        const kb = k();
        setBursts((b) => [...b.slice(-4), { k: kb, x: sc.x, y: sc.y, big: false }]);
        setTimeout(() => setBursts((b) => b.filter((x) => x.k !== kb)), 1300);
        if (!reduce && qa.level == null) measure(sparkRef).then((bar) => bar && fly("cur_spark", { x: bar.x + bar.w * 0.2, y: bar.y + bar.h / 2 }, sc, { duration: 260, arc: 30, endScale: 0.5, size: 30 }));
        if (sparkTip) closeSparkTip();
        play("move", 1, 0.95 + Math.random() * 0.1);
        haptic("light");
        analytics.track("energy_spent", { level: def.id });
      } else {
        feedback("unlock", "medium");
        fxAt(m.at, false);
      }
    } else if (m.k === "drop") {
      const kind = dropKind(def, s, m.from, m.to);
      // the merging piece(s) slide into the target (from where the finger let go, else from their cell)
      if (kind && kind !== "move" && !reduce) {
        const to = cellCentre(m.to);
        // a short hop into the partner (a visible arc even when let go right over it), then the result snaps in
        const sl = { duration: fast ? 70 : 190, arc: fast ? 0 : 26, endScale: 0.7 };
        fly(s.cells[m.from], lastDrop.current ?? cellCentre(m.from), to, sl);
        if (kind === "big") next.cells.forEach((c, i) => {
          if (i !== m.from && i !== m.to && c === "." && s.cells[i] === s.cells[m.from]) fly(s.cells[i], cellCentre(i), to, { ...sl, duration: sl.duration + 60 });
        });
      }
      lastDrop.current = null;
      if (kind === "big" || kind === "merge" || kind === "recipe") setTimeout(() => poke(m.to, "merge"), fast ? 40 : 150);
      const n = kind === "big" || kind === "merge" || kind === "recipe" ? bumpCombo() : 0;
      const pitch = 0.88 + Math.min(5, tierOf(next.cells[m.to]) || 3) * 0.05 + Math.min(4, n - 1) * 0.04;
      if (n >= 2) setTimeout(() => comboCall(n), 160);
      if (kind === "big") {
        play("success", 1, pitch);
        haptic("heavy");
        if (!reduce) shake(1);
        fxAt(m.to, true, "Big Merge!");
        analytics.track("big_merge_performed", { level: def.id });
      } else if (kind === "merge" || kind === "recipe") {
        play(tierOf(next.cells[m.to]) >= 3 || kind === "recipe" ? "star2" : "pop", 1, pitch);
        haptic(kind === "recipe" || tierOf(next.cells[m.to]) >= 4 || n >= 3 ? "medium" : "light");
        if (!reduce) shake(n >= 3 ? 0.6 : 0.42);
        // every merge gets the full payoff: ring + sparks bloom, the result's name floats up
        setTimeout(() => fxAt(m.to, true, `${itemName(next.cells[m.to])}!`), fast ? 40 : 150);
        if (kind === "recipe") analytics.track("recipe_merge", { level: def.id });
      } else if (kind === "key") {
        feedback("unlock", "heavy");
        fxAt(m.to, true, "Unlocked!");
      } else feedback("move", "select");
      // blockers that changed around the merge
      next.cells.forEach((c, i) => {
        if (i !== m.to && i !== m.from && c !== s.cells[i] && (isThread(s.cells[i]) || isJar(s.cells[i]))) {
          setTimeout(() => {
            fxAt(i, false, isThread(c) || isJar(c) ? undefined : isThread(s.cells[i]) ? "Untangled!" : "Cracked!");
            play("unlock", 0.7, 1.1);
          }, 140);
        }
      });
    } else if (m.k === "deliver") {
      const o = orderFor(def, s, s.cells[m.from]);
      const piece = s.cells[m.from];
      const start = lastDrop.current ?? cellCentre(m.from);
      // the card's box: known from a drag, else measured now (a tap on the card never measured it — the piece then
      // vanished with no flight or burst, QA 2026-10-29 "only a small check appears")
      const land = (card: Rect | null) => {
        if (!card) return;
        const to = centre(card);
        const filled = next.need[o] === 0;
        fly(piece, start, to, { duration: fast ? 240 : LAND_MS, arc: 70, endScale: 0.55, trail: !reduce, size: cell * 1.05 });
        setTimeout(() => {
          const kb = k();
          setBursts((b) => [...b.slice(-4), { k: kb, x: to.x, y: to.y, big: filled }]);
          // the card itself answers (punch, progress bar, check stamp); the words go to the coach line, so no
          // floating text ever sits over the order icon, its count or the coach text
          if (filled && status(def, next) !== "won") say(`${itemName(def.orders[o].item)} order filled!`);
          setTimeout(() => setBursts((b) => b.filter((x) => x.k !== kb)), 1300);
          play(filled ? "star3" : "coin");
          haptic(filled ? "success" : "light");
          if (filled && !reduce) shake(0.35);
        }, fast ? 240 : LAND_MS);
      };
      const known = zones.current.cards[o];
      if (known) land(known);
      else measure({ current: cardRefs.current[o] ?? null }).then(land);
      lastDrop.current = null;
      play("whoosh", 0.6, 1.2);
      haptic("medium");
      analytics.track("order_fulfilled", { level: def.id });
    } else if (m.k === "boost") {
      play("whoosh");
      haptic("heavy");
      if (!reduce) shake(1);
      fxAt(m.at, true, BOOSTER_INFO[m.b].name + "!");
      // every tile it opened bursts too; a shot on bare tiles still shows its blast and says so
      const opened = next.cells.map((c, i) => (c !== s.cells[i] ? i : -1)).filter((i) => i >= 0 && i !== m.at);
      opened.forEach((i, n) => setTimeout(() => fxAt(i, false), 90 + n * 50));
      if (!opened.length && next.cells[m.at] === s.cells[m.at]) say(`${BOOSTER_INFO[m.b].name}! Nothing was locked here — save the next one for crates and knots.`);
      else say(`${BOOSTER_INFO[m.b].name}! ${opened.length + (next.cells[m.at] !== s.cells[m.at] ? 1 : 0)} tile${opened.length ? "s" : ""} opened.`);
      analytics.track("booster_used", { booster: m.b, level: def.id });
    } else if (m.k === "sort") {
      feedback("whoosh", "medium");
      analytics.track("sort_used", { level: def.id });
    } else if (m.k === "bag") {
      feedback("pop", "light");
      analytics.track("bag_store", { level: def.id });
    } else feedback("pop", "light");
  }

  function tryMove(m: Move): boolean {
    if (!legal(def, s, m)) return false;
    commit(apply(def, s, m), m);
    return true;
  }

  /* ───────── status: win, lost, or stuck (no win reachable any more) ───────── */
  /** One line on what went wrong, for the "Out of moves" card. */
  function failReason(st: State): { title: string; message: string; sparks?: boolean } {
    const open = def.orders.map((o, i) => (st.need[i] > 0 ? itemName(o.item) : "")).filter(Boolean);
    const what = open.length ? `the ${open[0]}${open.length > 1 ? ` (and ${open.length - 1} more)` : ""} order` : "the board goal";
    const canPay = def.gens.some((g) => st.sparks >= (g.cost ?? 1)) || (st.sparks >= 1 && st.cells.some(isCrate));
    if (!canPay) return { title: "Out of moves", message: `No Sparks left, and the pieces on the board can't finish ${what}.`, sparks: true };
    if (!st.cells.includes(".")) return { title: "Out of moves", message: `The board is full and nothing left merges toward ${what}.` };
    return { title: "Out of moves", message: `No move left can finish ${what}.` };
  }
  function failNow(st: State) {
    setFailInfo({ ...failReason(st), gift: null });
    setResult("fail");
    if (failTracked.current) return;
    failTracked.current = true;
    if (daily) analytics.track("daily_fail", { day: dailyKey(), board: def.id });
    else {
      analytics.track("level_fail", { level: def.id });
      const gift = noteFail(def.id);
      if (gift) setFailInfo((f) => ({ ...f, gift: `A gift from Dadi: a free ${BOOSTER_INFO[gift].name}!` }));
    }
  }
  useEffect(() => {
    if (result || demo) return;
    const st = status(def, s);
    if (st === "won") {
      // beats: the delivered piece lands on its card (LAND_MS: the count ticks 0/1 → 1/1 with a bounce and the check
      // pops) → the board celebrates ~1.8 s (screen flash, the big diya lights at its centre, a sparkle wave over every
      // tile, firework shells) → only then the result card comes in. QA replay (fast) skips the wait.
      const timers: ReturnType<typeof setTimeout>[] = [];
      const land = fast || reduce ? 0 : LAND_MS;
      const begin = () => {
      setCelebrate((c) => c + 1);
      setWave(true);
      play("success");
      haptic("success");
      if (!reduce && !fast) {
        boardPulse.value = withSequence(withTiming(1, { duration: 140 }), withSpring(0, springs.pop));
        const lit = s.cells.map((c, i) => i).filter((i) => s.cells[i] !== "#").sort((a, b) => waveDelay(a) - waveDelay(b));
        lit.filter((_, j) => j % Math.max(1, Math.ceil(lit.length / 12)) === 0).forEach((i) => {
          timers.push(setTimeout(() => {
            const c = cellCentre(i);
            const kk = k();
            setWinSparks((w) => [...w, { k: kk, x: c.x, y: c.y }]);
            timers.push(setTimeout(() => setWinSparks((w) => w.filter((q) => q.k !== kk)), 1300));
          }, 120 + waveDelay(i)));
        });
        timers.push(setTimeout(() => play("star3", 0.8, 1.1), 420));
        // the celebration escalates: three firework shells burst over the board (left, right, centre), each with a
        // big ring + sparks on a lit tile and a rising pop, before the result card arrives
        const shells = [0.22, 0.78, 0.5];
        const lit2 = s.cells.map((c, i) => i).filter((i) => s.cells[i] !== "#");
        shells.forEach((fx, n) => {
          timers.push(setTimeout(() => {
            const bx = origin.current.x + bw * cell * fx;
            const by = origin.current.y + bh * cell * (n === 2 ? 0.35 : 0.55);
            setShell({ n: Date.now(), x: bx, y: by });
            const at = lit2[Math.floor((n + 1) * lit2.length / 4) % Math.max(1, lit2.length)];
            if (at !== undefined) {
              const c = cellCentre(at);
              const kb = k();
              setBursts((b) => [...b.slice(-4), { k: kb, x: c.x, y: c.y, big: true }]);
              timers.push(setTimeout(() => setBursts((b) => b.filter((q) => q.k !== kb)), 1300));
            }
            play("pop", 0.7, 1 + n * 0.12);
            haptic(n === 2 ? "heavy" : "medium");
          }, 650 + n * 420));
        });
      }
      };
      if (land) timers.push(setTimeout(begin, land));
      else begin();
      timers.push(setTimeout(() => finishWin(s), fast ? 350 : reduce ? 900 : land + 2200));
      return () => timers.forEach(clearTimeout);
    }
    if (st === "lost") {
      const id = setTimeout(() => failNow(s), fast ? 300 : 650);
      return () => clearTimeout(id);
    }
    // Stuck: moves remain (e.g. merges of leftovers) but no win is reachable. Only checked once no Spark can pay for
    // a tap any more (then the rest of the game is a small, finite search), after the move's animation, never in QA
    // replay (the replayed proof is always winnable), and only when the solver finds no win at all.
    if (qa.level != null || story) return;
    if (coreMoves(def, s).some((m) => m.k === "tap")) return;
    const id = setTimeout(() => {
      const win = solve(def, s, 80, 100) ?? solve(def, s, 500, 140);
      if (!win) failNow(s);
    }, reduce ? 500 : 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, story]);

  /** Owned boosters spent this attempt leave the inventory (an undo before the end gives them back). */
  function settleBoosters(final: State) {
    if (settled.current || demo) return;
    settled.current = true;
    BOOSTERS.forEach((b, i) => {
      const gift = def.boosters?.[b] ?? 0;
      const start = freshState(def, invAtStart.current, lvlAtStart.current).boosters[i];
      const fromInv = Math.max(0, start - final.boosters[i] - gift);
      if (fromInv) addBoosters(b, -fromInv);
    });
  }

  function finishWin(final: State) {
    const stars = starsFor(def, final, par);
    const lamps = daily ? dailyLamps(stars) : lampsFor(def.id, stars);
    let h: ReturnType<typeof claimHeirloom> = null;
    if (daily && !demo) {
      settleBoosters(final);
      store.set({ coins: store.get().coins + lamps });
      markDailyDone();
      noteBazaarDayWin(dailyKey()); // meta: Bazaar Day wins (heirlooms, festival points)
      analytics.track("daily_complete", { day: dailyKey(), board: def.id, stars });
    } else if (!demo) {
      settleBoosters(final);
      const prev = store.get().stars ?? {};
      store.set({
        stars: { ...prev, [def.id]: Math.max(prev[def.id] ?? 0, stars) },
        coins: store.get().coins + lamps,
        level: Math.max(store.get().level, def.id + 1),
      });
      analytics.track("level_complete", { level: def.id, stars });
      review.levelWon(def.id); // Play in-app review at a happy moment (gated: level >= 3, 30-day cooldown, never in QA)
      h = claimHeirloom(def.id);
      if (def.id === 1) store.set({ tips: { ...(store.get().tips ?? {}), sparks: true } });
      if (def.id === 2 && !store.get().tutorialDone) {
        store.set({ tutorialDone: true });
        analytics.track("tutorial_done");
      }
      if (def.id === LEVELS.filter((l) => l.chapter === def.chapter).pop()?.id) analytics.track("chapter_complete", { chapter: def.chapter });
    }
    setWinInfo({ stars, lamps, heirloom: h?.heirloom ?? null, setDone: h?.setDone ?? false });
    setResult("win");
  }

  function restart() {
    failTracked.current = false;
    settleBoosters(s);
    settled.current = false;
    invAtStart.current = meta().boosters;
    lvlAtStart.current = store.get().level;
    setS(freshState(def, invAtStart.current, lvlAtStart.current));
    setTray(trayFor());
    setHist([]);
    setResult(null);
    setSel(null);
    setArmed(null);
    setHint(null);
    setWave(false);
    setRefillUsed(false);
    setPeek(null);
    sparkPeak.current = def.sparks;
    combo.current = { n: 0, t: 0 };
    if (daily) analytics.track("daily_start", { day: dailyKey(), board: def.id, retry: 1 });
    else analytics.track("level_start", { level: def.id, retry: 1 });
    analytics.qa("move", { level: def.id });
  }

  function undo() {
    const prev = hist[hist.length - 1];
    if (!prev) {
      say("Nothing to undo yet.");
      return;
    }
    if (prev.lamps) store.set({ coins: Math.max(0, store.get().coins - prev.lamps) });
    setHist((h) => h.slice(0, -1));
    setS(prev.s);
    setSel(null);
    setArmed(null);
    setHint(null);
    setResult(null);
    setWave(false);
    play("whoosh", 1, 0.8);
    haptic("select");
    analytics.qa("move", { level: def.id });
    analytics.track("undo_used", { level: def.id });
  }

  /* ───────── player input ───────── */
  function tapCell(i: number) {
    if (result) return;
    const c = s.cells[i];
    setBagOpen(false);
    if (armed) {
      if (tryMove({ k: "boost", b: armed, at: i })) return;
      feedback("error", "warning");
      poke(i, "nope");
      say(armed === "needle" ? "Tap a tile wrapped in thread." : "Tap the tiles you want to burst open.");
      return;
    }
    if (isGen(c) || isCrate(c)) {
      if (sel !== null && isCrate(c)) setSel(null);
      if (tryMove({ k: "tap", at: i })) return;
      feedback("error", "warning");
      poke(i, "nope");
      if (!reduce) shake();
      if (!s.cells.includes(".") && isGen(c)) say("The board is full — merge, deliver or store a piece in the Bag.");
      else {
        setDeny((d) => d + 1);
        say(`Not enough Sparks — ${isGen(c) ? `this stall costs ${def.gens[Number(c.slice(1))].cost ?? 1}` : "a crate costs 1"}.`);
        // out of Sparks on a stall the player wants: offer the opt-in refill (the player still chooses to watch)
        if (!refillUsed && !demo && qa.level == null) setTimeout(() => setRefillOpen(true), 350);
      }
      return;
    }
    if (sel !== null) {
      if (sel === i) {
        setSel(null);
        feedback("tap", "select");
        return;
      }
      if (dropKind(def, s, sel, i) && tryMove({ k: "drop", from: sel, to: i })) return;
    }
    if (isFreeItem(c)) {
      setSel(i);
      puffAt(i);
      feedback("tap", "select");
      return;
    }
    const why = blockerText(c);
    if (why) {
      feedback("tap", "select");
      poke(i, "nope");
      say(why);
    } else if (c === ".") feedback("tap", "select");
    setSel(null);
  }

  function deliverTo(o: number) {
    if (result) return;
    const want = def.orders[o];
    if (!orderActive(def, s, o)) {
      say(s.need[o] === 0 ? "This order is filled — well done!" : `Opens after the "${itemName(def.orders[want.after!].item)}" order.`);
      return;
    }
    const from = sel !== null && s.cells[sel] === want.item ? sel : s.cells.findIndex((c) => c === want.item);
    if (from >= 0 && tryMove({ k: "deliver", from })) return;
    feedback("tap", "select");
    const rec = recipeInputs(want.item);
    const pays = want.reward ? ` It pays a ${itemName(want.reward)}.` : "";
    say(rec ? `${itemName(want.item)} = ${itemName(rec[0])} + ${itemName(rec[1])}.${pays}` : `Make a ${itemName(want.item)} and drop it here.${pays}`);
  }

  function bagAction() {
    if (result) return;
    if (sel !== null) {
      if (s.bag.length >= BAG_MAX) return say("The Bag is full (12).");
      tryMove({ k: "bag", from: sel });
      return;
    }
    if (!s.bag.length) return say("Select a piece, then tap Bag to store it for later.");
    setBagOpen((o) => !o);
  }

  function sell(i: number, confirmed = false) {
    const c = s.cells[i];
    if (!isFreeItem(c)) return;
    if (isRare(c) && !confirmed) {
      setConfirmSell(i);
      analytics.track("sell_confirm_shown", { level: def.id });
      return;
    }
    setConfirmSell(null);
    const next = apply(def, s, { k: "sell", from: i });
    commit(next, { k: "sellx", from: i }, sellValue(c));
    analytics.track("sell_confirmed", { level: def.id });
    fxAt(i, false, `+${sellValue(c)} Lamps`);
    say(`Sold ${itemName(c)} for ${sellValue(c)} Lamps — Undo brings it back.`);
  }

  function useBooster(b: Booster) {
    if (result) return;
    const i = BOOSTERS.indexOf(b);
    if (s.boosters[i] <= 0) {
      setBuyAsk(b);
      return;
    }
    setSel(null);
    setArmed((a) => (a === b ? null : b));
    feedback("tap", "medium");
  }

  function helper() {
    if (result) return;
    const free = helperUses === 0;
    const show = () => {
      const m = nextMove(def, s, sol);
      setHelperUses((u) => u + 1);
      analytics.track("helper_used", { level: def.id });
      if (!m) return say("No winning path from here — try Undo or restart the board.");
      setHint(m);
      say(
        m.k === "tap" ? "Try tapping the glowing tile." : m.k === "deliver" ? "That glowing piece is ready for an order — tap its order card." :
        m.k === "boost" ? `Use your ${BOOSTER_INFO[m.b].name} on the glowing tile.` : m.k === "unbag" ? "Take a piece out of your Bag." : "Drag the glowing piece onto the other glowing tile.",
      );
    };
    if (free || qa.level != null) return show();
    // later hints are an opt-in rewarded ad; if no ad can load, the hint is granted anyway
    if (!ads.showRewarded(show)) show();
  }

  /** Long-press: preview what this piece merges into (and how many twins are on the board) or what a stall makes next. */
  function showPeek(i: number) {
    if (result) return;
    const c = s.cells[i];
    let p: Peek | null = null;
    const g = /(^|\|)g(\d+)$/.exec(c);
    if (g && isGen(c)) {
      const gi = Number(g[2]);
      const next = nextProduct(def, s, gi);
      p = { at: i, piece: next, twins: s.cells.filter((x) => x === next).length, kind: "gen", cost: def.gens[gi].cost ?? 1 };
    } else if (isFreeItem(c)) {
      const twins = s.cells.filter((x) => x === c).length;
      let best: ReturnType<typeof dropPreview> | null = null;
      for (let j = 0; j < s.cells.length; j++) {
        if (j === i) continue;
        const pv = dropPreview(def, s, i, j);
        if (pv.kind === "big") {
          best = pv;
          break;
        }
        if ((pv.kind === "merge" || pv.kind === "recipe" || pv.kind === "key") && !best) best = pv;
      }
      p = best && best.kind && best.kind !== "move"
        ? { at: i, piece: c, twins, kind: best.kind, result: best.result, bonus: best.bonus, count: best.count }
        : { at: i, piece: c, twins, kind: canMerge(c) ? "none" : "top", result: canMerge(c) ? up(c) : undefined };
      setSel(i);
    }
    if (!p) return;
    setPeek(p);
    setBagOpen(false);
    play("pop", 0.8, 1.15);
    haptic("medium");
    analytics.track("merge_preview", { level: def.id, kind: p.kind });
  }
  useEffect(() => {
    if (!peek) return;
    const id = setTimeout(() => setPeek(null), 3200);
    return () => clearTimeout(id);
  }, [peek]);
  useEffect(() => setPeek(null), [s]);

  /** +3 Sparks from an opt-in rewarded ad (Sparks bar or the "Out of moves" card), once per attempt. */
  function refill() {
    if (refillUsed || result === "win") return;
    const grant = () => {
      setRefillUsed(true);
      setRefillOpen(false);
      setResult(null);
      setS((x) => ({ ...x, sparks: x.sparks + 3 }));
      // Undo never takes the bought Sparks back
      setHist((h) => h.map((e) => ({ ...e, s: { ...e.s, sparks: e.s.sparks + 3 } })));
      play("coin");
      haptic("success");
      // the words rise over the middle of the board (free space, never over the HUD or the order tray) and three
      // Sparks fly from there into the bar, which punches as they land
      const kk = k();
      const mid = { x: origin.current.x + (bw * cell) / 2, y: origin.current.y + (bh * cell) / 2 };
      setFloaters((f) => [...f.slice(-2), { k: kk, text: "+3 Sparks!", x: mid.x, y: mid.y }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.k !== kk)), 1300);
      measure(sparkRef).then((bar) => {
        if (!bar || reduce) return;
        const to = { x: bar.x + bar.w * 0.2, y: bar.y + bar.h / 2 };
        [0, 1, 2].forEach((n) => setTimeout(() => fly("cur_spark", { x: mid.x + (n - 1) * 34, y: mid.y }, to, { duration: 520, arc: 60, endScale: 0.6, trail: true, size: 34 }), 180 + n * 110));
      });
      say("+3 Sparks — spend them on what the orders need.");
      analytics.track("rewarded_ad_completed", { level: def.id, reward: "sparks" });
      analytics.qa("move", { level: def.id });
    };
    setRefillOpen(false);
    analytics.track("rewarded_ad_offer_accepted", { level: def.id, reward: "sparks" });
    // The player pressed "Watch an ad". When no ad can load (offline, no fill) Dadi lends the Sparks anyway, so the
    // button never dead-ends.
    if (!ads.showRewarded(grant)) grant();
  }

  function sort() {
    if (result) return;
    const next = sortBoard(s);
    if (!next) return say("Already tidy!");
    commit(next, { k: "sort" });
  }

  /* ───────── gestures (one responder on the grid: tap or drag) ───────── */
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostTilt = useSharedValue(0);
  const ghostStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ghostX.value }, { translateY: ghostY.value }, { rotate: `${ghostTilt.value}deg` }, { scale: 1.08 }] }));
  const gs = useRef({ start: -1, x0: 0, y0: 0, dragging: false, hover: -1, long: false });
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLp = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    lpTimer.current = null;
  };
  const live = useRef({ s, sel, result, armed, cell, bw, bh });
  live.current = { s, sel, result, armed, cell, bw, bh };
  const handlers = useRef({ tapCell, dropAt: (_from: number, _x: number, _y: number) => {}, startDrag: (_i: number) => {}, hoverAt: (_i: number) => {}, longPress: (_i: number) => {} });
  handlers.current.tapCell = tapCell;
  handlers.current.longPress = (i: number) => showPeek(i);
  handlers.current.startDrag = (i: number) => {
    pressAt.value = -1;
    setPeek(null);
    setDrag({ from: i, piece: s.cells[i] });
    setSel(i);
    setBagOpen(false);
    feedback("tap", "light");
    Promise.all([measure(trayRef), measure(bagRef), ...def.orders.map((_, o) => measure({ current: cardRefs.current[o] }))]).then(([tray, bag, ...cards]) => {
      zones.current = { tray, bag, cards };
    });
  };
  handlers.current.hoverAt = (i: number) => setHover(i);
  handlers.current.dropAt = (from: number, x: number, y: number) => {
    setDrag(null);
    setHover(null);
    const to = cellAt(x, y);
    lastDrop.current = { x, y: y - live.current.cell * 0.2 }; // where the lifted piece was let go
    if (to >= 0 && to !== from) {
      if (tryMove({ k: "drop", from, to })) return;
      feedback("error", "warning");
      poke(to, "nope");
      poke(from, "nope");
      const why = blockerText(s.cells[to]);
      say(why || `${itemName(s.cells[from])} only merges with an identical piece${dropKind(def, s, from, to) === null && isFreeItem(s.cells[to]) ? " or its recipe partner" : ""}.`);
      return;
    }
    const z = zones.current;
    if (inside(z.tray, x, y, 10)) {
      const o = orderFor(def, s, s.cells[from]);
      if (o >= 0 && tryMove({ k: "deliver", from })) return;
      feedback("error", "warning");
      say(`No open order wants a ${itemName(s.cells[from])}.`);
      return;
    }
    if (inside(z.bag, x, y, 14)) {
      if (s.bag.length < BAG_MAX && tryMove({ k: "bag", from })) return;
    }
    lastDrop.current = null;
    setSel(from);
  };
  function cellAt(x: number, y: number) {
    const { cell: c, bw: w, bh: h } = live.current;
    const cx = Math.floor((x - origin.current.x) / c), cy = Math.floor((y - origin.current.y) / c);
    return cx >= 0 && cx < w && cy >= 0 && cy < h ? cy * w + cx : -1;
  }
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.result,
        onMoveShouldSetPanResponder: () => !live.current.result,
        onPanResponderGrant: (e) => {
          const { pageX, pageY } = e.nativeEvent;
          const start = cellAt(pageX, pageY);
          gs.current = { start, x0: pageX, y0: pageY, dragging: false, hover: -1, long: false };
          // touch-down feedback: the touched piece / stall squashes under the finger (UI thread, no render)
          pressAt.value = start;
          const cs = live.current.s.cells[start] ?? "";
          const gm = /(^|\|)g(\d+)$/.exec(cs);
          ghostCost.value = gm && isGen(cs) ? def.gens[Number(gm[2])].cost ?? 1 : isCrate(cs) ? 1 : 0;
          refreshOrigin();
          // hold still ~0.4 s on a piece or stall = merge preview (what it makes, how many twins are on the board)
          clearLp();
          const c0 = live.current.s.cells[start];
          // (never in QA replay: a slow host can hold a replayed swipe past the threshold)
          if (start >= 0 && c0 && (isFreeItem(c0) || isGen(c0)) && !live.current.armed && qa.level == null) {
            lpTimer.current = setTimeout(() => {
              const g = gs.current;
              if (g.dragging || g.start !== start) return;
              g.long = true;
              handlers.current.longPress(start);
            }, 420);
          }
        },
        onPanResponderMove: (e) => {
          const g = gs.current;
          const { pageX, pageY } = e.nativeEvent;
          const { s: st, armed: a, cell: c } = live.current;
          if (!g.dragging) {
            if (g.start < 0 || a || Math.hypot(pageX - g.x0, pageY - g.y0) < 9 || !isFreeItem(st.cells[g.start])) return;
            g.dragging = true;
            clearLp();
            handlers.current.startDrag(g.start);
          }
          // the lifted piece leans into the direction it is dragged
          if (g.hover !== -1 || Math.abs(pageX - c * 0.5 - ghostX.value) < c) {
            ghostTilt.value = withSequence(withTiming(Math.max(-14, Math.min(14, (pageX - c * 0.5 - ghostX.value) * 1.2)), { duration: 60 }), withSpring(0, springs.gentle));
          }
          // one tile big (×1.08 lift), held just above the fingertip so the finger never hides it
          ghostX.value = pageX - c * 0.5;
          ghostY.value = pageY - c * 0.82;
          const hv = cellAt(pageX, pageY);
          if (hv !== g.hover) {
            g.hover = hv;
            handlers.current.hoverAt(hv);
          }
        },
        onPanResponderRelease: (e) => {
          const g = gs.current;
          const { pageX, pageY } = e.nativeEvent;
          pressAt.value = -1;
          ghostCost.value = 0;
          clearLp();
          const dragging = g.dragging;
          gs.current.dragging = false;
          if (dragging) {
            // the drop cell is resolved against the board's position NOW (measured fresh), so a board that moved
            // since the finger landed (layout, a shake) can never turn a drop on a drawn cell into a miss
            const r = gridRef.current;
            if (!r) return handlers.current.dropAt(g.start, pageX, pageY);
            r.measureInWindow((x: number, y: number, w: number) => {
              if (w) origin.current = { x, y };
              handlers.current.dropAt(g.start, pageX, pageY);
            });
          }
          // a long-press only previews: it never spends a Spark or moves anything
          else if (g.start >= 0 && !g.long) handlers.current.tapCell(g.start);
        },
        onPanResponderTerminate: () => {
          pressAt.value = -1;
          ghostCost.value = 0;
          clearLp();
          if (gs.current.dragging) {
            setDrag(null);
            setHover(null);
          }
          gs.current.dragging = false;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ───────── derived view state ───────── */
  const targets = useMemo(() => {
    const t = new Set<number>();
    const from = drag?.from ?? sel;
    if (from === null || from === undefined || !isFreeItem(s.cells[from])) return t;
    s.cells.forEach((_, i) => {
      const kd = dropKind(def, s, from, i);
      if (kd && kd !== "move") t.add(i);
    });
    return t;
  }, [s, sel, drag, def]);
  const hintCells = useMemo(() => {
    const h = new Set<number>();
    if (!hint) return h;
    if (hint.k === "tap" || hint.k === "boost") h.add(hint.at);
    if (hint.k === "drop") { h.add(hint.from); h.add(hint.to); }
    if (hint.k === "deliver") h.add(hint.from);
    return h;
  }, [hint]);
  const preview = drag && hover !== null && hover >= 0 && hover !== drag.from ? dropPreview(def, s, drag.from, hover) : null;
  // the bar's full mark is the most Sparks this attempt has held (a +3 refill can top the level's budget), so the
  // fill never overflows and the label is just the count — never "3/1"
  const sparkPeak = useRef(def.sparks);
  sparkPeak.current = Math.max(sparkPeak.current, s.sparks);
  const sparksPct = Math.max(0, Math.min(1, s.sparks / Math.max(1, sparkPeak.current)));
  const clearGoals = (def.clear ?? []).map((g) => {
    const test = g === "thread" ? isThread : g === "jar" ? isJar : g === "trunk" ? hasTrunk : isCrate;
    const left = s.cells.filter(test).length;
    return { g, left, total: startState(def, 0).cells.filter(test).length };
  });
  const scene = SCENE_OF[def.chapter];
  const nCards = def.orders.length + clearGoals.length;
  const card = Math.min(64, Math.floor((width - 24 - 28 - (nCards - 1) * 6) / nCards));
  const selCode = sel !== null ? s.cells[sel] : null;

  /* ───────── tutorial hand + QA replay (both point at the solver's next real touch) ───────── */
  const showHand = !result && !story && !demo && !daily && qa.level == null && (def.id <= 2 || (!!def.hint && settings.hints && !(store.get().stars ?? {})[def.id]));
  async function touchFor(m: Move): Promise<QaTouch | null> {
    refreshOrigin();
    const g = await measure(gridRef);
    if (g) origin.current = { x: g.x, y: g.y };
    if (m.k === "tap") return cellCentre(m.at);
    if (m.k === "drop") {
      const a = cellCentre(m.from), b = cellCentre(m.to);
      return { x: a.x, y: a.y, x2: b.x, y2: b.y };
    }
    if (m.k === "deliver") {
      const o = orderFor(def, s, s.cells[m.from]);
      const card = await measure({ current: cardRefs.current[o] });
      if (!card) return null;
      const a = cellCentre(m.from), b = centre(card);
      return { x: a.x, y: a.y, x2: b.x, y2: b.y };
    }
    if (m.k === "boost") {
      if (armed !== m.b) {
        const r = await measure({ current: boostRefs.current[m.b] ?? null });
        return r ? centre(r) : null;
      }
      return cellCentre(m.at);
    }
    if (m.k === "unbag") {
      const r = await measure(bagOpen ? slotRef : bagRef);
      return r ? centre(r) : null;
    }
    return null;
  }
  useEffect(() => {
    if (!ready || result || story) return;
    const isQa = qa.level === def.id;
    if (!isQa && !showHand) {
      setHandAt(null);
      return;
    }
    // a solved board reports "done" to QA replay at once, before any win staging / result card can cancel the timer
    // below (the fast win card used to open first and the final report never came)
    if (status(def, s) === "won") {
      if (isQa) reportNext(def.id, null);
      setHandAt(null);
      return;
    }
    let dead = false;
    // a move just landed: the old prompt (and its lit tiles) go at once — never a hand pointing at a tile that just
    // emptied — and the next one waits until the move's burst has played (QA replay keeps its quick report)
    if (showHand) setHandAt(null);
    const id = setTimeout(async () => {
      if (status(def, s) === "won") {
        if (isQa) reportNext(def.id, null);
        setHandAt(null);
        return;
      }
      // the stored proof is only trusted while its move is legal here (a re-tuned level can outdate it)
      let m = nextMove(def, s, sol);
      if (m && !legal(def, s, m)) m = nextMove(def, s);
      let t = m ? await touchFor(m) : null;
      for (let tries = 0; m && !t && tries < 3 && !dead; tries++) {
        // a target that can't be measured yet (mid-layout) is retried, never reported as "nothing left to do"
        await new Promise((r) => setTimeout(r, 250));
        t = await touchFor(m);
      }
      if (dead) return;
      if (isQa && (t || !m)) reportNext(def.id, t);
      const carried = m && (m.k === "drop" || m.k === "deliver") ? s.cells[m.from] : undefined;
      if (showHand) setHandAt(t ? { from: { x: t.x, y: t.y }, to: t.x2 !== undefined ? { x: t.x2, y: t.y2! } : undefined, piece: carried, point: m?.k === "deliver" } : null);
    }, isQa ? 450 : 1000);
    return () => {
      dead = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, s, armed, bagOpen, result, story]);

  /** The tiles the tutorial hand points at light up themselves (their own pulsing ring, inside the tile) — the board is
   *  never dimmed around them (QA 2026-10-29: the shaded stall read as a faded, ghosted layer). */
  const handCells = useMemo(() => {
    const set = new Set<number>();
    if (!handAt || drag || result || story) return set;
    for (const p of [handAt.from, handAt.to]) {
      if (!p) continue;
      const i = cellAt(p.x, p.y);
      if (i >= 0) set.add(i);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handAt, drag, result, story]);

  /** Idle nudge: 3 s without a touch → the hand presses harder and the coach line bounces; on early levels with no
   *  hand, the next solver move lights up by itself (free, never in QA replay). */
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    if (result || story || demo || qa.level != null) return;
    const id = setTimeout(() => setIdle(true), 2200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, sel, drag, result, story, peek]);
  useEffect(() => {
    if (!idle || showHand || hint || daily || def.id > 6 || !settings.hints) return;
    const id = setTimeout(() => {
      let m = nextMove(def, s, sol);
      if (m && !legal(def, s, m)) m = nextMove(def, s);
      if (m && m.k !== "unbag") setHint(m);
    }, 2000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle]);

  /* ───────── coach line ───────── */
  const toastLive = useRef(0);
  useEffect(() => {
    if (!toast) return;
    toastLive.current = toast.k;
    const id = setTimeout(() => toastLive.current === toast.k && setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  let coach = def.hint && settings.hints && def.id <= 60 ? def.hint : objectiveText(def);
  const ftue = !daily && def.id === 1 ? ftueStep(def, s) : null;
  if (ftue) coach = ftue;
  if (selCode && isFreeItem(selCode)) {
    const canDeliver = orderFor(def, s, selCode) >= 0;
    coach = `${itemName(selCode)}${isChainItem(selCode) ? ` · tier ${tierOf(selCode)}` : " · crafted"} — ${canDeliver ? "an order wants it: tap its card!" : targets.size ? (s.cells.filter((c) => c === selCode).length > 1 ? "drag it onto its twin to merge!" : "drag it onto a glowing tile.") : "find or make its twin to merge."}`;
  }
  if (armed) coach = armed === "needle" ? "Needle ready — tap a tile wrapped in thread." : armed === "sweep" ? "Sweep ready — tap any tile in the row to sweep." : "Fireworks ready — tap the tile at the centre of the burst.";
  if (toast) coach = toast.text;
  if (peek) coach = peekLine(peek);
  // once the board is solved the instructions are over: a celebratory line, never a stale "tap the shelf"
  const solved = status(def, s) === "won";
  if (solved) coach = def.orders.length > 1 ? "Every order filled — the bazaar glows!" : "Order filled — Dadi's doorstep glows!";
  const overlay = !!result || !!story; // a result / story card is open: the coach line and the hand step aside
  const coachFade = useSharedValue(1);
  useEffect(() => {
    coachFade.value = withTiming(overlay ? 0 : 1, { duration: overlay ? 400 : 260 });
  }, [overlay, coachFade]);
  const coachSt = useAnimatedStyle(() => ({ opacity: coachFade.value }));
  const toolsFade = useSharedValue(1);
  useEffect(() => {
    // a gentle fade behind the result card (never an abrupt dim); the slots themselves never change
    toolsFade.value = withTiming(result ? 0 : 1, { duration: result ? 650 : 300, easing: Easing.inOut(Easing.quad) });
  }, [result, toolsFade]);
  const toolsSt = useAnimatedStyle(() => ({ opacity: toolsFade.value }));

  /* ───────── one-time Sparks explainer under the Sparks bar ───────── */
  function closeSparkTip() {
    setSparkTip(false);
    store.set({ tips: { ...(store.get().tips ?? {}), sparks: true } });
  }
  useEffect(() => {
    if (!sparkTip || story || result) return;
    const id = setTimeout(closeSparkTip, 6500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparkTip, story, result]);

  /* Android Back: steps out of an armed booster / open Bag / preview first, then leaves the board for Home
     (exactly like the Home button) — it never closes the app from inside a level. Popups handle Back themselves. */
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (armed) return setArmed(null), true;
    if (bagOpen) return setBagOpen(false), true;
    if (peek) return setPeek(null), true;
    if (refillOpen) return setRefillOpen(false), true;
    if (buyAsk) return setBuyAsk(null), true;
    if (result === "win") return true;
    settleBoosters(s);
    analytics.track("level_quit", { level: def.id });
    onExit();
    return true;
  };
  useEffect(() => {
    if (Platform.OS !== "android" || demo) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => backRef.current());
    return () => sub.remove();
  }, [demo]);

  const inTray = (b: Booster) => tray.includes(b);
  const tb = width < 400 && tray.length ? 42 : 46;
  const tools: { key: string; node: React.ReactNode }[] = [
    { key: "undo", node: <RoundButton glyph="undo" label="Undo" size={tb} onPress={undo} disabled={!hist.length} /> },
    { key: "sort", node: <RoundButton glyph="sort" label="Sort" size={tb} onPress={sort} /> },
    {
      key: "bag",
      node: (
        <View ref={bagRef} collapsable={false}>
          <RoundButton glyph="bag" label="Bag" size={tb} badge={s.bag.length || undefined} active={sel !== null} onPress={bagAction} />
        </View>
      ),
    },
    { key: "help", node: <RoundButton glyph="help" label="Stuck?" size={tb} onPress={helper} dot={helperUses === 0} /> },
    ...BOOSTERS.filter(inTray).map((b) => ({
      key: b,
      node: (
        <View ref={(r) => { boostRefs.current[b] = r; }} collapsable={false}>
          <RoundButton piece={`boost_${b}`} label={BOOSTER_INFO[b].name} size={tb} badge={s.boosters[BOOSTERS.indexOf(b)] || "+"} active={armed === b} onPress={() => useBooster(b)} />
        </View>
      ),
    })),
  ];
  if (settings.leftHanded) tools.reverse();

  return (
    <View style={styles.root}>
      <Background scene={scene.scene} tint={scene.tint} dim={0.25} />

      {/* HUD: home · level badge · Sparks bar · settings */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]}>
        <RoundButton glyph="home" size={42} onPress={() => { settleBoosters(s); analytics.track("level_quit", { level: def.id }); onExit(); }} />
        <LinearGradient colors={["#3E43A0", "#23266A"]} style={styles.hudPlate}>
          <View style={styles.levelBadge}>
            <LinearGradient colors={["#F7B23A", "#C2560A"]} style={styles.levelFace}>
              {daily ? <Image source={pieces.cur_lamp} style={{ width: 34, height: 34 }} /> : <Text style={styles.levelNum} numberOfLines={1} adjustsFontSizeToFit>{def.id}</Text>}
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.levelTitle} numberOfLines={1}>{daily ? `Bazaar Day · ${def.title}` : def.title}</Text>
            <View ref={sparkRef} collapsable={false}>
            <Tappable onPress={() => (result ? undefined : setRefillOpen(true))} scaleTo={0.95} accessibilityLabel="Sparks: get more">
              <SparkBar sparks={s.sparks} max={sparkPeak.current} pct={sparksPct} reduce={reduce} ghost={ghostCost} deny={deny} />
            </Tappable>
            </View>
          </View>
        </LinearGradient>
        <RoundButton glyph="gear" size={42} onPress={onSettings} />
      </View>

      {/* Order tray (parchment) */}
      <View ref={trayRef} collapsable={false} style={styles.trayWrap}>
        <NineSlice name="hud_panel" inset={29} tileEdges style={styles.tray}>
          {def.orders.map((o, i) => {
            const active = orderActive(def, s, i);
            const done = s.need[i] === 0;
            const ready = active && s.cells.some((c) => c === o.item);
            return (
              <OrderCard
                key={i}
                size={card}
                refFn={(r) => { cardRefs.current[i] = r; }}
                piece={o.item}
                got={o.n - s.need[i]}
                n={o.n}
                done={done}
                locked={!active && !done}
                ready={ready || (hint?.k === "deliver" && s.cells[hint.from] === o.item)}
                reward={o.reward}
                glowSel={!!selCode && selCode === o.item && active}
                onPress={() => deliverTo(i)}
              />
            );
          })}
          {clearGoals.map((g) => (
            <GoalCard key={g.g} size={card} kind={g.g} left={g.left} total={g.total} />
          ))}
        </NineSlice>
      </View>

      {/* Coach line: Dadi + the current tip / selection / toast */}
      <Animated.View
        style={[styles.coachRow, coachSt]}
        pointerEvents={overlay ? "none" : "auto"}
        onLayout={(e) => {
          const l = e.nativeEvent.layout;
          setCoachBox({ x: l.x, y: l.y, w: l.width, h: l.height });
        }}
      >
        <View style={styles.coachDadi}>
          <Image source={pieces.L2} style={{ width: 30, height: 30 }} />
        </View>
        <CoachBubble text={coach} reduce={reduce} solved={solved} nudge={idle && !solved} />
        {selCode && !armed && !solved ? (
          <Tappable onPress={() => sel !== null && sell(sel)} style={styles.chipBtn} sound="tap" accessibilityLabel="Sell">
            <Image source={require("../../assets/art/ui/sell.png")} style={{ width: 22, height: 22 }} />
            <Text style={styles.chipText}>Sell</Text>
          </Tappable>
        ) : null}
      </Animated.View>

      {/* Board */}
      <View style={styles.boardArea} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {cell ? (
          <Animated.View style={boardPulseSt}>
          <Animated.View style={shakeStyle}>
            <NineSlice name="board_frame" inset={frameK} tileEdges style={{ padding: pad }}>
              <View style={styles.cellField}>
                <View ref={gridRef} collapsable={false} {...responder.panHandlers} onLayout={() => setTimeout(refreshOrigin, 500)}>
                  {Array.from({ length: bh }, (_, r) => (
                    <View key={r} style={styles.row}>
                      {Array.from({ length: bw }, (_, c) => {
                        const i = r * bw + c;
                        const x = s.cells[i];
                        const g = /(^|\|)g(\d+)$/.exec(x);
                        const gi = g ? Number(g[2]) : -1;
                        return (
                          <Cell
                            key={i}
                            index={i}
                            pressAt={pressAt}
                            cell={x}
                            size={cell}
                            alt={(r + c) % 2 === 1}
                            selected={sel === i && !drag}
                            target={targets.has(i)}
                            hint={hintCells.has(i) || handCells.has(i)}
                            dragging={drag?.from === i}
                            hover={!!drag && hover === i && targets.has(i)}
                            poke={pokes[i]}
                            wave={wave ? waveDelay(i) : undefined}
                            gen={gi >= 0 ? def.gens[gi].kind : undefined}
                            next={gi >= 0 ? nextProduct(def, s, gi) : undefined}
                            cost={gi >= 0 ? def.gens[gi].cost ?? 1 : undefined}
                            spawn={spawn[i]}
                            reduceMotion={reduce}
                            fast={fast}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
                {!reduce && qa.level == null ? <BoardSheen w={bw * cell} h={bh * cell} /> : null}
              </View>
            </NineSlice>
          </Animated.View>
          </Animated.View>
        ) : null}
        {bagOpen && s.bag.length ? (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} style={styles.bagTray}>
            <NineSlice name="hud_panel" inset={26} tileEdges style={styles.bagInner}>
              <Text style={styles.bagTitle}>Bag {s.bag.length}/{BAG_MAX} · tap to take out</Text>
              <View style={styles.bagRow}>
                {s.bag.map((b, slot) => (
                  <View key={slot} ref={slot === 0 ? slotRef : undefined} collapsable={false}>
                    <Tappable
                      onPress={() => {
                        if (!tryMove({ k: "unbag", slot })) say("No free tile on the board.");
                        else setBagOpen(false);
                      }}
                      style={styles.bagSlot}
                      sound={null}
                      accessibilityLabel={`Take out ${itemName(b)}`}
                    >
                      <Image source={pieces[b]} style={{ width: 40, height: 40 }} />
                    </Tappable>
                  </View>
                ))}
              </View>
            </NineSlice>
          </Animated.View>
        ) : null}
      </View>

      {/* Tool bar: the same slots for the whole attempt; it fades out (never changes) while a result card is up */}
      <Animated.View style={[styles.tools, { paddingBottom: Math.max(insets.bottom, 8) + bannerH + 6 }, toolsSt]} pointerEvents={result ? "none" : "auto"}>
        <LinearGradient colors={["rgba(60,30,10,0)", "rgba(60,30,10,0.85)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {tools.map((t) => (
          <View key={t.key}>{t.node}</View>
        ))}
      </Animated.View>

      {/* one-time Sparks explainer, pointing at the Sparks bar */}
      {sparkTip && !story && !result ? (
        <Animated.View entering={FadeInDown.delay(500).duration(260)} exiting={FadeOut.duration(160)} style={[styles.sparkTip, { top: insets.top + 64 }]}>
          <Tappable onPress={closeSparkTip} accessibilityLabel="Got it" style={styles.sparkTipInner} scaleTo={0.96}>
            <View style={styles.sparkTipArrow} />
            <Image source={pieces.cur_spark} style={{ width: 24, height: 24 }} />
            <Text style={styles.sparkTipText}>Sparks pay for stall taps — each tap costs the number on the stall. Tap the bar for more.</Text>
          </Tappable>
        </Animated.View>
      ) : null}
      {/* overlays: drag ghost + preview, fx */}
      {drag ? (
        <Animated.View pointerEvents="none" style={[styles.ghost, { width: cell, height: cell }, ghostStyle]}>
          {/* a lifted piece reads as its own object over whatever tile it crosses: deep contact shadow + a cream
              plate with a marigold rim behind it (never blended with the stall or piece under it) */}
          <View style={[styles.ghostShadow, { width: cell * 0.7, height: cell * 0.2, borderRadius: cell, left: cell * 0.15, top: cell * 0.98 }]} />
          <View style={[styles.ghostPlate, { width: cell * 0.94, height: cell * 0.94, borderRadius: cell, left: cell * 0.03, top: cell * 0.03 }]} />
          <CellArt cell={drag.piece} size={cell} />
        </Animated.View>
      ) : null}
      {preview && preview.kind && preview.kind !== "move" && hover !== null ? (
        <PreviewBubble at={cellCentre(hover)} cell={cell} preview={preview} />
      ) : null}
      {peek && !drag && !overlay ? <PeekCard key={peek.at} peek={peek} top={coachBox ? coachBox.y - 6 : insets.top + 130} /> : null}
      {puffs.map((b) => (
        <Burst key={b.k} kind="puff" x={b.x} y={b.y} size={cell} reduce={reduce} />
      ))}
      {bursts.map((b) => (
        <Burst key={b.k} x={b.x} y={b.y} size={cell} big={b.big} reduce={reduce} fast={fast} />
      ))}
      {flyers.map((f) => (
        <Flyer key={f.k} piece={f.piece} from={f.from} to={f.to} size={f.size ?? cell * 0.9} duration={f.duration} arc={f.arc} endScale={f.endScale} trail={f.trail} onDone={() => setFlyers((x) => x.filter((y) => y.k !== f.k))} />
      ))}
      {floaters.map((f) => (
        <FloatingText key={f.k} text={f.text} x={f.x} y={f.y} color={f.combo ? "#FFB347" : "#FFE08A"} duration={f.combo ? 1400 : 1550} />
      ))}
      {handAt && !drag && !overlay ? <TutorialHand key={`${handAt.from.x}-${handAt.from.y}-${handAt.to?.x ?? 0}`} from={handAt.from} to={handAt.to} cell={cell} emphasis={idle} point={handAt.point} /> : null}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti trigger={reduce ? 0 : celebrate} count={60} origin={cell ? { x: origin.current.x + (bw * cell) / 2, y: origin.current.y + (bh * cell) * 0.6 } : undefined} />
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti trigger={reduce ? 0 : shell.n} count={36} origin={{ x: shell.x, y: shell.y }} />
      </View>
      {cell ? (
        <WinStage trigger={celebrate} on={wave && !result} at={{ x: origin.current.x + (bw * cell) / 2, y: origin.current.y + (bh * cell) / 2 }} size={cell} reduce={reduce} />
      ) : null}
      {winSparks.map((b) => (
        <Burst key={b.k} x={b.x} y={b.y} size={cell * 0.8} reduce={reduce} fast={fast} />
      ))}
      {celebrate > 0 && !result ? <FloatingText key={`w${celebrate}`} text="The bazaar glows!" x={origin.current.x + (bw * cell) / 2} y={origin.current.y + Math.max(cell * 0.45, (bh * cell) / 2 - cell * 1.35)} duration={1300} /> : null}

      <StoryScene
        beat={story}
        scene={scene.scene}
        tint={scene.tint}
        reduce={reduce}
        onDone={(skipped) => {
          if (story) markSeen(story.id, skipped);
          setStory(null);
          // the page has lifted off the board: the stalls pulse, "this is where you start"
          setTimeout(() => s.cells.forEach((c, i) => isGen(c) && poke(i, "bump")), 120);
        }}
      />
      <WinPopup
        visible={result === "win"}
        stars={winInfo?.stars ?? 1}
        coins={winInfo?.lamps ?? 0}
        reduceMotion={reduce}
        placement="bottom"
        dim={0.34}
        title={daily ? "Bazaar Day won!" : def.id === LEVELS.length ? "Festival of Lights!" : "Level Complete!"}
        subtitle={def.title}
        nextLabel={daily ? "Back to Home" : def.id >= LEVELS.length ? "Back home" : `Next · Level ${def.id + 1}`}
        extra={daily ? <Text style={styles.teaser}>A new Bazaar Day board opens tomorrow.</Text> : <WinExtra info={winInfo} level={def.id} />}
        onReplay={daily ? undefined : restart}
        onNext={() => {
          if (daily || def.id >= LEVELS.length) return onExit();
          if (def.id >= 10) ads.showInterstitial(); // natural break; never before level 10 (store promise)
          onNextLevel(def.id + 1);
        }}
        onMap={daily ? undefined : onExit}
      />
      <FailPopup
        visible={result === "fail"}
        message={failInfo.message}
        title={failInfo.title}
        gift={failInfo.gift}
        onUndo={hist.length ? undo : undefined}
        onRetry={restart}
        onContinue={qa.level == null && failInfo.sparks && !refillUsed ? refill : undefined}
        onMap={() => {
          settleBoosters(s);
          onExit();
        }}
      />
      <Popup visible={confirmSell !== null} title="Sell this piece?" onClose={() => setConfirmSell(null)}>
        {confirmSell !== null && isFreeItem(s.cells[confirmSell]) ? (
          <>
            <Image source={pieces[s.cells[confirmSell]]} style={styles.popArt} />
            <Text style={styles.popText}>{itemName(s.cells[confirmSell])} is a rare piece. Sell it for {sellValue(s.cells[confirmSell])} Lamps? Undo can bring it back.</Text>
            <GameButton label="Keep it" variant="primary" onPress={() => setConfirmSell(null)} />
            <GameButton style={{ marginTop: 10 }} size="sm" variant="light" label="Sell" onPress={() => sell(confirmSell, true)} />
          </>
        ) : null}
      </Popup>
      <Popup visible={refillOpen} title="More Sparks" onClose={() => setRefillOpen(false)}>
        <Image source={pieces.cur_spark} style={styles.popArt} />
        <Text style={styles.popText}>
          You have {s.sparks} Spark{s.sparks === 1 ? "" : "s"}. Sparks pay for stall and crate taps — the number on a stall is its cost.
        </Text>
        {refillUsed ? (
          <Text style={styles.popNote}>This board's refill is used. Retry starts it again with all {def.sparks} Sparks.</Text>
        ) : (
          <GameButton label="+3 Sparks (watch ad)" variant="accent" size="sm" onPress={refill} />
        )}
        <GameButton style={{ marginTop: 10 }} size="sm" variant="light" label="No thanks" onPress={() => setRefillOpen(false)} />
      </Popup>
      <Popup visible={buyAsk !== null} title={buyAsk ? BOOSTER_INFO[buyAsk].name : ""} onClose={() => setBuyAsk(null)}>
        {buyAsk ? (
          <>
            <Image source={pieces[`boost_${buyAsk}`]} style={styles.popArt} />
            <Text style={styles.popText}>{BOOSTER_INFO[buyAsk].what}</Text>
            <GameButton
              label={`Buy for ${BOOSTER_INFO[buyAsk].price} Lamps`}
              variant="primary"
              disabled={store.get().coins < BOOSTER_INFO[buyAsk].price}
              onPress={() => {
                const b = buyAsk;
                if (buyBooster(b)) {
                  const i = BOOSTERS.indexOf(b);
                  invAtStart.current = { ...invAtStart.current, [b]: invAtStart.current[b] + 1 };
                  setS((x) => ({ ...x, boosters: x.boosters.map((n, j) => (j === i ? n + 1 : n)) }));
                  play("coin");
                  say(`${BOOSTER_INFO[b].name} added — tap it to use.`);
                }
                setBuyAsk(null);
              }}
            />
            <Text style={styles.popNote}>You have {store.get().coins} Lamps. Boosters are also in the daily gift.</Text>
          </>
        ) : null}
      </Popup>
    </View>
  );
}

const decode = (x: string): Move => decodeMove(x);

/**
 * Level 1's coach line follows the FTUE step the board is at (tap → peek → merge → deliver), never a stale
 * instruction. The scripted peek step (press and hold a piece to preview its merge) shows until the player has
 * held one once; it never blocks the drag.
 */
function ftueStep(def: LevelDef, s: State): string | null {
  if (s.need.every((n) => n === 0)) return null;
  const want = def.orders[0]?.item;
  if (want && s.cells.includes(want)) return `A ${itemName(want)}! Drag it up to the glowing order card.`;
  const base = want && isChainItem(want) ? `${want[0]}${tierOf(want) - 1}` : "";
  if (base && s.cells.filter((c) => c === base).length >= 2)
    return `Two ${itemName(base)}s! Drag one onto the other to merge them.`;
  return `Tap the Lamp Shelf: each tap spends 1 Spark and makes a ${base ? itemName(base) : "piece"}.`;
}

function objectiveText(def: LevelDef) {
  const n = def.orders.length;
  const clear = def.clear?.length ? ` and clear every ${def.clear.map((c) => (c === "thread" ? "knot" : c)).join(" & ")}` : "";
  return `Fill ${n === 1 ? "the order" : n === 2 ? "both orders" : `all ${n} orders`}${clear}. Drag twins together to merge.`;
}

/** The coach line for a long-press preview. */
function peekLine(p: Peek): string {
  const n = itemName(p.piece);
  switch (p.kind) {
    case "gen": return `Next tap makes a ${n} · costs ${p.cost} Spark${p.cost === 1 ? "" : "s"}.`;
    case "big": return `Big Merge! ${p.count} alike make a ${itemName(p.result!)}${p.bonus ? ` + a free ${itemName(p.bonus)}` : ""}.`;
    case "merge": return `2 ${n}s merge into a ${itemName(p.result!)}. Drag one onto its twin.`;
    case "recipe": return `Recipe: ${n} + its partner make ${itemName(p.result!)}.`;
    case "key": return `This key opens the trunk: ${itemName(p.result!)} inside.`;
    case "none": return `Only 1 ${n} here — a twin would make a ${itemName(p.result!)}.`;
    default: return `${n} is top tier — deliver it or sell it for Lamps.`;
  }
}

/** Coach speech bubble: a stable view; a new line nudges in (opacity 0.55 → 1, a 6 dp rise) — never remounted, never from 0. */
function CoachBubble({ text, reduce, solved, nudge }: { text: string; reduce: boolean; solved: boolean; nudge?: boolean }) {
  const o = useSharedValue(1);
  const y = useSharedValue(0);
  const n = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    o.value = 0.55;
    o.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    y.value = 6;
    y.value = withSpring(0, springs.press);
  }, [text, reduce, o, y]);
  // idle nudge: a little hop and a warm rim every few seconds until the player acts (transform + border only)
  useEffect(() => {
    n.value = nudge && !reduce
      ? withRepeat(withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, springs.pop), withDelay(2200, withTiming(0, { duration: 0 }))), -1, false)
      : withTiming(0, { duration: 120 });
  }, [nudge, reduce, n]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value - n.value * 5 }, { scale: 1 + n.value * 0.03 }] }));
  const rim = useAnimatedStyle(() => ({ opacity: n.value }));
  return (
    <Animated.View style={[styles.coach, solved && styles.coachWin, st]}>
      <Animated.View pointerEvents="none" style={[styles.coachRim, rim]} />
      <Text style={styles.coachText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Long-press merge preview card. It sits over the coach row, between the order tray and the board, so it never
 * hides a board cell (the held piece's twins stay visible and glow). It shows the piece with its count on the board →
 * what it becomes (+ the Big Merge bonus), and one plain line. It pops in by scale from 0.9 and is fully opaque from
 * its first frame.
 */
function PeekCard({ peek, top }: { peek: Peek; top: number }) {
  const sc = useSharedValue(0.9);
  useEffect(() => {
    sc.value = withSpring(1, springs.pop);
  }, [sc]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const title = peek.kind === "gen" ? "Next from this stall" : peek.kind === "big" ? "Big Merge preview" : peek.kind === "recipe" ? "Recipe preview" : "Merge preview";
  const merges = peek.kind !== "gen" && peek.kind !== "top";
  const n = peek.kind === "gen" ? 1 : peek.kind === "big" ? peek.count : peek.kind === "none" || peek.kind === "top" ? peek.twins : 2;
  return (
    <Animated.View pointerEvents="none" style={[styles.peek, { top }, st]}>
      <View style={styles.peekRow}>
        <View style={styles.peekSlot}>
          <Image source={pieces[peek.piece]} style={{ width: 42, height: 42 }} />
          <View style={styles.peekCount}>
            <Text style={styles.peekCountText}>×{n}</Text>
          </View>
        </View>
        {merges && peek.result ? (
          <>
            <Text style={styles.peekArrow}>→</Text>
            <View style={[styles.peekSlot, styles.peekResult, peek.kind === "none" && { opacity: 0.45 }]}>
              {pieces[peek.result] ? <Image source={pieces[peek.result]} style={{ width: 46, height: 46 }} /> : null}
            </View>
          </>
        ) : null}
        {peek.bonus ? (
          <>
            <Text style={styles.peekArrow}>+</Text>
            <View style={styles.peekSlot}>{pieces[peek.bonus] ? <Image source={pieces[peek.bonus]} style={{ width: 38, height: 38 }} /> : null}</View>
          </>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.peekTitle}>{title}</Text>
        <Text style={styles.peekSub} numberOfLines={3}>{peekLine(peek)}</Text>
      </View>
    </Animated.View>
  );
}

/** Sparks meter: the fill glides to the new value, the spark icon punches on every change, and it glows red when low. */
function SparkBar({ sparks, max, pct, reduce, ghost, deny }: { sparks: number; max: number; pct: number; reduce: boolean; ghost: SharedValue<number>; deny: number }) {
  // "can't pay": the bar shakes, flashes red and the "+" (more Sparks) pulses three times
  const nope = useSharedValue(0);
  const red = useSharedValue(0);
  const plus = useSharedValue(1);
  useEffect(() => {
    if (!deny) return;
    red.value = withSequence(withTiming(1, { duration: 80 }), withDelay(380, withTiming(0, { duration: 420 })));
    plus.value = withSequence(...[0, 1, 2].flatMap(() => [withTiming(1.45, { duration: 150 }), withTiming(1, { duration: 170 })]));
    if (!reduce) nope.value = withSequence(withTiming(-7, { duration: 45 }), withTiming(7, { duration: 60 }), withTiming(-5, { duration: 55 }), withTiming(4, { duration: 50 }), withTiming(0, { duration: 45 }));
  }, [deny, reduce, nope, red, plus]);
  const nopeSt = useAnimatedStyle(() => ({ transform: [{ translateX: nope.value }] }));
  const redSt = useAnimatedStyle(() => ({ opacity: red.value }));
  const plusSt = useAnimatedStyle(() => ({ transform: [{ scale: plus.value }] }));
  const w = useSharedValue(pct);
  const punch = useSharedValue(1);
  const low = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    w.value = reduce ? pct : withTiming(pct, { duration: 380 });
    if (first.current) {
      first.current = false;
      return;
    }
    if (!reduce) punch.value = withSequence(withTiming(1.3, { duration: 90 }), withSpring(1, springs.pop));
  }, [sparks, pct, reduce, w, punch]);
  const isLow = sparks <= Math.max(2, Math.round(max * 0.15));
  useEffect(() => {
    low.value = isLow && !reduce ? withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.2, { duration: 500 })), -1) : withTiming(isLow ? 0.6 : 0, { duration: 200 });
  }, [isLow, reduce, low]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(4, w.value * 100)}%` }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: punch.value }] }));
  const warn = useAnimatedStyle(() => ({ opacity: low.value }));
  // the cost of the stall under the finger, shown as the red tail of the fill that the tap will burn
  const ghostSt = useAnimatedStyle(() => {
    const g = Math.min(w.value, ghost.value / Math.max(1, max));
    return { opacity: g > 0 ? 1 : 0, left: `${(w.value - g) * 100}%`, width: `${g * 100}%` };
  });
  return (
    <Animated.View style={[styles.sparkTrack, nopeSt]}>
      <Animated.View style={[styles.sparkFill, fill]}>
        <LinearGradient colors={["#FFE07A", "#F6A81C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sparkGhost, ghostSt]} />
      <Animated.View pointerEvents="none" style={[styles.sparkWarn, warn]} />
      <Animated.View pointerEvents="none" style={[styles.sparkDeny, redSt]} />
      <Text style={styles.sparkText}>{sparks} Spark{sparks === 1 ? "" : "s"}</Text>
      <Animated.Image source={pieces.cur_spark} style={[styles.sparkIcon, icon]} />
      <Animated.View style={[styles.sparkPlus, plusSt]}>
        <Text style={styles.sparkPlusText}>+</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** The delivered piece's flight to its order card (ms): the card ticks, punches and fills the moment it lands. */
const LAND_MS = 600;
/** The order card's count pill hangs this far below the card face. */
const PILL_DROP = 12;
const FLARE = require("../../assets/art/fx_sparkle_glow.png");

function OrderCard({ size, piece, got, n, done, locked, ready, reward, glowSel, onPress, refFn }: {
  size: number; piece: string; got: number; n: number; done: boolean; locked: boolean; ready: boolean; reward?: string; glowSel: boolean; onPress: () => void; refFn: (r: ViewRef | null) => void;
}) {
  // a crafted order shows its recipe on the card (spool + dye = Dupatta), so the player sees where each input goes
  const recipe = recipeInputs(piece);
  const p = useSharedValue(0);
  const punch = useSharedValue(1);
  useEffect(() => {
    p.value = ready || glowSel ? withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.3, { duration: 600 })), -1) : withTiming(0, { duration: 200 });
  }, [ready, glowSel, p]);
  const fill = useSharedValue(n ? got / n : 0);
  useEffect(() => {
    // the delivered piece lands ~0.4 s after the drop: the card punches and its progress bar fills then
    if (got > 0) punch.value = withDelay(LAND_MS, withSequence(withTiming(1.3, { duration: 120 }), withTiming(1.24, { duration: 120 }), withSpring(1, springs.pop)));
    fill.value = withDelay(got > 0 ? LAND_MS : 0, withTiming(n ? got / n : 0, { duration: 320 }));
  }, [got, n, punch, fill]);
  // the count pill ticks when the delivered piece lands (0/1 → 1/1 with a bounce), then turns green and a check pops
  // INSIDE the same pill — one stable slot hanging below the face, so nothing ever overlaps the order icon
  const [shown, setShown] = useState(got);
  useEffect(() => {
    if (got <= shown) return setShown(got);
    const id = setTimeout(() => setShown(got), LAND_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [got]);
  const shownDone = done && shown >= n;
  const pillPunch = useSharedValue(1);
  const tick = useSharedValue(shownDone ? 1 : 0);
  useEffect(() => {
    if (shown > 0) pillPunch.value = withSequence(withTiming(1.6, { duration: 120 }), withTiming(1.5, { duration: 140 }), withSpring(1, springs.pop));
  }, [shown, pillPunch]);
  useEffect(() => {
    tick.value = shownDone ? withDelay(120, withSequence(withTiming(1.9, { duration: 160 }), withTiming(1.7, { duration: 160 }), withSpring(1, springs.pop))) : withTiming(0, { duration: 120 });
  }, [shownDone, tick]);
  const glow = useAnimatedStyle(() => ({ opacity: p.value }));
  // ready to deliver: the face bobs with the glow (a gentle "here!"), on top of the delivery punch
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -p.value * 3 }, { scale: punch.value }] }));
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%` }));
  const tickSt = useAnimatedStyle(() => ({ transform: [{ scale: tick.value }] }));
  const pillSt = useAnimatedStyle(() => ({ transform: [{ scale: pillPunch.value }] }));
  // filled: a golden flare blooms behind the card and turns while it fades (the "order complete" beat)
  const flare = useSharedValue(0);
  useEffect(() => {
    if (done) flare.value = withDelay(LAND_MS, withSequence(withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) })));
    else flare.value = 0;
  }, [done, flare]);
  const flareSt = useAnimatedStyle(() => ({ opacity: flare.value, transform: [{ scale: 0.6 + flare.value * 1.1 }, { rotate: `${(1 - flare.value) * 90}deg` }] }));
  return (
    <View ref={refFn} collapsable={false}>
    <Tappable onPress={onPress} style={[styles.card, { width: size, height: size + PILL_DROP }]} scaleTo={0.92} sound={null} accessibilityLabel={`Order ${itemName(piece)} ${got} of ${n}`}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size * 1.6, height: size * 1.6, left: -size * 0.3, top: -size * 0.3 }, flareSt]}>
        <Image source={FLARE} style={{ width: size * 1.6, height: size * 1.6 }} fadeDuration={0} />
      </Animated.View>
      <Animated.View style={[styles.cardGlow, { height: size + 2 }, glow]} />
      {/* the icon sits wholly inside the face, above the progress bar; the count pill hangs BELOW the face */}
      <Animated.View style={[styles.cardFace, { width: size - 4, height: size - 4 }, locked && { opacity: 0.45 }, st]}>
        <Image source={pieces[piece]} style={{ width: Math.round(size * 0.68), height: Math.round(size * 0.68), marginBottom: size * 0.1 }} />
        {/* the progress bar is always there (0/1 included), so a delivery visibly fills it */}
        <View style={styles.cardBar}>
          <Animated.View style={[styles.cardBarFill, bar]} />
        </View>
      </Animated.View>
      <View pointerEvents="none" style={styles.pillRow}>
        <Animated.View style={[styles.countPill, shownDone && styles.countPillDone, pillSt]}>
          {shownDone ? (
            <Animated.View style={[styles.pillCheck, tickSt]}>
              <Image source={require("../../assets/art/ui/check.png")} style={{ width: 14, height: 14 }} />
            </Animated.View>
          ) : null}
          <Text style={styles.countText}>{shown}/{n}</Text>
        </Animated.View>
      </View>
      {locked ? <Image source={require("../../assets/art/ui/lock.png")} style={styles.lock} /> : null}
      {recipe && !done ? (
        <View pointerEvents="none" style={styles.recipeChip}>
          <Image source={pieces[recipe[0]]} style={{ width: 14, height: 14 }} />
          <Text style={styles.recipePlus}>+</Text>
          <Image source={pieces[recipe[1]]} style={{ width: 14, height: 14 }} />
        </View>
      ) : null}
      {reward && !done ? (
        <View style={styles.rewardChip}>
          <Text style={styles.rewardPlus}>+</Text>
          <Image source={pieces[reward]} style={{ width: 18, height: 18 }} />
        </View>
      ) : null}
    </Tappable>
    </View>
  );
}

function GoalCard({ size, kind, left, total }: { size: number; kind: string; left: number; total: number }) {
  const art = kind === "thread" ? "thread1" : kind === "jar" ? "jar3" : kind === "trunk" ? "trunk1" : "crate";
  const done = left === 0;
  return (
    <View style={[styles.card, { width: size, height: size + PILL_DROP }]}>
      <View style={[styles.cardFace, { width: size - 4, height: size - 4, backgroundColor: "#E6D2AE" }]}>
        <Image source={pieces[art]} style={{ width: Math.round(size * 0.64), height: Math.round(size * 0.64), marginBottom: size * 0.08 }} />
      </View>
      <View pointerEvents="none" style={styles.pillRow}>
        <View style={[styles.countPill, done && styles.countPillDone]}>
          {done ? (
            <View style={styles.pillCheck}>
              <Image source={require("../../assets/art/ui/check.png")} style={{ width: 11, height: 11 }} />
            </View>
          ) : null}
          <Text style={styles.countText}>{total - left}/{total}</Text>
        </View>
      </View>
    </View>
  );
}

function PreviewBubble({ at, cell, preview }: { at: { x: number; y: number }; cell: number; preview: ReturnType<typeof dropPreview> }) {
  const label = preview.kind === "big" ? "Big Merge" : preview.kind === "recipe" ? "Recipe" : preview.kind === "key" ? "Unlock" : "Merge";
  return (
    <View pointerEvents="none" style={[styles.preview, { left: Math.max(6, at.x - 86), top: Math.max(4, at.y - cell * 1.35 - 34) }]}>
      <Text style={styles.previewText}>{label}{preview.count ? ` ×${preview.count}` : ""} →</Text>
      {preview.result && pieces[preview.result] ? <Image source={pieces[preview.result]} style={{ width: 34, height: 34 }} /> : null}
      {preview.bonus ? (
        <>
          <Text style={styles.previewText}>+</Text>
          <Image source={pieces[preview.bonus]} style={{ width: 26, height: 26 }} />
        </>
      ) : null}
    </View>
  );
}

/** The heirloom card in the win panel: fully opaque from its first frame; it "stamps" in (scale), it never fades. */
/**
 * Ambient life on an idle board: every few seconds a soft, wide band of lamp light drifts across the cell field
 * (clipped to it, low opacity, transform only — no particles or dots over the pieces, nothing on a Skia canvas).
 */
const BoardSheen = function BoardSheen({ w, h }: { w: number; h: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(1200, withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), withDelay(3200, withTiming(0, { duration: 0 }))), -1, false));
  }, [t]);
  const band = Math.max(60, w * 0.35);
  const st = useAnimatedStyle(() => ({ opacity: t.value > 0 && t.value < 1 ? Math.sin(t.value * Math.PI) : 0, transform: [{ translateX: -band * 1.5 + t.value * (w + band * 2) }, { rotate: "18deg" }] }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 3, top: 3, width: w, height: h, overflow: "hidden", borderRadius: 8 }}>
      <Animated.View style={[{ position: "absolute", top: -h * 0.3, width: band, height: h * 1.6 }, st]}>
        <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={["rgba(255,226,150,0)", "rgba(255,226,150,0.13)", "rgba(255,226,150,0)"]} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
};

/**
 * The heirloom is its own reveal beat on the win card: it lands face-down (a brass-bound keepsake card), then flips
 * over (scaleX through 0 — the box never changes size) with an unlock clink while a golden flare turns behind it; the
 * heirloom art pops on the face and a chime closes the beat.
 */
function HeirloomCard({ heirloom, setDone }: { heirloom: Heirloom; setDone: boolean }) {
  const flip = useSharedValue(0);
  const flare = useSharedValue(0);
  const pop = useSharedValue(0.4);
  const lift = useSharedValue(0);
  const reduce = meta().settings.reduceMotion;
  useEffect(() => {
    // the card flips only once its row has slid onto the win card (that row lands at ≤ ~2.1 s): flipped earlier,
    // it arrived already face-up and read as a static strip (QA 2026-10-30)
    // it rests face-down for ~0.7 s (a readable "keepsake" beat), then a slow flip — both caught at 2 fps
    const at = 2750;
    flip.value = reduce ? withDelay(at, withTiming(1, { duration: 0 })) : withDelay(at, withTiming(1, { duration: 760, easing: Easing.inOut(Easing.cubic) }));
    lift.value = reduce ? 0 : withDelay(at, withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }), withSpring(0, springs.pop)));
    flare.value = withDelay(at + 360, withSequence(withTiming(1, { duration: 240 }), withTiming(0.4, { duration: 1300 })));
    pop.value = withDelay(at + 420, withSequence(withTiming(1.35, { duration: 180 }), withTiming(1.25, { duration: 160 }), withSpring(1, springs.pop)));
    const a = setTimeout(() => feedback("unlock", "medium"), at + 360);
    const b = setTimeout(() => play("star3", 0.8, 1.15), at + 640);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [flip, flare, pop, lift, reduce]);
  const back = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 1 : 0, transform: [{ scaleX: Math.max(0.001, Math.abs(Math.cos(flip.value * Math.PI))) }] }));
  const front = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 : 0, transform: [{ scaleX: Math.max(0.001, Math.abs(Math.cos(flip.value * Math.PI))) }] }));
  const flareSt = useAnimatedStyle(() => ({ opacity: flare.value, transform: [{ rotate: `${flare.value * 60}deg` }, { scale: 0.8 + flare.value * 0.4 }] }));
  const popSt = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const liftSt = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 8 }, { scale: 1 + lift.value * 0.08 }] }));
  return (
    <Animated.View style={[styles.heirSlot, liftSt]}>
      <Animated.View pointerEvents="none" style={[styles.heirFlare, flareSt]}>
        <Image source={FLARE} style={{ width: 120, height: 120 }} fadeDuration={0} />
      </Animated.View>
      <Animated.View style={[styles.heirloom, styles.heirBack, back]}>
        <Image source={pieces.cur_lamp} style={{ width: 44, height: 44 }} />
        <Text style={styles.heirBackText}>A keepsake from Dadi's trunk…</Text>
      </Animated.View>
      <Animated.View style={[styles.heirloom, front]}>
        <Animated.View style={popSt}>
          <Image source={pieces[heirloom.piece]} style={{ width: 54, height: 54 }} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heirTitle}>Heirloom found!</Text>
          <Text style={styles.heirName} numberOfLines={1}>{heirloom.name}</Text>
          <Text style={styles.heirSet} numberOfLines={1}>{setDone ? `"${heirloom.set}" set complete: +150 Lamps` : `Set: ${heirloom.set}`}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function WinExtra({ info, level }: { info: { heirloom: Heirloom | null; setDone: boolean } | null; level: number }) {
  const beat = beatFor(level + 1);
  return (
    <View style={{ gap: 8 }}>
      {info?.heirloom ? (
        <HeirloomCard heirloom={info.heirloom} setDone={info.setDone} />
      ) : null}
      {beat ? <Text style={styles.teaser} numberOfLines={2}>Up next in the story: “{beat.title}”</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  hudPlate: { flex: 1, height: 54, borderRadius: 18, borderWidth: 2.5, borderColor: "#D9A441", flexDirection: "row", alignItems: "center", paddingRight: 10, paddingLeft: 4, gap: 8 },
  levelBadge: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: "#F7D27A", marginLeft: -6, backgroundColor: "#7A3A06" },
  levelFace: { flex: 1, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  levelNum: { fontFamily: fonts.display, fontSize: 22, color: "#FFF6E0", textShadowColor: "#5A2205", textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
  levelTitle: { fontFamily: fonts.displayMedium, fontSize: 13, color: "#FFE9B8", marginBottom: 2 },
  sparkTrack: { height: 20, borderRadius: 10, backgroundColor: "#1A1C4D", borderWidth: 1.5, borderColor: "#B8862B", justifyContent: "center", overflow: "visible" },
  sparkFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 9, overflow: "hidden" },
  sparkGhost: { position: "absolute", top: 0, bottom: 0, borderRadius: 9, backgroundColor: "rgba(216,67,59,0.85)", borderWidth: 1.5, borderColor: "#FFE0D0" },
  sparkWarn: { position: "absolute", left: -2, top: -2, right: -2, bottom: -2, borderRadius: 11, borderWidth: 2, borderColor: "#FF5A4A" },
  sparkDeny: { position: "absolute", left: -2, top: -2, right: -2, bottom: -2, borderRadius: 11, backgroundColor: "rgba(216,67,59,0.75)", borderWidth: 2, borderColor: "#FFD0C0" },
  sparkText: { fontFamily: fonts.display, fontSize: 12, color: "#FFF6E0", textAlign: "center", textShadowColor: "#3A1F14", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  sparkIcon: { position: "absolute", left: -10, top: -7, width: 30, height: 30 },
  trayWrap: { marginHorizontal: 12, marginTop: 8 },
  tray: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, minHeight: 80 },
  card: { width: 64, height: 64, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  pillRow: { position: "absolute", left: -6, right: -6, bottom: 0, alignItems: "center" },
  cardGlow: { position: "absolute", left: -3, top: -1, right: -3, borderRadius: 16, backgroundColor: "rgba(255,201,58,0.55)", borderWidth: 2, borderColor: "#FFC93A" },
  cardFace: { width: 60, height: 60, borderRadius: 14, backgroundColor: "#F3DDB4", borderWidth: 2, borderColor: "#C9A26A", alignItems: "center", justifyContent: "center" },
  countPill: { minWidth: 30, flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: "#4A2A14", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1.5, borderColor: "#FFF6E0" },
  countText: { fontFamily: fonts.display, fontSize: 12, color: "#FFF6E0" },
  countPillDone: { backgroundColor: "#3E8E41", paddingLeft: 3 },
  pillCheck: { width: 15, height: 15, marginRight: 2, alignItems: "center", justifyContent: "center" },
  tick: { width: 24, height: 22, borderRadius: 11, backgroundColor: "#3E8E41", borderWidth: 2, borderColor: "#FFF6E0", alignItems: "center", justifyContent: "center" },
  lock: { position: "absolute", width: 26, height: 26, top: 18 },
  rewardChip: { position: "absolute", top: -6, right: -6, flexDirection: "row", alignItems: "center", backgroundColor: "#1F9E8F", borderRadius: 10, paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#FFF6E0" },
  recipeChip: { position: "absolute", top: -6, left: -6, flexDirection: "row", alignItems: "center", backgroundColor: "#7A4A1E", borderRadius: 9, paddingHorizontal: 2, paddingVertical: 1, borderWidth: 1.5, borderColor: "#FFF6E0" },
  recipePlus: { fontFamily: fonts.display, fontSize: 10, color: "#FFF6E0", marginHorizontal: 1 },
  rewardPlus: { fontFamily: fonts.display, fontSize: 12, color: "#FFF6E0" },
  // a FIXED height: a longer tip (selection, toast) never grows the row, so the board below never moves under a finger
  coachRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 6, gap: 6, height: 52 },
  coachDadi: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#C2255C", borderWidth: 2.5, borderColor: "#F7D27A", alignItems: "center", justifyContent: "center" },
  coach: { flex: 1, backgroundColor: "rgba(43,47,119,0.92)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: "#B8862B", height: 50, justifyContent: "center" },
  coachRim: { position: "absolute", left: -2, top: -2, right: -2, bottom: -2, borderRadius: 14, borderWidth: 2.5, borderColor: "#FFD36A" },
  coachWin: { backgroundColor: "rgba(31,158,143,0.95)", borderColor: "#FFE08A" },
  peek: { position: "absolute", left: 8, right: 8, zIndex: 30, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF6E0", borderRadius: 18, borderWidth: 3, borderColor: "#D9A441", paddingHorizontal: 10, paddingVertical: 6, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  peekTitle: { fontFamily: fonts.display, fontSize: 14, color: "#2B2F77" },
  peekRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  peekSlot: { width: 54, height: 54, borderRadius: 14, backgroundColor: "#F3DDB4", borderWidth: 2, borderColor: "#C9A26A", alignItems: "center", justifyContent: "center" },
  peekResult: { backgroundColor: "#FFE7A3", borderColor: "#F6A81C", borderWidth: 2.5 },
  peekCount: { position: "absolute", right: -6, bottom: -6, backgroundColor: "#2B2F77", borderRadius: 10, paddingHorizontal: 5, borderWidth: 1.5, borderColor: "#FFF6E0" },
  peekCountText: { fontFamily: fonts.display, fontSize: 13, color: "#FFF6E0" },
  peekArrow: { fontFamily: fonts.display, fontSize: 22, color: "#7A3E2A" },
  peekSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: palette.ink },
  sparkPlus: { position: "absolute", right: -8, top: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: "#1F9E8F", borderWidth: 2, borderColor: "#FFF6E0", alignItems: "center", justifyContent: "center" },
  sparkPlusText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 18, color: "#FFF6E0" },
  coachText: { fontFamily: fonts.body, fontSize: 14, color: "#FFF6E0" },
  chipBtn: { height: 44, minWidth: 52, borderRadius: 14, backgroundColor: "#F3DDB4", borderWidth: 2, borderColor: "#7A4A12", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  chipText: { fontFamily: fonts.display, fontSize: 11, color: "#4A2410" },
  boardArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  cellField: { backgroundColor: "#3A1C0C", borderRadius: 10, padding: 3 },
  row: { flexDirection: "row" },
  tools: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-end", paddingTop: 10, paddingHorizontal: 4 },
  ghost: { position: "absolute", left: 0, top: 0 },
  ghostShadow: { position: "absolute", backgroundColor: "rgba(30,10,0,0.5)" },
  ghostPlate: { position: "absolute", backgroundColor: "rgba(255,241,214,0.92)", borderWidth: 3, borderColor: "#F6A81C", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  preview: { position: "absolute", width: 172, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FFF6E0", borderRadius: 16, borderWidth: 2.5, borderColor: "#B8862B", paddingVertical: 3 },
  previewText: { fontFamily: fonts.display, fontSize: 14, color: "#4A2410" },
  bagTray: { position: "absolute", left: 10, right: 10, bottom: 4 },
  bagInner: { padding: 12 },
  bagTitle: { fontFamily: fonts.display, fontSize: 14, color: palette.ink, marginBottom: 6, textAlign: "center" },
  bagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  bagSlot: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#F3DDB4", borderWidth: 2, borderColor: "#C9A26A", alignItems: "center", justifyContent: "center" },
  popArt: { width: 96, height: 96, alignSelf: "center", marginBottom: 6 },
  popText: { fontFamily: fonts.body, fontSize: 16, color: palette.ink, textAlign: "center", marginBottom: 14 },
  popNote: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft, textAlign: "center", marginTop: 10 },
  heirSlot: { height: 82, justifyContent: "center" },
  heirFlare: { position: "absolute", left: 4, top: -19, width: 120, height: 120 },
  heirBack: { position: "absolute", left: 0, right: 0, top: 4, height: 74, backgroundColor: "#7A3E2A", borderColor: "#F6A81C", borderWidth: 3, justifyContent: "center" },
  heirBackText: { fontFamily: fonts.display, fontSize: 14, color: "#FFE7A3" },
  sparkTip: { position: "absolute", left: 64, right: 60, zIndex: 20 },
  sparkTipInner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF6E0", borderRadius: 14, borderWidth: 2.5, borderColor: "#D9A441", paddingHorizontal: 10, paddingVertical: 8, minHeight: 48 },
  sparkTipArrow: { position: "absolute", top: -9, left: 46, width: 16, height: 16, backgroundColor: "#FFF6E0", borderLeftWidth: 2.5, borderTopWidth: 2.5, borderColor: "#D9A441", transform: [{ rotate: "45deg" }] },
  sparkTipText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: palette.ink },
  cardBar: { position: "absolute", left: 6, right: 6, bottom: 3, height: 5, borderRadius: 3, backgroundColor: "rgba(74,42,20,0.35)", overflow: "hidden" },
  cardBarFill: { height: "100%", backgroundColor: "#3E8E41", borderRadius: 3 },
  heirloom: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2B2F77", borderRadius: 16, padding: 10, borderWidth: 2, borderColor: "#D9A441" },
  heirTitle: { fontFamily: fonts.display, fontSize: 15, color: "#FFC93A" },
  heirName: { fontFamily: fonts.body, fontSize: 15, color: "#FFF6E0" },
  heirSet: { fontFamily: fonts.bodyRegular, fontSize: 12, color: "rgba(255,246,224,0.75)" },
  teaser: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft, textAlign: "center" },
});

