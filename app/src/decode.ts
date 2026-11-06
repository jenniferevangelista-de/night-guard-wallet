// Reads what each instruction of a transaction asks for, before anything is signed.

import { BorshCoder, Idl } from "@coral-xyz/anchor";
import { AuthorityType, decodeInstruction, TokenInstruction, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AddressLookupTableAccount, Connection, PublicKey, SystemInstruction, SystemProgram, TransactionInstruction,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import { IDL, PROGRAM_ID } from "./config.js";
import { KNOWN_PROGRAMS, MEMO_PROGRAM } from "./known.js";

export type Action =
  | { kind: "sol_transfer"; from: string; to: string; lamports: number }
  | { kind: "token_transfer"; source: string; destination: string; owner: string; amount: bigint; mint?: string }
  | { kind: "approve"; account: string; delegate: string; owner: string; amount: bigint; mint?: string }
  | { kind: "set_authority"; account: string; authorityType: string; newAuthority: string | null; currentAuthority: string }
  | { kind: "close_account"; account: string; destination: string; owner: string }
  | { kind: "vault_send"; vault: string; to: string; lamports: number; owner: string }
  | { kind: "vault_request"; vault: string; to: string; lamports: number; owner: string }
  | { kind: "vault_other"; name: string }
  | { kind: "memo"; text: string }
  | { kind: "unknown_program"; programId: string };

const coder = new BorshCoder(IDL as Idl);
const U64_MAX = 18446744073709551615n;
export const isUnlimited = (a: bigint) => a >= U64_MAX / 2n;

export async function instructionsOf(conn: Connection, tx: VersionedTransaction): Promise<TransactionInstruction[]> {
  const luts: AddressLookupTableAccount[] = [];
  for (const l of tx.message.addressTableLookups ?? []) {
    const r = await conn.getAddressLookupTable(l.accountKey);
    if (r.value) luts.push(r.value);
  }
  return TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: luts }).instructions;
}

export function decodeAll(ixs: TransactionInstruction[]): Action[] {
  return ixs.map(decodeOne).filter((a): a is Action => a !== null);
}

function decodeOne(ix: TransactionInstruction): Action | null {
  const pid = ix.programId.toBase58();
  if (ix.programId.equals(SystemProgram.programId)) {
    try {
      if (SystemInstruction.decodeInstructionType(ix) === "Transfer") {
        const t = SystemInstruction.decodeTransfer(ix);
        return { kind: "sol_transfer", from: t.fromPubkey.toBase58(), to: t.toPubkey.toBase58(), lamports: Number(t.lamports) };
      }
    } catch { /* other system instructions are not money movements */ }
    return null;
  }
  if (ix.programId.equals(TOKEN_PROGRAM_ID) || ix.programId.equals(TOKEN_2022_PROGRAM_ID)) return decodeToken(ix);
  if (ix.programId.equals(PROGRAM_ID)) return decodeVault(ix);
  if (pid === MEMO_PROGRAM) return { kind: "memo", text: ix.data.toString("utf8") };
  if (KNOWN_PROGRAMS[pid]) return null;
  return { kind: "unknown_program", programId: pid };
}

const AUTH_NAMES: Record<number, string> = {
  [AuthorityType.MintTokens]: "MintTokens", [AuthorityType.FreezeAccount]: "FreezeAccount",
  [AuthorityType.AccountOwner]: "AccountOwner", [AuthorityType.CloseAccount]: "CloseAccount",
};

function decodeToken(ix: TransactionInstruction): Action | null {
  let d: any;
  try {
    d = decodeInstruction(ix, ix.programId);
  } catch {
    return null;
  }
  const k = d.keys, data = d.data;
  const s = (p?: { pubkey: PublicKey }) => p?.pubkey.toBase58() ?? "";
  switch (data.instruction) {
    case TokenInstruction.Transfer:
      return { kind: "token_transfer", source: s(k.source), destination: s(k.destination), owner: s(k.owner), amount: BigInt(data.amount) };
    case TokenInstruction.TransferChecked:
      return { kind: "token_transfer", source: s(k.source), destination: s(k.destination), owner: s(k.owner), amount: BigInt(data.amount), mint: s(k.mint) };
    case TokenInstruction.Approve:
      return { kind: "approve", account: s(k.account), delegate: s(k.delegate), owner: s(k.owner), amount: BigInt(data.amount) };
    case TokenInstruction.ApproveChecked:
      return { kind: "approve", account: s(k.account), delegate: s(k.delegate), owner: s(k.owner), amount: BigInt(data.amount), mint: s(k.mint) };
    case TokenInstruction.SetAuthority:
      return {
        kind: "set_authority", account: s(k.account), currentAuthority: s(k.currentAuthority),
        authorityType: AUTH_NAMES[data.authorityType] ?? String(data.authorityType), newAuthority: data.newAuthority?.toBase58() ?? null,
      };
    case TokenInstruction.CloseAccount:
      return { kind: "close_account", account: s(k.account), destination: s(k.destination), owner: s(k.authority) };
    default:
      return null;
  }
}

function decodeVault(ix: TransactionInstruction): Action | null {
  const d = coder.instruction.decode(ix.data);
  if (!d) return { kind: "vault_other", name: "unknown" };
  const keys = ix.keys.map((k) => k.pubkey.toBase58());
  const amount = (d.data as any).amount;
  if (d.name === "send") return { kind: "vault_send", owner: keys[0], vault: keys[1], to: keys[2], lamports: Number(amount) };
  if (d.name === "request") return { kind: "vault_request", owner: keys[0], vault: keys[1], to: keys[3], lamports: Number(amount) };
  return { kind: "vault_other", name: d.name };
}

/** The vault's own error messages, from its IDL (codes 6000+). */
export function vaultErrorOf(err: unknown): { code: number; name: string; msg: string } | null {
  const custom = (err as any)?.InstructionError?.[1]?.Custom;
  if (typeof custom !== "number") return null;
  const e = (IDL as any).errors.find((x: any) => x.code === custom);
  return e ? { code: e.code, name: e.name, msg: e.msg } : null;
}
