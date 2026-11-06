// Gemma (local, free, via Ollama) does two jobs:
//  1. reads the message that came with the payment request and finds scam tactics, quoting them;
//  2. writes the plain-language explanation for the person.
// The decision to lock a payment never depends on the model alone: rules on the simulated
// transaction decide, and the model can only ADD warnings, never remove them. Every quote the model
// gives must appear in the message, or it is dropped. If the model is off or slow, fixed texts are used.

import { AI, MODEL, OLLAMA_URL } from "./config.js";

export type Lang = "pt" | "en";
export const TACTICS = [
  "new_number", "urgency", "secrecy", "fake_support", "safe_wallet", "prize", "fee_to_unlock", "secret_words", "emotional", "too_good",
] as const;
export type Tactic = (typeof TACTICS)[number];
export interface Found { id: Tactic; quote: string; by: "model" | "rule" }

// Fixed patterns, PT and EN. They are the floor: the model can only add to them.
const RULES: Record<Tactic, RegExp> = {
  new_number: /(troquei de (n[uú]mero|celular|chip)|meu n[uú]mero novo|(esse|este) [eé] (o )?meu (novo )?n[uú]mero|new (phone )?number|changed my (phone|number)|this is my new)/i,
  urgency: /(urgente|urg[eê]ncia|agora mesmo|o quanto antes|r[aá]pido|ainda hoje|hoje ainda|em \d+ ?min|imediatamente|[uú]ltima chance|urgent|right now|immediately|asap|as soon as possible|within \d+ ?min|last chance|today only|hurry)/i,
  secrecy: /(n[aã]o (conta|fala|comenta|diga)|segredo|s[oó] entre n[oó]s|don'?t tell|keep (it|this) (a )?secret|between us|no one (needs|has) to know)/i,
  fake_support: /(suporte|central (de )?seguran[cç]a|atendente|equipe de seguran[cç]a|gerente do banco|do banco|sua conta (foi|est[aá]) (bloqueada|invadida|suspensa)|support (team|agent)|security (team|department)|your (account|wallet) (has been|was|is) (locked|blocked|compromised|suspended)|bank (officer|manager))/i,
  safe_wallet: /(carteira segura|conta segura|migra[cç][aã]o|migrar (seus|os) fundos|proteger (seus|os) fundos|safe wallet|secure wallet|migrate (your )?funds|protect your funds)/i,
  prize: /(voc[eê] ganhou|ganhe|gr[aá]tis|pr[eê]mio|sorteio|airdrop|resgat(ar|e)|you (have )?won|free (tokens?|usdc|sol|money)|claim (your|now)|reward)/i,
  fee_to_unlock: /(taxa (de|para) (libera|desbloqu|resgat)|pague (a|uma) taxa|para liberar|para desbloquear|pay (a|the) (small )?fee|fee to (unlock|release|claim)|to unlock (your|the))/i,
  secret_words: /(frase secreta|12 palavras|24 palavras|frase de recupera[cç][aã]o|chave privada|seed phrase|secret (recovery )?phrase|private key|recovery phrase)/i,
  too_good: /(lucro garantido|retorno garantido|investimento garantido|receba o dobro|dobr(a|e) (o seu|seu) dinheiro|\d+x (seus|o seu)|guaranteed (return|profit|investment)|double (your|back)|receive double|\d+x your)/i,
  emotional: /(hospital|acidente|pres[oa]\b|delegacia|advogado|fian[cç]a|socorro|accident|in jail|arrested|lawyer|bail|emergency|emerg[eê]ncia)/i,
};

export function ruleTactics(message: string): Found[] {
  const out: Found[] = [];
  for (const id of TACTICS) {
    const m = message.match(RULES[id]);
    if (m) out.push({ id, quote: m[0], by: "rule" });
  }
  return out;
}

const SYSTEM = `You protect older people from payment scams. You read one message that came with a request to send money
or sign a crypto transaction, and list the scam tactics it uses. Tactics (use these ids only):
- new_number: says they are family/friend with a new phone or number
- urgency: pressure to act now, deadlines, "last chance"
- secrecy: asks not to tell anyone
- fake_support: claims to be bank, wallet, exchange or security support
- safe_wallet: asks to move funds to a "safe" or new wallet, "migration"
- prize: prize, free tokens, airdrop, reward, giveaway
- fee_to_unlock: pay a fee or tax to receive or unlock money
- secret_words: asks for seed phrase, secret words or private key
- emotional: accident, hospital, jail, lawyer, emergency
- too_good: guaranteed profit, "double your money", "send X get 2X back"
For each tactic found, copy the exact words from the message as "quote" (verbatim, short).
Ordinary family messages (paying a known bill, splitting dinner, birthday gift without pressure) have NO tactics.
Return JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    tactics: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string", enum: [...TACTICS] }, quote: { type: "string" } }, required: ["id", "quote"] },
    },
  },
  required: ["tactics"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

async function ollama(system: string, user: string, format: object, timeoutMs = 60_000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, stream: false, format, think: false, keep_alive: "60m",
        options: { temperature: 0, num_ctx: 2048 },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return JSON.parse(j.message.content);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function modelTactics(message: string, useModel = true): Promise<{ found: Found[]; ms: number; used: boolean }> {
  const t0 = performance.now();
  if (AI !== "ollama" || !useModel || !message.trim()) return { found: [], ms: 0, used: false };
  const raw = await ollama(SYSTEM, `Message:\n"""${message}"""\nReturn the JSON.`, SCHEMA);
  const ms = performance.now() - t0;
  if (!raw || !Array.isArray(raw.tactics)) return { found: [], ms, used: false };
  const msg = norm(message);
  const found: Found[] = [];
  for (const t of raw.tactics) {
    if (!TACTICS.includes(t?.id) || typeof t.quote !== "string") continue;
    const q = norm(t.quote);
    if (q.length < 3 || !msg.includes(q)) continue; // evidence check: the quote must really be in the message
    if (!found.some((f) => f.id === t.id)) found.push({ id: t.id, quote: t.quote.trim(), by: "model" });
  }
  return { found, ms, used: true };
}

/** Rules first, model adds what the rules missed. */
export async function scamTactics(message: string, useModel = true) {
  const rules = ruleTactics(message);
  const m = await modelTactics(message, useModel);
  const all = [...rules];
  for (const f of m.found) if (!all.some((a) => a.id === f.id)) all.push(f);
  return { tactics: all, modelMs: m.ms, modelUsed: m.used };
}

const EXPLAIN_SYSTEM = {
  pt: `Você explica transações de carteira para uma pessoa idosa, em português do Brasil, com palavras simples.
Escreva 1 ou 2 frases curtas (no máximo 45 palavras no total), falando com a pessoa ("você").
Use exatamente o valor que vier em "valor". Não use jargão (nada de "assinar", "token account", "delegate", "SOL" sem o número).
Se o veredito for PARE, diga com clareza o perigo principal e o que fazer (por exemplo: não enviar, ligar para a família no número antigo).
Nunca diga que é seguro quando o veredito for PARE. Baseie-se só nos fatos dados; não invente nada. Responda em JSON.
Exemplo: {"veredito":"PARE","valor":"1,8 SOL","fatos":["Você nunca enviou para essa carteira.","tactic new_number: \"troquei de número\""]}
-> {"text":"Pare! Quem pede 1,8 SOL dizendo que trocou de número costuma ser golpista, e essa carteira você nunca usou. Ligue para o seu filho no número antigo antes de qualquer coisa."}`,
  en: `You explain wallet transactions to an older person in plain English.
Write 1 or 2 short sentences (45 words max in total), talking to the person ("you").
Use the exact amount given in "amount". No jargon (no "sign", "token account", "delegate").
If the verdict is STOP, say the main danger clearly and what to do (for example: don't send, call family on the old number).
Never say it is safe when the verdict is STOP. Use only the facts given; invent nothing. Answer in JSON.
Example: {"verdict":"STOP","amount":"1.8 SOL","facts":["You never sent to this wallet.","tactic new_number: \"changed my number\""]}
-> {"text":"Stop! People who ask for 1.8 SOL saying they changed their number are usually scammers, and you never used this wallet. Call your son on his old number first."}`,
};
const EXPLAIN_SCHEMA = { type: "object", properties: { text: { type: "string" } }, required: ["text"] };

export async function explain(facts: { verdict: string; amount: string; lines: string[]; lang: Lang; fallback: string; moneyOut?: boolean }, useModel = true) {
  const t0 = performance.now();
  if (AI !== "ollama" || !useModel) return { text: facts.fallback, ms: 0, by: "template" as const };
  const user = JSON.stringify({ veredito: facts.verdict, verdict: facts.verdict, valor: facts.amount, amount: facts.amount, fatos: facts.lines, facts: facts.lines });
  const raw = await ollama(EXPLAIN_SYSTEM[facts.lang], user, EXPLAIN_SCHEMA, 45_000);
  const ms = performance.now() - t0;
  const text: string = raw?.text?.trim() ?? "";
  // Any amount the model writes must be the real one (no invented numbers). Leaving it out is fine.
  const val = (x: string) => Number(x.replace(",", "."));
  const real = facts.amount ? val(facts.amount.replace(/\s*SOL$/, "")) : null;
  const said = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*SOL/gi)].map((m) => val(m[1]));
  const okAmount = said.every((x) => real !== null && Math.abs(x - real) < 1e-9);
  const words = text.split(/\s+/).length;
  const saysSafe = /\b(seguro|safe|tranquil|pode seguir|go ahead)\b/i.test(text);
  const wrongWay = !!facts.moneyOut && /\b(recebeu|receber|recebe|recebendo|received|receive|receiving)\b/i.test(text); // money leaves: never "you received"
  if (!text || !okAmount || wrongWay || words > 60 || (facts.verdict.startsWith("STOP") || facts.verdict.startsWith("PARE")) && saysSafe) {
    if (text) console.warn("[explain] model text rejected:", JSON.stringify(text).slice(0, 300));
    return { text: facts.fallback, ms, by: "template" as const };
  }
  return { text, ms, by: "model" as const };
}
