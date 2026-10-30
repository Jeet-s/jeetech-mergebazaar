/// <reference types="node" />
/**
 * Level design workbench: solve each level on the real engine (stores the solution in
 * src/game/solutions.json), find the smallest Spark budget the solver wins with, and measure bot win rates.
 *   npx tsx scripts/analyze.ts [levelNumbers...]
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { startState, type LevelDef } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { makeSim } from "../src/game/sim";
import { encodeMove, solveHard } from "../src/game/solver";
import { winRate } from "./bots";

const pick = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).map(Number).filter(Boolean);
const ids = pick.length ? pick : LEVELS.map((l) => l.id);
const BEAMS = [60, 300];

export function minSparks(def: LevelDef, hi = 30): number | null {
  const ok = (sp: number) => !!solveHard({ ...def, sparks: sp }, startState({ ...def, sparks: sp }, 0), BEAMS);
  if (!ok(hi)) return null;
  let lo = 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok(mid)) hi = mid;
    else lo = mid + 1;
  }
  return hi;
}

for (const id of ids) {
  const def = LEVELS[id - 1];
  const t0 = Date.now();
  const min = minSparks(def);
  const at = (sp: number) => {
    const d = { ...def, sparks: sp };
    const s = makeSim([d]);
    return ["casual", "skilled"].map((p) => winRate(s, s.start(0), p as "casual", 60).rate.toFixed(2)).join("/");
  };
  let sol = "FAIL";
  if (min !== null) {
    const d = { ...def, sparks: min };
    const r = solveHard(d, startState(d, 0), BEAMS);
    if (r) sol = `${r.moves.length} br ${r.branching.toFixed(1)}`;
  }
  const rates = min === null ? "-" : [0, 2, 4, 7, 10].map((k) => `+${k}:${at(min + k)}`).join(" ");
  console.log(`L${id} ${def.role.padEnd(8)} ${def.title.padEnd(22)} sol ${sol} min ${min} | ${rates} (${Date.now() - t0}ms)`);
}
