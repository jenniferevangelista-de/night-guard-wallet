"""Neural voices for the demo's "Listen" button (instead of the browser's robotic voice).
English: Ava (en-US-AvaNeural), the same voice as the video. Portuguese: Francisca (pt-BR-FranciscaNeural).
One mp3 per recorded answer: docs/demo/data/audio/<scenario>_<lang>_<fast|full|phone>.mp3
  python docs/demo/make_audio.py
"""
import asyncio
import json
from pathlib import Path

import edge_tts

DATA = Path(__file__).resolve().parent / "data"
OUT = DATA / "audio"
OUT.mkdir(exist_ok=True)
VOICE = {"en": "en-US-AvaNeural", "pt": "pt-BR-FranciscaNeural"}


async def main():
    n = 0
    for f in sorted(DATA.glob("check_*.json")):
        _, rest = f.stem.split("_", 1)
        sid, lang, kind = rest.rsplit("_", 2)
        r = json.loads(f.read_text(encoding="utf-8"))
        text = f'{r["headline"][lang]} {r["explanation"]["text"]}'
        await edge_tts.Communicate(text, VOICE[lang], rate="-8%").save(str(OUT / f"{sid}_{lang}_{kind}.mp3"))
        n += 1
    print(n, "audio files in", OUT)


asyncio.run(main())
