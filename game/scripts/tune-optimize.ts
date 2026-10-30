/// <reference types="node" />
/**
 * Spark-budget optimizer (run after `tune-levels.ts measure`, instead of `pick`). The measured win-rate curves have
 * sharp cliffs (one spare Spark often moves casual players from 20% to 85%), so the greedy pick can't hold every
 * pacing rule at once. This searches budgets for L40+ (seeded, reproducible) to satisfy the QA pacing gates
 * (with a margin) while preferring levels where skilled players clearly beat casual ones, breathers and story beats
 * that stay light, and no three hard levels in a row. Writes src/game/levels-tuned.json; then run
 * `tune-levels.ts solve` so the stored solutions match the budgets.
 *   npx tsx scripts/tune-optimize.ts
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { LEVELS } from "../src/game/levels";

type Point = { sp: number; casual: number; skilled: number };
const curves = JSON.parse(readFileSync(path.join(__dirname, ".tune-curves.json"), "utf8")) as Record<string, Point[]>;
const tunedFile = path.join(__dirname, "../src/game/levels-tuned.json");
const tuned = JSON.parse(readFileSync(tunedFile, "utf8")) as Record<string, number>;
const N = LEVELS.length, third = Math.floor(N / 3), FROM = 39;
const opts = LEVELS.map((l) => curves[String(l.id)] ?? []);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

let seed = 20261027;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};

/** How badly a casual/skilled curve breaks QA's pacing gates (0 = all pass with margin). */
function gates(c: number[], k: number[]): number {
  let bad = 0;
  if (c.slice(0, 3).some((v) => v < 0.8)) bad++;
  c.forEach((v, i) => { if (v < 0.1 && k[i] < 0.6) bad++; });
  const late = mean(c.slice(-third)), mid = mean(c.slice(third, N - third));
  if (late > 0.645) bad += (late - 0.645) * 50;
  if (mean(k.slice(-third)) < 0.6) bad++;
  if (mid < 0.53 || mid > 0.82) bad++;
  let run = 0;
  c.forEach((v, i) => { run = i >= 5 && v >= 0.9 ? run + 1 : 0; if (run > 2) bad++; });
  if (c.slice(5).filter((v) => v >= 0.9).length / (N - 5) > 0.24) bad++;
  for (let i = 2; i < N; i++) if (c[i] < 0.5 && c[i - 1] < 0.5 && c[i - 2] < 0.5) bad += 0.5;
  for (let i = 3; i < N; i++) { const d = mean(c.slice(i - 3, i)) - c[i]; if (d > 0.32) bad += 1 + d; }
  const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r: number[] = []; o.forEach(([, i], j) => (r[i] = j)); return r; };
  const rx = rank(c.map((_, i) => i)), ry = rank(c);
  const rho = 1 - (6 * rx.reduce((a, v, i) => a + (v - ry[i]) ** 2, 0)) / (N * (N * N - 1));
  if (rho > -0.55) bad += 1 + (rho + 0.55) * 5;
  return bad;
}

/** Design taste: light breathers, a real skill gap, no hopeless levels, budgets near the need. */
function taste(i: number, p: Point): number {
  const role = LEVELS[i].role;
  let s = 0;
  if ((role === "breather" || role === "story" || role === "teach") && p.casual < 0.6) s += (0.6 - p.casual) * 2;
  if ((role === "breather" || role === "story") && p.casual < 0.6) s += 3;
  if (p.skilled < p.casual - 0.02) s += 0.5;
  if (p.casual < 0.8 && p.skilled - p.casual < 0.15) s += 0.6 * (0.15 - (p.skilled - p.casual)) + 0.1;
  if (p.skilled < 0.7) s += (0.7 - p.skilled) * 1.5;
  if (p.casual < 0.45) s += (0.45 - p.casual) * 2;
  return s + 0.003 * p.sp;
}

let pick = opts.map((o, i) => Math.max(0, o.findIndex((p) => p.sp === tuned[String(i + 1)])));
const total = (pk: number[]) => {
  const ps = pk.map((j, i) => opts[i][j]);
  return gates(ps.map((p) => p.casual), ps.map((p) => p.skilled)) * 10 + ps.reduce((a, p, i) => a + taste(i, p), 0);
};
let best = total(pick), bestPick = pick.slice();
for (let restart = 0; restart < 30; restart++) {
  pick = bestPick.slice();
  let cur = best;
  for (let it = 0; it < 20000; it++) {
    const i = FROM + Math.floor(rand() * (N - FROM)), j = Math.floor(rand() * opts[i].length);
    if (j === pick[i]) continue;
    const old = pick[i];
    pick[i] = j;
    const v = total(pick);
    if (v <= cur || rand() < 0.002) { cur = v; if (v < best) { best = v; bestPick = pick.slice(); } } else pick[i] = old;
  }
}
const ps = bestPick.map((j, i) => opts[i][j]);
const out: Record<string, number> = {};
ps.forEach((p, i) => (out[String(i + 1)] = p.sp));
const g = gates(ps.map((p) => p.casual), ps.map((p) => p.skilled));
console.log(`pacing gate misses ${g.toFixed(3)}, late casual ${mean(ps.slice(-third).map((p) => p.casual)).toFixed(3)}, mid casual ${mean(ps.slice(third, N - third).map((p) => p.casual)).toFixed(3)}`);
ps.forEach((p, i) => { if (p.sp !== tuned[String(i + 1)]) console.log(`L${i + 1}: ${tuned[String(i + 1)]} → ${p.sp} Sparks (${p.casual.toFixed(2)}/${p.skilled.toFixed(2)})`); });
if (g === 0) writeFileSync(tunedFile, JSON.stringify(out, null, 1));
else console.log("not written: pacing gates still miss");
