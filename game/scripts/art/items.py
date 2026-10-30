"""Bakes every board piece into assets/art/items/<code>.png (256 px, transparent): items of every chain and tier,
crafted items, generators, blockers, boosters and currency icons. Run: python3 scripts/art/items.py
Pieces sit on a tier-coloured base disc with a tier SHAPE badge (circle, diamond, square, star, hexagon) so tiers
read without colour (colour-blind safe), as the art direction asks."""
import math
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from kit import *  # noqa

OUTDIR = os.path.join(ART, "items")
TIER = {1: "#4FA35A", 2: "#3A6FC2", 3: "#8E4BB5", 4: "#D0414B", 5: "#E9A91E", 0: "#1F9E8F"}
INK = "#5A3320"
made = {}


def base(tier):
    img = canvas()
    c = TIER[tier]
    shadow(img, 0.5, 0.9, 0.4, 0.06, 120)
    paint(img, ell(0.5, 0.835, 0.4, 0.105), mix(c, (0, 0, 0), 0.25), mix(c, (0, 0, 0), 0.55), angle=90, shine=False, rim=False)
    paint(img, ell(0.5, 0.80, 0.4, 0.1), mix(c, (255, 255, 255), 0.25), c, angle=110, shine=False)
    flat(img, minus(ell(0.5, 0.80, 0.33, 0.075), ell(0.5, 0.80, 0.31, 0.065)), (255, 245, 220), 90)
    return img


def badge(img, tier):
    cx, cy, r = 0.83, 0.79, 0.105
    paint(img, ell(cx, cy, r, r), "#FFF6E0", "#E8CFA0", shine=False, outline=INK, ow=0.014)
    if tier == 1:
        m = ell(cx, cy, 0.045, 0.045)
    elif tier == 2:
        m = poly([(cx, cy - 0.06), (cx + 0.05, cy), (cx, cy + 0.06), (cx - 0.05, cy)])
    elif tier == 3:
        m = rrect(cx - 0.043, cy - 0.043, cx + 0.043, cy + 0.043, 0.008)
    elif tier == 4:
        m = poly(star_pts(cx, cy + 0.004, 0.064, 0.027))
    elif tier == 5:
        m = poly(reg_pts(cx, cy, 0.056, 6, -90))
    else:  # crafted: a little 6-petal flower
        m = union(*[ell(cx + 0.034 * math.cos(a), cy + 0.034 * math.sin(a), 0.026, 0.026) for a in [i * math.pi / 3 for i in range(6)]])
    flat(img, m, INK)
    return img


def save(code, img, tier=None):
    if tier is not None:
        badge(img, tier)
    made[code] = img
    finish(img, os.path.join(OUTDIR, f"{code}.png"))


def item(code, tier, draw):
    img = base(tier)
    draw(img)
    save(code, img, tier)
    # decor variant for the home scenes: the object alone with a soft contact shadow (no tier disc / badge)
    d = canvas()
    shadow(d, 0.5, 0.8, 0.3, 0.05, 120)
    draw(d)
    finish(d, os.path.join(ART, "decor", f"{code}.png"), 192)


# ───────── shared vector pieces ─────────

def laddu(img, cx, cy, r):
    paint(img, ell(cx, cy, r, r * 0.95), "#FFB547", "#C9601A", ow=0.008)
    rnd = random.Random(int(cx * 1000 + cy * 100))
    for _ in range(int(40 * r / 0.2)):
        a, d = rnd.random() * 6.28, rnd.random() ** 0.6 * r * 0.85
        flat(img, ell(cx + d * math.cos(a), cy + d * math.sin(a) * 0.95, r * 0.05, r * 0.05), "#FFE2A0", 170)
    flat(img, ell(cx - r * 0.1, cy - r * 0.75, r * 0.18, r * 0.09), "#6DB33F")


def marigold(img, cx, cy, r, warm=True):
    if r < 0.1:  # garland beads: one ruffled head, flat inner tones (rings at this size read as coins)
        outer, inner_c = ("#F07F14", "#FFB02E") if warm else ("#FFC21A", "#FFE066")
        petals = union(*[ell(cx + r * 0.62 * math.cos(a), cy + r * 0.62 * math.sin(a), r * 0.45, r * 0.45) for a in [i * math.pi / 5 for i in range(10)]])
        paint(img, petals, outer, mix(outer, (60, 10, 0), 0.5), ow=0.005, shine=False, tone=False, rim=False)
        flat(img, union(*[ell(cx + r * 0.3 * math.cos(a), cy + r * 0.3 * math.sin(a), r * 0.32, r * 0.32) for a in [i * math.pi / 3 for i in range(6)]]), inner_c)
        flat(img, ell(cx - r * 0.2, cy - r * 0.25, r * 0.22, r * 0.15), "#FFF4C2", 150)
        return
    cols = [("#F28C1A", "#B8500C"), ("#FFB02E", "#D9700F"), ("#FFD24A", "#E08E14")] if warm else [("#FFD84D", "#D9A013"), ("#FFE680", "#E2B019"), ("#FFF1A8", "#E6BC2E")]
    for k, (rr, (l, d)) in enumerate(zip([1.0, 0.74, 0.48], cols)):
        n = 12 - k * 2
        petals = union(*[ell(cx + r * rr * 0.62 * math.cos(a), cy + r * rr * 0.62 * math.sin(a), r * rr * 0.42, r * rr * 0.42)
                         for a in [i * 2 * math.pi / n + k * 0.3 for i in range(n)]])
        paint(img, petals, l, d, ow=0.006, shine=k == 2, tone=False)
    flat(img, ell(cx, cy, r * 0.16, r * 0.16), "#A9480B")


def leaf(cx, cy, length, width, angle):
    a = math.radians(angle)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    tip = (cx + ux * length, cy + uy * length)
    l = bezier((cx, cy), (cx + ux * length * 0.4 + px * width, cy + uy * length * 0.4 + py * width), tip)
    r = bezier(tip, (cx + ux * length * 0.4 - px * width, cy + uy * length * 0.4 - py * width), (cx, cy))
    return poly(l + r)


def brass_diya(h=0.6, cy=0.47, gold=False):
    s = sprite("piece_diya_brass")
    if gold:
        s = recolor(s, hue=4, sat=1.15, val=1.08)
    return s, h, cy


def chilli(length=0.5, color=("#E5372B", "#8E1410")):
    img = canvas()
    c = bezier((0.3, 0.3), (0.62, 0.32), (0.72, 0.62), (0.62, 0.82), 50)
    left, right = [], []
    for i, (x, y) in enumerate(c):
        j = min(len(c) - 1, i + 1)
        dx, dy = c[j][0] - c[max(0, i - 1)][0], c[j][1] - c[max(0, i - 1)][1]
        L = math.hypot(dx, dy) or 1
        w = 0.085 * (1 - i / len(c)) ** 0.8 + 0.004
        left.append((x - dy / L * w, y + dx / L * w))
        right.append((x + dy / L * w, y - dx / L * w))
    paint(img, poly(left + right[::-1]), color[0], color[1], ow=0.01)
    paint(img, union(ell(0.3, 0.3, 0.07, 0.055), line([(0.27, 0.28), (0.2, 0.17)], 0.03)), "#6DB33F", "#2E6B1E", ow=0.008, shine=False)
    return img.crop(img.getbbox())


def sack(img, body="#C9A26A", dark="#7A5530", tie="#B23A2A", top=None, cy=0.55):
    m = union(ell(0.5, cy + 0.08, 0.27, 0.22), poly([(0.3, cy - 0.12), (0.7, cy - 0.12), (0.76, cy + 0.08), (0.24, cy + 0.08)]))
    paint(img, m, body, dark, ow=0.012)
    for i in range(6):  # burlap weave
        y = cy - 0.08 + i * 0.05
        flat(img, inter(line([(0.24, y), (0.76, y + 0.01)], 0.004), m), dark, 70)
    paint(img, ell(0.5, cy - 0.13, 0.22, 0.07), mix(body, (0, 0, 0), 0.25), dark, shine=False)
    if top:
        top(img)
    paint(img, rrect(0.32, cy - 0.06, 0.68, cy - 0.02, 0.02), tie, mix(tie, (0, 0, 0), 0.5), shine=False, ow=0.008)


def clay_pot(img, cy=0.55, body="#C8643A", dark="#7A2E14"):
    paint(img, ell(0.5, cy + 0.06, 0.27, 0.2), body, dark, ow=0.012)
    paint(img, rrect(0.36, cy - 0.16, 0.64, cy - 0.06, 0.03), body, dark, ow=0.01, shine=False)
    paint(img, ell(0.5, cy - 0.16, 0.17, 0.05), mix(body, (255, 255, 255), 0.2), dark, ow=0.01, shine=False)
    flat(img, inter(line([(0.26, cy + 0.06), (0.74, cy + 0.06)], 0.018), ell(0.5, cy + 0.06, 0.27, 0.2)), "#F2D29A", 200)
    for i in range(5):
        flat(img, ell(0.32 + i * 0.09, cy + 0.06, 0.012, 0.012), "#7A2E14", 200)


def heap(img, cx, cy, rx, ry, light, dark, grains=None):
    paint(img, poly(bezier((cx - rx, cy), (cx - rx * 0.5, cy - ry * 2.2), (cx + rx * 0.5, cy - ry * 2.2), (cx + rx, cy)) + [(cx + rx, cy + ry * 0.3), (cx - rx, cy + ry * 0.3)]), light, dark, ow=0.008)
    if grains:
        rnd = random.Random(int(cx * 997 + rx * 31))
        for _ in range(30):
            x = cx + (rnd.random() - 0.5) * rx * 1.6
            y = cy - rnd.random() * ry * 1.4
            flat(img, ell(x, y, 0.009, 0.006), grains, 200)


def glass_jar(img, fill, fill_dark, lid="#C79A3A", cloth=None, level=0.55):
    body = rrect(0.3, 0.3, 0.7, 0.76, 0.08)
    paint(img, body, "#F5EBDD", "#B9A68C", ow=0.012, shine=False, tone=False)
    paint(img, inter(rrect(0.31, 0.3 + (0.46 * (1 - level)), 0.69, 0.75, 0.07), body), fill, fill_dark, outline=False, shine=False)
    flat(img, rrect(0.35, 0.36, 0.4, 0.68, 0.02), "#FFFFFF", 120)
    if cloth:
        paint(img, poly([(0.26, 0.31), (0.74, 0.31), (0.78, 0.2), (0.5, 0.15), (0.22, 0.2)]), cloth, mix(cloth, (0, 0, 0), 0.5), ow=0.01)
        paint(img, rrect(0.29, 0.29, 0.71, 0.33, 0.02), "#E8C26A", "#8A6420", shine=False, ow=0.006)
    else:
        paint(img, rrect(0.28, 0.22, 0.72, 0.32, 0.04), lid, mix(lid, (0, 0, 0), 0.5), ow=0.01)


def key(img, metal, dark, bow):
    # key laid diagonally: bow top-left, bit bottom-right
    shaft = line([(0.36, 0.36), (0.72, 0.72)], 0.065)
    teeth = union(poly([(0.6, 0.66), (0.67, 0.59), (0.76, 0.68), (0.69, 0.75)]), poly([(0.66, 0.74), (0.72, 0.68), (0.79, 0.75), (0.73, 0.81)]))
    if bow == 1:
        b = minus(ell(0.32, 0.32, 0.15, 0.15), ell(0.32, 0.32, 0.07, 0.07))
    elif bow == 2:
        b = minus(union(ell(0.32, 0.22, 0.09, 0.09), ell(0.22, 0.34, 0.09, 0.09), ell(0.36, 0.36, 0.1, 0.1)), ell(0.3, 0.31, 0.05, 0.05))
    else:
        b = minus(poly(star_pts(0.32, 0.32, 0.19, 0.11, 8, -90)), ell(0.32, 0.32, 0.06, 0.06))
    paint(img, union(shaft, teeth, b), metal, dark, ow=0.012)
    if bow == 3:
        paint(img, ell(0.32, 0.32, 0.05, 0.05), "#3FD1C2", "#0E6B63", ow=0.008)
        for t in (0.47, 0.55):
            paint(img, ell(t, t, 0.035, 0.035), "#E14C6A", "#7A1530", ow=0.006, shine=False)


def cloth_sprite(target=None, keep=0.0, sat=1.0, val=1.0):
    s = sprite("piece_cloth_sari")
    return recolor(s, target=target, keep=keep, sat=sat, val=val) if target else s


def sparkle(img, cx, cy, r, color="#FFF4C2"):
    flat(img, poly(star_pts(cx, cy, r, r * 0.22, 4, -90)), color)


def bowl(img, cx=0.5, cy=0.62, rx=0.3, ry=0.12, metal=("#F2C14E", "#8A5A12")):
    paint(img, poly(bezier((cx - rx, cy), (cx - rx, cy + ry * 2.2), (cx + rx, cy + ry * 2.2), (cx + rx, cy))), metal[0], metal[1], ow=0.012)
    paint(img, ell(cx, cy, rx, ry * 0.55), mix(metal[0], (255, 255, 255), 0.2), metal[1], shine=False, ow=0.01)


# ───────── items ─────────

def build_items():
    # Lamps
    item("L1", 1, lambda i: place(i, sprite("generator_hearth"), 0.5, 0.5, h=0.6))

    def l2(i):
        place(i, sprite("piece_diya_brass"), 0.5, 0.47, h=0.62)
    item("L2", 2, l2)

    def l3(i):
        glow(i, ell(0.5, 0.32, 0.18, 0.18), "#FFC94A", 0.05, 120)
        place(i, sprite("piece_diya_brass"), 0.5, 0.55, h=0.48)
        pts = bezier((0.12, 0.14), (0.35, 0.42), (0.65, 0.42), (0.88, 0.14), 11)
        flat(i, line(bezier((0.12, 0.14), (0.35, 0.42), (0.65, 0.42), (0.88, 0.14)), 0.012), "#3E7A2A")
        for k, (x, y) in enumerate(pts):
            if k % 3 == 1:
                paint(i, leaf(x, y + 0.02, 0.1, 0.035, 90), "#6DB33F", "#2E6B1E", ow=0.006, shine=False)
            marigold(i, x, y, 0.048, warm=k % 2 == 0)
    item("L3", 3, l3)

    def l4(i):
        cx, cy = 0.5, 0.66
        paint(i, ell(cx, cy, 0.38, 0.13), "#FFF1D6", "#E6C99A", shine=False)
        cols = ["#E14C6A", "#1F9E8F", "#F6A81C", "#2B2F77"]
        for k in range(12):
            a = k * math.pi / 6
            flat(i, ell(cx + 0.27 * math.cos(a), cy + 0.09 * math.sin(a), 0.055, 0.025), cols[k % 4])
        for k in range(8):
            a = k * math.pi / 4 + 0.2
            flat(i, ell(cx + 0.16 * math.cos(a), cy + 0.055 * math.sin(a), 0.035, 0.016), cols[(k + 1) % 4])
        glow(i, ell(0.5, 0.25, 0.16, 0.16), "#FFC94A", 0.05, 140)
        place(i, sprite("piece_diya_brass"), 0.5, 0.45, h=0.52)
    item("L4", 4, l4)

    def l5(i):
        glow(i, ell(0.5, 0.4, 0.38, 0.38), "#FFD46A", 0.06, 150)
        for k in range(10):
            a = k * math.pi / 5
            flat(i, poly([(0.5, 0.36), (0.5 + 0.44 * math.cos(a - 0.08), 0.36 + 0.44 * math.sin(a - 0.08)), (0.5 + 0.44 * math.cos(a + 0.08), 0.36 + 0.44 * math.sin(a + 0.08))]).filter(ImageFilter.GaussianBlur(6)), "#FFE9A6", 90)
        place(i, sprite("generator_hearth"), 0.2, 0.64, h=0.3)
        place(i, sprite("generator_hearth"), 0.8, 0.64, h=0.3)
        place(i, recolor(sprite("piece_diya_brass"), hue=3, sat=1.2, val=1.1), 0.5, 0.45, h=0.64)
    item("L5", 5, l5)

    # Flowers
    def f1(i):
        flat(i, line(bezier((0.5, 0.78), (0.48, 0.6), (0.52, 0.45)), 0.03), "#3E7A2A")
        paint(i, leaf(0.5, 0.66, 0.2, 0.06, 200), "#6DB33F", "#2E6B1E", ow=0.008, shine=False)
        paint(i, leaf(0.5, 0.6, 0.2, 0.06, -20), "#7CC24A", "#2E6B1E", ow=0.008, shine=False)
        paint(i, ell(0.52, 0.3, 0.12, 0.16), "#FFA126", "#C25A0C", ow=0.01)
        paint(i, poly([(0.38, 0.33), (0.66, 0.33), (0.6, 0.47), (0.44, 0.47)]), "#7CC24A", "#2E6B1E", ow=0.01, shine=False)
    item("F1", 1, f1)

    def f2(i):
        paint(i, leaf(0.5, 0.62, 0.28, 0.08, 160), "#6DB33F", "#2E6B1E", ow=0.008, shine=False)
        paint(i, leaf(0.5, 0.62, 0.28, 0.08, 20), "#7CC24A", "#2E6B1E", ow=0.008, shine=False)
        marigold(i, 0.5, 0.43, 0.27)
    item("F2", 2, f2)

    def f3(i):
        pts = bezier((0.16, 0.14), (0.14, 0.8), (0.86, 0.8), (0.84, 0.14), 13)
        flat(i, line(bezier((0.16, 0.14), (0.14, 0.8), (0.86, 0.8), (0.84, 0.14)), 0.012), "#3E7A2A")
        for k, (x, y) in enumerate(pts):
            marigold(i, x, y, 0.07, warm=k % 2 == 0)
        paint(i, ell(0.5, 0.66, 0.04, 0.04), "#E14C6A", "#7A1530", ow=0.006)
    item("F3", 3, f3)

    def f4(i):
        for x in (0.2, 0.8):
            paint(i, leaf(x, 0.75, 0.3, 0.07, -90 + (x - 0.5) * 30), "#5FA83A", "#2E6B1E", ow=0.008, shine=False)
        arc = bezier((0.2, 0.72), (0.18, 0.02), (0.82, 0.02), (0.8, 0.72), 18)
        flat(i, line(bezier((0.2, 0.72), (0.18, 0.02), (0.82, 0.02), (0.8, 0.72)), 0.014), "#3E7A2A")
        for k, (x, y) in enumerate(arc):
            marigold(i, x, y, 0.058, warm=k % 2 == 0)
        for k, x in enumerate([0.34, 0.5, 0.66]):
            yy = 0.2 if k != 1 else 0.17
            for j in range(3):
                marigold(i, x, yy + 0.08 + j * 0.075, 0.035, warm=(j + k) % 2 == 1)
    item("F4", 4, f4)

    # Sweets
    item("W1", 1, lambda i: laddu(i, 0.5, 0.52, 0.22))
    item("W2", 2, lambda i: place(i, sprite("piece_sweets_box"), 0.5, 0.52, w=0.78))

    def w3(i):
        for x in (0.36, 0.5, 0.64):
            laddu(i, x, 0.38 if x != 0.5 else 0.34, 0.1)
        paint(i, poly([(0.2, 0.42), (0.8, 0.42), (0.76, 0.76), (0.24, 0.76)]), "#D94B4B", "#7A1A1A", ow=0.012)
        paint(i, rrect(0.17, 0.4, 0.83, 0.47, 0.02), "#E8A43A", "#8A5A12", ow=0.01, shine=False)
        paint(i, rrect(0.45, 0.47, 0.55, 0.76, 0.0), "#F2C14E", "#8A5A12", shine=False, ow=0.006)
        sparkle(i, 0.3, 0.6, 0.04)
    item("W3", 3, w3)

    def w4(i):
        glow(i, ell(0.5, 0.45, 0.32, 0.3), "#FFC94A", 0.05, 100)
        paint(i, rrect(0.17, 0.3, 0.83, 0.77, 0.05), "#C2255C", "#5E0E2C", ow=0.012)
        paint(i, rrect(0.13, 0.24, 0.87, 0.36, 0.04), "#E14C7A", "#7A1530", ow=0.012)
        paint(i, rrect(0.28, 0.42, 0.72, 0.68, 0.04), "#FFF1D6", "#E6C99A", shine=False, ow=0.01)
        for x in (0.38, 0.5, 0.62):
            paint(i, rrect(x - 0.05, 0.5, x + 0.05, 0.6, 0.015), ["#F6D36B", "#F28CB4", "#9FD86B"][int((x - 0.38) / 0.12 + 0.1)], "#8A5A12", ow=0.006, shine=False)
        for x in [0.2 + k * 0.06 for k in range(11)]:
            flat(i, ell(x, 0.72, 0.012, 0.012), "#F2C14E")
        paint(i, ell(0.4, 0.2, 0.09, 0.06), "#F2C14E", "#8A5A12", ow=0.01)
        paint(i, ell(0.6, 0.2, 0.09, 0.06), "#F2C14E", "#8A5A12", ow=0.01)
        paint(i, ell(0.5, 0.23, 0.04, 0.04), "#F6A81C", "#8A5A12", ow=0.008)
    item("W4", 4, w4)

    # Cloth
    def c1(i):
        paint(i, rrect(0.36, 0.26, 0.64, 0.68, 0.03), "#FFF8EA", "#C9B79A", ow=0.01)
        for k in range(8):
            flat(i, line([(0.36, 0.3 + k * 0.05), (0.64, 0.32 + k * 0.05)], 0.006), "#C9B79A", 160)
        paint(i, ell(0.5, 0.25, 0.2, 0.06), "#C98A4A", "#6A3A16", ow=0.01)
        paint(i, ell(0.5, 0.69, 0.2, 0.06), "#C98A4A", "#6A3A16", ow=0.01)
        flat(i, line(bezier((0.64, 0.5), (0.8, 0.52), (0.78, 0.66), (0.86, 0.72)), 0.012), "#FFF8EA")
    item("C1", 1, c1)
    item("C2", 2, lambda i: place(i, cloth_sprite("#F1E4C8", sat=0.35, val=1.15), 0.5, 0.5, w=0.78))

    def c3(i):
        paint(i, rrect(0.22, 0.34, 0.74, 0.64, 0.02), "#B23A8E", "#4E0F3C", ow=0.012, angle=90)
        flat(i, rrect(0.22, 0.43, 0.74, 0.47, 0.0), "#F2C14E")
        flat(i, rrect(0.22, 0.52, 0.74, 0.54, 0.0), "#F2C14E")
        paint(i, ell(0.74, 0.49, 0.07, 0.15), "#D45AAE", "#5E0E4C", ow=0.012, shine=False)
        for r in (0.05, 0.03):
            flat(i, minus(ell(0.74, 0.49, r, r * 2.1), ell(0.74, 0.49, r - 0.008, (r - 0.008) * 2.1)), "#5E0E4C", 200)
        flat(i, ell(0.45, 0.39, 0.16, 0.02).filter(ImageFilter.GaussianBlur(4)), "#FFFFFF", 150)
        sparkle(i, 0.3, 0.3, 0.05)
    item("C3", 3, c3)

    # Dye
    item("D1", 1, lambda i: (place(i, recolor(sprite("piece_spice_tin"), target="#2B3FB0", keep=0.0, sat=1.2, val=0.95), 0.5, 0.48, h=0.6),
                             paint(i, ell(0.5, 0.2, 0.12, 0.04), "#3B52D9", "#1A1C4D", shine=False, ow=0.006)))

    def d2(i):
        paint(i, poly([(0.16, 0.34), (0.84, 0.34), (0.76, 0.76), (0.24, 0.76)]), "#A0673A", "#4A2810", ow=0.012)
        for x in (0.3, 0.45, 0.6):
            flat(i, line([(x, 0.36), (x + 0.02, 0.75)], 0.006), "#4A2810", 120)
        paint(i, rrect(0.17, 0.48, 0.83, 0.53, 0.01), "#C9A24A", "#6A4A10", shine=False, ow=0.006)
        paint(i, ell(0.5, 0.34, 0.34, 0.08), "#3B52D9", "#151A6A", ow=0.012, shine=False)
        paint(i, poly([(0.62, 0.3), (0.7, 0.31), (0.86, 0.6), (0.8, 0.66)]), "#2B3FB0", "#151A6A", ow=0.008)
        flat(i, ell(0.42, 0.33, 0.08, 0.015), "#9FB0FF", 160)
    item("D2", 2, d2)

    # Keys
    item("K1", 1, lambda i: key(i, "#E9B44C", "#7A4A10", 1))
    item("K2", 2, lambda i: key(i, "#EEF3F7", "#6E7C8C", 2))
    item("K3", 3, lambda i: (glow(i, ell(0.45, 0.45, 0.3, 0.3), "#FFD46A", 0.05, 120), key(i, "#FFD45A", "#A0522D", 3)))

    # Chilli
    ch = chilli()
    item("S1", 1, lambda i: place(i, ch, 0.5, 0.5, h=0.6, rot=-10))

    def s2(i):
        for rot, dx in ((35, -0.12), (-35, 0.12), (0, 0)):
            place(i, ch, 0.5 + dx, 0.5, h=0.55, rot=rot)
        paint(i, ell(0.48, 0.28, 0.06, 0.04), "#3E7A2A", "#1E4A10", shine=False)
    item("S2", 2, s2)

    def s3(i):
        flat(i, line([(0.5, 0.08), (0.5, 0.72)], 0.012), "#E8D5A8")
        for k in range(5):
            y = 0.16 + k * 0.12
            place(i, ch, 0.5 + (0.1 if k % 2 else -0.1), y + 0.04, h=0.22, rot=60 if k % 2 else -60)
        for dx in (-0.04, 0, 0.04):
            flat(i, line([(0.5, 0.7), (0.5 + dx, 0.78)], 0.01), "#E14C6A")
        paint(i, ell(0.5, 0.08, 0.04, 0.04), "#F2C14E", "#8A5A12", shine=False)
    item("S3", 3, s3)

    # Pepper
    def p1(i):
        paint(i, leaf(0.5, 0.66, 0.36, 0.1, -60), "#5FA83A", "#2E6B1E", ow=0.008, shine=False)
        rnd = random.Random(7)
        for k in range(11):
            a, d = rnd.random() * 6.28, rnd.random() ** 0.5 * 0.16
            paint(i, ell(0.5 + d * math.cos(a), 0.52 + d * math.sin(a) * 0.8, 0.062, 0.062), "#6A4A3A", "#241410", ow=0.008)
    item("P1", 1, p1)

    def pepper_top(i):
        for k in range(9):
            x = 0.36 + (k % 5) * 0.07
            y = 0.37 - (k // 5) * 0.04
            paint(i, ell(x, y, 0.04, 0.04), "#5A3A2A", "#1E100C", ow=0.006, shine=False)
    item("P2", 2, lambda i: sack(i, top=pepper_top))

    # Turmeric
    def t1(i):
        parts = [(0.42, 0.52, 0.2, 0.09, 20), (0.6, 0.46, 0.13, 0.07, -30), (0.34, 0.38, 0.1, 0.06, 70), (0.62, 0.62, 0.12, 0.06, 35)]
        m = mask()
        for cx, cy, rx, ry, a in parts:
            e = Image.new("L", (N, N), 0)
            ImageDraw.Draw(e).ellipse([(cx - rx) * N, (cy - ry) * N, (cx + rx) * N, (cy + ry) * N], fill=255)
            m = union(m, e.rotate(a, center=(cx * N, cy * N), resample=Image.BICUBIC))
        paint(i, m, "#D9A54A", "#7A4A16", ow=0.012)
        for k in range(6):
            flat(i, inter(line([(0.3 + k * 0.07, 0.4), (0.27 + k * 0.07, 0.62)], 0.006), m), "#7A4A16", 140)
        paint(i, ell(0.72, 0.42, 0.06, 0.06), "#FF9A1A", "#C25A0C", ow=0.008)
    item("T1", 1, t1)
    item("T2", 2, lambda i: glass_jar(i, "#FFC21A", "#D9840C", level=0.7))

    # Rice
    item("R1", 1, lambda i: sack(i, body="#E3CDA0", dark="#8A6A3A", tie="#2B6FB0", top=lambda j: heap(j, 0.5, 0.38, 0.17, 0.05, "#FFFFFF", "#D9D2C0", grains="#C9BFA8")))

    def r2(i):
        clay_pot(i, 0.58)
        heap(i, 0.5, 0.42, 0.17, 0.06, "#FFFFFF", "#D9D2C0", grains="#C9BFA8")
    item("R2", 2, r2)

    # Ghee
    def g1(i):
        paint(i, ell(0.5, 0.58, 0.22, 0.18), "#F2C14E", "#8A5A12", ow=0.012)
        paint(i, rrect(0.39, 0.33, 0.61, 0.44, 0.03), "#E8B23E", "#8A5A12", ow=0.01, shine=False)
        paint(i, ell(0.5, 0.33, 0.14, 0.045), "#FFE8A0", "#C99A2A", ow=0.01, shine=False)
        paint(i, poly(bezier((0.4, 0.34), (0.38, 0.5), (0.44, 0.5), (0.45, 0.36))), "#FFF0B8", "#E0B84A", ow=0.006, shine=False)
        flat(i, line([(0.3, 0.58), (0.7, 0.58)], 0.012), "#8A5A12", 140)
    item("G1", 1, g1)
    item("G2", 2, lambda i: glass_jar(i, "#FFD86A", "#D9A020", cloth="#C2255C", level=0.75))

    # Crafted
    item("Du", 0, lambda i: (place(i, cloth_sprite("#F07A1E", sat=1.1), 0.5, 0.5, w=0.78), sparkle(i, 0.24, 0.3, 0.05)))

    def sa(i):
        s = cloth_sprite("#C2255C", sat=1.15)
        place(i, s, 0.5, 0.5, w=0.8)
        flat(i, inter(line([(0.1, 0.62), (0.9, 0.72)], 0.03), ell(0.5, 0.55, 0.42, 0.2)), "#F2C14E", 230)
        sparkle(i, 0.25, 0.3, 0.06)
        sparkle(i, 0.75, 0.36, 0.04)
    item("Sa", 0, sa)

    def mx(i):
        bowl(i, cy=0.56)
        heap(i, 0.36, 0.56, 0.1, 0.05, "#E5372B", "#8E1410")
        heap(i, 0.64, 0.56, 0.1, 0.05, "#FFC21A", "#C27A0C")
        heap(i, 0.5, 0.55, 0.11, 0.07, "#8A5A3A", "#3A2010", grains="#2A1810")
    item("Mx", 0, mx)
    item("Ms", 0, lambda i: place(i, sprite("piece_spice_tin"), 0.5, 0.48, h=0.64))

    def po(i):
        flat(i, line([(0.74, 0.2), (0.68, 0.7)], 0.04), "#7FB34A")
        for y in (0.3, 0.45, 0.6):
            flat(i, line([(0.72, y), (0.715, y + 0.01)], 0.05), "#4E7A2A")
        clay_pot(i, 0.58, body="#B85A30")
        heap(i, 0.5, 0.42, 0.19, 0.08, "#F6C66A", "#B8761A", grains="#8A4A10")
        paint(i, poly(bezier((0.34, 0.42), (0.3, 0.52), (0.36, 0.56), (0.38, 0.44))), "#F6C66A", "#B8761A", ow=0.006, shine=False)
        flat(i, ell(0.5, 0.33, 0.03, 0.02), "#7A3A10")
    item("Po", 0, po)

    def fp(i):
        paint(i, leaf(0.12, 0.58, 0.8, 0.2, 0), "#4FA83A", "#1E5A10", ow=0.012)
        flat(i, line([(0.14, 0.58), (0.9, 0.58)], 0.008), "#2E6B1E", 160)
        heap(i, 0.46, 0.6, 0.12, 0.04, "#FFFFFF", "#D9D2C0", grains="#C9BFA8")
        for cx, col in ((0.26, "#E5372B"), (0.66, "#FFC21A"), (0.8, "#8A5A3A")):
            bowl(i, cx, 0.52, 0.07, 0.03)
            flat(i, ell(cx, 0.52, 0.055, 0.014), col)
        laddu(i, 0.6, 0.66, 0.06)
        laddu(i, 0.3, 0.68, 0.055)
    item("Fp", 0, fp)

    def mb(i):
        flat(i, line(bezier((0.08, 0.18), (0.35, 0.36), (0.65, 0.36), (0.92, 0.18)), 0.012), "#8A5A12")
        pts = bezier((0.08, 0.18), (0.35, 0.36), (0.65, 0.36), (0.92, 0.18), 7)
        cols = ["#E14C6A", "#F6A81C", "#1F9E8F", "#2B2F77", "#E14C6A", "#F6A81C", "#1F9E8F"]
        for k in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[k], pts[k + 1]
            paint(i, poly([(x0, y0), (x1, y1), ((x0 + x1) / 2, (y0 + y1) / 2 + 0.16)]), cols[k], mix(cols[k], (0, 0, 0), 0.5), ow=0.008, shine=False)
        paint(i, rrect(0.24, 0.42, 0.76, 0.72, 0.05), "#C2255C", "#5E0E2C", ow=0.012)
        paint(i, rrect(0.28, 0.46, 0.72, 0.68, 0.035), "#FFF1D6", "#E6C99A", shine=False, ow=0.008)
        place(i, sprite("piece_diya_brass"), 0.5, 0.57, h=0.18)
        for x in (0.3, 0.7):
            flat(i, line([(x, 0.72), (x, 0.78)], 0.012), "#F2C14E")
    item("Mb", 0, mb)


# ───────── generators: a festival stall (striped awning + basket) holding its chain's first piece ─────────

GENS = {
    "lamp": ("L1", "#E14C4A"), "flower": ("F1", "#F6A81C"), "sweets": ("W1", "#E14C7A"), "loom": ("C1", "#2B6FB0"),
    "dye": ("D1", "#2B2F77"), "key": ("K1", "#8A5A12"), "spice": ("S1", "#D8433B"), "harvest": ("R1", "#3E8E41"),
    "hearth": ("L1", "#1F9E8F"),
}


def build_generators():
    for kind, (code, aw) in GENS.items():
        img = canvas()
        glow(img, ell(0.5, 0.52, 0.42, 0.4), "#FFE08A", 0.05, 120)
        shadow(img, 0.5, 0.9, 0.42, 0.06, 130)
        # posts
        for x in (0.16, 0.84):
            paint(img, rrect(x - 0.03, 0.2, x + 0.03, 0.86, 0.015), "#A0673A", "#4A2810", ow=0.01, shine=False)
        # basket / counter
        paint(img, poly([(0.12, 0.6), (0.88, 0.6), (0.8, 0.88), (0.2, 0.88)]), "#D9A55A", "#7A4A16", ow=0.014)
        for k in range(7):
            y = 0.63 + k * 0.035
            flat(img, inter(line([(0.1, y), (0.9, y)], 0.008), poly([(0.12, 0.6), (0.88, 0.6), (0.8, 0.88), (0.2, 0.88)])), "#7A4A16", 110)
        paint(img, rrect(0.1, 0.57, 0.9, 0.64, 0.02), "#E8B86A", "#7A4A16", ow=0.012, shine=False)
        # wares
        src = made[code].crop((int(N * 0.1), 0, int(N * 0.9), int(N * 0.72)))
        place(img, src, 0.5, 0.45, h=0.42)
        # scalloped striped awning
        aw_m = union(poly([(0.06, 0.1), (0.94, 0.1), (0.98, 0.28), (0.02, 0.28)]), *[ell(0.08 + k * 0.12, 0.28, 0.06, 0.05) for k in range(8)])
        paint(img, aw_m, mix(aw, (255, 255, 255), 0.15), mix(aw, (0, 0, 0), 0.45), ow=0.014, angle=90)
        for k in range(4):
            x = 0.14 + k * 0.24
            flat(img, inter(poly([(x, 0.1), (x + 0.12, 0.1), (x + 0.13, 0.36), (x + 0.01, 0.36)]), aw_m), "#FFF1D6", 220)
        paint(img, rrect(0.04, 0.06, 0.96, 0.12, 0.03), "#F2C14E", "#8A5A12", ow=0.01, shine=False)
        save(f"gen_{kind}", img)
    # The hearth (free, cooldown) gets the real clay-hearth art on a brick base.
    img = canvas()
    glow(img, ell(0.5, 0.45, 0.42, 0.4), "#FFB84A", 0.05, 150)
    shadow(img, 0.5, 0.9, 0.42, 0.06, 130)
    paint(img, rrect(0.1, 0.56, 0.9, 0.88, 0.06), "#B5583A", "#5A2010", ow=0.014)
    for r in range(3):
        for c in range(4):
            x0 = 0.12 + c * 0.2 + (0.1 if r % 2 else 0)
            flat(img, inter(rrect(x0, 0.59 + r * 0.095, x0 + 0.17, 0.67 + r * 0.095, 0.015), rrect(0.1, 0.56, 0.9, 0.88, 0.06)), "#D9784A", 160)
    place(img, sprite("generator_hearth"), 0.5, 0.34, h=0.52)
    save("gen_hearth", img)


# ───────── blockers ─────────

def build_blockers():
    # crate (contents are drawn on top at runtime, on the tag)
    img = canvas()
    shadow(img, 0.5, 0.9, 0.42, 0.06, 130)
    body = rrect(0.1, 0.16, 0.9, 0.86, 0.05)
    paint(img, body, "#C98A4A", "#5A3016", ow=0.016)
    for k in range(4):
        y = 0.2 + k * 0.165
        flat(img, inter(line([(0.1, y), (0.9, y)], 0.008), body), "#5A3016", 150)
    paint(img, line([(0.18, 0.78), (0.82, 0.24)], 0.07), "#D99A5A", "#6A3A16", ow=0.01, shine=False)
    for x, y in ((0.16, 0.22), (0.84, 0.22), (0.16, 0.8), (0.84, 0.8)):
        paint(img, ell(x, y, 0.03, 0.03), "#C9C2B5", "#5A5550", shine=False, ow=0.006)
    paint(img, rrect(0.25, 0.3, 0.75, 0.74, 0.08), "#FFF1D6", "#E0C79A", ow=0.012, shine=False)
    save("crate", img)

    # tangled thread overlays (1 and 2 layers): loops of yarn over whatever is beneath
    for layers in (1, 2):
        img = canvas()
        rnd = random.Random(40 + layers)
        cols = [("#D8433B", "#7A1A12"), ("#1F9E8F", "#0E4A43"), ("#F2C14E", "#8A5A12"), ("#FFF1D6", "#B8A07A"), ("#7A3FA0", "#3A1050")]
        for k in range(9 if layers == 1 else 16):
            p = [(0.08 + rnd.random() * 0.84, 0.08 + rnd.random() * 0.84) for _ in range(4)]
            m = line(bezier(*p), 0.03 if layers == 1 else 0.032)
            l, d = cols[k % len(cols)]
            paint(img, m, l, d, ow=0.008, shine=False, tone=False)
        if layers == 2:
            flat(img, rrect(0.06, 0.06, 0.94, 0.94, 0.1), "#3A1F14", 40)
        save(f"thread{layers}", img)

    # sealed clay jar in 3 stages (3 = intact, 1 = about to break)
    for left in (3, 2, 1):
        img = canvas()
        shadow(img, 0.5, 0.9, 0.36, 0.06, 130)
        paint(img, ell(0.5, 0.6, 0.32, 0.27), "#C8643A", "#6A2410", ow=0.014)
        paint(img, rrect(0.32, 0.22, 0.68, 0.38, 0.04), "#B8562E", "#5A1A0A", ow=0.012, shine=False)
        paint(img, poly([(0.24, 0.27), (0.76, 0.27), (0.8, 0.14), (0.5, 0.08), (0.2, 0.14)]), "#E8C27A", "#8A6420", ow=0.012)
        paint(img, rrect(0.28, 0.25, 0.72, 0.3, 0.02), "#C2255C", "#5E0E2C", ow=0.008, shine=False)
        for k in range(6):
            flat(img, ell(0.29 + k * 0.084, 0.62, 0.02, 0.02), "#F2D29A", 200)
        cracks = [[(0.4, 0.38), (0.46, 0.5), (0.42, 0.6), (0.48, 0.72)], [(0.66, 0.45), (0.6, 0.56), (0.66, 0.66), (0.62, 0.8)], [(0.3, 0.55), (0.38, 0.64), (0.34, 0.76)]]
        for c in cracks[: 3 - left + (1 if left == 1 else 0)]:
            flat(img, line(c, 0.018, joint="curve"), "#2A0A04")
            flat(img, line([(x + 0.008, y) for x, y in c], 0.006), "#F2A07A", 160)
        save(f"jar{left}", img)

    # locked trunks: brass, silver, filigree locks
    locks = {1: ("#E9B44C", "#7A4A10"), 2: ("#EEF3F7", "#6E7C8C"), 3: ("#FFD45A", "#A0522D")}
    for t, (l, d) in locks.items():
        img = canvas()
        shadow(img, 0.5, 0.9, 0.42, 0.06, 130)
        paint(img, rrect(0.08, 0.4, 0.92, 0.86, 0.04), "#9A5A2E", "#3E1C08", ow=0.016)
        paint(img, union(rrect(0.08, 0.26, 0.92, 0.44, 0.02), ell(0.5, 0.28, 0.42, 0.14)), "#B06A36", "#4A2208", ow=0.016)
        for x in (0.22, 0.78):
            paint(img, rrect(x - 0.04, 0.16, x + 0.04, 0.86, 0.01), l, d, ow=0.008, shine=False)
        paint(img, rrect(0.08, 0.41, 0.92, 0.46, 0.0), l, d, ow=0.008, shine=False)
        lock = rrect(0.36, 0.38, 0.64, 0.7, 0.05) if t == 1 else (poly(reg_pts(0.5, 0.54, 0.17, 6)) if t == 2 else poly(star_pts(0.5, 0.54, 0.2, 0.14, 8)))
        paint(img, lock, l, d, ow=0.012)
        flat(img, union(ell(0.5, 0.5, 0.035, 0.035), poly([(0.48, 0.52), (0.52, 0.52), (0.54, 0.63), (0.46, 0.63)])), "#2A1408")
        if t == 3:
            paint(img, ell(0.5, 0.36, 0.035, 0.035), "#3FD1C2", "#0E6B63", ow=0.006)
        save(f"trunk{t}", img)


# ───────── boosters + currencies ─────────

def build_icons():
    # Fireworks: a festive rocket with a spark burst
    img = canvas()
    for k in range(12):
        a = k * math.pi / 6
        flat(img, line([(0.62 + 0.12 * math.cos(a), 0.3 + 0.12 * math.sin(a)), (0.62 + 0.26 * math.cos(a), 0.3 + 0.26 * math.sin(a))], 0.025), ["#FFD24A", "#E14C6A", "#3FD1C2"][k % 3])
    body = poly([(0.2, 0.86), (0.12, 0.78), (0.5, 0.4), (0.58, 0.48)])
    paint(img, body, "#E5372B", "#7A1410", ow=0.014)
    for t in (0.35, 0.6):
        x, y = 0.16 + (0.54 - 0.16) * t, 0.82 + (0.44 - 0.82) * t
        flat(img, inter(line([(x - 0.06, y - 0.06), (x + 0.06, y + 0.06)], 0.03), body), "#F2C14E")
    paint(img, poly([(0.5, 0.4), (0.58, 0.48), (0.66, 0.32)]), "#F2C14E", "#8A5A12", ow=0.012)
    sparkle(img, 0.62, 0.3, 0.09, "#FFFFFF")
    save("boost_fireworks", img)

    img = canvas()
    paint(img, poly([(0.2, 0.84), (0.72, 0.24), (0.8, 0.18), (0.78, 0.28), (0.24, 0.86)]), "#EEF3F7", "#6E7C8C", ow=0.012)
    flat(img, ell(0.74, 0.25, 0.022, 0.012), "#2A2A3A")
    flat(img, line(bezier((0.75, 0.25), (0.95, 0.4), (0.4, 0.5), (0.3, 0.3), 40), 0.025), "#D8433B")
    flat(img, line(bezier((0.3, 0.3), (0.2, 0.15), (0.1, 0.4), (0.18, 0.5)), 0.025), "#D8433B")
    save("boost_needle", img)

    img = canvas()
    paint(img, line([(0.78, 0.12), (0.5, 0.52)], 0.06), "#C98A4A", "#5A3016", ow=0.012)
    straw = poly([(0.46, 0.44), (0.58, 0.54), (0.42, 0.9), (0.1, 0.7)])
    paint(img, straw, "#F2C66A", "#9A6A1A", ow=0.014)
    for k in range(7):
        flat(img, inter(line([(0.5 - k * 0.01, 0.5), (0.12 + k * 0.05, 0.74 + k * 0.025)], 0.008), straw), "#9A6A1A", 160)
    paint(img, rrect(0.42, 0.42, 0.6, 0.52, 0.02), "#D8433B", "#7A1410", ow=0.01, shine=False)
    save("boost_sweep", img)

    img = canvas()
    glow(img, ell(0.5, 0.5, 0.3, 0.36), "#FFE08A", 0.05, 160)
    paint(img, poly([(0.58, 0.06), (0.26, 0.54), (0.48, 0.54), (0.4, 0.94), (0.76, 0.42), (0.54, 0.42), (0.66, 0.06)]), "#FFE04A", "#E0780C", ow=0.016)
    save("cur_spark", img)

    pair = sprite("icon_lamp_star")
    img = canvas()
    place(img, pair.crop((0, 0, 256, 254)), 0.5, 0.5, h=0.92)
    save("cur_lamp", img)
    img = canvas()
    place(img, pair.crop((256, 0, 512, 254)), 0.5, 0.5, h=0.92)
    save("cur_star", img)

    img = canvas()
    gem = poly([(0.3, 0.2), (0.7, 0.2), (0.88, 0.4), (0.5, 0.88), (0.12, 0.4)])
    paint(img, gem, "#3FD1C2", "#0E5A63", ow=0.016)
    for a, b in (((0.12, 0.4), (0.88, 0.4)), ((0.3, 0.2), (0.4, 0.4)), ((0.7, 0.2), (0.6, 0.4)), ((0.4, 0.4), (0.5, 0.88)), ((0.6, 0.4), (0.5, 0.88))):
        flat(img, line([a, b], 0.01), "#0E5A63", 160)
    flat(img, poly([(0.32, 0.23), (0.48, 0.23), (0.4, 0.37)]), "#FFFFFF", 170)
    save("cur_jewel", img)


if __name__ == "__main__":
    build_items()
    build_generators()
    build_blockers()
    build_icons()
    # contact sheet for review
    names = sorted(made)
    cols = 10
    sheet = Image.new("RGBA", (cols * 140, ((len(names) + cols - 1) // cols) * 150), (60, 40, 70, 255))
    for k, n in enumerate(names):
        im = made[n].resize((128, 128), Image.LANCZOS)
        sheet.alpha_composite(im, ((k % cols) * 140 + 6, (k // cols) * 150 + 4))
        ImageDraw.Draw(sheet).text(((k % cols) * 140 + 50, (k // cols) * 150 + 134), n, fill=(255, 255, 255, 255))
    sheet.save("/tmp/mb_items.png")
    print(len(names), "pieces")
