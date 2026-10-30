import { iap } from "../modules/iap";
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";

/**
 * Store actions with a guaranteed, visible outcome (the bare iap calls resolve silently when billing is offline,
 * which left "Checking your purchases…" on screen forever). Everything goes through src/modules/iap.ts.
 */
const TIMEOUT_MS = 8000;
function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => resolve("timeout"), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

export type RestoreResult = { ok: boolean; text: string };

/** Restore purchases → always one of: restored / already active / nothing to restore / store unavailable. */
export async function restorePurchases(where: string): Promise<RestoreResult> {
  analytics.track("restore_purchases_tap", { where });
  const before = store.get().adsRemoved;
  const storeUp = iap.items().length > 0;
  let r: unknown;
  try {
    r = await withTimeout(iap.restore());
  } catch {
    return { ok: false, text: "Store unavailable right now — please try again later." };
  }
  const now = store.get().adsRemoved;
  if (now && !before) return { ok: true, text: "Purchases restored — Remove Ads is active. Thank you!" };
  if (r === "timeout") return { ok: false, text: "The store isn't answering — please try again later." };
  if (!storeUp) return { ok: false, text: "Store unavailable right now — please try again later." };
  if (now) return { ok: true, text: "All set — Remove Ads is already active on this device." };
  return { ok: true, text: "Nothing to restore — no past purchases found for this account." };
}

/** Buy a store product. Opens the store's purchase sheet, or explains why it can't. */
export async function buy(sku: string): Promise<RestoreResult | null> {
  analytics.track("iap_tap", { sku });
  if (!iap.items().some((i) => i.sku === sku)) {
    return { ok: false, text: "Store unavailable right now — check your connection and try again later." };
  }
  try {
    await iap.purchase(sku);
    return null; // the purchase sheet is up; the grant arrives through the store listener
  } catch {
    return { ok: false, text: "The purchase didn't go through — nothing was charged. Please try again." };
  }
}
