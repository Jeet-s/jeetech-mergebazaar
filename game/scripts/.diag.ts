import { LEVELS } from "../src/game/levels";
import { makeSim } from "../src/game/sim";
import { boardSize } from "../src/game/engine";
import { encodeMove } from "../src/game/solver";
const id = Number(process.argv[2]), sp = Number(process.argv[3]);
const d = { ...LEVELS[id - 1], sparks: sp };
const sim = makeSim([d]);
let s = sim.start(0); const log: string[] = [];
for (let n = 0; n < 200 && sim.status(s) === "playing"; n++) {
  let best = -Infinity, pick = sim.moves(s)[0];
  for (const m of sim.moves(s)) { const t = sim.apply(s, m); const v = sim.status(t) === "won" ? Infinity : sim.progress(t); if (v > best) { best = v; pick = m; } }
  log.push(encodeMove(pick)); s = sim.apply(s, pick);
}
const { w } = boardSize(d);
console.log(sim.status(s), log.join(" "));
for (let r = 0; r < s.cells.length / w; r++) console.log(s.cells.slice(r * w, r * w + w).map((c) => c.padEnd(8)).join(""));
console.log("sparks", s.sparks, "need", s.need, "bag", s.bag);
