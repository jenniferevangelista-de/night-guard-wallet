// The demo family on devnet. Keys are created by setup.ts in ~/.config/ngw/demo (never in the repo).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { DEMO_DIR, KEY_DIR } from "./config.js";
import { makeConnection } from "./rpc.js";
import { derived, seedHex } from "./keys.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { addVerifiedToken } from "./known.js";
import { vaultPda } from "./vault.js";

export const ROLES = ["elder", "ana", "pedro", "fakeRelative", "fakeSupport", "drainer", "feeScammer"] as const;
export type Role = (typeof ROLES)[number] | "lookalike";

export const PEOPLE = {
  elder: { pt: "Dona Lúcia, 74 anos", en: "Lucy, 74" },
  ana: { pt: "Ana (filha, guardiã)", en: "Ana (daughter, guardian)" },
  pedro: { pt: "Pedro (filho)", en: "Pedro (son)" },
};

export interface WorldFile { nusdMint?: string; fakeUsdcMint?: string; elderNusd?: string; history?: { to: string; lamports: number; sig: string }[] }

export function kp(role: Role): Keypair {
  if (seedHex() && role !== "lookalike") return derived(role);   // NGW_SEED: every key comes from the secret seed
  const p = join(DEMO_DIR, `${role}.json`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
}
export function ensureKey(role: Role): Keypair {
  if (seedHex() && role !== "lookalike") return derived(role);
  mkdirSync(DEMO_DIR, { recursive: true });
  const p = join(DEMO_DIR, `${role}.json`);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify([...Keypair.generate().secretKey]), { mode: 0o600 });
  return kp(role);
}
export function deployer(): Keypair {
  if (seedHex()) return derived("deployer");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(KEY_DIR, "deployer.json"), "utf8"))));
}

const WF = () => join(DEMO_DIR, "world.json");
export function readWorld(): WorldFile { return existsSync(WF()) ? JSON.parse(readFileSync(WF(), "utf8")) : {}; }
export function writeWorld(w: WorldFile) { writeFileSync(WF(), JSON.stringify(w, null, 2)); }

/** Token mints: derived from the seed when there is one, otherwise created by setup and saved in world.json. */
export function mintKeys() {
  return seedHex() ? { nusd: derived("nusd-mint"), fakeUsdc: derived("fake-usdc-mint") } : null;
}

export function loadWorld() {
  const w = readWorld();
  const mk = mintKeys();
  if (mk) {
    w.nusdMint = mk.nusd.publicKey.toBase58();
    w.fakeUsdcMint = mk.fakeUsdc.publicKey.toBase58();
    w.elderNusd = getAssociatedTokenAddressSync(mk.nusd.publicKey, kp("elder").publicKey).toBase58();
  }
  if (w.nusdMint) addVerifiedToken(w.nusdMint, "nUSD", "Night Guard demo dollar (devnet)");
  const pub = (r: Role) => kp(r).publicKey;
  const elder = pub("elder");
  return {
    conn: makeConnection(),
    file: w,
    elder, vault: vaultPda(elder), ana: pub("ana"), pedro: pub("pedro"), lookalike: pub("lookalike"),
    fakeRelative: pub("fakeRelative"), fakeSupport: pub("fakeSupport"), drainer: pub("drainer"), feeScammer: pub("feeScammer"),
    nusdMint: w.nusdMint ? new PublicKey(w.nusdMint) : null,
    fakeUsdcMint: w.fakeUsdcMint ? new PublicKey(w.fakeUsdcMint) : null,
    elderNusd: w.elderNusd ? new PublicKey(w.elderNusd) : null,
    names(lang: "pt" | "en"): Record<string, string> {
      return { [pub("ana").toBase58()]: lang === "pt" ? "Ana (filha)" : "Ana (daughter)", [pub("pedro").toBase58()]: lang === "pt" ? "Pedro (filho)" : "Pedro (son)" };
    },
  };
}
export type World = ReturnType<typeof loadWorld>;
