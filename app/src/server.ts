// Night Guard Wallet demo server: Lucy's wallet (web/index.html) and Ana's guardian page (web/family.html).
// Run in the Codespace:  npm start   ->  http://localhost:8787  and  /family.html

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BorshCoder, EventParser, Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Lang } from "./ai.js";
import { AI, IDL, MODEL, PORT, PROGRAM_ID } from "./config.js";
import { Book, check, fmtSol, Report } from "./guardian.js";
import { qrFor, SCENARIOS } from "./scenarios.js";
import { explorer, explorerAddr, fetchVault, ix, listRequests, requestPda, sendTx } from "./vault.js";
import { kp, loadWorld, World } from "./world.js";

// The public devnet RPC sometimes answers 429; one failed call must never take the whole wallet down.
process.on("unhandledRejection", (e) => console.error("[unhandled]", String((e as any)?.message ?? e).slice(0, 200)));
process.on("uncaughtException", (e) => console.error("[uncaught]", String(e?.message ?? e).slice(0, 200)));

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
export const w: World = loadWorld();
const last = new Map<string, Report>();

export async function bookFor(world: World, lang: Lang): Promise<Book> {
  const v = await fetchVault(world.conn, world.vault);
  const hist = world.file.history ?? [];
  const sorted = hist.map((h) => h.lamports).sort((a, b) => a - b);
  return {
    owner: world.elder.toBase58(), vault: world.vault.toBase58(), vaultBalance: v?.available ?? 0,
    trusted: v?.trusted ?? [], names: world.names(lang), usualPayment: sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined,
  };
}

// ---- live events to the family page (Server-Sent Events) ----
const clients = new Set<ServerResponse>();
const feed: any[] = [];
function push(ev: any) {
  ev.at = Date.now();
  feed.push(ev);
  if (feed.length > 50) feed.shift();
  for (const c of clients) c.write(`data: ${JSON.stringify(ev)}\n\n`);
}
const parser = new EventParser(PROGRAM_ID, new BorshCoder(IDL as Idl));
w.conn.onLogs(PROGRAM_ID, (l) => {
  try {
    for (const e of parser.parseLogs(l.logs)) {
      const d: any = e.data;
      const vault = d.vault?.toBase58?.();
      if (vault && vault !== w.vault.toBase58()) continue;
      const data = Object.fromEntries(Object.entries(d).map(([k, v]: [string, any]) => [k, v?.toBase58 ? v.toBase58() : v?.toString ? v.toString() : v]));
      push({ type: "chain", name: e.name, data, sig: l.signature, link: explorer(l.signature) });
    }
  } catch { /* not ours */ }
}, "confirmed");

// ---- API ----
async function body(req: IncomingMessage): Promise<any> {
  let s = "";
  for await (const ch of req) s += ch;
  return s ? JSON.parse(s) : {};
}
function json(res: ServerResponse, code: number, data: unknown) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

const stateCache = new Map<string, { at: number; v: any }>();
async function state(lang: Lang) {
  const c = stateCache.get(lang);
  if (c && Date.now() - c.at < 2500) return c.v;
  const v = await stateUncached(lang);
  stateCache.set(lang, { at: Date.now(), v });
  return v;
}
const dropState = () => stateCache.clear();
async function stateUncached(lang: Lang) {
  const [v, reqs, bal, fake] = await Promise.all([
    fetchVault(w.conn, w.vault), listRequests(w.conn, w.vault), w.conn.getBalance(w.elder, "confirmed"),
    w.fakeUsdcMint ? w.conn.getTokenAccountBalance(getAssociatedTokenAddressSync(w.fakeUsdcMint, w.elder, false, TOKEN_2022_PROGRAM_ID)).catch(() => null) : null,
  ]);
  const nusd = w.elderNusd ? await w.conn.getTokenAccountBalance(w.elderNusd).catch(() => null) : null;
  const names = w.names(lang);
  return {
    elder: w.elder.toBase58(), elderLink: explorerAddr(w.elder.toBase58()), wallet: bal, walletTxt: fmtSol(bal, lang),
    vault: v && { ...v, availableTxt: fmtSol(v.available, lang), dailyLimitTxt: fmtSol(v.dailyLimit, lang), spentTodayTxt: fmtSol(v.spentToday, lang), largeTxt: fmtSol(v.largeAmount, lang), link: explorerAddr(v.address) },
    trusted: (v?.trusted ?? []).map((t) => ({ address: t, name: names[t] ?? t })),
    requests: reqs.map((r) => ({ ...r, amountTxt: fmtSol(r.amount, lang), toName: names[r.to] ?? `${r.to.slice(0, 4)}…${r.to.slice(-4)}`, link: explorerAddr(r.address) })),
    tokens: [
      nusd && { symbol: "nUSD", amount: nusd.value.uiAmountString, verified: true },
      fake && { symbol: "USDC", amount: fake.value.uiAmountString, verified: false, mint: w.fakeUsdcMint!.toBase58() },
    ].filter(Boolean),
    program: PROGRAM_ID.toBase58(), programLink: explorerAddr(PROGRAM_ID.toBase58()), ai: AI === "ollama" ? MODEL : "templates",
    guardian: kp("ana").publicKey.toBase58(),
  };
}

const routes: Record<string, (req: IncomingMessage, res: ServerResponse, q: URLSearchParams) => Promise<void>> = {
  "GET /api/state": async (_r, res, q) => json(res, 200, await state((q.get("lang") as Lang) ?? "pt")),
  "GET /api/scenarios": async (_r, res) => json(res, 200, SCENARIOS.map(({ build, ...s }) => ({ ...s, qr: qrFor(s as any, w) }))),
  "POST /api/check": async (req, res) => {
    const b = await body(req);
    const s = SCENARIOS.find((x) => x.id === b.id);
    if (!s) return json(res, 404, { error: "unknown scenario" });
    const lang: Lang = b.lang === "en" ? "en" : "pt";
    const { tx } = await s.build(w);
    // fast pass: simulation + rules (no model) so the verdict shows at once; then the full pass with Gemma
    const report = await check(w.conn, await bookFor(w, lang), { tx, message: s.message[lang], link: s.link ?? qrFor(s, w), lang, phoneMode: !!b.phoneMode, useModel: !!b.ai });
    const prev = last.get(s.id);
    last.set(s.id, prev && prev.verdict === "STOP" ? { ...report, verdict: "STOP" } : report);
    if (report.verdict === "STOP" && !b.ai) {
      push({ type: "blocked", id: s.id, title: s.title, amountTxt: report.amountLamports ? fmtSol(report.amountLamports, lang) : "", flags: report.flags.slice(0, 3), tactics: report.tactics });
    }
    json(res, 200, report);
  },
  // Sign only what the guardian let through (OK). Everything else goes to the family.
  "POST /api/sign": async (req, res) => {
    dropState();
    const b = await body(req);
    const s = SCENARIOS.find((x) => x.id === b.id);
    const r = s && last.get(s.id);
    if (!s || !r) return json(res, 400, { error: "check first" });
    if (r.verdict !== "OK") return json(res, 403, { error: "blocked by Night Guard", verdict: r.verdict });
    const { tx } = await s.build(w);
    tx.sign([kp("elder")]);
    const t0 = performance.now();
    const latest = await w.conn.getLatestBlockhash("confirmed");
    const sig = await w.conn.sendTransaction(tx);
    await w.conn.confirmTransaction({ signature: sig, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");
    json(res, 200, { sig, link: explorer(sig), ms: performance.now() - t0 });
  },
  // Open an on-chain request: the chain decides if Ana must approve and how long to wait.
  "POST /api/ask-family": async (req, res) => {
    dropState();
    const b = await body(req);
    const s = SCENARIOS.find((x) => x.id === b.id);
    if (!s) return json(res, 404, { error: "unknown scenario" });
    if (!s.vaultPath) {
      push({ type: "help", id: s.id, title: s.title });
      return json(res, 200, { alerted: true });
    }
    const { to, lamports } = await s.build(w);
    const v = await fetchVault(w.conn, w.vault);
    const r = await sendTx(w.conn, [await ix(w.conn).request(w.elder, to!, lamports, v!.nextRequest, s.id)], [kp("elder")]);
    json(res, 200, { request: requestPda(w.vault, v!.nextRequest).toBase58(), sig: r.sig, link: explorer(r.sig), ms: r.ms });
  },
  "POST /api/guardian/decide": async (req, res) => {
    dropState();
    const b = await body(req);
    const r = await sendTx(w.conn, [await ix(w.conn).decide(kp("ana").publicKey, w.elder, new PublicKey(b.request), !!b.approve)], [kp("ana")]);
    json(res, 200, { sig: r.sig, link: explorer(r.sig), ms: r.ms });
  },
  "POST /api/execute": async (req, res) => {
    dropState();
    const b = await body(req);
    const reqs = await listRequests(w.conn, w.vault);
    const rq = reqs.find((x) => x.address === b.request);
    if (!rq) return json(res, 404, { error: "no such request" });
    try {
      const r = await sendTx(w.conn, [await ix(w.conn).execute(w.elder, new PublicKey(rq.address), new PublicKey(rq.to))], [kp("elder")]);
      json(res, 200, { sig: r.sig, link: explorer(r.sig), ms: r.ms });
    } catch (e: any) {
      json(res, 409, { error: String(e.message ?? e).slice(0, 300) });
    }
  },
  "POST /api/cancel": async (req, res) => {
    dropState();
    const b = await body(req);
    const r = await sendTx(w.conn, [await ix(w.conn).cancel(w.elder, w.elder, new PublicKey(b.request))], [kp("elder")]);
    json(res, 200, { sig: r.sig, link: explorer(r.sig) });
  },
  "GET /api/events": async (req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    for (const ev of feed) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
  },
};

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
export const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", "http://x");
  const h = routes[`${req.method} ${u.pathname}`];
  try {
    if (h) return await h(req, res, u.searchParams);
    const f = join(WEB, u.pathname === "/" ? "index.html" : u.pathname.replace(/\.\./g, ""));
    if (existsSync(f)) { res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }); return res.end(readFileSync(f)); }
    res.writeHead(404).end("not found");
  } catch (e: any) {
    console.error(e);
    json(res, 500, { error: String(e?.message ?? e).slice(0, 300) });
  }
});
if (process.argv[1]?.endsWith("server.ts")) server.listen(PORT, () => console.log(`Night Guard Wallet on http://localhost:${PORT} (AI: ${AI === "ollama" ? MODEL : "templates"})`));
