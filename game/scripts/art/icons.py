"""UI glyphs (cream, brown outline) for the round brass buttons: assets/art/ui/<name>.png. Run after items.py."""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from kit import *  # noqa

OUTDIR = os.path.join(ART, "ui")
CREAM, CREAM_D, INK = "#FFF6E0", "#F0C98A", "#4A2410"
made = {}


def glyph(name, m, extra=None):
    img = canvas()
    flat(img, m.filter(ImageFilter.GaussianBlur(4)).point(lambda v: v), INK, 120)  # soft drop
    sh = Image.new("L", (N, N), 0)
    sh.paste(m, (0, int(N * 0.025)))
    flat(img, sh, INK, 200)
    paint(img, m, CREAM, CREAM_D, outline=INK, ow=0.03, shine=False)
    if extra:
        extra(img)
    made[name] = img
    finish(img, os.path.join(OUTDIR, f"{name}.png"), 128)


def ring(cx, cy, r, w):
    return minus(ell(cx, cy, r, r), ell(cx, cy, r - w, r - w))


def arc_line(cx, cy, r, a0, a1, w, n=40):
    pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    return line(pts, w)


def build():
    # map: folded map with a pin
    m = poly([(0.12, 0.3), (0.36, 0.22), (0.62, 0.3), (0.88, 0.22), (0.88, 0.78), (0.62, 0.86), (0.36, 0.78), (0.12, 0.86)])
    glyph("map", m, lambda i: (flat(i, line([(0.36, 0.24), (0.36, 0.78)], 0.02), INK, 160), flat(i, line([(0.62, 0.32), (0.62, 0.84)], 0.02), INK, 160),
                               paint(i, union(ell(0.62, 0.36, 0.13, 0.13), poly([(0.52, 0.42), (0.72, 0.42), (0.62, 0.62)])), "#E5372B", "#7A1410", outline=INK, ow=0.025, shine=False),
                               flat(i, ell(0.62, 0.36, 0.05, 0.05), CREAM)))
    # shop: stall with striped awning
    aw = union(poly([(0.12, 0.2), (0.88, 0.2), (0.92, 0.42), (0.08, 0.42)]), *[ell(0.17 + k * 0.165, 0.42, 0.085, 0.07) for k in range(5)])
    glyph("shop", union(aw, rrect(0.18, 0.44, 0.82, 0.86, 0.04)), lambda i: (
        [flat(i, inter(poly([(0.12 + k * 0.33, 0.2), (0.28 + k * 0.33, 0.2), (0.27 + k * 0.33, 0.5), (0.1 + k * 0.33, 0.5)]), aw), "#E5372B") for k in range(3)],
        flat(i, rrect(0.42, 0.58, 0.58, 0.86, 0.02), INK, 200)))
    # gear
    teeth = union(*[poly([(0.5 + 0.2 * math.cos(a - 0.22), 0.5 + 0.2 * math.sin(a - 0.22)), (0.5 + 0.4 * math.cos(a - 0.14), 0.5 + 0.4 * math.sin(a - 0.14)),
                          (0.5 + 0.4 * math.cos(a + 0.14), 0.5 + 0.4 * math.sin(a + 0.14)), (0.5 + 0.2 * math.cos(a + 0.22), 0.5 + 0.2 * math.sin(a + 0.22))])
                    for a in [k * math.pi / 4 for k in range(8)]])
    glyph("gear", minus(union(teeth, ell(0.5, 0.5, 0.3, 0.3)), ell(0.5, 0.5, 0.12, 0.12)))
    # undo: curved arrow
    glyph("undo", union(arc_line(0.52, 0.56, 0.24, 200, 400, 0.11), poly([(0.12, 0.44), (0.38, 0.3), (0.34, 0.6)])))
    # sort: three bars of decreasing length + arrow
    glyph("sort", union(rrect(0.14, 0.2, 0.62, 0.32, 0.05), rrect(0.14, 0.44, 0.52, 0.56, 0.05), rrect(0.14, 0.68, 0.42, 0.8, 0.05),
                        rrect(0.71, 0.2, 0.81, 0.64, 0.04), poly([(0.6, 0.6), (0.92, 0.6), (0.76, 0.84)])))
    # bag: satchel
    glyph("bag", union(rrect(0.14, 0.34, 0.86, 0.84, 0.1), arc_line(0.5, 0.36, 0.2, 180, 360, 0.07)),
          lambda i: (flat(i, rrect(0.14, 0.34, 0.86, 0.56, 0.1), "#C98A4A"), flat(i, rrect(0.44, 0.5, 0.56, 0.62, 0.02), "#F2C14E")))
    # hint: lightbulb
    glyph("hint", union(ell(0.5, 0.42, 0.26, 0.26), rrect(0.38, 0.56, 0.62, 0.8, 0.04)),
          lambda i: (flat(i, ell(0.5, 0.42, 0.2, 0.2), "#FFE04A"), flat(i, rrect(0.38, 0.66, 0.62, 0.69, 0.0), INK, 160), flat(i, rrect(0.38, 0.74, 0.62, 0.77, 0.0), INK, 160)))
    # home
    glyph("home", union(poly([(0.5, 0.12), (0.9, 0.48), (0.78, 0.48), (0.78, 0.86), (0.22, 0.86), (0.22, 0.48), (0.1, 0.48)])),
          lambda i: flat(i, rrect(0.42, 0.6, 0.58, 0.86, 0.04), INK, 200))
    glyph("back", poly([(0.66, 0.12), (0.78, 0.24), (0.52, 0.5), (0.78, 0.76), (0.66, 0.88), (0.28, 0.5)]))
    glyph("close", union(line([(0.24, 0.24), (0.76, 0.76)], 0.16), line([(0.76, 0.24), (0.24, 0.76)], 0.16)))
    # book (heirloom collection)
    glyph("book", union(poly([(0.1, 0.24), (0.5, 0.3), (0.9, 0.24), (0.9, 0.8), (0.5, 0.86), (0.1, 0.8)])),
          lambda i: (flat(i, line([(0.5, 0.3), (0.5, 0.86)], 0.025), INK), flat(i, poly(star_pts(0.3, 0.52, 0.1, 0.045)), "#F2A31B"),
                     flat(i, poly(star_pts(0.7, 0.52, 0.1, 0.045)), "#C2255C")))
    # gift
    glyph("gift", union(rrect(0.16, 0.42, 0.84, 0.86, 0.04), rrect(0.1, 0.3, 0.9, 0.44, 0.04), ell(0.38, 0.22, 0.12, 0.08), ell(0.62, 0.22, 0.12, 0.08)),
          lambda i: (flat(i, rrect(0.44, 0.3, 0.56, 0.86, 0.0), "#E5372B"), flat(i, rrect(0.16, 0.5, 0.84, 0.56, 0.0), "#E5372B")))
    # scroll (story)
    glyph("story", union(rrect(0.2, 0.18, 0.8, 0.82, 0.04), ell(0.2, 0.5, 0.08, 0.34), ell(0.8, 0.5, 0.08, 0.34)),
          lambda i: [flat(i, rrect(0.32, 0.3 + k * 0.13, 0.68, 0.34 + k * 0.13, 0.02), INK, 170) for k in range(4)])
    glyph("lock", union(rrect(0.2, 0.44, 0.8, 0.88, 0.06), arc_line(0.5, 0.44, 0.2, 180, 360, 0.09)), lambda i: flat(i, ell(0.5, 0.64, 0.06, 0.06), INK))
    glyph("check", line([(0.18, 0.52), (0.42, 0.76), (0.84, 0.26)], 0.16, joint="curve"))
    # share: three nodes
    glyph("share", union(line([(0.28, 0.5), (0.72, 0.24)], 0.07), line([(0.28, 0.5), (0.72, 0.76)], 0.07), ell(0.28, 0.5, 0.13, 0.13), ell(0.72, 0.24, 0.13, 0.13), ell(0.72, 0.76, 0.13, 0.13)))
    glyph("play", poly([(0.3, 0.16), (0.84, 0.5), (0.3, 0.84)]))
    # sell: a clay jar with a coin slot
    glyph("sell", union(ell(0.5, 0.58, 0.32, 0.28), rrect(0.32, 0.18, 0.68, 0.34, 0.04)),
          lambda i: (flat(i, rrect(0.4, 0.4, 0.6, 0.45, 0.02), INK), paint(i, ell(0.5, 0.65, 0.12, 0.12), "#F2C14E", "#8A5A12", outline=INK, ow=0.02, shine=False)))
    # stuck helper: a question mark in a speech bubble
    glyph("help", union(ell(0.5, 0.46, 0.38, 0.32), poly([(0.3, 0.7), (0.24, 0.9), (0.46, 0.76)])),
          lambda i: (flat(i, arc_line(0.5, 0.38, 0.1, 180, 400, 0.06), INK), flat(i, line([(0.5, 0.48), (0.5, 0.54)], 0.06), INK), flat(i, ell(0.5, 0.64, 0.035, 0.035), INK)))
    # restore (home decor): a lamp on a little table
    glyph("decor", union(poly([(0.3, 0.16), (0.7, 0.16), (0.8, 0.42), (0.2, 0.42)]), rrect(0.46, 0.42, 0.54, 0.72, 0.01), rrect(0.26, 0.72, 0.74, 0.84, 0.04)),
          lambda i: flat(i, poly([(0.3, 0.16), (0.7, 0.16), (0.8, 0.42), (0.2, 0.42)]), "#F6A81C"))

    names = sorted(made)
    sheet = Image.new("RGBA", (len(names) * 110, 120), (122, 62, 42, 255))
    for k, n in enumerate(names):
        sheet.alpha_composite(made[n].resize((100, 100), Image.LANCZOS), (k * 110 + 5, 5))
    sheet.save("/tmp/mb_icons.png")
    print(len(names), "icons")


if __name__ == "__main__":
    build()
