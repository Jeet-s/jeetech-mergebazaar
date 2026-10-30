/// <reference types="node" />
/**
 * Bazaar Day proof (`npx tsx scripts/check-daily.ts`): every daily board (src/game/daily.ts) parses, is winnable
 * through the real engine with its Spark budget (beam-search solver, replayed move by move), and reports the Sparks
 * the proof spends (par) so budgets keep some slack. `--write` stores the proofs in src/game/daily-solutions.json
 * (the in-game helper and the efficiency star follow them). Exit 1 if any board fails.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { apply, legal, parseBoard, startState, status } from "../src/game/engine";
import { encodeMove, solveHard } from "../src/game/solver";
import { DAILY_LEVELS, dailyKey, dailyLevel } from "../src/game/daily";

let bad = 0;
const proofs: Record<string, string[]> = {};
for (const def of DAILY_LEVELS) {
  try {
    const { w, h } = parseBoard(def);
    const s0 = startState(def, def.id - 1);
    const r = solveHard(def, s0, [60, 300, 1500]);
    if (!r) throw new Error("no solution found");
    let s = s0;
    for (const m of r.moves) {
      if (!legal(def, s, m)) throw new Error(`illegal move in proof: ${encodeMove(m)}`);
      s = apply(def, s, m);
    }
    if (status(def, s) !== "won") throw new Error("proof does not win");
    const par = def.sparks - s.sparks;
    // A board must not be winnable with 0 Spark taps if it has generators to teach budgeting (no free boards).
    proofs[String(def.id)] = r.moves.map(encodeMove);
    console.log(`D${def.id} ${w}x${h} "${def.title}": ${r.moves.length} moves, spends ${par}/${def.sparks} Sparks, branching ${r.branching.toFixed(1)}`);
  } catch (e) {
    bad++;
    console.log(`D${def.id} "${def.title}": FAIL ${(e as Error).message}`);
  }
}
const days = Array.from({ length: 14 }, (_, i) => dailyLevel(new Date(2026, 9, 28 + i)).id);
console.log(`next 14 days from ${dailyKey(new Date(2026, 9, 28))}: ${days.join(" ")}`);
if (process.argv.includes("--write") && !bad) {
  writeFileSync(join(__dirname, "..", "src", "game", "daily-solutions.json"), JSON.stringify(proofs) + "\n");
  console.log("wrote src/game/daily-solutions.json");
}
console.log(JSON.stringify({ boards: DAILY_LEVELS.length, solvable: DAILY_LEVELS.length - bad }));
process.exit(bad ? 1 : 0);
