# Measured results

Run: 2026-11-07T07:55:26.749Z · Solana devnet · AI: gemma4:e2b on CPU, no GPU · 3 runs per scenario and language.

| Scams stopped | Legit payments let through | Verdicts as expected | Verdict on screen (median) | Simulation on devnet (median) | Gemma reads + explains (median) | Refusals proven on-chain |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **5/5** | **2/2** | 14/14 | **201 ms** | 15 ms | 16.3 s | **7** |

The verdict comes from the simulation and the rules, so it is on screen before the model answers. Gemma then adds the tricks it finds in the message (it can only add warnings) and writes the plain-language explanation.

## Community scam list

A report needs on-chain proof (a request of the family's vault to that wallet, refused by its guardian), each family counts once, the weight grows with the number of families (1 = warning, 2 = strong, 3+ = block; a trusted contact is never blocked), and a family can withdraw its report.

| Step | Reports | Level of the flag | Verdict for the "new number" request |
|---|:-:|:-:|:-:|
| before any report | 0 | none | STOP |
| 1 family | 1 | medium | STOP |
| 2 families | 2 | high | STOP |
| 3 families | 3 | critical | STOP |
| after one withdrawal | 2 | high | STOP |

## Every scenario

| Scenario | Lang | Expected | Verdicts (with Gemma) | Flags | Scam tricks found | Vault said | Verdict on screen | Simulation | Gemma |
|---|---|---|---|---|---|---|--:|--:|--:|
| groceries | pt | OK | OK, OK, OK ✅ |  | none | ok | 85 ms | 16 ms | 7.4 s |
| groceries | en | OK | OK, OK, OK ✅ |  | none | ok | 60 ms | 14 ms | 7.0 s |
| fake-relative | pt | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:drains_balance<br>high:scam_script<br>medium:unknown_wallet<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 396 ms | 17 ms | 19.3 s |
| fake-relative | en | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:drains_balance<br>high:scam_script<br>medium:unknown_wallet<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 449 ms | 15 ms | 18.8 s |
| fake-support | pt | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | fake_support(rule), safe_wallet(rule), urgency(model) | ok | 217 ms | 15 ms | 23.5 s |
| fake-support | en | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | urgency(rule), safe_wallet(rule), fake_support(model) | ok | 215 ms | 17 ms | 22.4 s |
| airdrop-drainer | pt | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 90 ms | 14 ms | 16.3 s |
| airdrop-drainer | en | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 83 ms | 14 ms | 16.3 s |
| address-poisoning | pt | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>medium:unknown_wallet<br>medium:unusual_amount | none | NotTrusted | 387 ms | 13 ms | 11.8 s |
| address-poisoning | en | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>medium:unknown_wallet<br>medium:unusual_amount | none | NotTrusted | 376 ms | 16 ms | 9.7 s |
| fake-token-fee | pt | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 201 ms | 16 ms | 17.6 s |
| fake-token-fee | en | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 188 ms | 15 ms | 15.9 s |
| car-repair | pt | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 66 ms | 14 ms | 9.6 s |
| car-repair | en | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 60 ms | 17 ms | 9.9 s |

## What the person reads (last run)

- **groceries (pt)**: Você enviou 0,05 SOL para a sua filha Ana. Isso foi uma transação normal. _(model)_
- **groceries (en)**: You sent 0.05 SOL to your daughter, Ana. This is a normal transfer from your money to her. _(model)_
- **fake-relative (pt)**: Pare! Alguém pediu 1,8 SOL dizendo que trocou de número, e essa carteira não é de confiança sua. Ligue para a sua família no número antigo agora. _(model)_
- **fake-relative (en)**: Stop! Someone asked for 1.8 SOL and said they changed their number. This is a scam, so do not send any money and call your family right away. _(model)_
- **fake-support (pt)**: Pare! Alguém está tentando mudar o dono dos seus fundos. Não faça nada e ligue para alguém de confiança antes de seguir qualquer instrução. _(model)_
- **fake-support (en)**: Stop! Someone tried to move 0.4 SOL out of your wallet to a new person, which means they took control. Do not trust that message and do not click any links. _(model)_
- **airdrop-drainer (pt)**: Pare! Essa mensagem é um golpe, pois ela diz que você ganhou algo. Não clique no link e não envie nada. _(model)_
- **airdrop-drainer (en)**: Stop! Someone is giving a stranger permission to take all your money, and the link is fake. Do not click it and do not send anything. _(model)_
- **address-poisoning (pt)**: Pare! Essa movimentação é suspeita porque o endereço é parecido com o da sua filha e não está na sua lista de confiança. Não envie nada e ligue para a sua família no número antigo. _(model)_
- **address-poisoning (en)**: Stop! Your wallet blocked this transfer because this address is not someone you trust. Do not send this 0.25 SOL and call your family right away. _(model)_
- **fake-token-fee (pt)**: Pare! Alguém pediu 0,4 SOL e disse que é para liberar algo, mas essa carteira é nova e o dinheiro que você tem não é o verdadeiro. Não envie nada e ligue para alguém de confiança. _(model)_
- **fake-token-fee (en)**: Stop! Someone tried to take away 0.4 SOL, but you never sent it to this address. This is a scam, so do not unlock anything and call your family right away. _(model)_
- **car-repair (pt)**: Você tem um valor pequeno, mas o sistema pode demorar um pouco para liberar. Espere um pouco antes de enviar o 1 SOL. _(model)_
- **car-repair (en)**: You tried to send 1 SOL to Pedro, but your wallet stopped it because it needs a waiting time. Wait for the time to pass before trying again. _(model)_

## On-chain proofs (devnet)

Transactions sent on purpose without preflight, so the refusal is recorded on Solana.

| Step | Result | Transaction |
|---|---|---|
| legit: groceries to Ana, sent at once by the vault | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/415YPYNGSQoM8hXw8dtpoYt96jJ6EtsJ2FhUqDj8H6cF4vHtoC2vzG6jtWKDr4ppMCARfLTCeoNukLWeFdReRLKs?cluster=devnet) |
| scam: 1.8 SOL to the 'new number' wallet, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/qfDRkWRKXxnfWNmT2pFdx5219k8GMgdikXNhVJtFRjT3b64qKKr8T3b3Bb2sdtruouTV2ireYAsBuYWuPR1Ckpa?cluster=devnet) |
| scam: 0.25 SOL to the look-alike of Ana, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/3uB4Uq6tyN3RJkG9ynY6P7siZQoYbQ2XagqPuhSRTikTo125Gii7QB2645KmwEuqswSqX8KnhTWLeJm7dntoN7gR?cluster=devnet) |
| scam: owner + a fake 'guardian' try to trust the scammer | refused: 2001 ConstraintHasOne: the guardian must be the one saved in the vault | [explorer](https://explorer.solana.com/tx/3cDfKvWK4kSoPZKtxx1DyhSmnqhbrTJYD6smgy6urw5nAe6C3QZRpeaP9dEpjbvDPekP8XX7oMkTsCAjMye62pg6?cluster=devnet) |
| request opened for the 'new number' (needs the guardian) | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/2u7KLwj94vu7N91vTVxvNqivpvd12dixq5TmcHgZbe5jdMzJpug1VbjLfmB1UJvLtSNBrhhRCMM1fEXp2QRfdn2v?cluster=devnet) |
| guardian Ana says NO, signed on-chain | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/4jQAyYnZg9WqL89CuvdpZPAVyjkzqFddsPqVuGsB6RmVv8HS6XhmGRXi1fbY4h1KZwrkJPhpv2UTHEPUVjaAvEUW?cluster=devnet) |
| sending the rejected request anyway | refused: 6005 Rejected: The family guardian said no | [explorer](https://explorer.solana.com/tx/5PAsuHfu3CMoTBUJXc1irGQwTaMJNzrda6ErTqrV5aJAA3DDd89ZC328oi1x1N7uyLRrFzaZ71bD6C2igzrsygBE?cluster=devnet) |
| Ana tries to report a wallet that never asked her family for money (no proof) | refused: 6015 NoProof: No proof: only a wallet that asked this family for money, and was refused by the guardian, can be reported | [explorer](https://explorer.solana.com/tx/4EVzZZp27EoMmy6Bj8EuKKviv5KDqW5hghTM7CKo56q5SXFHuit5CsnzuX5akReKdMnr4VaZkjHZU9puCgeBbQoK?cluster=devnet) |
| Ana reports the 'new number' wallet, with the refused request as proof | landed (1.1 s) | [explorer](https://explorer.solana.com/tx/4Msam6zwS8PkNNy8Ax3h4KkyzSdiMJw9PuLcEp4GrYdtLD2MExDpeBRd2nnq3QdHddewkfzef4SuNHveY1AUPZrv?cluster=devnet) |
| the same family reports it again (counts once) | refused: account already in use: this family already reported this wallet | [explorer](https://explorer.solana.com/tx/4vRupPwYjqzpf2mbjt3tZYRimPEgqvKFKURWup8KyMy4dhee9mi5v26Sbm5eFKZXxr5mcutLuAev3khiYqe7azSo?cluster=devnet) |
| a second family, asked for money by the same wallet, reports it with its own proof | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/3SaQrVMe8dEJY8YwPBjrMrZZMpiGLQKY93x5EkjvFUbhLJk5yLSbLdsTgN9pjh1fiFLsC3bmJChEXx2tVwVWgRWn?cluster=devnet) |
| a third family reports it too | landed (2.4 s) | [explorer](https://explorer.solana.com/tx/4UC3i3nq9sUkyzoL2b6czyDf7vQ9jEvZJAF7v7YjZBW4jzcWqssvD3ugQNQ1iVvBGmzZFLXJfH9pBYVjhjFDJp8i?cluster=devnet) |
| the third family withdraws its report (a mistake can be undone) | landed (0.7 s) | [explorer](https://explorer.solana.com/tx/4sJRyKKL3utrbXMNtr3QmXgi9Ek79xjy32rRGWU5Dc5hcLg1Knu3nUiP9Gqp5uCA2wku8XtSojftF54sfq9pdCqD?cluster=devnet) |
| request opened: 1 SOL to Pedro (big amount) | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/2UGqaM8nWAN9tJyd4KTxseeKbjxmGqtf2rqz6riS7YuCYDHqC4gNJMwUjaqfNFVhTrAtTPEneKJSP8qieBh8BpR2?cluster=devnet) |
| guardian Ana approves, signed on-chain | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/vujoFyRjF6hN317F85g52vFsd5d8TSk9UaXuW3bu2H35acd7KwUB3TYQSV8kUNFFZaUL7S31eirjfxDzg9tZakz?cluster=devnet) |
| sending before the cooling-off ends | refused: 6004 StillCoolingOff: Still in the cooling-off period | [explorer](https://explorer.solana.com/tx/2YoikHzLJcZ4q5LNorFYWhUe9JzdpewXo3wdkYBjNiBvc88c22SpYTmiCiUn1ymNFmXRLzjcD9f3V1HBJ7qDZjBQ?cluster=devnet) |
| after the cooling-off: 1 SOL goes to Pedro | landed (0.7 s) | [explorer](https://explorer.solana.com/tx/275mBDuD3kikRAtwU53D174x69usuwDc8iKyaYUjoTBbriJmiqYcuVtbMnuwuPaMqSFGcPBMgW4Y4E8xUQNpLKhp?cluster=devnet) |
