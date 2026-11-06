"""Olive, the Night Guard Wallet owl. NEW for this project.

A kawaii night owl who guards Lucy's savings: round feathery body, thick outline, big glossy eyes with
golden rings, ear tufts, a watchman cap with the Night Guard moon badge, and a golden vault key.
The beak opens with the loudness of the narration (m = 0..1) and closes in the pauses.
  python video/ng/owl.py   -> video/review/owl_sheet.png
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from palito import dr, font  # noqa: E402

LINE = (40, 30, 70)
FEATHER = (124, 106, 168); FEATHER_D = (92, 76, 136); BELLY = (238, 228, 246); CHEST = (214, 200, 236)
RING = (255, 200, 90); EYE_W = (255, 255, 255); BEAK = (255, 170, 60); BEAK_D = (214, 120, 30)
NAVY = (38, 50, 108); NAVY_D = (26, 34, 78); GOLD = (255, 211, 110); BLUSH = (245, 150, 175, 150); MOUTH = (150, 40, 60)


def _rot_ellipse(cx, cy, rx, ry, ang, n=36):
    c, s_ = math.cos(ang), math.sin(ang)
    return [(cx + rx * math.cos(2 * math.pi * k / n) * c - ry * math.sin(2 * math.pi * k / n) * s_,
             cy + rx * math.cos(2 * math.pi * k / n) * s_ + ry * math.sin(2 * math.pi * k / n) * c) for k in range(n)]


def owl(img, t, cx, by, h=420, m=0.0, mood="talk", wave=0.0, emo="happy", key=True):
    """Draw Olive with her feet at (cx, by).
    m: beak 0..1 · mood: talk | listen | sleep · wave: 0..1 right wing greeting · emo: happy | alarm | proud."""
    SS = 2
    k = SS * h / 420.0
    W_, H_ = int(420 * k), int(440 * k)
    lay = Image.new("RGBA", (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    P = lambda x, y: (x * k, y * k)
    B = lambda x0, y0, x1, y1: (x0 * k, y0 * k, x1 * k, y1 * k)
    lw = max(2, int(7 * k))
    bob = math.sin(dr(t) / 12 * 2.4) * 3
    if emo == "alarm":
        bob += math.sin(t * 40) * 2                                                       # a little shiver

    d.ellipse(B(110, 418, 310, 436), fill=(0, 0, 0, 40))                                   # shadow
    for x0 in (150, 226):                                                                  # orange feet
        for j in range(3):
            d.ellipse(B(x0 + j * 15, 400, x0 + j * 15 + 20, 426), fill=BEAK, outline=LINE, width=max(2, lw // 2))
    # left wing holding the golden vault key
    d.polygon([P(*p) for p in _rot_ellipse(70, 280 + bob, 34, 80, math.radians(18))], fill=FEATHER_D, outline=LINE, width=lw)
    if key:
        kx, ky = 44, 330 + bob
        d.ellipse(B(kx - 22, ky - 22, kx + 22, ky + 22), outline=LINE, width=lw, fill=GOLD)
        d.ellipse(B(kx - 8, ky - 8, kx + 8, ky + 8), fill=(247, 242, 230))
        d.rectangle(B(kx - 5, ky + 18, kx + 5, ky + 74), fill=GOLD, outline=LINE, width=max(2, lw // 2))
        d.rectangle(B(kx + 3, ky + 52, kx + 20, ky + 60), fill=GOLD, outline=LINE, width=max(2, lw // 3))
        d.rectangle(B(kx + 3, ky + 66, kx + 16, ky + 74), fill=GOLD, outline=LINE, width=max(2, lw // 3))
    # right wing: down, or waving hello
    ang = math.radians(-18 + 70 * wave + 16 * wave * math.sin(dr(t) / 12 * 6))
    d.polygon([P(*p) for p in _rot_ellipse(334 + 14 * wave, 270 + bob - 40 * wave, 34, 80, -ang)], fill=FEATHER_D, outline=LINE, width=lw)
    # round body, chest feathers, belly
    d.ellipse(B(58, 104 + bob, 342, 410), fill=FEATHER, outline=LINE, width=lw)
    d.ellipse(B(118, 266 + bob, 282, 402), fill=BELLY)
    for row, y in enumerate((298, 330, 362)):
        for j in range(4 - row % 2):
            x = 146 + j * 34 + (row % 2) * 17
            d.arc(B(x, y + bob, x + 26, y + 18 + bob), 20, 160, fill=CHEST, width=max(2, lw // 2))
    # ear tufts
    for sx in (-1, 1):
        x = 200 + sx * 108
        d.polygon([P(x - sx * 30, 150 + bob), P(x + sx * 18, 66 + bob), P(x + sx * 34, 168 + bob)], fill=FEATHER_D, outline=LINE, width=lw)
    # face disc
    d.ellipse(B(84, 150 + bob, 316, 300 + bob), fill=(232, 222, 244))
    # big eyes with golden rings
    for ex in (148, 252):
        ey = 222 + bob
        d.ellipse(B(ex - 48, ey - 48, ex + 48, ey + 48), fill=RING, outline=LINE, width=lw)
        blink = mood == "sleep" or (t % 4.1) < 0.15
        if blink:
            d.arc(B(ex - 30, ey - 10, ex + 30, ey + 20), 20, 160, fill=LINE, width=lw)
        else:
            r = 34 if emo != "alarm" else 26
            d.ellipse(B(ex - r, ey - r, ex + r, ey + r), fill=LINE)
            d.ellipse(B(ex - 20, ey - 24, ex - 2, ey - 6), fill=EYE_W)
            d.ellipse(B(ex + 8, ey + 8, ex + 16, ey + 16), fill=EYE_W)
        if emo == "alarm":
            sx = -1 if ex < 200 else 1
            d.line([P(ex - sx * 44, 158 + bob), P(ex + sx * 30, 172 + bob)], fill=LINE, width=int(lw * 1.3))
    for x0 in (96, 270):
        d.ellipse(B(x0, 268 + bob, x0 + 34, 284 + bob), fill=BLUSH)
    # beak: two halves that open with the narration
    o = 0.0 if m <= 0.06 or mood == "sleep" else 0.35 + 0.65 * min(1.0, m)
    by0 = 258 + bob
    if o > 0:
        d.ellipse(B(180, by0 + 6, 220, by0 + 16 + 44 * o), fill=MOUTH, outline=LINE, width=max(2, lw // 2))   # open mouth
        d.ellipse(B(190, by0 + 14 + 26 * o, 210, by0 + 12 + 42 * o), fill=(240, 120, 140))                       # tongue
        d.polygon([P(184, by0 + 12 + 40 * o), P(216, by0 + 12 + 40 * o), P(200, by0 + 30 + 40 * o)], fill=BEAK_D, outline=LINE, width=max(2, lw // 2))
    d.polygon([P(176, by0), P(224, by0), P(200, by0 + 30)], fill=BEAK, outline=LINE, width=max(2, lw // 2))
    # watchman cap with the Night Guard moon badge
    d.chord(B(98, 70 + bob, 302, 230 + bob), 180, 360, fill=NAVY, outline=LINE, width=lw)
    d.rounded_rectangle(B(86, 140 + bob, 314, 166 + bob), radius=int(12 * k), fill=NAVY_D, outline=LINE, width=lw)
    d.ellipse(B(180, 90 + bob, 220, 130 + bob), fill=GOLD, outline=LINE, width=max(2, lw // 2))
    d.ellipse(B(192, 86 + bob, 226, 122 + bob), fill=NAVY)
    if emo == "proud":
        for i, (sx, sy) in enumerate(((40, 120), (360, 110), (370, 200))):
            s = 10 + 4 * math.sin(t * 6 + i)
            d.polygon([P(sx, sy - s), P(sx + s / 3, sy - s / 3), P(sx + s, sy), P(sx + s / 3, sy + s / 3), P(sx, sy + s),
                       P(sx - s / 3, sy + s / 3), P(sx - s, sy), P(sx - s / 3, sy - s / 3)], fill=GOLD)
    if mood == "sleep":
        for i in range(3):
            zt = (t * 0.6 + i * 0.33) % 1
            d.text(P(330 + zt * 50, 110 - zt * 90), "z", fill=NAVY, font=font("impact.ttf", int((26 + 22 * zt) * k)), anchor="mm")
    w2, h2 = int(W_ / SS), int(H_ / SS)
    lay = lay.resize((w2, h2), Image.LANCZOS)
    img.paste(lay, (int(cx - w2 / 2), int(by - h2 * 424 / 440)), lay)


if __name__ == "__main__":
    from palito import paper, text
    out = HERE.parent / "review"; out.mkdir(exist_ok=True)
    img = paper().copy()
    d = ImageDraw.Draw(img)
    poses = [("talking", dict(m=0.9)), ("beak closed", dict(m=0.0)), ("hello", dict(m=0.5, wave=1.0)),
             ("alarm!", dict(m=0.7, emo="alarm")), ("proud", dict(m=0.0, emo="proud", t=0.3)), ("asleep", dict(mood="sleep"))]
    for i, (label, kw) in enumerate(poses):
        x = 190 + (i % 3) * 620 + (i // 3) * 0
        y = 470 + (i // 3) * 500
        t = kw.pop("t", 1.0 + i * 0.37)
        owl(img, t, x + 120, y, h=400, **kw)
        text(d, label, x + 120, y + 30, 40)
    text(d, "Olive · Night Guard Wallet", 960, 40, 44)
    img.save(out / "owl_sheet.png")
    print(out / "owl_sheet.png")
