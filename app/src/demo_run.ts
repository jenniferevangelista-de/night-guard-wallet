// The measured demo: every scenario through the guardian (several runs, timed), then the on-chain proofs:
// the vault itself refuses scams even if the wallet app were bypassed, the guardian says no on-chain,
// a big payment waits its cooling-off, and a legitimate payment goes out.
// Run in the Codespace:  npm run demo   -> out/results.json and ../docs/RESULTS.md

import { mkdirSync, writeFileSync } from "node:fs";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, Keypair } from "@solana/web3.js";
import { Lang } from "./ai.js";
import { AI, COOLING_OFF_SECS, MODEL } from "./config.js";
import { vaultErrorOf } from "./decode.js";
import { check, Report } from "./guardian.js";
import { qrFor, SCENARIOS } from "./scenarios.js";
import { bookFor } from "./server.js";
import { explorer, fetchVault, ix, listRequests, requestPda, sendTx } from "./vault.js";
import { deployer, kp, loadWorld } from "./world.js";

const RUNS = Number(process.env.RUNS ?? 3);
const w = loadWorld();
const log = (...a: unknown[]) => console.log("[demo]", ...a);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Sends a transaction WITHOUT preflight, so it lands on-chain even if it fails: proof the chain refused it. */
async function landFailing(ixs: TransactionInstruction[], signers: Keypair[]) {
  const latest = await w.conn.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: signers[0].publicKey, recentBlockhash: latest.blockhash, instructions: ixs }).compileToV0Message());
  tx.sign(signers);
  const sig = await w.conn.sendTransaction(tx, { skipPreflight: true });
  const res = await w.conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  const ve = vaultErrorOf(res.value.err);
  return { sig, link: explorer(sig), failed: !!res.value.err, error: ve ? `${ve.code} ${ve.name}: ${ve.msg}` : JSON.stringify(res.value.err) };
}

async function main() {
  const elder = kp("elder"), ana = kp("ana");
  const I = ix(w.conn);
  // keep the demo vault topped up
  const v0 = await fetchVault(w.conn, w.vault);
  if (v0 && v0.available < 1.6 * LAMPORTS_PER_SOL) {
    await sendTx(w.conn, [await I.deposit(deployer().publicKey, elder.publicKey, Math.round(2.0 * LAMPORTS_PER_SOL - v0.available))], [deployer()]);
    log("vault topped up");
  }

  // 1. Guardian checks, RUNS times per scenario and language
  const rows: any[] = [];
  for (const s of SCENARIOS) {
    for (const lang of ["pt", "en"] as Lang[]) {
      const reports: Report[] = [];
      const fast: Report[] = [];
      for (let i = 0; i < RUNS; i++) {
        const { tx } = await s.build(w);
        const inp = { tx, message: s.message[lang], link: s.link ?? qrFor(s, w), lang };
        fast.push(await check(w.conn, await bookFor(w, lang), { ...inp, useModel: false }));
        reports.push(await check(w.conn, await bookFor(w, lang), inp));
      }
      const r = reports[reports.length - 1];
      const row = {
        id: s.id, lang, kind: s.kind, expect: s.expect, verdicts: reports.map((x) => x.verdict),
        fastVerdicts: fast.map((x) => x.verdict), fastVerdictMs: med(fast.map((x) => x.timings.totalMs)),
        correct: reports.every((x) => x.verdict === s.expect) && fast.every((x) => x.verdict === s.expect),
        flags: r.flags.map((f) => `${f.level}:${f.id}`), tactics: r.tactics.map((t) => `${t.id}(${t.by})`),
        explanation: r.explanation.text, explanationBy: r.explanation.by, vaultError: r.simulation.vaultError?.name ?? null,
        median: {
          simulateMs: med(reports.map((x) => x.timings.simulateMs)), lookupsMs: med(reports.map((x) => x.timings.lookupsMs)),
          aiTacticsMs: med(reports.map((x) => x.timings.aiTacticsMs)), aiExplainMs: med(reports.map((x) => x.timings.aiExplainMs)),
          rulesMs: med(reports.map((x) => x.timings.rulesMs)), totalMs: med(reports.map((x) => x.timings.totalMs)),
        },
      };
      rows.push(row);
      log(s.id, lang, row.verdicts.join(","), row.correct ? "OK" : "WRONG", Math.round(row.median.totalMs), "ms", row.flags.join(" "));
    }
  }

  // 2. On-chain proofs
  const proofs: any[] = [];
  const P = (name: string, x: any) => { proofs.push({ name, ...x }); log("PROOF", name, x.failed === undefined ? "" : x.failed ? "refused on-chain" : "landed", x.error ?? "", x.link ?? ""); };

  // a) legit everyday payment goes out at once
  const g = await sendTx(w.conn, [await I.send(elder.publicKey, w.ana, 0.05 * LAMPORTS_PER_SOL)], [elder]);
  P("legit: groceries to Ana, sent at once by the vault", { link: explorer(g.sig), ms: g.ms, failed: false });
  // b) the chain refuses scams even if the wallet app is bypassed
  P("scam: 1.8 SOL to the 'new number' wallet, forced through", await landFailing([await I.send(elder.publicKey, w.fakeRelative, 1.8 * LAMPORTS_PER_SOL)], [elder]));
  P("scam: 0.25 SOL to the look-alike of Ana, forced through", await landFailing([await I.send(elder.publicKey, w.lookalike, 0.25 * LAMPORTS_PER_SOL)], [elder]));
  // c) a scammer can't add their own wallet to the trusted list: the guardian must sign too
  const fake = kp("fakeRelative");
  P("scam: owner + a fake 'guardian' try to trust the scammer", await landFailing([await I.addTrusted(elder.publicKey, fake.publicKey, fake.publicKey)], [elder, fake]));
  // d) request -> guardian says no -> sending is refused on-chain
  let v = await fetchVault(w.conn, w.vault);
  const r1 = await sendTx(w.conn, [await I.request(elder.publicKey, w.fakeRelative, 1.8 * LAMPORTS_PER_SOL, v!.nextRequest, "fake-relative")], [elder]);
  const req1 = requestPda(w.vault, v!.nextRequest);
  P("request opened for the 'new number' (needs the guardian)", { link: explorer(r1.sig), ms: r1.ms, failed: false });
  const d1 = await sendTx(w.conn, [await I.decide(ana.publicKey, elder.publicKey, req1, false)], [ana]);
  P("guardian Ana says NO, signed on-chain", { link: explorer(d1.sig), ms: d1.ms, failed: false });
  P("sending the rejected request anyway", await landFailing([await I.execute(elder.publicKey, req1, w.fakeRelative)], [elder]));
  await sendTx(w.conn, [await I.cancel(elder.publicKey, elder.publicKey, req1)], [elder]);
  // e) big payment to a trusted son: guardian approves, then the cooling-off holds it
  v = await fetchVault(w.conn, w.vault);
  const r2 = await sendTx(w.conn, [await I.request(elder.publicKey, w.pedro, 1.0 * LAMPORTS_PER_SOL, v!.nextRequest, "car-repair")], [elder]);
  const req2 = requestPda(w.vault, v!.nextRequest);
  P("request opened: 1 SOL to Pedro (big amount)", { link: explorer(r2.sig), ms: r2.ms, failed: false });
  const d2 = await sendTx(w.conn, [await I.decide(ana.publicKey, elder.publicKey, req2, true)], [ana]);
  P("guardian Ana approves, signed on-chain", { link: explorer(d2.sig), ms: d2.ms, failed: false });
  P("sending before the cooling-off ends", await landFailing([await I.execute(elder.publicKey, req2, w.pedro)], [elder]));
  const reqs = await listRequests(w.conn, w.vault);
  const wait = Math.max(0, (reqs.find((x) => x.address === req2.toBase58())!.unlockAt - Date.now() / 1000) + 3);
  log(`waiting ${Math.round(wait)} s of cooling-off (${COOLING_OFF_SECS} s in the demo, 24 h in real life)`);
  await new Promise((r) => setTimeout(r, wait * 1000));
  const e2 = await sendTx(w.conn, [await I.execute(elder.publicKey, req2, w.pedro)], [elder]);
  P("after the cooling-off: 1 SOL goes to Pedro", { link: explorer(e2.sig), ms: e2.ms, failed: false });

  // 3. Summary
  const checks = rows.length * RUNS;
  const correct = rows.filter((r) => r.correct).length;
  const scamRows = rows.filter((r) => r.kind === "scam");
  const legitRows = rows.filter((r) => r.kind === "legit");
  const summary = {
    when: new Date().toISOString(), model: AI === "ollama" ? MODEL : "templates", runsPerScenario: RUNS, checks,
    scamsStopped: `${scamRows.filter((r) => r.verdicts.every((v: string) => v === "STOP")).length}/${scamRows.length}`,
    legitLetThrough: `${legitRows.filter((r) => r.verdicts.every((v: string) => v !== "STOP")).length}/${legitRows.length}`,
    verdictsAsExpected: `${correct}/${rows.length}`,
    medianVerdictMs: med(rows.map((r) => r.fastVerdictMs)), maxVerdictMs: Math.max(...rows.map((r) => r.fastVerdictMs)),
    medianTotalMs: med(rows.map((r) => r.median.totalMs)), medianSimulateMs: med(rows.map((r) => r.median.simulateMs)),
    medianAiMs: med(rows.map((r) => r.median.aiTacticsMs + r.median.aiExplainMs)),
    explanationsByModel: `${rows.filter((r) => r.explanationBy === "model").length}/${rows.length}`,
    onchainRefusals: proofs.filter((p) => p.failed).length, medianConfirmMs: med(proofs.filter((p) => p.ms).map((p) => p.ms)),
  };
  mkdirSync("out", { recursive: true });
  writeFileSync("out/results.json", JSON.stringify({ summary, rows, proofs }, null, 2));
  writeFileSync("../docs/RESULTS.md", markdown(summary, rows, proofs));
  log(JSON.stringify(summary, null, 1));
  process.exit(0);
}

function markdown(s: any, rows: any[], proofs: any[]) {
  const ms = (x: number) => `${Math.round(x)} ms`;
  let md = `# Measured results\n\nRun: ${s.when} · Solana devnet · AI: ${s.model} on CPU (Codespace, 4 cores) · ${s.runsPerScenario} runs per scenario and language.\n\n`;
  md += `| Scams stopped | Legit payments let through | Verdicts as expected | Verdict on screen (median) | Simulation on devnet (median) | Gemma reads + explains (median) | Refusals proven on-chain |\n|:-:|:-:|:-:|:-:|:-:|:-:|:-:|\n`;
  md += `| **${s.scamsStopped}** | **${s.legitLetThrough}** | ${s.verdictsAsExpected} | **${ms(s.medianVerdictMs)}** | ${ms(s.medianSimulateMs)} | ${(s.medianAiMs / 1000).toFixed(1)} s | **${s.onchainRefusals}** |\n\n`;
  md += `The verdict comes from the simulation and the rules, so it is on screen before the model answers. Gemma then adds the tricks it finds in the message (it can only add warnings) and writes the plain-language explanation.\n\n`;
  md += `## Every scenario\n\n| Scenario | Lang | Expected | Verdicts (with Gemma) | Flags | Scam tricks found | Vault said | Verdict on screen | Simulation | Gemma |\n|---|---|---|---|---|---|---|--:|--:|--:|\n`;
  for (const r of rows) md += `| ${r.id} | ${r.lang} | ${r.expect} | ${r.verdicts.join(", ")} ${r.correct ? "✅" : "❌"} | ${r.flags.join("<br>")} | ${r.tactics.join(", ") || "none"} | ${r.vaultError ?? "ok"} | ${ms(r.fastVerdictMs)} | ${ms(r.median.simulateMs)} | ${((r.median.aiTacticsMs + r.median.aiExplainMs) / 1000).toFixed(1)} s |\n`;
  md += `\n## What the person reads (last run)\n\n`;
  for (const r of rows) md += `- **${r.id} (${r.lang})**: ${r.explanation} _(${r.explanationBy})_\n`;
  md += `\n## On-chain proofs (devnet)\n\nTransactions sent on purpose without preflight, so the refusal is recorded on Solana.\n\n| Step | Result | Transaction |\n|---|---|---|\n`;
  for (const p of proofs) md += `| ${p.name} | ${p.failed ? `refused: ${p.error}` : `landed${p.ms ? ` (${(p.ms / 1000).toFixed(1)} s)` : ""}`} | [explorer](${p.link}) |\n`;
  return md;
}

main().catch((e) => { console.error(e); process.exit(1); });
export { PublicKey, SystemProgram };
