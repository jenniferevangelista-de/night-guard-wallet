"""Narration of the Night Guard Wallet video, and the voices (edge-tts, Ava).

Jennifer opens and closes as herself (Ava, first person). Olive, the owl, tells the rest (Ava, faster and
higher). Every number is measured (docs/RESULTS.md, docs/EVAL.md) or from the FBI IC3 2025 report.
  python video/script.py   -> video/work/voice/*.mp3 + video/work/narration.json
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
VOICE = "en-US-AvaNeural"   # English-only Ava: the multilingual voice read the name with a Spanish accent
STYLE = {"jennifer": dict(rate="-4%", pitch="+0Hz"), "olive": dict(rate="+6%", pitch="+16Hz")}

# kind: paper (drawn scene) or rec (the real recording, key = scene in video/work/scenes.json)
LINES = [
    ("hello", "paper", "jennifer", "Night Guard Wallet",
     "Hi, I'm Jennifer Evangelista. This is Night Guard Wallet: a guard for the people scammers target the most, our parents and grandparents. And it protects the rest of us, too."),
    ("problem", "paper", "jennifer", "The problem",
     "In 2025, people over sixty reported seven point seven billion dollars lost to fraud, to the FBI. Four point three billion involved crypto. And on a blockchain, one signature can't be undone."),
    ("olive", "paper", "olive", "Meet Olive",
     "Hi! I'm Olive, the wallet's owl. I look at every transaction before Lucy signs it, and I tell her what it really does, in plain words."),
    ("how", "paper", "olive", "How it works",
     "First, I simulate it on Solana, so I see exactly what would change. Then I check where every part comes from: the sender, the link, the wallet, the program and the token. Gemma, running with Ollama on our own machine, reads the message. And a vault program on Solana keeps the rules that nobody can switch off."),
    ("wallet", "rec", "olive", "Lucy's wallet",
     "This is Lucy's wallet, live on devnet. Her savings sit in the vault. Only Ana and Pedro are trusted, and there's a daily limit."),
    ("relative", "rec", "olive", "The new number",
     "A message from a new number asks for one point eight SOL, urgently, and says: don't tell dad. Stop! It's not a saved contact, the wallet is brand new, and the vault itself refuses it. Gemma quotes the tricks: a new number, a rush, a secret."),
    ("askana", "rec", "olive", "Ask Ana",
     "Lucy doesn't have to decide alone. One tap opens a request on chain, and Ana is told right away."),
    ("ana", "rec", "olive", "Ana decides",
     "Ana sees why it was blocked, read straight from Solana. She says no with her own signature, and reports that wallet to every family."),
    ("community", "rec", "olive", "Families protect families",
     "Now that wallet is on a public scam list on Solana. Any family using Night Guard gets the warning before signing. One family's no protects every family."),
    ("others", "rec", "olive", "Four more scams",
     "Fake wallet support that wants her token account. A free airdrop that is really an unlimited approval. A look-alike of Ana's address. A fake USDC with a fee to unlock it. All stopped, each with its reason."),
    ("groceries", "rec", "olive", "The real Ana",
     "And when it's really Ana asking for the grocery money, it goes through at once."),
    ("car", "rec", "olive", "Big amounts wait",
     "A big amount for Pedro needs Ana's yes, then waits a cooling-off period on chain. Only then is it sent."),
    ("proof", "paper", "olive", "The chain says no",
     "Even if someone gets around this app, the program still refuses. Here is a transfer to the scammer, forced through on purpose. It failed on chain: not on the trusted list."),
    ("numbers", "paper", "olive", "Measured",
     "Five out of five scams stopped, and both real payments went through. The verdict shows in under a second. And Gemma recognised thirty two out of thirty two scam messages, with zero false alarms."),
    ("end", "paper", "jennifer", "Thank you",
     "Night Guard Wallet. Solana does the guarding, AI does the explaining, and families protect each other. Thank you!"),
]


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout)


async def main():
    (WORK / "voice").mkdir(parents=True, exist_ok=True)
    out = []
    for key, kind, who, title, line in LINES:
        p = WORK / "voice" / f"{key}.mp3"
        await edge_tts.Communicate(line, VOICE, **STYLE[who]).save(str(p))
        out.append({"id": key, "kind": kind, "who": who, "title": title, "line": line, "voice": f"voice/{key}.mp3", "dur": round(dur(p), 2)})
        print(key, who, out[-1]["dur"], "s")
    (WORK / "narration.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("total", round(sum(o["dur"] for o in out), 1), "s")


if __name__ == "__main__":
    asyncio.run(main())
