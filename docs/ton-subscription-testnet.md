# YORZA TON Subscription — Testnet Setup, Scenarios, Results

**Network:** TON **testnet only**  
**Updated:** 2026-10-26 (V3.1.2 fee-aware deploy + A–G + sweep)  
**Branch:** `cursor/ton-subscription-e2e-8f7c`  
**PR:** https://github.com/FaiqAli-dot/tapEarn/pull/15

---

## Active testnet contract (V3.1.2 — point backend here)

| Item | Value |
| --- | --- |
| Network | `testnet` |
| Contract | `0QArUl48x88i_NjfNbHTpPY2RZy5fEJZcbBltu6PPWQllvkH` |
| Code hash | `b66527b5caca2478209871796b6e72be35798d8d78a17fd681be81f4dc29f7b8` |
| Code matches local build | **YES** |
| Deploy tx | `wjvu5uBadELmKbvl3om63ZmQMXNrclDVE0jYeHb6tbQ=` |
| Deploy explorer | https://testnet.tonscan.org/tx/wjvu5uBadELmKbvl3om63ZmQMXNrclDVE0jYeHb6tbQ= |
| Contract explorer | https://testnet.tonscan.org/address/0QArUl48x88i_NjfNbHTpPY2RZy5fEJZcbBltu6PPWQllvkH |
| Policy | `v3.1-net-50-50` — `commission>0` eligibility; 50/50 of net after `RAWRESERVE` + `GETFORWARDFEE×N` |
| `sweep_excess` | **PASS** — tx `9ke+QROlIASEVOgyQJKQl0U4pVZ7XKZsFbEmpPC87gQ=` — treasury out **72,406,193** nanoTON; contract left **19,000,000** |

Backend testnet config:

```bash
export TON_NETWORK=testnet
export TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=0QArUl48x88i_NjfNbHTpPY2RZy5fEJZcbBltu6PPWQllvkH
export TON_TESTNET_TREASURY_ADDRESS=0QBXYguW_m-DxMIpfk5qFY27w1wg-jX-BOltcYq6iz_y6h_9
export TON_PAYMENT_SIGNER_PUBLIC_KEY=86c5a2f386ba8a8bca2267a92c287171e16d5ab12a11ff5315f9ffa12d84f4e0
# TON_PAYMENT_SIGNER_PRIVATE_KEY from .secrets (never commit)
unset TON_CHAIN_MOCK
```

No production / mainnet config was changed.

---

## Preserved V3 contract (evidence intact — do not overwrite)

| Item | Value |
| --- | --- |
| Contract | `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4` |
| Code hash | `e319b075bcc380405aee1a06854561e34f2510d79624e47f935d142bb7c27ec7` |
| Deploy tx | `bEz3Dv0V85q/SKbkcF46B42N1jn2IYF5ehOf6H4omtc=` |
| Notes | Original fixed-commission V3 router + first A–G live evidence retained |

---

## Intermediate V3.1.1 (full A–G + fee scenarios)

Fee-aware **net split** (same formula as V3.1.2). Deployed while iterating `sweep_excess` gas underfund fix; V3.1.2 only changes sweep to mode-128 carry-remaining.

| Item | Value |
| --- | --- |
| Contract | `0QAgjSxp1L-noCSO75176xPwMTl3vZQRN4pKxZikFLjLQOpU` |
| Code hash (at deploy) | `942f2b1920b79fe76759fa62eba2ca785d9710489086933f24b82d8390479706` |
| Deploy tx | `/ILGHDhSwdtqlP+25G+hAk3tvDUaQx8+ydcOAtRfYKA=` |

### Live A–G on V3.1.1

Harness: `backend/scripts/liveTonE2E.js` (+ scenario C follow-up). Mini App WebView **NOT RUN**.

| Scenario | Result | Evidence (nanoTON) |
| --- | --- | --- |
| **A** Referred first purchase | **PASS** | Tx `5rC60k4Cj0FMPn36cuH8ij/nS53G7X/QJVAwUFl6Klc=` — outs **46,143,066** ref + **46,143,066** tre (diff **0**); net **92,286,132**; backend `CONFIRMED` |
| **B** No referrer | **PASS** | Tx `1hYG9zUoqjKLkGhkzyQgGeIfgj6drqpJBfNWoIwgCfE=` — treasuryΔ **92,341,397**; 1 out; commission auth `0` |
| **C** Renewal | **PASS** | First `JXe8UKI++bnX+opdstYnM43iy8FoDCme4p0SCRmNEl4=` (2 outs 46,143,066/46,143,066); renewal `Pw71bInGZG3BGL+eem9vkpkszOSlSdWZ5vHjv/07Jog=` (1 out **92,393,066** treasury); referrerΔ renewal **0** |
| **D** Tampering | **PASS** | Replay exit **104** tx `084bcbc96fc75f763ed818c80c43bc79ed11ae01fd8ee1df639562290eadad35`; underpay exit **103** tx `759e7224a8245d83b81ecc2f52d638b47b81a98c3c2cfd0f72ca4eef13ed202f` |
| **E** Delayed / partial | **PASS** | BOC-only submit → `PROCESSING`, subscription inactive |
| **F** Duplicates / concurrency | **PASS** | One commission-eligible concurrent intent; idempotent confirm |
| **G** Persistence | **PASS** | game-state re-fetch active; client inject rejected |

### Fee scenarios (same run)

| Fee check | Result | Evidence |
| --- | --- | --- |
| Referred 50/50 of net (≤1 nano diff) | **PASS** | A outs equal (diff 0) |
| No-referrer treasury net | **PASS** | B |
| Renewal no commission | **PASS** | C |
| Underpay rejected | **PASS** | exit 103 |
| Replay rejected | **PASS** | exit 104 |
| Unused reserve / sweep | **PASS** on V3.1.2 | see active contract |
| Mini App UI | **NOT RUN** | no Telegram/TON Connect WebView session |

Balances reconcile: gross 100,000,000 − reserve 7,500,000 − outbound fee budget ≈ 213,868 → net **92,286,132** (= 46,143,066 × 2). Treasury/referrer wallet deltas are slightly below out values due to destination wallet inbound fees.

---

## `sweep_excess` (V3.1.2)

| Item | Value |
| --- | --- |
| Result | **PASS** |
| Tx | `9ke+QROlIASEVOgyQJKQl0U4pVZ7XKZsFbEmpPC87gQ=` |
| Treasury out | **72,406,193** nanoTON |
| Contract before → after | 79,947,063 → **19,000,000** |
| `min_leave` | 10,000,000 (+ exec reserve + gas headroom retained on contract) |
| Note | Earlier V3.1/V3.1.1 sweep attempts failed action code 37 (mode-1 sendable ignored compute gas). V3.1.2 uses mode **128** carry-remaining after `RAWRESERVE`. |

---

## Remaining balances (after V3.1.2 sweep; nanoTON)

| Account | Balance |
| --- | --- |
| Deployer | *(see `.secrets/v312-final-balances.json` — low after multi-deploy)* |
| Treasury | 1,161,136,946 |
| Referrer A | *(post A–G + top-ups)* |
| Subscriber B / NoRef / Renewal | low after A–G |
| Active V3.1.2 contract | 19,000,000 |
| V3.1.1 (A–G) contract | retains unused reserves from that run |
| Old V3 (preserved) | 288,904,951 |

Exact snapshot written to `.secrets/v312-final-balances.json` (gitignored).

---

## Setup (reproduce)

```bash
test -f .secrets/ton-testnet-wallets.json
cd contracts && npm run build && npm run deploy:from-secrets
cd ../backend
export TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=0QArUl48x88i_NjfNbHTpPY2RZy5fEJZcbBltu6PPWQllvkH
export TON_TESTNET_TREASURY_ADDRESS=0QBXYguW_m-DxMIpfk5qFY27w1wg-jX-BOltcYq6iz_y6h_9
export TON_PAYMENT_SIGNER_PUBLIC_KEY=86c5a2f386ba8a8bca2267a92c287171e16d5ab12a11ff5315f9ffa12d84f4e0
# private key from .secrets — never print/commit
unset TON_CHAIN_MOCK
node scripts/liveTonE2E.js
# optional:
TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=... node ../contracts/scripts/sweep-excess-testnet.js
```

---

## Telegram policy

Digital goods/services inside Mini Apps require **Telegram Stars (`XTR`)** for production. Keep this TON checkout **testnet-only**.

---

## Notes

- Bounceable router payouts require **active** destination wallets.
- Backend address matching uses `Address.parse().toRawString()`.
- Discovery refuses inbound tx hashes already claimed by another payment.
- Full A–G re-run on V3.1.2 was not repeated end-to-end after the sweep-only redeploy (funds depleted across deploy iterations). Net-split behavior was proven on V3.1.1; sweep proven on V3.1.2. To re-run A–G on the active address, fund: deployer ≥0.15 TON, each subscriber ≥0.25 TON (renewal ≥0.22 TON).
