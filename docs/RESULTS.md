# Measured results

Run: 2026-11-06T20:39:50.782Z · Solana devnet · AI: gemma4:e2b on CPU (Codespace, 4 cores) · 3 runs per scenario and language.

| Scams stopped | Legit payments let through | Verdicts as expected | Verdict on screen (median) | Simulation on devnet (median) | Gemma reads + explains (median) | Refusals proven on-chain |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **5/5** | **2/2** | 14/14 | **205 ms** | 20 ms | 12.3 s | **5** |

The verdict comes from the simulation and the rules, so it is on screen before the model answers. Gemma then adds the tricks it finds in the message (it can only add warnings) and writes the plain-language explanation.

## Every scenario

| Scenario | Lang | Expected | Verdicts (with Gemma) | Flags | Scam tricks found | Vault said | Verdict on screen | Simulation | Gemma |
|---|---|---|---|---|---|---|--:|--:|--:|
| groceries | pt | OK | OK, OK, OK ✅ |  | none | ok | 85 ms | 21 ms | 5.8 s |
| groceries | en | OK | OK, OK, OK ✅ |  | none | ok | 82 ms | 21 ms | 6.5 s |
| fake-relative | pt | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:drains_balance<br>high:scam_script<br>medium:unknown_wallet<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 400 ms | 20 ms | 14.5 s |
| fake-relative | en | STOP | STOP, STOP, STOP ✅ | high:vault_refused<br>high:drains_balance<br>high:scam_script<br>medium:unknown_wallet<br>medium:unusual_amount | new_number(rule), urgency(rule), secrecy(rule) | NotTrusted | 347 ms | 20 ms | 14.9 s |
| fake-support | pt | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | fake_support(rule), safe_wallet(rule), urgency(model) | ok | 205 ms | 19 ms | 16.8 s |
| fake-support | en | STOP | STOP, STOP, STOP ✅ | critical:set_authority<br>critical:phishing_link<br>high:new_wallet<br>high:scam_script<br>medium:unusual_amount | urgency(rule), safe_wallet(rule), fake_support(model) | ok | 204 ms | 21 ms | 20.2 s |
| airdrop-drainer | pt | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 81 ms | 19 ms | 13.4 s |
| airdrop-drainer | en | STOP | STOP, STOP, STOP ✅ | critical:approve<br>critical:phishing_link<br>high:fake_token<br>high:scam_script | urgency(rule), prize(rule) | ok | 82 ms | 18 ms | 14.0 s |
| address-poisoning | pt | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 374 ms | 20 ms | 7.9 s |
| address-poisoning | en | STOP | STOP, STOP, STOP ✅ | critical:lookalike_address<br>high:vault_refused<br>high:new_wallet<br>medium:unusual_amount | none | NotTrusted | 356 ms | 20 ms | 7.6 s |
| fake-token-fee | pt | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 214 ms | 21 ms | 12.3 s |
| fake-token-fee | en | STOP | STOP, STOP, STOP ✅ | high:new_wallet<br>high:fake_token<br>medium:unusual_amount<br>medium:scam_script | fee_to_unlock(rule) | ok | 213 ms | 17 ms | 11.0 s |
| car-repair | pt | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 80 ms | 18 ms | 6.7 s |
| car-repair | en | CAUTION | CAUTION, CAUTION, CAUTION ✅ | medium:vault_refused | none | NeedsCoolingOff | 85 ms | 19 ms | 7.7 s |

## What the person reads (last run)

- **groceries (pt)**: Está tudo certo, você recebeu 0,05 SOL. Continue com suas coisas normalmente. _(model)_
- **groceries (en)**: This transaction is okay; you sent 0.05 SOL. Keep an eye on your wallet for any other activity. _(model)_
- **fake-relative (pt)**: Pare! Quem pede 1,8 SOL dizendo que trocou de número costuma ser golpista, e essa carteira você nunca usou. Ligue para o seu filho no número antigo antes de qualquer coisa. _(model)_
- **fake-relative (en)**: Stop! This request for 1.8 SOL is a scam because this wallet is not in your trusted list. Do not send the money and call your family right away. _(model)_
- **fake-support (pt)**: Pare! Alguém está pedindo 0,4 SOL para mudar o controle da sua conta. Não clique no link falso e não envie nada. _(model)_
- **fake-support (en)**: Stop! Someone is trying to take control of your money by moving it to a new place. Do not follow that link; protect your funds by not doing anything. _(model)_
- **airdrop-drainer (pt)**: Pare! Essa mensagem é um golpe, pois permite que alguém tire todos os seus bens. Não clique no link e não responda a ninguém. _(model)_
- **airdrop-drainer (en)**: Stop! A stranger can take all your money from this wallet. The link is fake and the money you have is worthless. Do not click anything and do not send anything. _(model)_
- **address-poisoning (pt)**: Pare! Essa carteira é parecida com a da sua filha, mas não é a dela. Não envie esse dinheiro e ligue para a sua família no número antigo. _(model)_
- **address-poisoning (en)**: Stop! This address looks like someone else's, and you never sent money there. Don't send that 0.25 SOL; call your daughter to check. _(model)_
- **fake-token-fee (pt)**: Pare! Essa mensagem parece um golpe, e o valor é muito maior que o normal. Não faça nada e ligue para alguém de confiança antes. _(model)_
- **fake-token-fee (en)**: Stop! This transaction is dangerous because the money is fake and the message is a scam. Do not send anything and call your family right away. _(model)_
- **car-repair (pt)**: Atenção, você precisa esperar um pouco antes de enviar esse 1 SOL. Espere um tempo para não ter problemas. _(model)_
- **car-repair (en)**: Wait a little while because that amount is too big for your wallet right now. Give it some time before you try sending it again. _(model)_

## On-chain proofs (devnet)

Transactions sent on purpose without preflight, so the refusal is recorded on Solana.

| Step | Result | Transaction |
|---|---|---|
| legit: groceries to Ana, sent at once by the vault | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/5VaF9M7mEv7mmQ2FCTCVNr3ugCv5nN25HaQnSs1gPJ3WwT42ZMzj7omZRGUBQYCU39ktnfkLEbimjbMPi9TrVK2W?cluster=devnet) |
| scam: 1.8 SOL to the 'new number' wallet, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/4TTBvbsErvCacsDw7HoFUUMBBgTwaiAHyJsZAUXFLwHSLAfM7ry5mTosyLYZLaSDsPXVC1PbCR3aVLzBkScQUYwc?cluster=devnet) |
| scam: 0.25 SOL to the look-alike of Ana, forced through | refused: 6000 NotTrusted: This wallet is not on your trusted contacts list | [explorer](https://explorer.solana.com/tx/bSQGs6e5wB7CQgqBjf2cbQmhuPLVYCGnje48jLxNZaV3aTZ2LLP8VWdwcdbGTpt95xkdK4QVXr1k37L6osA8AXC?cluster=devnet) |
| scam: owner + a fake 'guardian' try to trust the scammer | refused: 2001 ConstraintHasOne: the guardian must be the one saved in the vault | [explorer](https://explorer.solana.com/tx/3HZyQAoiEydnNscHJLimjNSReM5Rgt29XnUwSYbEu7dUNDF1zEsQyBouu5RyKARgLZctm4h2AKHkjgVjYoyhHeSp?cluster=devnet) |
| request opened for the 'new number' (needs the guardian) | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/4oeDJs7V3V9gW8FJjKtcVMB48jrxv5ccdk1XMJVwUAP8psfUjAsukcQwvx98R6f1yKbaXwYfrbnENbzw7gcdFb67?cluster=devnet) |
| guardian Ana says NO, signed on-chain | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/5yiChvhP564REqzEVZneFHUcQbKx25VSpfEWRVypPYUmCiXaPVFR3FfRVjituWevEosZJqBx2Z45R2MADpZqWPf8?cluster=devnet) |
| sending the rejected request anyway | refused: 6005 Rejected: The family guardian said no | [explorer](https://explorer.solana.com/tx/5FmUarppcqnr9qKViRTeiKNSxkd37ZcenwBNepJYadtNnr28z67ieoxT7Bg1eyTDTFCiduTKcqGWKBJmqJPKpCqd?cluster=devnet) |
| request opened: 1 SOL to Pedro (big amount) | landed (1.0 s) | [explorer](https://explorer.solana.com/tx/gm8N9D7g4ivKJqErmKtLnpoZqLgPsJY25Jrs9PwBEFBL4t2wegfdC99nD9qYqJNLvm7gd7j2UMv1shkaV8tHzeL?cluster=devnet) |
| guardian Ana approves, signed on-chain | landed (0.9 s) | [explorer](https://explorer.solana.com/tx/5ztd7Qc1oEGH5vXCzFL9kJt28Vzb1n3p5PTi4srzz41PCjwhUeMhRV2rekzz4U3QnMXpcumTomB4JGAjNgtFB7tP?cluster=devnet) |
| sending before the cooling-off ends | refused: 6004 StillCoolingOff: Still in the cooling-off period | [explorer](https://explorer.solana.com/tx/4gSGc4pVeWjGomeZrm5pyh2vm6TvLfBBWNsUnaidq4rTC65Ers3Ptr4wQWsY7JiCx77RG2cRXe4viqnrSLuBPFnN?cluster=devnet) |
| after the cooling-off: 1 SOL goes to Pedro | landed (0.8 s) | [explorer](https://explorer.solana.com/tx/621ckMCemvzWXXkRX2jTPgZncWmVbGAEvzRnvh6pEjHa2tx92wubCHa3geMpxXY1ZiVYJw1GSAQuc9tKAbYnvRrJ?cluster=devnet) |
