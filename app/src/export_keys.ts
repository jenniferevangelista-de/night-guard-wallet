// Writes the deployer and program keypairs derived from NGW_SEED into a folder, for the Solana CLI on a
// GitHub runner. The folder is outside the repo and deleted at the end of the job; never committed or uploaded.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { derived, seedHex } from "./keys.js";

const dir = process.argv[2];
if (!seedHex() || !dir) throw new Error("usage: NGW_SEED=... tsx src/export_keys.ts <dir>");
mkdirSync(dir, { recursive: true });
for (const [file, role] of [["deployer.json", "deployer"], ["guardian_vault-keypair.json", "program"]]) {
  const k = derived(role);
  writeFileSync(join(dir, file), JSON.stringify([...k.secretKey]), { mode: 0o600 });
  console.log(file, k.publicKey.toBase58());
}
