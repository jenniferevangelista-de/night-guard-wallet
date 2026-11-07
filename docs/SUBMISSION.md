# Submission text (MLH Solana Hackathon)

**Project name:** Night Guard Wallet

**Tagline (short):** A Solana wallet guard for our parents, grandparents and the rest of us: it simulates every transaction, checks where every part comes from, explains it in plain words, flags the scam with local AI, locks risky payments behind a family guardian on-chain, and shares every refused scam on a community list so one family's "no" protects every family.

**Tracks:** AI Track (security tools that explain what a transaction will do and flag risky programs, tokens and wallets before a user signs) · Top 3 overall

**Links**
- Code: https://github.com/jenniferevangelista-de/night-guard-wallet
- Video: VIDEO_LINK
- Program on devnet: https://explorer.solana.com/address/8vE76ymUvgkQdwBmtQ68kVuaxPvUVN7YymSpSkf3hwtn?cluster=devnet

## Inspiration

People over 60 reported $7.7 billion lost to fraud in 2025, $4.3 billion of it involving crypto, $38,500 per victim on average (FBI IC3 2025 report). The stories never change: the son with a new number, the fake wallet support, the free airdrop, the prize with a fee to unlock, the address copied from history. On a blockchain there is no bank to call back; one signature is final. Night Guard Wallet puts a guard, and the family, between the scammer and the signature. It is built for the people scammers target the most, and it protects any adult the same way.

## What it does

Before Lucy (74) signs anything:
1. **Simulates the transaction on Solana devnet** (`simulateTransaction`) and shows what really changes: SOL, tokens, approvals (delegates) and owners (authorities), in big letters, in Portuguese or English, read aloud.
2. **Flags the risk** from the simulated result: a wallet she never paid and how new it is, an address that looks like her daughter's (address poisoning), most of her money leaving, unlimited `approve`, `SetAuthority`, `CloseAccount`, a fake "USDC" (Token-2022 metadata vs. the verified mint), phishing links and Blinks, Solana Pay QRs, and a phone-scam mode.
3. **Gemma 4 reads the message** that came with the request (WhatsApp, SMS) and quotes the scam tricks it finds, then writes the explanation in plain words. The verdict never depends on the model: it can only add warnings, and every quote must really be in the message.
4. **Checks the sources:** the sender, the link, every wallet that would get money or power, every program (age, upgradeable, verified source) and every token.
5. **Locks and asks the family.** Her savings live in the `guardian_vault` Anchor program: money only goes out at once to trusted contacts under a daily limit; adding a contact needs her signature AND her guardian's; anything else becomes an on-chain request that Ana, her daughter, approves or refuses with her own signature, live from the program's events; big amounts wait a cooling-off period on-chain.

6. **Families protect families.** When Ana refuses a scam, she reports the wallet on a community scam list stored on Solana (`report_scam`): one public record per wallet, one vote per family. Every Night Guard wallet reads it before signing.

## How we built it

- **On-chain:** Rust + Anchor 0.31.1 on devnet: vault PDA, trusted list (two signers to add), daily limit, `request → guardian_decide → execute`, cooling-off, and events for every step.
- **Guardian:** TypeScript with `@solana/web3.js`, `@coral-xyz/anchor` and `@solana/spl-token`: instruction decoding (System, SPL Token, Token-2022, the vault IDL, Memo), devnet simulation with before/after account states, risk rules, Token-2022 metadata lookups, Solana Pay and Blink parsing.
- **AI:** Gemma 4 E2B via Ollama, free, on a 4-core CPU with no GPU. Structured JSON, evidence check on every quote, and checks on the explanation (no invented amounts, never "safe" on a STOP).
- **Screens:** Lucy's wallet and Ana's guardian page in plain HTML, big letters, PT/EN, speech synthesis.

## Measured

- **5/5 scam scenarios stopped and 2/2 real payments let through**, in Portuguese and English, on every one of 42 checks on devnet.
- **0.2 s** median from "check" to the verdict on screen, devnet simulation included (simulation alone: 18 ms median).
- **5 scams refused by the program itself on devnet**, sent on purpose without preflight: transfers to the scammer and to the look-alike address (`NotTrusted`), a fake guardian adding the scammer (`ConstraintHasOne`), a rejected request (`Rejected`), a big payment before its cooling-off (`StillCoolingOff`).
- **Gemma recognised 32/32 scam messages with 0 false alarms** on 28 ordinary family messages (60 fictional messages, PT + EN); fixed rules alone caught 22/32 with 3 false alarms.

## Challenges we ran into

- Making the AI useful without trusting it: the rules on the simulated result decide, Gemma adds what rules miss (scammers rarely use the exact words a rule expects), and every quote is checked against the message.
- Gemma on a CPU takes seconds; the verdict shows first and the explanation updates when Gemma is done.
- Proving that Solana does real work: we forced scam transactions past the app on purpose and recorded the program refusing them on-chain.

## Accomplishments we're proud of

A guard that a 74-year-old can actually read, hear and use, where the rules that protect her cannot be switched off by a scammer on the phone, and where her daughter decides with a signature instead of a phone call at midnight.

## What we learned

The safest place for "please ask my family first" is not the app, it's the chain: a vault with trusted contacts, limits and a guardian turns a social rule into something a scammer cannot talk anyone out of.

## What's next

A wallet-standard extension so the guardian runs inside any Solana wallet; SPL tokens inside the vault; a maintained registry of verified tokens and domains; a pilot with older relatives and their families.

## Built with

solana · anchor · rust · typescript · solana-web3.js · spl-token · token-2022 · solana-pay · ollama · gemma · node.js · html
