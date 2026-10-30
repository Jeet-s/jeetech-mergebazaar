import { useEffect, useState } from "react";
import { Tappable } from "../ui/Tappable";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Confetti, GameButton, Popup, feedback, fonts, palette, play } from "../ui";
import { Medallion, StoryPopup } from "../ui/StoryPopup";
import { enableReminders } from "../ui/SettingsPopup";
import { pieces } from "../pieces";
import { store } from "../modules/store";
import { LinearGradient } from "expo-linear-gradient";
import {
  GIFTS, HEIRLOOMS, HEIRLOOM_SETS, SET_BONUS, SET_POSTCARD, STORY, claimGift, currentLevel, giftReady, heirloomHow, heirloomsOf, markHeirloomsSeen, markSeen, meta,
  type Beat, type Gift, type HeirloomSet,
} from "../game/meta";

const giftPiece = (g: Gift) => (g.booster ? `boost_${g.booster}` : "cur_lamp");

/** 7-day gift calendar. Claiming opts in to a daily reminder (permission is asked only now, never at launch). */
export function DailyGiftPopup({ visible, onClose, onBazaarDay, bazaarDone }: { visible: boolean; onClose: () => void; onBazaarDay?: () => void; bazaarDone?: boolean }) {
  const [, force] = useState(0);
  const [got, setGot] = useState<Gift | null>(null);
  const [burst, setBurst] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => {
    if (visible) setGot(null);
  }, [visible]);
  const day = meta().daily.day;
  const ready = giftReady();
  return (
    <>
      <Popup
        visible={visible}
        title="Daily Gift"
        onClose={onClose}
        footer={
          ready ? (
            <GameButton
              label="Claim gift"
              variant="primary"
              size="lg"
              onPress={() => {
                const g = claimGift();
                if (g) {
                  setGot(g);
                  setBurst((b) => b + 1);
                  play("coin");
                  if (!meta().settings.reminders) void enableReminders();
                }
              }}
            />
          ) : (
            <GameButton label="See you tomorrow!" variant="secondary" onPress={onClose} />
          )
        }
      >
        <Text style={styles.note}>A gift every day you visit. Missed a day? Your streak just pauses — it never resets.</Text>
        <View style={styles.grid}>
          {GIFTS.map((g, i) => {
            const claimed = i < day || (!ready && day === 0);
            const today = ready && i === day;
            return (
              <View key={i} style={[styles.day, i === 6 && styles.dayBig, today && styles.dayToday, claimed && styles.dayDone]}>
                <Text style={styles.dayLabel}>Day {i + 1}</Text>
                <Image source={pieces[giftPiece(g)]} style={{ width: i === 6 ? 52 : 40, height: i === 6 ? 52 : 40, opacity: claimed ? 0.45 : 1 }} />
                <Text style={styles.dayGift} numberOfLines={1}>{g.label}</Text>
                {claimed ? (
                  <View style={styles.tick}>
                    <Image source={require("../../assets/art/ui/check.png")} style={{ width: 16, height: 16 }} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {got ? (
          <Animated.View entering={ZoomIn.springify()} style={styles.got}>
            <Image source={pieces[giftPiece(got)]} style={{ width: 44, height: 44 }} />
            <Text style={styles.gotText}>You got {got.label}!</Text>
          </Animated.View>
        ) : null}
        {got?.heirloom ? (
          <Animated.View entering={ZoomIn.delay(300).springify()} style={styles.got}>
            <Image source={pieces[got.heirloom.piece]} style={{ width: 44, height: 44 }} />
            <Text style={styles.gotText} numberOfLines={2}>Heirloom found: {got.heirloom.name}</Text>
          </Animated.View>
        ) : null}
        {onBazaarDay ? (
          <Tappable
            onPress={() => {
              onBazaarDay();
            }}
            style={styles.bazaarCard}
            accessibilityLabel="Bazaar Day"
          >
            <Image source={pieces.Mb} style={{ width: 44, height: 44 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.beatTitle}>Bazaar Day</Text>
              <Text style={styles.beatSub}>{bazaarDone ? "Done today ✓ · back tomorrow" : "Today's special board — a small guaranteed reward"}</Text>
            </View>
            <Image source={require("../../assets/art/ui/play.png")} style={{ width: 26, height: 26, opacity: bazaarDone ? 0.4 : 1 }} />
          </Tappable>
        ) : null}
      </Popup>
      {visible ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Confetti trigger={burst} />
        </View>
      ) : null}
    </>
  );
}

/** Heirloom book: 5 sets × 6 keepsakes (level wins across each chapter, the chapter finale, daily-gift days and
 *  Bazaar Day boards). A full set pays +SET_BONUS Lamps and a family postcard. Tap a set for its detail page. */
export function HeirloomPopup({ visible, onClose, initialSet }: { visible: boolean; onClose: () => void; initialSet?: HeirloomSet }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  const [open, setOpen] = useState<HeirloomSet | null>(initialSet ?? null);
  useEffect(() => {
    if (visible) {
      setOpen(initialSet ?? null);
      markHeirloomsSeen();
    }
  }, [visible]);
  const have = meta().heirlooms;
  if (open) return <HeirloomSetDetail visible={visible} set={open} onBack={() => setOpen(null)} onClose={onClose} />;
  return (
    <Popup visible={visible} title="Heirloom Book" onClose={onClose} footer={<GameButton label="Close" variant="secondary" onPress={onClose} />}>
      <Text style={styles.note}>{have.filter((id) => HEIRLOOMS.some((h) => h.id === id)).length}/{HEIRLOOMS.length} keepsakes found. Tap a set to see where each one hides. A full set: +{SET_BONUS} Lamps and a postcard.</Text>
      {HEIRLOOM_SETS.map((set) => {
        const items = heirloomsOf(set);
        const n = items.filter((h) => have.includes(h.id)).length;
        const done = n === items.length;
        return (
          <Pressable
            key={set}
            onPress={() => {
              feedback("tap", "select");
              setOpen(set);
            }}
            style={({ pressed }) => [styles.set, done && styles.setDone, pressed && { transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`${set}, ${n} of ${items.length}. Open set`}
          >
            <View style={styles.setTop}>
              <Text style={styles.setName}>{set}{done ? "  ✓" : ""}</Text>
              <Text style={styles.setCount}>{n}/{items.length}  ›</Text>
            </View>
            <View style={styles.setRow}>
              {items.map((h) => {
                const got = have.includes(h.id);
                return (
                  <View key={h.id} style={[styles.heirMini, got && styles.heirGot]}>
                    <Image source={pieces[h.piece]} style={[{ width: 36, height: 36 }, !got && { tintColor: "#3A1F14", opacity: 0.3 }]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.setTrack}>
              <View style={[styles.setFill, { width: `${(n / items.length) * 100}%` }]} />
            </View>
          </Pressable>
        );
      })}
    </Popup>
  );
}

function HeirloomSetDetail({ visible, set, onBack, onClose }: { visible: boolean; set: HeirloomSet; onBack: () => void; onClose: () => void }) {
  const have = meta().heirlooms;
  const items = heirloomsOf(set);
  const n = items.filter((h) => have.includes(h.id)).length;
  const done = n === items.length;
  const paid = (meta().setsPaid ?? []).includes(set) || done;
  return (
    <Popup visible={visible} title={set} onClose={onClose} footer={<GameButton label="Back to the book" glyph="back" variant="secondary" onPress={onBack} />}>
      <View style={styles.detailHead}>
        <Text style={styles.detailCount}>{n} of {items.length} found</Text>
        <View style={[styles.setTrack, { height: 14, flex: 1 }]}>
          <LinearGradient colors={["#FFE07A", "#F6A81C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.setFill, { width: `${Math.max(4, (n / items.length) * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.grid6}>
        {items.map((h) => {
          const got = have.includes(h.id);
          return (
            <View key={h.id} style={[styles.slot, got && styles.slotGot]}>
              <View style={[styles.heirFrame, got && styles.heirGotBig]}>
                <Image source={pieces[h.piece]} style={[{ width: 64, height: 64 }, !got && { tintColor: "#3A1F14", opacity: 0.32 }]} />
                {got ? (
                  <View style={styles.slotTick}>
                    <Image source={require("../../assets/art/ui/check.png")} style={{ width: 14, height: 14 }} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.slotName} numberOfLines={2}>{got ? h.name : "???"}</Text>
              <Text style={[styles.slotHow, got && { color: palette.success }]} numberOfLines={2}>{got ? "Found ✓" : heirloomHow(h)}</Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.reward, done && styles.rewardDone]}>
        <Text style={[styles.rewardTitle, done && { color: "#FFC93A" }]}>{done ? "Set complete!" : "Set reward"}</Text>
        <View style={styles.rewardRow}>
          <Image source={pieces.cur_lamp} style={{ width: 34, height: 34 }} />
          <Text style={[styles.rewardText, done && styles.onDark]}>+{SET_BONUS} Lamps</Text>
          <Text style={[styles.rewardText, done && styles.onDark]}>·</Text>
          <Text style={[styles.rewardText, done && styles.onDark]}>Family postcard</Text>
        </View>
        {done ? (
          <>
            <Text style={styles.postcard}>{SET_POSTCARD[set]}</Text>
            <Text style={[styles.rewardState, styles.onDark]}>{paid ? `Reward received ✓ (+${SET_BONUS} Lamps added when the set was completed)` : ""}</Text>
          </>
        ) : (
          <Text style={styles.rewardState}>Granted automatically the moment the 6th keepsake is found — {items.length - n} to go.</Text>
        )}
      </View>
    </Popup>
  );
}

/** Story book: the beats reached so far (replayable) and what comes next. */
export function StoryBookPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [open, setOpen] = useState<Beat | null>(null);
  const lv = currentLevel();
  const reached = STORY.filter((b) => b.level <= lv);
  const next = STORY.find((b) => b.level > lv);
  return (
    <>
      <Popup visible={visible && !open} title="Dadi's Story" onClose={onClose} footer={<GameButton label="Close" variant="secondary" onPress={onClose} />}>
        <View style={styles.cast}>
          <Medallion who="dadi" size={50} />
          <Medallion who="aarav" size={50} />
          <Medallion who="meera" size={50} />
          <Medallion who="imran" size={50} />
        </View>
        <Text style={styles.note}>Rebuild the family home and bazaar before Dadi's 80th birthday festival.</Text>
        {reached.map((b) => (
          <Tappable
            key={b.id}
            onPress={() => {
              setOpen(b);
            }}
            style={styles.beat}
          >
            <Medallion who={b.lines[0].who} size={38} label={false} />
            <View style={{ flex: 1 }}>
              <Text style={styles.beatTitle}>{b.title}</Text>
              <Text style={styles.beatSub}>Level {b.level} · {meta().storySeen.includes(b.id) ? "tap to replay" : "new!"}</Text>
            </View>
            <Image source={require("../../assets/art/ui/play.png")} style={{ width: 26, height: 26 }} />
          </Tappable>
        ))}
        {next ? <Text style={styles.next}>Next chapter of the story at level {next.level}: "{next.title}"</Text> : null}
      </Popup>
      <StoryPopup
        beat={open}
        onDone={(skipped) => {
          if (open) markSeen(open.id, skipped);
          setOpen(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 14, color: palette.inkSoft, textAlign: "center", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  day: { width: "30%", alignItems: "center", backgroundColor: "#FFFBF0", borderRadius: 14, paddingVertical: 6, borderWidth: 2, borderColor: "#E0C79A" },
  dayBig: { width: "62%", backgroundColor: "#FFF0C8", borderColor: "#F6A81C" },
  dayToday: { borderColor: "#F6A81C", borderWidth: 3, backgroundColor: "#FFE9A8" },
  dayDone: { backgroundColor: "#EADCC0" },
  dayLabel: { fontFamily: fonts.display, fontSize: 13, color: palette.ink },
  dayGift: { fontFamily: fonts.bodyRegular, fontSize: 11, color: palette.inkSoft },
  tick: { position: "absolute", right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "#3E8E41", alignItems: "center", justifyContent: "center" },
  got: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, backgroundColor: "#2B2F77", borderRadius: 14, padding: 8, borderWidth: 2, borderColor: "#D9A441" },
  gotText: { fontFamily: fonts.display, fontSize: 17, color: "#FFF1D6" },
  set: { backgroundColor: "#FFFBF0", borderRadius: 16, padding: 10, marginBottom: 8, borderWidth: 2, borderColor: "#E0C79A", minHeight: 48 },
  setDone: { borderColor: "#F6A81C", backgroundColor: "#FFF3D0" },
  setTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  setName: { fontFamily: fonts.display, fontSize: 16, color: palette.ink },
  setCount: { fontFamily: fonts.display, fontSize: 15, color: palette.primaryDark },
  setRow: { flexDirection: "row", justifyContent: "space-between" },
  heirMini: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#EADCC0", borderWidth: 2, borderColor: "#C9A26A" },
  setTrack: { height: 8, borderRadius: 5, backgroundColor: "#EADCC0", borderWidth: 1, borderColor: "#C9A26A", overflow: "hidden", marginTop: 8 },
  setFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#F6A81C", borderRadius: 5 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  detailCount: { fontFamily: fonts.display, fontSize: 16, color: palette.ink, marginTop: 6 },
  grid6: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  slot: { width: "48.5%", alignItems: "center", backgroundColor: "#FFFBF0", borderRadius: 16, borderWidth: 2, borderColor: "#E0C79A", paddingVertical: 8, paddingHorizontal: 6 },
  slotGot: { borderColor: "#F6A81C", backgroundColor: "#FFF3D0" },
  heirFrame: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#EADCC0", borderWidth: 2.5, borderColor: "#C9A26A" },
  heirGot: { backgroundColor: "#2B2F77", borderColor: "#F6A81C" },
  heirGotBig: { backgroundColor: "#2B2F77", borderColor: "#F6A81C", borderWidth: 3 },
  slotTick: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: "#3E8E41", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFF6E0" },
  slotName: { fontFamily: fonts.display, fontSize: 13, color: palette.ink, textAlign: "center", marginTop: 6 },
  slotHow: { fontFamily: fonts.bodyRegular, fontSize: 11, color: palette.inkSoft, textAlign: "center" },
  reward: { marginTop: 10, backgroundColor: "#FFFBF0", borderRadius: 16, borderWidth: 2, borderColor: "#E0C79A", padding: 10, alignItems: "center", gap: 4 },
  rewardDone: { backgroundColor: "#2B2F77", borderColor: "#F6A81C" },
  rewardTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.primaryDark },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rewardText: { fontFamily: fonts.display, fontSize: 15, color: palette.ink },
  rewardState: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center" },
  onDark: { color: "#FFF1D6" },
  postcard: { fontFamily: fonts.body, fontSize: 14, color: "#FFF1D6", textAlign: "center", fontStyle: "italic", marginVertical: 4 },
  bazaarCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF3D0", borderRadius: 14, padding: 8, marginTop: 10, borderWidth: 2, borderColor: "#F6A81C", minHeight: 56 },
  cast: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  beat: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBF0", borderRadius: 14, padding: 6, marginBottom: 6, borderWidth: 2, borderColor: "#E0C79A", minHeight: 52 },
  beatTitle: { fontFamily: fonts.display, fontSize: 15, color: palette.ink },
  beatSub: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  next: { fontFamily: fonts.body, fontSize: 13, color: palette.inkSoft, textAlign: "center", marginTop: 6 },
});
