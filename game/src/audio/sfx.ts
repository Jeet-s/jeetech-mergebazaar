import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { store } from "../modules/store";

/**
 * Sound + haptics. Every meaningful interaction should call feedback() so the
 * game feels tactile: buttons → "tap", placements → "move"/"pop", rewards →
 * "coin"/"star1-3"/"success", mistakes → "error", loss → "fail".
 * Respects the player's Sound / Haptics settings (store).
 */
const SOURCES = {
  tap: require("../../assets/sfx/tap.wav"),
  pop: require("../../assets/sfx/pop.wav"),
  move: require("../../assets/sfx/move.wav"),
  whoosh: require("../../assets/sfx/whoosh.wav"),
  coin: require("../../assets/sfx/coin.wav"),
  star1: require("../../assets/sfx/star1.wav"),
  star2: require("../../assets/sfx/star2.wav"),
  star3: require("../../assets/sfx/star3.wav"),
  success: require("../../assets/sfx/success.wav"),
  fail: require("../../assets/sfx/fail.wav"),
  unlock: require("../../assets/sfx/unlock.wav"),
  error: require("../../assets/sfx/error.wav"),
} as const;
export type Sfx = keyof typeof SOURCES;

const players = new Map<Sfx, AudioPlayer>();
let music: AudioPlayer | null = null;

export async function initAudio(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
    for (const k of Object.keys(SOURCES) as Sfx[]) players.set(k, createAudioPlayer(SOURCES[k]));
    music = createAudioPlayer(require("../../assets/sfx/music_loop.wav"));
    music.loop = true;
    music.volume = MUSIC_BASE * musicVolume();
    syncMusic();
    store.subscribe(syncMusic);
  } catch {
    // audio is non-critical
  }
}

const MUSIC_BASE = 0.35;
const clamp01 = (v: number | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
/** Player volumes from the Settings sliders (0..1). 0 = off (the sound / music flags follow the slider). */
export const sfxVolume = () => (store.get().sound === false ? 0 : clamp01(store.get().sfxVolume));
export const musicVolume = () => (store.get().music === false ? 0 : clamp01(store.get().musicVolume));
export function setSfxVolume(v: number): void {
  const x = Math.round(clamp01(v, 0) * 100) / 100;
  store.set({ sfxVolume: x, sound: x > 0 });
}
export function setMusicVolume(v: number): void {
  const x = Math.round(clamp01(v, 0) * 100) / 100;
  store.set({ musicVolume: x, music: x > 0 });
}

function syncMusic() {
  if (!music) return;
  const on = musicVolume() > 0;
  try {
    music.volume = MUSIC_BASE * musicVolume();
  } catch {
    // ignore
  }
  if (on && !music.playing) music.play();
  if (!on && music.playing) music.pause();
}

/** `rate` > 1 raises the pitch (merges chime higher per tier and per combo step). */
export function play(name: Sfx, volume = 1, rate = 1): void {
  const master = sfxVolume();
  if (master <= 0) return;
  const p = players.get(name);
  if (!p) return;
  try {
    p.volume = Math.max(0, Math.min(1, volume * master));
    p.shouldCorrectPitch = false;
    p.setPlaybackRate(Math.max(0.5, Math.min(2, rate)));
    p.seekTo(0);
    p.play();
  } catch {
    // ignore
  }
}

type Haptic = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "select";
export function haptic(kind: Haptic = "light"): void {
  if (store.get().haptics === false) return;
  const H = Haptics;
  const run =
    kind === "success" ? H.notificationAsync(H.NotificationFeedbackType.Success)
    : kind === "warning" ? H.notificationAsync(H.NotificationFeedbackType.Warning)
    : kind === "error" ? H.notificationAsync(H.NotificationFeedbackType.Error)
    : kind === "select" ? H.selectionAsync()
    : H.impactAsync(kind === "heavy" ? H.ImpactFeedbackStyle.Heavy : kind === "medium" ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}

/** Sound + haptic together — the default for any player action. */
export function feedback(sound: Sfx, h: Haptic = "light"): void {
  play(sound);
  haptic(h);
}
