import { useEffect, useLayoutEffect, useState } from "react";
import { BackHandler, Linking, Platform, Settings, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { RestoreScreen } from "./screens/RestoreScreen";
import { DailyGiftPopup, HeirloomPopup, StoryBookPopup } from "./screens/MetaPopups";
import { FestivalPopup, SaveProgressPopup, SupportPopup } from "./screens/ExtrasPopups";
import { SettingsPopup, initAudio } from "./ui";
import { notify } from "./modules/notify";
import { currentLevel, noteBazaarDayWin, syncFestival, syncHeirlooms } from "./game/meta";
import { dailyDone, dailyKey } from "./game/daily";
import { analytics } from "./modules/analytics";
import { layout } from "./modules/layout";
import { ads } from "./modules/ads";
import { iap } from "./modules/iap";
import { store } from "./modules/store";
import { ScreenshotScene } from "./screenshots";
import { qa } from "./modules/qa";

// Screenshot mode: <scheme>://shot/<id> on Android; on iOS the factory passes the scene as the launch argument
// -AGFShot <id> (iOS 27 asks "Open in …?" for deep links, which would end up in the store screenshots).
const initialShotUrl = (): Promise<string | null | undefined> => {
  const id = Platform.OS === "ios" ? (Settings.get("AGFShot") as string | undefined) : undefined;
  return id ? Promise.resolve(`agf://shot/${id}`) : Linking.getInitialURL();
};

SplashScreen.preventAutoHideAsync().catch(() => {});
// Hide the launch splash with a hard cut, not the default 400 ms fade: the fading splash logo (concentric rings on
// white) drew a blurry translucent "ripple blob" over Home's doorway in the first frames (QA 2026-10-30).
try {
  SplashScreen.setOptions({ duration: 0, fade: false });
} catch {
  // older native module: keeps its default
}

/**
 * Root of the premium runtime. Boot order matters: fonts → player state →
 * audio → consent + ads → billing. The builder adds screens/flows but keeps
 * this shell: providers, fonts, the banner slot and screenshot mode.
 */
export default function App() {
  const [fontsLoaded] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold, Nunito_600SemiBold, Nunito_700Bold });
  // Screenshot mode (<scheme>://shot/<id>): render a store-screenshot scene
  // without ads or billing. undefined = still checking the launch URL.
  const [shot, setShot] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    initialShotUrl()
      .then((u) => {
        // QA level replay (<scheme>://qa/level/<n>, src/modules/qa.ts): straight into level n.
        const lv = Number(u?.match(/qa\/level\/(\d+)/)?.[1] ?? NaN);
        if (Number.isFinite(lv) && lv > 0) qa.level = lv;
        setShot(u?.match(/shot\/([\w-]+)/)?.[1] ?? null);
      })
      .catch(() => setShot(null));
  }, []);
  const ready = fontsLoaded && shot !== undefined;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return <View style={styles.root} />;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {shot ? <ScreenshotScene id={shot} /> : <Game />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Game() {
  const insets = useSafeAreaInsets();
  const [booted, setBooted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [screen, setScreen] = useState<{ name: "home" } | { name: "levels" } | { name: "restore" } | { name: "daily" } | { name: "game"; level: number }>(
    qa.level ? { name: "game", level: qa.level } : { name: "home" },
  );
  const [shopOpen, setShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popup, setPopup] = useState<"gift" | "heirlooms" | "story" | "festival" | "save" | "support" | null>(null);
  // Bazaar Day: daily.ts owns the board + "done today"; meta counts the wins (heirlooms, festival points).
  const [bazaarDone, setBazaarDone] = useState(false);
  const syncMeta = () => {
    try {
      const done = dailyDone();
      if (done) noteBazaarDayWin(dailyKey());
      setBazaarDone(done);
    } catch {
      setBazaarDone(false);
    }
    syncFestival();
    syncHeirlooms();
  };
  useEffect(() => {
    if (booted && screen.name === "home") syncMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, screen.name]);

  useEffect(() => {
    (async () => {
      await store.load();
      syncFestival(); // start this week's festival before any win so it counts
      analytics.track("app_open");
      setBooted(true);
      if (!qa.level) {
        // Scheduled locally; shows only if the player opted in to notifications (asked on the daily gift / in settings).
        void notify.comeback({ days: 2, title: "Your streak is waiting", body: "Dadi's courtyard has new lamps to light — new levels unlocked." });
      }
      await initAudio();
      if (qa.level) return; // QA replay: no ads, no billing — nothing may cover the board
      await ads.init();
      setShowBanner(ads.canShowBanner());
      await iap.init();
    })();
    return store.subscribe(() => setShowBanner(ads.canShowBanner()));
  }, []);
  useEffect(() => {
    if (!showBanner) layout.setBannerHeight(0);
  }, [showBanner]);
  // Android Back on the map / restore screens returns Home; a board (game / Bazaar Day) handles Back itself (it
  // settles boosters first); only Back on Home leaves the app, as Android players expect.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen.name === "levels" || screen.name === "restore") {
        setScreen({ name: "home" });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen.name]);

  if (!booted) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <ScreenFade id={screen.name === "game" ? `game-${screen.level}` : screen.name}>
        {screen.name === "home" ? (
          <HomeScreen
            onPlay={(level) => setScreen({ name: "game", level })}
            onLevels={() => setScreen({ name: "levels" })}
            onShop={() => setShopOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            onRestore={() => setScreen({ name: "restore" })}
            onGift={() => setPopup("gift")}
            onStory={() => setPopup("story")}
            onHeirlooms={() => setPopup("heirlooms")}
            onBazaarDay={() => setScreen({ name: "daily" })}
            onFestival={() => setPopup("festival")}
            onSaveProgress={() => setPopup("save")}
            bazaarDone={bazaarDone}
          />
        ) : screen.name === "restore" ? (
          <RestoreScreen onBack={() => setScreen({ name: "home" })} onPlay={() => setScreen({ name: "game", level: currentLevel() })} />
        ) : screen.name === "daily" ? (
          <GameScreen
            key="daily"
            daily
            levelNumber={currentLevel()}
            onExit={() => setScreen({ name: "home" })}
            onSettings={() => setSettingsOpen(true)}
            onNextLevel={() => setScreen({ name: "home" })}
          />
        ) : screen.name === "levels" ? (
          <LevelsScreen onPlay={(level) => setScreen({ name: "game", level })} onBack={() => setScreen({ name: "home" })} />
        ) : (
          <GameScreen
            key={screen.level}
            levelNumber={screen.level}
            onExit={() => setScreen({ name: "home" })}
            onSettings={() => setSettingsOpen(true)}
            onNextLevel={(level) => setScreen({ name: "game", level })}
          />
        )}
      </ScreenFade>
      <ShopScreen visible={shopOpen} onClose={() => setShopOpen(false)} />
      <SettingsPopup
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaveProgress={() => {
          setSettingsOpen(false);
          setPopup("save");
        }}
        onSupport={() => {
          setSettingsOpen(false);
          setPopup("support");
        }}
      />
      <DailyGiftPopup
        visible={popup === "gift"}
        onClose={() => setPopup(null)}
        bazaarDone={bazaarDone}
        onBazaarDay={
          screen.name === "home"
            ? () => {
                setPopup(null);
                if (!bazaarDone) setScreen({ name: "daily" });
              }
            : undefined
        }
      />
      <FestivalPopup visible={popup === "festival"} onClose={() => setPopup(null)} />
      <SaveProgressPopup visible={popup === "save"} onClose={() => setPopup(null)} />
      <SupportPopup visible={popup === "support"} onClose={() => setPopup(null)} onSaveProgress={() => setPopup("save")} />
      <HeirloomPopup visible={popup === "heirlooms"} onClose={() => setPopup(null)} />
      <StoryBookPopup visible={popup === "story"} onClose={() => setPopup(null)} />
      {showBanner && (
        // The banner sits ABOVE the gesture pill / home indicator; its measured height includes that inset, so
        // useBottomInset() clears both.
        <View style={[styles.banner, { paddingBottom: insets.bottom }]} onLayout={(e) => layout.setBannerHeight(e.nativeEvent.layout.height)}>
          <BannerAd unitId={ads.bannerUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      )}
    </View>
  );
}

/**
 * Screen change: the new screen eases in from 35 % opacity — a stable container, never a keyed `entering` /
 * `exiting` layout animation (sticks blank on Android, skews QA measureInWindow) and never a fade from 0.
 */
function ScreenFade({ id, children }: { id: string; children: React.ReactNode }) {
  const o = useSharedValue(1);
  const [first] = useState(() => ({ id }));
  useLayoutEffect(() => {
    if (first.id === id) return; // the launch screen just appears
    first.id = "";
    o.value = 0.35;
    o.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [id, o, first]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.root, st]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#120C33" },
  banner: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
});
