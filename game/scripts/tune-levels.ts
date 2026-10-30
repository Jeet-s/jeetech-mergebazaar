/// <reference types="node" />
/**
 * Level pacing tuner for Merge Bazaar. Boards, orders and blockers are handcrafted (src/game/levels.ts); the only
 * knob tuned here is each level's Spark budget.
 *   Phase 1 (measure): for each level find the smallest budget the solver can win with, then playtest budgets
 *     upward with the SAME bots and seeds the factory's QA playtest uses → a win-rate curve per level
 *     (scripts/.tune-curves.json; levels can be measured in parallel processes).
 *   Phase 2 (pick): walk the levels in order and pick the budget nearest the pacing curve (teach gentle, boss dip,
 *     breather after) while keeping the pacing rules: never 3 too-easy levels in a row, no spike over the three
 *     before, late levels winnable by skilled players. Writes src/game/levels-tuned.json and stores each level's
 *     proven solution at its final budget in src/game/solutions.json.
 *   npx tsx scripts/tune-levels.ts measure [levels...]  →  pick  →  solve [levels...]
 * The shipped budgets come from `npx tsx scripts/tune-optimize.ts` (run after pick): the curves have one-Spark cliffs,
 * so a seeded search over L40+ holds every QA pacing gate at once; then `solve` again.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { startState, type LevelDef } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { makeSim } from "../src/game/sim";
import { encodeMove, solveHard } from "../src/game/solver";
import { winRate } from "./bots";

const TRIALS = 150; // = scripts/playtest.ts, so tuned and tested numbers match exactly
const N = LEVELS.length;
const curvesFile = process.env.TUNE_CURVES ?? path.join(__dirname, ".tune-curves.json");
const read = (f: string) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return {}; } };
type Point = { sp: number; casual: number; skilled: number };

/** Target casual first-try win rate for level n. */
export function target(def: LevelDef): number {
  const n = def.id;
  if (n <= 3) return 0.97;
  if (n <= 5) return 0.93;
  const base = 0.84 - 0.4 * ((n - 6) / (N - 6));
  const adj: Record<string, number> = { teach: 0.06, practise: 0, twist: -0.06, combine: -0.08, boss: -0.15, breather: 0.08, story: 0.04, finale: -0.1 };
  return Math.max(0.34, Math.min(0.92, base + (adj[def.role] ?? 0)));
}

function minSparks(def: LevelDef): number {
  const ok = (sp: number) => !!solveHard({ ...def, sparks: sp }, startState({ ...def, sparks: sp }, 0), [80, 400]);
  let hi = 40;
  if (!ok(hi)) throw new Error(`L${def.id}: unsolvable even with ${hi} Sparks`);
  let lo = 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok(mid)) hi = mid;
    else lo = mid + 1;
  }
  return hi;
}

function measure(ids: number[]) {
  for (const id of ids) {
    const i = id - 1;
    const def = LEVELS[i];
    const min = minSparks(def);
    const pts: Point[] = [];
    for (let sp = min; sp <= min + 16; sp++) {
      const defs = LEVELS.map((d) => d);
      defs[i] = { ...def, sparks: sp };
      const sim = makeSim(defs);
      const casual = winRate(sim, sim.start(i), "casual", TRIALS).rate;
      const skilled = winRate(sim, sim.start(i), "skilled", TRIALS).rate;
      pts.push({ sp, casual, skilled });
      if (casual >= 0.97 && skilled >= 0.97) break;
    }
    const curves = read(curvesFile);
    curves[String(id)] = pts;
    writeFileSync(curvesFile, JSON.stringify(curves));
    console.log(`L${id} min ${min}: ${pts.map((p) => `${p.sp}:${p.casual.toFixed(2)}/${p.skilled.toFixed(2)}`).join(" ")}`);
  }
}

function pick() {
  const curves = read(curvesFile) as Record<string, Point[]>;
  const chosen: Point[] = [];
  const tuned: Record<string, number> = {};
  const lateFrom = N - Math.floor(N / 3);
  for (const def of LEVELS) {
    const i = def.id - 1;
    const pts = curves[String(def.id)];
    if (!pts?.length) throw new Error(`L${def.id}: not measured — run "measure" first`);
    const want = target(def);
    const prev = chosen.slice(-3).map((p) => p.casual);
    const prevMean = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 1;
    const run2 = i >= 7 && chosen.slice(-2).every((p) => p.casual >= 0.9);
    const score = (p: Point) => {
      let s = Math.abs(p.casual - want);
      if (run2 && p.casual >= 0.9) s += 1; // never three too-easy levels in a row
      if (i >= 5 && p.casual >= 0.9 && def.role !== "breather" && def.role !== "teach" && def.role !== "story") s += 0.05;
      if (prevMean - p.casual > 0.3) s += 1; // no spike
      if (p.casual < 0.12) s += 1; // never a wall
      if (i >= lateFrom && p.skilled < 0.3) s += 0.2; // late levels must stay beatable for good players
      const wantSkilled = def.role === "boss" || def.role === "finale" ? 0.55 : i >= lateFrom ? 0.65 : 0.85; // good players should rarely fail
      if (p.skilled < wantSkilled) s += 0.5 * (wantSkilled - p.skilled);
      if (p.skilled < p.casual - 0.15) s += 0.1;
      if (i >= lateFrom && p.casual > 0.75) s += 0.3 * (p.casual - 0.75); // the last third must make players fail sometimes
      if (def.role === "teach" && p.casual < 0.8) s += 0.5 * (0.8 - p.casual); // a teach level must let the idea land
      s += 0.004 * Math.max(0, p.sp - (2 * pts[0].sp + 3)); // budgets far above the need make the efficiency star meaningless
      if (def.id <= 36 && p.sp === pts[0].sp && pts[0].sp > 0) s += 0.12; // zero spare Sparks = every wasted tap is fatal: unfair early
      return s + p.sp * 0.001; // tie → fewer Sparks
    };
    const best = [...pts].sort((a, b) => score(a) - score(b))[0];
    chosen.push(best);
    tuned[String(def.id)] = best.sp;
  }
  repair(curves, chosen, tuned);
  for (const def of LEVELS) {
    const p = chosen[def.id - 1];
    console.log(`L${def.id} ${def.role.padEnd(9)} ${p.sp} Sparks: casual ${p.casual.toFixed(2)} (target ${target(def).toFixed(2)}) skilled ${p.skilled.toFixed(2)}`);
  }
  const c = chosen.map((p) => p.casual), k = chosen.map((p) => p.skilled), t = Math.floor(N / 3);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`mid casual ${mean(c.slice(t, N - t)).toFixed(3)}, late casual ${mean(c.slice(-t)).toFixed(3)}, late skilled ${mean(k.slice(-t)).toFixed(3)}, problems: ${pacingProblems(c, k).join("; ") || "none"}`);
  writeFileSync(path.join(__dirname, "../src/game/levels-tuned.json"), JSON.stringify(tuned, null, 1));
}

/** QA's pacing rules on a casual/skilled win-rate curve (the same thresholds the factory's playtest gate uses). */
function pacingProblems(c: number[], k: number[]): string[] {
  const out: string[] = [];
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const t = Math.max(3, Math.floor(c.length / 3));
  if (c.slice(0, 3).some((v) => v < 0.8)) out.push("onboarding");
  c.forEach((v, i) => v < 0.1 && k[i] < 0.6 && out.push(`wall L${i + 1}`));
  const late = mean(c.slice(-t)), mid = mean(c.slice(t, c.length - t));
  if (late > 0.62) out.push(`late casual ${late.toFixed(2)}`); // QA bar 0.65, kept with a margin
  if (late < 0.33) out.push("late too hard");
  if (mean(k.slice(-t)) < 0.55) out.push("late skilled");
  if (mid < 0.53 || mid > 0.82) out.push(`mid ${mid.toFixed(2)}`);
  let run = 0;
  c.forEach((v, i) => { run = i >= 5 && v >= 0.9 ? run + 1 : 0; if (run > 2) out.push(`easy run L${i + 1}`); });
  if (c.slice(5).filter((v) => v >= 0.9).length / (c.length - 5) > 0.24) out.push("too many easy");
  for (let i = 3; i < c.length; i++) if (mean(c.slice(i - 3, i)) - c[i] > 0.33) out.push(`spike L${i + 1}`);
  return out;
}

/** After the greedy pick: while the last third is too easy, take the budget step that lowers it most per unit of
 * distance from the pacing target without breaking any other pacing rule. */
function repair(curves: Record<string, Point[]>, chosen: Point[], tuned: Record<string, number>) {
  const t = Math.floor(N / 3);
  for (let guard = 0; guard < 60; guard++) {
    const c = chosen.map((p) => p.casual), k = chosen.map((p) => p.skilled);
    const late = c.slice(-t).reduce((a, b) => a + b, 0) / t;
    if (late <= 0.6) return;
    const base = pacingProblems(c, k).filter((p) => !p.startsWith("late casual")).length;
    let best: { i: number; p: Point; v: number } | null = null;
    for (let i = N - t; i < N; i++) {
      const def = LEVELS[i];
      const floor = def.role === "boss" || def.role === "finale" ? 0.55 : 0.6;
      for (const p of curves[String(def.id)]) {
        if (p.casual >= chosen[i].casual - 0.02 || p.skilled < floor) continue;
        const c2 = c.slice(), k2 = k.slice();
        c2[i] = p.casual; k2[i] = p.skilled;
        if (pacingProblems(c2, k2).filter((x) => !x.startsWith("late casual")).length > base) continue;
        const gain = chosen[i].casual - p.casual;
        const cost = Math.abs(p.casual - target(def)) - Math.abs(chosen[i].casual - target(def)) + 0.05;
        const v = gain / Math.max(0.02, cost);
        if (!best || v > best.v) best = { i, p, v };
      }
    }
    if (!best) return;
    chosen[best.i] = best.p;
    tuned[String(best.i + 1)] = best.p.sp;
  }
}

/** Store each level's proven solution at its tuned budget (src/game/solutions.json, or TUNE_SOL for parallel runs). */
function solveAll(ids: number[]) {
  const file = process.env.TUNE_SOL ?? path.join(__dirname, "../src/game/solutions.json");
  for (const id of ids) {
    const def = LEVELS[id - 1];
    const sol = solveHard(def, startState(def, id - 1));
    if (!sol) throw new Error(`L${id}: no solution at ${def.sparks} Sparks`);
    const sols = read(file);
    sols[String(id)] = sol.moves.map(encodeMove);
    writeFileSync(file, JSON.stringify(sols));
    console.log(`L${id}: ${sol.moves.length} moves`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const ids = rest.flatMap((a) => a.split(/\s+/)).map(Number).filter(Boolean);
if (cmd === "measure") measure(ids.length ? ids : LEVELS.map((l) => l.id));
else if (cmd === "pick") pick();
else if (cmd === "solve") solveAll(ids.length ? ids : LEVELS.map((l) => l.id));
else console.log("usage: tune-levels.ts measure [levels...] | pick");
