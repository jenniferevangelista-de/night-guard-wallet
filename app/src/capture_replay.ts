// Records the real answers of the running server (devnet + Gemma) for the interactive web replay.
// Server must be running on :8787.  npx tsx src/capture_replay.ts  -> ../docs/demo/data/*.json
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.NGW_URL ?? "http://localhost:8787";
const OUT = "../docs/demo/data";
mkdirSync(OUT, { recursive: true });
const get = async (p: string) => (await fetch(BASE + p)).json();
const post = async (p: string, b: unknown) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const save = (name: string, data: unknown) => writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

const scenarios = await get("/api/scenarios");
save("scenarios", scenarios);
for (const lang of ["en", "pt"]) {
  save(`state_${lang}`, await get(`/api/state?lang=${lang}`));
  for (const s of scenarios) {
    const fast = await post("/api/check", { id: s.id, lang });
    const full = await post("/api/check", { id: s.id, lang, ai: true });
    save(`check_${s.id}_${lang}_fast`, fast);
    save(`check_${s.id}_${lang}_full`, full);
    console.log(lang, s.id, fast.verdict, full.verdict, full.explanation?.by, Math.round(full.timings?.totalMs ?? 0), "ms");
    save(`check_${s.id}_${lang}_phone`, await post("/api/check", { id: s.id, lang, phoneMode: true }));
  }
}
save("captured", { when: new Date().toISOString() });
process.exit(0);
