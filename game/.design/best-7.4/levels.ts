/**
 * The 64 handcrafted levels of Merge Bazaar (plan: docs/LEVELS.md). Spark budgets come from
 * scripts/tune-levels.ts (bot playtest against the pacing curve) via levels-tuned.json.
 *
 * Board tokens: "." floor, "#" no floor, "L2" item, "@0" generator 0, "c:L2" crate holding L2,
 * "t:C1" thread over C1 ("t2:" two layers, "t" bare), "j:W3" sealed jar holding W3 (3 cracks),
 * "k1:L3" trunk with a brass lock holding L3 ("k2" silver, "k3" filigree), "t:k1:L3" thread-wrapped trunk.
 */
import type { GenDef, LevelDef } from "./engine";
import tuned from "./levels-tuned.json";

const G = (kind: GenDef["kind"], seq: string, cost?: number): GenDef => ({ kind, seq: seq.split(" "), ...(cost ? { cost } : {}) });
const O = (item: string, n = 1, extra: { after?: number; reward?: string } = {}) => ({ item, n, ...extra });

export const CHAPTERS = [
  { n: 1, name: "Diwali Lane", place: "the family-home courtyard", first: 1 },
  { n: 2, name: "Onam Courtyard", place: "Meera's loom house", first: 14 },
  { n: 3, name: "Eid Night Market", place: "Chacha Imran's lane", first: 27 },
  { n: 4, name: "Puja & Pongal Pavilions", place: "the festival pavilions", first: 40 },
  { n: 5, name: "Grand Mela", place: "the whole bazaar", first: 53 },
] as const;

type Raw = Omit<LevelDef, "id" | "chapter" | "sparks"> & { sparks?: number };

const RAW: Raw[] = [
  /* ───────── Chapter 1 · Diwali Lane: merge, generators, orders, crates, Big Merge, Fireworks ───────── */
  {
    title: "The unopened letter", role: "teach", mechanics: ["merge", "generator"],
    intent: "First merge: tap the Lamp Shelf for a second Clay Diya and drag one onto the other to make the Brass Diya Dadi asked for.",
    aha: "Two identical items become one item of the next tier.",
    hint: "Tap the Lamp Shelf, then drag one Clay Diya onto the other.",
    board: [". . .", "L1 @0 .", ". . ."],
    gens: [G("lamp", "L1")], orders: [O("L2")],
  },
  {
    title: "Two steps up", role: "teach", mechanics: ["merge", "generator"],
    intent: "One chain, two steps: Dadi wants a Toran Lamp (tier 3). A Brass Diya and a Clay Diya wait, so count: the Toran is two Brass Diyas, the missing Brass is two Clay Diyas, so one Clay Diya is missing — one Lamp Shelf tap. The Flower Basket beside it is a decoy (nothing a lamp needs): a tap there costs the efficiency star, never the level. Clay + Clay → Brass, then the NEW Brass + the waiting Brass → Toran.",
    aha: "A merge result is a new piece — merge it again to climb a second tier.",
    hint: "Merge again: two Brass Diyas make a Toran Lamp.",
    board: [". . . .", "L2 . @0 .", ". @1 . L1"],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3")],
  },
  {
    title: "Two baskets", role: "teach", mechanics: ["merge", "generator", "orders"],
    intent: "Three generators, two orders. The Toran needs two Lamp Shelf taps, the Garland three Flower Basket taps; the Sweet Kitchen between them makes nothing either order wants, so every tap there is wasted (six Sparks: one waste is forgiven, two are not).",
    aha: "Read the order tray first; every tap should feed an order.",
    hint: "Tap only the generators whose items the orders need.",
    board: ["L1 . . . F1", ". @0 @2 @1 .", ". . W1 . .", "L1 . . . ."],
    gens: [G("lamp", "L1"), G("flower", "F1"), G("sweets", "W1")], orders: [O("L3"), O("F3")],
  },
  {
    title: "The swept courtyard", role: "teach", mechanics: ["crates", "orders"],
    intent: "Crates show what is inside and cost 1 Spark to open — so compare the lid with a tap. The lamp crate holds a BRASS Diya (tier 2 = two Lamp Shelf taps for one Spark: a bargain). The flower crate's lid shows a single bud (tier 1): exactly what one Flower Basket tap gives, no saving. The sweets crate holds a Laddu Plate no order wants. Toran = Clay Diya + crate Brass + one tap; Garland = the bud + three more buds from either source. Five Sparks of work; six to spend.",
    aha: "A crate is worth what its lid saves: tier 2 = half price, tier 1 = just a tap in a box, the wrong chain = nothing.",
    hint: "Crates cost 1 Spark. Compare each lid with what a tap would give.",
    board: ["c:L2 . . c:F1", ". @0 @1 .", "L1 . . F1", ". c:W2 . ."],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3"), O("F3")],
  },
  {
    title: "Dadi's lamps", role: "story", mechanics: ["merge", "orders", "crates"],
    intent: "Story beat (Dadi's letter): three Clay Diyas in three corners, a Laddu by the door and a crate holding a Laddu PLATE. The Toran needs one Lamp Shelf tap. The Laddu Box needs four Laddus' worth: the crate's Plate (one Spark for two Laddus) plus the waiting Laddu and one Sweet Kitchen tap. Three Sparks of work and one to spare; skip the crate and the box costs one tap more — the spare Spark and the efficiency star.",
    aha: "Count the pieces already on the board; the cheapest tap is the one you don't need.",
    board: ["L1 . . . L1", ". . @0 . .", ". W1 . c:W2 .", "@1 . . . .", "L1 . . . ."],
    gens: [G("lamp", "L1"), G("sweets", "W1")], orders: [O("L3"), O("W3")],
  },
  {
    title: "A lamp for every door", role: "practise", mechanics: ["merge", "orders", "crates", "generator"],
    intent: "Three lamp orders of two sizes (Brass x2, Toran x1) and a Marigold. Two Brass Diyas should go straight to the tray, not into each other; the Toran comes from the clay pieces and the crates, and only the flower needs a fresh tap.",
    aha: "Don't merge everything up — split your pieces to fit the orders.",
    board: ["L1 . . . c:L2", ". . @0 . .", "L2 . . . L1", ". F1 . @1 c:L1"],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L2", 2), O("L3"), O("F2")],
  },
  {
    title: "The flower-seller's queue", role: "practise", mechanics: ["crates", "orders", "generator"],
    intent: "First mixed queue: the Flower Basket's visible queue is bud, bud, LADDU, bud. The orders are a Garland (four buds; one waits) and a Laddu Plate (two laddus; one waits). The crate beside the laddu shows exactly the missing Laddu — but the basket's third tap is a laddu anyway, on the way to the fourth bud, so that crate is a trap that buys what the queue gives free. The bud crate on the right is harmless (a bud for a Spark, same as a tap). Four Sparks: four taps, or the bud crate + three taps — never the laddu crate.",
    aha: "Read the queue before you buy: the crate holds a piece the generator is about to give you.",
    board: [". . . . F1", "W1 c:W1 @0 . c:F1", ". . . . .", "# . . . #"],
    gens: [G("flower", "F1 F1 W1 F1")], orders: [O("F3"), O("W2")],
  },
  {
    title: "The first Big Merge", role: "teach", mechanics: ["big merge"],
    intent: "Big Merge unlocks, as readable as it gets: three Clay Diyas wait and the orders are a Toran Lamp and a Brass Diya. Two Lamp Shelf taps make five of a kind, and one drop turns them into the Toran Lamp plus a bonus Brass Diya — both orders, two Sparks. Pairing them up instead still wins, but needs a third tap and costs the efficiency star.",
    aha: "Five of a kind skip a tier AND pay a bonus piece — gather five before you merge.",
    hint: "BIG MERGE: get 5 of a kind, then drop one on another — all 5 merge, skip a tier and pay a bonus.",
    board: ["L1 . . . L1", ". . @0 . .", ". . L1 . ."],
    gens: [G("lamp", "L1")], orders: [O("L3"), O("L2")],
  },
  {
    title: "Petal shower", role: "practise", mechanics: ["big merge", "generator"],
    intent: "Big Merge practise with a new use for the bonus: two Garlands, four Marigold Buds in the corners and one Marigold in the middle. One Flower Basket tap makes five buds; the Big Merge gives the first Garland AND a bonus Marigold — which pairs with the waiting Marigold for the second Garland. Merging the buds in pairs first needs an extra tap.",
    aha: "The bonus piece doesn't have to be an order — it can be the partner a waiting piece needs.",
    board: ["F1 . . . F1", ". . @0 . .", ". F2 . . .", "F1 . . . F1"],
    gens: [G("flower", "F1")], orders: [O("F3", 2)],
  },
  {
    title: "Laddus for the lane", role: "story", mechanics: ["big merge", "crates"],
    intent: "Story beat (the neighbours return): a Laddu Box and two Laddu Plates. Three Laddus wait; two Sweet Kitchen taps make five, and the Big Merge gives the Box + one Plate; the second Plate is in the Laddu crate. The lamp crate is a Diwali leftover nobody here needs. Four Sparks: the Big-Merge plan uses three, so pairing the laddus by habit is recoverable (it eats the spare Spark) — a Spark spent on a leftover crate as well is not.",
    aha: "Plan the Big Merge so its bonus piece fills an order, then use the crate for the rest.",
    board: ["W1 . . c:L2 . W1", ". . . @0 . .", ". . c:W2 . . W1"],
    gens: [G("sweets", "W1")], orders: [O("W3"), O("W2", 2)],
  },
  {
    title: "Fireworks night", role: "teach", mechanics: ["fireworks", "crates"],
    intent: "Fireworks teach: ten crates with printed lids, three Sparks, no generators; one Firework opens a 3x3 for free. No 3x3 holds both orders. Aimed at the bud crate in the middle row it opens the whole Laddu Box and two buds, and one Spark on the corner Marigold crate finishes the Garland. Most other aims need two crates by hand — still a win; a burst on the lonely corner wastes the Firework.",
    aha: "Read the lids and count: aim where one burst covers one order whole and most of the other.",
    hint: "FIREWORKS open every crate in a 3x3 square. Read the crate lids, then aim.",
    board: [". . c:W1 c:L1 .", ". c:W2 c:F1 c:W1 c:F1", "c:F2 . c:L2 c:F1 c:W1"],
    gens: [], orders: [O("W3"), O("F3")], boosters: { fireworks: 1 },
  },
  {
    title: "Not too big", role: "twist", mechanics: ["big merge", "crates"],
    intent: "Twist on Big Merge, and nothing else on the board: two Toran Lamps and a Brass Diya are ordered. Four Brass Diyas wait and the crate holds a fifth. Open the crate while four Brass Diyas are still loose and the next Brass-on-Brass drop Big-Merges all five into a Rangoli Lamp nobody wants — with no generator, there is no way back. Merge the two pairs into the Torans first, THEN open the crate for the Brass order (or, crate open, hand one Brass to the tray before any merge).",
    aha: "Five of a kind always Big-Merge — merge your pairs BEFORE the fifth arrives when you need two of the next tier.",
    board: ["L2 . . . L2", ". . c:L2 . .", "L2 . . . L2"],
    gens: [], orders: [O("L3", 2), O("L2")],
  },
  {
    title: "Diwali eve", role: "boss", mechanics: ["big merge", "crates", "fireworks", "orders"],
    intent: "Chapter 1 boss: Rangoli Lamp, Toran Lamp, Garland and Laddu Box with one Lamp Shelf and one Firework. Every flower and sweet piece sits in one 3x3 of crates with a Brass Diya crate, so the Firework goes in its centre. Then three Brass Diyas plus the freed one make four, two taps make the fifth, and one Big Merge pays the Rangoli AND the Toran. Pairing the four first leaves the Toran four taps away.",
    aha: "Combine everything: one Firework on the cluster that holds three orders, then wait for the fifth Brass Diya before merging.",
    board: ["L2 . . . L2", ". . @0 . .", "c:F2 c:W1 c:L2 . .", "c:W2 . c:F2 . L2", "c:W1 . . . ."],
    gens: [G("lamp", "L1")], orders: [O("L4"), O("L3"), O("F3"), O("W3")], boosters: { fireworks: 1 },
  },

  /* ───────── Chapter 2 · Onam Courtyard: tangled thread, Needle, recipes ───────── */
  {
    title: "Tangled looms", role: "teach", mechanics: ["thread", "merge"],
    intent: "Thread teach: two Cotton Spools are tangled. A merge pulls one layer of thread from the 8 cells around the result — make the cloth in the middle cell and both knots fall at once.",
    aha: "Where you drop matters: one merge between two knots frees both.",
    hint: "Merge NEXT TO tangled thread to pull it loose.",
    board: ["C1 t:C1 . t:C1 C1", ". . @0 . ."],
    gens: [G("loom", "C1")], orders: [O("C2", 2)], clear: ["thread"],
  },
  {
    title: "Double knot", role: "practise", mechanics: ["thread", "merge"],
    intent: "Meera wants FOUR Cotton Cloths and one sits in a two-layer knot. Two cloths already wait side by side in the corner — the obvious pair to drag beside the knot for a hit, and a decoy: merging them makes a Silk Bolt nobody ordered and throws away two of the four cloths. The two Clay Diyas nobody ordered flank the knot instead: merging them is a free hit, and the two spools merged beside it are the second hit and the fourth cloth. No Loom today: every cloth is on the board, so a wasted cloth pair can't be bought back. The Lamp Shelf beside the knot is the safety net — its Clay Diyas are more junk to merge beside the knot, one Spark each.",
    aha: "Any merge pulls thread — even pieces no order wants. Spend the junk pair on the knot, not the pair you need to deliver.",
    board: ["C2 C2 . . . #", ". . L1 t2:C2 . .", ". . . @0 L1 .", "# . . C1 . C1"],
    gens: [G("lamp", "L1")], orders: [O("C2", 4)], clear: ["thread"],
  },
  {
    title: "Meera's needle", role: "teach", mechanics: ["needle", "thread"],
    intent: "Needle teach: one two-layer knot in the far corner, and it hides the Cotton Cloth the Silk Bolt needs (Silk Bolt = that cloth + the two spools merged). The Needle unpicks both layers in one go. Without it the corner needs two merges beside it — the spool pair is one, and the second costs two extra Loom taps. Needle the knot, merge the spools, one Flower Basket tap for the Marigold: one Spark of work.",
    aha: "The Needle buys back the merges a far knot would cost — use it on the knot that hides what you need.",
    hint: "The NEEDLE removes every layer of one knot.",
    board: ["t2:C2 . . . . .", ". . . . C1 .", ". . @0 . . F1", ". C1 . . @1 ."],
    gens: [G("loom", "C1"), G("flower", "F1")], orders: [O("C3"), O("F2")], clear: ["thread"], boosters: { needle: 1 },
  },
  {
    title: "The tangled loom", role: "twist", mechanics: ["thread", "merge", "generator"],
    intent: "Twist: this time the Loom Basket ITSELF is wrapped in a double knot and cannot be tapped. The four spools in the corners are all you have until it is free — drag them in so both pair-merges land right beside the loom: two merges, two layers, and the Loom is yours. A merge landed away from it pulls nothing, and the spools are too few to waste one.",
    aha: "Thread can trap the generator itself — your first merges must happen beside it.",
    board: ["C1 . . . C1", ". . t2:@0 . .", "C1 . . . C1"],
    gens: [G("loom", "C1")], orders: [O("C3"), O("C2")], clear: ["thread"],
  },
  {
    title: "Meera's dye vat", role: "teach", mechanics: ["recipes"],
    intent: "Recipe teach: different items can combine. Cotton Cloth + Dye Pot = Sari; Cotton Spool + Dye Pot = Dupatta. Merge two of the three spools into cloth, keep the third for the dupatta.",
    aha: "The spool you DON'T merge becomes the dupatta.",
    hint: "RECIPES: drop a Dye Pot on cloth for a Sari, on a spool for a Dupatta.",
    board: ["C1 . . .", "C1 . @0 .", ". C1 . ."],
    gens: [G("dye", "D1")], orders: [O("Sa"), O("Du")],
  },
  {
    title: "Precious dye", role: "practise", mechanics: ["recipes", "generator"],
    intent: "The Dye Stand costs 2 Sparks a tap. Two Saris and a Dupatta need exactly three dye pots — the one already on the board plus two taps; build all cloth from cheap spools before you dye.",
    aha: "Spend the expensive generator only on what the recipes need.",
    board: ["C1 . . D1 .", ". @0 . . C1", ". . . @1 .", "C2 . . . ."],
    gens: [G("loom", "C1"), G("dye", "D1", 2)], orders: [O("Sa", 2), O("Du")],
  },
  {
    title: "Courtyard garlands", role: "story", mechanics: ["big merge", "thread"],
    intent: "Story beat (Meera returns): two Garlands, and the second Garland's Marigold is knotted in the corner behind bare ground — no pair merge can ever land beside it. Only a Big Merge reaches it: its ring hits every cell two steps away. Four buds wait; one Flower Basket tap makes five, and the Big Merge must land on the centre bud (two steps from the knot): it pays a Garland plus a bonus Marigold, the ring frees the knotted Marigold, and the two Marigolds are the second Garland. Pair any buds first and the five never come together again.",
    aha: "The Big Merge's ring reaches two cells — the only way past bare ground. Drop it on the bud two steps from the knot.",
    board: ["t:F2 # . . .", "# # . @0 .", ". . F1 . F1", "F1 . . . .", ". . F1 . ."],
    gens: [G("flower", "F1")], orders: [O("F3", 2)], clear: ["thread"],
  },
  {
    title: "Dye under knots", role: "combine", mechanics: ["thread", "recipes"],
    intent: "Combine thread + recipes: one Dye Pot is free, the other is tangled in the corner — and the two spools touching that knot are the obvious pair. Merge them right there: the cloth lands beside the knot and frees the very dye you will put on it. The far spool and one Loom tap make the second cloth; two Saris with no expensive Dye Stand tap.",
    aha: "Free the dye with the very cloth you are going to dye.",
    board: ["t:D1 C1 . . D1", "C1 . . . C1", ". . @0 . .", ". . . @1 ."],
    gens: [G("loom", "C1"), G("dye", "D1", 2)], orders: [O("Sa", 2)], clear: ["thread"],
  },
  {
    title: "Stitch by recipe", role: "twist", mechanics: ["recipes", "thread"],
    intent: "Twist: recipes count as merges. The knotted spool sits beside a free spool and a Dye Pot — dyeing the free spool into a Dupatta right there pulls the knot, and the freed spool becomes the Sari's cloth; the Sari's Dye Pot waits in the crate.",
    aha: "Recipes pull thread too — craft beside the knot.",
    board: ["C1 t:C1 . .", "D1 . . .", ". . @0 C1", ". c:D1 . ."],
    gens: [G("loom", "C1")], orders: [O("Du"), O("Sa")], clear: ["thread"],
  },
  {
    title: "Swing day", role: "breather", mechanics: ["needle", "thread", "merge"],
    intent: "Short breather after the recipe spike, with a new target for the Needle: the Flower Basket ITSELF is under a two-layer knot, and the Garland needs two of its buds. Needle the basket, tap it twice, and the four buds make the Garland. (No Needle? Land the bud merge beside the basket for one layer — the second layer needs another merge there.)",
    aha: "The Needle can free a generator, not just a piece.",
    board: [". . # . F1", ". . . . .", "# . . t2:@0 .", "F1 . . . #"],
    gens: [G("flower", "F1")], orders: [O("F3")], clear: ["thread"], boosters: { needle: 1 },
  },
  {
    title: "Silk and saris", role: "combine", mechanics: ["big merge", "recipes"],
    intent: "Combine Big Merge + recipe: a Silk Bolt and a Sari. Four spools wait and the only Dye Pot is in the crate (no Dye Stand). One Loom tap makes five spools, and the Big Merge gives the Silk Bolt + a bonus Cotton Cloth — that bonus cloth plus the crate's dye IS the Sari. Dropping the dye on a bare spool makes a Dupatta nobody ordered and loses the only dye.",
    aha: "The Big Merge bonus is the next recipe's input.",
    board: ["C1 . . . C1", ". . @0 . .", "C1 . . . c:D1", ". . C1 . ."],
    gens: [G("loom", "C1")], orders: [O("C3"), O("Sa")],
  },
  {
    title: "Meera's loom", role: "story", mechanics: ["thread", "recipes", "big merge"],
    intent: "Story beat (the broken loom): single knots guard both Dye Pots in the top corners and the Cotton Cloth in the middle. Pair merges beside each knot free them one by one; or tap the Loom once and a Big Merge of five spools landed on the middle spool rings all three knots at once — its bonus cloth is one of the Saris.",
    aha: "One Big-Merge ring reaches two cells in every direction — land it in the middle to hit all three knots.",
    board: ["t:D1 C1 . C1 t:D1", "C1 . t:C2 . C1", ". . . . .", ". @0 . . ."],
    gens: [G("loom", "C1")], orders: [O("Sa", 2), O("C2")], clear: ["thread"],
  },
  {
    title: "Onam feast stall", role: "boss", mechanics: ["thread", "needle", "recipes", "crates"],
    intent: "Chapter 2 boss: two Saris and a Garland, and both Dye Pots on the board are knotted. The top-left knot is walled in by bare ground (#): no pair merge can ever land beside it, so it is the Needle's clear target. The right-hand knot sits beside the cloth: land a spool merge next to it (on the spool above it, or on the cell the Loom drops into) and it falls while you make the Saris' cloth. The Garland is a side job: the Marigold on the board plus the one in the crate. Needle the right knot by mistake and only a five-spool Big Merge on the top spool can reach over the bare ground — it still wins, but costs three extra Sparks. The Dye Stand (2 Sparks a pot) is the fallback if a dye is wasted on a bare spool.",
    aha: "Needle the knot no merge can reach, and merge the other one open with the cloth you need anyway.",
    board: ["t:D1 # . . . .", "# # C1 . C1 .", ". . . @0 . t:D1", "F2 . . . . .", ". . c:F2 . @1 C1"],
    gens: [G("loom", "C1"), G("dye", "D1", 2)],
    orders: [O("Sa", 2), O("F3")], clear: ["thread"], boosters: { needle: 1 },
  },

  /* ───────── Chapter 3 · Eid Night Market: trunks + keys, spices, 3-input masala ───────── */
  {
    title: "The locked trunk", role: "teach", mechanics: ["trunks & keys"],
    intent: "Trunk teach: three trunks with brass locks, and every trunk shows what is inside. The two top trunks hold the Toran Lamps the orders want; the two bottom ones hold Red Chillies nobody ordered — and they sit right where a tired thumb drops a key. The Key Smith makes Brass Keys: one on each lamp trunk, chillies stay locked.",
    aha: "Trunks hold treasure; a key of the lock's tier opens them — but only open what an order needs.",
    hint: "Drop a key on a trunk to open it.",
    board: ["k1:L3 . . . k1:L3", ". . @0 . .", "k1:S1 . . . k1:S1"],
    gens: [G("key", "K1")], orders: [O("L3", 2)],
  },
  {
    title: "The silver lock", role: "practise", mechanics: ["trunks & keys", "merge"],
    intent: "Keys are a chain too: the Laddu Box is behind a SILVER lock, and a Silver Key is two Brass Keys merged. One Brass Key waits beside the brass trunk with the Marigold; the other brass trunk plainly holds a Red Chilli no order wants. Two taps are enough (one key for the Marigold trunk, one merged with the waiting key for the silver lock), and the third Spark forgives one key wasted on the chilli.",
    aha: "A silver lock takes a merged key — two brass keys become one silver — and the chilli trunk is not worth either.",
    board: ["k2:W3 . . . k1:S1", ". . @0 . .", ". . . K1 k1:F2"],
    gens: [G("key", "K1")], orders: [O("W3"), O("F2")],
  },
  {
    title: "Lantern stalls", role: "twist", mechanics: ["trunks & keys", "merge", "generator"],
    intent: "Twist on trunks — a price list: ONE Brass Key on the board, two brass trunks (a Toran Lamp on the left, a Garland on the right), and the orders want both. Every generator shows its price: Lamp Shelf 1 Spark, Flower Basket 2, Key Smith a steep 4 for a second key. The shut trunk's order must be built or bought: the Toran = the Clay Diya + three lamp taps (3 Sparks); the Garland = two buds + two flower taps (4 Sparks); a second key = 4. Spend the free key on the GARLAND trunk and build the cheap lamps: 3 Sparks. Either other plan costs 4 — the whole budget, and the efficiency star.",
    aha: "One key, two trunks: open the one whose treasure is expensive to build — read the generators' prices.",
    board: ["k1:L3 . . . . k1:F3", ". . . K1 . .", "L1 . @0 . @1 F1", ". . . @2 . F1"],
    gens: [G("lamp", "L1"), G("flower", "F1", 2), G("key", "K1", 4)], orders: [O("L3"), O("F3")],
  },
  {
    title: "Imran's ledger", role: "story", mechanics: ["trunks & keys", "recipes", "crates"],
    intent: "Story beat (Chacha Imran's ledger room): three trunks — silver (the Dye Pot for the Sari), brass (the Marigold for the Garland) and brass (a Red Chilli nobody wants). The crate and the Key Smith compete for the same Sparks: the crate's Silver Key costs 1 Spark where the smith needs two taps and a merge, and a Silver Key fits a brass lock too — so spend it on the SILVER trunk and buy one brass key for the Marigold. Two Sparks of work, one to forgive a key wasted on the chilli trunk.",
    aha: "Match each key to the lock only it can open: the crate's Silver Key belongs on the silver trunk, the cheap brass key on the brass one.",
    board: ["k2:D1 . . . . C1", ". . c:K2 . . .", "C1 . . @0 . F1", ". k1:S1 . . . .", "F1 . . . . k1:F2"],
    gens: [G("key", "K1")], orders: [O("Sa"), O("F3")],
  },
  {
    title: "Chacha Imran's masala", role: "teach", mechanics: ["3-input recipe"],
    intent: "3-input recipe teach: Masala Tin = Chilli Bunch + Pepper Pods (Spice Mix) + Turmeric Root. Two Red Chillies wait in opposite corners; the top Spice Stall's queue shows pepper, then turmeric. The second stall only makes chillies — it looks like part of the recipe, but the two chillies on the board are already the bunch, so every tap there is a decoy. Merge the chillies, add the pepper for the Spice Mix, then the turmeric: two taps on the right stall.",
    aha: "Three ingredients in two steps: mix first, then add turmeric.",
    hint: "MASALA: Chilli Bunch + Pepper = Spice Mix; Spice Mix + Turmeric = Masala Tin.",
    board: ["S1 . . . .", ". . @0 . .", ". . . . S1", ". @1 . . ."],
    gens: [G("spice", "P1 T1"), G("spice", "S1")], orders: [O("Ms")],
  },
  {
    title: "Two tins", role: "practise", mechanics: ["3-input recipe", "generator"],
    intent: "Two Masala Tins. The stall's queue (chilli, pepper, chilli, turmeric) means eight taps — but a Chilli Bunch on the board and a pepper crate cut that to five.",
    aha: "Read the queue: use the board's pieces so the stall only makes what's missing.",
    board: ["S2 . . . .", ". . @0 . .", ". c:P1 . . T1", ". . . . ."],
    gens: [G("spice", "S1 P1 S1 T1")], orders: [O("Ms", 2)],
  },
  {
    title: "Spices in the trunk", role: "twist", mechanics: ["3-input recipe", "trunks & keys"],
    intent: "Twist on the masala: the Spice Stall's visible queue runs chilli, pepper, chilli, chilli, turmeric — the turmeric is FIVE taps away. One Red Chilli waits, and a brass trunk holds a Turmeric Root. Two stall taps (chilli, pepper) make the Spice Mix; then one Key Smith tap opens the trunk instead of three more stall taps.",
    aha: "Read the queue: when the stall's turmeric is far away, the trunk is the shortcut.",
    board: ["k1:T1 . . . S1", ". @0 . @1 .", ". . . . ."],
    gens: [G("key", "K1"), G("spice", "S1 P1 S1 S1 T1")], orders: [O("Ms")], clear: ["trunk"],
  },
  {
    title: "Moonlit stalls", role: "breather", mechanics: ["trunks & keys", "merge", "big merge", "orders"],
    intent: "Free-play breather on a pretty board: the stalls are laid out as an Eid lantern, with a Brass Diya at each of its four points and a Laddu Box in the silver trunk at its heart. Two orders, no traps: pair the points into two Torans and the Torans into the Rangoli Lamp; one Key Smith tap plus the Brass Key at the lantern's top make the Silver Key for the heart. A Spark to spare.",
    aha: "Light the lantern from its points inward — every merge closes the shape.",
    board: ["# # # K1 # # #", "# # L2 . L2 # #", "# # . @0 . # #", "# . . k2:W3 . . #", "# # . . . # #", "# # L2 . L2 # #", "# # # . # # #"],
    gens: [G("key", "K1")], orders: [O("L4"), O("W3")], clear: ["trunk"],
  },
  {
    title: "The old friendship", role: "story", mechanics: ["trunks & keys", "merge"],
    intent: "Story beat (the neighbours reconcile): the Rangoli Lamp sits behind a filigree lock (two Silver = four Brass Keys). One Brass Key waits — and the brass trunk in the corner holds a SILVER key. Spend the waiting brass key on that trunk and the silver key inside is half the filigree; two Key Smith taps make the other half. Building the filigree from brass keys alone takes three taps. The Toran Lamp is the Brass Diya by the door plus a Clay Diya and one Lamp Shelf tap — so the Key Smith gets exactly two taps, not three.",
    aha: "A trunk can hold a key worth more than the key that opens it.",
    board: ["k3:L4 . . . k1:K2", ". . @0 . .", "K1 . . . L2", ". L1 . @1 ."],
    gens: [G("key", "K1"), G("lamp", "L1")], orders: [O("L4"), O("L3")], clear: ["trunk"],
  },
  {
    title: "Night market rush", role: "combine", mechanics: ["3-input recipe", "trunks & keys", "recipes"],
    intent: "Combine: a Masala Tin and a Sari behind two trunks — the brass one holds the turmeric, the silver one the Dye Pot. The Key Smith's visible queue makes a SILVER key first, then a brass one. A Silver Key opens a brass lock too, so it is tempting to spend it on the nearest trunk — but then the silver lock waits a whole lap of the queue. Silver key on the silver trunk, brass on the brass; the two chillies and one pepper tap make the Spice Mix.",
    aha: "Read the key queue: give each key the lock that needs its tier, not the first trunk you see.",
    board: ["k1:T1 . . . k2:D1", ". S1 . S1 .", ". . @0 . .", "C2 . . @1 ."],
    gens: [G("key", "K2 K1"), G("spice", "P1")], orders: [O("Ms"), O("Sa")], clear: ["trunk"],
  },
  {
    title: "Lantern alley", role: "combine", mechanics: ["big merge", "trunks & keys", "orders"],
    intent: "Big Merge meets the order tray: five Clay Diyas line the alley and the orders want a Toran Lamp, a Brass Diya AND a single Clay Diya for the shrine. Handing over a Clay Diya first feels like free progress — but it leaves four, and four only pair: the Brass Diya then costs two Lamp Shelf taps. Big-Merge the five first (Toran + bonus Brass, both orders), then one tap makes the shrine's Clay Diya. The Garland waits in the silver trunk: the Brass Key on the board plus one Key Smith tap.",
    aha: "Don't deliver the fifth piece: Big-Merge first, then let the generator refill the small order.",
    board: ["L1 . . . . k2:F3", ". . L1 . . .", ". . . @0 L1 .", "L1 . . . . K1", "# . L1 @1 . #"],
    gens: [G("lamp", "L1"), G("key", "K1")], orders: [O("L3"), O("L2"), O("L1"), O("F3")],
  },
  {
    title: "Imran's cart", role: "combine", mechanics: ["3-input recipe", "recipes", "generator"],
    intent: "One cart, three recipes: Chacha Imran's cart has a single visible queue — spool, dye, chilli, spool, dye — shared by a Sari, a Dupatta and a Masala Tin. A Red Chilli, a spool, the pepper and the turmeric wait, so exactly ONE lap (five taps) covers all three. The lap holds only two dye pots: one must go on a single spool (Dupatta), the other on two merged spools (Sari). Dye both bare spools and the Sari needs a second lap.",
    aha: "One queue feeds every recipe: count the dye pots in a lap and give each one a different job.",
    board: ["S1 . . P1 C1", ". . @0 . .", ". . T1 . ."],
    gens: [G("harvest", "C1 D1 S1 C1 D1")], orders: [O("Sa"), O("Du"), O("Ms")],
  },
  {
    title: "Eid lantern night", role: "boss", mechanics: ["3-input recipe", "trunks & keys", "big merge", "recipes"],
    intent: "Chapter 3 boss: Rangoli Lamp, Masala Tin and Sari behind three trunks — brass (turmeric), silver (Dye Pot) and filigree (Rangoli Lamp). Two Brass Keys wait by the trunks: three Key Smith taps make FIVE, and one Big Merge forges a Filigree Key plus a bonus Silver Key — both big locks at once. One more brass key opens the turmeric; one stall tap gives the pepper for the Chilli Bunch. Pairing the keys instead needs seven brass keys: the whole budget, with nothing left for a mistake, and no efficiency star.",
    aha: "Five brass keys Big-Merge into the filigree AND the silver key — gather five before you merge any.",
    board: ["k1:T1 . . K1 . k2:D1", ". . . . . .", ". . @0 . . S2", ". . . @1 . .", "C2 . k3:L4 . K1 ."],
    gens: [G("key", "K1"), G("spice", "P1")], orders: [O("L4"), O("Ms"), O("Sa")], clear: ["trunk"],
  },

  /* ───────── Chapter 4 · Puja & Pongal Pavilions: sealed jars, multi-stage orders, Sweep ───────── */
  {
    title: "Sealed jars", role: "teach", mechanics: ["jars"],
    intent: "Jar teach: a sealed jar holds a Laddu Box and cracks after three merges beside it. Build your own Laddu Box right next to it — the three merges that make it are exactly the three cracks — then join the two boxes into a Mithai Box.",
    aha: "Build beside the jar: the merges you need anyway are the cracks.",
    hint: "Merge 3 times next to a jar to crack it open.",
    board: ["W1 . j:W3 .", ". @0 . W1", "# . . #"],
    gens: [G("sweets", "W1")], orders: [O("W4")], clear: ["jar"],
  },
  {
    title: "Ring of lamps", role: "practise", mechanics: ["jars", "big merge"],
    intent: "Two double-sealed jars in the top corners each hold a Toran Lamp, and the Rangoli order needs both. Four Clay Diyas wait: one Lamp Shelf tap makes five, and the Big Merge's 5x5 ring cracks both jars once while paying the Toran + Brass orders. The rest is placement: only the top-centre cell and the one under it touch both jars, so later pair merges belong there.",
    aha: "Find the one cell that touches both jars — and keep landing merges there.",
    board: ["j2:L3 . j2:L3", "L1 . L1", "L1 @0 L1", ". . ."],
    gens: [G("lamp", "L1")], orders: [O("L4"), O("L3"), O("L2")], clear: ["jar"],
  },
  {
    title: "Pandal flowers", role: "breather", mechanics: ["jars", "trunks & keys", "merge"],
    intent: "Breather with a surprise: the jar holds a KEY. The pandal's Toran Lamp is locked in the trunk, and its Brass Key is sealed in the jar among the buds. The Garland needs three merges (two bud pairs, then the two Marigolds) and every one of them lands beside the jar, so building the Garland cracks it open; drop the key on the trunk for the Toran. One Flower Basket tap is all it takes — a second bud would make five and Big-Merge away the cracks.",
    aha: "A jar can hold the key to something else — the merges you need anyway open both.",
    board: ["F1 . j:K1 . k1:L3", ". F1 . F1 .", ". . @0 . ."],
    gens: [G("flower", "F1")], orders: [O("F3"), O("L3")], clear: ["jar", "trunk"],
  },
  {
    title: "Jars and knots", role: "combine", mechanics: ["jars", "thread", "recipes"],
    intent: "Combine jars + thread: the Dye Pot is sealed between two knotted spools, and the orders are a Sari and a Silk Bolt (six spools of cloth). The Loom drops its spools right under the jar, where a merge touches the jar and both knots — merges made anywhere else leave the jar short of cracks.",
    aha: "One cell touches all three blockers — make every merge on it.",
    board: [". t:C1 j:D1 t:C1 .", "C1 . . . C1", ". . @0 . ."],
    gens: [G("loom", "C1")], orders: [O("Sa"), O("C3")], clear: ["jar", "thread"],
  },
  {
    title: "The Pongal pot", role: "teach", mechanics: ["multi-stage orders"],
    intent: "Staged orders teach: the card asks for a Rice Pot, and only then for a Sweet Pongal (Rice Pot + Ghee Pot). The two waiting Rice Sacks are stage one. While it is on the card, get stage two ready: two Harvest Cart taps for the second Rice Pot and one Hearth tap for the ghee — three Sparks, each generator exactly what the next stage needs.",
    aha: "Stage cards unlock in order — have the next stage's pieces ready.",
    hint: "STAGED ORDERS: finish the first card to unlock the next.",
    board: ["R1 . . .", ". @0 @1 .", ". . . R1"],
    gens: [G("harvest", "R1"), G("hearth", "G1")], orders: [O("R2"), O("Po", 1, { after: 0 })],
  },
  {
    title: "Harvest kitchen", role: "practise", mechanics: ["multi-stage orders", "jars", "recipes"],
    intent: "Practise stages with a jar: Rice Pot → Sweet Pongal → Rice Pot, and the jar holds the last Rice Pot. Its three cracks come from the three things you make anyway, if they land beside it: two rice merges and the Pongal recipe (a recipe cracks a jar too). And the Hearth that makes the Pongal's ghee is knotted: one rice merge must also land beside IT before stage two — so the first Rice Pot belongs on the cell that touches the knot.",
    aha: "A recipe is a merge too: the Pongal you cook beside the jar is its third crack.",
    board: [". R1 j:R2 . .", ". . @0 . R1", ". t:@1 . . ."],
    gens: [G("harvest", "R1"), G("hearth", "G1")], orders: [O("R2"), O("Po", 1, { after: 0 }), O("R2", 1, { after: 1 })], clear: ["jar", "thread"],
  },
  {
    title: "Rival pavilion", role: "twist", mechanics: ["multi-stage orders", "big merge"],
    intent: "Twist: the rival pavilion's second stage is a Feast Platter = the Sweet Pongal already on the table + a Laddu Plate. Five Sweet Kitchen taps make five Laddus, and the Big Merge pays the Laddu Box for stage one AND a bonus Laddu Plate — the platter's missing half. Pair the laddus before the fifth arrives and the plate costs a tap more than the bar allows.",
    aha: "The Big Merge bonus Laddu Plate IS the platter's missing piece — so wait for the fifth Laddu.",
    board: [". . Po . .", ". . . . .", ". . @0 . ."],
    gens: [G("sweets", "W1")], orders: [O("W3"), O("Fp", 1, { after: 0 })],
  },
  {
    title: "Harvest sweep", role: "teach", mechanics: ["sweep", "jars"],
    intent: "Sweep teach: four jars in the top row hold the Laddu Plates, Marigold and Brass Diya the orders want; a fifth jar by the kitchen holds a Laddu nobody needs. A Sweep cracks every blocker in ONE row once — aim it at the top row and it is four cracks for one tap; aimed at the kitchen row it is one wasted crack. Then laddu merges in the second row, right under the jars, finish them.",
    aha: "Aim the Sweep at the row with the most blockers in it — and leave the lone jar alone.",
    hint: "SWEEP cracks every blocker in one row.",
    board: ["j:W2 j:F2 j:W2 j:L2", ". . . .", "j:W1 . @0 .", ". . . ."],
    gens: [G("sweets", "W1")], orders: [O("W3"), O("F2"), O("L2")], boosters: { sweep: 1 },
  },
  {
    title: "Durga's lamps", role: "breather", mechanics: ["jars", "sweep", "merge"],
    intent: "Easy breather after the Sweep teach, one idea only: two Toran Lamps for the pandal. Two of the four Brass Diyas sit in half-cracked jars (two cracks left) at either end of the top row — one Sweep cracks both at once, then one lamp merge beside each jar opens it. Two Clay Diyas wait under the jars and two Lamp Shelf taps make the other pair. Nothing else on the board, nothing to decode: the two taps are the whole budget.",
    aha: "Two jars in one row = one Sweep for both — then one merge beside each.",
    board: ["j2:L2 . . . j2:L2", "L1 . @0 . .", ". . . . L1"],
    gens: [G("lamp", "L1")], orders: [O("L3", 2)], clear: ["jar"], boosters: { sweep: 1 },
  },
  {
    title: "The secret recipe", role: "story", mechanics: ["multi-stage orders", "3-input recipe", "jars"],
    intent: "Story beat (the secret recipe): a Masala Tin stage after a Rice Pot stage, plus a second Rice Pot for the committee. The pepper is sealed in a jar right above the rice — the two rice merges you need anyway crack it twice, and dropping the far chilli on the one beside the jar gives the third crack. Two Harvest Cart taps for rice, one Spice Stall tap for the turmeric.",
    aha: "Crack the jar with the merges you need anyway — rice twice, chilli once.",
    board: [". . j:P1 S1 .", ". R1 . R1 .", ". @1 . @0 .", "S1 . . . ."],
    gens: [G("harvest", "R1"), G("spice", "T1")], orders: [O("R2"), O("Ms", 1, { after: 0 }), O("R2")], clear: ["jar"],
  },
  {
    title: "Kolam corridors", role: "combine", mechanics: ["jars", "thread", "sweep", "recipes"],
    intent: "Combine: every blocker on the board is in the top row — a knotted cloth, two half-cracked dye jars (two cracks left) and a knotted spool. One Sweep on that row is four hits: both knots fall and each jar is down to its last crack. Then two spool merges, each landed in the second row right under a jar, open both jars — and the dye goes onto the cloth for two Saris, with the third cloth for the kolam order. Sweep the second row by mistake and you have hit nothing.",
    aha: "Count blockers per row: sweep the row with four, then land each spool merge right under a jar.",
    board: ["t:C2 j2:D1 . . j2:D1 t:C1", ". . . . . .", ". C1 . @0 C1 .", "# . . . . #"],
    gens: [G("loom", "C1")], orders: [O("Sa", 2), O("C2")], clear: ["jar", "thread"], boosters: { sweep: 1 },
  },
  {
    title: "Pavilion feast", role: "combine", mechanics: ["multi-stage orders", "recipes", "jars"],
    intent: "Two-stage feast: a Sweet Pongal, then a Feast Platter — which is a SECOND Pongal + a Laddu Plate, because each stage consumes its dish. The ghee jar holds the first Ghee Pot and cracks under the rice merges made beside it; the Harvest Cart's queue (rice, rice, ghee) gives the second. The Laddu and one Sweet Kitchen tap make the plate.",
    aha: "Each stage consumes its dish — count two Pongals for a Feast Platter.",
    board: ["W1 . j:G1 . R1", ". @0 . @1 .", ". . . . R1"],
    gens: [G("sweets", "W1"), G("harvest", "R1 R1 G1")], orders: [O("Po"), O("Fp", 1, { after: 0 })], clear: ["jar"],
  },
  {
    title: "Pongal at dusk", role: "boss", mechanics: ["multi-stage orders", "jars", "sweep", "recipes"],
    intent: "Chapter 4 boss: Rice Pot → Sweet Pongal → Feast Platter (a second Pongal + a Laddu Plate). The three jars on the top row hold a Ghee Pot, a Rice Pot and a Laddu, and the Rice Sack waits under the middle one, touching all three; the Sweep can crack the whole row once. Three generators, five Sparks: three cart taps, one Hearth ghee, one Laddu to pair with the jarred one.",
    aha: "One cell touches all three jars: put every merge and recipe there — and tap each generator only for what the jars don't hold.",
    board: ["j:G1 j:R2 j:W1 . .", ". R1 . . .", ". @0 . @1 .", ". . @2 . ."],
    gens: [G("harvest", "R1"), G("sweets", "W1"), G("hearth", "G1")],
    orders: [O("R2"), O("Po", 1, { after: 0 }), O("Fp", 1, { after: 1 })], clear: ["jar"], boosters: { sweep: 1 },
  },

  /* ───────── Chapter 5 · Grand Mela: wrapped trunks, chain orders, mixed recipes, finale ───────── */
  {
    title: "Wrapped trunks", role: "teach", mechanics: ["wrapped trunks", "thread", "trunks & keys"],
    intent: "Teach, one trunk only: a thread-wrapped trunk — no key fits until the thread is pulled. The Toran inside is half the Rangoli Lamp. One Brass Key waits right beside the trunk; tap the Key Smith and merge the new key onto that one: the merge lands beside the trunk, pulls the thread AND forges the Silver Key that opens it. The other Toran is the Brass Diya plus a Clay Diya and one Lamp Shelf tap — two Sparks, one for each generator.",
    aha: "Make the key next to its own trunk — one merge unwraps the lock and forges the key.",
    hint: "Wrapped trunks: clear the thread, then use a key.",
    board: ["t:k2:L3 . . . .", "K1 . L2 . L1", ". . @0 . .", ". . . @1 ."],
    gens: [G("key", "K1"), G("lamp", "L1")], orders: [O("L4")], clear: ["trunk", "thread"],
  },
  {
    title: "Mela gates", role: "practise", mechanics: ["wrapped trunks", "thread", "trunks & keys"],
    intent: "Three wrapped trunks across the gate, one Festival Arch to build from two of them. The corners hold the Garland (brass lock) and the Marigold (silver lock); the middle trunk holds a Red Chilli nobody wants. The Brass Key beside the right trunk and the bud beside the left one show where each merge belongs: keys merge on the right (unwrapping the silver trunk AND forging its Silver Key), buds merge on the left (unwrapping the brass trunk). Merges in the middle unwrap the decoy, and a key dropped on it is a Key Smith tap thrown away. One Key Smith tap and one Flower Basket tap, nothing more.",
    aha: "Split the jobs: keys unwrap one corner, flowers the other — and leave the middle trunk wrapped.",
    board: ["t:k1:F3 . t:k1:S1 . . t:k2:F2", "F1 . . . K1 .", ". K1 . . . .", ". @1 . . @0 ."],
    gens: [G("key", "K1"), G("flower", "F1")], orders: [O("F4")],
  },
  {
    title: "The fifth plate", role: "story", mechanics: ["crates", "big merge", "multi-stage orders"],
    intent: "Story beat (the city cousins arrive): a Laddu Plate for the cousins, then two Laddu Boxes for the swings (the second card opens after the first), and a Toran Lamp. Four Plates sit at the corners of the swing and the crate in the middle holds the fifth — exactly enough, but the crate is a trap if you open it too soon: with four Plates on the board, the crate makes five and the next drop Big-Merges them into a Mithai Box nobody ordered. Hand the cousins their Plate first (or pair two Plates into a box first) and the crate is safe. The Toran is the Brass Diya, the Clay Diya and one Lamp Shelf tap; the Sweet Kitchen's laddus are never needed — every tap there is a Spark the crate or the lamp needed.",
    aha: "Count before you open: a crate that makes the fifth piece turns your pairs into a Big Merge — deliver or pair first, then open it.",
    board: ["W2 . . . . W2", "L2 . @0 . . L1", ". . . c:W2 . .", "W2 . . @1 . W2"],
    gens: [G("lamp", "L1"), G("sweets", "W1")], orders: [O("W2"), O("W3"), O("W3", 1, { after: 1 }), O("L3")],
  },
  {
    title: "Fairground knots", role: "combine", mechanics: ["wrapped trunks", "jars", "recipes", "3-input recipe"],
    intent: "Combine: a wrapped trunk holds the turmeric (its Brass Key sits in the crate), a jar seals the dye. Masala Tin and Sari both depend on blockers, and only one Red Chilli and one spool wait — alternate the two builds so every merge between the trunk and the jar hits both.",
    aha: "Alternate two builds so each merge cracks or unwraps something.",
    board: ["t:k1:T1 . j:D1 . c:K1", ". S1 . C1 .", ". @0 . @1 .", ". . . . ."],
    gens: [G("spice", "P1 S1"), G("loom", "C1")], orders: [O("Ms"), O("Sa")], clear: ["jar", "trunk", "thread"],
  },
  {
    title: "The Mela banner", role: "teach", mechanics: ["mixed recipes", "recipes"],
    intent: "Mixed-recipe teach: Mela Banner = Sari + Garland — two chains and a recipe feed a recipe. Build the sari and the garland in parallel.",
    aha: "Recipes stack: a sari becomes half of a banner.",
    hint: "MELA BANNER: Sari + Garland.",
    board: ["C1 . . F1", ". @0 . .", "C1 . @1 F1", ". . . ."],
    gens: [G("dye", "D1"), G("flower", "F1")], orders: [O("Mb")],
  },
  {
    title: "Chain orders", role: "teach", mechanics: ["chain orders"],
    intent: "Chain orders teach: there is no Key Smith — the Garland order PAYS a Brass Key onto the board, and that key opens the trunk with the Toran Lamp the Rangoli Lamp needs. The other Toran is built from the waiting Clay Diya plus three Lamp Shelf taps; the Garland is the waiting Marigold plus two Flower Basket buds — every tap feeds the chain.",
    aha: "Orders can pay you back — the only key comes from the flower order.",
    hint: "CHAIN ORDERS: a finished order drops a reward on the board.",
    board: ["k1:L3 . . . .", ". F2 @0 . .", "L1 . . @1 .", ". . . . ."],
    gens: [G("flower", "F1"), G("lamp", "L1")], orders: [O("F3", 1, { reward: "K1" }), O("L4")], clear: ["trunk"],
  },
  {
    title: "Chain of favours", role: "practise", mechanics: ["chain orders", "recipes", "generator"],
    intent: "A three-link chain: the Dupatta pays a Dye Pot, the Sari it makes pays a Brass Key, and the key opens the trunk with the Garland. Only the first dye costs anything (one Dye Stand tap, 2 Sparks) and the Loom makes the two spools the chain still needs. The order card shows the Sari opening only after the Dupatta: so dye a SINGLE spool first and merge the other two spools for the Sari's cloth — dye the cloth first and the paid dye has nothing left to colour.",
    aha: "Each reward is the next order's missing input — build each link in the order the cards open.",
    board: ["k1:F3 . . . .", ". . @0 . C1", ". . . . .", ". @1 . . ."],
    gens: [G("loom", "C1"), G("dye", "D1", 2)], orders: [O("Du", 1, { reward: "D1" }), O("Sa", 1, { after: 0, reward: "K1" }), O("F3", 1, { after: 1 })],
  },
  {
    title: "Lights on the wheel", role: "breather", mechanics: ["chain orders", "big merge"],
    intent: "Short breather on the Ferris wheel: a Toran Lamp for the first cabin PAYS a Brass Diya, and the Rangoli Lamp for the top cabin opens after it. Four Brass Diyas and a Clay Diya wait: two Brass make the Toran, and once it is delivered the payback plus the other two Brass and one more Brass (the Clay Diya + one Lamp Shelf tap) are the Rangoli. A Marigold for the ticket booth is the bud plus one Flower Basket tap. No blockers — just a chain that pays its own way.",
    aha: "An order's reward is a piece of the next order — deliver early and let it pay you.",
    board: ["L2 . . . L2", ". . @0 . F1", "L2 . L1 @1 L2"],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3", 1, { reward: "L2" }), O("L4", 1, { after: 0 }), O("F2")],
  },
  {
    title: "Banners for every gate", role: "combine", mechanics: ["mixed recipes", "chain orders"],
    intent: "Two Mela Banners and only ONE Dye Pot, with no Dye Stand: the order card shows that the first banner PAYS the second Dye Pot, and the second banner card only opens after it. Three Marigolds wait — two are the first Garland. The second banner's cloth comes from two Loom taps and the fourth Marigold from two Flower Basket taps: four Sparks, each generator exactly what the banners need.",
    aha: "Let the first banner pay for the second — the missing dye only exists as a reward.",
    board: ["C2 . . . F2", ". . @0 . .", "D1 . . . F2", "F2 . . @1 ."],
    gens: [G("flower", "F1"), G("loom", "C1")], orders: [O("Mb", 1, { reward: "D1" }), O("Mb", 1, { after: 0 })],
  },
  {
    title: "Courtyard of lights", role: "finale", mechanics: ["jars", "trunks & keys", "generator", "full board"],
    intent: "Finale room 1 (the home) — a FULL courtyard: only five empty cells, all far from the shelf, and the rest crowded with last year's stock nobody ordered (pepper, chilli, rice, turmeric, ghee, a Silk Bolt, a Dye Vat, a Mithai Box, a Festival Arch…). The sealed jar holds the Brass Diya the Grand Diya needs, and every cell around it is taken: the ready Garland and Laddu Box sit on its two sides, junk below. The Lamp Shelf is right under the jar, and a tap drops its Clay Diya into the NEAREST EMPTY cell. So deliver first: hand over the Garland and the side cell is empty — the next Clay Diya lands right there, beside the jar, and merging the far Clay Diya onto it is a crack. Deliver the Laddu Box, tap again, merge again (crack two); merge the far Brass Diya onto one of them (crack three). Tap before you deliver and the Clay Diya lands in the far yard: you will have to make room and carry it back. The silver trunk's Rangoli (the two Brass Keys merged) is the Grand Diya's other half. The Sweet Kitchen in the yard is old habit — the Laddu Box is already made, and every tap there is a Spark the lamps needed.",
    aha: "On a full board the cell you empty is where the next piece lands — deliver beside the jar, THEN tap.",
    board: ["# P1 F3 j:L2 W3 S1 #", "R1 T1 G1 @0 W4 D2 L2", "L1 F4 P2 C3 T2 S3 K1", "# . . G2 . . k2:L4", "# K1 L1 @1 . # #"],
    gens: [G("lamp", "L1"), G("sweets", "W1")], orders: [O("F3"), O("W3"), O("L5")], clear: ["jar", "trunk"],
  },
  {
    title: "Bazaar of colours", role: "finale", mechanics: ["mixed recipes", "3-input recipe", "multi-stage orders", "jars", "decoy generator"],
    intent: "Finale room 2 (the bazaar): a Masala Tin, then a Mela Banner — staged. The turmeric for the tin is sealed in the jar on the top row, and a second Spice Stall on the right sells turmeric outright — the obvious buy, and a decoy: the jar cracks for free under three things you make anyway, if they land beside it — the spool merge (the Loom's spool + the one under the jar), the chilli merge (the Spice Stall drops its chilli right under the jar) and the Spice Mix recipe. The banner's Sari is that cloth plus the Dye Pot in the corner crate; its Garland is the Marigold and the two buds by the stalls. Four Sparks of work (a spool, a chilli, a pepper, the crate); buying the turmeric spends a Spark the plan needs.",
    aha: "Don't buy what the board will give you: the merges you need anyway crack the jar's turmeric — the turmeric stall is a decoy.",
    board: ["# c:D1 . j:T1 . F2 #", ". . C1 . S1 . .", "@1 . . @0 . . @2", ". F1 . . . F1 .", "# # . . . # #"],
    gens: [G("spice", "S1 P1"), G("loom", "C1"), G("spice", "T1")],
    orders: [O("Ms"), O("Mb", 1, { after: 0 })],
  },
  {
    title: "The festival of lights", role: "finale", mechanics: ["chain orders", "trunks & keys", "jars", "mixed recipes", "generator"],
    intent: "Grand finale (Dadi's 80th) on the full 7x9 courtyard, laid out as a great diya: the silver trunk at the flame's tip holds a Rangoli Lamp, a jar under it seals a Marigold, a half-cracked jar by the kitchen seals a Laddu Box, and three generators line the wick, one tap each. Three orders: a Mithai Box, a Grand Diya and a Mela Banner. The chain is the spine — the Mithai Box order PAYS the Brass Key that, merged with one Key Smith key, opens the trunk's Rangoli (half the Grand Diya). So the sweets come first: the Laddu beside the kitchen jar plus one Sweet Kitchen tap, then that Plate onto the Plate below — both merges land beside the jar and open it, and its Laddu Box plus yours is the Mithai Box. The other Rangoli climbs on the Brass Diya under the flower jar (Clay Diya + one Lamp Shelf tap → Brass, Brass + Brass → Toran, Toran + Toran → Rangoli): three merges on that cell are the jar's three cracks, and its Marigold plus the waiting one is the Garland that, with Meera's finished Sari, makes the banner. At the diya's foot sits last year's Festival Arch — a keepsake, not an order.",
    aha: "Follow the chain: the Mithai Box first, because its reward is the key to the Grand Diya — and climb the lamps on the one cell under the flower jar.",
    board: ["# # # k2:L4 # # #", "# # . j:F2 . # #", "# Sa . L2 . L3 #", "# . . @0 . . #", "j2:W3 W1 . . . F2 #", "# . . @1 . . #", "# W2 . . L1 # #", "# # . @2 . # #", "# # # F4 # # #"],
    gens: [G("lamp", "L1"), G("sweets", "W1"), G("key", "K1")],
    orders: [O("W4", 1, { reward: "K1" }), O("L5"), O("Mb")], clear: ["jar", "trunk"],
  },
];

const TUNED = tuned as Record<string, number>;

export const LEVELS: LevelDef[] = RAW.map((r, i) => {
  const id = i + 1;
  const chapter = [...CHAPTERS].reverse().find((c) => id >= c.first)!.n;
  return { ...r, id, chapter, sparks: TUNED[String(id)] ?? r.sparks ?? 40 } as LevelDef;
});

export const chapterOf = (id: number) => CHAPTERS[(LEVELS[id - 1]?.chapter ?? 1) - 1];
