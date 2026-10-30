/**
 * Design tokens. Every screen uses these — never raw colours, sizes or system
 * fonts. The builder re-skins a game by editing `palette` (from the art bible),
 * not by hard-coding styles in components.
 */
export const palette = {
  // Brand (docs/ART_DIRECTION.md UI kit tokens)
  primary: "#F6A81C", // marigold plate
  primaryDark: "#C26E0A",
  secondary: "#2B2F77", // indigo
  secondaryDark: "#1A1C4D",
  accent: "#1F9E8F", // teal
  accentDark: "#136B61",
  danger: "#D8433B",
  dangerDark: "#8E1E18",
  brass: "#D9A441",
  brassDark: "#7A4A12",
  // Surfaces
  bgTop: "#3A3F96",
  bgBottom: "#F2A65A",
  surface: "#FFF1D6", // cream parchment
  surfaceAlt: "#F6E2BC",
  surfaceDark: "#2B2F77",
  ink: "#3A1F14",
  inkSoft: "#7A5240",
  onPrimary: "#4A2205",
  cream: "#FFF6E0",
  // Game feedback
  star: "#FFC93A",
  coin: "#F6A81C",
  success: "#3E8E41",
};

export const fonts = {
  display: "Fredoka_700Bold",
  displayMedium: "Fredoka_600SemiBold",
  body: "Nunito_700Bold",
  bodyRegular: "Nunito_600SemiBold",
};

export const radius = { sm: 12, md: 18, lg: 26, xl: 36, pill: 999 };
export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 };

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, letterSpacing: 0.5 },
  title: { fontFamily: fonts.display, fontSize: 30 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 22 },
  body: { fontFamily: fonts.body, fontSize: 16 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13 },
  button: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.6 },
};

/** Soft drop shadow used on cards and buttons (iOS + Android). */
export const shadow = {
  shadowColor: "#1A0A04",
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

/** Spring presets — use these so every animation in the game feels consistent. */
export const springs = {
  press: { damping: 14, stiffness: 320, mass: 0.6 },
  pop: { damping: 9, stiffness: 220, mass: 0.7 },
  gentle: { damping: 18, stiffness: 140, mass: 1 },
};

/** Display text with a dark outline + drop shadow (titles, numbers on art). */
export const outlined = (color = "#3A1F14", r = 3) => ({
  textShadowColor: color,
  textShadowRadius: r,
  textShadowOffset: { width: 0, height: 2 },
});
