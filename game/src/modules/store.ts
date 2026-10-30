import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny persisted player state (entitlements + currency). Loaded once at boot;
 * reads are synchronous afterwards so gameplay code stays simple.
 */
export interface PlayerState {
  adsRemoved: boolean;
  coins: number;
  level: number;
  /** Settings — default on. */
  sound?: boolean;
  music?: boolean;
  haptics?: boolean;
  /** Volumes 0..1 (Settings sliders; 0 = off). Default 1. */
  sfxVolume?: number;
  musicVolume?: number;
  /** Best stars per level id (progress map). */
  stars?: Record<string, number>;
  tutorialDone?: boolean;
  /** Bazaar Day (src/game/daily.ts): local day key of the last daily board won, and the total won. */
  dailyDone?: string;
  dailyWins?: number;
  /** One-time coach tips already shown (e.g. "sparks"). */
  tips?: Record<string, boolean>;
  /** Merge Bazaar meta (src/game/meta.ts): booster inventory, restoration, heirlooms, story, daily gift, settings. */
  meta?: import("../game/meta").Meta;
}

const KEY = "player_state_v1";
let state: PlayerState = { adsRemoved: false, coins: 0, level: 1, sound: true, music: true, haptics: true, stars: {}, tutorialDone: false };
const listeners = new Set<(s: PlayerState) => void>();

export const store = {
  async load(): Promise<PlayerState> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<PlayerState>) };
    } catch {
      // first launch / corrupted → defaults
    }
    return state;
  },
  get(): PlayerState {
    return state;
  },
  set(patch: Partial<PlayerState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  },
  subscribe(l: (s: PlayerState) => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
