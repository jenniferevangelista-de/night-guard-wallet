"""Builds the Night Guard Wallet video: drawn paper scenes + the real recording in a paper frame, Olive the owl
narrating beside it (her beak follows her own lines), titles, subtitles, Funkorama at 30% and tonal effects
only (pop, chime, swish, tick; no noise). 1920x1080, 24 fps, audio 48 kHz.

Reused from Night Guard (github.com/jenniferevangelista-de/night-guard-switch, video/): palito.py (paper, ink,
fonts), the tour frame and the mix (tour_build.py), the tonal effects (film_audio.py).
  python video/build.py   -> video/out/night_guard_wallet.mp4
Needs: video/work/narration.json + voice/ (script.py), video/work/raw/*.webm + scenes.json + cuts.json
(record_demo.mjs), app/out/results.json, docs/../app/eval/results_gemma4_e2b.json.
"""
import json
import math
import os
import subprocess
import sys
import textwrap
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORK, OUT = HERE / "work", HERE / "out"
sys.path.insert(0, str(HERE / "ng"))
from palito import INK, RED, eout, font, paper, seg, text, wline, wrect  # noqa: E402
from owl import owl  # noqa: E402

W, H, FPS, SR = 1920, 1080, 24, 48000
FX, FY, FW, FH = 40, 108, 1536, 864
NIGHT = (38, 50, 108); SOFT = (120, 112, 125); GREEN = (29, 122, 70); AMBER = (154, 91, 0); PURPLE = (105, 65, 198)
FRAMES = Path(os.environ.get("NGW_FRAMES", "/tmp/ngw/frames"))

narr = json.loads((WORK / "narration.json").read_text(encoding="utf-8"))
RES = json.loads((ROOT / "app" / "out" / "results.json").read_text(encoding="utf-8"))
EVAL = json.loads((ROOT / "app" / "eval" / "results_gemma4_e2b.json").read_text(encoding="utf-8"))["summary"]


def _dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout)


# ---------------------------------------------------------------- the recording, with the long waits cut out
scenes = {s["key"]: s for s in json.loads((WORK / "scenes.json").read_text())}
narr = [n for n in narr if n["kind"] != "rec" or n["id"] in scenes]      # a scene missing from a test recording
cuts = json.loads((WORK / "cuts.json").read_text())
raw = sorted((WORK / "raw").glob("*.webm"))[0]
rec_keys = [n["id"] for n in narr if n["kind"] == "rec"]
begin = scenes[rec_keys[0]]["start"] - 0.2
end_t = min(_dur(raw), scenes[rec_keys[-1]]["end"] + 0.3)
keep, t = [], begin
for a, b in sorted(cuts):
    if a > t:
        keep.append((t, a))
    t = max(t, b)
keep.append((t, end_t))


def new_time(x):
    return sum(max(0.0, min(x, b) - a) for a, b in keep)


def cut_recording():
    FRAMES.mkdir(parents=True, exist_ok=True)
    if any(FRAMES.glob("*.jpg")):
        return
    select = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in keep)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf",
                    f"fps={FPS},select='{select}',setpts=N/{FPS}/TB,scale={FW}:{FH}:flags=lanczos",
                    "-q:v", "3", str(FRAMES / "%05d.jpg")], check=True)


# ---------------------------------------------------------------- timeline
TL = []
t = 0.0
for n in narr:
    d = n["dur"]
    item = {**n, "t0": t}
    if n["kind"] == "rec":
        s = scenes[n["id"]]
        v0, v1 = new_time(s["start"]), new_time(s["end"])
        rec_len = max(0.5, v1 - v0)
        speed = min(2.2, max(1.0, rec_len / (d + 0.8)))
        item.update(v0=v0, v1=v1, speed=speed)
        seg_len = max(d + 0.8, rec_len / speed)
    else:
        seg_len = d + 1.0 + (2.5 if n["id"] in ("numbers", "end") else 0.0)
    item["t1"] = t + seg_len
    TL.append(item)
    t += seg_len
DUR = round(t + 1.0, 2)


def at(tt):
    for it in TL:
        if it["t0"] <= tt < it["t1"]:
            return it
    return TL[-1]


# ---------------------------------------------------------------- voices: mouth + subtitles
def load(p):
    tmp = WORK / f"_tmp_{os.getpid()}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-ac", "1", "-ar", str(SR), str(tmp)], check=True)
    a, _ = sf.read(tmp, dtype="float64"); tmp.unlink(); return a


@lru_cache(maxsize=32)
def env(path):
    a = load(path); hop = SR // 24
    r = np.array([np.sqrt(np.mean(a[j:j + hop] ** 2)) for j in range(0, len(a), hop)])
    return (r / (r.max() or 1)).tolist()


def beak(tt):
    """Olive's beak follows the loudness of her own lines; closed in the pauses and while Jennifer speaks."""
    it = at(tt)
    rel = tt - it["t0"]
    if it["who"] != "olive" or rel < 0 or rel > it["dur"]:
        return None if it["who"] != "olive" else 0.0
    e = env(str(WORK / it["voice"])); k = int(rel * 24)
    m = e[k] if 0 <= k < len(e) else 0.0
    return 0.0 if m < 0.12 else min(1.0, m * 1.25)


def subs():
    out = []
    for it in TL:
        line = it["line"]
        parts = [p.strip() for p in line.replace(": ", ":|").replace(". ", ".|").replace("? ", "?|").replace("! ", "!|").split("|") if p.strip()]
        total = sum(len(p) for p in parts); t0 = it["t0"]
        for p in parts:
            d = it["dur"] * len(p) / total; out.append((t0, t0 + d + 0.15, p)); t0 += d
    return out


SUBS = subs()


def subtitle(d, tt, cx, bottom, width=1500):
    for a, b, s in SUBS:
        if a <= tt < b:
            f = font("segoeprb.ttf", 38)
            lines = textwrap.wrap(s, 70) if d.textlength(s, font=f) > width else [s]
            hh = 54 * len(lines); y0 = bottom - hh
            mw = max(d.textlength(ln, font=f) for ln in lines)
            d.rounded_rectangle((cx - mw / 2 - 22, y0 - 8, cx + mw / 2 + 22, y0 + hh + 4), 16, fill=(255, 251, 240, 235))
            for i, ln in enumerate(lines):
                text(d, ln, cx, y0 + 25 + i * 54, 38, INK)
            return


# ---------------------------------------------------------------- recording frame
@lru_cache(maxsize=1)
def rec_base():
    im = paper().copy().convert("RGBA")
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.rounded_rectangle((FX + 10, FY + 14, FX + FW + 10, FY + FH + 14), 22, fill=(60, 50, 40, 70))
    im = Image.alpha_composite(im, sh)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((FX - 8, FY - 8, FX + FW + 8, FY + FH + 8), 26, fill=(34, 30, 38, 255))
    text(d, "Night Guard Wallet · a real run on Solana devnet · every person and message is fictional", FX + FW / 2, FY - 52, 32, SOFT)
    return im


def rec_frame(tt, it):
    im = rec_base().copy()
    rel = tt - it["t0"]
    vt = min(it["v1"], it["v0"] + rel * it["speed"])
    idx = min(int(vt * FPS) + 1, N_FRAMES)
    shot = Image.open(FRAMES / f"{idx:05d}.jpg").convert("RGB")
    mask = Image.new("L", (FW, FH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, FW, FH), 18, fill=255)
    im.paste(shot, (FX, FY), mask)
    d = ImageDraw.Draw(im)
    cx = (FX + FW + W) / 2
    recs = [x for x in TL if x["kind"] == "rec"]
    text(d, f"{recs.index(it) + 1}/{len(recs)}", cx, 150, 40, SOFT)
    for i, ln in enumerate(textwrap.wrap(it["title"], 10)):
        text(d, ln, cx, 220 + i * 66, 58, NIGHT, "mm", "impact.ttf")
    m = beak(tt)
    owl(im, tt, cx, 1000, 330, m or 0.0, "talk" if m is not None else "listen", emo="alarm" if it["id"] in ("relative", "others") and rel < 3 else "happy")
    d = ImageDraw.Draw(im)
    subtitle(d, tt, FX + FW / 2, FY + FH - 30)
    return im


# ---------------------------------------------------------------- paper scenes
def card(d, x, y, w, h, k, big, small, col, seed, tt):
    if k <= 0:
        return
    yy = y + (1 - eout(k)) * 60
    d.rounded_rectangle((x, yy, x + w, yy + h), 24, fill=(255, 255, 255))
    wrect(d, x, yy, x + w, yy + h, tt, seed, 6, col)
    size = int(h * 0.36)
    while size > 30 and d.textlength(big, font=font("impact.ttf", size)) > w - 50:
        size -= 4
    text(d, big, x + w / 2, yy + h * 0.40, size, col, "mm", "impact.ttf")
    for i, ln in enumerate(textwrap.wrap(small, 24)):
        text(d, ln, x + w / 2, yy + h * 0.70 + i * 36, 29, INK)


def stamp(im, s, cx, cy, ang, col=RED, size=70):
    f = font("impact.ttf", size)
    tw = int(ImageDraw.Draw(im).textlength(s, font=f)) + 60
    lay = Image.new("RGBA", (tw, size + 50), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((4, 4, tw - 4, size + 46), 14, outline=col + (230,), width=8)
    d.text((tw / 2, (size + 50) / 2), s, font=f, fill=col + (230,), anchor="mm")
    lay = lay.rotate(ang, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))


@lru_cache(maxsize=4)
def taped(path, w):
    sh = Image.open(path).convert("RGB")
    sh = ImageOps.fit(sh, (w, int(w * sh.height / sh.width)))
    return sh


def paper_frame(tt, it):
    im = paper().copy().convert("RGBA"); d = ImageDraw.Draw(im)
    rel = tt - it["t0"]; dur = it["dur"]
    m = beak(tt)
    key = it["id"]
    if key == "hello":
        k = seg(rel, 0, 0.8)
        d.ellipse((900, 170, 1020, 290), fill=(255, 211, 110)); d.ellipse((930, 160, 1040, 270), fill=(247, 242, 230))
        text(d, "Night Guard Wallet", 960, 400 - (1 - eout(k)) * 40, 120, NIGHT, "mm", "impact.ttf")
        text(d, "a guard for our parents' and grandparents' crypto", 960, 510, 50, INK)
        text(d, "Jennifer Evangelista · MLH Solana Hackathon · November 2026", 960, 590, 34, SOFT)
        owl(im, tt, 960, 1000, 300, 0.0, "sleep" if rel < dur * 0.6 else "listen")
    elif key == "problem":
        text(d, "People over 60, in 2025 (FBI IC3)", 960, 120, 56, NIGHT, "mm", "impact.ttf")
        card(d, 140, 210, 500, 320, seg(rel, 0.3, 0.9), "$7.7 billion", "reported lost to fraud", RED, 11, tt)
        card(d, 710, 210, 500, 320, seg(rel, dur * 0.35, dur * 0.35 + 0.6), "$4.3 billion", "of it involved crypto", RED, 12, tt)
        card(d, 1280, 210, 500, 320, seg(rel, dur * 0.35 + 0.8, dur * 0.35 + 1.4), "$38,500", "average loss per victim", RED, 13, tt)
        if rel > dur * 0.75:
            stamp(im, "ONE SIGNATURE CAN'T BE UNDONE", 960, 760, 3, RED, 64)
        text(d, "Source: FBI IC3, 2025 Internet Crime Report, Elder Fraud section", 960, 580, 30, SOFT)
    elif key == "olive":
        owl(im, tt, 960, 900, 560, m or 0.0, "talk", wave=1.0 if rel < 2.5 else 0.0)
        text(d, "Olive", 960, 120, 90, PURPLE, "mm", "impact.ttf")
        text(d, "Night Guard's owl · she reads every transaction before Lucy signs", 960, 200, 40, INK)
    elif key == "how":
        steps = [("1  Simulate", "on Solana devnet:\nwhat really changes", NIGHT), ("2  Risk rules", "drainers, look-alikes,\nnew wallets", RED),
                 ("3  Gemma reads", "the message and\nquotes the tricks", PURPLE), ("4  Vault program", "rules on-chain that\nno one can switch off", GREEN)]
        for i, (big, small, col) in enumerate(steps):
            k = seg(rel, 0.2 + i * dur / 4.4, 0.8 + i * dur / 4.4)
            if k <= 0:
                continue
            x = 50 + i * 455; y = 220 + (1 - eout(k)) * 60
            d.rounded_rectangle((x, y, x + 420, y + 300), 24, fill=(255, 255, 255)); wrect(d, x, y, x + 420, y + 300, tt, 40 + i, 6, col)
            text(d, big, x + 210, y + 70, 50, col, "mm", "impact.ttf")
            for j, ln in enumerate(small.split("\n")):
                text(d, ln, x + 210, y + 165 + j * 46, 32, INK)
        text(d, "Before Lucy signs", 960, 130, 64, NIGHT, "mm", "impact.ttf")
        owl(im, tt, 1700, 1000, 330, m or 0.0, "talk")
    elif key == "proof":
        P = json.loads((WORK / "proof.json").read_text())
        pr = next(x for x in P if "new number" in x["name"])
        k = eout(seg(rel, 0.1, 0.8))
        x0, y0 = 90, 190 + (1 - k) * 60
        d.rounded_rectangle((x0, y0, x0 + 1300, y0 + 700), 20, fill=(255, 255, 255)); wrect(d, x0, y0, x0 + 1300, y0 + 700, tt, 77, 6, NIGHT)
        for (x, y) in ((x0 + 60, y0), (x0 + 1140, y0)):
            d.rectangle((x, y - 18, x + 120, y + 18), fill=(240, 226, 170))
        text(d, "Transaction on Solana devnet, read back from the chain", x0 + 40, y0 + 60, 40, NIGHT, "lm", "impact.ttf")
        rows_ = [("Signature", pr["sig"][:44] + "…"), ("Slot", f'{pr["slot"]:,}'), ("What", "vault send · 1.8 SOL → the \"new number\" wallet · forced, no preflight"),
                 ("Status", "FAILED"), ("Program", "guardian_vault  8vE76ymUvgkQ…YymSpSkf3hwtn")]
        for i, (a_, b_) in enumerate(rows_):
            text(d, a_, x0 + 40, y0 + 140 + i * 58, 32, SOFT, "lm", "segoeuib.ttf")
            text(d, b_, x0 + 260, y0 + 140 + i * 58, 32, RED if a_ == "Status" else INK, "lm", "segoeuib.ttf" if a_ == "Status" else "segoeui.ttf")
        logs = [l for l in pr["logs"] if "AnchorError" in l][:1]
        if logs:
            for i, ln in enumerate(textwrap.wrap(logs[0].replace("Program log: ", ""), 78)[:4]):
                text(d, ln, x0 + 40, y0 + 460 + i * 44, 28, INK, "lm", "segoeui.ttf")
        text(d, "explorer.solana.com/tx/" + pr["sig"][:20] + "…?cluster=devnet", x0 + 40, y0 + 660, 26, PURPLE, "lm", "segoeui.ttf")
        text(d, "Forced through on purpose: the program says no", 760, 110, 50, NIGHT, "mm", "impact.ttf")
        if rel > 1.4:
            stamp(im, "REFUSED ON-CHAIN: NotTrusted", 1080, 830, -5, RED, 50)
        owl(im, tt, 1700, 1000, 340, m or 0.0, "talk", emo="proud" if rel > dur * 0.7 else "happy")
    elif key == "numbers":
        s = RES["summary"]
        cells = [(s["scamsStopped"], "scam scenarios stopped", RED), (s["legitLetThrough"], "real payments through", GREEN),
                 (f'{s["medianVerdictMs"] / 1000:.1f} s', "verdict on screen (median)", NIGHT),
                 (f'{EVAL["gemma"]["caught"]}/{EVAL["gemma"]["scams"]}', "scam messages Gemma caught", PURPLE),
                 (f'{EVAL["gemma"]["falseAlarms"]}/{EVAL["gemma"]["ordinary"]}', "false alarms", PURPLE),
                 (str(s["onchainRefusals"]), "refusals proven on-chain", NIGHT)]
        text(d, "Measured, not promised", 760, 110, 64, NIGHT, "mm", "impact.ttf")
        for i, (big, small, col) in enumerate(cells):
            k = seg(rel, 0.3 + i * 0.9, 0.9 + i * 0.9)
            card(d, 70 + (i % 3) * 470, 200 + (i // 3) * 380, 430, 330, k, big, small, col, 60 + i, tt)
        owl(im, tt, 1720, 1000, 330, m or 0.0, "talk", emo="proud")
    elif key == "end":
        text(d, "Night Guard Wallet", 960, 260, 110, NIGHT, "mm", "impact.ttf")
        text(d, "Solana does the guarding · AI does the explaining · the family stays in the loop", 960, 380, 42, INK)
        text(d, "github.com/jenniferevangelista-de/night-guard-wallet", 960, 470, 40, PURPLE)
        text(d, "Gemma 4 via Ollama · Anchor · Solana devnet · built during the MLH Solana Hackathon", 960, 540, 32, SOFT)
        owl(im, tt, 960, 1010, 380, 0.0, "listen" if rel < dur + 0.5 else "sleep", wave=1.0 if rel > dur * 0.5 else 0.0)
    d = ImageDraw.Draw(im)
    subtitle(d, tt, 960, 1060 if key not in ("hello", "end", "olive") else 1060)
    return im


def frame(tt):
    it = at(tt)
    return rec_frame(tt, it) if it["kind"] == "rec" else paper_frame(tt, it)


# ---------------------------------------------------------------- sound: voices, Funkorama 30% ducked, tonal effects only
def tt_(d): return np.arange(int(d * SR)) / SR
def pop(): t = tt_(0.18); return np.sin(2 * np.pi * (700 + 900 * t) * t) * np.exp(-t * 28) * 0.5
def chime(f0=1320): t = tt_(0.6); return sum(np.sin(2 * np.pi * f0 * m * t) / m for m in (1, 2, 3)) * np.exp(-t * 5) * 0.25
def swish(): t = tt_(0.25); f = 500 + 1500 * t / 0.25; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.25) ** 2 * 0.22
def thud(): t = tt_(0.35); return np.sin(2 * np.pi * (90 + 120 * np.exp(-t * 25)) * t) * np.exp(-t * 12)


def mix():
    N = int(DUR * SR); voice = np.zeros(N); fx = np.zeros(N)

    def add(buf, t0, a, g=1.0):
        i = int(t0 * SR)
        if i >= N: return
        j = min(N, i + len(a)); buf[i:j] += a[: j - i] * g
    for it in TL:
        a = load(WORK / it["voice"]); add(voice, it["t0"], a / (np.abs(a).max() + 1e-9) * 0.9)
        add(fx, max(0, it["t0"] - 0.15), swish(), 0.6)
        if it["id"] == "problem":
            for k in (0.3, it["dur"] * 0.35, it["dur"] * 0.35 + 0.8): add(fx, it["t0"] + k, pop(), 0.8)
            add(fx, it["t0"] + it["dur"] * 0.75, thud(), 0.7)
        if it["id"] == "how":
            for i in range(4): add(fx, it["t0"] + 0.2 + i * it["dur"] / 4.4, pop(), 0.7)
        if it["id"] == "numbers":
            for i in range(6): add(fx, it["t0"] + 0.3 + i * 0.9, chime(1320 if i % 2 else 1568), 0.8)
        if it["id"] == "proof":
            add(fx, it["t0"] + 1.2, thud(), 0.8)
    music = load(HERE / "ng" / "music" / "Funkorama.mp3")
    while len(music) < N: music = np.concatenate([music, music])
    music = music[:N] / (np.abs(music).max() + 1e-9)
    kern = SR // 4; c = np.cumsum(np.concatenate([np.zeros(kern), (np.abs(voice) > 0.02).astype(float)]))
    duck = 1 - 0.65 * np.clip((c[kern:] - c[:-kern]) / kern * 3, 0, 1)
    fade = np.ones(N); fade[int((DUR - 2) * SR):] = np.linspace(1, 0, N - int((DUR - 2) * SR))
    out = voice + music * 0.30 * duck * fade + fx
    out = np.tanh(out * 0.9) / np.tanh(0.9); out = out / np.abs(out).max() * 0.95
    sf.write(WORK / "_mix.wav", np.stack([out, out], 1), SR)


def job(i):
    return frame(i / FPS).convert("RGB").tobytes()


N_FRAMES = 0
if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    cut_recording()
    N_FRAMES = len(list(FRAMES.glob("*.jpg")))
    print("timeline", DUR, "s;", N_FRAMES, "recording frames")
    mix()
    if len(sys.argv) > 1 and sys.argv[1] == "--stills":     # a few frames to look at before rendering
        (HERE / "review").mkdir(exist_ok=True)
        for it in TL:
            tt = it["t0"] + min(it["dur"] * 0.6, (it["t1"] - it["t0"]) - 0.2)
            frame(tt).convert("RGB").save(HERE / "review" / f"frame_{it['id']}.jpg", quality=88)
        print("stills in video/review"); sys.exit(0)
    dst = OUT / "night_guard_wallet.mp4"
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-i", str(WORK / "_mix.wav"), "-map", "0:v", "-map", "1:a", "-t", str(DUR),
                           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-ar", "48000", "-b:a", "192k", str(dst)], stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    with Pool(4) as pool:                  # in batches, so finished frames never pile up in memory
        for start in range(0, total, 48):
            for b in pool.map(job, range(start, min(total, start + 48)), chunksize=6):
                ff.stdin.write(b)
    ff.stdin.close(); ff.wait()
    print("done", dst, DUR, "s")
