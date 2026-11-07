// Moves demo SOL that piled up (Pedro's car-repair payments, the archived family) back to the deployer.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { KEY_DIR } from "./config.js";
import { makeConnection } from "./rpc.js";
import { sendTx } from "./vault.js";
import { deployer, kp } from "./world.js";
import { seedHex } from "./keys.js";

const conn = makeConnection();
const to = deployer().publicKey;
const keep = 0.01 * LAMPORTS_PER_SOL;
if (seedHex()) {
  const p = kp("pedro");
  const bal = await conn.getBalance(p.publicKey);
  if (bal > keep + 0.05 * LAMPORTS_PER_SOL) {
    const r = await sendTx(conn, [SystemProgram.transfer({ fromPubkey: p.publicKey, toPubkey: to, lamports: bal - keep })], [p]);
    console.log("pedro", ((bal - keep) / LAMPORTS_PER_SOL).toFixed(3), "SOL back", r.sig.slice(0, 12));
  }
}
for (const [dir, roles] of [["demo", ["pedro"]], ["demo_v1", ["pedro", "elder", "ana"]]] as const) {
  for (const role of roles) {
    const f = join(KEY_DIR, dir, `${role}.json`);
    if (!existsSync(f)) continue;
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(f, "utf8"))));
    const bal = await conn.getBalance(kp.publicKey);
    if (bal > keep + 0.05 * LAMPORTS_PER_SOL) {
      const r = await sendTx(conn, [SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: to, lamports: bal - keep })], [kp]);
      console.log(dir, role, ((bal - keep) / LAMPORTS_PER_SOL).toFixed(3), "SOL back", r.sig.slice(0, 12));
    }
  }
}
console.log("deployer", (await conn.getBalance(to)) / LAMPORTS_PER_SOL, "SOL");
process.exit(0);
