// Offline tests: no network, no model.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuthorityType, createApproveInstruction, createCloseAccountInstruction, createSetAuthorityInstruction } from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { ruleTactics } from "../src/ai.js";
import { decodeAll, isUnlimited } from "../src/decode.js";
import { hostOf, lookalikeBrand, looksLike } from "../src/known.js";
import { parseSolanaPay } from "../src/scenarios.js";
import { ix } from "../src/vault.js";
import { Connection } from "@solana/web3.js";

const k = () => Keypair.generate().publicKey;

test("fake sites that imitate Solana brands are caught, official ones are not", () => {
  for (const u of ["https://so1ana-airdrop.com/claim", "phantom-seguranca.com/migrar", "https://phantorn.app", "solflare-support.net", "https://xn--slana-9ua.com"])
    assert.ok(lookalikeBrand(hostOf(u)), u);
  for (const u of ["https://solana.com", "https://phantom.com/download", "https://jup.ag", "https://dial.to/?action=x", "https://example.org"])
    assert.equal(lookalikeBrand(hostOf(u)), null, u);
});

test("address that only looks like a trusted contact", () => {
  assert.ok(looksLike("4QaK8XeVEQ6LNityLWUZ73WJVDcZSg3kNHJfXWKzqHpN", "4QaKgyS8rDSwWkJ1cXidbS3b5bmxWtbRHfa76K49TexR"));
  assert.ok(!looksLike("4QaKgyS8rDSwWkJ1cXidbS3b5bmxWtbRHfa76K49TexR", "4QaKgyS8rDSwWkJ1cXidbS3b5bmxWtbRHfa76K49TexR"));
});

test("scam tricks in PT and EN, none in ordinary family messages", () => {
  const ids = (m: string) => ruleTactics(m).map((t) => t.id);
  assert.deepEqual(ids("Oi mãe, troquei de número, preciso urgente, não conta pro pai"), ["new_number", "urgency", "secrecy"]);
  assert.ok(ids("Confirm your seed phrase to keep access").includes("secret_words"));
  assert.ok(ids("Para liberar o saque, pague a taxa de 0,4 SOL").includes("fee_to_unlock"));
  assert.deepEqual(ids("Vó, obrigado pelo presente! Domingo passo aí."), []);
  assert.deepEqual(ids("Mom, can you send me the 0.05 for the groceries? Love you!"), []);
});

test("drainer instructions are decoded: unlimited approve, owner change, close to stranger", () => {
  const acc = k(), owner = k(), thief = k();
  const a = decodeAll([
    createApproveInstruction(acc, thief, owner, 18446744073709551615n),
    createSetAuthorityInstruction(acc, owner, AuthorityType.AccountOwner, thief),
    createCloseAccountInstruction(acc, thief, owner),
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: thief, lamports: 5 }),
  ]);
  assert.equal(a[0].kind, "approve");
  assert.ok(a[0].kind === "approve" && isUnlimited(a[0].amount));
  assert.ok(a[1].kind === "set_authority" && a[1].authorityType === "AccountOwner" && a[1].newAuthority === thief.toBase58());
  assert.ok(a[2].kind === "close_account" && a[2].destination === thief.toBase58());
  assert.ok(a[3].kind === "sol_transfer" && a[3].lamports === 5);
});

test("vault instructions are decoded from the program IDL", async () => {
  const conn = new Connection("http://127.0.0.1:1");
  const owner = k(), to = k();
  const a = decodeAll([await ix(conn).send(owner, to, 123), await ix(conn).request(owner, to, 456, 0, "x")]);
  assert.deepEqual(a.map((x) => x.kind), ["vault_send", "vault_request"]);
  assert.ok(a[0].kind === "vault_send" && a[0].to === to.toBase58() && a[0].lamports === 123);
});

test("Solana Pay transfer request", () => {
  const p = parseSolanaPay("solana:4QaK8XeVEQ6LNityLWUZ73WJVDcZSg3kNHJfXWKzqHpN?amount=0.25&label=Ana&message=Mercado");
  assert.equal(p?.amount, "0.25");
  assert.equal(p?.label, "Ana");
});
