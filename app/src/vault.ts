// Client for the on-chain vault (Anchor program guardian_vault).

import { AnchorProvider, BN, BorshCoder, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import { IDL, PROGRAM_ID } from "./config.js";

const coder = new BorshCoder(IDL as Idl);

export const vaultPda = (owner: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("vault"), owner.toBuffer()], PROGRAM_ID)[0];
export const requestPda = (vault: PublicKey, id: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddressSync([Buffer.from("req"), vault.toBuffer(), b], PROGRAM_ID)[0];
};

export function programFor(conn: Connection) {
  const provider = new AnchorProvider(conn, new Wallet(Keypair.generate()), { commitment: "confirmed" });
  return new Program(IDL as Idl, provider);
}

export interface VaultState {
  address: string; owner: string; guardian: string; dailyLimit: number; largeAmount: number; coolingOffSecs: number;
  spentToday: number; nextRequest: number; trusted: string[]; lamports: number; available: number;
}
export interface RequestState {
  address: string; id: number; to: string; amount: number; createdAt: number; unlockAt: number; needsGuardian: boolean;
  status: "pending" | "approved" | "rejected"; note: string;
}

const rentCache = new Map<number, number>();
export async function fetchVault(conn: Connection, vault: PublicKey): Promise<VaultState | null> {
  const info = await conn.getAccountInfo(vault, "confirmed");
  if (!info) return null;
  const v: any = coder.accounts.decode("Vault", info.data);
  const rent = rentCache.get(info.data.length) ?? await conn.getMinimumBalanceForRentExemption(info.data.length);
  rentCache.set(info.data.length, rent);
  return {
    address: vault.toBase58(), owner: v.owner.toBase58(), guardian: v.guardian.toBase58(),
    dailyLimit: Number(v.daily_limit), largeAmount: Number(v.large_amount), coolingOffSecs: Number(v.cooling_off_secs),
    spentToday: Number(v.spent_today), nextRequest: Number(v.next_request), trusted: v.trusted.map((t: PublicKey) => t.toBase58()),
    lamports: info.lamports, available: info.lamports - rent,
  };
}

export async function listRequests(conn: Connection, vault: PublicKey): Promise<RequestState[]> {
  const disc = (IDL as any).accounts.find((a: any) => a.name === "TransferRequest").discriminator as number[];
  const accs = await conn.getProgramAccounts(PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: bs58(Buffer.from(disc)) } }, { memcmp: { offset: 8, bytes: vault.toBase58() } }],
  });
  return accs.map(({ pubkey, account }) => {
    const r: any = coder.accounts.decode("TransferRequest", account.data);
    return {
      address: pubkey.toBase58(), id: Number(r.id), to: r.to.toBase58(), amount: Number(r.amount),
      createdAt: Number(r.created_at), unlockAt: Number(r.unlock_at), needsGuardian: r.needs_guardian,
      status: (["pending", "approved", "rejected"] as const)[r.status] ?? "pending",
      note: Buffer.from(r.note).toString("utf8").replace(/\0+$/, ""),
    };
  }).sort((a, b) => b.id - a.id);
}

function bs58(b: Buffer) {
  // tiny base58 encoder (avoids an extra import path issue with bs58 ESM)
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + (b.toString("hex") || "0"));
  let s = "";
  while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x === 0) s = "1" + s; else break; }
  return s;
}

export const note32 = (s: string) => {
  const b = Buffer.alloc(32);
  Buffer.from(s, "utf8").copy(b, 0, 0, 32);
  return [...b];
};

export function ix(conn: Connection) {
  const p = programFor(conn);
  return {
    initialize: (owner: PublicKey, guardian: PublicKey, daily: number, large: number, cooling: number) =>
      p.methods.initialize(guardian, new BN(daily), new BN(large), new BN(cooling))
        .accountsPartial({ owner, vault: vaultPda(owner), systemProgram: SystemProgram.programId }).instruction(),
    deposit: (payer: PublicKey, owner: PublicKey, amount: number) =>
      p.methods.deposit(new BN(amount)).accountsPartial({ payer, vault: vaultPda(owner), systemProgram: SystemProgram.programId }).instruction(),
    addTrusted: (owner: PublicKey, guardian: PublicKey, contact: PublicKey) =>
      p.methods.addTrusted(contact).accountsPartial({ owner, guardian, vault: vaultPda(owner) }).instruction(),
    send: (owner: PublicKey, to: PublicKey, amount: number) =>
      p.methods.send(new BN(amount)).accountsPartial({ owner, vault: vaultPda(owner), to }).instruction(),
    request: (owner: PublicKey, to: PublicKey, amount: number, nextId: number, note: string) =>
      p.methods.request(new BN(amount), note32(note))
        .accountsPartial({ owner, vault: vaultPda(owner), req: requestPda(vaultPda(owner), nextId), to, systemProgram: SystemProgram.programId }).instruction(),
    decide: (guardian: PublicKey, owner: PublicKey, req: PublicKey, approve: boolean) =>
      p.methods.guardianDecide(approve).accountsPartial({ guardian, vault: vaultPda(owner), req }).instruction(),
    execute: (owner: PublicKey, req: PublicKey, to: PublicKey) =>
      p.methods.execute().accountsPartial({ owner, vault: vaultPda(owner), req, to }).instruction(),
    cancel: (signer: PublicKey, owner: PublicKey, req: PublicKey) =>
      p.methods.cancel().accountsPartial({ signer, rentTo: owner, vault: vaultPda(owner), req }).instruction(),
  };
}

export async function buildTx(conn: Connection, payer: PublicKey, ixs: TransactionInstruction[]) {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  return new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
}

/** Signs, sends and confirms. Returns the signature and how long the chain took. */
export async function sendTx(conn: Connection, ixs: TransactionInstruction[], signers: Keypair[]) {
  const t0 = performance.now();
  const latest = await conn.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: signers[0].publicKey, recentBlockhash: latest.blockhash, instructions: ixs }).compileToV0Message());
  tx.sign(signers);
  const sig = await conn.sendTransaction(tx, { maxRetries: 5 });
  const res = await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  if (res.value.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(res.value.err)}`);
  return { sig, ms: performance.now() - t0 };
}

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
