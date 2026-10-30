/**
 * Board conveniences around the engine (UI only — never needed to win, so the solver and bots ignore them):
 * Sort (auto-arrange free items by chain and tier; never merges, never touches blockers or generators),
 * selling and the par (Sparks the stored proof uses) behind the efficiency star.
 */
import { CRAFTED, isChainItem, tierOf } from "./catalog";
import { apply, isFreeItem, startState, type LevelDef, type State } from "./engine";
import { decodeMove } from "./solver";
import solutions from "./solutions.json";

const SOLUTIONS = solutions as Record<string, string[]>;
export const storedSolution = (def: LevelDef) => SOLUTIONS[String(def.id)] ?? [];

/** Free items gathered into reading order, grouped by chain (then crafted), highest tier first. */
export function sortBoard(s: State): State | null {
  const slots: number[] = [];
  const items: string[] = [];
  s.cells.forEach((c, i) => {
    if (c === "." || isFreeItem(c)) {
      slots.push(i);
      if (c !== ".") items.push(c);
    }
  });
  const key = (c: string) => (isChainItem(c) ? `0${c[0]}${9 - tierOf(c)}` : `1${c}`);
  items.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const cells = s.cells.slice();
  slots.forEach((at, k) => (cells[at] = items[k] ?? "."));
  if (cells.every((c, i) => c === s.cells[i])) return null;
  return { ...s, cells, moves: s.moves + 1 };
}

/** Lamps a sold item returns: its tier (crafted items count as 3). Rare = tier 3+ or crafted → confirm first. */
export const sellValue = (code: string) => (isChainItem(code) ? tierOf(code) : 3);
export const isRare = (code: string) => code in CRAFTED || (isChainItem(code) && tierOf(code) >= 3);

const pars = new Map<number, number>();
/** Sparks the level's proven solution spends — finishing within it earns the efficiency star. */
export function parOf(def: LevelDef): number {
  let p = pars.get(def.id);
  if (p === undefined) {
    let s = startState(def, def.id - 1);
    for (const x of storedSolution(def)) s = apply(def, s, decodeMove(x));
    p = def.sparks - s.sparks;
    pars.set(def.id, p);
  }
  return p;
}
