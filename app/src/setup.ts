// Creates the demo family on devnet (idempotent): wallets, the vault with its rules, trusted contacts,
// a demo dollar token, a FAKE "USDC" token airdropped by scammers, and an address-poisoning wallet.
// Run in the Codespace:  npm run setup

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  createAssociatedTokenAccountIdempotentInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
  createMintToInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, LENGTH_SIZE, MINT_SIZE, TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID, TYPE_SIZE,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { COOLING_OFF_SECS, DAILY_LIMIT, DEMO_DIR, LARGE_AMOUNT } from "./config.js";
import { fetchVault, ix, listRequests, sendTx, vaultPda } from "./vault.js";
import { deployer, ensureKey, readWorld, ROLES, writeWorld } from "./world.js";
import { makeConnection } from "./rpc.js";

const conn = makeConnection();
const log = (...a: unknown[]) => console.log("[setup]", ...a);

async function main() {
  const payer = deployer();
  log("deployer", payer.publicKey.toBase58(), (await conn.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL, "SOL");
  const k = Object.fromEntries(ROLES.map((r) => [r, ensureKey(r)])) as Record<(typeof ROLES)[number], Keypair>;

  // Address poisoning: a wallet that starts with the same 4 characters as Ana's.
  if (!existsSync(join(DEMO_DIR, "lookalike.json"))) {
    const prefix = k.ana.publicKey.toBase58().slice(0, 4);
    log("grinding a look-alike of Ana starting with", prefix, "(solana-keygen grind)");
    const before = new Set(readdirSync(DEMO_DIR));
    execFileSync("bash", ["../cloud/anchor.sh", `cd /keys/demo && solana-keygen grind --starts-with ${prefix}:1 --num-threads 4 >/dev/null`], { stdio: "inherit" });
    const made = readdirSync(DEMO_DIR).find((f) => !before.has(f) && f.startsWith(prefix) && f.endsWith(".json"));
    if (!made) throw new Error("grind produced no key");
    renameSync(join(DEMO_DIR, made), join(DEMO_DIR, "lookalike.json"));
  }
  const lookalike = ensureKey("lookalike");

  // Fund the family (small amounts; the vault holds most of it)
  const hasVault = !!(await conn.getAccountInfo(vaultPda(k.elder.publicKey)));
  const fund: [Keypair, number][] = [[k.elder, hasVault ? 0.7 : 2.7], [k.ana, 0.03], [k.pedro, 0.005], [lookalike, 0.004]];
  for (const [who, sol] of fund) {
    const bal = await conn.getBalance(who.publicKey);
    if (bal < sol * LAMPORTS_PER_SOL * 0.5) {
      const r = await sendTx(conn, [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: who.publicKey, lamports: Math.round(sol * LAMPORTS_PER_SOL) - bal })], [payer]);
      log("funded", who.publicKey.toBase58(), sol, "SOL", r.sig);
    }
  }

  // The vault: guardian Ana, daily limit, large amount, cooling-off, 2 trusted contacts
  const I = ix(conn);
  const vault = vaultPda(k.elder.publicKey);
  let v = await fetchVault(conn, vault);
  if (!v) {
    const r = await sendTx(conn, [await I.initialize(k.elder.publicKey, k.ana.publicKey, DAILY_LIMIT, LARGE_AMOUNT, COOLING_OFF_SECS),
      await I.deposit(k.elder.publicKey, k.elder.publicKey, 2.0 * LAMPORTS_PER_SOL)], [k.elder]);
    log("vault opened + 2 SOL deposited", vault.toBase58(), r.sig);
    v = await fetchVault(conn, vault);
  }
  if (v && (v.dailyLimit !== DAILY_LIMIT || v.largeAmount !== LARGE_AMOUNT || v.coolingOffSecs !== COOLING_OFF_SECS)) {
    const r = await sendTx(conn, [await I.setLimits(k.elder.publicKey, k.ana.publicKey, DAILY_LIMIT, LARGE_AMOUNT, COOLING_OFF_SECS)], [k.elder, k.ana]);
    log("limits updated (owner + guardian signed)", r.sig);
    v = await fetchVault(conn, vault);
  }
  for (const c of [k.ana, k.pedro]) {
    if (!v!.trusted.includes(c.publicKey.toBase58())) {
      const r = await sendTx(conn, [await I.addTrusted(k.elder.publicKey, k.ana.publicKey, c.publicKey)], [k.elder, k.ana]);
      log("trusted contact added (owner + guardian signed)", c.publicKey.toBase58(), r.sig);
    }
  }

  const w = readWorld();
  // A demo dollar the family really uses (classic SPL token), 500 in Lucy's wallet
  if (!w.nusdMint) {
    const mint = Keypair.generate();
    const ata = getAssociatedTokenAddressSync(mint.publicKey, k.elder.publicKey);
    const r = await sendTx(conn, [
      SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: MINT_SIZE, lamports: await conn.getMinimumBalanceForRentExemption(MINT_SIZE), programId: TOKEN_PROGRAM_ID }),
      createInitializeMintInstruction(mint.publicKey, 6, payer.publicKey, null),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, k.elder.publicKey, mint.publicKey),
      createMintToInstruction(mint.publicKey, ata, payer.publicKey, 500_000_000n),
    ], [payer, mint]);
    w.nusdMint = mint.publicKey.toBase58(); w.elderNusd = ata.toBase58(); writeWorld(w);
    log("nUSD demo dollar", w.nusdMint, r.sig);
  }
  // The scam: a Token-2022 token that calls itself "USD Coin / USDC", airdropped to Lucy
  if (!w.fakeUsdcMint) {
    const mint = Keypair.generate();
    const md = { mint: mint.publicKey, name: "USD Coin", symbol: "USDC", uri: "", additionalMetadata: [] as [string, string][], updateAuthority: payer.publicKey };
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const mdLen = TYPE_SIZE + LENGTH_SIZE + pack(md).length;
    const ata = getAssociatedTokenAddressSync(mint.publicKey, k.elder.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const r = await sendTx(conn, [
      SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports: await conn.getMinimumBalanceForRentExemption(mintLen + mdLen), programId: TOKEN_2022_PROGRAM_ID }),
      createInitializeMetadataPointerInstruction(mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
      createInitializeMintInstruction(mint.publicKey, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
      createInitializeInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey, updateAuthority: payer.publicKey, mint: mint.publicKey, mintAuthority: payer.publicKey, name: md.name, symbol: md.symbol, uri: md.uri }),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, k.elder.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
      createMintToInstruction(mint.publicKey, ata, payer.publicKey, 1_000_000_000n, [], TOKEN_2022_PROGRAM_ID),
    ], [payer, mint]);
    w.fakeUsdcMint = mint.publicKey.toBase58(); writeWorld(w);
    log("FAKE USDC airdropped to Lucy", w.fakeUsdcMint, r.sig);
  }
  // Address poisoning: the look-alike sends Lucy a tiny "dust" payment so it shows up in her history
  if (!w.history?.length) {
    const dust = await sendTx(conn, [SystemProgram.transfer({ fromPubkey: lookalike.publicKey, toPubkey: k.elder.publicKey, lamports: 1000 })], [lookalike]);
    log("look-alike dust sent to Lucy", dust.sig);
    // One real everyday payment: groceries to Ana last week (the "usual payment")
    const r = await sendTx(conn, [await I.send(k.elder.publicKey, k.ana.publicKey, 0.05 * LAMPORTS_PER_SOL)], [k.elder]);
    w.history = [{ to: k.ana.publicKey.toBase58(), lamports: 0.05 * LAMPORTS_PER_SOL, sig: r.sig }];
    writeWorld(w);
    log("usual payment to Ana", r.sig);
  }
  v = await fetchVault(conn, vault);
  if (v && v.available < 1.6 * LAMPORTS_PER_SOL) {   // keep the demo vault at 2 SOL
    const r = await sendTx(conn, [await I.deposit(payer.publicKey, k.elder.publicKey, Math.round(2.0 * LAMPORTS_PER_SOL - v.available))], [payer]);
    log("vault topped up to 2 SOL", r.sig);
    v = await fetchVault(conn, vault);
  }
  for (const r of await listRequests(conn, vault)) {        // start the demo with no old requests
    await sendTx(conn, [await I.cancel(k.elder.publicKey, k.elder.publicKey, new PublicKey(r.address))], [k.elder]);
    log("old request cancelled", r.id);
  }
  const loose = await conn.getBalance(k.elder.publicKey);
  if (loose < 0.6 * LAMPORTS_PER_SOL) {
    const r = await sendTx(conn, [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.elder.publicKey, lamports: Math.round(0.7 * LAMPORTS_PER_SOL) - loose })], [payer]);
    log("everyday wallet topped up to 0.7 SOL", r.sig);
  }
  log("vault", JSON.stringify(v, null, 1));
  log("elder wallet", (await conn.getBalance(k.elder.publicKey)) / LAMPORTS_PER_SOL, "SOL");
  log("look-alike", lookalike.publicKey.toBase58(), "vs Ana", k.ana.publicKey.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });
export { PublicKey };
