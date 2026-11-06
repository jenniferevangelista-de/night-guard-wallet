# Message evaluation: does it recognise the scam story?

60 fictional messages written for this project ([app/eval/messages.jsonl](../app/eval/messages.jsonl)): **32 scam scripts** (fake relative with a new number, fake bank or wallet support, "safe wallet" migration, prizes and airdrops, fee to unlock, seed-phrase requests, accident and bail, guaranteed profit) and **28 ordinary family messages**, some with words that sound urgent ("urgent to let Mrs. Clark know", "quick: the pharmacy closes at 10pm"). Half in Portuguese, half in English.

A message counts as flagged when at least one scam trick is found. Gemma's tricks only count when the quote it gives is really in the message.

Model: gemma4:e2b via Ollama, on CPU (Codespace, 4 cores, no GPU). Run: 2026-11-06T19:41:21.281Z.

| Who reads the message | Scam messages caught | False alarms on ordinary messages |
|---|:-:|:-:|
| Fixed rules (regular expressions, PT + EN) | **22/32** | 3/28 |
| **Gemma 4 E2B** | **32/32** | 0/28 |
| Rules + Gemma (what the app uses) | **32/32** | 3/28 |
| Rules + Gemma, 2 or more tricks | **25/32** | 0/28 |

Median Gemma time per message: **5.5 s** on CPU. Gemma answered 60/60.

What the numbers mean:
- Gemma catches the scams that the fixed rules miss, because scammers rarely use the exact words a rule expects ("my phone fell in the lake", "before the bank closes", "keep this between us").
- The rules' false alarms come from ordinary words ("urgent", "quick"). In the app they cannot block a payment to a trusted contact on their own: the scam-script flag only counts when money goes to a wallet outside the trusted list.
- Limits: a small set written by the author, not real victims' messages; it shows the approach works, not a field accuracy.

## Every message

| id | scam? | rules | Gemma (with its quote) |
|---|:-:|---|---|
| scam-pt-01 | yes | fake_support | new_number:Meu celular caiu na privada, tô usando o do meu amigo.<br>urgency:Preciso de 0,8 SOL pra pagar a matrícula antes do banco fechar |
| scam-pt-02 | yes | - | new_number:salva esse número novo<br>urgency:preciso que você me transfira 1 SOL agora |
| scam-pt-03 | yes | - | fake_support:Aqui é do setor de segurança do seu banco.<br>urgency:Para cancelar, transfira o saldo para a conta de proteção que vou te passar. |
| scam-pt-04 | yes | secret_words | urgency:Sua carteira Phantom será desativada em 24 horas por falta de verificação.<br>secrecy:Confirme suas 12 palavras no link para manter o acesso. |
| scam-pt-05 | yes | - | prize:seu número foi sorteado na promoção de fim de ano e você tem 2.000 USDC esperando<br>fee_to_unlock:Só precisa pagar o frete de 0,3 SOL |
| scam-pt-06 | yes | secrecy, emotional | emotional:Ele se envolveu num acidente e precisa pagar a fiança hoje.<br>secrecy:Ele pediu pra não contar pros pais. |
| scam-pt-07 | yes | - | urgency:é rapidinho |
| scam-pt-08 | yes | prize | prize:receber o airdrop oficial<br>safe_wallet:Conecte a carteira |
| scam-pt-09 | yes | fee_to_unlock | urgency:em até 30 minutos<br>fee_to_unlock:é necessário recolher o imposto de 0,6 SOL |
| scam-pt-10 | yes | secrecy | secrecy:não comenta com ninguém |
| scam-pt-11 | yes | fake_support, safe_wallet | fake_support:Atendimento Solflare: detectamos que sua conta foi invadida. Mova seus fundos para a carteira segura abaixo enquanto resolvemos.<br>urgency:detectamos que sua conta foi invadida. Mova seus fundos para a carteira segura abaixo enquanto resolvemos |
| scam-pt-12 | yes | urgency | new_number:tô com número novo<br>urgency:preciso resolver isso ainda hoje |
| scam-pt-13 | yes | too_good | too_good:Investimento garantido: coloque 1 SOL hoje e receba 3 SOL amanhã.<br>urgency:Vagas limitadas, só para os primeiros 20! |
| scam-pt-14 | yes | secret_words | fake_support:Sua conta será bloqueada por suspeita de fraude. Fale comigo no WhatsApp e informe sua frase de recuperação para validarmos.<br>secrecy:informe sua frase de recuperação |
| scam-pt-15 | yes | emotional | emotional:Mãe, tô no hospital, perdi a carteira e o celular. |
| scam-pt-16 | yes | prize, too_good | prize:Ganhe 10x seus tokens! Envie qualquer valor para o endereço do evento e receba o dobro de volta automaticamente.<br>too_good:receba o dobro de volta automaticamente |
| scam-en-01 | yes | secrecy | new_number:I'm texting from a friend's<br>urgency:I need 0.8 SOL before the bank closes<br>secrecy:please keep this between us |
| scam-en-02 | yes | new_number, urgency | new_number:save this new number<br>emotional:Something bad happened, I'll explain later<br>urgency:I need you to send me 1 SOL right now |
| scam-en-03 | yes | - | fake_support:This is your bank's fraud department.<br>safe_wallet:move your balance to the protection account I'll give you |
| scam-en-04 | yes | - | urgency:Your Phantom wallet will be deactivated in 24 hours unless verified.<br>fake_support:Confirm your 12 words at the link to keep access. |
| scam-en-05 | yes | - | prize:Congratulations!! You were picked in our holiday giveaway and 2,000 USDC are waiting for you.<br>fee_to_unlock:Just cover the 0.3 SOL shipping. |
| scam-en-06 | yes | emotional | emotional:He was in a car crash and needs bail paid today. He asked that his parents not find out.<br>secrecy:He asked that his parents not find out. |
| scam-en-07 | yes | - | urgency:it's quick |
| scam-en-08 | yes | prize | prize:You've been selected for the official airdrop. |
| scam-en-09 | yes | urgency | urgency:pay the 0.6 SOL tax to this wallet within 30 minutes<br>fee_to_unlock:pay the 0.6 SOL tax |
| scam-en-10 | yes | urgency | secrecy:don't mention it to anyone |
| scam-en-11 | yes | fake_support, safe_wallet | fake_support:Solflare Support: we detected your account was compromised. Move your funds to the secure wallet below while we fix it.<br>urgency:Move your funds to the secure wallet below while we fix it |
| scam-en-12 | yes | - | new_number:Mark here, got a new phone<br>urgency:I'm short and need to sort this out today |
| scam-en-13 | yes | too_good | too_good:Guaranteed investment: put in 1 SOL today and get 3 SOL tomorrow. Limited spots, only the first 20! |
| scam-en-14 | yes | secret_words | fake_support:Your account will be frozen for suspected fraud.<br>secret_words:Message me on WhatsApp with your recovery phrase so we can verify you. |
| scam-en-15 | yes | - | emotional:I'm in the ER, I lost my wallet and phone. |
| scam-en-16 | yes | too_good | prize:Get 10x your tokens! Send any amount to the event address and receive double back automatically.<br>too_good:Get 10x your tokens! Send any amount to the event address and receive double back automatically. |
| ok-pt-01 | no | - | - |
| ok-pt-02 | no | - | - |
| ok-pt-03 | no | - | - |
| ok-pt-04 | no | urgency | - |
| ok-pt-05 | no | - | - |
| ok-pt-06 | no | - | - |
| ok-pt-07 | no | - | - |
| ok-pt-08 | no | - | - |
| ok-pt-09 | no | - | - |
| ok-pt-10 | no | - | - |
| ok-pt-11 | no | - | - |
| ok-pt-12 | no | - | - |
| ok-pt-13 | no | - | - |
| ok-pt-14 | no | urgency | - |
| ok-en-01 | no | - | - |
| ok-en-02 | no | - | - |
| ok-en-03 | no | - | - |
| ok-en-04 | no | urgency | - |
| ok-en-05 | no | - | - |
| ok-en-06 | no | - | - |
| ok-en-07 | no | - | - |
| ok-en-08 | no | - | - |
| ok-en-09 | no | - | - |
| ok-en-10 | no | - | - |
| ok-en-11 | no | - | - |
| ok-en-12 | no | - | - |
| ok-en-13 | no | - | - |
| ok-en-14 | no | - | - |
