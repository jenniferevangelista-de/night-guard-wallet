// A devnet connection that waits and retries when the public RPC says "too many requests" (429) or is busy.
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "./config.js";

export let rpcRetries = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function patientFetch(input: any, init?: any): Promise<Response> {
  let wait = 400;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(input, init);
      if ((r.status === 429 || r.status >= 500) && i < 14) { rpcRetries++; await sleep(wait); wait = Math.min(wait * 2, 6000); continue; }
      return r;
    } catch (e) {
      if (i >= 14) throw e;
      rpcRetries++; await sleep(wait); wait = Math.min(wait * 2, 6000);
    }
  }
}

export function makeConnection() {
  return new Connection(RPC_URL, { commitment: "confirmed", fetch: patientFetch as any, disableRetryOnRateLimit: true });
}
