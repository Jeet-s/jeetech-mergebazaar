/**
 * How close a board is to winning (what a player "sees" as progress), and a beam-search solver on the real engine.
 * Used by: bots (sim.progress), scripts/validate.ts (proof + difficulty), the tuner, and the in-game "I'm stuck"
 * helper / QA replay (next move toward the win).
 */
import { CRAFTED, canMerge, isChainItem, recipeInputs, recipeOf, tierOf, unitsOf } from "./catalog";
import { BIG_MERGE_FROM, apply, boardSize, inner, neighbours, coreMoves, startState, isCrate, isFreeItem, isJar, isThread, hasTrunk, won, type LevelDef, type Move, type State } from "./engine";

/** Items still needed, with crafted items already on the board subtracted and the rest expanded into inputs. */
export function demand(def: LevelDef, s: State): { chain: Map<string, number[]>; craftedCredit: number } {
  const want = new Map<string, number>();
  def.orders.forEach((o, i) => s.need[i] > 0 && want.set(o.item, (want.get(o.item) ?? 0) + s.need[i]));
  const have = new Map<string, number>();
  for (const c of [...s.cells, ...s.bag]) if (c in CRAFTED) have.set(c, (have.get(c) ?? 0) + 1);
  let craftedCredit = 0;
  // Expand crafted demand (deepest recipes last-in-first-out until only chain items remain).
  for (let guard = 0; guard < 20; guard++) {
    const crafted = [...want.entries()].find(([k, n]) => k in CRAFTED && n > 0);
    if (!crafted) break;
    const [code, n] = crafted;
    want.delete(code);
    const got = Math.min(n, have.get(code) ?? 0);
    if (got) {
      have.set(code, (have.get(code) ?? 0) - got);
      craftedCredit += got * (unitsOf(code) * 1.15 + 1);
    }
    const rest = n - got;
    const inp = recipeInputs(code);
    if (rest > 0 && inp) for (const x of inp) want.set(x, (want.get(x) ?? 0) + rest);
  }
  // Every trunk on the board wants a key of its lock tier.
  for (const c of s.cells) {
    const m = /(^|\|)k(\d)\|/.exec(c);
    if (m) want.set(`K${m[2]}`, (want.get(`K${m[2]}`) ?? 0) + 1);
  }
  const chain = new Map<string, number[]>();
  for (const [code, n] of want) {
    if (!isChainItem(code)) continue;
    const l = chain.get(code[0]) ?? [];
    for (let i = 0; i < n; i++) l.push(tierOf(code));
    chain.set(code[0], l);
  }
  for (const l of chain.values()) l.sort((a, b) => b - a);
  return { chain, craftedCredit };
}

/** Higher = closer to winning. */
export function progress(def: LevelDef, s: State): number {
  if (won(def, s)) return 1e6;
  let p = 0;
  def.orders.forEach((o, i) => (p += (o.n - s.need[i]) * (unitsOf(o.item) * 1.3 + 3)));
  const { chain, craftedCredit } = demand(def, s);
  p += craftedCredit;
  const supply = new Map<string, number[]>();
  for (const c of [...s.cells, ...s.bag]) {
    if (!isFreeItem(c) || !isChainItem(c)) continue;
    const l = supply.get(c[0]) ?? [];
    l.push(tierOf(c));
    supply.set(c[0], l);
  }
  // Pieces a player can SEE inside crates, jars, knots and trunks count half: they cover demand (no need to make
  // them again) but are worth freeing.
  const hidden = new Map<string, number[]>();
  for (const c of s.cells) {
    if (isFreeItem(c) || !c.includes("|")) continue;
    const x = inner(c);
    if (!isChainItem(x)) continue;
    const l = hidden.get(x[0]) ?? [];
    l.push(tierOf(x));
    hidden.set(x[0], l);
    if (!supply.has(x[0])) supply.set(x[0], []);
  }
  for (const [ch, items] of supply) {
    items.sort((a, b) => b - a);
    const hid = (hidden.get(ch) ?? []).sort((a, b) => b - a);
    const all = [...items.map((t) => ({ t, w: 1 })), ...hid.map((t) => ({ t, w: 0.5 }))].sort((a, b) => b.t - a.t || b.w - a.w);
    const dem = chain.get(ch) ?? [];
    const usedAll = all.map(() => false);
    for (const d of dem) {
      let left = 2 ** (d - 1);
      for (let k = 0; k < all.length && left > 0; k++) {
        if (usedAll[k] || all[k].t > d) continue;
        const u = 2 ** (all[k].t - 1);
        if (u > left) continue;
        usedAll[k] = true;
        left -= u;
        p += all[k].w * (u * (0.75 + 0.25 * (all[k].t / d)) + (all[k].t === d ? 0.4 : 0));
      }
    }
    all.forEach((x, k) => { if (!usedAll[k] && x.w === 1) p -= 0.15 + 0.05 * x.t; });
    // Big Merge readiness: a player who wants a piece two tiers up sees "almost five of a kind" as progress.
    const demandUnits = dem.reduce((a, d) => a + 2 ** (d - 1), 0);
    const supplyUnits = all.reduce((a, x) => a + 2 ** (x.t - 1), 0);
    if (def.id >= BIG_MERGE_FROM && dem.length && supplyUnits < demandUnits + 2) {
      const top = dem[0];
      const count = new Map<number, number>();
      for (const t of items) count.set(t, (count.get(t) ?? 0) + 1);
      for (const [t, n] of count) if (t + 2 <= top && n >= 3) p += 0.15 * Math.min(n, 5) ** 2 - 0.9;
    }
  }
  // A piece with a partner waiting beside thread or a jar = the next merge will hit it.
  const { w, h } = boardSize(def);
  const codes = new Map<string, number>();
  for (const c of s.cells) if (isFreeItem(c)) codes.set(c, (codes.get(c) ?? 0) + 1);
  const partner = (c: string) => ((codes.get(c) ?? 0) >= 2 && canMerge(c)) || [...codes.keys()].some((o) => o !== c && recipeOf(c, o));
  for (let i = 0; i < s.cells.length; i++) {
    if (!isThread(s.cells[i]) && !isJar(s.cells[i])) continue;
    const adj = neighbours(w, h, i, false).map((n) => s.cells[n]);
    if (adj.some((x) => isFreeItem(x) && partner(x))) p += 0.35;
  }
  const goals = new Set(def.clear ?? []);
  for (const c of s.cells) {
    let m: RegExpExecArray | null;
    if ((m = /^t(\d)\|/.exec(c))) p -= Number(m[1]) * (goals.has("thread") ? 1 : 0.4);
    if ((m = /(^|\|)j(\d)\|/.exec(c))) p -= Number(m[2]) * (goals.has("jar") ? 1 : 0.4);
    if (hasTrunk(c)) p -= goals.has("trunk") ? 2 : 0.8;
    if (isCrate(c) && goals.has("crate")) p -= 1;
  }
  p += s.sparks * 0.04 + s.boosters.reduce((a, b) => a + b, 0) * 0.3;
  return p;
}

export const stateKey = (s: State) => `${s.cells.join(",")}/${s.sparks}/${s.prod.join(",")}/${s.need.join(",")}/${s.boosters.join(",")}/${s.bag.join(",")}`;

/**
 * Beam search toward a win. Returns the move list or null. Deterministic. Not guaranteed optimal — it is the
 * proof that a level is winnable (validate.ts replays the moves through the engine to check).
 */
export function solve(def: LevelDef, start: State, beam = 300, maxDepth = 160): { moves: Move[]; explored: number; branching: number } | null {
  type Node = { s: State; path: Move[]; v: number };
  let frontier: Node[] = [{ s: start, path: [], v: progress(def, start) }];
  const seen = new Set<string>([stateKey(start)]);
  let explored = 0, branchSum = 0, branchN = 0;
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      const ms = coreMoves(def, n.s);
      branchSum += ms.length;
      branchN++;
      for (const m of ms) {
        const t = apply(def, n.s, m);
        explored++;
        if (won(def, t)) return { moves: [...n.path, m], explored, branching: branchSum / branchN };
        const k = stateKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: t, path: [...n.path, m], v: progress(def, t) });
      }
    }
    next.sort((a, b) => b.v - a.v);
    frontier = next.slice(0, beam);
  }
  return null;
}

/** Solve with growing beams (cheap first). */
export function solveHard(def: LevelDef, start: State, beams = [60, 300, 1500]): ReturnType<typeof solve> {
  for (const b of beams) {
    const r = solve(def, start, b);
    if (r) return r;
  }
  return null;
}

/** Remaining blockers on the board (for reporting). */
export function blockerCount(s: State) {
  return s.cells.filter((c) => isThread(c) || isJar(c) || hasTrunk(c) || isCrate(c)).length;
}

/* ───────── stored solutions (validate replays them; the helper / QA replay follows them) ───────── */

export function encodeMove(m: Move): string {
  switch (m.k) {
    case "tap": return `t${m.at}`;
    case "drop": return `d${m.from}>${m.to}`;
    case "deliver": return `v${m.from}`;
    case "boost": return `b${m.b[0]}${m.at}`;
    case "sell": return `s${m.from}`;
    case "bag": return `g${m.from}`;
    case "unbag": return `u${m.slot}`;
  }
}

export function decodeMove(x: string): Move {
  const n = (s: string) => Number(s);
  switch (x[0]) {
    case "t": return { k: "tap", at: n(x.slice(1)) };
    case "d": { const [a, b] = x.slice(1).split(">"); return { k: "drop", from: n(a), to: n(b) }; }
    case "v": return { k: "deliver", from: n(x.slice(1)) };
    case "b": return { k: "boost", b: x[1] === "f" ? "fireworks" : x[1] === "n" ? "needle" : "sweep", at: n(x.slice(2)) };
    case "s": return { k: "sell", from: n(x.slice(1)) };
    case "g": return { k: "bag", from: n(x.slice(1)) };
    default: return { k: "unbag", slot: n(x.slice(1)) };
  }
}

/**
 * The next move toward a win from `s` (the "I'm stuck" helper and QA replay): follows the level's stored, proven
 * solution while the board is on its path, otherwise searches from the current board. null = no win found.
 */
export function nextMove(def: LevelDef, s: State, stored?: string[]): Move | null {
  if (won(def, s)) return null;
  if (stored?.length) {
    const key = stateKey(s);
    let t = startState(def, s.level);
    for (const x of stored) {
      const m = decodeMove(x);
      if (stateKey(t) === key) return m;
      t = apply(def, t, m);
    }
  }
  const r = solve(def, s, 60, 120) ?? solve(def, s, 300, 160);
  return r?.moves[0] ?? null;
}
