/// <reference types="node" />
/**
 * Level validation (`npm run validate`): loads EVERY level through the real engine (src/game/engine.ts), PROVES it
 * winnable by replaying a solution move by move through the engine (each move must be legal; the last state must
 * be a win) — the stored solution from src/game/solutions.json (found by the solver when the level was tuned), or
 * a fresh beam-search solution if none is stored / it no longer fits — and measures difficulty from the solution:
 *   difficulty = solution moves × log2(1 + average choices per turn) × (0.5 + share of the Spark budget the
 *                solution needs) × (0.4 + 0.2 × concepts in play: mechanics + item chains/crafted items)
 *                × (1 + 0.15 × mechanics learned so far)
 *   — longer plans, more choices, tighter budgets and more ideas to juggle at once are harder.
 * Final stdout line: {"levels": N, "solvable": N, "difficulty": [d1..dN]}. Exit 1 if anything fails.
 */
import { apply, coreMoves, legal, parseBoard, startState, status, type Move } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { decodeMove, solveHard } from "../src/game/solver";
import stored from "../src/game/solutions.json";

const SOLUTIONS = stored as Record<string, string[]>;

let ok = 0;
const difficulty: number[] = [];
const problems: string[] = [];
const starts = new Set<string>();
const known = new Set<string>();
for (const def of LEVELS) {
  try {
    parseBoard(def);
    const key = JSON.stringify([def.board, def.orders, def.gens]);
    if (starts.has(key)) problems.push(`L${def.id}: duplicate of an earlier level`);
    starts.add(key);
    const s0 = startState(def, def.id - 1);
    const replay = (moves: Move[]) => {
      let s = s0, ok = true, branch = 0;
      for (const m of moves) {
        if (!legal(def, s, m)) { ok = false; break; }
        branch += coreMoves(def, s).length;
        s = apply(def, s, m);
      }
      return { s, fine: ok && status(def, s) === "won", branching: branch / Math.max(1, moves.length) };
    };
    let r: { moves: Move[]; branching: number } | null = SOLUTIONS[String(def.id)] ? { moves: SOLUTIONS[String(def.id)].map(decodeMove), branching: 0 } : null;
    let play = r ? replay(r.moves) : null;
    if (!play?.fine) {
      r = solveHard(def, s0);
      play = r ? replay(r.moves) : null;
    }
    if (!r || !play) {
      problems.push(`L${def.id}: no solution found`);
      difficulty.push(0);
      continue;
    }
    r.branching = play.branching;
    const s = play.s;
    const fine = play.fine;
    if (!fine) {
      problems.push(`L${def.id}: replay of the solution did not win`);
      difficulty.push(0);
      continue;
    }
    ok++;
    const used = def.sparks - s.sparks;
    // Concepts the player must hold at once: mechanics in play + distinct item chains / crafted items on the board path.
    const kinds = new Set<string>();
    for (const o of def.orders) kinds.add(o.item.length === 2 && /[a-z]/.test(o.item[1]) ? o.item : o.item[0]);
    for (const g of def.gens) for (const x of g.seq) kinds.add(x[0]);
    const concepts = def.mechanics.length + kinds.size;
    // Rules the player knows by now (every mechanic introduced so far is a possibility to consider each turn).
    for (const m of def.mechanics) known.add(m);
    const d = r.moves.length * Math.log2(1 + r.branching) * (0.5 + used / Math.max(1, def.sparks)) * (0.4 + 0.2 * concepts) * (1 + 0.15 * known.size);
    difficulty.push(Number(d.toFixed(1)));
    console.log(`L${def.id} ${def.title}: ${r.moves.length} moves, ${used}/${def.sparks} Sparks, ~${r.branching.toFixed(1)} choices → ${d.toFixed(1)}`);
  } catch (e) {
    problems.push(`L${def.id}: ${e instanceof Error ? e.message : e}`);
    difficulty.push(0);
  }
}
const third = Math.max(3, Math.round(LEVELS.length * 0.2)); // = QA's early/late window
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const early = mean(difficulty.slice(0, third)), late = mean(difficulty.slice(-third));
console.log(`early mean ${early.toFixed(1)}, late mean ${late.toFixed(1)} (x${(late / Math.max(0.1, early)).toFixed(1)})`);
for (const p of problems) console.log(`PROBLEM ${p}`);
console.log(JSON.stringify({ levels: LEVELS.length, solvable: ok, difficulty }));
process.exit(ok === LEVELS.length && LEVELS.length >= 30 && !problems.length ? 0 : 1);
