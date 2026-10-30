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
  1: "Merge + generators (L1 one merge; L2 a merge result merges again; L3 read the tray, skip the generator no order needs) → crates (L4 compare each lid with a tap; L5 story: count the board; L6 split pieces to fit the orders; L7 the first mixed queue — the crate that buys what the queue gives free) → Big Merge (L8 teach; L9 practise: the bonus partners a waiting piece; L10 story: one Big Merge serves two neighbours; L12 twist: when NOT to Big-Merge) → Fireworks (L11 teach) → L13 boss.",
  2: "Tangled thread (L14 teach; L15 any merge pulls thread — spend the junk pair; L17 twist: the generator itself is tangled) → Needle (L16 teach; L23 breather: Needle a generator) → recipes (L18 teach, L19 the 2-Spark Dye Stand, L22 twist: recipes pull thread) → combines (L21, L24 Big Merge bonus = recipe input, L20 story: only the ring reaches a knot behind bare ground, L25 story: one ring over a knot, a jar and a knot) → L26 boss.",
  3: "Locked trunks + keys (L27 teach; L28 silver = two brass; L29 one key, two trunks — read the prices; L30 story: match key to lock) → 3-input masala (L31 teach) → mixed recipes (L32 teach: Mela Banner = Sari + Garland, with the 2-Spark Dye Stand) → L33 twist: the trunk is a shortcut past the queue → L34 free-play lantern breather, L35 story (a trunk holding a better key) → combines (L36 read the key queue, L37 don't deliver the fifth piece before the Big Merge, L38 one cart's queue feeds three recipes) → L39 boss.",
  4: "Sealed jars (L40 teach; L41 the cell touching both jars; L42 breather: a jar holding a key; L43 combine) → staged orders (L44 teach; L45 a recipe is the jar's third crack; L46 twist: the Big Merge bonus feeds a stage) → Sweep (L47 teach; L48 free-play rangoli breather; L49 combine; L50 sweep the row with four blockers; L51 two Pongals for one platter) → L52 boss.",
  5: "Thread-wrapped trunks (L53 teach, L54 three trunks — leave the decoy wrapped, L56 combine) → L55 twist: one Sweep opens the crate's fifth piece and cracks the jars around it → L57 late masala practise → chain orders (L58 teach: the flower order pays the only key; L59 a three-link chain; L60 breather) → L61 combine: the first banner pays the second's dye → three-room finale: L62 a FULL courtyard — deliver beside the jar, then tap; L63 the turmeric stall is a decoy; L64 the full 7x9 board: the chain's reward is the key to the Grand Diya.",
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
