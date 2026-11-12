#!/usr/bin/env python3
"""GCR Valuation app icon (v2): roof + window mark, "GCR" wordmark and a spaced "VALUATION" line.

    python3 make_icon.py            → writes every iOS / Android / Play Store icon

The wordmark and the line below never touch, so the icon stays readable at small sizes.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
HEAVY = ('/System/Library/Fonts/Avenir Next.ttc', 8)   # Avenir Next Heavy
DEMI = ('/System/Library/Fonts/Avenir Next.ttc', 2)    # Avenir Next Demi Bold

TOP, BOTTOM = (37, 99, 235), (30, 58, 138)            # blue gradient
GOLD, CYAN, WHITE, SOFT = (251, 191, 36), (56, 189, 248), (255, 255, 255), (191, 219, 254)


def _background(n):
    bg = Image.new('RGB', (n, n))
    px = bg.load()
    for y in range(n):
        for x in range(n):
            t = min(1.0, max(0.0, (0.75 * y + 0.25 * x) / n))
            px[x, y] = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    glow = Image.new('L', (n, n), 0)
    ImageDraw.Draw(glow).ellipse((-0.2 * n, -0.45 * n, 0.9 * n, 0.45 * n), fill=34)
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.08))
    bg.paste(Image.new('RGB', (n, n), (255, 255, 255)), (0, 0), glow)
    return bg.convert('RGBA')


def _mark(n):
    """Transparent layer with the roof, window and text, drawn on an n×n canvas."""
    layer = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = n / 1024.0
    # roof (rounded chevron)
    w = int(66 * s)
    pts = [(250 * s, 432 * s), (512 * s, 262 * s), (774 * s, 432 * s)]
    d.line(pts, fill=GOLD, width=w, joint='curve')
    for x, y in (pts[0], pts[2]):
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=GOLD)
    # window (diamond)
    cx, cy, r = 512 * s, 392 * s, 46 * s
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=CYAN)
    # GCR
    f = ImageFont.truetype(HEAVY[0], int(292 * s), index=HEAVY[1])
    box = d.textbbox((0, 0), 'GCR', font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((n - tw) / 2 - box[0], 498 * s - box[1]), 'GCR', font=f, fill=WHITE)
    # VALUATION (letter-spaced, clear gap under GCR)
    f2 = ImageFont.truetype(DEMI[0], int(70 * s), index=DEMI[1])
    word, gap = 'VALUATION', 15 * s
    widths = [d.textlength(c, font=f2) for c in word]
    total = sum(widths) + gap * (len(word) - 1)
    x = (n - total) / 2
    y = 498 * s + th + 70 * s
    for c, cw in zip(word, widths):
        d.text((x, y), c, font=f2, fill=SOFT)
        x += cw + gap
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
