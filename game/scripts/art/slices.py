"""9-slice the frame/panel/button art (assets/art/nine/<name>_<part>.png) so frames keep their border thickness at
any size (src/ui/NineSlice.tsx). Run: python3 scripts/art/slices.py"""
import os
from PIL import Image
ART = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "art")
SPEC = {"board_frame": 72, "hud_panel": 64, "btn_primary": 120, "btn_secondary": 120, "tile_cell": 110}
os.makedirs(os.path.join(ART, "nine"), exist_ok=True)
for name, k in SPEC.items():
    im = Image.open(os.path.join(ART, name + ".png")).convert("RGBA")
    w, h = im.size
    xs, ys = [0, k, w - k, w], [0, k, h - k, h]
    parts = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"]
    for r in range(3):
        for c in range(3):
            box = (xs[c], ys[r], xs[c + 1], ys[r + 1])
            p = im.crop(box)
            # stretched parts only need a few px along the stretch axis
            if c == 1: p = p.resize((min(p.size[0], 64), p.size[1]), Image.LANCZOS)
            if r == 1: p = p.resize((p.size[0], min(p.size[1], 64)), Image.LANCZOS)
            p.save(os.path.join(ART, "nine", f"{name}_{parts[r*3+c]}.png"), optimize=True)
    print(name, w, h, k)

# board_frame edges carry a row of brass studs: export one repeat unit per edge (NineSlice tiles it, never stretches)
im = Image.open(os.path.join(ART, "board_frame.png")).convert("RGBA")
w, h = im.size
k = SPEC["board_frame"]
im.crop((150, 0, 222, k)).save(os.path.join(ART, "nine", "board_frame_t.png"))
im.crop((150, h - k, 222, h)).save(os.path.join(ART, "nine", "board_frame_b.png"))
im.crop((0, 156, k, 234)).save(os.path.join(ART, "nine", "board_frame_l.png"))
im.crop((w - k, 156, w, 234)).save(os.path.join(ART, "nine", "board_frame_r.png"))
