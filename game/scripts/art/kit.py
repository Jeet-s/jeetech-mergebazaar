"""Tiny painterly-vector kit (PIL + numpy) used to bake the board pieces and icons that the generated art set
does not include. Everything is drawn at SS x the output size and downsampled, so edges are smooth.
Look: three-tone soft shading lit from the top-left, a thin darker-hue outline, a creamy specular streak and a
soft contact shadow — the art-direction rules in docs/ART_DIRECTION.md."""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ART = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "art")
SS = 3
OUT = 256
N = OUT * SS  # working canvas size


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a, b = hexrgb(a) if isinstance(a, str) else a, hexrgb(b) if isinstance(b, str) else b
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def canvas():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def mask():
    return Image.new("L", (N, N), 0)


def P(x, y):
    """Unit coords (0..1) → canvas pixels."""
    return (x * N, y * N)


def ell(cx, cy, rx, ry, m=None, fill=255):
    m = m or mask()
    ImageDraw.Draw(m).ellipse([(cx - rx) * N, (cy - ry) * N, (cx + rx) * N, (cy + ry) * N], fill=fill)
    return m


def rrect(x0, y0, x1, y1, r, m=None, fill=255):
    m = m or mask()
    ImageDraw.Draw(m).rounded_rectangle([x0 * N, y0 * N, x1 * N, y1 * N], radius=r * N, fill=fill)
    return m


def poly(pts, m=None, fill=255):
    m = m or mask()
    ImageDraw.Draw(m).polygon([P(x, y) for x, y in pts], fill=fill)
    return m


def line(pts, w, m=None, fill=255, joint="curve"):
    m = m or mask()
    d = ImageDraw.Draw(m)
    d.line([P(x, y) for x, y in pts], fill=fill, width=int(w * N), joint=joint)
    for x, y in (pts[0], pts[-1]):
        r = w * N / 2
        d.ellipse([x * N - r, y * N - r, x * N + r, y * N + r], fill=fill)
    return m


def bezier(p0, p1, p2, p3=None, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        if p3 is None:
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        else:
            x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
            y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
        out.append((x, y))
    return out


def union(*ms):
    out = ms[0].copy()
    for m in ms[1:]:
        out = ImageChops.lighter(out, m)
    return out


def minus(a, b):
    return ImageChops.subtract(a, b)


def inter(a, b):
    return ImageChops.multiply(a, b)


def _grad(light, dark, angle=135, spread=1.0, bbox=None):
    """Linear gradient light→dark along `angle` (deg, 135 = from top-left), across the mask's bbox."""
    x0, y0, x1, y1 = bbox or (0, 0, N, N)
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
    a = math.radians(angle)
    dx, dy = -math.cos(a), math.sin(a)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(1.0, (abs(dx) * (x1 - x0) + abs(dy) * (y1 - y0)) / 2) * spread
    t = ((xs - cx) * dx + (ys - cy) * dy) / half * 0.5 + 0.5
    t = np.clip(t, 0, 1)[..., None]
    L, D = np.array(hexrgb(light) if isinstance(light, str) else light, np.float32), np.array(hexrgb(dark) if isinstance(dark, str) else dark, np.float32)
    return (L * (1 - t) + D * t).astype(np.uint8)


def paint(img, m, light, dark=None, angle=135, outline=None, ow=0.012, shine=True, rim=True, spread=1.0, tone=True):
    """Fill mask m on img with a shaded gradient, darker-hue outline, specular streak and rim light."""
    bbox = m.getbbox()
    if not bbox:
        return img
    dark = dark or mix(light, (40, 20, 20), 0.55)
    rgb = _grad(light, dark, angle, spread, bbox)
    layer = Image.fromarray(np.dstack([rgb, np.array(m)]), "RGBA")
    if tone:
        # soft core shadow toward the bottom-right edge (3-tone shading)
        inner = m.filter(ImageFilter.GaussianBlur(N * 0.03))
        edge = ImageChops.subtract(m, inner).point(lambda v: min(255, v * 2))
        sh = Image.new("RGBA", (N, N), tuple(mix(dark, (20, 10, 30), 0.35)) + (0,))
        sh.putalpha(inter(edge, _dir_mask(bbox, 135 + 180)).point(lambda v: int(v * 0.55)))
        layer = Image.alpha_composite(layer, sh)
    img.alpha_composite(layer)
    if rim:
        inner = m.filter(ImageFilter.GaussianBlur(N * 0.012))
        edge = ImageChops.subtract(m, inner)
        rl = Image.new("RGBA", (N, N), (255, 236, 190, 0))
        rl.putalpha(inter(edge.point(lambda v: min(255, v * 3)), _dir_mask(bbox, 135)).point(lambda v: int(v * 0.5)))
        img.alpha_composite(rl)
    if shine:
        x0, y0, x1, y1 = bbox
        w, h = x1 - x0, y1 - y0
        s = mask()
        ImageDraw.Draw(s).ellipse([x0 + w * 0.16, y0 + h * 0.08, x0 + w * 0.5, y0 + h * 0.3], fill=170)
        s = s.filter(ImageFilter.GaussianBlur(N * 0.018))
        s = inter(s, m.filter(ImageFilter.GaussianBlur(2)))
        hl = Image.new("RGBA", (N, N), (255, 250, 230, 0))
        hl.putalpha(s)
        img.alpha_composite(hl)
    if outline is not False:
        oc = outline or mix(dark, (30, 10, 10), 0.45)
        oc = hexrgb(oc) if isinstance(oc, str) else oc
        grown = m.filter(ImageFilter.MaxFilter(_odd(ow * N)))
        ring = ImageChops.subtract(grown, m)
        o = Image.new("RGBA", (N, N), tuple(oc) + (0,))
        o.putalpha(ring)
        img.alpha_composite(o)
    return img


def _odd(v):
    v = max(3, int(v))
    return v if v % 2 else v + 1


def _dir_mask(bbox, angle):
    """0..255 ramp across bbox: 255 on the side the angle points from."""
    x0, y0, x1, y1 = bbox
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
    a = math.radians(angle)
    dx, dy = -math.cos(a), math.sin(a)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(1.0, (abs(dx) * (x1 - x0) + abs(dy) * (y1 - y0)) / 2)
    t = 1 - np.clip(((xs - cx) * dx + (ys - cy) * dy) / half * 0.5 + 0.5, 0, 1)
    t = np.clip((t - 0.45) / 0.55, 0, 1)
    return Image.fromarray((t * 255).astype(np.uint8), "L")


def flat(img, m, color, alpha=255):
    layer = Image.new("RGBA", (N, N), tuple(hexrgb(color) if isinstance(color, str) else color) + (0,))
    layer.putalpha(m.point(lambda v: v * alpha // 255))
    img.alpha_composite(layer)
    return img


def glow(img, m, color, blur=0.04, alpha=200):
    g = m.filter(ImageFilter.GaussianBlur(N * blur))
    return flat(img, g, color, alpha)


def shadow(img, cx=0.5, cy=0.9, rx=0.34, ry=0.06, alpha=110):
    m = ell(cx, cy, rx, ry).filter(ImageFilter.GaussianBlur(N * 0.025))
    return flat(img, m, (40, 18, 10), alpha)


def sprite(name):
    return Image.open(os.path.join(ART, name + ".png")).convert("RGBA")


def crop(img, box):
    return img.crop(box)


def place(img, spr, cx, cy, h=None, w=None, rot=0):
    """Paste sprite centred at (cx, cy) scaled to height h (or width w), unit coords."""
    sw, sh = spr.size
    if h is not None:
        scale = h * N / sh
    else:
        scale = w * N / sw
    s = spr.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.LANCZOS)
    if rot:
        s = s.rotate(rot, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(s, (int(cx * N - s.size[0] / 2), int(cy * N - s.size[1] / 2)))
    return img


def recolor(spr, hue=0.0, sat=1.0, val=1.0, target=None, keep=0.0):
    """Hue-rotate (degrees) / scale saturation and value of a sprite; or remap its hue to `target` hex while
    keeping shading (keep = fraction of original hue kept, for brass/flame details)."""
    a = np.array(spr).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    hsv = np.array(Image.fromarray((rgb * 255).astype(np.uint8)).convert("HSV")).astype(np.float32) / 255
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    if target:
        th = np.array(Image.new("RGB", (1, 1), hexrgb(target)).convert("HSV")).astype(np.float32)[0, 0] / 255
        h = h * keep + th[0] * (1 - keep)
        s = np.clip(s * sat * (0.4 + th[1]), 0, 1)
    else:
        h = (h + hue / 360) % 1
        s = np.clip(s * sat, 0, 1)
    v = np.clip(v * val, 0, 1)
    out = Image.fromarray((np.dstack([h, s, v]) * 255).astype(np.uint8), "HSV").convert("RGB")
    return Image.fromarray(np.dstack([np.array(out), (al[..., 0] * 255).astype(np.uint8)]), "RGBA")


def star_pts(cx, cy, ro, ri, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def reg_pts(cx, cy, r, n, rot=-90):
    return [(cx + r * math.cos(math.radians(rot + i * 360 / n)), cy + r * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]


def finish(img, path, size=OUT):
    out = img.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path, optimize=True)
    return out
