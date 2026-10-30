/** Game art (assets/art/manifest.json: kind/usage/size; "legacy" ids are the previous art). Use with expo Image or Skia useImage. */
export const art = {
  bg_courtyard_dusk: require("../assets/art/bg_courtyard_dusk.png"),
  bg_home_room: require("../assets/art/bg_home_room.png"),
  bg_bazaar_street: require("../assets/art/bg_bazaar_street.png"),
  board_frame: require("../assets/art/board_frame.png"),
  tile_cell: require("../assets/art/tile_cell.png"),
  piece_cloth_sari: require("../assets/art/piece_cloth_sari.png"),
  piece_sweets_box: require("../assets/art/piece_sweets_box.png"),
  piece_diya_brass: require("../assets/art/piece_diya_brass.png"),
  piece_spice_tin: require("../assets/art/piece_spice_tin.png"),
  generator_hearth: require("../assets/art/generator_hearth.png"),
  blocker_thread_trunk: require("../assets/art/blocker_thread_trunk.png"),
  hud_panel: require("../assets/art/hud_panel.png"),
  btn_primary: require("../assets/art/btn_primary.png"),
  btn_secondary: require("../assets/art/btn_secondary.png"),
  icon_lamp_star: require("../assets/art/icon_lamp_star.png"),
  fx_sparkle_glow: require("../assets/art/fx_sparkle_glow.png"),
  logo: require("../assets/art/logo.png"),
} as const;
export type ArtId = keyof typeof art;
