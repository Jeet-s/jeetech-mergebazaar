/**
 * Merge Bazaar meta game — everything around the levels: the story spine, home restoration (stars → restore tasks
 * with a decor choice), the heirloom collection, the 7-day gift calendar (pauses, never resets), the booster
 * inventory and player settings. Persisted inside the player save (src/modules/store.ts → meta).
 */
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";
import { BOOSTERS, type Booster } from "./engine";
import { CHAPTERS, LEVELS } from "./levels";

export interface Meta {
  boosters: Record<Booster, number>;
  starsSpent: number;
  /** restore task id → chosen decor variant */
  rooms: Record<string, number>;
  heirlooms: string[];
  storySeen: string[];
  daily: { day: number; last: string };
  fails: Record<string, number>;
  settings: { reduceMotion: boolean; hints: boolean; leftHanded: boolean; reminders: boolean };
  helperUsed?: Record<string, boolean>;
  /** sets whose +SET_BONUS was paid */
  setsPaid?: string[];
  /** keepsakes found since the book was last opened (Home dot) */
  heirloomNew?: number;
  /** total days the daily gift was claimed */
  giftDays?: number;
  /** Bazaar Day day keys won (recent) and the total */
  bazaarWins?: string[];
  bazaarTotal?: number;
  festival?: FestivalState;
  /** rewards auto-granted when the last festival ended (shown once in the hub) */
  festivalAway?: { name: string; rewards: string[] } | null;
  /** when the player last copied/shared a progress backup code (ms) */
  backupAt?: number;
}

const DEFAULT: Meta = {
  // Dadi's welcome gift: one Fireworks and one Needle wait in the tray from level 2 on
  boosters: { fireworks: 1, needle: 1, sweep: 0 },
  starsSpent: 0,
  rooms: {},
  heirlooms: [],
  storySeen: [],
  daily: { day: 0, last: "" },
  fails: {},
  settings: { reduceMotion: false, hints: true, leftHanded: false, reminders: false },
};

export function meta(): Meta {
  const m = store.get().meta;
  return { ...DEFAULT, ...m, boosters: { ...DEFAULT.boosters, ...m?.boosters }, settings: { ...DEFAULT.settings, ...m?.settings }, daily: { ...DEFAULT.daily, ...m?.daily } };
}
export function setMeta(patch: Partial<Meta>): void {
  store.set({ meta: { ...meta(), ...patch } });
}
export function setSetting<K extends keyof Meta["settings"]>(k: K, v: Meta["settings"][K]): void {
  setMeta({ settings: { ...meta().settings, [k]: v } });
  analytics.track("setting_changed", { setting: k, on: Boolean(v) });
}

/* ───────── progress ───────── */

export const starsEarned = () => Object.values(store.get().stars ?? {}).reduce((a, b) => a + b, 0);
export const starsAvailable = () => Math.max(0, starsEarned() - meta().starsSpent);
export const currentLevel = () => Math.min(LEVELS.length, Math.max(1, store.get().level));
export const allDone = () => store.get().level > LEVELS.length;
export const chapterOfLevel = (n: number) => CHAPTERS[(LEVELS[n - 1]?.chapter ?? 1) - 1];
export function chapterProgress(n: number) {
  const ch = chapterOfLevel(n);
  const ids = LEVELS.filter((l) => l.chapter === ch.n).map((l) => l.id);
  const done = ids.filter((id) => (store.get().stars ?? {})[id] !== undefined).length;
  return { chapter: ch, total: ids.length, done, first: ids[0], last: ids[ids.length - 1] };
}

/* ───────── boosters ───────── */

export const BOOSTER_INFO: Record<Booster, { name: string; from: number; price: number; what: string }> = {
  fireworks: { name: "Fireworks", from: 11, price: 120, what: "Bursts open a crate, jar or knot and all 8 tiles around it." },
  needle: { name: "Needle", from: 17, price: 80, what: "Unpicks every layer of thread on one tile." },
  sweep: { name: "Sweep", from: 43, price: 150, what: "Hits every blocker in one row." },
};
export const boosterUnlocked = (b: Booster) => store.get().level >= BOOSTER_INFO[b].from;
export function addBoosters(b: Booster, n: number) {
  const m = meta();
  setMeta({ boosters: { ...m.boosters, [b]: Math.max(0, m.boosters[b] + n) } });
}
export function buyBooster(b: Booster): boolean {
  const price = BOOSTER_INFO[b].price;
  if (store.get().coins < price) return false;
  store.set({ coins: store.get().coins - price });
  addBoosters(b, 1);
  analytics.track("booster_bought", { booster: b });
  return true;
}
export { BOOSTERS };

/* ───────── story spine ───────── */

export type Speaker = "dadi" | "aarav" | "meera" | "imran" | "committee";
export const CAST: Record<Speaker, { name: string; role: string; piece: string; color: string }> = {
  dadi: { name: "Dadi", role: "the grandmother", piece: "L2", color: "#C2255C" },
  aarav: { name: "Aarav", role: "her grandson", piece: "K1", color: "#2B6FB0" },
  meera: { name: "Meera", role: "cousin & weaver", piece: "C3", color: "#8E4BB5" },
  imran: { name: "Chacha Imran", role: "spice merchant", piece: "Ms", color: "#1F9E8F" },
  committee: { name: "Mrs. Banerjee", role: "pavilion committee", piece: "W4", color: "#D8433B" },
};
export interface Beat { id: string; level: number; title: string; lines: { who: Speaker; text: string }[] }
/** A story beat opens before its level (about every 5 levels). Skippable; replayable from the Story book. */
export const STORY: Beat[] = [
  { id: "letter", level: 1, title: "Dadi's letter", lines: [
    { who: "aarav", text: "A letter in Dadi's handwriting, tucked in the old lamp shelf…" },
    { who: "dadi", text: "\"My dears — the house and the bazaar have gone quiet. Light them again before my 80th Diwali, and bring the family home.\"" },
    { who: "aarav", text: "Then let's start with one brass diya for her doorstep." },
  ] },
  { id: "lamps", level: 5, title: "The first lamps", lines: [
    { who: "dadi", text: "You found my old clay diyas! Your grandfather lit these every Diwali." },
    { who: "aarav", text: "Merge them up, Dadi — the courtyard deserves a Toran Lamp." },
  ] },
  { id: "lane", level: 10, title: "Laddus for the lane", lines: [
    { who: "dadi", text: "The neighbours are peeking over the wall. Nobody refuses a laddu." },
    { who: "aarav", text: "Big Merges, Dadi. Five at once — watch!" },
  ] },
  { id: "meera", level: 14, title: "Meera comes home", lines: [
    { who: "meera", text: "I took the night train the moment Aarav called. But look at Nani's loom — the threads are all tangled!" },
    { who: "dadi", text: "Merge beside the knots, beta. The thread loosens when the work goes on around it." },
  ] },
  { id: "loom", level: 20, title: "Onam garlands", lines: [
    { who: "meera", text: "Cloth and indigo make a sari. Our family's sari stall can open again!" },
    { who: "aarav", text: "And a pookalam of marigolds for the courtyard." },
  ] },
  { id: "imran", level: 27, title: "Chacha Imran's trunk", lines: [
    { who: "imran", text: "Arre, the Sharma children! Your Dadi lent me lanterns forty years ago. They're still locked in my trunk." },
    { who: "aarav", text: "Then we'll forge a key, Chacha. Brass, then silver, then filigree." },
  ] },
  { id: "masala", level: 33, title: "The old ledger", lines: [
    { who: "imran", text: "My ledger says your grandfather never paid for one tin of masala. Ha! I'm joking — he paid in friendship." },
    { who: "dadi", text: "Chilli, pepper, turmeric. Some recipes need three hands." },
  ] },
  { id: "pavilion", level: 40, title: "The pavilion committee", lines: [
    { who: "committee", text: "The pavilion needs sweets for the whole lane, and every old prasad jar is sealed shut." },
    { who: "meera", text: "Just like Amma's sweet jar back home — merge beside it three times and it cracks open." },
  ] },
  { id: "rival", level: 46, title: "A rival — and a friend", lines: [
    { who: "committee", text: "The new bazaar across the river wants to outshine us…" },
    { who: "dadi", text: "Then we invite them to our Pongal. A festival is bigger when it is shared." },
  ] },
  { id: "mela", level: 53, title: "The Grand Mela", lines: [
    { who: "aarav", text: "Everyone's here — Meera, Chacha Imran, the committee, even the river bazaar." },
    { who: "imran", text: "One last puzzle: my trunks are wrapped in Meera's thread!" },
  ] },
  { id: "chain", level: 58, title: "A chain of favours", lines: [
    { who: "meera", text: "Each stall pays the next one forward — finish one order and it hands you the next piece." },
  ] },
  { id: "festival", level: 64, title: "Dadi's 80th", lines: [
    { who: "dadi", text: "Eighty years… and the whole bazaar is coming home tonight." },
    { who: "aarav", text: "One last board, Dadi. Let's light every lamp." },
  ] },
];
export const beatFor = (level: number) => STORY.find((b) => b.level === level);
export function markSeen(id: string, skipped = false) {
  const m = meta();
  if (!m.storySeen.includes(id)) setMeta({ storySeen: [...m.storySeen, id] });
  analytics.track(skipped ? "story_beat_skip" : "story_beat_view", { beat: id });
}
export const nextBeat = () => STORY.find((b) => b.level >= currentLevel() && !meta().storySeen.includes(b.id)) ?? STORY.find((b) => b.level >= currentLevel());

/* ───────── home restoration ───────── */

export interface RestoreTask { id: string; chapter: number; name: string; cost: number; x: number; y: number; options: { label: string; piece: string }[] }
const T = (chapter: number, id: string, name: string, cost: number, x: number, y: number, options: [string, string][]): RestoreTask =>
  ({ id: `${chapter}-${id}`, chapter, name, cost, x, y, options: options.map(([label, piece]) => ({ label, piece })) });
/** Six restore tasks per chapter, each a style choice (no power). x/y = where the piece stands on the scene. */
export const TASKS: RestoreTask[] = [
  T(1, "door", "Light the doorstep", 2, 0.5, 0.62, [["Brass diya", "L2"], ["Clay diyas", "L1"], ["Grand diya", "L5"]]),
  T(1, "toran", "Hang a toran", 3, 0.5, 0.35, [["Toran lamp", "L3"], ["Marigold garland", "F3"], ["Festival arch", "F4"]]),
  T(1, "rangoli", "Draw the rangoli", 3, 0.3, 0.84, [["Rangoli lamp", "L4"], ["Marigolds", "F2"], ["Petal bud", "F1"]]),
  T(1, "sweets", "Set out sweets", 4, 0.78, 0.8, [["Laddu plate", "W2"], ["Mithai box", "W4"], ["Laddu box", "W3"]]),
  T(1, "window", "Lamps in the window", 4, 0.22, 0.52, [["Clay diya", "L1"], ["Brass diya", "L2"], ["Rangoli lamp", "L4"]]),
  T(1, "arch", "Dress the arch", 5, 0.78, 0.48, [["Festival arch", "F4"], ["Garland", "F3"], ["Toran lamp", "L3"]]),
  T(2, "loom", "Mend the loom", 3, 0.3, 0.6, [["Cotton spool", "C1"], ["Silk bolt", "C3"], ["Cotton cloth", "C2"]]),
  T(2, "sari", "Hang the saris", 4, 0.72, 0.42, [["Festival sari", "Sa"], ["Dupatta", "Du"], ["Silk bolt", "C3"]]),
  T(2, "pookalam", "Lay a pookalam", 4, 0.5, 0.85, [["Marigolds", "F2"], ["Rangoli lamp", "L4"], ["Garland", "F3"]]),
  T(2, "dye", "Restore the dye vat", 4, 0.2, 0.8, [["Dye vat", "D2"], ["Indigo pot", "D1"], ["Dupatta", "Du"]]),
  T(2, "swing", "Garland the swing", 5, 0.5, 0.3, [["Garland", "F3"], ["Festival arch", "F4"], ["Toran lamp", "L3"]]),
  T(2, "feast", "Onam feast leaf", 5, 0.8, 0.75, [["Feast platter", "Fp"], ["Laddu plate", "W2"], ["Sweet pongal", "Po"]]),
  T(3, "stall", "Reopen Imran's stall", 3, 0.25, 0.62, [["Masala tin", "Ms"], ["Spice mix", "Mx"], ["Chilli string", "S3"]]),
  T(3, "lantern", "Light the lanterns", 4, 0.5, 0.25, [["Grand diya", "L5"], ["Toran lamp", "L3"], ["Brass diya", "L2"]]),
  T(3, "trunk", "Open the old trunk", 4, 0.75, 0.66, [["Filigree key", "K3"], ["Silver key", "K2"], ["Brass key", "K1"]]),
  T(3, "spices", "Stack the spice sacks", 4, 0.18, 0.84, [["Pepper sack", "P2"], ["Turmeric jar", "T2"], ["Rice sack", "R1"]]),
  T(3, "chilli", "String the chillies", 5, 0.82, 0.38, [["Chilli string", "S3"], ["Chilli bunch", "S2"], ["Garland", "F3"]]),
  T(3, "sweets", "Eid sweets table", 5, 0.5, 0.86, [["Mithai box", "W4"], ["Laddu box", "W3"], ["Feast platter", "Fp"]]),
  T(4, "jars", "Fill the prasad jars", 3, 0.25, 0.78, [["Ghee jar", "G2"], ["Ghee pot", "G1"], ["Turmeric jar", "T2"]]),
  T(4, "pot", "Set the Pongal pot", 4, 0.5, 0.7, [["Sweet pongal", "Po"], ["Rice pot", "R2"], ["Ghee pot", "G1"]]),
  T(4, "pandal", "Light the pandal", 4, 0.5, 0.3, [["Grand diya", "L5"], ["Rangoli lamp", "L4"], ["Festival arch", "F4"]]),
  T(4, "kolam", "Draw the kolam", 5, 0.78, 0.85, [["Rangoli lamp", "L4"], ["Marigolds", "F2"], ["Garland", "F3"]]),
  T(4, "harvest", "Harvest sacks", 5, 0.8, 0.55, [["Rice sack", "R1"], ["Pepper sack", "P2"], ["Rice pot", "R2"]]),
  T(4, "platter", "The feast platter", 5, 0.22, 0.48, [["Feast platter", "Fp"], ["Mithai box", "W4"], ["Spice mix", "Mx"]]),
  T(5, "banner", "Raise the Mela banner", 4, 0.5, 0.22, [["Mela banner", "Mb"], ["Festival arch", "F4"], ["Garland", "F3"]]),
  T(5, "gate", "Garland the gates", 4, 0.2, 0.45, [["Festival arch", "F4"], ["Toran lamp", "L3"], ["Garland", "F3"]]),
  T(5, "sweets", "Sweet stall", 5, 0.8, 0.62, [["Mithai box", "W4"], ["Laddu plate", "W2"], ["Feast platter", "Fp"]]),
  T(5, "saris", "Sari pavilion", 5, 0.25, 0.75, [["Festival sari", "Sa"], ["Silk bolt", "C3"], ["Dupatta", "Du"]]),
  T(5, "spice", "Spice corner", 5, 0.75, 0.86, [["Masala tin", "Ms"], ["Chilli string", "S3"], ["Spice mix", "Mx"]]),
  T(5, "grand", "Dadi's grand diya", 6, 0.5, 0.62, [["Grand diya", "L5"], ["Rangoli lamp", "L4"], ["Brass diya", "L2"]]),
];
export const SCENE_OF: Record<number, { scene: "bg_courtyard_dusk" | "bg_home_room" | "bg_bazaar_street"; tint?: string; place: string }> = {
  1: { scene: "bg_courtyard_dusk", place: "Dadi's courtyard" },
  2: { scene: "bg_home_room", place: "Meera's loom room" },
  3: { scene: "bg_bazaar_street", tint: "rgba(20,60,90,0.28)", place: "Imran's night lane" },
  4: { scene: "bg_courtyard_dusk", tint: "rgba(150,40,20,0.18)", place: "The festival pavilion" },
  5: { scene: "bg_bazaar_street", place: "The Grand Mela" },
};
export const chapterUnlocked = (ch: number) => store.get().level >= CHAPTERS[ch - 1].first;
export function nextTask(ch: number) {
  return TASKS.find((t) => t.chapter === ch && meta().rooms[t.id] === undefined);
}
export function restore(task: RestoreTask, option: number): boolean {
  const m = meta();
  if (m.rooms[task.id] !== undefined) {
    // re-pick a style for free
    setMeta({ rooms: { ...m.rooms, [task.id]: option } });
    analytics.track("decor_picked", { task: task.id, option });
    return true;
  }
  if (starsAvailable() < task.cost) return false;
  setMeta({ rooms: { ...m.rooms, [task.id]: option }, starsSpent: m.starsSpent + task.cost });
  analytics.track("room_unlocked", { task: task.id, option });
  return true;
}
export const chapterRestored = (ch: number) => {
  const all = TASKS.filter((t) => t.chapter === ch);
  return { done: all.filter((t) => meta().rooms[t.id] !== undefined).length, total: all.length };
};

/* ───────── heirlooms ───────── */

/** Where a keepsake comes from: a level win (spread across its chapter), finishing the chapter (its last level),
 *  daily-gift visits (total days claimed) or Bazaar Day boards won. Nothing is random and nothing is for sale. */
export type HeirloomSource = { kind: "level"; level: number } | { kind: "chapter"; chapter: number; level: number } | { kind: "gift"; days: number } | { kind: "bazaar"; wins: number };
export interface Heirloom { id: string; name: string; piece: string; level: number; set: string; source: HeirloomSource }
export const HEIRLOOM_SETS = ["Dadi's Brass", "Meera's Loom", "Imran's Spice Box", "Festival Kitchen", "The Grand Mela"] as const;
export type HeirloomSet = (typeof HEIRLOOM_SETS)[number];
const lv = (level: number): HeirloomSource => ({ kind: "level", level });
const chEnd = (chapter: number): HeirloomSource => {
  const ids = LEVELS.filter((l) => l.chapter === chapter).map((l) => l.id);
  return { kind: "chapter", chapter, level: ids[ids.length - 1] ?? CHAPTERS[chapter - 1].first };
};
const H = (id: string, name: string, piece: string, set: HeirloomSet, source: HeirloomSource): Heirloom =>
  ({ id, name, piece, set, source, level: source.kind === "level" || source.kind === "chapter" ? source.level : 0 });
/** 5 sets × 6 keepsakes. Ids of the first 15 are kept from earlier saves. */
export const HEIRLOOMS: Heirloom[] = [
  H("spoon", "Dadi's brass diya", "L2", "Dadi's Brass", lv(1)),
  H("claydiya", "Grandfather's clay diyas", "L1", "Dadi's Brass", lv(4)),
  H("stencil", "Rangoli lamp", "L4", "Dadi's Brass", lv(8)),
  H("toranlamp", "The doorway toran lamp", "L3", "Dadi's Brass", lv(11)),
  H("grand", "Grandfather's grand diya", "L5", "Dadi's Brass", chEnd(1)),
  H("brasskey", "Dadi's brass house key", "K1", "Dadi's Brass", { kind: "gift", days: 3 }),
  H("spool", "Nani's cotton spool", "C1", "Meera's Loom", lv(14)),
  H("shuttle", "Meera's silk bolt", "C3", "Meera's Loom", lv(18)),
  H("indigo", "The indigo dye pot", "D1", "Meera's Loom", lv(21)),
  H("cotton", "Block-printed cotton", "C2", "Meera's Loom", lv(24)),
  H("sari", "The wedding sari", "Sa", "Meera's Loom", chEnd(2)),
  H("dupatta", "Meera's first dupatta", "Du", "Meera's Loom", { kind: "gift", days: 7 }),
  H("key", "Filigree key", "K3", "Imran's Spice Box", lv(27)),
  H("masala", "Imran's masala tin", "Ms", "Imran's Spice Box", lv(31)),
  H("turmeric", "Turmeric jar", "T2", "Imran's Spice Box", lv(34)),
  H("pepper", "Black-pepper sack", "P2", "Imran's Spice Box", lv(37)),
  H("chilli", "Lucky chilli string", "S3", "Imran's Spice Box", chEnd(3)),
  H("spicemix", "The secret spice mix", "Mx", "Imran's Spice Box", { kind: "bazaar", wins: 1 }),
  H("prasad", "Prasad mithai box", "W4", "Festival Kitchen", lv(40)),
  H("ghee", "Ghee jar", "G2", "Festival Kitchen", lv(44)),
  H("platter", "Banana-leaf platter", "Fp", "Festival Kitchen", lv(47)),
  H("laddu", "Laddu plate", "W2", "Festival Kitchen", lv(50)),
  H("pongal", "Pongal pot", "Po", "Festival Kitchen", chEnd(4)),
  H("ricepot", "The harvest rice pot", "R2", "Festival Kitchen", { kind: "gift", days: 14 }),
  H("garland", "Mela garland", "F3", "The Grand Mela", lv(53)),
  H("bell", "Mela banner", "Mb", "The Grand Mela", lv(57)),
  H("marigold", "Marigold basket", "F2", "The Grand Mela", lv(60)),
  H("silverkey", "The pavilion silver key", "K2", "The Grand Mela", lv(62)),
  H("arch", "Dadi's festival arch", "F4", "The Grand Mela", chEnd(5)),
  H("ladduBox", "Mela laddu box", "W3", "The Grand Mela", { kind: "bazaar", wins: 5 }),
];
export const SET_BONUS = 150;
/** The set reward: +SET_BONUS Lamps (auto-granted the moment the set completes) and a postcard from the family. */
export const SET_POSTCARD: Record<HeirloomSet, string> = {
  "Dadi's Brass": "\"Every lamp you lit was one your grandfather lit first.\" — Dadi",
  "Meera's Loom": "\"Nani's loom sings again. I'll weave you a shawl for Diwali!\" — Meera",
  "Imran's Spice Box": "\"Forty years I kept these safe. Now they're home.\" — Chacha Imran",
  "Festival Kitchen": "\"The whole lane ate from our pots tonight.\" — Mrs. Banerjee",
  "The Grand Mela": "\"Eighty years, and this is the brightest Diwali of them all.\" — Dadi",
};
export function heirloomHow(h: Heirloom): string {
  const s = h.source;
  if (s.kind === "level") return `Win level ${s.level}`;
  if (s.kind === "chapter") return `Finish Chapter ${s.chapter} (level ${s.level})`;
  if (s.kind === "gift") return `Claim the daily gift on ${s.days} days`;
  return s.wins === 1 ? "Win a Bazaar Day board" : `Win ${s.wins} Bazaar Day boards`;
}
export const heirloomsOf = (set: string) => HEIRLOOMS.filter((h) => h.set === set);
export const setComplete = (set: string, have = meta().heirlooms) => heirloomsOf(set).every((h) => have.includes(h.id));

/** Adds keepsakes to the book; a set completed now pays its bonus (once). Returns what was new. */
function grantHeirlooms(list: Heirloom[]): { heirloom: Heirloom; setDone: boolean }[] {
  const m = meta();
  const fresh = list.filter((h, i) => !m.heirlooms.includes(h.id) && list.indexOf(h) === i);
  if (!fresh.length) return [];
  const got = [...m.heirlooms, ...fresh.map((h) => h.id)];
  const paid = [...(m.setsPaid ?? [])];
  const out = fresh.map((h) => {
    const setDone = !paid.includes(h.set) && heirloomsOf(h.set).every((x) => got.includes(x.id));
    if (setDone) paid.push(h.set);
    analytics.track("heirloom_collected", { id: h.id });
    return { heirloom: h, setDone };
  });
  const bonus = out.filter((o) => o.setDone).length * SET_BONUS;
  setMeta({ heirlooms: got, setsPaid: paid, heirloomNew: (m.heirloomNew ?? 0) + fresh.length });
  if (bonus) store.set({ coins: store.get().coins + bonus });
  out.filter((o) => o.setDone).forEach((o) => analytics.track("heirloom_set_complete", { set: o.heirloom.set }));
  return out;
}

/** Called on a level win; returns the heirloom earned now (first win only) and whether its set was completed. */
export function claimHeirloom(level: number): { heirloom: Heirloom; setDone: boolean } | null {
  const got = grantHeirlooms(HEIRLOOMS.filter((x) => x.level === level));
  return got.find((g) => g.setDone) ?? got[0] ?? null;
}

/** Keepsakes earned by progress already made (levels won before this version, gift days, Bazaar Days). Safe to call often. */
export function syncHeirlooms(): { heirloom: Heirloom; setDone: boolean }[] {
  const stars = store.get().stars ?? {};
  const m = meta();
  const days = m.giftDays ?? 0;
  const wins = (m.bazaarWins ?? []).length;
  return grantHeirlooms(HEIRLOOMS.filter((h) => {
    const s = h.source;
    if (s.kind === "level" || s.kind === "chapter") return stars[s.level] !== undefined;
    if (s.kind === "gift") return days >= s.days;
    return wins >= s.wins;
  }));
}
export const heirloomsNew = () => meta().heirloomNew ?? 0;
export const markHeirloomsSeen = () => { if (heirloomsNew()) setMeta({ heirloomNew: 0 }); };

/* ───────── Bazaar Day (the daily board: src/game/daily.ts owns the board; meta counts the wins) ───────── */

/** Record today's Bazaar Day win (idempotent per day key). Called from Home when daily.ts reports today done. */
export function noteBazaarDayWin(key: string): boolean {
  const m = meta();
  const wins = m.bazaarWins ?? [];
  if (wins.includes(key)) return false;
  setMeta({ bazaarWins: [...wins, key].slice(-60), bazaarTotal: (m.bazaarTotal ?? wins.length) + 1 });
  analytics.track("bazaar_day_won", { day: key });
  syncHeirlooms();
  return true;
}
export const bazaarWinCount = () => meta().bazaarTotal ?? (meta().bazaarWins ?? []).length;

/* ───────── Festival event + Festival Pass (weekly, local clock; no network) ───────── */

export const FESTIVAL_NAMES = ["Diwali Week", "Onam Week", "Eid Night Week", "Pongal Week", "Mela Week", "Navratri Week", "Holi Week"];
/** Monday 00:00 (local) of the week containing d. */
function weekStart(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const festivalWeek = (d = new Date()) => dayKey(weekStart(d));
export function festivalInfo(d = new Date()) {
  const start = weekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const idx = Math.floor(start.getTime() / (7 * 86400000));
  return { name: FESTIVAL_NAMES[((idx % FESTIVAL_NAMES.length) + FESTIVAL_NAMES.length) % FESTIVAL_NAMES.length], start, end, msLeft: Math.max(0, end.getTime() - d.getTime()) };
}
export interface FestivalReward { lamps?: number; booster?: Booster; count?: number; label: string }
export interface FestivalTier { points: number; free: FestivalReward; golden: FestivalReward }
/** Points: +20 per new level won, +10 per new Marigold star, +50 per Bazaar Day board, + bonus points (addFestivalPoints). */
export const FESTIVAL_POINTS = { level: 20, star: 10, bazaar: 50 };
export const FESTIVAL_TIERS: FestivalTier[] = [
  { points: 60, free: { lamps: 40, label: "40 Lamps" }, golden: { lamps: 80, label: "80 Lamps" } },
  { points: 160, free: { booster: "fireworks", label: "Fireworks" }, golden: { booster: "needle", label: "Needle" } },
  { points: 300, free: { lamps: 80, label: "80 Lamps" }, golden: { lamps: 150, label: "150 Lamps" } },
  { points: 480, free: { booster: "needle", label: "Needle" }, golden: { booster: "fireworks", count: 2, label: "2 Fireworks" } },
  { points: 700, free: { lamps: 120, label: "120 Lamps" }, golden: { booster: "sweep", label: "Sweep" } },
  { points: 1000, free: { booster: "sweep", label: "Sweep + 150", lamps: 150 }, golden: { lamps: 400, label: "400 Lamps" } },
];
export const GOLDEN_COST = { stars: 12, lamps: 400 };
export interface FestivalState { week: string; base: { level: number; stars: number; bazaar: number }; bonus: number; free: number[]; golden: number[]; goldenOn: boolean }
const snapshot = () => ({ level: Math.max(1, store.get().level), stars: starsEarned(), bazaar: bazaarWinCount() });

function grantReward(r: FestivalReward) {
  if (r.lamps) store.set({ coins: store.get().coins + r.lamps });
  if (r.booster) addBoosters(r.booster, r.count ?? 1);
}
function pointsOf(f: FestivalState) {
  const now = snapshot();
  return Math.max(0, (now.level - f.base.level) * FESTIVAL_POINTS.level + (now.stars - f.base.stars) * FESTIVAL_POINTS.star + (now.bazaar - f.base.bazaar) * FESTIVAL_POINTS.bazaar + f.bonus);
}
/** Starts this week's festival and, when a week has ended, grants every unclaimed reward that was reached
 *  (free track, and the Golden track if unlocked). Returns what was auto-granted, for a "while you were away" note. */
export function syncFestival(): { name: string; rewards: string[] } | null {
  const m = meta();
  const week = festivalWeek();
  const f = m.festival;
  if (f && f.week === week) return null;
  let granted: { name: string; rewards: string[] } | null = null;
  if (f) {
    const pts = pointsOf(f);
    const rewards: string[] = [];
    FESTIVAL_TIERS.forEach((t, i) => {
      if (pts < t.points) return;
      if (!f.free.includes(i)) { grantReward(t.free); rewards.push(t.free.label); }
      if (f.goldenOn && !f.golden.includes(i)) { grantReward(t.golden); rewards.push(t.golden.label); }
    });
    if (rewards.length) {
      granted = { name: festivalInfo(new Date(new Date(f.week + "T12:00:00").getTime())).name, rewards };
      analytics.track("festival_auto_granted", { week: f.week, n: rewards.length });
    }
  }
  setMeta({ festival: { week, base: snapshot(), bonus: 0, free: [], golden: [], goldenOn: false }, festivalAway: granted ?? meta().festivalAway });
  return granted;
}
export function festival(): FestivalState & { points: number } {
  if (meta().festival?.week !== festivalWeek()) syncFestival();
  const f = meta().festival!;
  return { ...f, points: pointsOf(f) };
}
/** Extra festival points (e.g. a Bazaar Day bonus). Level wins, stars and Bazaar Days already count on their own. */
export function addFestivalPoints(n: number): void {
  const f = festival();
  setMeta({ festival: { ...meta().festival!, bonus: f.bonus + Math.max(0, Math.round(n)) } });
}
export function claimFestival(i: number, track: "free" | "golden"): FestivalReward | null {
  const f = festival();
  const t = FESTIVAL_TIERS[i];
  if (!t || f.points < t.points) return null;
  if (track === "golden" && !f.goldenOn) return null;
  if (f[track].includes(i)) return null;
  grantReward(t[track]);
  setMeta({ festival: { ...meta().festival!, [track]: [...f[track], i] } });
  analytics.track("festival_claim", { tier: i, track });
  return t[track];
}
export function festivalClaimable(): number {
  const f = festival();
  return FESTIVAL_TIERS.filter((t, i) => f.points >= t.points && (!f.free.includes(i) || (f.goldenOn && !f.golden.includes(i)))).length;
}
/** The Golden track is unlocked for the week with Marigold stars or Lamps (never real money, nothing random). */
export function unlockGolden(by: "stars" | "lamps"): boolean {
  const f = festival();
  if (f.goldenOn) return true;
  const m = meta();
  if (by === "stars") {
    if (starsAvailable() < GOLDEN_COST.stars) return false;
    setMeta({ starsSpent: m.starsSpent + GOLDEN_COST.stars });
  } else {
    if (store.get().coins < GOLDEN_COST.lamps) return false;
    store.set({ coins: store.get().coins - GOLDEN_COST.lamps });
  }
  setMeta({ festival: { ...meta().festival!, goldenOn: true } });
  analytics.track("festival_golden_unlocked", { by });
  return true;
}

/* ───────── daily gift (7-day calendar; a missed day pauses, never resets) ───────── */

export type Gift = { lamps?: number; booster?: Booster; label: string; heirloom?: Heirloom };
export const GIFTS: Gift[] = [
  { lamps: 40, label: "40 Lamps" },
  { lamps: 60, label: "60 Lamps" },
  { booster: "fireworks", label: "Fireworks" },
  { lamps: 90, label: "90 Lamps" },
  { booster: "needle", label: "Needle" },
  { lamps: 120, label: "120 Lamps" },
  { booster: "sweep", label: "Sweep + 150", lamps: 150 },
];
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const giftReady = () => meta().daily.last !== today();
export function claimGift(): Gift | null {
  if (!giftReady()) return null;
  const m = meta();
  const g = GIFTS[m.daily.day % GIFTS.length];
  if (g.lamps) store.set({ coins: store.get().coins + g.lamps });
  const boosters = { ...m.boosters };
  if (g.booster) boosters[g.booster] += 1;
  setMeta({ daily: { day: (m.daily.day + 1) % GIFTS.length, last: today() }, boosters, giftDays: (m.giftDays ?? 0) + 1 });
  analytics.track("daily_gift_claimed", { day: m.daily.day + 1 });
  const h = syncHeirlooms()[0];
  return h ? { ...g, heirloom: h.heirloom } : g;
}

/* ───────── level results ───────── */

export function lampsFor(level: number, stars: number) {
  const ch = LEVELS[level - 1]?.chapter ?? 1;
  return 15 + ch * 5 + stars * 10;
}
/** Third fail on a level: a free booster is gifted quietly (anti-frustration). Returns the gift, if any. */
export function noteFail(level: number): Booster | null {
  const m = meta();
  const n = (m.fails[level] ?? 0) + 1;
  setMeta({ fails: { ...m.fails, [level]: n } });
  if (n !== 3) return null;
  const b = (["needle", "fireworks", "sweep"] as Booster[]).find((x) => boosterUnlocked(x) && LEVELS[level - 1]?.mechanics.some((k) => k.includes(x === "needle" ? "thread" : x === "sweep" ? "jar" : "crate")));
  if (!b) return null;
  addBoosters(b, 1);
  return b;
}
