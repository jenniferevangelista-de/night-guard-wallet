// Demo keypairs derived from one secret seed (NGW_SEED, 64 hex chars), so a fresh machine, such as a
// GitHub Actions runner, rebuilds the same devnet family without any key file. The seed is never in the repo.
// Without NGW_SEED, keys come from files in ~/.config/ngw/demo (see world.ts).

import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { Keypair } from "@solana/web3.js";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export const seedHex = () => process.env.NGW_SEED?.trim() || null;

export function roleSeed(role: string, i?: number): Buffer {
  return createHash("sha256").update(`${seedHex()}:${role}${i === undefined ? "" : ":" + i}`).digest();
}

export function derived(role: string, i?: number): Keypair {
  return Keypair.fromSeed(roleSeed(role, i));
}

/** Public key of an ed25519 seed with Node's native crypto (much faster than tweetnacl, for grinding). */
export function fastPub(seed: Buffer): Buffer {
  const k = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
  return createPublicKey(k).export({ format: "der", type: "spki" }).subarray(-32) as Buffer;
}

const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58(b: Buffer): string {
  let n = BigInt("0x" + (b.toString("hex") || "0"));
  let s = "";
  while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x === 0) s = "1" + s; else break; }
  return s;
}

/** Address poisoning, deterministic: the first index whose address starts with the same 4 characters as `target`. */
export function grindLookalike(target: string, start = 0): number {
  const prefix = target.slice(0, 4);
  for (let i = start; ; i++) {
    if (b58(fastPub(roleSeed("lookalike", i))).startsWith(prefix)) return i;
  }
}
