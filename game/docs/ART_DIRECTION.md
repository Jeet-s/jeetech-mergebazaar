# Art direction — Merge Bazaar: Festival Homes

Target: .agf/art/target.png (vs big-studio games Royal Match +2, Monument Valley -1, Homescapes +2 → net +1 (need ≥ 0)). Every screen must look like it.

## Style
Painterly-3D hybrid in the style of premium cozy mobile games. Chunky, softly bevelled forms are rendered with gouache-like colour and a hand-painted look, not photoreal. Light is a warm marigold key from the upper left, with a cool indigo-teal bounce in the shadows. Glowing diyas and string lamps act as practical lights. Materials read clearly: polished brass with a creamy specular streak, matte block-printed cotton, glossy silk with a soft sheen, translucent glass, warm terracotta, and sugar-glazed sweets. Edges are rounded and smooth, with a thin darker-hue outline inside each shape rather than black. Shading uses three soft tones with a subtle rim light and a gentle ambient-occlusion contact shadow under each object. Depth comes from layered backgrounds with atmospheric haze and bokeh lamps, and from raised, inset UI plates. The mood is unhurried, nostalgic, warm and festive, with high saturation balanced by creamy neutrals. Every merge tier is distinguished by silhouette and a pattern motif (dot, stripe, leaf, star) as well as colour, so it stays readable for colour-blind players. Nothing is flashing or harsh, and the overall feel is ASMR-soft. The goal is to match the polish of Royal Match and Homescapes, and the calm composition of Monument Valley.

## Palette
#F6A81C #2B2F77 #D8433B #1F9E8F #FFF1D6 #7A3E2A

UI kit tokens (src/ui/theme.ts): {"primary":"#F6A81C","primaryDark":"#C26E0A","secondary":"#2B2F77","secondaryDark":"#1A1C4D","accent":"#1F9E8F","accentDark":"#136B61","bgTop":"#3A3F96","bgBottom":"#F2A65A","ink":"#3A1F14"}

## Screen spec
- **background**: Blurred painterly dusk courtyard of Dadi's home behind the board. Indigo sky at the top fades to a marigold glow at the bottom, with soft bokeh string lamps, a hint of an arched doorway and rangoli at the edges. A low-contrast vignette keeps focus on the board.
- **board**: A 7x9 grid set in a carved teak-and-brass frame, with a slightly inset cream-linen cell field. Cells are alternating warm ivory and sand squares with rounded corners and a soft inner shadow. Locked tiles show tangled thread, and trunks are shown as brass-bound chests. The frame has a subtle block-print border and a lamp-glow rim light.
- **pieces**: Each piece is a single chunky, glossy-matte object with a soft contact shadow and a rim highlight, sitting on a small round tier-coloured base disc. Each tier has a distinct shape and pattern badge (dot, stripe, leaf, star) for colour-blind safety. Chains include cloth, dye, sari, ghee, flour, sugar, sweets, diyas, spice tins and brass pots. Generators have a gentle glow, selected items have a bright marigold ring, and valid targets pulse softly.
- **hud**: The top bar is a rounded indigo-and-brass plate holding a level badge, a Spark energy bar with a lamp icon, Lamps and star counters in cream capsule pills, and a settings gear. The order tray is a cream parchment strip with three order cards, each showing the item icon and a progress tick. The bottom bar holds the 12-slot Bag, Sort, Undo and the booster tray (Fireworks, Needle, Sweep) as round brass buttons with icons.
- **buttons**: The primary button is a chunky marigold plate with a lighter top highlight, a dark amber bottom lip and a soft drop shadow. The secondary button is indigo with a brass trim. Both have a rounded 16px radius and a visible pressed state that moves down 3px. Round icon buttons are brass discs with an inset icon.
- **typography**: A rounded, friendly display sans with a slightly humanist feel for titles and numbers, in cream fill with a deep indigo or brown outline and a soft drop shadow. Body text is a clean, highly legible rounded sans in dark ink on cream. Numbers are bold and tabular. The Indic script fallback matches the weight.
- **popups**: Cream parchment cards with a block-print border and a brass-edged header ribbon in indigo. A soft dim backdrop with blur sits behind them. The close button is a round brass disc, and the primary action is a marigold plate with a quiet 'No thanks' text link. Layout is uncluttered, with one offer at a time.
- **fx**: Soft brass clinks with small gold sparkle bursts and petal confetti on a merge. A Big Merge has a gentle radial glow and a floating marigold ring. Warm, low-intensity glows are used throughout, with no strobing or flashing. Order completion shows a brief star shimmer. Everything is dampened when Reduce Motion is on.
- **motion**: Eased, soft-spring animation at 200-350ms. Pieces lift and scale 1.08 on drag with a shadow that deepens, then settle with a small squash. Merges pull items together smoothly into a pop of the result. Generators breathe slowly. UI panels slide and fade. Reduce Motion swaps everything for simple fades.

## Assets (assets/art, indexed in src/art.ts)
- `bg_courtyard_dusk` (background, 1080x1920): Gameplay and splash background
- `bg_home_room` (background, 1080x1920): Home restoration view
- `bg_bazaar_street` (background, 1080x1920): Level select and chapter map
- `board_frame` (ui, 435x512): Board frame around the 7x9 grid
- `tile_cell` (ui, 512x512): Board cell tile
- `piece_cloth_sari` (sprite, 512x357): Cloth chain pieces (cloth to sari)
- `piece_sweets_box` (sprite, 512x430): Sweets chain piece
- `piece_diya_brass` (sprite, 497x512): Diya chain piece
- `piece_spice_tin` (sprite, 447x512): Spice chain piece
- `generator_hearth` (sprite, 506x512): Free cooldown generator
- `blocker_thread_trunk` (sprite, 512x480): Blockers: tangled thread and trunk
- `hud_panel` (ui, 512x355): Top HUD and order tray panel
- `btn_primary` (ui, 512x488): Primary button plate
- `btn_secondary` (ui, 512x480): Secondary button plate
- `icon_lamp_star` (ui, 512x254): Reward icons for Lamps and Marigold stars
- `fx_sparkle_glow` (fx, 474x512): Merge sparkle and glow
- `logo` (ui, 900x391): the game logo — title/home screen and anywhere the name appears
