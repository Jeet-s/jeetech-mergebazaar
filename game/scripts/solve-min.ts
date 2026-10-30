/// <reference types="node" />
/**
 * Stores each level's proof line (src/game/solutions.json) as a FEWEST-SPARKS win: the solver runs at the level's
 * minimum budget, and the line is replayed at the real budget (more Sparks never make a move illegal). So the
 * "x/N Sparks used" in describe() is the true cost of the clean line, and the spare it shows is real.
 *   npx tsx scripts/solve-min.ts [levels...]      (SOL_OUT=file for parallel runs)
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { apply, startState, status } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { decodeMove, encodeMove, solveHard } from "../src/game/solver";

const file = process.env.SOL_OUT ?? path.join(__dirname, "../src/game/solutions.json");
const read = () => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } };
const ids = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).map(Number).filter(Boolean);
for (const id of ids.length ? ids : LEVELS.map((l) => l.id)) {
  const def = LEVELS[id - 1];
  const at = (sp: number) => solveHard({ ...def, sparks: sp }, startState({ ...def, sparks: sp }, id - 1), [80, 400]);
  let best: string[] | null = null, used = def.sparks;
  for (let sp = 0; sp <= def.sparks; sp++) {
    const r = at(sp);
    if (!r) continue;
    const mv = r.moves.map(encodeMove);
    let s = startState(def, id - 1);
    for (const x of mv) s = apply(def, s, decodeMove(x));
    if (status(def, s) === "won") { best = mv; used = def.sparks - s.sparks; break; }
  }
  if (!best) { const r = solveHard(def, startState(def, id - 1)); if (!r) throw new Error(`L${id}: unsolvable`); best = r.moves.map(encodeMove); }
  const sols = read();
  sols[String(id)] = best;
  writeFileSync(file, JSON.stringify(sols));
  console.log(`L${id}: ${best.length} moves, ${used}/${def.sparks} Sparks`);
}
