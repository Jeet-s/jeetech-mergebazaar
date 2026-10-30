/**
 * Merge Bazaar item catalog — every chain, crafted item, recipe and generator kind.
 * Item codes: a chain item is "<chain letter><tier>" (e.g. L2 = Brass Diya); a crafted item is two letters
 * (e.g. Sa = Sari). Codes are what the engine stores in board cells and what levels are authored in.
 */
export type ChainId = "L" | "F" | "W" | "C" | "D" | "K" | "S" | "P" | "T" | "R" | "G";

export const CHAINS: Record<ChainId, { name: string; tiers: string[] }> = {
  L: { name: "Lamps", tiers: ["Clay Diya", "Brass Diya", "Toran Lamp", "Rangoli Lamp", "Grand Diya"] },
  F: { name: "Flowers", tiers: ["Marigold Bud", "Marigold", "Garland", "Festival Arch"] },
  W: { name: "Sweets", tiers: ["Laddu", "Laddu Plate", "Laddu Box", "Mithai Box"] },
  C: { name: "Cloth", tiers: ["Cotton Spool", "Cotton Cloth", "Silk Bolt"] },
  D: { name: "Dye", tiers: ["Indigo Dye Pot", "Dye Vat"] },
  K: { name: "Keys", tiers: ["Brass Key", "Silver Key", "Filigree Key"] },
  S: { name: "Chilli", tiers: ["Red Chilli", "Chilli Bunch", "Chilli String"] },
  P: { name: "Pepper", tiers: ["Pepper Pods", "Pepper Sack"] },
  T: { name: "Turmeric", tiers: ["Turmeric Root", "Turmeric Jar"] },
  R: { name: "Rice", tiers: ["Rice Sack", "Rice Pot"] },
  G: { name: "Ghee", tiers: ["Ghee Pot", "Ghee Jar"] },
};

/** Crafted items come only from recipes; they never merge further except as recipe inputs. */
export const CRAFTED: Record<string, string> = {
  Du: "Dupatta",
  Sa: "Sari",
  Mx: "Spice Mix",
  Ms: "Masala Tin",
  Po: "Sweet Pongal",
  Fp: "Feast Platter",
  Mb: "Mela Banner",
};

/** Recipe merges (order-independent): drop one input on the other → the result appears on the target cell. */
export const RECIPES: readonly (readonly [string, string, string])[] = [
  ["C1", "D1", "Du"], // cotton spool + dye pot = dupatta
  ["C2", "D1", "Sa"], // cotton cloth + dye pot = sari
  ["S2", "P1", "Mx"], // chilli bunch + pepper pods = spice mix   (masala: 3 inputs, step 1)
  ["Mx", "T1", "Ms"], // spice mix + turmeric root = masala tin   (masala: 3 inputs, step 2)
  ["R2", "G1", "Po"], // rice pot + ghee pot = sweet pongal
  ["Po", "W2", "Fp"], // sweet pongal + laddu plate = feast platter
  ["Sa", "F3", "Mb"], // sari + garland = mela banner
];

const recipeIndex = new Map<string, string | undefined>();
for (const [a, b, r] of RECIPES) {
  recipeIndex.set(`${a}+${b}`, r);
  recipeIndex.set(`${b}+${a}`, r);
}
export const recipeOf = (a: string, b: string): string | undefined => (a.length === 2 && b.length === 2 ? recipeIndex.get(a + "+" + b) : undefined);
export const recipeInputs = (item: string): readonly [string, string] | undefined => {
  const r = RECIPES.find((x) => x[2] === item);
  return r ? [r[0], r[1]] : undefined;
};

const isDigit = (c: number) => c >= 49 && c <= 57;
const isUpper = (c: number) => c >= 65 && c <= 90;
export const isChainItem = (code: string) => code.length === 2 && isUpper(code.charCodeAt(0)) && isDigit(code.charCodeAt(1));
export const isItem = (code: string) => isChainItem(code) || (code.length === 2 && code in CRAFTED);
export const chainOf = (code: string) => code[0] as ChainId;
export const tierOf = (code: string) => Number(code[1]);
export const maxTier = (chain: ChainId) => CHAINS[chain].tiers.length;
export const canMerge = (code: string) => isChainItem(code) && code[0] in CHAINS && tierOf(code) < maxTier(chainOf(code));
export const up = (code: string, by = 1) => `${code[0]}${tierOf(code) + by}`;
export const isKey = (code: string) => code[0] === "K" && isChainItem(code);

export function itemName(code: string): string {
  if (code in CRAFTED) return CRAFTED[code];
  if (isChainItem(code)) return CHAINS[chainOf(code)]?.tiers[tierOf(code) - 1] ?? code;
  return code;
}

/** Base-unit cost of an item: tier t of a chain = 2^(t-1) tier-1 items; crafted = sum of its inputs. */
export function unitsOf(code: string): number {
  if (isChainItem(code)) return 2 ** (tierOf(code) - 1);
  const r = recipeInputs(code);
  return r ? unitsOf(r[0]) + unitsOf(r[1]) : 1;
}

/** Generator kinds (board art + name); what each produces is set per level as a fixed, visible sequence. */
export const GENERATORS = {
  lamp: "Lamp Shelf",
  flower: "Flower Basket",
  sweets: "Sweet Kitchen",
  loom: "Loom Basket",
  dye: "Dye Stand",
  key: "Key Smith",
  spice: "Spice Stall",
  harvest: "Harvest Cart",
  hearth: "Hearth",
} as const;
export type GeneratorKind = keyof typeof GENERATORS;
