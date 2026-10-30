/**
 * Bazaar Day — one handcrafted bonus board per calendar day (local date), rotated deterministically from a fixed
 * list of boards. Each board is a normal LevelDef (ids 1001+, chapter 5, role "practise") played by the real engine,
 * proven winnable by scripts/check-daily.ts (which also records the proof below in `DAILY_SOLUTIONS`).
 * Uses mechanics taught up to the Sweep booster: merges, generators, orders, crates, Big Merge, thread, jars,
 * trunks & keys, recipes and chain orders.
 */
import type { GenDef, LevelDef } from "./engine";
import { store } from "../modules/store";
import proofs from "./daily-solutions.json";

const G = (kind: GenDef["kind"], seq: string, cost?: number): GenDef => ({ kind, seq: seq.split(" "), ...(cost ? { cost } : {}) });
const O = (item: string, n = 1, extra: { after?: number; reward?: string } = {}) => ({ item, n, ...extra });

type Raw = Omit<LevelDef, "id" | "chapter" | "role" | "mechanics"> & { mechanics: string[] };

const RAW: Raw[] = [
  {
    title: "Lamp sellers' morning",
    intent: "Warm-up: two lamp orders from one shelf, with a crate of Brass Diyas to open first.",
    aha: "The crate is two taps' worth for one Spark.",
    board: [". . . . .", ". c:L2 . L1 .", ". . @0 . .", ". L1 . c:L2 .", ". . . . ."],
    gens: [G("lamp", "L1")], orders: [O("L3"), O("L3")], sparks: 6, mechanics: ["merge", "generator", "crates"],
  },
  {
    title: "Garlands for the gate",
    intent: "Flowers and sweets: a Garland and a Laddu Box, the Flower Basket alternates buds and laddus.",
    aha: "Read the basket's queue — every second tap is a laddu.",
    board: ["F1 . . . W1", ". . @0 . .", ". t:F1 . t:W1 .", "W1 . . . F1"],
    gens: [G("flower", "F1 W1")], orders: [O("F3"), O("W3")], sparks: 6, mechanics: ["merge", "generator", "thread"],
  },
  {
    title: "Five of a kind",
    intent: "Big Merge practice: four Clay Diyas wait — tap one more and the five jump two tiers at once.",
    aha: "Wait for five before you merge.",
    board: ["L1 . . . L1", ". . j:L2 . .", ". . @0 . .", "L1 . . . L1", ". . . . ."],
    gens: [G("lamp", "L1")], orders: [O("L3"), O("L4")], clear: ["jar"], sparks: 8, mechanics: ["big merge", "jars"],
  },
  {
    title: "The weaver's stall",
    intent: "Recipes: Cotton Cloth + Dye Pot = Sari; a Dupatta (Spool + Dye) for the side order.",
    aha: "Keep one dye for each recipe.",
    board: [". C1 . . .", ". . @0 . D1", "C1 . . @1 .", ". . c:C1 . ."],
    gens: [G("loom", "C1"), G("dye", "D1", 2)], orders: [O("Sa"), O("Du")], sparks: 5, mechanics: ["recipes", "crates"],
  },
  {
    title: "Locked spice trunk",
    intent: "Keys: the Key Smith's two Brass Keys merge into a Silver Key for the trunk holding a Chilli String.",
    aha: "A key two tiers up is just one more merge.",
    board: ["k2:S3 . . . .", ". . @0 . .", ". S1 . S1 .", ". . . @1 .", ". . . . ."],
    gens: [G("key", "K1"), G("spice", "S1")], orders: [O("S3", 2)], clear: ["trunk"], sparks: 6, mechanics: ["trunks & keys", "merge"],
  },
  {
    title: "Feast for the neighbours",
    intent: "A chain order: the Laddu Box order pays a Ghee Pot, and Rice Pot + Ghee Pot = Sweet Pongal.",
    aha: "The first order hands you the missing ingredient.",
    board: ["W1 . . . R1", ". . @0 . .", ". . . . W1", ". . @1 . .", ". . . . ."],
    gens: [G("sweets", "W1"), G("harvest", "R1")], orders: [O("W3", 1, { reward: "G1" }), O("Po", 1, { after: 0 })], sparks: 5, mechanics: ["chain orders", "recipes"],
  },
  {
    title: "Knotted bazaar",
    intent: "Thread practice: every merge beside a knot pulls a layer loose — merge where it helps.",
    aha: "Stage pieces next to the knots before you merge.",
    board: ["t2:L2 . . t:F2", ". L1 . .", ". @0 @1 .", ". F1 . L1", "t:. . . t2:."],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3"), O("F3")], clear: ["thread"], sparks: 8, mechanics: ["thread", "merge"],
  },
  {
    title: "Jars of the sweet shop",
    intent: "Jars crack after three merges beside them; the Laddu Box inside one finishes the order.",
    aha: "One jar holds half the order — crack it instead of building.",
    board: [". . j:W3 . .", ". W1 . W1 .", ". . @0 . .", "W1 . . . W1", ". . j:W2 . ."],
    gens: [G("sweets", "W1")], orders: [O("W4")], clear: ["jar"], sparks: 6, mechanics: ["jars", "merge"],
  },
  {
    title: "Mela banner rush",
    intent: "Mixed recipe: Mela Banner = Sari + Garland. Cloth and dye wait in crates; flowers come from the basket.",
    aha: "Open the crates that feed the sari, build the garland in parallel.",
    board: ["c:C2 . . . F1", ". . @0 . .", "c:D1 . . . F1", ". . . . .", "c:W2 . . . F2"],
    gens: [G("flower", "F1")], orders: [O("Mb")], sparks: 4, mechanics: ["mixed recipes", "crates"],
  },
  {
    title: "Courtyard sweep",
    intent: "The Sweep booster clears a whole row of crates and knots — aim it at the row that hides the most.",
    aha: "One Sweep on the busiest row saves three Sparks.",
    board: ["c:L2 t:L1 c:L2 t:. c:W2", ". . . . .", ". . @0 . .", ". L1 . L1 ."],
    gens: [G("lamp", "L1")], orders: [O("L4")], clear: ["thread", "crate"], sparks: 4, boosters: { sweep: 1 }, mechanics: ["sweep", "crates", "thread"],
  },
  {
    title: "Fireworks over the stalls",
    intent: "Fireworks burst a 3x3 square of blockers: two jars and a knot sit together around the Toran Lamp.",
    aha: "Aim the Fireworks at the middle of the cluster.",
    board: [". . . . .", ". j:L1 t:L3 j:L1 .", ". . j:L2 . .", ". . @0 . .", "L1 . . . L1"],
    gens: [G("lamp", "L1")], orders: [O("L4")], clear: ["jar", "thread"], sparks: 5, boosters: { fireworks: 1 }, mechanics: ["fireworks", "jars", "thread"],
  },
  {
    title: "Spice Box secret",
    intent: "3-input recipe: Chilli Bunch + Pepper Pods = Spice Mix, then Spice Mix + Turmeric Root = Masala Tin.",
    aha: "Finish the mix before you look for the turmeric.",
    board: ["S1 . . . T1", ". . @0 . .", "S1 . . . .", ". . @1 . .", ". . . . c:T1"],
    gens: [G("spice", "P1 S1"), G("harvest", "T1", 2)], orders: [O("Ms"), O("S2")], sparks: 6, mechanics: ["3-input recipe", "recipes"],
  },
];

const HOUR = 3600_000;

/** The Bazaar Day boards, ids 1001.., chapter 5. */
export const DAILY_LEVELS: LevelDef[] = RAW.map((r, i) => ({ ...r, id: 1001 + i, chapter: 5, role: "practise" }) as LevelDef);

/** Local calendar day key, YYYY-MM-DD. */
export function dailyKey(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Days since 2026-01-01 for the local date (noon-anchored so DST shifts never skip or repeat a board). */
function dayNumber(date: Date): number {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  const epoch = new Date(2026, 0, 1, 12).getTime();
  return Math.round((noon - epoch) / (24 * HOUR));
}

/** Today's board (the same for every player on the same local date; consecutive days never repeat a board). */
export function dailyLevel(date: Date = new Date()): LevelDef {
  const n = DAILY_LEVELS.length;
  const d = dayNumber(date);
  // A stride coprime with n walks every board once per n days, in an order that mixes the mechanics up.
  const i = (((d * 5) % n) + n) % n;
  return DAILY_LEVELS[i];
}

/** Has today's Bazaar Day board been won? */
export function dailyDone(date: Date = new Date()): boolean {
  return store.get().dailyDone === dailyKey(date);
}

/** Record today's Bazaar Day win (once per day). */
export function markDailyDone(date: Date = new Date()): void {
  const key = dailyKey(date);
  if (store.get().dailyDone === key) return;
  store.set({ dailyDone: key, dailyWins: (store.get().dailyWins ?? 0) + 1 });
}

/** The stored proof for a daily board (encoded moves; the helper and the efficiency star follow it). */
export const dailySolution = (def: LevelDef): string[] => (proofs as Record<string, string[]>)[String(def.id)] ?? [];
export const isDaily = (def: LevelDef) => def.id > 1000;

/** Lamps for a Bazaar Day win. */
export const dailyLamps = (stars: number) => 40 + stars * 10;
