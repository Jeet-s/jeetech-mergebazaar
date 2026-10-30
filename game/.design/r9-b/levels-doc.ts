/// <reference types="node" />
/**
 * Writes docs/LEVELS.md from the level plan in src/game/levels.ts (one source of truth: the plan IS the data).
 *   npx tsx scripts/levels-doc.ts
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { CHAPTERS, LEVELS } from "../src/game/levels";

const ROLE_WHY: Record<string, string> = {
  teach: "introduces one new idea alone, on a small board",
  practise: "repeats the newest idea with one variation so it sticks",
  twist: "uses a known mechanic in a surprising way",
  combine: "combines the newest mechanic with earlier ones",
  boss: "chapter finale — tests every idea of the chapter under a tight Spark bar",
  breather: "a lighter board right after a spike, cozy reward",
  story: "story beat (every ~5 levels): a lighter board around a narrative moment",
  finale: "the three-room grand finale — mastery of everything",
};

const ARCS: Record<number, string> = {
  1: "Merge + generators (L1 one merge; L2 a merge result merges again; L3 read the two-card tray — one order already half there — and count what waits) → crates (L4 compare each lid with a tap) → L5 story: build up from Dadi's half-built keepsakes → L6 the first mixed queue — the crate that buys what the queue gives free → L7 split your pieces to fit the orders → Big Merge (L8 teach; L9 Big Merge one tier up; L10 story: the bonus is half of the next order; L12 twist: when NOT to Big-Merge) → Fireworks (L11 teach on a 3x3 wall of crates: aim where the burst covers most) → L13 boss (two clearly separate clusters, two spare Sparks).",
  2: "Tangled thread (L14 teach; L15 any merge pulls thread — spend the junk pair; L16 twist: the generator itself is tangled) → Needle (L17 teach: two knots, one Needle — the double knot is worth it, the wrong knot only costs the star) → recipes (L18 teach: the spool you don't merge is the dupatta, a Loom forgives over-merging; L19 the 2-Spark Dye Stand is only the price of a mistake) → L20 breather right after the dye run: a zero-risk swing-shaped rangoli → L21 story: only the Big Merge ring reaches a knot behind bare ground → combines (L22 each dye frees only once its cloth exists; L23 twist: recipes pull thread) → sealed jars (L24 teach, early enough to recur all game) → L25 twist on L21: only the centre ring reaches three corner knots → L26 boss: the Needle choice is the single test.",
  3: "Locked trunks + keys (L27 teach: a free key beside the wrong trunk; L28 silver = two brass, shown first; L29 one key, two trunks — read the prices; L30 story: match key to lock on a clean 5x3) → 3-input masala (L31 teach on a small stall) → L32 twist: three sources of turmeric — queue, stall or trunk — read the prices → L33 story (a trunk holding a better key) → L34 free-play lantern breather → mixed recipes (L35 teach: Mela Banner = Sari + Garland, cloth before dye, one slip forgiven) → combines (L36 read the key queue: silver on silver, every trunk opened, L37 don't deliver the fifth piece before the Big Merge, L38 one cart's queue feeds two recipes — stop it in time) → L39 boss: four smith keys and the one on the board Big-Merge into both big keys.",
  4: "Jars return (L40 practise: a decoy pair is a free crack — and one cell touches both jars) → staged orders (L41 teach, count across both cards) → L42 breather: a jar holding a key → Sweep (L43 teach: one Sweep cracks a whole row; the decoy row has one blocker) → L44 chained jars: each jar's prize is the next jar's crack → L45 the Pongal recipe is the jar's third crack — read where each Hearth drops → L46 twist: a stage you must NOT pre-build → L47 combine jars + thread on one cell, with the Needle back as a safety net → L48 true breather: a symmetric kolam of plain pair merges → combines (L49 read the board before the shop: the jar cracked by the merges you need anyway; L50 sweep the row with four blockers, not the decoy row with one; L51 a delivered dish is gone — cook two Pongals) → L52 boss (the Sweep is a spare, not a crutch).",
  5: "Thread-wrapped trunks (L53 teach, one trunk; L54 three trunks — keys unwrap one corner, flowers the other) → L55 breather at the fair: one wrapped trunk, one masala, nothing hidden → L56 combine: keep four Plates loose — the fifth, made beside a knot, Big-Merges and its ring frees the other → chain orders (L57 teach: the flower order pays the only key — put it on the right trunk; L58 a three-link chain with three spare Sparks; L59 twist: the masala's reward key is the FIFTH key — the hint says wait for it; L60 story: the Ferris wheel's payback plus a Big Merge's bonus) → L61 combine: the first banner pays the second's dye → three-room finale: L62 a full courtyard — deliver beside the jar, then tap; L63 every merge does two jobs — the jar's turmeric comes free; L64 the full 7x9 board: the chain's reward is the key to the Grand Diya.",
};

const solutions = (() => {
  try { return JSON.parse(readFileSync(path.join(__dirname, "../src/game/solutions.json"), "utf8")) as Record<string, string[]>; } catch { return {}; }
})();

let md = `# Merge Bazaar: Festival Homes — Level Plan

64 handcrafted boards in 5 festival chapters. Every level has one job (teach / practise / twist / combine / boss /
breather / story / finale) and one insight ("aha"). This file is generated from \`src/game/levels.ts\`
(\`npx tsx scripts/levels-doc.ts\`), so the plan and the shipped levels never drift apart.

## Rules the levels are built on
- Drag an item onto an identical one → next tier, on the target cell. Adjacent items never merge on their own.
- **Big Merge** (from L8): with 5+ identical free items on the board, a drop merges 5 at once — the target jumps two
  tiers and a bonus item of the next tier appears. It always fires at 5, so sometimes you must merge pairs first.
- **Recipes**: cloth + dye = sari, spool + dye = dupatta, chilli bunch + pepper = spice mix, + turmeric = masala tin,
  rice pot + ghee = sweet pongal, + laddu plate = feast platter, sari + garland = Mela banner.
- **Generators** cost Sparks (the level's budget) and drop a visible, fixed sequence into the nearest empty cell.
- **Blockers**: crates (1 Spark), tangled thread (1-2 layers), sealed jars (3 cracks), locked trunks (key tier ≥ lock),
  thread-wrapped trunks. A merge hits blockers in the 8 cells around its result; a Big Merge hits the 5x5 ring.
- **Boosters**: Fireworks (opens/hits a 3x3), Needle (removes a whole knot), Sweep (hits every blocker in a row).
- **Orders**: deliver to the tray; staged orders unlock in sequence; chain orders pay a reward piece onto the board.
- Lose only when nothing useful is left (no Sparks for a tap and no merge/recipe/key/delivery). Undo is unlimited in-game.

## Difficulty rhythm
Each chapter: teach → practise → (breather) → twist → combine → story beat → boss → breather. Spark budgets are tuned
with the bot playtesters (\`scripts/tune-levels.ts\`): casual first-try win rate falls from ~95% (L1-3) to ~40% at the
finale, with a dip on every boss and a breather after it. Never more than two hard levels in a row.

`;
for (const ch of CHAPTERS) {
  const levels = LEVELS.filter((l) => l.chapter === ch.n);
  md += `## Chapter ${ch.n} · ${ch.name} (L${levels[0].id}-${levels[levels.length - 1].id}) — ${ch.place}\n\n`;
  md += `**Mechanic arc:** ${ARCS[ch.n]}\n\n`;
  md += `| # | Role | Title | Mechanics | Aha | Why here |\n|---|---|---|---|---|---|\n`;
  for (const l of levels) {
    const sol = solutions[String(l.id)];
    md += `| ${l.id} | ${l.role} | ${l.title} | ${l.mechanics.join(", ")} | ${l.aha} | ${ROLE_WHY[l.role]}${sol ? ` (solver: ${sol.length} moves, ${l.sparks} Sparks)` : ""} |\n`;
  }
  md += `\n`;
  for (const l of levels) md += `- **L${l.id} ${l.title}** — ${l.intent}\n`;
  md += `\n`;
}
writeFileSync(path.join(__dirname, "../docs/LEVELS.md"), md);
console.log(`docs/LEVELS.md: ${LEVELS.length} levels`);
