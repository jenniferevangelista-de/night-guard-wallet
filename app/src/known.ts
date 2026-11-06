// What the guardian treats as "known": verified tokens, official sites and well-known programs.

import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID } from "./config.js";

export const MEMO_PROGRAM = "MemoSq4gqABAXKb8kXZiZvXX9hNhWyCiTUDJCZKUHkb";

/** Verified token mints (devnet). A token that calls itself one of these symbols with another mint is fake. */
export const VERIFIED_TOKENS: Record<string, { symbol: string; name: string }> = {
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", name: "USD Coin (Circle, devnet)" },
  So11111111111111111111111111111111111111112: { symbol: "SOL", name: "Wrapped SOL" },
};
/** Symbols scammers like to copy. */
export const FAMOUS_SYMBOLS = ["USDC", "USDT", "SOL", "PYUSD", "JUP", "BONK", "EURC"];

export function addVerifiedToken(mint: string, symbol: string, name: string) {
  VERIFIED_TOKENS[mint] = { symbol, name };
}

export const KNOWN_PROGRAMS: Record<string, string> = {
  [SystemProgram.programId.toBase58()]: "System",
  [TOKEN_PROGRAM_ID.toBase58()]: "SPL Token",
  [TOKEN_2022_PROGRAM_ID.toBase58()]: "Token-2022",
  [ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()]: "Associated Token Account",
  [ComputeBudgetProgram.programId.toBase58()]: "Compute Budget",
  [MEMO_PROGRAM]: "Memo",
  [PROGRAM_ID.toBase58()]: "Night Guard vault",
};

/** Official sites of Solana wallets and apps (for links, Blinks and Solana Pay labels). */
export const OFFICIAL_DOMAINS = [
  "solana.com", "solana.org", "phantom.com", "phantom.app", "solflare.com", "backpack.app", "jup.ag",
  "dial.to", "magiceden.io", "tensor.trade", "orca.so", "raydium.io", "marinade.finance", "circle.com",
];
const BRANDS = ["solana", "phantom", "solflare", "backpack", "jupiter", "jup", "magiceden", "orca", "raydium", "circle", "usdc"];

export function hostOf(url: string): string {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : "https://" + url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isOfficial(host: string) {
  return OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

/** Undo the usual tricks: so1ana -> solana, phantorn -> phantom, punycode. */
function unconfuse(s: string) {
  return s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/[1|!]/g, "l").replace(/0/g, "o").replace(/3/g, "e").replace(/5/g, "s").replace(/4/g, "a");
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** A link that imitates a Solana brand without being its official site. Returns the brand it copies. */
export function lookalikeBrand(host: string): string | null {
  if (!host || isOfficial(host)) return null;
  if (host.startsWith("xn--") || host.includes(".xn--")) return "punycode";
  const labels = host.split(".");
  const words = labels.slice(0, -1).join("-").split(/[-_]/);
  for (const w of words) {
    const clean = unconfuse(w);
    for (const b of BRANDS) {
      if (clean === b || clean.includes(b) || (b.length >= 5 && editDistance(clean, b) <= 1)) return b;
    }
  }
  return null;
}

/** Two addresses that look alike at a glance (same start or same end), but are different wallets. */
export function looksLike(a: string, b: string, n = 4) {
  return a !== b && (a.slice(0, n) === b.slice(0, n) || a.slice(-n) === b.slice(-n));
}
