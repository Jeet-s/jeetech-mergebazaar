/// <reference types="node" />
import { readFileSync } from "fs";
import { LEVELS } from "../src/game/levels";
const j = JSON.parse(readFileSync(process.argv[2], "utf8").trim().split("\n").pop()!);
const c = j.personas.casual as number[], k = j.personas.skilled as number[];
for (const l of LEVELS) console.log(`L${l.id} ${l.role.padEnd(8)} sp${l.sparks} c${Math.round(c[l.id-1]*100)} k${Math.round(k[l.id-1]*100)} ${l.title}`);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("late43", mean(c.slice(42)).toFixed(3), "late44", mean(c.slice(43)).toFixed(3), "mid", mean(c.slice(21,42)).toFixed(3), "lateSk", mean(k.slice(43)).toFixed(3));
console.log("easy>=.9 after L5:", c.slice(5).filter(x=>x>=0.9).length, "/", c.length-5);
{
  const third = Math.floor(c.length / 3);
  const late = mean(c.slice(-third)), mid = mean(c.slice(third, c.length - third)), lk = mean(k.slice(-third));
  let run = 0, longest = 0; c.forEach((v, i) => { run = i >= 5 && v >= 0.9 ? run + 1 : 0; longest = Math.max(longest, run); });
  const easy = c.slice(5).filter((v) => v >= 0.9).length / (c.length - 5);
  const spikes: string[] = []; for (let i = 3; i < c.length; i++) { const p = mean(c.slice(i - 3, i)); if (p - c[i] > 0.35) spikes.push(`L${i + 1}`); }
  const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r = Array(a.length); o.forEach(([, i], q) => (r[i] = q)); return r as number[]; };
  const rx = rank(c.map((_, i) => i)), ry = rank(c); const n = c.length;
  const rho = 1 - (6 * rx.reduce((acc, v, i) => acc + (v - ry[i]) ** 2, 0)) / (n * (n * n - 1));
  console.log(`GATES onboarding ${c.slice(0,3).every(v=>v>=0.8)} late(L44-64) ${late.toFixed(3)} late43 ${mean(c.slice(42)).toFixed(3)} mid(L22-43) ${mid.toFixed(3)} lateSk ${lk.toFixed(3)} longestEasy ${longest} easyShare ${(easy*100).toFixed(1)}% spikes [${spikes}] rho ${rho.toFixed(3)} walls ${c.filter((v,i)=>v<0.1&&k[i]<0.6).length} dups ${JSON.stringify(j.duplicates)}`);
}
