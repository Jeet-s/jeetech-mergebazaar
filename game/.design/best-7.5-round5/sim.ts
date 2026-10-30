/**
 * Simulation interface for the factory's bot playtesters (scripts/playtest.ts), on the REAL Merge Bazaar engine.
 * QA uses the results to reject levels that are boring, walls or badly paced, and the level-design review reads
 * every level through describe().
 */
import { CRAFTED, GENERATORS, isChainItem, itemName, recipeInputs } from "./catalog";
import { BIG_MERGE_FROM, apply, boardSize, coreMoves, parseBoard, startState, status, type LevelDef, type Move, type State } from "./engine";
import { LEVELS } from "./levels";
import { decodeMove, progress } from "./solver";
import solutions from "./solutions.json";

const SOLUTIONS = solutions as Record<string, string[]>;

/** The level's stored winning line (validate.ts replays it move by move on the engine) as one proof line. */
function proofOf(def: LevelDef): string {
  const sol = SOLUTIONS[String(def.id)];
  if (!sol?.length) return "";
  let s = startState(def, def.id - 1);
  for (const x of sol) s = apply(def, s, decodeMove(x));
  if (status(def, s) !== "won") return "";
  return `proof: stored ${sol.length}-move win replayed on the engine by validate.ts, ${def.sparks - s.sparks}/${def.sparks} Sparks used`;
}

export type Status = "playing" | "won" | "lost";

/**
 * How a level designer reads one level (scripts/levels-report.ts → QA's level-design review).
 * grid: the START state as ASCII art, one text row per board row, + a legend. intent: what this
 * level teaches or tests and its "aha" moment, written when the level was designed.
 */
export interface LevelBrief {
  grid: string;
  legend: string;
  intent: string;
  mechanics: string[]; // mechanics / twists in play on this level
}

export interface Sim<S, M> {
  levelCount: number;
  /** Fresh state of level `index` (0-based). */
  start(index: number): S;
  /** Legal moves from this state (what a player could tap/swipe now). */
  moves(state: S): M[];
  apply(state: S, move: M): S;
  status(state: S): Status;
  /** Higher = closer to winning — what a human "sees" as progress. Used by human-like bots. */
  progress(state: S): number;
  /** The level as a designer sees it — REQUIRED: QA's level-design review reads every level through it. */
  describe(index: number): LevelBrief;
}

export const LEGEND =
  "Cells: . floor; # bare ground (nothing lands there, merges never reach it); @n generator n (tap: 1 Spark, item drops in nearest empty cell); XN = item of chain X tier N " +
  "(L lamp 1-5, F flower 1-4, W sweets 1-4, C cloth 1-3, D dye 1-2, K key 1-3, S chilli 1-3, P pepper, T turmeric, R rice, G ghee); " +
  "Du dupatta=C1+D1, Sa sari=C2+D1, Mx=S2+P1, Ms masala=Mx+T1, Po pongal=R2+G1, Fp platter=Po+W2, Mb banner=Sa+F3. " +
  "c:X crate (1 Spark opens); t:X / t2:X thread (over an item, floor, trunk or even a generator — t:@0 can't be tapped until freed) with 1/2 layers over X (each merge in a side cell pulls a layer); " +
  "j:X sealed jar (3 adjacent merges); kN:X trunk (drop key tier>=N). Rules: 2 identical → next tier; 5 identical on board → " +
  "Big Merge (tier+2 + bonus tier+1, hits the whole 5x5 around it). Win: fill every order (+ clear goals) within the Spark budget.";

function token(cell: string): string {
  return cell
    .split("|")
    .map((p) => (p === "j3" ? "j" : p === "t1" ? "t" : /^g\d+$/.test(p) ? `@${p.slice(1)}` : p))
    .join(":");
}

/** Every item code this level can involve (board, generator queues, orders, rewards and their recipe inputs). */
function codesOf(def: LevelDef): string[] {
  const out = new Set<string>();
  const add = (c: string) => {
    if (!c || out.has(c) || !(c in CRAFTED || isChainItem(c))) return;
    out.add(c);
    const r = recipeInputs(c);
    if (r) r.forEach(add);
  };
  for (const row of def.board) for (const t of row.trim().split(/\s+/)) add(t.split(":").pop() ?? "");
  for (const g of def.gens) g.seq.forEach(add);
  for (const o of def.orders) { add(o.item); if (o.reward) add(o.reward); }
  const order = "LFWCDKSPTRG";
  return [...out].sort((a, b) => (order.indexOf(a[0]) - order.indexOf(b[0])) || a.localeCompare(b));
}

/** The full legend for THIS board (the review shows one level at a time, so every row carries its own key). */
function legendFor(def: LevelDef): string {
  const names = codesOf(def).map((c) => {
    const r = recipeInputs(c);
    return `${c} ${itemName(c)}${r ? ` (=${r[0]}+${r[1]})` : ""}`;
  });
  const toks = new Set(def.board.flatMap((r) => r.trim().split(/\s+/)));
  const has = (re: RegExp) => [...toks].some((t) => re.test(t));
  const parts = [
    `key: . empty floor; # bare ground (nothing lands there, merges never reach it); @n generator n (tap = its queue's next item into the nearest EMPTY cell — no empty cell, no tap)`,
    has(/(^|:)c:/) || has(/^c:/) ? "c:X crate showing X (1 Spark opens it; merges don't)" : "",
    has(/(^|:)t2?:/) ? "t:X / t2:X tangled thread with 1/2 layers over X (each merge or recipe landing in one of its 8 neighbours pulls a layer; t:@n = generator can't be tapped until free)" : "",
    has(/(^|:)j\d?:/) ? "j:X sealed jar holding X (cracks open after 3 merges/recipes landing next to it)" : "",
    has(/(^|:)k\d:/) ? "kN:X locked trunk holding X (drop a key of tier >= N: K1 brass, K2 silver, K3 filigree)" : "",
    def.boosters?.fireworks ? "Fireworks booster: opens every crate and hits every blocker in a 3x3" : "",
    def.boosters?.needle ? "Needle booster: removes every layer of one knot" : "",
    def.boosters?.sweep ? "Sweep booster: hits every blocker in one row once (opens crates, one crack per jar, one layer per knot)" : "",
    `items: ${names.join(", ")}`,
  ].filter(Boolean);
  const rules =
    "rules: drop a piece on an identical one → next tier on the target cell (adjacent pieces never merge on their own); " +
    (def.id >= BIG_MERGE_FROM ? "5+ identical free pieces → the drop is a Big Merge (5 pieces → target +2 tiers + a bonus piece +1 tier; hits the whole 5x5 around it), it always fires at 5; " : "") +
    "recipes combine two different pieces; deliver a piece to an active order; lose when no tap, merge, recipe, key, delivery or booster is left.";
  return `${parts.join("; ")}. ${rules}`;
}

export function describeLevel(def: LevelDef): LevelBrief {
  const { w } = boardSize(def);
  const cells = parseBoard(def).cells.map(token);
  const width = Math.max(...cells.map((c) => c.length));
  const rows: string[] = [];
  for (let r = 0; r < cells.length / w; r++) rows.push(cells.slice(r * w, r * w + w).map((c) => c.padEnd(width)).join(" ").trimEnd());
  const gens = def.gens.map((g, i) => `@${i} ${GENERATORS[g.kind]}→queue ${g.seq.join(",")}${g.seq.length > 1 ? " (cycles)" : ""}, ${g.cost ?? 1} Spark${(g.cost ?? 1) > 1 ? "s" : ""}/tap`).join("; ");
  const orders = def.orders
    .map((o, i) => `${i}:${o.item} ${itemName(o.item)} x${o.n}${o.after !== undefined ? ` (opens after ${o.after})` : ""}${o.reward ? ` (pays ${o.reward} ${itemName(o.reward)})` : ""}`)
    .join(", ");
  const free = cells.filter((c) => c === ".").length;
  const extras = [
    `orders ${orders}`,
    def.clear?.length ? `clear all ${def.clear.join("+")}` : "",
    `Sparks ${def.sparks}; board ${w}x${cells.length / w}, ${free} empty cells at start`,
    gens ? `gens ${gens}` : "no generators",
    proofOf(def),
    def.boosters ? `boosters ${Object.entries(def.boosters).map(([k, v]) => `${k} x${v}`).join(", ")}` : "",
    legendFor(def),
  ].filter(Boolean);
  return {
    grid: [...rows, ...extras].join("\n"),
    legend: LEGEND,
    intent: `${def.role.toUpperCase()} — ${def.intent} AHA: ${def.aha}`,
    mechanics: def.mechanics,
  };
}

/** A Sim over any list of level definitions (the tuner builds candidates this way). */
export function makeSim(defs: LevelDef[]): Sim<State, Move> {
  const d = (s: State) => defs[s.level];
  return {
    levelCount: defs.length,
    start: (i) => startState(defs[i], i),
    moves: (s) => coreMoves(d(s), s),
    apply: (s, m) => apply(d(s), s, m),
    status: (s) => status(d(s), s),
    progress: (s) => progress(d(s), s),
    describe: (i) => describeLevel(defs[i]),
  };
}

export const sim: Sim<State, Move> = makeSim(LEVELS);

export { itemName };
