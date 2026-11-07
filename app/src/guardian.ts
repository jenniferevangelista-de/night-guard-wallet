// The guardian: before the person signs, it simulates the transaction on Solana, reads what changes,
// checks the risk rules, reads the message that came with it (Gemma), and writes the verdict in plain words.

import { getTokenMetadata, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { explain, Found, Lang, scamTactics } from "./ai.js";
import { LAMPORTS } from "./config.js";
import { Action, decodeAll, instructionsOf, isUnlimited } from "./decode.js";
import { FAMOUS_SYMBOLS, hostOf, isOfficial, KNOWN_PROGRAMS, lookalikeBrand, looksLike, VERIFIED_TOKENS } from "./known.js";
import { simulate, Simulation } from "./simulate.js";
import { fetchReports } from "./vault.js";

export type Level = "critical" | "high" | "medium" | "info";
export interface Flag { id: string; level: Level; pt: string; en: string }
export type Verdict = "STOP" | "CAUTION" | "OK";

export interface Book {
  owner: string; // the person's wallet
  vault?: string; // their Night Guard vault (PDA)
  vaultBalance?: number;
  trusted: string[]; // read from the vault account on-chain
  names: Record<string, string>; // address book: address -> name
  usualPayment?: number; // lamports, median of past payments
}
export interface CheckInput {
  tx: VersionedTransaction; message?: string; link?: string; lang?: Lang; phoneMode?: boolean; useModel?: boolean;
  sender?: { known: boolean; label: { pt: string; en: string } }; // who sent the request (saved contact or not)
}
/** One line of the "where does this come from" check: ok = true (checked, fine), false (bad), null (unknown). */
export interface Source { kind: "sender" | "link" | "wallet" | "program" | "token"; ok: boolean | null; pt: string; en: string }
export interface Report {
  verdict: Verdict;
  headline: { pt: string; en: string };
  explanation: { text: string; by: "model" | "template" };
  flags: Flag[];
  tactics: Found[];
  changes: { pt: string; en: string; tone: "out" | "in" | "warn" }[];
  sources: Source[];
  amountLamports: number;
  destination: string | null;
  counterparties: string[]; // who would get money or power: the wallets that can be reported
  simulation: Pick<Simulation, "ok" | "error" | "vaultError" | "unitsConsumed" | "logs">;
  timings: { decodeMs: number; simulateMs: number; lookupsMs: number; rulesMs: number; aiTacticsMs: number; aiExplainMs: number; totalMs: number };
}

export const fmtSol = (lamports: number, lang: Lang) => {
  const v = (lamports / LAMPORTS).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 4 });
  return `${v} SOL`;
};
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

interface DestInfo { txCount: number; ageMinutes: number | null }
async function destinationInfo(conn: Connection, addr: string): Promise<DestInfo> {
  const sigs = await conn.getSignaturesForAddress(new PublicKey(addr), { limit: 25 }, "confirmed");
  const oldest = sigs.length ? sigs[sigs.length - 1].blockTime : null;
  return { txCount: sigs.length, ageMinutes: oldest && sigs.length < 25 ? Math.round((Date.now() / 1000 - oldest) / 60) : null };
}

interface MintInfo { mint: string; symbol: string | null; name: string | null; verified: boolean }
const mintCache = new Map<string, MintInfo>();
async function mintInfo(conn: Connection, mint: string): Promise<MintInfo> {
  const c = mintCache.get(mint);
  if (c) return c;
  const r = await mintInfoUncached(conn, mint);
  mintCache.set(mint, r);
  return r;
}
async function mintInfoUncached(conn: Connection, mint: string): Promise<MintInfo> {
  const v = VERIFIED_TOKENS[mint];
  if (v) return { mint, symbol: v.symbol, name: v.name, verified: true };
  try {
    const md = await getTokenMetadata(conn, new PublicKey(mint), "confirmed", TOKEN_2022_PROGRAM_ID);
    return { mint, symbol: md?.symbol ?? null, name: md?.name ?? null, verified: false };
  } catch {
    return { mint, symbol: null, name: null, verified: false };
  }
}

const LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111";
interface ProgramInfo { id: string; name: string | null; ageDays: number | null; upgradeable: boolean | null; verified: boolean | null }
const progCache = new Map<string, ProgramInfo>();
/** Where a program comes from: a known name, how long ago it was deployed, whether someone can still change it,
 *  and whether its source is verified (OtterSec verified-builds registry; best effort). */
async function programInfo(conn: Connection, id: string): Promise<ProgramInfo> {
  if (KNOWN_PROGRAMS[id]) return { id, name: KNOWN_PROGRAMS[id], ageDays: null, upgradeable: null, verified: true };
  const c = progCache.get(id);
  if (c) return c;
  const out: ProgramInfo = { id, name: null, ageDays: null, upgradeable: null, verified: null };
  try {
    const acc = await conn.getAccountInfo(new PublicKey(id), "confirmed");
    if (acc && acc.owner.toBase58() === LOADER_UPGRADEABLE && acc.data.length >= 36) {
      const pd = await conn.getAccountInfo(new PublicKey(acc.data.subarray(4, 36)), "confirmed");
      if (pd) {
        const slot = Number(pd.data.readBigUInt64LE(4));
        out.upgradeable = pd.data[12] === 1;
        const bt = await conn.getBlockTime(slot).catch(() => null);
        if (bt) out.ageDays = Math.max(0, Math.round((Date.now() / 1000 - bt) / 86400));
      }
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://verify.osec.io/status/${id}`, { signal: ctrl.signal }).catch(() => null);
    clearTimeout(t);
    if (r?.ok) out.verified = !!((await r.json()) as any)?.is_verified;
  } catch { /* unknown stays unknown */ }
  progCache.set(id, out);
  return out;
}

async function holdings(conn: Connection, owner: string): Promise<{ mint: string; amount: bigint }[]> {
  const out: { mint: string; amount: bigint }[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const r = await conn.getParsedTokenAccountsByOwner(new PublicKey(owner), { programId }, "confirmed");
    for (const a of r.value) {
      const info = (a.account.data as any).parsed.info;
      out.push({ mint: info.mint, amount: BigInt(info.tokenAmount.amount) });
    }
  }
  return out;
}

export async function check(conn: Connection, book: Book, input: CheckInput): Promise<Report> {
  const T0 = performance.now();
  const lang = input.lang ?? "pt";
  const message = input.message ?? "";

  // 1. What the instructions ask for
  const ixs = await instructionsOf(conn, input.tx);
  const actions = decodeAll(ixs);
  const decodeMs = performance.now() - T0;

  // 2. Simulation on Solana + 3. Gemma reads the message (in parallel)
  const useModel = input.useModel ?? true;
  const tacticsP = scamTactics(message, useModel);
  const sim = await simulate(conn, input.tx);

  // Who receives money, and how much leaves the person's wallet or vault
  const mine = new Set([book.owner, book.vault].filter(Boolean) as string[]);
  let out = 0;
  let dest: string | null = null;
  for (const a of actions) {
    if (a.kind === "sol_transfer" && mine.has(a.from) && !mine.has(a.to)) { out += a.lamports; dest ??= a.to; }
    if ((a.kind === "vault_send" || a.kind === "vault_request") && !mine.has(a.to)) { out += a.lamports; dest ??= a.to; }
  }

  // 4. Look-ups on Solana: who the destination is, which tokens are involved
  const L0 = performance.now();
  const tokenMints = new Set<string>();
  for (const c of sim.changes) { if (c.tokenBefore) tokenMints.add(c.tokenBefore.mint); if (c.tokenAfter) tokenMints.add(c.tokenAfter.mint); }
  for (const a of actions) if ((a.kind === "approve" || a.kind === "token_transfer") && a.mint) tokenMints.add(a.mint);
  // everyone who would receive money or power over her accounts
  const counterparties = new Set<string>();
  if (dest) counterparties.add(dest);
  for (const a of actions) {
    if (a.kind === "approve" && !mine.has(a.delegate)) counterparties.add(a.delegate);
    if (a.kind === "set_authority" && a.newAuthority && !mine.has(a.newAuthority)) counterparties.add(a.newAuthority);
    if (a.kind === "close_account" && !mine.has(a.destination)) counterparties.add(a.destination);
  }
  const programIds = [...new Set(ixs.map((ix) => ix.programId.toBase58()))];
  const [destInfo, held, reports, programs] = await Promise.all([
    dest && !book.trusted.includes(dest) ? destinationInfo(conn, dest) : Promise.resolve(null),
    holdings(conn, book.owner).catch(() => []),
    fetchReports(conn, [...counterparties]).catch(() => ({} as Awaited<ReturnType<typeof fetchReports>>)),
    Promise.all(programIds.map((id) => programInfo(conn, id))),
  ]);
  const involved = new Set(tokenMints);
  for (const h of held) tokenMints.add(h.mint);
  const mints = await Promise.all([...tokenMints].map((m) => mintInfo(conn, m)));
  const lookupsMs = performance.now() - L0;

  // 5. Rules on the simulated result
  const R0 = performance.now();
  const flags: Flag[] = [];
  const add = (id: string, level: Level, pt: string, en: string) => { if (!flags.some((f) => f.id === id)) flags.push({ id, level, pt, en }); };
  const name = (a: string) => book.names[a] ?? null;
  const trustedDest = dest ? book.trusted.includes(dest) : false;

  for (const [addr, r] of Object.entries(reports)) {
    const days = Math.max(0, Math.round((Date.now() / 1000 - r.firstAt) / 86400));
    const fam = (n: number, pt: boolean) => (n === 1 ? (pt ? "1 família" : "1 family") : (pt ? `${n} famílias` : `${n} families`));
    add("community_reported", "critical",
      `A carteira ${short(addr)} já foi DENUNCIADA como golpe por ${fam(r.reports, true)} na lista comunitária da Solana${days ? ` (primeira denúncia há ${days} dias)` : ""}.`,
      `The wallet ${short(addr)} was already REPORTED as a scam by ${fam(r.reports, false)} on the community list on Solana${days ? ` (first report ${days} days ago)` : ""}.`);
  }
  for (const pinfo of programs) {
    if (pinfo.name) continue;
    add("unknown_program", pinfo.ageDays !== null && pinfo.ageDays < 30 ? "high" : "medium",
      `Usa um programa desconhecido${pinfo.ageDays !== null ? `, publicado há ${pinfo.ageDays} dias` : ""}${pinfo.upgradeable ? ", que o dono ainda pode mudar" : ""}${pinfo.verified === false ? ", sem código verificado" : ""}.`,
      `It uses an unknown program${pinfo.ageDays !== null ? `, deployed ${pinfo.ageDays} days ago` : ""}${pinfo.upgradeable ? ", which its owner can still change" : ""}${pinfo.verified === false ? ", with no verified source code" : ""}.`);
  }
  if (sim.vaultError) {
    const e = sim.vaultError.name;
    const ptMsg: Record<string, string> = {
      NotTrusted: "O seu cofre na Solana recusou: essa carteira não está na sua lista de contatos de confiança.",
      OverDailyLimit: "O seu cofre na Solana recusou: passa do seu limite de hoje.",
      NeedsCoolingOff: "Valor alto: o seu cofre na Solana exige um tempo de espera antes de enviar.",
    };
    add("vault_refused", e === "NeedsCoolingOff" ? "medium" : "high", ptMsg[e] ?? `O seu cofre na Solana recusou (${sim.vaultError.msg}).`, `Your vault on Solana refused it: ${sim.vaultError.msg}.`);
  }
  if (dest && !trustedDest) {
    for (const t of book.trusted) {
      if (looksLike(dest, t)) {
        const who = name(t) ?? short(t);
        add("lookalike_address", "critical",
          `Este endereço é PARECIDO com o de ${who}, mas NÃO é o mesmo (${short(dest)} × ${short(t)}). É um golpe de endereço copiado.`,
          `This address LOOKS LIKE ${who}'s, but it is NOT the same (${short(dest)} vs ${short(t)}). It is an address-copy scam.`);
      }
    }
    if (destInfo && destInfo.txCount <= 3) {
      const age = destInfo.ageMinutes;
      add("new_wallet", "high",
        `Você nunca enviou para essa carteira. Ela é nova: ${destInfo.txCount === 0 ? "nunca foi usada" : `só ${destInfo.txCount} movimentação(ões)${age !== null ? `, criada há ${age} min` : ""}`}.`,
        `You never sent to this wallet. It is new: ${destInfo.txCount === 0 ? "never used" : `only ${destInfo.txCount} transaction(s)${age !== null ? `, created ${age} min ago` : ""}`}.`);
    } else {
      add("unknown_wallet", "medium", "Essa carteira não está na sua lista de contatos de confiança.", "This wallet is not on your trusted contacts list.");
    }
  }
  const balance = (sim.changes.find((c) => c.address === book.owner)?.solBefore ?? 0) + (book.vaultBalance ?? 0);
  if (out > 0 && balance > 0 && out / balance >= 0.5) {
    const pct = Math.min(100, Math.round((out / balance) * 100));
    add("drains_balance", out / balance >= 0.8 ? "critical" : "high",
      `Isso leva ${pct}% de todo o seu dinheiro.`, `This takes ${pct}% of all your money.`);
  }
  if (out > 0 && book.usualPayment && out > 3 * book.usualPayment && !trustedDest) {
    add("unusual_amount", "medium", `Valor ${Math.round(out / book.usualPayment)} vezes maior que os seus pagamentos de costume.`, `Amount ${Math.round(out / book.usualPayment)} times bigger than your usual payments.`);
  }
  for (const a of actions) {
    if (a.kind === "approve" && !mine.has(a.delegate)) {
      const c = sim.changes.find((x) => x.address === a.account);
      const bal = c?.tokenBefore?.amount ?? 0n;
      const unlimited = isUnlimited(a.amount) || (bal > 0n && a.amount >= bal);
      add("approve", unlimited ? "critical" : "high",
        unlimited ? `Isso dá a uma carteira estranha (${short(a.delegate)}) permissão para tirar TODOS os seus tokens quando quiser, sem pedir de novo.`
          : `Isso dá a uma carteira estranha (${short(a.delegate)}) permissão para tirar parte dos seus tokens sem pedir de novo.`,
        unlimited ? `This lets a stranger's wallet (${short(a.delegate)}) take ALL your tokens whenever it wants, without asking again.`
          : `This lets a stranger's wallet (${short(a.delegate)}) take some of your tokens without asking again.`);
    }
    if (a.kind === "set_authority" && a.newAuthority && !mine.has(a.newAuthority)) {
      add("set_authority", "critical",
        `Isso passa o CONTROLE da sua conta de tokens para outra pessoa (${short(a.newAuthority)}). Depois disso, ela é dona, não você.`,
        `This hands CONTROL of your token account to someone else (${short(a.newAuthority)}). After this, they own it, not you.`);
    }
    if (a.kind === "close_account" && !mine.has(a.destination)) {
      add("close_account", "high", `Isso fecha uma conta sua e manda o que sobra para outra carteira (${short(a.destination)}).`,
        `This closes one of your accounts and sends what is left to another wallet (${short(a.destination)}).`);
    }
  }
  // Token that pretends to be a famous one
  const mentioned = FAMOUS_SYMBOLS.filter((s) => new RegExp(`\\b${s}\\b`, "i").test(message + " " + (input.link ?? "")));
  for (const m of mints) {
    if (m.verified || !m.symbol) continue;
    const copies = FAMOUS_SYMBOLS.find((s) => m.symbol!.toUpperCase().replace(/[^A-Z]/g, "") === s);
    if (copies && (mentioned.includes(copies) || involved.has(m.mint))) {
      add("fake_token", "high",
        `Na sua carteira há um token que se chama "${m.symbol}", mas é FALSO: não é o ${copies} verdadeiro (${short(m.mint)}). Ele não vale nada.`,
        `Your wallet has a token called "${m.symbol}", but it is FAKE: not the real ${copies} (${short(m.mint)}). It is worth nothing.`);
    }
  }
  if (input.link) {
    const host = hostOf(input.link);
    const brand = lookalikeBrand(host);
    if (brand) add("phishing_link", "critical", `O link ${host} imita um site oficial (${brand}), mas é falso.`, `The link ${host} imitates an official site (${brand}), but it is fake.`);
  }
  const tactics = (await tacticsP);
  if (tactics.tactics.length && (out > 0 || flags.length)) {
    add("scam_script", tactics.tactics.length >= 2 ? "high" : "medium",
      "A mensagem que veio junto usa truques comuns de golpe.", "The message that came with it uses common scam tricks.");
  }
  if (input.phoneMode && out > 0 && !trustedDest) {
    add("phone_mode", "high", "Você está no telefone com alguém. Banco e suporte NUNCA pedem transferência por telefone. Desligue e ligue você para o número oficial.",
      "You are on the phone with someone. Banks and support NEVER ask for transfers by phone. Hang up and call the official number yourself.");
  }

  const has = (l: Level) => flags.some((f) => f.level === l);
  const coolingOnly = flags.length === 1 && sim.vaultError?.name === "NeedsCoolingOff";
  const verdict: Verdict = has("critical") || has("high") ? "STOP" : (has("medium") || coolingOnly) ? "CAUTION" : "OK";
  const rulesMs = performance.now() - R0;

  // What changes, in plain words
  const changes: Report["changes"] = [];
  const who = (a: string) => name(a) ?? (book.trusted.includes(a) ? short(a) : `${short(a)} (desconhecida)`);
  const whoEn = (a: string) => name(a) ?? (book.trusted.includes(a) ? short(a) : `${short(a)} (unknown)`);
  for (const a of actions) {
    if ((a.kind === "sol_transfer" && mine.has(a.from)) || a.kind === "vault_send" || a.kind === "vault_request") {
      const from = a.kind === "sol_transfer" ? (a.from === book.vault ? "do seu cofre" : "da sua carteira") : "do seu cofre";
      const fromEn = a.kind === "sol_transfer" ? (a.from === book.vault ? "from your vault" : "from your wallet") : "from your vault";
      changes.push({ pt: `Sai ${from}: ${fmtSol(a.lamports, "pt")} → ${who(a.to)}`, en: `Leaves ${fromEn}: ${fmtSol(a.lamports, "en")} → ${whoEn(a.to)}`, tone: "out" });
    }
    if (a.kind === "approve") changes.push({ pt: `Permissão para ${short(a.delegate)} gastar ${isUnlimited(a.amount) ? "TUDO, sem limite" : a.amount.toString()} dos seus tokens`, en: `Permission for ${short(a.delegate)} to spend ${isUnlimited(a.amount) ? "EVERYTHING, no limit" : a.amount.toString()} of your tokens`, tone: "warn" });
    if (a.kind === "set_authority") changes.push({ pt: `Novo dono da sua conta de tokens: ${a.newAuthority ? short(a.newAuthority) : "ninguém"}`, en: `New owner of your token account: ${a.newAuthority ? short(a.newAuthority) : "nobody"}`, tone: "warn" });
    if (a.kind === "close_account") changes.push({ pt: `Sua conta de tokens é fechada; o resto vai para ${short(a.destination)}`, en: `Your token account is closed; the rest goes to ${short(a.destination)}`, tone: "warn" });
    if (a.kind === "token_transfer") changes.push({ pt: `Saem ${a.amount.toString()} unidades de token`, en: `${a.amount.toString()} token units leave`, tone: "out" });
  }
  if (sim.ok) {
    for (const c of sim.changes) {
      if (c.tokenBefore && c.tokenAfter && c.tokenBefore.owner !== c.tokenAfter.owner)
        changes.push({ pt: `Simulação: dono da conta muda de você para ${short(c.tokenAfter.owner)}`, en: `Simulation: account owner changes from you to ${short(c.tokenAfter.owner)}`, tone: "warn" });
      if (c.tokenAfter?.delegate && c.tokenAfter.delegate !== c.tokenBefore?.delegate)
        changes.push({ pt: `Simulação: ${short(c.tokenAfter.delegate)} passa a poder gastar ${isUnlimited(c.tokenAfter.delegatedAmount) ? "sem limite" : c.tokenAfter.delegatedAmount.toString()}`, en: `Simulation: ${short(c.tokenAfter.delegate)} can now spend ${isUnlimited(c.tokenAfter.delegatedAmount) ? "with no limit" : c.tokenAfter.delegatedAmount.toString()}`, tone: "warn" });
    }
  } else if (sim.vaultError) {
    changes.push({ pt: "Simulação: o cofre na Solana bloqueou, nada sairia", en: "Simulation: the vault on Solana blocked it, nothing would leave", tone: "warn" });
  }

  const amountTxt = out ? fmtSol(out, lang) : "";
  const headline = verdict === "STOP"
    ? { pt: "PARE. Não assine.", en: "STOP. Do not sign." }
    : verdict === "CAUTION" ? { pt: "Atenção antes de seguir.", en: "Careful before you go on." } : { pt: "Pode seguir.", en: "You can go ahead." };
  const top = [...flags].sort((a, b) => rank(a.level) - rank(b.level));
  const fallback = verdict === "OK"
    ? (lang === "pt" ? `Você vai enviar ${amountTxt} para ${dest ? who(dest) : "um contato"}. Está dentro do seu limite e é um contato de confiança.` : `You will send ${amountTxt} to ${dest ? whoEn(dest) : "a contact"}. It is within your limit and a trusted contact.`)
    : (top[0] ? (lang === "pt" ? top[0].pt : top[0].en) : headline[lang]);
  const exp = await explain({
    verdict: verdict === "STOP" ? (lang === "pt" ? "PARE" : "STOP") : verdict === "CAUTION" ? (lang === "pt" ? "ATENÇÃO" : "CAUTION") : "OK",
    amount: amountTxt, lang, fallback, moneyOut: out > 0,
    lines: [...changes.slice(0, 2).map((c) => (lang === "pt" ? `O que acontece: ${c.pt}` : `What happens: ${c.en}`)),
      ...top.slice(0, 4).map((f) => (lang === "pt" ? f.pt : f.en)), ...tactics.tactics.map((t) => `tactic ${t.id}: "${t.quote}"`)],
  }, useModel);

  // Where does each part of this request come from?
  const sources: Source[] = [];
  if (input.sender) sources.push({ kind: "sender", ok: input.sender.known,
    pt: `Quem pediu: ${input.sender.label.pt} · ${input.sender.known ? "contato salvo" : "NÃO é um contato salvo"}`,
    en: `Who asked: ${input.sender.label.en} · ${input.sender.known ? "a saved contact" : "NOT a saved contact"}` });
  if (input.link) {
    const host = input.link.startsWith("solana:") ? null : hostOf(input.link);
    if (host) {
      const bad = lookalikeBrand(host);
      sources.push({ kind: "link", ok: bad ? false : isOfficial(host) ? true : null,
        pt: `Link: ${host} · ${bad ? `IMITA ${bad}` : isOfficial(host) ? "site oficial" : "site desconhecido"}`,
        en: `Link: ${host} · ${bad ? `IMITATES ${bad}` : isOfficial(host) ? "official site" : "unknown site"}` });
    } else sources.push({ kind: "link", ok: null, pt: "QR Solana Pay: o endereço do QR é conferido abaixo", en: "Solana Pay QR: its address is checked below" });
  }
  for (const c of counterparties) {
    const r = reports[c];
    const known = book.trusted.includes(c);
    const lk = !known ? book.trusted.find((t) => looksLike(c, t)) : undefined;
    const isNew = !!destInfo && c === dest && destInfo.txCount <= 3;
    const ok = r || lk || isNew ? false : known ? true : null;
    const whatPt = r ? `denunciada por ${r.reports} família(s)` : known ? "contato de confiança" : lk ? `imita ${name(lk) ?? short(lk)}`
      : c === dest && destInfo ? (destInfo.txCount === 0 ? "nunca usada" : `só ${destInfo.txCount} movimentações`) : "desconhecida";
    const whatEn = r ? `reported by ${r.reports} family(ies)` : known ? "trusted contact" : lk ? `imitates ${name(lk) ?? short(lk)}`
      : c === dest && destInfo ? (destInfo.txCount === 0 ? "never used" : `only ${destInfo.txCount} transactions`) : "unknown";
    sources.push({ kind: "wallet", ok, pt: `Carteira ${name(c) ?? short(c)} · ${whatPt}`, en: `Wallet ${name(c) ?? short(c)} · ${whatEn}` });
  }
  for (const pi of programs) {
    if (pi.name && ["Compute Budget", "Memo"].includes(pi.name)) continue;
    sources.push({ kind: "program", ok: pi.name ? true : false,
      pt: `Programa ${pi.name ?? short(pi.id)} · ${pi.name ? "conhecido" : `desconhecido${pi.ageDays !== null ? `, ${pi.ageDays} dias` : ""}${pi.verified === false ? ", código não verificado" : ""}`}`,
      en: `Program ${pi.name ?? short(pi.id)} · ${pi.name ? "known" : `unknown${pi.ageDays !== null ? `, ${pi.ageDays} days old` : ""}${pi.verified === false ? ", source not verified" : ""}`}` });
  }
  for (const m of mints) {
    if (!(involved.has(m.mint) || (m.symbol && mentioned.includes(m.symbol.toUpperCase())))) continue;
    sources.push({ kind: "token", ok: m.verified,
      pt: `Token ${m.symbol ?? short(m.mint)} · ${m.verified ? "verificado" : "FALSO / não verificado"}`,
      en: `Token ${m.symbol ?? short(m.mint)} · ${m.verified ? "verified" : "FAKE / not verified"}` });
  }

  return {
    sources,
    verdict, headline, explanation: { text: exp.text, by: exp.by }, flags: top, tactics: tactics.tactics, changes,
    amountLamports: out, destination: dest, counterparties: [...counterparties],
    simulation: { ok: sim.ok, error: sim.error, vaultError: sim.vaultError, unitsConsumed: sim.unitsConsumed, logs: sim.logs.slice(-12) },
    timings: {
      decodeMs: decodeMs, simulateMs: sim.ms, lookupsMs, rulesMs, aiTacticsMs: tactics.modelMs, aiExplainMs: exp.ms,
      totalMs: performance.now() - T0,
    },
  };
}

function rank(l: Level) { return { critical: 0, high: 1, medium: 2, info: 3 }[l]; }
export { KNOWN_PROGRAMS };
