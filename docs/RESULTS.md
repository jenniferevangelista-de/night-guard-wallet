# Measured results

Run: 2026-11-06T19:52:23.480Z · Solana devnet · AI: gemma4:e2b on CPU (Codespace, 4 cores) · 3 runs per scenario and language.

| Scams stopped | Legit payments let through | Verdicts as expected | Verdict on screen (median) | Simulation on devnet (median) | Gemma reads + explains (median) | Refusals proven on-chain |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **10/10** | **4/4** | 14/14 | **199 ms** | 18 ms | 10.2 s | **5** |

The verdict comes from the simulation and the rules, so it is on screen before the model answers. Gemma then adds the tricks it finds in the message (it can only add warnings) and writes the plain-language explanation.

## Every scenario

| Scenario | Lang | Expected | Verdicts (with Gemma) | Flags | Scam tricks found | Vault said | Verdict on screen | Simulation | Gemma |
|---|---|---|---|---|---|---|--:|--:|--:|
| groceries | pt | OK | OK, OK, OK ✅ |  | none | ok | 103 ms | 18 ms | 3.4 s |
| groceries | en | OK | OK, OK, OK ✅ |  | none | ok | 75 ms | 18 ms | 4.5 s |
| fake-relative | pt | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:new_wallet<br>high:drains_balance<br>high:scam_script<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 208 ms | 18 ms | 11.4 s |
| fake-relative | en | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:new_wallet<br>high:drains_balance<br>high:scam_script<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 209 ms | 17 ms | 10.2 s |
| fake-support | pt | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | fake_support(rule), safe_wallet(rule), urgency(model) | ok | 207 ms | 20 ms | 15.3 s |
| fake-support | en | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | urgency(rule), safe_wallet(rule), fake_support(model) | ok | 224 ms | 19 ms | 16.2 s |
| airdrop-drainer | pt | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 99 ms | 18 ms | 10.5 s |
| airdrop-drainer | en | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 77 ms | 18 ms | 10.2 s |
| address-poisoning | pt | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 358 ms | 17 ms | 5.6 s |
| address-poisoning | en | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 346 ms | 17 ms | 5.2 s |
| fake-token-fee | pt | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 199 ms | 17 ms | 10.8 s |
| fake-token-fee | en | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 195 ms | 17 ms | 7.0 s |
| car-repair | pt | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 74 ms | 17 ms | 5.7 s |
| car-repair | en | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 74 ms | 17 ms | 6.3 s |

## What the person reads (last run)

- **groceries (pt)**: Está tudo certo. Você enviou 0,05 SOL, e a transação foi confirmada. _(model)_
- **groceries (en)**: This transaction is okay. You sent 0.05 SOL, and everything looks fine on this side. _(model)_
- **fake-relative (pt)**: Pare! Quem pede 1,8 SOL dizendo que troquei de número costuma ser golpista, e essa carteira você nunca usou. Ligue para o seu filho no número antigo antes de qualquer coisa. _(model)_
- **fake-relative (en)**: Stop! This request for 1.8 SOL is a scam because this wallet is new and you never sent money there. Do not send it and call your family right away. _(model)_
- **fake-support (pt)**: Pare! Alguém está pedindo 0,4 SOL para mudar o controle da sua conta. Esse link é falso e você nunca enviou para essa carteira. Não faça nada. _(model)_
- **fake-support (en)**: Stop! Someone is trying to take control of your funds with 0.4 SOL. Do not follow that link; call your family right away to talk about this. _(model)_
- **airdrop-drainer (pt)**: Pare! Essa mensagem é um golpe, pois permite que alguém tire todos os seus bens. Não clique no link e não envie nada. _(model)_
- **airdrop-drainer (en)**: Stop! A stranger can take all your money if you click that link, and the money they offer is fake. Do not click the link and do not send anything. _(model)_
- **address-poisoning (pt)**: Este endereço é PARECIDO com o de Ana (filha), mas NÃO é o mesmo (4QaK…qHpN × 4QaK…TexR). É um golpe de endereço copiado. _(template)_
- **address-poisoning (en)**: Stop! This address looks like someone else's, and you never sent 0.25 SOL to it. Do not send any money and call your family right away. _(model)_
- **fake-token-fee (pt)**: Você nunca enviou para essa carteira. Ela é nova: nunca foi usada. _(template)_
- **fake-token-fee (en)**: You never sent to this wallet. It is new: never used. _(template)_
- **car-repair (pt)**: Atenção, o valor de 1 SOL é um pouco alto, então espere um pouco antes de enviar. Verifique bem antes de fazer qualquer coisa. _(model)_
- **car-repair (en)**: Wait a little while because your wallet is holding onto that 1 SOL for a cooling-off time. You should wait before trying to send it again. _(model)_

## On-chain proofs (devnet)

Transactions sent on purpose without preflight, so the refusal is recorded on Solana.

| Step | Result | Transaction |
|---|---|---|
| legit: groceries to Ana, sent at once by the vault | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/2uRCEtTKTuBr9nBeV22zyqhJdCg7pLW8bp9nuc7qJWv96MF7wEuEDZmv15xNK6GnvWBeAwMtYjZMZK2ehJeYqsd6?cluster=devnet) |
| scam: 1.8 SOL to the 'new number' wallet, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/dksp5H8CYSnZrC69qBoz15iNBq8EWfYoTrVPR9cCYL3PV1xgg2YCT5NWDEdtiwhiG264to25aEkDiCEb98GrDBQ?cluster=devnet) |
| scam: 0.25 SOL to the look-alike of Ana, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/CSGMqYcTeqcQv4tSPrkekQKjDHCYBA4TW3bJ1Tvo8Pbr7AhG2VwhKMEpTfsF5NiRhgbjZDB2sr3mFTPuJ91E18k?cluster=devnet) |
| scam: owner + a fake 'guardian' try to trust the scammer | refused: {"InstructionError":[0,{"Custom":2001}]} | [explorer](https://explorer.solana.com/tx/4bC5m8jQy8ZzViJvB9nL44DaAGY3kqcU2hsULNsgZh3HhHpkwaUFKR4AxCULZ88WLqgbt1CVuZnb7bgKE31pcjfb?cluster=devnet) |
| request opened for the 'new number' (needs the guardian) | landed (0.6 s) | [explorer](https://explorer.solana.com/tx/5CZfabYJ5GrTbxoEmHJomSw7A9xjVNa3Yt9qhQvWS7QF85xWF795akLY6F4HzxZRBYMJCMyRQfQDs5y7PzFFG1fs?cluster=devnet) |
| guardian Ana says NO, signed on-chain | landed (0.7 s) | [explorer](https://explorer.solana.com/tx/29VSDf3vMWqeELDDA6qbkscrGYgS67padh6Rp1XR9ty8MseZi13ic8NeQSN6HE6W7zCUvZVgR6sw3HiUnm7qFXnf?cluster=devnet) |
| sending the rejected request anyway | refused: 6005 Rejected: The family guardian said no | [explorer](https://explorer.solana.com/tx/3pJyz14txG5qLJFC7qwBY4kSx494kYQz9dxwZwkj1DbcRihba1Y99FLu2JqbvdceGsp41X6oHSuYr7NX9RYnjGKH?cluster=devnet) |
| request opened: 1 SOL to Pedro (big amount) | landed (1.1 s) | [explorer](https://explorer.solana.com/tx/64snbhurjCz6ckTfNHcNsSw87D399wUwhyhRw8B7egBxkTeLwD4oQDZmQeXqahBnHRNuXy8qYWrCTaEmJc9NEhuA?cluster=devnet) |
| guardian Ana approves, signed on-chain | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/wfhMXSGfmXGmDGS3ki1rZz9vCsGHuFXQeEdKC5knVgiqatsjtDz7d6zEb9PQi6bsAMYx9STP8TueUxc2XYXXuHo?cluster=devnet) |
| sending before the cooling-off ends | refused: 6004 StillCoolingOff: Still in the cooling-off period | [explorer](https://explorer.solana.com/tx/5WzWweDVQwHxEre2mnPQygBDPfBV38hA3TmvvhFZ14ZvRvp2e9wVWYYaDucoxkTqDxX8UHK6sgBpCc6VKpBFVcyp?cluster=devnet) |
| after the cooling-off: 1 SOL goes to Pedro | landed (0.5 s) | [explorer](https://explorer.solana.com/tx/33oK7Yw31jrDRDDLAzCUnq2SKbYAPMKLtH2zWXHDE8edjb5suASiUpMTQnk3drWGsPiVXVUHa9dKrFJHCWBywwsn?cluster=devnet) |
