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
    intent: "Merged pieces merge again, in two chains: Clay + Clay → Brass, Brass + Brass → Toran Lamp; buds → Marigold, Marigold + Marigold → Garland. Only the lamp chain is a piece short, so the one Spark belongs to the Lamp Shelf.",
    aha: "A merge result is a new piece — climb two tiers by merging it again, and tap only for the chain that is short.",
    hint: "Merge again: two Brass Diyas make a Toran Lamp.",
    board: ["F1 . . . F1", ". . @0 . .", ". L2 . F2 .", ". . L1 . ."],
    gens: [G("lamp", "L1")], orders: [O("L3"), O("F3")],
  },
  {
    title: "Two baskets", role: "teach", mechanics: ["merge", "generator", "orders"],
    intent: "Three generators, two orders. The Toran needs two Lamp Shelf taps, the Garland three Flower Basket taps; the Sweet Kitchen makes nothing either order wants, so every tap there is wasted.",
    aha: "Read the order tray first; every tap should feed an order.",
    hint: "Tap only the generators whose items the orders need.",
    board: ["L1 . . . F1", ". @0 . @1 .", ". . W1 . .", ". . @2 . .", "L1 . . . ."],
    gens: [G("lamp", "L1"), G("flower", "F1"), G("sweets", "W1")], orders: [O("L3"), O("F3")],
  },
  {
    title: "The swept courtyard", role: "teach", mechanics: ["crates", "orders"],
    intent: "Crates show what is inside and cost 1 Spark to open. The lamp and flower crates hold tier-2 pieces (worth two taps); the sweets crate is useless here.",
    aha: "A crate holding a tier-2 piece is half price — open those, skip the one no order needs.",
    hint: "Crates cost 1 Spark. Open the ones that hold what the orders need.",
    board: ["c:L2 . . c:F2", ". @0 @1 .", "L1 . . F1", ". c:W2 . ."],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3"), O("F3")],
  },
  {
    title: "Dadi's lamps", role: "story", mechanics: ["merge", "orders", "crates"],
    intent: "Story beat (Dadi's letter): three Clay Diyas in three corners, a Laddu by the door and a crate holding a Laddu PLATE. The Toran needs one Lamp Shelf tap. The Laddu Box needs four Laddus' worth: the crate's Plate (one Spark for two Laddus) plus the waiting Laddu and one Sweet Kitchen tap. Three Sparks; skip the crate and the box needs one tap too many.",
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
    title: "Market crates", role: "practise", mechanics: ["crates", "orders", "generator"],
    intent: "No Lamp Shelf: one Clay Diya waits and the crate holds the only other lamp, so that tier-1 crate is worth its Spark. The Laddu Plate crate is a bargain (two taps for one Spark); the Marigold needs one Flower Basket tap.",
    aha: "Value a crate by what it saves — and the piece no generator can make is worth any price.",
    board: [". c:W2 . . L1", "W1 . @0 . .", "F1 . . . c:L1", ". . . @1 ."],
    gens: [G("flower", "F1"), G("sweets", "W1")], orders: [O("L2"), O("W3"), O("F2")],
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
    intent: "Story beat (the neighbours return): a Laddu Box and two Laddu Plates. Three Laddus wait; two Sweet Kitchen taps make five, and the Big Merge gives the Box + one Plate. The second Plate is in the crate — one Spark, where pairing laddus for it would cost two taps.",
    aha: "Plan the Big Merge so its bonus piece fills an order, then use the crate for the rest.",
    board: ["W1 . . . W1", ". . @0 . .", ". c:W2 . . W1"],
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
    intent: "Twist on Big Merge: four Brass Diyas and a crate with a fifth. Open the crate first and the next drop Big-Merges into a useless Rangoli Lamp; merge the two pairs first, then open the crate for the Brass order.",
    aha: "Five of a kind always Big-Merge — merge your pairs BEFORE the fifth arrives when you need two of the next tier.",
    board: ["L2 . . . L2", ". c:L2 . @0 .", "L2 . . . L2", ". F1 . . ."],
    gens: [G("flower", "F1")], orders: [O("L3", 2), O("L2"), O("F3")],
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
    intent: "Two knots now: a two-layer knot in the middle hides a Cotton Cloth, a single knot on the far right hides a spool. The middle knot needs two merges beside it (use the spools on its left, right and below as targets); the far knot needs one merge on the spool under it. Three merges, three different target cells, one Loom tap.",
    aha: "Choose the target cell, not just the pair: every merge beside a knot is a hit.",
    board: [". C1 t2:C2 C1 . .", ". . C1 . . t:C1", ". . @0 . . C1"],
    gens: [G("loom", "C1")], orders: [O("C3"), O("C2", 2)], clear: ["thread"],
  },
  {
    title: "Meera's needle", role: "teach", mechanics: ["needle", "thread"],
    intent: "Needle teach (breather): the Needle unpicks a whole knot. The two-layer knot in the far corner hides a Cotton Cloth and no merge can reach it cheaply; the single knots near the generators clear themselves.",
    aha: "Save the Needle for the knot your merges can't reach.",
    hint: "The NEEDLE removes every layer of one knot.",
    board: ["t2:C2 . . . t:F1", ". . @0 . .", ". C1 . F1 .", ". . @1 . t:C1"],
    gens: [G("loom", "C1"), G("flower", "F1")], orders: [O("C3"), O("F2")], clear: ["thread"], boosters: { needle: 1 },
  },
  {
    title: "The tangled loom", role: "twist", mechanics: ["thread", "merge", "generator"],
    intent: "Twist: this time the Loom Basket ITSELF is wrapped in a double knot and cannot be tapped. The four spools in the corners are all you have until it is free — drag them in so both pair-merges land right beside the loom; merge them anywhere else and the level is over before it starts.",
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
    intent: "Story beat (Meera returns) and breather: two Garlands. Five Marigold Buds Big-Merge into Garland + Marigold; the thread over a bud falls to that same burst.",
    aha: "A Big Merge's 8-cell ring clears knots diagonally too.",
    board: ["F1 . t:F1 .", ". @0 . F1", ". . . .", "F1 . . ."],
    gens: [G("flower", "F1")], orders: [O("F3", 2)], clear: ["thread"],
  },
  {
    title: "Dye under knots", role: "combine", mechanics: ["thread", "recipes"],
    intent: "Combine thread + recipes: one Dye Pot is free, the other is tangled. Make the second cloth right beside the knot so the merge frees the dye you'll use on it — two Saris with no expensive Dye Stand tap.",
    aha: "Free the dye with the very cloth you are going to dye.",
    board: ["t:D1 . C1 . D1", "C1 . . . C1", ". . @0 . .", ". . . @1 ."],
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
    intent: "Breather after the recipe spike: the Garland's second Marigold is double-knotted in the far corner, where no flower merge can reach it cheaply — one Needle frees it. Two lamp taps finish the Toran Lamp.",
    aha: "A booster is a gift: spend the Needle on the knot that guards a piece you need.",
    board: [". L1 . t2:F2", "L1 @0 . .", ". . @1 .", "F1 . . ."],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3"), O("F3")], clear: ["thread"], boosters: { needle: 1 },
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
    intent: "Story beat (the broken loom): double knots guard both Dye Pots in the top corners and a single knot the Cotton Cloth in the middle. Pair merges beside the corners pull one layer each; a Big Merge of five spools in the centre rings all three knots at once — and its bonus cloth is one of the Saris.",
    aha: "One Big-Merge ring reaches two cells in every direction — land it in the middle to hit all three knots.",
    board: ["t2:D1 C1 . C1 t2:D1", "C1 . t:C2 . C1", ". . . . .", ". @0 . . ."],
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
    intent: "Trunk teach: three trunks with brass locks, and every trunk shows what is inside. The two corner trunks hold the Toran Lamps the orders want; the middle one holds a Red Chilli nobody ordered. The Key Smith makes Brass Keys — drop one on each lamp trunk and leave the chilli locked.",
    aha: "Trunks hold treasure; a key of the lock's tier opens them — but only open what an order needs.",
    hint: "Drop a key on a trunk to open it.",
    board: ["k1:L3 . . . k1:L3", ". . @0 . .", ". . k1:S1 . ."],
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
    title: "Lantern stalls", role: "breather", mechanics: ["trunks & keys", "merge"],
    intent: "Breather after the silver lock: the lantern trunk (brass lock) holds a Toran Lamp — half of the Rangoli Lamp. Two Clay Diyas and a Brass Diya wait: the clay pair is the Brass Diya order, and two Lamp Shelf taps make the Brass Diya that pairs with the waiting one for the second Toran. One key, two lamp taps and a Spark to spare.",
    aha: "The trunk's treasure is half the big lamp — open it, then build only the other half.",
    board: ["L1 . . . k1:L3", ". . @0 . .", ". L2 . . L1", ". . . @1 ."],
    gens: [G("lamp", "L1"), G("key", "K1")], orders: [O("L4"), O("L2")], clear: ["trunk"],
  },
  {
    title: "Imran's ledger", role: "story", mechanics: ["trunks & keys", "recipes", "crates"],
    intent: "Story beat (Chacha Imran's ledger trunk): the Dye Pot for the Sari is behind a silver lock. The key crate already holds a Silver Key — one Spark instead of two Key Smith taps and a merge.",
    aha: "The key crate is a Silver Key for one Spark.",
    board: ["k2:D1 . . C1", ". c:K2 . .", "C1 . @0 .", ". . . @1"],
    gens: [G("loom", "C1"), G("key", "K1")], orders: [O("Sa")], clear: ["trunk"],
  },
  {
    title: "Chacha Imran's masala", role: "teach", mechanics: ["3-input recipe"],
    intent: "3-input recipe teach: Masala Tin = Chilli Bunch + Pepper Pods (Spice Mix) + Turmeric Root. Two Red Chillies wait in opposite corners; the Spice Stall's queue shows pepper, then turmeric. Merge the chillies into a bunch (before or after tapping), add the pepper for the Spice Mix, then the turmeric — two taps, three merges of three kinds, one tin.",
    aha: "Three ingredients in two steps: mix first, then add turmeric.",
    hint: "MASALA: Chilli Bunch + Pepper = Spice Mix; Spice Mix + Turmeric = Masala Tin.",
    board: ["S1 . . . .", ". . @0 . .", ". . . . S1"],
    gens: [G("spice", "P1 T1")], orders: [O("Ms")],
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
    title: "Moonlit stalls", role: "breather", mechanics: ["trunks & keys", "merge", "orders"],
    intent: "Breather: lamps and flowers under the moon, one silver trunk with a Garland. Merge two Brass Keys and the rest flows.",
    aha: "Open the trunk first — its Garland is one order already.",
    board: ["k2:F3 . . L2", ". @0 . .", "L2 . @1 .", ". . . F1"],
    gens: [G("key", "K1"), G("flower", "F1")], orders: [O("F3"), O("L3"), O("F2")], clear: ["trunk"],
  },
  {
    title: "The old friendship", role: "story", mechanics: ["trunks & keys", "merge"],
    intent: "Story beat (the neighbours reconcile): the Rangoli Lamp sits behind a filigree lock (two Silver = four Brass Keys). One Brass Key waits — and the brass trunk in the corner holds a SILVER key. Spend the waiting brass key on that trunk and the silver key inside is half the filigree; two Key Smith taps make the other half. Building the filigree from brass keys alone takes three taps. The Toran Lamp is the two Brass Diyas already on the board.",
    aha: "A trunk can hold a key worth more than the key that opens it.",
    board: ["k3:L4 . . . k1:K2", ". . @0 . .", "K1 . . . L2", ". . . L2 ."],
    gens: [G("key", "K1")], orders: [O("L4"), O("L3")], clear: ["trunk"],
  },
  {
    title: "Night market rush", role: "combine", mechanics: ["3-input recipe", "trunks & keys", "recipes"],
    intent: "Combine: a Masala Tin and a Sari behind two trunks — the brass one holds the turmeric, the silver one the Dye Pot. The Key Smith's visible queue makes a SILVER key first, then a brass one. A Silver Key opens a brass lock too, so it is tempting to spend it on the nearest trunk — but then the silver lock waits a whole lap of the queue. Silver key on the silver trunk, brass on the brass; the two chillies and one pepper tap make the Spice Mix.",
    aha: "Read the key queue: give each key the lock that needs its tier, not the first trunk you see.",
    board: ["k1:T1 . . . k2:D1", ". S1 . S1 .", ". . @0 . .", "C2 . . @1 ."],
    gens: [G("key", "K2 K1"), G("spice", "P1")], orders: [O("Ms"), O("Sa")], clear: ["trunk"],
  },
  {
    title: "Lantern alley", role: "combine", mechanics: ["big merge", "trunks & keys"],
    intent: "Big Merge meets trunks: five Brass Keys Big-Merge into a Filigree Key plus a bonus Silver Key — exactly the two locks this board needs. The second Toran is the two Brass Diyas on the board.",
    aha: "Big-Merge the keys: filigree + silver from five brass.",
    board: ["k3:L4 . . . k2:L3", ". . . . .", "L2 . @0 . L2", ". . . . ."],
    gens: [G("key", "K1")], orders: [O("L4"), O("L3"), O("L3")], clear: ["trunk"],
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
    intent: "Chapter 3 boss: Rangoli Lamp, Masala Tin and Sari behind three trunks — brass (turmeric), silver (Dye Pot) and filigree (Rangoli Lamp). Two Brass Keys wait by the trunks: three Key Smith taps make FIVE, and one Big Merge forges a Filigree Key plus a bonus Silver Key — both big locks at once. One more brass key opens the turmeric; one stall tap gives the pepper for the Chilli Bunch. Pairing the keys instead needs seven brass keys, two taps more than the bar allows.",
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
    intent: "Practise stages with a jar: Rice Pot → Sweet Pongal → Rice Pot, and the jar holds the last Rice Pot. Its three cracks come from the three things you make anyway, if they land beside it: two rice merges and the Pongal recipe (a recipe cracks a jar too). Two Harvest Cart taps and one Hearth tap, no spare.",
    aha: "A recipe is a merge too: the Pongal you cook beside the jar is its third crack.",
    board: [". R1 j:R2 . .", ". . @0 . R1", ". @1 . . ."],
    gens: [G("harvest", "R1"), G("hearth", "G1")], orders: [O("R2"), O("Po", 1, { after: 0 }), O("R2", 1, { after: 1 })], clear: ["jar"],
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
    intent: "Sweep teach: four jars in one row. A Sweep cracks every blocker in its row once — four cracks for one tap — then laddu merges in the row below finish them. The jars hold the Laddu Plates, Marigold and Brass Diya the orders want.",
    aha: "Sweep the row with the most blockers in it.",
    hint: "SWEEP cracks every blocker in one row.",
    board: ["j:W2 j:F2 j:W2 j:L2", ". . . .", ". @0 . ."],
    gens: [G("sweets", "W1")], orders: [O("W3"), O("F2"), O("L2")], clear: ["jar"], boosters: { sweep: 1 },
  },
  {
    title: "Durga's lamps", role: "breather", mechanics: ["jars", "sweep", "merge"],
    intent: "Breather after the Sweep teach: two Toran Lamps for the pandal and a Marigold for the goddess. Two of the four Brass Diyas sit in jars at either end of the top row: one Sweep cracks both at once, and the lamp merges beside each jar finish them. The Lamp Shelf needs two taps and the Flower Basket one; the spare Sparks forgive a merge landed away from a jar.",
    aha: "Two jars in one row = one Sweep for both — then merge on each side.",
    board: ["j:L2 . . . j:L2", "L1 . @0 . .", ". F1 . @1 L1"],
    gens: [G("lamp", "L1"), G("flower", "F1")], orders: [O("L3", 2), O("F2")], clear: ["jar"], boosters: { sweep: 1 },
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
    intent: "Combine: the top row holds a knotted cloth and two sealed dye jars, the bottom a knotted spool. One Sweep on the top row hits all three blockers; cloth merges below finish them — two Saris and a Silk Bolt.",
    aha: "Count blockers per row: sweep the row with three.",
    board: ["t:C2 j:D1 . . j:D1", ". . . . .", ". C1 @0 C1 .", "t:C1 . . . ."],
    gens: [G("loom", "C1")], orders: [O("Sa", 2), O("C3")], clear: ["jar", "thread"], boosters: { sweep: 1 },
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
    intent: "Twist teach: thread-wrapped trunks — no key fits until the thread is pulled. Merge the brass keys right beside the silver-locked trunk (one move unwraps it AND makes the Silver Key); merge the Brass Diyas beside the other trunk to unwrap it — its Marigold plus two fresh buds make the Garland.",
    aha: "Make the key next to its own trunk — one merge unwraps the lock and forges the key.",
    hint: "Wrapped trunks: clear the thread, then use a key.",
    board: ["t:k2:L3 . . L2 t:k1:F2", "K1 L2 . . .", ". . @0 . .", ". @1 . . ."],
    gens: [G("key", "K1"), G("flower", "F1")], orders: [O("L4"), O("F3")], clear: ["trunk", "thread"],
  },
  {
    title: "Mela gates", role: "practise", mechanics: ["wrapped trunks", "thread", "trunks & keys"],
    intent: "Two wrapped trunks in opposite corners, one Festival Arch to build from both treasures. The Brass Key beside the right trunk and the bud beside the left one show where each merge belongs: keys merge on the right (unwrapping the silver trunk AND forging its Silver Key), buds merge on the left (unwrapping the brass trunk). One Key Smith tap and one Flower Basket tap, nothing more.",
    aha: "Split the jobs: keys unwrap one corner, flowers the other.",
    board: ["t:k1:F3 . . . t:k2:F2", "F1 . . K1 .", ". K1 . . .", ". @1 . @0 ."],
    gens: [G("key", "K1"), G("flower", "F1")], orders: [O("F4")], clear: ["trunk", "thread"],
  },
  {
    title: "Swings and sweets", role: "story", mechanics: ["crates", "multi-stage orders", "merge"],
    intent: "Story beat (city cousins arrive): two Laddu Boxes for the swings — the second card opens after the first — and a Toran Lamp. Two Laddu Plates wait and the crate holds a third: one Spark there saves two Sweet Kitchen taps. The fourth Plate is the waiting Laddu plus one tap; the Toran is the waiting Brass Diya plus the Clay Diya and one Lamp Shelf tap. A spare Spark keeps it light.",
    aha: "A crate holding a tier-2 piece is half price — even in the last chapter.",
    board: ["W2 . . . L1", ". @0 . c:W2 .", "L2 . . @1 .", "W2 . W1 . ."],
    gens: [G("sweets", "W1"), G("lamp", "L1")], orders: [O("W3"), O("W3", 1, { after: 0 }), O("L3")],
  },
  {
    title: "Fairground knots", role: "combine", mechanics: ["wrapped trunks", "jars", "recipes", "3-input recipe"],
    intent: "Combine: a wrapped trunk holds the turmeric (its Brass Key sits in the crate), a jar seals the dye. Masala Tin and Sari both depend on blockers, and only one Red Chilli and one spool wait — alternate the two builds so every merge between the trunk and the jar hits both.",
    aha: "Alternate two builds so each merge cracks or unwraps something.",
    board: ["t:k1:T1 . j:D1 . c:K1", ". S1 . C1 .", ". @0 . @1 .", ". . . . ."],
    gens: [G("spice", "P1 S1"), G("loom", "C1")], orders: [O("Ms"), O("Sa")], clear: ["jar", "trunk", "thread"],
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
    intent: "A three-link chain: the Dupatta pays a Dye Pot, the Sari it makes pays a Brass Key, and the key opens the trunk with the Garland. Only the first dye costs anything — one Dye Stand tap (2 Sparks) — and the Loom makes the two spools the chain still needs; three Sparks to spare, enough to recover one wasted dye. Dye a single spool first (the Sari card only opens after the Dupatta), and merge the other two spools for the Sari's cloth.",
    aha: "Each reward is the next order's missing input — buy only the first link.",
    board: ["k1:F3 . . . .", ". . @0 . C1", ". . . . .", ". @1 . . ."],
    gens: [G("loom", "C1"), G("dye", "D1", 2)], orders: [O("Du", 1, { reward: "D1" }), O("Sa", 1, { after: 0, reward: "K1" }), O("F3", 1, { after: 1 })], clear: ["trunk"],
  },
  {
    title: "Lights on the wheel", role: "breather", mechanics: ["chain orders", "big merge"],
    intent: "Breather on the Ferris wheel: a Big Merge pays twice. Two Clay Diyas wait; three Lamp Shelf taps make five, and the Big Merge gives a Toran Lamp (deliver it: that order PAYS a Brass Diya) plus a bonus Brass Diya. The bonus, the reward and the waiting Brass Diya are three of the four Brass Diyas the Rangoli Lamp needs — two more taps make the fourth.",
    aha: "Stack the paybacks: the Big Merge bonus and the order's reward both go into the next lamp.",
    board: ["L1 . . . .", ". . @0 . .", "L2 . . . L1"],
    gens: [G("lamp", "L1")], orders: [O("L3", 1, { reward: "L2" }), O("L4")],
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
    title: "Banners for every gate", role: "combine", mechanics: ["mixed recipes", "chain orders"],
    intent: "Two Mela Banners and only ONE Dye Pot, with no Dye Stand: the order card shows that the first banner PAYS the second Dye Pot, and the second banner card only opens after it. Three Marigolds wait — two are the first Garland. The second banner's cloth comes from two Loom taps and the fourth Marigold from two Flower Basket taps: four Sparks, each generator exactly what the banners need.",
    aha: "Let the first banner pay for the second — the missing dye only exists as a reward.",
    board: ["C2 . . . F2", ". . @0 . .", "D1 . . . F2", "F2 . . @1 ."],
    gens: [G("flower", "F1"), G("loom", "C1")], orders: [O("Mb", 1, { reward: "D1" }), O("Mb", 1, { after: 0 })],
  },
  {
    title: "Courtyard of lights", role: "finale", mechanics: ["jars", "trunks & keys", "merge", "generator"],
    intent: "Finale room 1 (the home): a Grand Diya is two Rangoli Lamps from two different sources. One is in the silver trunk (two Key Smith taps merged). The other is built from four Brass Diyas — one beside the double-sealed corner jar, one inside it, one below, and one from two Lamp Shelf taps — and the jar only opens under merges made beside it. Dadi's doorway also wants a Marigold: the bud by the door plus one Flower Basket bud. Every Spark has a job.",
    aha: "The Grand Diya needs both Rangoli sources — and the jarred Brass Diya only comes out if you build beside it.",
    board: ["j2:L2 . k2:L4 . .", ". L2 . . F1", "L2 . @0 . .", ". @2 . @1 ."],
    gens: [G("lamp", "L1"), G("key", "K1"), G("flower", "F1")], orders: [O("L5"), O("F2")], clear: ["jar", "trunk"],
  },
  {
    title: "Bazaar of colours", role: "finale", mechanics: ["mixed recipes", "3-input recipe", "multi-stage orders", "jars"],
    intent: "Finale room 2 (the bazaar): a Masala Tin, then a Mela Banner — staged. The turmeric is sealed in the jar on the top row; its three cracks are three merges you need anyway, made on the cells under it — the spool merge, the chilli merge and the Spice Mix recipe. The Sari is that cloth plus the Dye Pot in the corner crate (open it once the cloth is made, so it can't be wasted on a bare spool); the Garland is the Marigold and bud on the board plus one Flower Basket bud. Three generators and a crate, and no Spark to spare.",
    aha: "Stage by stage, but crack ahead: the next stage's blockers fall to this stage's merges.",
    board: ["c:D1 . j:T1 . .", ". C1 . S1 .", "@2 . @0 . .", ". . . @1 .", "F2 . . . F1"],
    gens: [G("spice", "S1 P1"), G("flower", "F1"), G("loom", "C1")],
    orders: [O("Ms"), O("Mb", 1, { after: 0 })], clear: ["jar"],
  },
  {
    title: "The festival of lights", role: "finale", mechanics: ["chain orders", "trunks & keys", "jars", "mixed recipes", "generator"],
    intent: "Grand finale (Dadi's 80th): Mithai Box, Grand Diya and Mela Banner, three generators, one tap each. The chain is the spine: the jar's Laddu Box plus yours make the Mithai Box, whose order PAYS the Brass Key that (with one Key Smith tap) opens the silver trunk's Rangoli Lamp for the Grand Diya. Building the lamps on the Brass Diya beside both jars cracks them on the way; the banner is the waiting Sari pieces plus a Garland from the two Marigolds.",
    aha: "Build in one spot: the cell that touches both jars turns every lamp merge into two cracks — and the Mithai Box pays the key.",
    board: ["k2:L4 . j:F2 . D1 .", ". L2 . . L3 .", "j:W3 . @0 . . C2", ". W1 . @1 . .", "L1 . W2 . @2 F2"],
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
