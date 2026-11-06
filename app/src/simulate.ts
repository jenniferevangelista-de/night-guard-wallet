// Runs the transaction on Solana devnet WITHOUT sending it (simulateTransaction), and compares
// every writable account before and after: SOL, tokens, approvals (delegates) and owners.

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { AccountInfo, Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { vaultErrorOf } from "./decode.js";

export interface TokenState { mint: string; owner: string; amount: bigint; delegate: string | null; delegatedAmount: bigint; closeAuthority: string | null }
export interface Change {
  address: string;
  solBefore: number; // lamports
  solAfter: number;
  existsAfter: boolean;
  tokenBefore?: TokenState;
  tokenAfter?: TokenState;
}
export interface Simulation {
  ok: boolean;
  error: string | null;
  vaultError: { code: number; name: string; msg: string } | null;
  logs: string[];
  unitsConsumed: number;
  changes: Change[];
  ms: number;
}

function writableKeys(tx: VersionedTransaction): PublicKey[] {
  const m = tx.message;
  const keys = m.staticAccountKeys;
  return keys.filter((_, i) => m.isAccountWritable(i));
}

function tokenOf(address: PublicKey, info: AccountInfo<Buffer> | null): TokenState | undefined {
  if (!info) return undefined;
  const isToken = info.owner.equals(TOKEN_PROGRAM_ID) || info.owner.equals(TOKEN_2022_PROGRAM_ID);
  if (!isToken || info.data.length < 165) return undefined;
  try {
    const a = unpackAccount(address, info, info.owner);
    return {
      mint: a.mint.toBase58(), owner: a.owner.toBase58(), amount: a.amount,
      delegate: a.delegate?.toBase58() ?? null, delegatedAmount: a.delegatedAmount, closeAuthority: a.closeAuthority?.toBase58() ?? null,
    };
  } catch {
    return undefined;
  }
}

export async function simulate(conn: Connection, tx: VersionedTransaction): Promise<Simulation> {
  const t0 = performance.now();
  const keys = writableKeys(tx);
  const [pre, sim] = await Promise.all([
    conn.getMultipleAccountsInfo(keys, "confirmed"),
    conn.simulateTransaction(tx, {
      sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed",
      accounts: { encoding: "base64", addresses: keys.map((k) => k.toBase58()) },
    }),
  ]);
  const v = sim.value;
  const changes: Change[] = keys.map((k, i) => {
    const before = pre[i];
    const raw = v.accounts?.[i];
    const after: AccountInfo<Buffer> | null = raw
      ? { ...raw, owner: new PublicKey(raw.owner), data: Buffer.from(raw.data[0], "base64") } as AccountInfo<Buffer>
      : null;
    const ok = !v.err;
    return {
      address: k.toBase58(),
      solBefore: before?.lamports ?? 0,
      solAfter: ok ? after?.lamports ?? 0 : before?.lamports ?? 0,
      existsAfter: ok ? !!after && after.lamports > 0 : !!before,
      tokenBefore: tokenOf(k, before),
      tokenAfter: ok ? tokenOf(k, after) : tokenOf(k, before),
    };
  });
  return {
    ok: !v.err,
    error: v.err ? JSON.stringify(v.err) : null,
    vaultError: vaultErrorOf(v.err),
    logs: v.logs ?? [],
    unitsConsumed: v.unitsConsumed ?? 0,
    changes,
    ms: performance.now() - t0,
  };
}
