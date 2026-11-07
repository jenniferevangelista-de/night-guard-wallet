"""Charts for the README, from the measured results (docs/results.json, app/eval/results_gemma4_e2b.json).
  python docs/make_charts.py   -> docs/img/chart_*.png
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img"
OUT.mkdir(parents=True, exist_ok=True)
NAVY, RED, GREEN, PURPLE, AMBER, MUTED, BG = "#0f1b3d", "#b42318", "#1d7a46", "#6941c6", "#c98a00", "#4a5568", "#f6f3ee"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 13, "axes.edgecolor": "#cfc8bb", "axes.labelcolor": NAVY,
                     "xtick.color": NAVY, "ytick.color": NAVY, "figure.facecolor": BG, "axes.facecolor": BG})

res = json.loads((ROOT / "docs" / "results.json").read_text(encoding="utf-8"))
ev = json.loads((ROOT / "app" / "eval" / "results_gemma4_e2b.json").read_text(encoding="utf-8"))["summary"]


def title(ax, t, sub):
    ax.set_title(t, loc="left", fontsize=17, fontweight="bold", color=NAVY, pad=26)
    ax.text(0, 1.02, sub, transform=ax.transAxes, fontsize=11.5, color=MUTED)


def clean(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)


# 1. Who recognises the scam message?
fig, ax = plt.subplots(figsize=(10, 5.0))
groups = [("Fixed rules", ev["rules"]), ("Gemma 4 E2B", ev["gemma"]), ("Rules + Gemma\n(what the app uses)", ev["both"])]
x = range(len(groups))
caught = [g["caught"] / g["scams"] * 100 for _, g in groups]
fa = [g["falseAlarms"] / g["ordinary"] * 100 for _, g in groups]
b1 = ax.bar([i - 0.2 for i in x], caught, 0.38, color=GREEN, label="scam messages caught")
b2 = ax.bar([i + 0.2 for i in x], fa, 0.38, color=RED, label="false alarms on ordinary messages")
for b, (_, g) in zip(b1, groups):
    ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 2, f'{g["caught"]}/{g["scams"]}', ha="center", fontweight="bold", color=GREEN)
for b, (_, g) in zip(b2, groups):
    ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 2, f'{g["falseAlarms"]}/{g["ordinary"]}', ha="center", fontweight="bold", color=RED)
ax.set_xticks(list(x), [n for n, _ in groups])
ax.set_ylim(0, 115); ax.set_ylabel("%")
ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=2, fontsize=11)
title(ax, "Gemma reads the scam story the fixed rules miss", "60 fictional messages (32 scam scripts, 28 ordinary family messages), English + Portuguese, CPU only")
clean(ax); fig.tight_layout(); fig.savefig(OUT / "chart_eval.png", dpi=150); plt.close(fig)

# 2. Speed: the verdict does not wait for the model
rows = [r for r in res["rows"] if r["lang"] == "en"]
names = {"groceries": "Ana: groceries (legit)", "fake-relative": '"Son" with a new number', "fake-support": "Fake wallet support",
         "airdrop-drainer": '"Free airdrop" drainer', "address-poisoning": "Look-alike address (QR)",
         "fake-token-fee": "Fake USDC + fee", "car-repair": "Pedro: car repair (big)"}
fig, ax = plt.subplots(figsize=(10, 5.8))
y = list(range(len(rows)))[::-1]
v = [r["fastVerdictMs"] for r in rows]
sim = [r["median"]["simulateMs"] for r in rows]
ax.barh(y, v, color=NAVY, label="verdict on screen (simulation + rules + look-ups)")
ax.barh(y, sim, color=AMBER, label="of which: simulateTransaction on devnet")
for yi, r, vv in zip(y, rows, v):
    gem = (r["median"]["aiTacticsMs"] + r["median"]["aiExplainMs"]) / 1000
    col = RED if r["kind"] == "scam" else GREEN
    ax.text(vv + 8, yi, f'{vv:.0f} ms  ·  {r["verdicts"][0]}  ·  Gemma explanation +{gem:.0f} s', va="center", fontsize=10.5, color=col)
ax.set_yticks(y, [names[r["id"]] for r in rows])
ax.set_xlim(0, max(v) * 2.35); ax.set_xlabel("milliseconds (median of 3 runs)")
ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.45, -0.14), ncol=2, fontsize=10.5)
title(ax, "The verdict is on screen in a fraction of a second", "Gemma's plain-language explanation arrives after (CPU, no GPU) and can only add warnings")
clean(ax); fig.tight_layout(); fig.savefig(OUT / "chart_speed.png", dpi=150); plt.close(fig)

# 3. Community scam list: weight by number of families
steps = res["summary"]["community"]["steps"]
lv = {"none": (0, "#9aa3b2", "no flag"), "medium": (1, AMBER, "warning"), "high": (2, "#d9480f", "strong"), "critical": (3, RED, "block")}
fig, ax = plt.subplots(figsize=(10, 4.4))
xs = range(len(steps))
for i, st in enumerate(steps):
    h, c, lab = lv[st["level"]]
    ax.bar(i, h + 0.15, 0.6, color=c)
    ax.text(i, h + 0.3, f'{lab}\n{st["reports"]} report{"s" if st["reports"] != 1 else ""}', ha="center", fontsize=11, fontweight="bold", color=c)
ax.set_xticks(list(xs), [s["step"].replace("after one withdrawal", "one family\nwithdraws").replace("before any report", "no report") for s in steps])
ax.set_yticks([]); ax.set_ylim(0, 4.3)
title(ax, "Families protect families, fairly", "Measured on devnet: a report needs on-chain proof, one vote per family; a trusted contact is never blocked by reports")
clean(ax); ax.spines["left"].set_visible(False); fig.tight_layout(); fig.savefig(OUT / "chart_community.png", dpi=150); plt.close(fig)

# 4. On-chain proofs: what the program refused
proofs = res["proofs"]
fig, ax = plt.subplots(figsize=(10, 5.6))
ys = list(range(len(proofs)))[::-1]
for yi, p in zip(ys, proofs):
    c = RED if p["failed"] else GREEN
    ax.scatter(0, yi, s=160, color=c, zorder=3)
    lab = p["name"][0].upper() + p["name"][1:]
    tag = ("REFUSED: " + p["error"].split(":")[0]) if p["failed"] else "landed"
    ax.text(0.04, yi, f"{lab}", va="center", fontsize=10.5, color=NAVY)
    ax.text(1.0, yi, tag, va="center", ha="right", fontsize=10, color=c, fontweight="bold")
ax.set_xlim(-0.03, 1.0); ax.set_ylim(-0.8, len(proofs) - 0.2); ax.axis("off")
title(ax, f'{sum(p["failed"] for p in proofs)} scam attempts refused by the program itself', "Sent on purpose without preflight, so the refusal is recorded on Solana devnet (links in docs/RESULTS.md)")
fig.tight_layout(); fig.savefig(OUT / "chart_onchain.png", dpi=150); plt.close(fig)
print("charts in", OUT)
