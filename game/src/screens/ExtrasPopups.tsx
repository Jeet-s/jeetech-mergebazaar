import { useEffect, useState } from "react";
import { Tappable } from "../ui/Tappable";
import { Image, Linking, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Confetti, GameButton, Popup, feedback, fonts, palette, play } from "../ui";
import { restorePurchases } from "../ui/purchases";
import { pieces, glyphs } from "../pieces";
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";
import { backupCode, lastBackupText, parseBackup } from "../game/backup";
import {
  FESTIVAL_POINTS, FESTIVAL_TIERS, GOLDEN_COST, claimFestival, festival, festivalInfo, meta, setMeta, starsAvailable, unlockGolden, type FestivalReward,
} from "../game/meta";

function useStore() {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
}

/* ───────── Save & restore progress (offline backup code) ───────── */

export function SaveProgressPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useStore();
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<ReturnType<typeof parseBackup> | null>(null);
  useEffect(() => {
    if (visible) {
      setCode(backupCode());
      setMsg(null);
      setConfirm(null);
      setInput("");
    }
  }, [visible]);
  const lv = Math.min(store.get().level, 64);
  return (
    <Popup visible={visible} title="Save & restore" onClose={onClose} footer={<GameButton label="Done" variant="secondary" onPress={onClose} />}>
      <Text style={styles.lead}>No account needed — keep this code to move your progress to a new phone.</Text>
      <Text style={styles.h}>Your backup code</Text>
      <View style={styles.codeBox}>
        <Text style={styles.code} selectable numberOfLines={3} ellipsizeMode="middle">{code}</Text>
      </View>
      <Text style={styles.small}>Level {lv} · {Object.values(store.get().stars ?? {}).reduce((a, b) => a + b, 0)}★ · {store.get().coins.toLocaleString()} Lamps · {meta().heirlooms.length} heirlooms</Text>
      <GameButton
        glyph="share"
        label="Copy / share code"
        variant="primary"
        size="md"
        onPress={async () => {
          const c = backupCode(true);
          setCode(c);
          try {
            await Share.share({ message: `My Merge Bazaar backup code (paste it in Settings › Save & restore progress):\n${c}` });
            analytics.track("progress_backup_shared");
          } catch {
            // the share sheet was dismissed — the code is still on screen and selectable
          }
          setMsg({ ok: true, text: "Code ready — keep it somewhere safe (notes, email to yourself)." });
        }}
      />
      <Text style={styles.status}>{lastBackupText()}</Text>

      <Text style={[styles.h, { marginTop: 14 }]}>Restore progress</Text>
      <TextInput
        value={input}
        onChangeText={(t) => {
          setInput(t);
          setConfirm(null);
        }}
        placeholder="Paste a backup code (MB1-…)"
        placeholderTextColor="rgba(122,82,64,0.6)"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        style={styles.input}
        accessibilityLabel="Backup code"
      />
      {confirm && confirm.ok ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>Replace the progress on this phone with Level {Math.min(confirm.level, 64)}, {confirm.stars}★ and {confirm.coins.toLocaleString()} Lamps?</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Cancel" onPress={() => setConfirm(null)} />
            <GameButton
              style={{ flex: 1.3 }}
              size="sm"
              variant="accent"
              label="Yes, restore"
              onPress={() => {
                confirm.apply();
                play("success");
                setConfirm(null);
                setInput("");
                setCode(backupCode());
                setMsg({ ok: true, text: `Progress restored: Level ${Math.min(confirm.level, 64)}, ${confirm.stars} stars.` });
              }}
            />
          </View>
        </View>
      ) : (
        <GameButton
          label="Restore progress"
          variant="accent"
          size="md"
          onPress={() => {
            const r = parseBackup(input);
            if (!r.ok) {
              feedback("error", "warning");
              setMsg({ ok: false, text: r.error });
              return;
            }
            setMsg(null);
            setConfirm(r);
          }}
        />
      )}
      {msg ? (
        <Animated.View entering={ZoomIn.duration(220)} style={[styles.msg, !msg.ok && styles.msgBad]}>
          <Image source={msg.ok ? glyphs.check : glyphs.close} style={{ width: 20, height: 20 }} />
          <Text style={[styles.msgText, !msg.ok && { color: palette.dangerDark }]} accessibilityLiveRegion="polite">{msg.text}</Text>
        </Animated.View>
      ) : null}
      <Text style={styles.small}>Purchases aren't in the code — use Restore purchases on the new phone.</Text>
    </Popup>
  );
}

/* ───────── Help & support ───────── */

const FAQ: { q: string; a: string }[] = [
  { q: "What are Sparks?", a: "Sparks are each level's energy budget, shown in the bar at the top. Tapping a generator or opening a crate uses Sparks. Plan your taps — merges and deliveries are free." },
  { q: "What is a Big Merge?", a: "When 5 or more identical items are on the board, dropping one onto another pulls in 5 at once: the result jumps two tiers and a bonus item appears, and it hits blockers in a wide ring." },
  { q: "How do boosters work?", a: "Fireworks open a crate, jar or knot and the 8 tiles around it. The Needle unpicks thread on one tile. Sweep hits every blocker in a row. Find them in the daily gift, the Festival and the Shop (for Lamps)." },
  { q: "Stuck on a level?", a: "Tap Stuck? on the board for help. Lose a level three times and Dadi quietly gifts a booster that fits it. There are no timers — retry as often as you like." },
  { q: "How do I move my progress to a new phone?", a: "Settings › Save & restore progress: copy your backup code, then paste it on the new phone and tap Restore progress. Purchases come back with Restore purchases." },
  { q: "I bought Remove Ads — where is it?", a: "Tap Restore purchases below while signed in to the same store account you bought it with." },
];

export function SupportPopup({ visible, onClose, onSaveProgress, privacyUrl }: { visible: boolean; onClose: () => void; onSaveProgress?: () => void; privacyUrl?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setNote(null);
  }, [visible]);
  return (
    <Popup visible={visible} title="Help & support" onClose={onClose} footer={<GameButton label="Close" variant="secondary" onPress={onClose} />}>
      {FAQ.map((f, i) => (
        <Tappable
          key={f.q}
          onPress={() => {
            setOpen(open === i ? null : i);
          }}
          style={[styles.faq, open === i && styles.faqOpen]}
        >
          <View style={styles.faqHead}>
            <Text style={styles.faqQ}>{f.q}</Text>
            <Text style={styles.chev}>{open === i ? "–" : "+"}</Text>
          </View>
          {open === i ? <Text style={styles.faqA}>{f.a}</Text> : null}
        </Tappable>
      ))}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <GameButton
          style={{ flex: 1 }}
          size="sm"
          variant="light"
          label={busy ? "Checking…" : "Restore purchases"}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setNote("Checking your purchases…");
            const r = await restorePurchases("support");
            setBusy(false);
            setNote(r.text);
          }}
        />
        {onSaveProgress ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Save progress" onPress={onSaveProgress} /> : null}
      </View>
      {note ? <Text style={styles.result} accessibilityLiveRegion="polite">{note}</Text> : null}
      {privacyUrl ? <GameButton style={{ marginTop: 8 }} size="sm" variant="light" label="Privacy policy" onPress={() => void Linking.openURL(privacyUrl).catch(() => {})} /> : null}
      <Text style={styles.small}>Merge Bazaar plays fully offline and keeps no account or personal data.</Text>
    </Popup>
  );
}

/* ───────── Festival event hub + Festival Pass ───────── */

const rewardPiece = (r: FestivalReward) => (r.booster ? `boost_${r.booster}` : "cur_lamp");
function timeLeft(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h ${Math.max(1, Math.floor((ms % 3600000) / 60000))}m left`;
}

export function FestivalPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useStore();
  const [note, setNote] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (visible) {
      setNote(null);
      analytics.track("festival_view");
    }
  }, [visible]);
  const f = festival();
  const info = festivalInfo();
  const top = FESTIVAL_TIERS[FESTIVAL_TIERS.length - 1].points;
  const away = meta().festivalAway;
  const nextTier = FESTIVAL_TIERS.find((t) => f.points < t.points);
  const claim = (i: number, track: "free" | "golden") => {
    const r = claimFestival(i, track);
    if (r) {
      play("coin");
      setBurst((b) => b + 1);
      setNote(`You got ${r.label}!`);
    }
  };
  return (
    <>
      <Popup visible={visible} title={info.name} onClose={onClose} footer={
        <>
          {note ? <Text style={styles.result} accessibilityLiveRegion="polite">{note}</Text> : null}
          <GameButton label="Close" variant="secondary" onPress={onClose} />
        </>
      }>
        {away ? (
          <Tappable style={styles.away} onPress={() => setMeta({ festivalAway: null })}>
            <Text style={styles.awayText}>Last festival ({away.name}) ended — granted automatically: {away.rewards.join(", ")}. Tap to dismiss.</Text>
          </Tappable>
        ) : null}
        <View style={styles.fHead}>
          <Image source={pieces.F4} style={{ width: 54, height: 54 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fPoints}>{f.points.toLocaleString()} festival points</Text>
            <Text style={styles.fSub}>{timeLeft(info.msLeft)} · {nextTier ? `next reward at ${nextTier.points}` : "every reward reached!"}</Text>
          </View>
        </View>
        <View style={styles.bar}>
          <LinearGradient colors={["#FFE07A", "#F6A81C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: `${Math.max(3, Math.min(100, (f.points / top) * 100))}%` }]} />
          {FESTIVAL_TIERS.map((t) => (
            <View key={t.points} style={[styles.tick, { left: `${(t.points / top) * 100}%` }, f.points >= t.points && { backgroundColor: "#FFF6E0" }]} />
          ))}
        </View>
        <Text style={styles.how}>Win levels (+{FESTIVAL_POINTS.level}), earn Marigold stars (+{FESTIVAL_POINTS.star} each) and win Bazaar Day (+{FESTIVAL_POINTS.bazaar}).</Text>
        <View style={styles.autoNote}>
          <Image source={glyphs.check} style={{ width: 18, height: 18 }} />
          <Text style={styles.autoText}>Unclaimed rewards are granted automatically when the festival ends.</Text>
        </View>

        <View style={styles.trackHead}>
          <Text style={[styles.trackLabel, { flex: 0.45 }]}>Goal</Text>
          <Text style={[styles.trackLabel, { flex: 1 }]}>Free track</Text>
          <Text style={[styles.trackLabel, { flex: 1, color: "#B8762A" }]}>Golden track</Text>
        </View>
        {FESTIVAL_TIERS.map((t, i) => {
          const reached = f.points >= t.points;
          return (
            <View key={t.points} style={[styles.tier, reached && styles.tierReached]}>
              <Text style={styles.tierPts}>{t.points}</Text>
              <RewardCell r={t.free} reached={reached} claimed={f.free.includes(i)} onClaim={() => claim(i, "free")} />
              <RewardCell r={t.golden} golden reached={reached} locked={!f.goldenOn} claimed={f.golden.includes(i)} onClaim={() => claim(i, "golden")} />
            </View>
          );
        })}
        {!f.goldenOn ? (
          <View style={styles.golden}>
            <Text style={styles.goldenTitle}>Unlock the Golden track for this festival</Text>
            <Text style={styles.goldenSub}>Extra Lamps and boosters on every goal — earned in-game, nothing random.</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <GameButton
                style={{ flex: 1 }}
                size="sm"
                variant="primary"
                label={`${GOLDEN_COST.stars} ★`}
                onPress={() => {
                  if (unlockGolden("stars")) {
                    play("unlock");
                    setBurst((b) => b + 1);
                    setNote("Golden track unlocked!");
                  } else {
                    feedback("error", "warning");
                    setNote(`You need ${GOLDEN_COST.stars} Marigold stars to spend (you have ${starsAvailable()}).`);
                  }
                }}
              />
              <GameButton
                style={{ flex: 1 }}
                size="sm"
                variant="accent"
                label={`${GOLDEN_COST.lamps} Lamps`}
                onPress={() => {
                  if (unlockGolden("lamps")) {
                    play("unlock");
                    setBurst((b) => b + 1);
                    setNote("Golden track unlocked!");
                  } else {
                    feedback("error", "warning");
                    setNote(`You need ${GOLDEN_COST.lamps} Lamps (you have ${store.get().coins.toLocaleString()}).`);
                  }
                }}
              />
            </View>
          </View>
        ) : (
          <Text style={styles.goldenOn}>Golden track unlocked for {info.name} ✓</Text>
        )}
      </Popup>
      {visible ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Confetti trigger={burst} />
        </View>
      ) : null}
    </>
  );
}

function RewardCell({ r, reached, claimed, locked, golden, onClaim }: { r: FestivalReward; reached: boolean; claimed: boolean; locked?: boolean; golden?: boolean; onClaim: () => void }) {
  const can = reached && !claimed && !locked;
  return (
    <Tappable
      disabled={!can}
      onPress={() => {
        onClaim();
      }}
      style={[styles.cell, golden && styles.cellGolden, can && styles.cellReady, claimed && styles.cellDone]}
      accessibilityLabel={`${r.label}${claimed ? ", claimed" : can ? ", claim" : locked ? ", locked" : ""}`}
    >
      <Image source={pieces[rewardPiece(r)]} style={{ width: 30, height: 30, opacity: claimed ? 0.45 : locked ? 0.6 : 1 }} />
      <Text style={styles.cellLabel} numberOfLines={1} adjustsFontSizeToFit>{r.label}</Text>
      <Text style={[styles.cellState, can && { color: palette.accentDark, fontFamily: fonts.body }]} numberOfLines={1}>{claimed ? "Claimed ✓" : locked ? "Golden only" : can ? "Tap to claim" : "Not yet"}</Text>
      {locked && !claimed ? <Image source={glyphs.lock} style={{ width: 16, height: 16, position: "absolute", right: 4, top: 4 }} /> : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.body, fontSize: 15, color: palette.ink, textAlign: "center", marginBottom: 8 },
  h: { fontFamily: fonts.display, fontSize: 14, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  codeBox: { backgroundColor: "#2B2F77", borderRadius: 12, borderWidth: 2, borderColor: "#D9A441", padding: 10 },
  code: { fontFamily: fonts.bodyRegular, fontSize: 12, color: "#FFF1D6" },
  small: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginVertical: 6 },
  status: { fontFamily: fonts.body, fontSize: 13, color: palette.accentDark, textAlign: "center", marginTop: 6 },
  input: { width: "100%", minHeight: 64, maxHeight: 110, backgroundColor: "#FFFBF0", borderRadius: 12, borderWidth: 2, borderColor: "#C9A26A", padding: 10, fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.ink, marginBottom: 8, textAlignVertical: "top" },
  confirm: { backgroundColor: "#FFF3D0", borderRadius: 14, borderWidth: 2, borderColor: "#F6A81C", padding: 10, gap: 8 },
  confirmText: { fontFamily: fonts.body, fontSize: 14, color: palette.ink, textAlign: "center" },
  msg: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: "rgba(31,158,143,0.14)", borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: palette.accent },
  msgBad: { backgroundColor: "rgba(216,67,59,0.1)", borderColor: palette.danger },
  msgText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: palette.accentDark },
  result: { fontFamily: fonts.body, fontSize: 14, color: palette.accentDark, textAlign: "center", marginVertical: 8, backgroundColor: "rgba(31,158,143,0.12)", borderRadius: 12, padding: 8 },
  faq: { backgroundColor: "#FFFBF0", borderRadius: 14, borderWidth: 2, borderColor: "#E0C79A", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, minHeight: 48, justifyContent: "center" },
  faqOpen: { borderColor: "#F6A81C", backgroundColor: "#FFF3D0" },
  faqHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  faqQ: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: palette.ink },
  faqA: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft, marginTop: 4, lineHeight: 18 },
  chev: { fontFamily: fonts.display, fontSize: 22, color: palette.inkSoft },
  away: { backgroundColor: "#2B2F77", borderRadius: 12, padding: 8, marginBottom: 8, borderWidth: 2, borderColor: "#D9A441" },
  awayText: { fontFamily: fonts.body, fontSize: 13, color: "#FFF1D6", textAlign: "center" },
  fHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  fPoints: { fontFamily: fonts.display, fontSize: 20, color: palette.primaryDark },
  fSub: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft },
  bar: { height: 18, borderRadius: 9, backgroundColor: "#2B2F77", borderWidth: 2, borderColor: "#7A4A12", overflow: "hidden", marginTop: 8, justifyContent: "center" },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 8 },
  tick: { position: "absolute", width: 3, marginLeft: -3, top: 2, bottom: 2, borderRadius: 2, backgroundColor: "rgba(255,246,224,0.45)" },
  how: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginTop: 6 },
  autoNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(31,158,143,0.12)", borderRadius: 12, padding: 8, marginTop: 8, marginBottom: 8 },
  autoText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: palette.accentDark },
  trackHead: { flexDirection: "row", gap: 6, paddingHorizontal: 4, marginBottom: 4 },
  trackLabel: { fontFamily: fonts.display, fontSize: 13, color: palette.inkSoft, textAlign: "center" },
  tier: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, padding: 4, borderRadius: 14, backgroundColor: "rgba(255,251,240,0.6)" },
  tierReached: { backgroundColor: "rgba(246,168,28,0.18)" },
  tierPts: { flex: 0.45, fontFamily: fonts.display, fontSize: 15, color: palette.ink, textAlign: "center" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 64, borderRadius: 12, borderWidth: 2, borderColor: "#E0C79A", backgroundColor: "#FFFBF0", paddingHorizontal: 4, paddingVertical: 4 },
  cellGolden: { borderColor: "#D9A441", backgroundColor: "#FFF0C8" },
  cellReady: { borderColor: palette.accent, borderWidth: 3 },
  cellDone: { backgroundColor: "#EADCC0" },
  cellLabel: { fontFamily: fonts.body, fontSize: 12, color: palette.ink, textAlign: "center" },
  cellState: { fontFamily: fonts.bodyRegular, fontSize: 11, color: palette.inkSoft, textAlign: "center" },
  golden: { backgroundColor: "#FFF3D0", borderRadius: 14, borderWidth: 2, borderColor: "#F6A81C", padding: 10, marginTop: 4 },
  goldenTitle: { fontFamily: fonts.display, fontSize: 15, color: palette.ink, textAlign: "center" },
  goldenSub: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center" },
  goldenOn: { fontFamily: fonts.display, fontSize: 14, color: palette.success, textAlign: "center", marginTop: 6 },
});
