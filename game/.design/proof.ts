/// <reference types="node" />
// Print the fewest-Spark winning line of a level in readable form.  OV='{...}' npx tsx .design/proof.ts 44
import { apply, boardSize, startState, status, type LevelDef } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";
import { encodeMove, solveHard } from "../src/game/solver";
import { G, O } from "./try-g";
const id = Number(process.argv[2]);
const ov = process.env.OV ? (new Function("G", "O", "return (" + process.env.OV + ")")(G, O) as Partial<LevelDef>) : {};
const def = { ...LEVELS[id - 1], ...ov } as LevelDef;
const { w } = boardSize(def);
const rc = (i: number) => `(${Math.floor(i / w)},${i % w})`;
for (let sp = 0; sp <= 12; sp++) {
  const d = { ...def, sparks: sp };
  const r = solveHard(d, startState(d, id - 1), [80, 400, 1500]);
  if (!r) continue;
  let s = startState(d, id - 1);
  console.log(`L${id} min ${sp} Sparks, ${r.moves.length} moves`);
  for (const m of r.moves) {
    const before = s.cells.slice();
    s = apply(d, s, m);
    const e = encodeMove(m);
    let txt = e;
    if (m.k === "tap") txt += ` tap ${before[m.at]}${rc(m.at)}`;
    if (m.k === "drop") txt += ` ${before[m.from]}${rc(m.from)} -> ${before[m.to]}${rc(m.to)} = ${s.cells[m.to]}`;
    if (m.k === "deliver") txt += ` deliver ${before[m.from]}${rc(m.from)}`;
    if (m.k === "boost") txt += ` ${m.b} at ${m.at}`;
    const changed = s.cells.map((c, i) => (c !== before[i] && !(m.k === "drop" && (i === m.to || i === m.from)) ? `${rc(i)}${before[i]}→${c}` : "")).filter(Boolean);
    console.log("  ", txt, changed.length ? " | " + changed.join(" ") : "", ` sparks ${s.sparks}`);
  }
  console.log("  status", status(d, s));
  break;
}
