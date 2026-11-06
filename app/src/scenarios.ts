// Seven real-world situations an older person meets. Each one is the message that arrived plus the
// transaction an app or a "helpful" stranger asks them to sign. All people and messages are fictional.

import {
  createApproveInstruction, createSetAuthorityInstruction, AuthorityType,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { buildTx, ix } from "./vault.js";
import { World } from "./world.js";
import { MEMO_PROGRAM } from "./known.js";

export interface Scenario {
  id: string;
  expect: "STOP" | "CAUTION" | "OK";
  kind: "scam" | "legit";
  title: { pt: string; en: string };
  channel: { pt: string; en: string };
  from: { pt: string; en: string };
  message: { pt: string; en: string };
  link?: string;
  qr?: string; // Solana Pay URL
  // what to do if the person asks the family: open a vault request (on-chain) or just alert
  vaultPath: boolean;
  build: (w: World) => Promise<{ tx: VersionedTransaction; to: PublicKey | null; lamports: number }>;
}

const SOL = (x: number) => Math.round(x * LAMPORTS_PER_SOL);
const U64_MAX = 18446744073709551615n;
const memo = (t: string) => new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [], data: Buffer.from(t) });

export const SCENARIOS: Scenario[] = [
  {
    id: "groceries", expect: "OK", kind: "legit", vaultPath: true,
    title: { pt: "Ana pede o dinheiro do mercado", en: "Ana asks for the grocery money" },
    channel: { pt: "WhatsApp (número salvo da Ana)", en: "WhatsApp (Ana's saved number)" },
    from: { pt: "Ana (filha)", en: "Ana (daughter)" },
    message: {
      pt: "Mãe, pode me mandar os 0,05 do mercado que eu paguei ontem? Beijo, te ligo à noite.",
      en: "Mom, can you send me the 0.05 for the groceries I paid yesterday? Love you, I'll call you tonight.",
    },
    build: async (w) => ({ tx: await buildTx(w.conn, w.elder, [await ix(w.conn).send(w.elder, w.ana, SOL(0.05))]), to: w.ana, lamports: SOL(0.05) }),
  },
  {
    id: "fake-relative", expect: "STOP", kind: "scam", vaultPath: true,
    title: { pt: "O \"filho\" que trocou de número", en: "The \"son\" with a new number" },
    channel: { pt: "WhatsApp (número desconhecido)", en: "WhatsApp (unknown number)" },
    from: { pt: "+55 11 9xxxx-4821", en: "+1 (555) 014-4821" },
    message: {
      pt: "Oi mãe, sou eu, troquei de número. Tô com um problema, preciso pagar um boleto urgente ainda hoje. Me manda 1,8 SOL nessa carteira e não conta pro pai, depois te explico.",
      en: "Hi mom, it's me, I changed my number. I'm in trouble and need to pay a bill urgently today. Send 1.8 SOL to this wallet and don't tell dad, I'll explain later.",
    },
    build: async (w) => ({ tx: await buildTx(w.conn, w.elder, [await ix(w.conn).send(w.elder, w.fakeRelative, SOL(1.8))]), to: w.fakeRelative, lamports: SOL(1.8) }),
  },
  {
    id: "fake-support", expect: "STOP", kind: "scam", vaultPath: false,
    title: { pt: "Falso suporte da carteira", en: "Fake wallet support" },
    channel: { pt: "SMS + site", en: "SMS + website" },
    from: { pt: "\"Central de Segurança Phantom\"", en: "\"Phantom Security Center\"" },
    message: {
      pt: "Central de Segurança Phantom: detectamos um acesso suspeito na sua carteira. Para proteger seus fundos, autorize a migração para a carteira segura em até 10 minutos.",
      en: "Phantom Security Center: we detected suspicious access to your wallet. To protect your funds, authorize the migration to the safe wallet within 10 minutes.",
    },
    link: "https://phantom-seguranca.com/migrar",
    build: async (w) => ({
      tx: await buildTx(w.conn, w.elder, [
        createSetAuthorityInstruction(w.elderNusd!, w.elder, AuthorityType.AccountOwner, w.fakeSupport),
        SystemProgram.transfer({ fromPubkey: w.elder, toPubkey: w.fakeSupport, lamports: SOL(0.4) }),
      ]),
      to: w.fakeSupport, lamports: SOL(0.4),
    }),
  },
  {
    id: "airdrop-drainer", expect: "STOP", kind: "scam", vaultPath: false,
    title: { pt: "\"Airdrop grátis\" que esvazia a carteira", en: "\"Free airdrop\" that empties the wallet" },
    channel: { pt: "Link (Blink) no grupo da família", en: "Link (Blink) in the family group" },
    from: { pt: "Contato do grupo", en: "Group contact" },
    message: {
      pt: "🎁 Você ganhou 500 USDC grátis no airdrop da Solana! Resgate agora, é a última chance:",
      en: "🎁 You won 500 free USDC in the Solana airdrop! Claim now, it's your last chance:",
    },
    link: "https://so1ana-airdrop.com/claim",
    build: async (w) => ({
      tx: await buildTx(w.conn, w.elder, [
        createApproveInstruction(w.elderNusd!, w.drainer, w.elder, U64_MAX),
        memo("claim airdrop"),
      ]),
      to: null, lamports: 0,
    }),
  },
  {
    id: "address-poisoning", expect: "STOP", kind: "scam", vaultPath: true,
    title: { pt: "QR com endereço \"da Ana\" copiado do histórico", en: "QR with \"Ana's\" address copied from history" },
    channel: { pt: "QR Solana Pay", en: "Solana Pay QR" },
    from: { pt: "Histórico da carteira", en: "Wallet history" },
    message: {
      pt: "Pagamento para Ana: 0,25 SOL (endereço copiado do histórico de transações).",
      en: "Payment to Ana: 0.25 SOL (address copied from the transaction history).",
    },
    qr: "solana:{lookalike}?amount=0.25&label=Ana&message=Mercado",
    build: async (w) => ({ tx: await buildTx(w.conn, w.elder, [await ix(w.conn).send(w.elder, w.lookalike, SOL(0.25))]), to: w.lookalike, lamports: SOL(0.25) }),
  },
  {
    id: "fake-token-fee", expect: "STOP", kind: "scam", vaultPath: false,
    title: { pt: "\"Você recebeu 1.000 USDC, pague a taxa\"", en: "\"You got 1,000 USDC, pay the fee\"" },
    channel: { pt: "Mensagem no app", en: "In-app message" },
    from: { pt: "\"Suporte de Saques\"", en: "\"Withdrawal Support\"" },
    message: {
      pt: "Parabéns! Você recebeu 1.000 USDC na sua carteira. Para liberar o saque, pague a taxa de 0,4 SOL para a carteira abaixo.",
      en: "Congratulations! You received 1,000 USDC in your wallet. To unlock the withdrawal, pay the 0.4 SOL fee to the wallet below.",
    },
    build: async (w) => ({ tx: await buildTx(w.conn, w.elder, [SystemProgram.transfer({ fromPubkey: w.elder, toPubkey: w.feeScammer, lamports: SOL(0.4) })]), to: w.feeScammer, lamports: SOL(0.4) }),
  },
  {
    id: "car-repair", expect: "CAUTION", kind: "legit", vaultPath: true,
    title: { pt: "Pedro: conserto do carro (valor alto)", en: "Pedro: car repair (big amount)" },
    channel: { pt: "Ligação do Pedro (número salvo)", en: "Call from Pedro (saved number)" },
    from: { pt: "Pedro (filho)", en: "Pedro (son)" },
    message: {
      pt: "Mãe, a oficina fechou o conserto do carro em 1 SOL. Pode mandar quando der, sem pressa nenhuma.",
      en: "Mom, the garage quoted 1 SOL for the car repair. Send it whenever you can, no rush at all.",
    },
    build: async (w) => ({ tx: await buildTx(w.conn, w.elder, [await ix(w.conn).send(w.elder, w.pedro, SOL(1.0))]), to: w.pedro, lamports: SOL(1.0) }),
  },
];

export function qrFor(s: Scenario, w: World) {
  return s.qr?.replace("{lookalike}", w.lookalike.toBase58());
}

/** Solana Pay transfer request: solana:<recipient>?amount=&label=&message=&spl-token= */
export function parseSolanaPay(url: string) {
  const m = url.match(/^solana:([1-9A-HJ-NP-Za-km-z]{32,44})(\?.*)?$/);
  if (!m) return null;
  const q = new URLSearchParams(m[2]?.slice(1) ?? "");
  return { recipient: m[1], amount: q.get("amount"), label: q.get("label"), message: q.get("message"), splToken: q.get("spl-token") };
}
