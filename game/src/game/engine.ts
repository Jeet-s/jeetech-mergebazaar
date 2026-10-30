/**
 * Merge Bazaar engine — pure TypeScript rules, no UI.
 *
 * A level is a handcrafted board (up to 7x9) of cells. A cell holds nothing, an item, a generator, or a blocker:
 *   crate   — tap to open (1 Spark); shows what's inside
 *   thread  — tangled thread (1-2 layers) over an item / empty floor / a trunk; a merge next to it pulls one layer
 *   jar     — sealed clay jar; three merges next to it crack it open
 *   trunk   — locked trunk; drop a key of the lock's tier (or higher) on it to open
 * Generators make tier-1 items from a fixed, visible sequence; each tap costs Sparks (the level's budget).
 * Merging: drop an item on an identical one → next tier, on the target cell. A Big Merge happens when 5 or more
 * identical free items are on the board: the drop pulls in 5 (the target + the nearest 3 others + the dragged one),
 * the target jumps TWO tiers and a bonus item of the next tier appears in a freed cell. Recipes merge two
 * different items (cloth + dye = sari). Merges hit blockers around the result: the 8 surrounding cells for a normal
 * merge or recipe, the whole 5x5 rangoli ring for a Big Merge. Adjacent items never merge on their own.
 * Orders: deliver items to the order tray; an order can wait for another (multi-stage) and can pay out a reward
 * item onto the board (chain orders). Win = every order filled (+ every blocker of the level's "clear" goal gone).
 * Lose = nothing useful can be done any more (no Sparks for a tap, no merge, delivery, key or booster left).
 */
import { canMerge, isChainItem, isItem, isKey, recipeOf, tierOf, up, type GeneratorKind } from "./catalog";

export type Role = "teach" | "practise" | "twist" | "combine" | "boss" | "breather" | "finale" | "story";
export type BlockerType = "thread" | "jar" | "trunk" | "crate";
export type Booster = "fireworks" | "needle" | "sweep";
export const BOOSTERS: Booster[] = ["fireworks", "needle", "sweep"];

export interface OrderDef {
  item: string;
  n: number;
  /** Index of the order that must be finished first (multi-stage / chain orders). */
  after?: number;
  /** Item placed on the board when this order is finished (chain orders feed the next one). */
  reward?: string;
}

export interface GenDef {
  kind: GeneratorKind;
  /** Produce sequence (cycled): visible to the player as the generator's "next up" queue. */
  seq: string[];
  cost?: number;
}

export interface LevelDef {
  id: number;
  chapter: number;
  title: string;
  role: Role;
  /** What the level teaches/tests. */
  intent: string;
  /** The insight the player must find. */
  aha: string;
  /** Rows of space-separated cell tokens (see parseToken). */
  board: string[];
  gens: GenDef[];
  orders: OrderDef[];
  clear?: BlockerType[];
  sparks: number;
  boosters?: Partial<Record<Booster, number>>;
  mechanics: string[];
  /** Tutorial / coach line shown on the board. */
  hint?: string;
}

export interface State {
  level: number;
  cells: string[];
  sparks: number;
  /** Taps made per generator (the next item = seq[prod % seq.length]). */
  prod: number[];
  /** Remaining count per order. */
  need: number[];
  boosters: number[]; // per BOOSTERS index
  boostersUsed: number;
  bag: string[];
  moves: number;
  /** Compact serialisation (save files, solver/report state keys): one string per field instead of one per cell. */
  toJSON?: () => unknown;
}

function compact(this: State) {
  return {
    level: this.level,
    cells: this.cells.join(","),
    sparks: this.sparks,
    prod: this.prod.join(","),
    need: this.need.join(","),
    boosters: `${this.boosters.join(",")}/${this.boostersUsed}`,
    bag: this.bag.join(","),
    moves: this.moves,
  };
}

export type Move =
  | { k: "tap"; at: number } // generator or crate
  | { k: "drop"; from: number; to: number } // merge / recipe / key on trunk / reposition to an empty cell
  | { k: "deliver"; from: number }
  | { k: "boost"; b: Booster; at: number }
  | { k: "sell"; from: number }
  | { k: "bag"; from: number }
  | { k: "unbag"; slot: number };

export const W = 7;
/** Big Merge unlocks on this level (taught there); before it every merge is a pair merge. */
export const BIG_MERGE_FROM = 8;

/* ───────────── board tokens ───────────── */

/** Authoring token → internal cell string. ".", "#", "L2", "@0" (generator 0), "c:L2", "t:C2", "t2:.", "j:W3",
 * "k1:L4", "t:k1:L4". Internal: "|" separates layers; thread/jar carry their remaining hits. */
export function parseToken(tok: string): string {
  if (tok === "." || tok === "#") return tok;
  if (tok[0] === "@") return `g${tok.slice(1)}`;
  if (isItem(tok)) return tok;
  const i = tok.indexOf(":");
  const head = i < 0 ? tok : tok.slice(0, i);
  const rest = i < 0 ? "." : parseToken(tok.slice(i + 1));
  if (head === "c") return `c|${rest}`;
  if (head === "t" || head === "t1") return `t1|${rest}`;
  if (head === "t2") return `t2|${rest}`;
  if (head === "j") return `j3|${rest}`;
  if (/^j[123]$/.test(head)) return `${head}|${rest}`;
  if (/^k[123]$/.test(head)) return `${head}|${rest}`;
  throw new Error(`bad token ${tok}`);
}

export function parseBoard(def: LevelDef): { w: number; h: number; cells: string[] } {
  const rows = def.board.map((r) => r.trim().split(/\s+/));
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`L${def.id}: ragged board`);
  if (w > W || rows.length > 9) throw new Error(`L${def.id}: board larger than 7x9`);
  return { w, h: rows.length, cells: rows.flat().map(parseToken) };
}

const dims = new Map<number, { w: number; h: number }>();
export function boardSize(def: LevelDef) {
  let d = dims.get(def.id);
  if (!d) {
    const p = parseBoard(def);
    d = { w: p.w, h: p.h };
    dims.set(def.id, d);
  }
  return d;
}

export const head = (cell: string) => cell.split("|")[0];

// Cell classification is cached per distinct cell string (the solver and bots ask millions of times).
const F_ITEM = 1, F_GEN = 2, F_CRATE = 4, F_THREAD = 8, F_JAR = 16, F_TRUNK = 32, F_HAS_TRUNK = 64;
const kinds = new Map<string, number>();
function kindOf(cell: string): number {
  let k = kinds.get(cell);
  if (k === undefined) {
    k = (isItem(cell) ? F_ITEM : 0) | (/^g\d+$/.test(cell) ? F_GEN : 0) | (cell.startsWith("c|") ? F_CRATE : 0) |
      (/^t\d\|/.test(cell) ? F_THREAD : 0) | (/^j\d\|/.test(cell) ? F_JAR : 0) | (/^k\d\|/.test(cell) ? F_TRUNK : 0) |
      (/(^|\|)k\d\|/.test(cell) ? F_HAS_TRUNK : 0);
    kinds.set(cell, k);
  }
  return k;
}
export const isEmpty = (cell: string) => cell === ".";
export const isFreeItem = (cell: string) => (kindOf(cell) & F_ITEM) !== 0;
export const isGen = (cell: string) => (kindOf(cell) & F_GEN) !== 0;
export const isCrate = (cell: string) => (kindOf(cell) & F_CRATE) !== 0;
export const isThread = (cell: string) => (kindOf(cell) & F_THREAD) !== 0;
export const isJar = (cell: string) => (kindOf(cell) & F_JAR) !== 0;
export const isTrunk = (cell: string) => (kindOf(cell) & F_TRUNK) !== 0;
export const hasTrunk = (cell: string) => (kindOf(cell) & F_HAS_TRUNK) !== 0;
export const isBlocker = (cell: string) => (kindOf(cell) & (F_CRATE | F_THREAD | F_JAR | F_TRUNK)) !== 0;
/** What is inside / under a blocker (the innermost item, or "."). */
export const inner = (cell: string) => cell.split("|").pop() ?? ".";

/* ───────────── state ───────────── */

export function startState(def: LevelDef, level: number): State {
  return {
    level,
    cells: parseBoard(def).cells,
    sparks: def.sparks,
    prod: def.gens.map(() => 0),
    need: def.orders.map((o) => o.n),
    boosters: BOOSTERS.map((b) => def.boosters?.[b] ?? 0),
    boostersUsed: 0,
    bag: [],
    moves: 0,
    toJSON: compact,
  };
}

export const orderActive = (def: LevelDef, s: State, i: number) => {
  const a = def.orders[i].after;
  return s.need[i] > 0 && (a === undefined || s.need[a] === 0);
};

/** Index of the active order this item can be delivered to, or -1. */
export function orderFor(def: LevelDef, s: State, item: string): number {
  for (let i = 0; i < def.orders.length; i++) if (def.orders[i].item === item && orderActive(def, s, i)) return i;
  return -1;
}

export function nextProduct(def: LevelDef, s: State, g: number): string {
  const seq = def.gens[g].seq;
  return seq[s.prod[g] % seq.length];
}

const manhattan = (w: number, a: number, b: number) => Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));

/** Nearest empty cell to `from` (Manhattan, ties in reading order) — where produced items and rewards land. */
export function nearestEmpty(cells: string[], w: number, from: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== ".") continue;
    const d = manhattan(w, i, from);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Cells around i: the 8 surrounding cells, or the 5x5 "rangoli ring" (radius 2) when wide. */
export function neighbours(w: number, h: number, i: number, wide: boolean): number[] {
  const r = Math.floor(i / w), c = i % w, out: number[] = [];
  const R = wide ? 2 : 1;
  for (let dr = -R; dr <= R; dr++)
    for (let dc = -R; dc <= R; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
  return out;
}

/** One hit on a blocker cell: thread loses a layer, a jar a crack; returns the new cell. */
function hit(cell: string): string {
  const m = /^([tj])(\d)\|(.*)$/.exec(cell);
  if (!m) return cell;
  const n = Number(m[2]) - 1;
  return n <= 0 ? m[3] : `${m[1]}${n}|${m[3]}`;
}

export function won(def: LevelDef, s: State): boolean {
  if (s.need.some((n) => n > 0)) return false;
  for (const goal of def.clear ?? []) {
    const test = goal === "thread" ? isThread : goal === "jar" ? isJar : goal === "trunk" ? hasTrunk : isCrate;
    if (s.cells.some(test)) return false;
  }
  return true;
}

/* ───────────── what a drop does ───────────── */

export type DropKind = "merge" | "big" | "recipe" | "key" | "move" | null;

/** The free identical items a Big Merge would pull in (target first, dragged second), or null for a pair merge. */
export function bigMergeSet(def: LevelDef, s: State, from: number, to: number): number[] | null {
  const code = s.cells[to];
  if (def.id < BIG_MERGE_FROM || !isChainItem(code) || !canMerge(up(code))) return null;
  const { w } = boardSize(def);
  const others: number[] = [];
  for (let i = 0; i < s.cells.length; i++) if (i !== from && i !== to && s.cells[i] === code) others.push(i);
  if (others.length < 3) return null;
  others.sort((a, b) => manhattan(w, a, to) - manhattan(w, b, to) || a - b);
  return [to, from, ...others.slice(0, 3)];
}

export function dropKind(def: LevelDef, s: State, from: number, to: number): DropKind {
  if (from === to) return null;
  const a = s.cells[from], b = s.cells[to];
  if (a === undefined || b === undefined || !isFreeItem(a)) return null;
  if (b === ".") return "move";
  if (a === b && canMerge(a)) return bigMergeSet(def, s, from, to) ? "big" : "merge";
  if (isFreeItem(b) && recipeOf(a, b)) return "recipe";
  if (isKey(a) && isTrunk(b) && tierOf(a) >= Number(b[1])) return "key";
  return null;
}

/** What a drop would produce (for the long-press merge preview): result item, count consumed, bonus item. */
export function dropPreview(def: LevelDef, s: State, from: number, to: number): { kind: DropKind; result?: string; count?: number; bonus?: string } {
  const kind = dropKind(def, s, from, to);
  const a = s.cells[from], b = s.cells[to];
  if (kind === "merge") return { kind, result: up(b), count: 2 };
  if (kind === "big") return { kind, result: up(b, 2), count: 5, bonus: up(b) };
  if (kind === "recipe") return { kind, result: recipeOf(a, b), count: 2 };
  if (kind === "key") return { kind, result: inner(b), count: 1 };
  return { kind };
}

/* ───────────── apply ───────────── */

function strike(cells: string[], w: number, h: number, at: number, ring: boolean) {
  for (const n of neighbours(w, h, at, ring)) cells[n] = hit(cells[n]);
}

function placeReward(def: LevelDef, s: State, item: string) {
  const { w } = boardSize(def);
  const at = nearestEmpty(s.cells, w, Math.floor(w / 2)); // drops in from the order tray above the board
  if (at >= 0) s.cells[at] = item;
  else s.bag.push(item);
}

/** Apply a move (assumed legal — use legal()). Returns a new state. */
export function apply(def: LevelDef, s0: State, m: Move): State {
  const s: State = { ...s0, cells: s0.cells.slice(), moves: s0.moves + 1 };
  const { w, h } = boardSize(def);
  switch (m.k) {
    case "tap": {
      const c = s.cells[m.at];
      if (isGen(c)) {
        const g = Number(c.slice(1));
        const at = nearestEmpty(s.cells, w, m.at);
        s.cells[at] = nextProduct(def, s, g);
        s.prod = s.prod.slice();
        s.prod[g]++;
        s.sparks -= def.gens[g].cost ?? 1;
      } else if (isCrate(c)) {
        s.cells[m.at] = inner(c);
        s.sparks -= 1;
      }
      return s;
    }
    case "drop": {
      const kind = dropKind(def, s0, m.from, m.to);
      const a = s.cells[m.from], b = s.cells[m.to];
      if (kind === "move") {
        s.cells[m.to] = a;
        s.cells[m.from] = ".";
      } else if (kind === "merge") {
        s.cells[m.to] = up(b);
        s.cells[m.from] = ".";
        strike(s.cells, w, h, m.to, false);
      } else if (kind === "big") {
        const set = bigMergeSet(def, s0, m.from, m.to)!;
        for (const i of set) s.cells[i] = ".";
        s.cells[m.to] = up(b, 2);
        const freed = set.slice(1).sort((x, y) => manhattan(w, x, m.to) - manhattan(w, y, m.to) || x - y);
        s.cells[freed[0]] = up(b);
        strike(s.cells, w, h, m.to, true);
      } else if (kind === "recipe") {
        s.cells[m.to] = recipeOf(a, b)!;
        s.cells[m.from] = ".";
        strike(s.cells, w, h, m.to, false);
      } else if (kind === "key") {
        s.cells[m.to] = inner(b);
        s.cells[m.from] = ".";
      }
      return s;
    }
    case "deliver": {
      const item = s.cells[m.from];
      const o = orderFor(def, s, item);
      if (o < 0) return s;
      s.need = s.need.slice();
      s.need[o]--;
      s.cells[m.from] = ".";
      if (s.need[o] === 0 && def.orders[o].reward) placeReward(def, s, def.orders[o].reward!);
      return s;
    }
    case "boost": {
      const bi = BOOSTERS.indexOf(m.b);
      s.boosters = s.boosters.slice();
      s.boosters[bi]--;
      s.boostersUsed++;
      const open = (i: number) => {
        const c = s.cells[i];
        if (isCrate(c)) s.cells[i] = inner(c);
        else s.cells[i] = hit(c);
      };
      if (m.b === "needle") {
        let c = s.cells[m.at];
        while (isThread(c)) c = hit(c);
        s.cells[m.at] = c;
      } else if (m.b === "fireworks") {
        open(m.at);
        for (const n of neighbours(w, h, m.at, false)) open(n);
      } else {
        const r = Math.floor(m.at / w);
        for (let c = 0; c < w; c++) open(r * w + c);
      }
      return s;
    }
    case "sell":
      s.cells[m.from] = ".";
      return s;
    case "bag":
      s.bag = [...s.bag, s.cells[m.from]];
      s.cells[m.from] = ".";
      return s;
    case "unbag": {
      const at = nearestEmpty(s.cells, w, Math.floor(w / 2) + (h - 1) * w);
      s.cells[at] = s.bag[m.slot];
      s.bag = s.bag.filter((_, i) => i !== m.slot);
      return s;
    }
  }
}

/** Is this move allowed right now? (the UI asks before applying a gesture) */
export function legal(def: LevelDef, s: State, m: Move): boolean {
  const c = (i: number) => s.cells[i] ?? "#";
  switch (m.k) {
    case "tap": {
      const x = c(m.at);
      if (isGen(x)) return s.sparks >= (def.gens[Number(x.slice(1))].cost ?? 1) && s.cells.includes(".");
      if (isCrate(x)) return s.sparks >= 1;
      return false;
    }
    case "drop":
      return dropKind(def, s, m.from, m.to) !== null;
    case "deliver":
      return isFreeItem(c(m.from)) && orderFor(def, s, c(m.from)) >= 0;
    case "boost": {
      const bi = BOOSTERS.indexOf(m.b);
      if (s.boosters[bi] <= 0 || c(m.at) === "#") return false;
      if (m.b === "needle") return isThread(c(m.at));
      return true;
    }
    case "sell":
    case "bag":
      return isFreeItem(c(m.from));
    case "unbag":
      return m.slot >= 0 && m.slot < s.bag.length && s.cells.includes(".");
  }
}

/* ───────────── the move set players think in (solver + bots) ───────────── */

/**
 * Every meaningful move from this state: taps, merges (one per target cell), recipes, keys on trunks, deliveries,
 * boosters on blockers. Repositioning, selling and the Bag are UI conveniences — never needed to win, so the
 * solver and bots leave them out (anything they can win, a player can too).
 */
export function coreMoves(def: LevelDef, s: State): Move[] {
  const out: Move[] = [];
  const { w, h } = boardSize(def);
  const cells = s.cells;
  const hasEmpty = cells.includes(".");
  const byCode = new Map<string, number[]>();
  for (let i = 0; i < cells.length; i++) {
    const x = cells[i];
    if (isGen(x)) {
      if (hasEmpty && s.sparks >= (def.gens[Number(x.slice(1))].cost ?? 1)) out.push({ k: "tap", at: i });
    } else if (isCrate(x)) {
      if (s.sparks >= 1) out.push({ k: "tap", at: i });
    } else if (isFreeItem(x)) {
      let l = byCode.get(x);
      if (!l) byCode.set(x, (l = []));
      l.push(i);
    }
  }
  // How many thread/jar cells a merge landing on i would hit (8 around it, or the 5x5 ring for a Big Merge).
  const hittable = (i: number) => isThread(cells[i]) || isJar(cells[i]);
  const hits = (i: number, wide = false) => {
    let n = 0;
    for (const x of neighbours(w, h, i, wide)) if (hittable(x)) n++;
    return n;
  };
  // Best landing cell among `at` (most hits, then reading order) and the best piece to drag (fewest hits, last).
  const bestTarget = (at: number[], wide = false) => at.reduce((b, i) => (hits(i, wide) > hits(b, wide) ? i : b), at[0]);
  const bestSource = (at: number[], not: number) => {
    let best = -1;
    for (const i of at) if (i !== not && (best < 0 || hits(i) <= hits(best))) best = i;
    return best;
  };
  for (const [code, at] of byCode) {
    if (orderFor(def, s, code) >= 0) out.push({ k: "deliver", from: at[0] });
    if (at.length >= 2 && canMerge(code)) {
      // A player merges where it does the most good: the copy beside the most blockers.
      const big = at.length >= 5 && def.id >= BIG_MERGE_FROM && canMerge(up(code));
      const t = bestTarget(at, big);
      out.push({ k: "drop", from: bestSource(at, t), to: t });
    }
  }
  const codes = [...byCode.keys()];
  for (let x = 0; x < codes.length; x++)
    for (let y = x + 1; y < codes.length; y++) {
      if (!recipeOf(codes[x], codes[y])) continue;
      const A = byCode.get(codes[x])!, B = byCode.get(codes[y])!;
      const ta = bestTarget(A), tb = bestTarget(B);
      if (hits(tb) >= hits(ta)) out.push({ k: "drop", from: bestSource(A, -1), to: tb });
      else out.push({ k: "drop", from: bestSource(B, -1), to: ta });
    }
  for (let i = 0; i < cells.length; i++) {
    if (!isTrunk(cells[i])) continue;
    const lock = Number(cells[i][1]);
    let best = -1;
    for (const [code, at] of byCode) if (isKey(code) && tierOf(code) >= lock && (best < 0 || tierOf(code) < tierOf(cells[best]))) best = at[0];
    if (best >= 0) out.push({ k: "drop", from: best, to: i });
  }
  // Staging: when no copy of a partnered piece sits beside thread or a jar, drag one into the empty cell that
  // touches the most of them — the next merge lands there (the only repositioning that ever matters for a win).
  if (hasEmpty && cells.some((_, i) => hittable(i))) {
    let spot = -1;
    for (let i = 0; i < cells.length; i++) if (cells[i] === "." && hits(i) > 0 && (spot < 0 || hits(i) > hits(spot))) spot = i;
    if (spot >= 0)
      for (const [code, at] of byCode) {
        const has = (at.length >= 2 && canMerge(code)) || codes.some((o) => o !== code && recipeOf(code, o));
        if (has && at.every((i) => hits(i) === 0)) out.push({ k: "drop", from: at[at.length - 1], to: spot });
      }
  }
  if (s.bag.length && hasEmpty) out.push({ k: "unbag", slot: 0 });
  if (s.boosters.some((n) => n > 0)) {
    const blocks = (i: number) => isThread(cells[i]) || isJar(cells[i]) || isCrate(cells[i]);
    let fw = -1, fwN = 0;
    for (let i = 0; i < cells.length; i++) {
      if (s.boosters[1] > 0 && isThread(cells[i])) out.push({ k: "boost", b: "needle", at: i });
      if (s.boosters[0] > 0) {
        const n = (blocks(i) ? 1 : 0) + neighbours(w, h, i, false).filter(blocks).length;
        if (n > fwN) { fw = i; fwN = n; }
      }
    }
    // Fireworks: the 3x3 centre covering the most blockers, plus every blocker cell itself (aiming matters).
    if (fw >= 0) {
      out.push({ k: "boost", b: "fireworks", at: fw });
      for (let i = 0; i < cells.length; i++) if (i !== fw && blocks(i)) out.push({ k: "boost", b: "fireworks", at: i });
    }
    if (s.boosters[2] > 0)
      for (let r = 0; r < h; r++) {
        let any = false;
        for (let c = 0; c < w; c++) { const x = cells[r * w + c]; if (isThread(x) || isJar(x) || isCrate(x)) any = true; }
        if (any) out.push({ k: "boost", b: "sweep", at: r * w });
      }
  }
  return out;
}

export type Status = "playing" | "won" | "lost";

/** Cheap "is there anything left to do" check (early exit) — status() runs on every bot look-ahead. */
export function hasAnyMove(def: LevelDef, s: State): boolean {
  const cells = s.cells;
  const hasEmpty = cells.includes(".");
  const seen = new Set<string>();
  const keys: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const x = cells[i];
    if (isGen(x)) {
      if (hasEmpty && s.sparks >= (def.gens[Number(x.slice(1))].cost ?? 1)) return true;
    } else if (isCrate(x)) {
      if (s.sparks >= 1) return true;
    } else if (isFreeItem(x)) {
      if (seen.has(x) && canMerge(x)) return true;
      if (orderFor(def, s, x) >= 0) return true;
      seen.add(x);
      if (isKey(x)) keys.push(tierOf(x));
    } else if (isTrunk(x) && keys.length) {
      // checked below once all keys are known
    }
  }
  const codes = [...seen];
  for (let a = 0; a < codes.length; a++) for (let b = a + 1; b < codes.length; b++) if (recipeOf(codes[a], codes[b])) return true;
  if (keys.length) {
    const best = Math.max(...keys);
    for (const x of cells) if (isTrunk(x) && best >= Number(x[1])) return true;
  }
  if (s.bag.length && hasEmpty) return true;
  if (s.boosters.some((n) => n > 0) && cells.some((x) => isThread(x) || isJar(x) || isCrate(x))) return true;
  return false;
}

export function status(def: LevelDef, s: State): Status {
  if (won(def, s)) return "won";
  return hasAnyMove(def, s) ? "playing" : "lost";
}

/** 1-3 Marigold stars: 1 for the win; +1 for finishing with Sparks to spare (efficiency); +1 for no boosters and a
 * tidy board (no unused item left beside the ones still useful). 1 star is always enough to progress. */
export function starsFor(def: LevelDef, s: State, par: number): number {
  let stars = 1;
  if (def.sparks - s.sparks <= par) stars++;
  const loose = s.cells.filter((c) => isFreeItem(c)).length;
  if (s.boostersUsed === 0 && loose <= 6) stars++;
  return stars;
}
