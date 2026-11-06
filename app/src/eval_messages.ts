// How well are scam messages recognised? Fixed rules alone, Gemma alone, and both (what the app uses).
// 60 fictional messages (eval/messages.jsonl): 32 scam scripts and 28 ordinary family messages, PT and EN.
// Run in the Codespace:  npm run eval      (NGW_MODEL=gemma3:4b npm run eval  to compare models)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { modelTactics, ruleTactics } from "./ai.js";
import { MODEL } from "./config.js";

const rows = readFileSync("eval/messages.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const out: any[] = [];
for (const r of rows) {
  const rules = ruleTactics(r.text);
  const m = await modelTactics(r.text);
  const both = new Set([...rules.map((x) => x.id), ...m.found.map((x) => x.id)]);
  out.push({ id: r.id, lang: r.lang, scam: r.scam, rules: rules.map((x) => x.id), model: m.found.map((x) => `${x.id}:${x.quote}`), modelUsed: m.used, ms: Math.round(m.ms), both: [...both] });
  console.log(r.id, r.scam ? "SCAM" : "ok  ", "rules:", rules.map((x) => x.id).join(",") || "-", "| gemma:", m.found.map((x) => x.id).join(",") || "-", Math.round(m.ms), "ms");
}
const score = (pred: (o: any) => boolean) => {
  const scams = out.filter((o) => o.scam), ok = out.filter((o) => !o.scam);
  return { caught: scams.filter(pred).length, scams: scams.length, falseAlarms: ok.filter(pred).length, ordinary: ok.length };
};
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = {
  model: MODEL, when: new Date().toISOString(),
  rules: score((o) => o.rules.length > 0),
  gemma: score((o) => o.model.length > 0),
  both: score((o) => o.both.length > 0),
  bothTwoTricks: score((o) => o.both.length >= 2),
  medianGemmaMs: med(out.map((o) => o.ms)),
  gemmaAnswered: out.filter((o) => o.modelUsed).length,
};
console.log(JSON.stringify(summary, null, 1));
mkdirSync("out", { recursive: true });
const tag = MODEL.replace(/[:/]/g, "_");
writeFileSync(`out/eval_${tag}.json`, JSON.stringify({ summary, rows: out }, null, 2));
process.exit(0);
