// Reads the forced scam transfer (refused on-chain) straight from Solana, for the video's proof card.
// npm run demo first (app/out/results.json), then:  npx tsx src/proof_card.ts  -> ../video/work/proof.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeConnection } from "./rpc.js";

const res = JSON.parse(readFileSync("out/results.json", "utf8"));
const conn = makeConnection();
const out: any[] = [];
for (const p of res.proofs.filter((x: any) => x.failed)) {
  const sig = p.link.split("/tx/")[1].split("?")[0];
  const tx = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  out.push({
    name: p.name, sig, link: p.link, slot: tx?.slot, blockTime: tx?.blockTime, fee: tx?.meta?.fee, err: tx?.meta?.err,
    logs: (tx?.meta?.logMessages ?? []).filter((l) => /Instruction:|AnchorError|failed|consumed/.test(l)),
  });
  console.log(p.name, tx?.slot, JSON.stringify(tx?.meta?.err));
}
mkdirSync("../video/work", { recursive: true });
writeFileSync("../video/work/proof.json", JSON.stringify(out, null, 2));
process.exit(0);
