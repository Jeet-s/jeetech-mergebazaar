import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Popup } from "./Popup";
import { Toggle } from "./Toggle";
import { Slider } from "./Slider";
import { GameButton } from "./GameButton";
import { store } from "../modules/store";
import { share } from "../modules/share";
import { notify } from "../modules/notify";
import { fonts, palette } from "./theme";
import { meta, setSetting } from "../game/meta";
import { feedback, musicVolume, play, setMusicVolume, setSfxVolume, sfxVolume } from "../audio/sfx";
import { glyphs, type Glyph } from "../pieces";
import { restorePurchases } from "./purchases";

export async function enableReminders(): Promise<boolean> {
  const ok = await notify.ask("daily_gift");
  if (ok) {
    await notify.daily("daily-gift", { hour: 19, minute: 0 }, { title: "Your daily gift is ready", body: "Dadi left a little something in the courtyard. Your streak is waiting!" });
  }
  setSetting("reminders", ok);
  return ok;
}

/** Opens the phone's display settings (the game's look follows the phone: brightness, text size, dark surroundings). */
export function openDisplaySettings(): void {
  const go = Platform.OS === "android" ? Linking.sendIntent("android.settings.DISPLAY_SETTINGS") : Linking.openSettings();
  go.catch(() => Linking.openSettings().catch(() => {}));
}

/** A tappable settings row: brass icon disc, label + note, a chevron or a value. ≥ 56dp tall. */
export function SettingsRow({ glyph, label, note, value, onPress }: { glyph: Glyph; label: string; note?: string; value?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        feedback("tap", "select");
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: "rgba(246,168,28,0.14)" }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>
        <Image source={glyphs[glyph]} style={{ width: 22, height: 22 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

/** Settings: volume sliders, haptics, display/theme, accessibility, reminders, progress backup, help, share, purchases. */
export function SettingsPopup({ visible, onClose, privacyUrl, onSaveProgress, onSupport }: {
  visible: boolean; onClose: () => void; privacyUrl?: string; onSaveProgress?: () => void; onSupport?: () => void;
}) {
  const [, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setRestoreNote(null);
  }, [visible]);
  const set = meta().settings;
  return (
    <Popup visible={visible} title="Settings" onClose={onClose} footer={<GameButton label="Done" variant="primary" onPress={onClose} />}>
      <Text style={styles.section}>Sound</Text>
      <Slider label="Sound effects" value={sfxVolume()} onChange={setSfxVolume} onCommit={(v) => v > 0 && play("coin")} />
      <Slider label="Music" value={musicVolume()} onChange={setMusicVolume} />
      <Toggle label="Vibration" value={store.get().haptics !== false} onChange={(v) => store.set({ haptics: v })} />

      <Text style={styles.section}>Display</Text>
      <SettingsRow glyph="gear" label="Theme · Follows your phone" note="Brightness and text size come from your phone — tap to open its display settings" onPress={openDisplaySettings} />

      <Text style={styles.section}>Comfort</Text>
      <Toggle label="Reduce motion" note="No shake, petals or bursts — simple fades" value={set.reduceMotion} onChange={(v) => setSetting("reduceMotion", v)} />
      <Toggle label="Hints & pointers" note="Coach tips and the guiding hand" value={set.hints} onChange={(v) => setSetting("hints", v)} />
      <Toggle label="Left-handed tools" note="Mirror the tool bar under the board" value={set.leftHanded} onChange={(v) => setSetting("leftHanded", v)} />
      <Toggle
        label="Daily gift reminder"
        note="One gentle note in the evening"
        value={set.reminders}
        onChange={(v) => {
          if (v) void enableReminders();
          else {
            void notify.cancel("daily-gift");
            setSetting("reminders", false);
          }
        }}
      />

      <Text style={styles.section}>Progress & help</Text>
      <SettingsRow glyph="book" label="Save & restore progress" note="A backup code — no account needed" onPress={() => onSaveProgress?.()} />
      <SettingsRow glyph="help" label="Help & support" note="Questions, tips and purchases" onPress={() => onSupport?.()} />

      <View style={styles.buttons}>
        {/* Share the game (src/modules/share.ts) — factory-owned, keep it (owner, 2026-10-25). */}
        <GameButton style={{ flex: 1 }} size="sm" variant="light" glyph="share" label="Share" onPress={() => void share.app("settings")} />
        <GameButton
          style={{ flex: 1.4 }}
          size="sm"
          variant="light"
          label={busy ? "Checking…" : "Restore purchases"}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setRestoreNote("Checking your purchases…");
            const r = await restorePurchases("settings");
            setBusy(false);
            setRestoreNote(r.text);
          }}
        />
      </View>
      {restoreNote ? <Text style={styles.result} accessibilityLiveRegion="polite">{restoreNote}</Text> : null}
      <Text style={styles.small}>Every level plays offline. Tiers show a shape badge (circle, diamond, square, star, hexagon) as well as colour.</Text>
      {privacyUrl ? (
        <Text style={styles.link} onPress={() => Linking.openURL(privacyUrl)}>Privacy policy</Text>
      ) : null}
    </Popup>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.display, fontSize: 14, color: palette.inkSoft, marginTop: 12, textTransform: "uppercase", letterSpacing: 1 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 14 },
  small: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginTop: 10 },
  result: { fontFamily: fonts.body, fontSize: 14, color: palette.accentDark, textAlign: "center", marginTop: 10, backgroundColor: "rgba(31,158,143,0.12)", borderRadius: 12, padding: 8 },
  link: { fontFamily: fonts.bodyRegular, color: palette.inkSoft, textAlign: "center", marginTop: 12, textDecorationLine: "underline" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(122,82,64,0.18)", borderRadius: 8 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#C98A2A", borderWidth: 2, borderColor: "#7A4A12", alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.body, fontSize: 17, color: palette.ink },
  rowNote: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  rowValue: { fontFamily: fonts.display, fontSize: 14, color: palette.accentDark },
  chev: { fontFamily: fonts.display, fontSize: 28, color: palette.inkSoft, marginLeft: 2, marginTop: -4 },
});
