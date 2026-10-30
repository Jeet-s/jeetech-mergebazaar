/// <reference types="node" />
/**
 * Whole-set Spark-budget optimizer (all 64 levels, after `tune-levels.ts measure`). Same idea as tune-optimize.ts
 * (which only searches L40+), with every QA playtest gate as a hard constraint (with a margin) and design taste as
 * the soft score: teach levels that let the idea land, breathers/story beats lighter than their neighbours, bosses
 * and finales as dips, a real skill gap, no budget where the bots' skilled player does worse than the casual one.
 * Pins (TUNE_PIN="8:5,26:5") fix a level's budget (a designed slack, e.g. the review asked for it).
 *   npx tsx scripts/tune-all.ts            → prints the curve; writes src/game/levels-tuned.json when all gates pass
 * Then `npx tsx scripts/tune-levels.ts solve` so the stored solutions match the budgets.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { LEVELS } from "../src/game/levels";

type Point = { sp: number; casual: number; skilled: number };
const curves = JSON.parse(readFileSync(path.join(__dirname, ".tune-curves.json"), "utf8")) as Record<string, Point[]>;
const tunedFile = path.join(__dirname, "../src/game/levels-tuned.json");
const tuned = JSON.parse(readFileSync(tunedFile, "utf8")) as Record<string, number>;
const N = LEVELS.length, third = Math.floor(N / 3);
const pairs = (v?: string) => (v ?? "").split(",").filter(Boolean).map((x: string) => x.split(":").map(Number) as [number, number]);
const pins = new Map<number, number>(pairs(process.env.TUNE_PIN));
const minSp = new Map<number, number>(pairs(process.env.TUNE_MIN));
const opts = LEVELS.map((l) => {
  let o = curves[String(l.id)] ?? [];
  if (pins.has(l.id)) {
    const want = pins.get(l.id)!, last = o[o.length - 1];
    // Curves stop once both personas win ≥ 97%: a pin above that reuses the saturated point.
    o = want > (last?.sp ?? -1) && last && last.casual >= 0.97 ? [{ ...last, sp: want }] : o.filter((p) => p.sp === want);
  }
  if (minSp.has(l.id)) o = o.filter((p) => p.sp >= minSp.get(l.id)!);
  // Never a budget where the bots' skilled player mostly loses or does worse than the casual one: that is the bots'
  // greedy look-ahead failing (e.g. no Spark to recover one merge landed away from a jar), not a fair difficulty.
  const sane = o.filter((p) => p.skilled >= 0.6 && p.skilled >= p.casual - 0.05);
  if (sane.length) o = sane;
  if (!o.length) throw new Error(`L${l.id}: no curve point (pin ${pins.get(l.id)})`);
  return o;
});
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

let seed = 20261028;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};

export function gateReport(c: number[], k: number[]): string[] {
  const out: string[] = [];
  if (c.slice(0, 3).some((v) => v < 0.8)) out.push("onboarding");
  c.forEach((v, i) => { if (v < 0.1 && k[i] < 0.6) out.push(`wall L${i + 1}`); });
  const late = mean(c.slice(-third)), mid = mean(c.slice(third, N - third)), lateK = mean(k.slice(-third));
  if (late > 0.649) out.push(`late ${late.toFixed(3)}`);
  if (late < 0.33) out.push("late too hard");
  if (lateK < 0.55 || lateK > 0.95) out.push(`late skilled ${lateK.toFixed(3)}`);
  if (mid < 0.53 || mid > 0.84) out.push(`mid ${mid.toFixed(3)}`);
  let run = 0;
  c.forEach((v, i) => { run = i >= 5 && v >= 0.9 ? run + 1 : 0; if (run > 2) out.push(`easy run L${i + 1}`); });
  const share = c.slice(5).filter((v) => v >= 0.9).length / (N - 5);
  if (share > 0.24) out.push(`easy share ${share.toFixed(3)}`);
  for (let i = 3; i < N; i++) { const d = mean(c.slice(i - 3, i)) - c[i]; if (d > 0.345) out.push(`spike L${i + 1} ${d.toFixed(2)}`); }
  const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r: number[] = []; o.forEach(([, i], j) => (r[i] = j)); return r; };
  const rx = rank(c.map((_, i) => i)), ry = rank(c);
  const rho = 1 - (6 * rx.reduce((a, v, i) => a + (v - ry[i]) ** 2, 0)) / (N * (N * N - 1));
  if (rho > -0.52) out.push(`rho ${rho.toFixed(3)}`);
  return out;
}

function gates(c: number[], k: number[]): number {
  let bad = 0;
  if (c.slice(0, 3).some((v) => v < 0.8)) bad += 5;
  c.forEach((v, i) => { if (v < 0.1 && k[i] < 0.6) bad += 5; });
  const late = mean(c.slice(-third)), mid = mean(c.slice(third, N - third)), lateK = mean(k.slice(-third));
  if (late > 0.649) bad += 1 + (late - 0.649) * 50;
  if (late < 0.33) bad += 3;
  if (lateK < 0.55) bad += 3;
  if (lateK > 0.95) bad += 1;
  if (mid < 0.53) bad += 1 + (0.53 - mid) * 50;
  if (mid > 0.84) bad += 1 + (mid - 0.84) * 50;
  let run = 0;
  c.forEach((v, i) => { run = i >= 5 && v >= 0.9 ? run + 1 : 0; if (run > 2) bad += 2; });
  const share = c.slice(5).filter((v) => v >= 0.9).length / (N - 5);
  if (share > 0.24) bad += 1 + (share - 0.24) * 30;
  for (let i = 3; i < N; i++) { const d = mean(c.slice(i - 3, i)) - c[i]; if (d > 0.345) bad += 1 + d * 5; }
  const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r: number[] = []; o.forEach(([, i], j) => (r[i] = j)); return r; };
  const rx = rank(c.map((_, i) => i)), ry = rank(c);
  const rho = 1 - (6 * rx.reduce((a, v, i) => a + (v - ry[i]) ** 2, 0)) / (N * (N * N - 1));
  if (rho > -0.52) bad += 1 + (rho + 0.52) * 10;
  return bad;
}

/** Design taste (soft): the role decides what a good win rate looks like. */
function taste(i: number, p: Point, c: number[]): number {
  const def = LEVELS[i], role = def.role;
  let s = 0;
  if (role === "teach" && p.casual < 0.8) s += (0.8 - p.casual) * 3;
  if ((role === "breather" || role === "story") && p.casual < 0.7) s += (0.7 - p.casual) * 3;
  if (role === "breather" && i > 0 && i < N - 1 && p.casual < Math.max(c[i - 1], c[i + 1])) s += 0.3; // lighter than a neighbour
  if ((role === "boss" || role === "finale") && p.casual > 0.75) s += (p.casual - 0.75) * 1.5;
  if (p.skilled < p.casual - 0.02) s += 1;
  if (p.skilled < 0.75) s += (0.75 - p.skilled) * 3;
  if (p.casual < 0.4) s += (0.4 - p.casual) * 3;
  if (p.casual < 0.85 && p.skilled - p.casual < 0.12) s += (0.12 - (p.skilled - p.casual)) * 1.5;
  const sp0 = opts[i][0].sp;
  if (p.sp === sp0 && def.id <= 20 && sp0 > 0) s += 0.15; // zero spare Sparks early = harsh
  return s + 0.002 * p.sp;
}

let pick = opts.map((o, i) => Math.max(0, o.findIndex((p) => p.sp === tuned[String(i + 1)])));
const total = (pk: number[]) => {
  const ps = pk.map((j, i) => opts[i][j]);
  const c = ps.map((p) => p.casual), k = ps.map((p) => p.skilled);
  return gates(c, k) * 10 + ps.reduce((a, p, i) => a + taste(i, p, c), 0);
};
let best = total(pick), bestPick = pick.slice();
for (let restart = 0; restart < 40; restart++) {
  pick = bestPick.slice();
  let cur = best;
  for (let it = 0; it < 25000; it++) {
    const i = Math.floor(rand() * N), j = Math.floor(rand() * opts[i].length);
    if (j === pick[i]) continue;
    const old = pick[i];
    pick[i] = j;
    const v = total(pick);
    if (v <= cur || rand() < 0.003) { cur = v; if (v < best) { best = v; bestPick = pick.slice(); } } else pick[i] = old;
  }
}
const ps = bestPick.map((j, i) => opts[i][j]);
const c = ps.map((p) => p.casual), k = ps.map((p) => p.skilled);
const miss = gateReport(c, k);
console.log(`gates: ${miss.join("; ") || "all pass"} | early ${mean(c.slice(0, third)).toFixed(3)} mid ${mean(c.slice(third, N - third)).toFixed(3)} late ${mean(c.slice(-third)).toFixed(3)} lateSkilled ${mean(k.slice(-third)).toFixed(3)} easy ${c.slice(5).filter((v) => v >= 0.9).length}`);
ps.forEach((p, i) => console.log(`L${i + 1} ${LEVELS[i].role.padEnd(8)} ${String(p.sp).padStart(2)} Sparks ${Math.round(p.casual * 100)}/${Math.round(p.skilled * 100)}${p.sp !== tuned[String(i + 1)] ? `  (was ${tuned[String(i + 1)]})` : ""}`));
if (!miss.length && process.env.TUNE_WRITE !== "0") {
  const out: Record<string, number> = {};
  ps.forEach((p, i) => (out[String(i + 1)] = p.sp));
  writeFileSync(tunedFile, JSON.stringify(out, null, 1));
  console.log("written src/game/levels-tuned.json");
} else console.log("not written");
