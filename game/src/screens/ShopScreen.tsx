import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { GameButton, Popup, fonts, palette, play } from "../ui";
import { iap, type ShopItem } from "../modules/iap";
import { ads } from "../modules/ads";
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";
import { pieces, glyphs } from "../pieces";
import { BOOSTERS, BOOSTER_INFO, boosterUnlocked, buyBooster, meta } from "../game/meta";
import { buy, restorePurchases } from "../ui/purchases";
import monetization from "../../monetization.json";

const ICON: Record<string, string> = { remove_ads: "ui:close", coins_small: "cur_lamp", coins_large: "W4" };
const DESC: Record<string, string> = { remove_ads: "No banners or between-level ads, ever." };
const CATALOG = monetization.iap as { sku: string; title: string; description: string; coins?: number }[];
const describe = (sku: string) =>
  DESC[sku] ?? (() => { const c = CATALOG.find((x) => x.sku === sku); return c?.coins ? `${c.coins.toLocaleString()} Lamps` : c?.description ?? ""; })();
const titleOf = (sku: string, storeTitle: string) =>
  sku === "remove_ads" ? "Remove Ads" : (() => { const c = CATALOG.find((x) => x.sku === sku); return c?.coins ? `${c.coins >= 1000 ? "Chest" : "Pile"} of Lamps` : storeTitle.replace(/\s*\(.*\)\s*$/, ""); })();

/** Bazaar shop: fixed, clearly-priced items only (no random rewards). Lamp packs + Remove Ads from the store,
 *  boosters for Lamps, an opt-in rewarded video for Lamps, and Restore purchases. */
export function ShopScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [state, setState] = useState(store.get());
  const [items, setItems] = useState<ShopItem[]>(iap.items());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prev = useRef(store.get());
  useEffect(
    () =>
      store.subscribe((n) => {
        const p = prev.current;
        prev.current = n;
        if (n.adsRemoved && !p.adsRemoved) setNote("Ads removed — thank you for supporting Merge Bazaar!");
        else if (n.coins >= p.coins + 500) setNote(`+${(n.coins - p.coins).toLocaleString()} Lamps added. Thank you!`);
        setState(n);
      }),
    [],
  );
  useEffect(() => {
    if (visible) {
      setItems(iap.items());
      setNote(null);
      analytics.track("iap_view");
    }
  }, [visible]);
  const m = meta();
  // Only products the store actually returned (with real prices) get a price button. Remove Ads always has its
  // row: without a store price it says so on tap instead of showing a made-up price.
  const removeAds = items.find((i) => i.sku === "remove_ads");
  const list = items.filter((i) => i.sku !== "remove_ads");
  return (
    <Popup
      visible={visible}
      title="Bazaar Shop"
      onClose={onClose}
      footer={
        <>
          {note ? <Text style={styles.note} accessibilityLiveRegion="polite">{note}</Text> : null}
          <GameButton label="Close" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <View style={styles.balance}>
        <Image source={pieces.cur_lamp} style={{ width: 34, height: 34 }} />
        <Text style={styles.balanceText}>{state.coins.toLocaleString()} Lamps</Text>
      </View>
      <Text style={styles.section}>Ad-free play</Text>
      <View style={[styles.row, styles.featured]}>
        <Image source={glyphs.close} style={[styles.icon, { tintColor: palette.danger }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Remove Ads</Text>
          <Text style={styles.desc}>{state.adsRemoved ? "Active — no banners or between-level ads on this device." : DESC.remove_ads}</Text>
        </View>
        {state.adsRemoved ? (
          <View style={styles.owned}><Image source={glyphs.check} style={{ width: 22, height: 22 }} /><Text style={styles.ownedText}>Owned</Text></View>
        ) : (
          <GameButton
            size="sm"
            variant="primary"
            label={removeAds ? removeAds.price : "Buy"}
            onPress={async () => {
              const r = await buy("remove_ads");
              if (r) setNote(r.text);
            }}
          />
        )}
      </View>
      {list.length ? <Text style={styles.section}>Lamp packs</Text> : null}
      {list.map((i) => {
        const ic = ICON[i.sku] ?? "cur_lamp";
        return (
          <View key={i.sku} style={styles.row}>
            <Image source={pieces[ic]} style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{titleOf(i.sku, i.title)}</Text>
              <Text style={styles.desc}>{describe(i.sku)}</Text>
            </View>
            <GameButton
              size="sm"
              variant="primary"
              label={i.price}
              onPress={async () => {
                const r = await buy(i.sku);
                if (r) setNote(r.text);
              }}
            />
          </View>
        );
      })}
      <Text style={styles.section}>Boosters</Text>
      {BOOSTERS.map((b) => {
        const info = BOOSTER_INFO[b];
        const open = boosterUnlocked(b);
        return (
          <View key={b} style={styles.row}>
            <Image source={pieces[`boost_${b}`]} style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{info.name} <Text style={styles.own}>· own {m.boosters[b]}</Text></Text>
              <Text style={styles.desc} numberOfLines={2}>{open ? info.what : `Unlocks at level ${info.from}.`}</Text>
            </View>
            <GameButton
              size="sm"
              variant="accent"
              label={`${info.price}`}
              glyph={undefined}
              disabled={!open || state.coins < info.price}
              onPress={() => {
                if (buyBooster(b)) {
                  play("coin");
                  setNote(`${info.name} added to your boosters.`);
                }
              }}
            />
          </View>
        );
      })}
      <View style={styles.row}>
        <Image source={pieces.cur_lamp} style={styles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Free 50 Lamps</Text>
          <Text style={styles.desc}>Optional short video (about 30 s).</Text>
        </View>
        <GameButton
          size="sm"
          variant="secondary"
          label="Watch"
          onPress={() => {
            const shown = ads.showRewarded(() => {
              store.set({ coins: store.get().coins + 50 });
              setNote("+50 Lamps — thank you!");
            });
            if (!shown) setNote("No video is ready right now — try again in a minute.");
          }}
        />
      </View>
      <GameButton
        style={{ marginTop: 6 }}
        size="sm"
        variant="light"
        label={busy ? "Checking…" : "Restore purchases"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setNote("Checking your purchases…");
          const r = await restorePurchases("shop");
          setBusy(false);
          setNote(r.text);
        }}
      />
    </Popup>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 },
  balanceText: { fontFamily: fonts.display, fontSize: 24, color: palette.primaryDark },
  section: { fontFamily: fonts.display, fontSize: 15, color: palette.inkSoft, marginTop: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,251,240,0.9)", borderRadius: 16, padding: 8, marginBottom: 8, borderWidth: 1.5, borderColor: "#E0C79A" },
  icon: { width: 48, height: 48 },
  title: { fontFamily: fonts.display, fontSize: 16, color: palette.ink },
  own: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft },
  desc: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  note: { fontFamily: fonts.body, fontSize: 14, color: palette.accentDark, textAlign: "center", marginVertical: 6, backgroundColor: "rgba(31,158,143,0.12)", borderRadius: 12, padding: 8 },
  featured: { borderColor: "#F6A81C", borderWidth: 2.5, backgroundColor: "#FFF3D0" },
  owned: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.success, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  ownedText: { fontFamily: fonts.display, fontSize: 14, color: "#FFF6E0" },
});
