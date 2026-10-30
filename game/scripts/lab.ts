/// <reference types="node" />
/**
 * Level design lab: for each level, the solver's minimum Spark budget, the same solver facts the factory's level
 * report measures (BFS optimal / explored / trap at the level's budget, capped like levels-report.ts) and bot win
 * rates seeded exactly like scripts/playtest.ts (the full level list, so the start state — and the seed — match).
 *   npx tsx scripts/lab.ts 8 11 13:5      (13:5 = measure L13 at 5 Sparks)
 *   LAB_CURVE=0 skips the win-rate curve; LAB_FIRST=1 lists every first move and whether it stays winnable.
 */
import { startState, type LevelDef, type Move, type State } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { makeSim } from "../src/game/sim";
import { encodeMove, solveHard } from "../src/game/solver";
import { winRate } from "./bots";

const CAP = 40_000;
const skip = (k: string, v: unknown) => (k === "level" || k === "id" || k === "number" || k === "moves" ? undefined : v);
const keyOf = (s: unknown) => JSON.stringify(s, skip);

function shortest(sim: ReturnType<typeof makeSim>, from: State, cap = CAP) {
  if (sim.status(from) === "won") return { optimal: 0 as number | null, explored: 1, capped: false };
  const seen = new Set([keyOf(from)]);
  let frontier: State[] = [from];
  for (let depth = 1; frontier.length && seen.size < cap; depth++) {
    const next: State[] = [];
    for (const s of frontier) {
      if (sim.status(s) !== "playing") continue;
      for (const m of sim.moves(s)) {
        const t = sim.apply(s, m);
        const st = sim.status(t);
        if (st === "won") return { optimal: depth, explored: seen.size, capped: false };
        const k = keyOf(t);
        if (st === "lost" || seen.has(k)) continue;
        seen.add(k);
        next.push(t);
        if (seen.size >= cap) break;
      }
      if (seen.size >= cap) break;
    }
    frontier = next;
  }
  return { optimal: null, explored: seen.size, capped: seen.size >= cap };
}

function minSparks(def: LevelDef): number | null {
  const ok = (sp: number) => !!solveHard({ ...def, sparks: sp }, startState({ ...def, sparks: sp }, 0), [80, 400]);
  if (!ok(30)) return null;
  let lo = 0, hi = 30;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid + 1; }
  return hi;
}

const args = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).filter(Boolean);
for (const a of args) {
  const [idS, spS] = a.split(":");
  const id = Number(idS), i = id - 1;
  const base = LEVELS[i];
  const t0 = Date.now();
  const min = minSparks(base);
  const sp = spS ? Number(spS) : base.sparks;
  const defs = LEVELS.slice();
  defs[i] = { ...base, sparks: sp };
  const sim = makeSim(defs);
  const start = sim.start(i);
  const r = shortest(sim, start);
  const firsts = sim.moves(start);
  const sample = firsts.length <= 12 ? firsts : Array.from({ length: 12 }, (_, k) => firsts[Math.floor((k * firsts.length) / 12)]);
  let dead = 0, known = 0;
  const firstInfo: string[] = [];
  for (const m of process.env.LAB_FIRST ? firsts : sample) {
    const after = sim.apply(start, m);
    const st = sim.status(after);
    let res = "?";
    if (st === "won") res = "won";
    else if (st === "lost") res = "LOST";
    else { const q = shortest(sim, after, Math.floor(CAP / 4)); res = q.capped ? "?" : q.optimal === null ? "DEAD" : `ok${q.optimal}`; }
    if (sample.includes(m)) { if (res !== "?") known++; if (res === "DEAD" || res === "LOST") dead++; }
    firstInfo.push(`${encodeMove(m as Move)}=${res}`);
  }
  const sol = solveHard(defs[i], startState(defs[i], i));
  console.log(`L${id} ${base.role} "${base.title}" min ${min} @${sp}: optimal ${r.optimal ?? ">cap"} explored ${r.explored} branching ${firsts.length} trap ${known ? (dead / known).toFixed(2) : "?"} beam-sol ${sol ? sol.moves.length : "FAIL"}`);
  if (process.env.LAB_FIRST || dead) console.log(`   firsts: ${firstInfo.join(" ")}`);
  if (process.env.LAB_CURVE !== "0" && min !== null) {
    const pts: string[] = [];
    for (let b = min; b <= min + 9; b++) {
      const d2 = LEVELS.slice();
      d2[i] = { ...base, sparks: b };
      const s2 = makeSim(d2);
      const c = winRate(s2, s2.start(i), "casual", 150).rate, k = winRate(s2, s2.start(i), "skilled", 150).rate;
      pts.push(`${b}:${Math.round(c * 100)}/${Math.round(k * 100)}`);
      if (c >= 0.97 && k >= 0.97) break;
    }
    console.log(`   curve ${pts.join(" ")}`);
  }
  console.log(`   (${Date.now() - t0} ms)`);
}
