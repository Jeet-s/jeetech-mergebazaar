import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { RestoreScreen } from "./screens/RestoreScreen";
import { StoryScene } from "./ui/StoryScene";
import { SettingsPopup } from "./ui/SettingsPopup";
import { ShopScreen } from "./screens/ShopScreen";
import { DailyGiftPopup, HeirloomPopup } from "./screens/MetaPopups";
import { FestivalPopup, SaveProgressPopup, SupportPopup } from "./screens/ExtrasPopups";
import { LEVELS } from "./game/levels";
import { STORY, TASKS, meta as getMeta, setMeta, syncFestival, type Meta } from "./game/meta";
import { store } from "./modules/store";

/**
 * Screenshot mode: the factory opens the app with <scheme>://shot/<id> on an emulator and captures the screen for
 * the store listing. Every scene renders the REAL screens in a real state: a player part-way through the festival
 * (stars, Lamps, restored decor, heirlooms), a board mid-solve right after a Big Merge, the win popup, the map.
 */
const noop = () => {};

function progress(level: number, restored: string[]) {
  const stars: Record<string, number> = {};
  LEVELS.slice(0, level - 1).forEach((l, i) => (stars[l.id] = i % 5 === 3 ? 2 : 3));
  const rooms: Record<string, number> = {};
  restored.forEach((id, i) => (rooms[id] = i % 3));
  const spent = TASKS.filter((t) => rooms[t.id] !== undefined).reduce((a, t) => a + t.cost, 0);
  const meta: Meta = {
    boosters: { fireworks: 2, needle: 1, sweep: 1 },
    starsSpent: spent,
    rooms,
    heirlooms: ["spoon", "claydiya", "stencil", "toranlamp", "grand", "brasskey", "spool", "shuttle"],
    setsPaid: ["Dadi's Brass"],
    giftDays: 9,
    storySeen: STORY.filter((b) => b.level <= level).map((b) => b.id),
    daily: { day: 3, last: "" },
    fails: {},
    settings: { reduceMotion: false, hints: false, leftHanded: false, reminders: false },
  };
  store.set({ level, coins: 1840, stars, tutorialDone: true, meta });
}

export function ScreenshotScene({ id }: { id: string }) {
  useState(() => {
    if (id === "fresh") store.set({ level: 1, coins: 0, stars: {}, meta: undefined });
    else if (id === "home" || id.startsWith("ui-")) progress(12, ["1-door", "1-toran", "1-rangoli", "1-sweets"]);
    else if (id === "restore") progress(12, ["1-door", "1-toran", "1-rangoli", "1-sweets", "1-window"]);
    else progress(40, TASKS.filter((t) => t.chapter <= 2).map((t) => t.id).concat(["3-stall", "3-lantern"]));
    if (id === "ui-festival") {
      syncFestival();
      setMeta({ festival: { ...getMeta().festival!, base: { level: 5, stars: 10, bazaar: 0 }, free: [0] } });
    }
    return true;
  });
  // Extra scenes (not store screenshots): each meta screen open over Home, for visual checks.
  const home = <HomeScreen onPlay={noop} onLevels={noop} onShop={noop} onSettings={noop} />;
  switch (id) {
    case "fresh":
      return home;
    case "ui-settings":
      return <>{home}<SettingsPopup visible onClose={noop} /></>;
    case "ui-shop":
      return <>{home}<ShopScreen visible onClose={noop} /></>;
    case "ui-heirlooms":
      return <>{home}<HeirloomPopup visible onClose={noop} /></>;
    case "ui-heirset":
      return <>{home}<HeirloomPopup visible onClose={noop} initialSet="Dadi's Brass" /></>;
    case "ui-heirset2":
      return <>{home}<HeirloomPopup visible onClose={noop} initialSet="Meera's Loom" /></>;
    case "ui-festival":
      return <>{home}<FestivalPopup visible onClose={noop} /></>;
    case "ui-save":
      return <>{home}<SaveProgressPopup visible onClose={noop} /></>;
    case "ui-support":
      return <>{home}<SupportPopup visible onClose={noop} onSaveProgress={noop} /></>;
    case "ui-gift":
      return <>{home}<DailyGiftPopup visible onClose={noop} onBazaarDay={noop} /></>;
    case "home":
      return <HomeScreen onPlay={noop} onLevels={noop} onShop={noop} onSettings={noop} />;
    case "merge":
      return <GameScreen levelNumber={39} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ moves: 6, burst: true }} />;
    case "finale":
      return <GameScreen levelNumber={64} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ moves: 10, select: true }} />;
    case "story":
      return (
        <>
          <GameScreen levelNumber={14} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ moves: 0 }} />
          <StoryScene beat={STORY.find((b) => b.id === "meera") ?? null} scene="bg_home_room" onDone={noop} />
        </>
      );
    case "restore":
      return <RestoreScreen onBack={noop} onPlay={noop} />;
    case "win":
      return <GameScreen levelNumber={26} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ moves: 15, win: true }} />;
    case "map":
    default:
      return <LevelsScreen onPlay={noop} onBack={noop} />;
  }
}
