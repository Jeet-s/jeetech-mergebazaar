/**
 * Offline "Save & restore progress": the player's progress as a text code (no account, no network). The code is
 * the save (minus purchases — those come back through Restore purchases) as compact JSON, base64-encoded, with an
 * FNV-1a checksum so a mistyped or truncated code is rejected instead of corrupting the save.
 *   MB1-<base64 payload>-<8 hex checksum>
 */
import { store, type PlayerState } from "../modules/store";
import { analytics } from "../modules/analytics";
import { LEVELS } from "./levels";
import { meta, setMeta, starsEarned, type Meta } from "./meta";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}
function fromUtf8(b: number[]): string {
  let s = "";
  for (let i = 0; i < b.length; ) {
    const c = b[i];
    let cp = c, n = 0;
    if (c >= 0xf0) { cp = c & 7; n = 3; } else if (c >= 0xe0) { cp = c & 15; n = 2; } else if (c >= 0xc0) { cp = c & 31; n = 1; }
    for (let k = 1; k <= n; k++) cp = (cp << 6) | (b[i + k] & 63);
    s += String.fromCodePoint(cp);
    i += n + 1;
  }
  return s;
}
function b64(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return s;
}
function unb64(s: string): number[] | null {
  const clean = s.replace(/=+$/, "");
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return out;
}
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface Payload { v: 1; at: number; level: number; coins: number; stars: Record<string, number>; tut: boolean; meta: Partial<Meta> }

/** The current progress as a backup code. Marks "last backup" when `mark` (the player copied/shared it). */
export function backupCode(mark = false): string {
  const s = store.get();
  const { backupAt: _b, festivalAway: _f, ...m } = meta();
  void _b; void _f;
  const p: Payload = { v: 1, at: Date.now(), level: s.level, coins: s.coins, stars: s.stars ?? {}, tut: !!s.tutorialDone, meta: m };
  const body = b64(utf8(JSON.stringify(p)));
  if (mark) setMeta({ backupAt: Date.now() });
  return `MB1-${body}-${fnv(body)}`;
}

export type Parsed = { ok: true; level: number; stars: number; coins: number; at: number; apply: () => void } | { ok: false; error: string };

/** Validates a pasted code; `apply()` replaces the progress on this phone with it. */
export function parseBackup(raw: string): Parsed {
  const code = raw.replace(/\s+/g, "");
  if (!code) return { ok: false, error: "Paste your backup code first." };
  const m = code.match(/^MB1-([A-Za-z0-9+/=]+)-([0-9a-f]{8})$/);
  if (!m) return { ok: false, error: "That doesn't look like a Merge Bazaar backup code (it starts with MB1-)." };
  if (fnv(m[1]) !== m[2]) return { ok: false, error: "This code is incomplete or mistyped — copy the whole code and try again." };
  let p: Payload;
  try {
    const bytes = unb64(m[1]);
    if (!bytes) throw new Error("b64");
    p = JSON.parse(fromUtf8(bytes)) as Payload;
  } catch {
    return { ok: false, error: "This code can't be read — copy the whole code and try again." };
  }
  if (p.v !== 1 || typeof p.level !== "number" || typeof p.coins !== "number" || typeof p.stars !== "object" || !p.meta) {
    return { ok: false, error: "This code can't be read — copy the whole code and try again." };
  }
  const level = Math.max(1, Math.min(LEVELS.length + 1, Math.floor(p.level)));
  const stars: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.stars)) if (Number(k) >= 1 && Number(k) <= LEVELS.length) stars[k] = Math.max(0, Math.min(3, Math.floor(Number(v) || 0)));
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  return {
    ok: true,
    level,
    stars: total,
    coins: Math.max(0, Math.floor(p.coins)),
    at: p.at,
    apply: () => {
      const patch: Partial<PlayerState> = { level, coins: Math.max(0, Math.floor(p.coins)), stars, tutorialDone: !!p.tut, meta: { ...meta(), ...p.meta, backupAt: meta().backupAt, festivalAway: null } as Meta };
      store.set(patch);
      analytics.track("progress_restored", { level, stars: starsEarned() });
    },
  };
}

export function lastBackupText(): string {
  const at = meta().backupAt;
  if (!at) return "Last backup: not yet — copy or share your code to keep it safe.";
  const d = new Date(at);
  const days = Math.floor((Date.now() - at) / 86400000);
  const when = days <= 0 ? `today, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` : days === 1 ? "yesterday" : `${days} days ago`;
  return `Last backup: ${when}`;
}
