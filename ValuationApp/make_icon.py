#!/usr/bin/env python3
"""Gouru Valuations app icon (premium): deep-navy badge, metallic gold roof, fine gold frame,
white "GOURU" wordmark and gold "VALUATIONS" between two thin gold rules.

    python3 make_icon.py            → writes every iOS / Android / Play Store icon, splash and favicon
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
HEAVY = ('/System/Library/Fonts/Avenir Next.ttc', 8)   # Avenir Next Heavy
DEMI = ('/System/Library/Fonts/Avenir Next.ttc', 2)    # Avenir Next Demi Bold

WORD, SUB = 'GOURU', 'VALUATIONS'                      # brand name on the icon
NAVY_A, NAVY_B = (27, 58, 138), (7, 18, 52)            # top-left → bottom-right
GLOW = (64, 120, 235)
GOLD_LIGHT, GOLD, GOLD_DEEP = (254, 236, 160), (245, 180, 40), (180, 105, 12)
WHITE, GOLD_TEXT = (255, 255, 255), (246, 200, 92)


def _ramp(n, angle=0):
    """n×n 0..255 ramp (0 = start colour) at the given angle (degrees, 0 = top→bottom)."""
    g = Image.linear_gradient('L').resize((n * 2, n * 2))
    return g.rotate(angle, resample=Image.BICUBIC).crop((n // 2, n // 2, n // 2 + n, n // 2 + n))


def _fill(n, c1, c2, angle=0):
    return Image.composite(Image.new('RGB', (n, n), c2), Image.new('RGB', (n, n), c1), _ramp(n, angle))


def _gold(n, y0=0.0, y1=1.0):
    """Metallic gold band between y0 and y1 (fractions of n): light → rich → deep, flat outside."""
    a, b = int(n * y0), max(int(n * y0) + 2, int(n * y1))
    h = b - a
    half = Image.linear_gradient('L').resize((n, h // 2 + 1))
    up = Image.composite(Image.new('RGB', half.size, GOLD), Image.new('RGB', half.size, GOLD_LIGHT), half)
    down = Image.composite(Image.new('RGB', half.size, GOLD_DEEP), Image.new('RGB', half.size, GOLD), half)
    out = Image.new('RGB', (n, n), GOLD_LIGHT)
    out.paste(up, (0, a)); out.paste(down, (0, a + h // 2))
    out.paste(Image.new('RGB', (n, max(1, n - b)), GOLD_DEEP), (0, b))
    return out


def _background(n):
    bg = _fill(n, NAVY_A, NAVY_B, angle=45)
    glow = Image.new('L', (n, n), 0)
    ImageDraw.Draw(glow).ellipse((-0.15 * n, -0.55 * n, 0.95 * n, 0.42 * n), fill=120)
    bg.paste(Image.new('RGB', (n, n), GLOW), (0, 0), glow.filter(ImageFilter.GaussianBlur(n * 0.12)))
    return bg.convert('RGBA')


def _spaced(d, text, font, tracking):
    widths = [d.textlength(c, font=font) for c in text]
    return widths, sum(widths) + tracking * (len(text) - 1)


def _mark(n):
    """Transparent layer with the frame, roof, window and text, drawn on an n×n canvas."""
    s = n / 1024.0
    layer = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    gold = _gold(n).convert('RGBA')                          # frame
    roof_gold = _gold(n, 0.25, 0.46).convert('RGBA')         # roof + window: sheen across the mark

    # fine gold frame
    frame = Image.new('L', (n, n), 0)
    fd = ImageDraw.Draw(frame)
    inset, rad = 58 * s, 168 * s
    fd.rounded_rectangle((inset, inset, n - inset, n - inset), radius=rad, outline=185, width=max(1, int(5 * s)))
    layer.paste(gold, (0, 0), frame)

    # metallic gold roof with a soft shadow
    roof = Image.new('L', (n, n), 0)
    rd = ImageDraw.Draw(roof)
    w = int(56 * s)
    pts = [(268 * s, 432 * s), (512 * s, 278 * s), (756 * s, 432 * s)]
    rd.line(pts, fill=255, width=w, joint='curve')
    for x, y in (pts[0], pts[2]):
        rd.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=255)
    shadow = Image.new('RGBA', (n, n), (0, 0, 10, 0))
    shadow.putalpha(roof.point(lambda v: int(v * 0.45)).filter(ImageFilter.GaussianBlur(14 * s)))
    layer.alpha_composite(shadow, (0, int(10 * s)))
    layer.paste(roof_gold, (0, 0), roof)

    # window: a cut diamond, gold edge with a light centre
    cx, cy, r = 512 * s, 384 * s, 40 * s
    dm = Image.new('L', (n, n), 0)
    ImageDraw.Draw(dm).polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=255)
    layer.paste(roof_gold, (0, 0), dm)
    d = ImageDraw.Draw(layer)
    r2 = r * 0.55
    d.polygon([(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)], fill=(255, 250, 230, 255))

    # GOURU — white, slightly tracked, with a soft drop shadow
    tracking = 8 * s
    size = 250
    while True:
        f = ImageFont.truetype(HEAVY[0], int(size * s), index=HEAVY[1])
        widths, tw = _spaced(d, WORD, f, tracking)
        if tw <= 700 * s or size <= 120:
            break
        size -= 4
    box = d.textbbox((0, 0), WORD, font=f)
    th = box[3] - box[1]
    f2 = ImageFont.truetype(DEMI[0], int(50 * s), index=DEMI[1])
    t2 = 13 * s
    w2, sw = _spaced(d, SUB, f2, t2)
    sub_box = d.textbbox((0, 0), SUB, font=f2)
    sub_h = sub_box[3] - sub_box[1]
    space = 58 * s
    top = 486 * s + ((380 * s) - (th + space + sub_h)) / 2

    txt = Image.new('L', (n, n), 0)
    td = ImageDraw.Draw(txt)
    x = (n - tw) / 2
    for c, cw in zip(WORD, widths):
        td.text((x - box[0] * 0, top - box[1]), c, font=f, fill=255)
        x += cw + tracking
    sh = Image.new('RGBA', (n, n), (0, 0, 20, 0))
    sh.putalpha(txt.point(lambda v: int(v * 0.5)).filter(ImageFilter.GaussianBlur(12 * s)))
    layer.alpha_composite(sh, (0, int(9 * s)))
    layer.paste(Image.new('RGBA', (n, n), WHITE + (255,)), (0, 0), txt)

    # VALUATIONS in gold between two thin gold rules
    y = top + th + space
    x = (n - sw) / 2
    for c, cw in zip(SUB, w2):
        d.text((x, y - sub_box[1]), c, font=f2, fill=GOLD_TEXT)
        x += cw + t2
    mid = y + sub_h / 2
    rule, pad = 64 * s, 26 * s
    lw = max(1, int(4 * s))
    d.line([((n - sw) / 2 - pad - rule, mid), ((n - sw) / 2 - pad, mid)], fill=GOLD_TEXT, width=lw)
    d.line([((n + sw) / 2 + pad, mid), ((n + sw) / 2 + pad + rule, mid)], fill=GOLD_TEXT, width=lw)
    return layer


_MASTER = None


def _master():
    """The 2048px icon, drawn once and reused for every size."""
    global _MASTER
    if _MASTER is None:
        _MASTER = _background(2048)
        _MASTER.alpha_composite(_mark(2048))
    return _MASTER


def icon(size, rounded=False):
    """Full-bleed square icon (iOS / Play rounds it themselves); rounded=True for legacy Android."""
    im = _master().resize((size, size), Image.LANCZOS)
    if rounded:
        mask = Image.new('L', (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 * 0.22, fill=255)
        im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


def round_icon(size):
    im = icon(size)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


def adaptive_parts(size):
    """Android adaptive icon: background + foreground. The mark sits in the inner 66% safe zone."""
    n = 2048
    bg = _background(n).resize((size, size), Image.LANCZOS)
    inner = int(n * 0.62)
    mark = _mark(inner)
    fg = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    fg.alpha_composite(mark, ((n - inner) // 2, (n - inner) // 2))
    return bg, fg.resize((size, size), Image.LANCZOS)


def main():
    # iOS (1024, no transparency)
    ios = os.path.join(HERE, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
    icon(1024).convert('RGB').save(ios)
    # Google Play store icon (512, no transparency) + web logo
    os.makedirs(os.path.join(HERE, 'release/store'), exist_ok=True)
    icon(512).convert('RGB').save(os.path.join(HERE, 'release/store/play-icon-512.png'))
    icon(512, rounded=True).save(os.path.join(HERE, 'public/gcr_logo.png'))
    icon(512, rounded=True).save(os.path.join(HERE, 'src/assets/gcr_logo.png'))
    # Android launcher icons
    res = os.path.join(HERE, 'android/app/src/main/res')
    sizes = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
    for dpi, (ic, layer) in sizes.items():
        folder = os.path.join(res, f'mipmap-{dpi}')
        os.makedirs(folder, exist_ok=True)
        icon(ic, rounded=True).save(os.path.join(folder, 'ic_launcher.png'))
        round_icon(ic).save(os.path.join(folder, 'ic_launcher_round.png'))
        bg, fg = adaptive_parts(layer)
        fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))
        if os.path.exists(os.path.join(folder, 'ic_launcher_background.png')):
            bg.save(os.path.join(folder, 'ic_launcher_background.png'))
    # website favicon + home-screen icon
    icon(180).convert('RGB').save(os.path.join(HERE, 'public/apple-touch-icon.png'))
    icon(512, rounded=True).save(os.path.join(HERE, 'public/gcr-logo.png'))
    icon(64, rounded=True).save(os.path.join(HERE, 'public/favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    # launch screens: the logo centred on the screen colour
    logo_cache = {}
    def splash(path):
        old = Image.open(path).convert('RGB')
        w, h = old.size
        bgc = old.getpixel((3, 3))
        side = int(min(w, h) * (0.30 if w < h else 0.36))
        if side not in logo_cache:
            logo_cache[side] = icon(side, rounded=True)
        out = Image.new('RGB', (w, h), bgc)
        out.paste(logo_cache[side], ((w - side) // 2, (h - side) // 2), logo_cache[side])
        out.save(path, optimize=True)
    for root, _, files in os.walk(res):
        for f in files:
            if f == 'splash.png':
                splash(os.path.join(root, f))
    for f in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        p = os.path.join(HERE, 'ios/App/App/Assets.xcassets/Splash.imageset', f)
        out = Image.new('RGB', (2732, 2732), (242, 242, 247))
        lg = logo_cache.setdefault(560, icon(560, rounded=True))
        out.paste(lg, ((2732 - 560) // 2, (2732 - 560) // 2), lg)
        out.save(p, optimize=True)
    print('icons written')


if __name__ == '__main__':
    main()
