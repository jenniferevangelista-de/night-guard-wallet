# Measured results

Run: 2026-11-07T06:46:17.789Z · Solana devnet · AI: gemma4:e2b on CPU (GitHub Actions runner, no GPU) · 3 runs per scenario and language.

| Scams stopped | Legit payments let through | Verdicts as expected | Verdict on screen (median) | Simulation on devnet (median) | Gemma reads + explains (median) | Refusals proven on-chain |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **5/5** | **2/2** | 14/14 | **227 ms** | 19 ms | 17.3 s | **6** |

The verdict comes from the simulation and the rules, so it is on screen before the model answers. Gemma then adds the tricks it finds in the message (it can only add warnings) and writes the plain-language explanation.

**Community scam list:** after Ana refused the "new number" request, she reported the wallet on-chain; a second family reported it too, and the same family could not count twice. The wallet now has **2 reports**, and the next check shows: _The wallet Uonp…ZU8U was already REPORTED as a scam by 2 families on the community list on Solana._ (verdict STOP in 3741 ms).

## Every scenario

| Scenario | Lang | Expected | Verdicts (with Gemma) | Flags | Scam tricks found | Vault said | Verdict on screen | Simulation | Gemma |
|---|---|---|---|---|---|---|--:|--:|--:|
| groceries | pt | OK | OK, OK, OK ✅ |  | none | ok | 106 ms | 19 ms | 7.5 s |
| groceries | en | OK | OK, OK, OK ✅ |  | none | ok | 86 ms | 20 ms | 7.2 s |
| fake-relative | pt | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:new_wallet<br>high:drains_balance<br>high:scam_script<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 241 ms | 20 ms | 18.8 s |
| fake-relative | en | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:new_wallet<br>high:drains_balance<br>high:scam_script<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 234 ms | 18 ms | 17.4 s |
| fake-support | pt | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | fake_support(rule), safe_wallet(rule), urgency(model) | ok | 264 ms | 19 ms | 24.0 s |
| fake-support | en | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | urgency(rule), safe_wallet(rule), fake_support(model) | ok | 227 ms | 20 ms | 26.4 s |
| airdrop-drainer | pt | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 109 ms | 20 ms | 17.3 s |
| airdrop-drainer | en | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 101 ms | 19 ms | 18.1 s |
| address-poisoning | pt | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 455 ms | 19 ms | 13.1 s |
| address-poisoning | en | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 329 ms | 19 ms | 10.0 s |
| fake-token-fee | pt | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 212 ms | 21 ms | 17.7 s |
| fake-token-fee | en | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 232 ms | 19 ms | 16.4 s |
| car-repair | pt | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 93 ms | 18 ms | 10.0 s |
| car-repair | en | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 84 ms | 18 ms | 9.9 s |

## What the person reads (last run)

- **groceries (pt)**: Você enviou 0,05 SOL para a Ana, sua filha. Isso foi um envio normal. _(model)_
- **groceries (en)**: You sent 0.05 SOL to Ana. This is a transfer from your wallet to her. _(model)_
- **fake-relative (pt)**: Pare! Alguém pediu 1,8 SOL dizendo que trocou de número, e essa carteira é nova. Não envie nada e ligue para sua família no número antigo. _(model)_
- **fake-relative (en)**: Stop! Someone asked for 1.8 SOL and said they changed their number. You never sent money to this person, so do not send anything. _(model)_
- **fake-support (pt)**: Pare! Alguém está dizendo que você precisa mudar seu dinheiro para outra conta, mas você nunca enviou para ela. Não faça nada e ligue para alguém de confiança. _(model)_
- **fake-support (en)**: Stop! Someone tried to move 0.4 SOL out of your wallet to a new person. This is a scam, so do not trust that message. _(model)_
- **airdrop-drainer (pt)**: Pare! Essa mensagem é um golpe, pois ela diz que você ganhou algo. Não clique no link e não envie nada. _(model)_
- **airdrop-drainer (en)**: Stop! Someone is asking to give away all your money to a fake site, and the money they offer is fake. Don't click that link and don't send anything. _(model)_
- **address-poisoning (pt)**: Pare! Essa movimentação é suspeita porque você nunca enviou para essa carteira. Não faça nada e ligue para sua família no número antigo. _(model)_
- **address-poisoning (en)**: Stop! This transaction is suspicious because the address looks like someone else's, and your vault blocked it. Do not send the 0.25 SOL; call your family to check. _(model)_
- **fake-token-fee (pt)**: Pare! Alguém pediu 0,4 SOL e disse que é para liberar algo, mas essa carteira é nova e o dinheiro que você tem não é o verdadeiro. Não envie nada e ligue para alguém de confiança. _(model)_
- **fake-token-fee (en)**: Stop! Someone tried to take away 0.4 SOL, but you never sent anything to that address. This looks like a trick, so don't do anything and call your family. _(model)_
- **car-repair (pt)**: Você tem um valor pequeno, mas o sistema pode demorar um pouco para liberar. Espere um pouco antes de enviar o 1 SOL. _(model)_
- **car-repair (en)**: You have 1 SOL ready to send to Pedro. However, the system is pausing this big amount for a cooling-off time before it can leave your vault. _(model)_

## On-chain proofs (devnet)

Transactions sent on purpose without preflight, so the refusal is recorded on Solana.

| Step | Result | Transaction |
|---|---|---|
| legit: groceries to Ana, sent at once by the vault | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/4tmnTcyT5wamkg6b53QdALmn8tp9kQRVDKoj1t62S3V712z2y5gubgva7W1PAJoSodd8vqzALLNzfJe4UqSLBkqx?cluster=devnet) |
| scam: 1.8 SOL to the 'new number' wallet, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/2qNiMzRNMbZAhjRQCEwLpxNCMqbqmT2bub6DUNDY4ocH1GwKy4NEPYmDWDuRH8DavhUNjfMSDppJKTm74c7MMgUH?cluster=devnet) |
| scam: 0.25 SOL to the look-alike of Ana, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/5g8FSsbd9Se8xvvMooc5Jj5hqFSWwZSenkVHqZkdYSsbJ8JMAJVMMz9oyqVhS8xRafS2kpxHZgyYn1GyVSMCu6fn?cluster=devnet) |
| scam: owner + a fake 'guardian' try to trust the scammer | refused: 2001 ConstraintHasOne: the guardian must be the one saved in the vault | [explorer](https://explorer.solana.com/tx/2mgqbMP6rPq6aAD6PxFJdL7AqqyUvL7kZyKoDMahun4Wu19RsKMLZdFhGMLEvgcpRFdkWG9ptKsGJPEUXoqr8gq1?cluster=devnet) |
| request opened for the 'new number' (needs the guardian) | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/zxxKoqQ56WZbqu4cSC6j8gChbUpnuA8eEEppM7vva3XoXCHjAJGNzDyAcTjNqfKsyu74vPnSJR2dLCmE8xKcyXd?cluster=devnet) |
| guardian Ana says NO, signed on-chain | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/ce92xY3594sK71Waj28xWfHPXvGb7c7PYQSnbNGgvLqX915ZnHaMMknm8uBvzQBVpscexknBUtcR7p2SV6idYXC?cluster=devnet) |
| sending the rejected request anyway | refused: 6005 Rejected: The family guardian said no | [explorer](https://explorer.solana.com/tx/4LLFYYpDpLCcrFJpkSqgU9Ug85JMhsNSGGvtVfX4dPArFsvZ3Ynyz9xB1ANCpLy6jA9d1Xe5uron1ybNbmpsnRU6?cluster=devnet) |
| Ana reports the 'new number' wallet on the community scam list | landed (0.8 s) | [explorer](https://explorer.solana.com/tx/4W2idEsLPXpzJjrXkH7tGQqEdJ9dTNzPdSMJpGBzzXSdXN3JGBmRXaHASEkzbY5vJ4c6FtXcd86WPFw3aUgf3rpq?cluster=devnet) |
| the same family reports it again (counts once) | refused: account already in use: this family already reported this wallet | [explorer](https://explorer.solana.com/tx/5aoiyQPHTScDYqXNAoRXVngZiJCt4bZjF7cCgtaxv9DM66MckW8ufwW2qNVK4LkehDZyA9WWD1ecd9D2spQYH4zh?cluster=devnet) |
| a second family (another vault's guardian) reports the same wallet | landed (0.7 s) | [explorer](https://explorer.solana.com/tx/5UUNeDvyPnZnHnLM98w1ntf2Le6i3RpTvE8aTM948NBZsYC5TJSbVYLhwuuGRzyB1Vm2BLrKLzGgF4X4isc7z7mC?cluster=devnet) |
| request opened: 1 SOL to Pedro (big amount) | landed (1.3 s) | [explorer](https://explorer.solana.com/tx/3dDE4QHYhP5bgQLhrdLfZhBpXfjrDjgwmBdPd7HaepYcB2zSPpYqzrxwtTWkuwG7oRQwQYy8E492RfUUuTJdsNJC?cluster=devnet) |
| guardian Ana approves, signed on-chain | landed (1.3 s) | [explorer](https://explorer.solana.com/tx/3LbMuUL9WHiD3dVy5J3876oQuGhJYAhNufzAaDiEpSro4bECBD2PZ6rLzjsQsepwQRkE9yTwCajoPFpjKJZA46mD?cluster=devnet) |
| sending before the cooling-off ends | refused: 6004 StillCoolingOff: Still in the cooling-off period | [explorer](https://explorer.solana.com/tx/2wPvTVeWZehPEm8noFdJpELweTw4A6SwEQULXii3v15d7mERZ9vSmNHsY3BhPiEPAJaRV41JDJiehrYWKnVhm3Cf?cluster=devnet) |
| after the cooling-off: 1 SOL goes to Pedro | landed (0.8 s) | [explorer](https://explorer.solana.com/tx/4i8sHi6dDjB9vVamiDGi8rmcRBu8jfsKbAxi2KESQQfZqfSLRhT2u99VYem51xyR7YafKyrTrxf7XpU8z2VLsfBm?cluster=devnet) |
