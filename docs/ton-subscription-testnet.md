# YORZA TON Subscription — Testnet Setup, Scenarios, Results

**Network:** TON **testnet only**  
**Date:** 2026-10-26  
**Branch:** `cursor/ton-subscription-e2e-8f7c`

---

## Setup

### 1. Generate disposable wallets

```bash
cd contracts && npm run wallets:generate
# writes .secrets/ton-testnet-wallets.json (gitignored) + public addresses JSON
```

### 2. Fund from official faucet

Programmatic faucets return HTML/404 in this environment. Use Telegram:

1. Open [@testgiver_ton_bot](https://t.me/testgiver_ton_bot)
2. Request testnet TON, solve captcha
3. Paste each address (deployer first; then subscribers / treasury / referrer as needed)

**Minimum for deploy + one 0.1 TON payment:** ~0.2 TON on deployer.

### 3. Deploy V3 router

```bash
cd contracts
npm run build
npm run deploy:from-secrets
```

Copy `contractAddress` from `contracts/deploy-report.json` into backend env:

```
TON_NETWORK=testnet
TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=<from report>
TON_TESTNET_TREASURY_ADDRESS=<treasury from .secrets public>
TON_PAYMENT_SIGNER_PUBLIC_KEY=<signer pubkey>
TON_PAYMENT_SIGNER_PRIVATE_KEY=<signer seed hex — never commit>
TON_SUBSCRIPTION_AMOUNT=0.1
TON_SUBSCRIPTION_DURATION_DAYS=30
```

### 4. Run backend + Mini App (local)

```bash
cd backend && USE_MEMORY_MONGO=true ALLOW_DEV_AUTH=true npm run dev:local
# frontend
cd .. && npm run dev
# For Telegram WebView HTTPS: temporary tunnel only, testnet config only
```

### 5. Automated vs live tests

| Layer | Command | Needs faucet? |
| --- | --- | --- |
| Contract sandbox + split | `cd contracts && npm test` | No |
| Backend unit + scenarios A–G (mock chain) | `cd backend && npm test` | No |
| Live deploy + on-chain pay | `npm run deploy:from-secrets` | **Yes** |
| Live Mini App E2E | Manual + tunnel + funded wallets | **Yes** |

---

## Public addresses generated this run

| Role | Address |
| --- | --- |
| Deployer | `0QANyHbIihz5LpLpoQVq03Pv_5-sQREzam5wzV-uyGEJdneK` |
| Treasury | `0QBXYguW_m-DxMIpfk5qFY27w1wg-jX-BOltcYq6iz_y6h_9` |
| Referrer A | `0QAwYVQpzphtkNmrM9eL0Al2lOUmXyBXJy1yfoneQnR9hUR5` |
| Subscriber B | `0QDuzDxzyWpjuCoigrt0Us_PaKCvGgVILZioGvB8Ls5_xLqP` |
| Subscriber (no referrer) | `0QDuzIQhdis4Iif2ULHNn3mKap4mxCNVTUdkm-8zegl5uxR0` |
| Subscriber (renewal/dup) | `0QCczMoV3C7Ny8gfpimS2i-_vMD2LryljPVlvHqXj9NBCIHA` |
| Signer pubkey | `86c5a2f386ba8a8bca2267a92c287171e16d5ab12a11ff5315f9ffa12d84f4e0` |

Secrets remain in `.secrets/` (not committed).

---

## Deploy attempt (this agent run)

| Field | Value |
| --- | --- |
| Status | **FUNDING_REQUIRED** |
| Deployer balance | `0` nanoton |
| Contract address | *not deployed* (blocked) |
| Faucet APIs tried | tonapi `/v2/faucet` → 404; faucet.ton.org → HTML SPA (no credit) |
| Next step | Fund deployer via `@testgiver_ton_bot`, re-run `npm run deploy:from-secrets` |

---

## Scenario results

Legend: **PASS** / **FAIL** / **BLOCKED** / **NOT RUN**

### Automated (mock chain + sandbox) — verified this run

| Scenario | Result | Evidence |
| --- | --- | --- |
| **A** Referred first purchase | **PASS** (mock/API) | `tonSubscriptionScenarios.test.js` Scenario A; commission > 0; `CONFIRMED`; subscription active; `ReferralTonPayout` created |
| **B** No referrer | **PASS** (mock/API) | Scenario B; `referrerShareNanoton=0`; payload present; activate; no payout row |
| **C** Renewal | **PASS** (mock/API) | Scenario C; second intent commission 0; expiry extends; re-confirm does not double-extend; one payout total |
| **D** Tampering | **PASS** (partial) | Backend: wrong-user confirm rejected; expired auth rejected. Contract sandbox: replay, underpayment, oversize commission rejected. Live amount/treasury/referrer forge on-chain: **BLOCKED** (no deploy) |
| **E** Delayed / partial | **PASS** (mock/API) | Scenario E; `PARTIALLY_SETTLED`; subscription stays inactive; no referral ledger |
| **F** Duplicates / concurrency | **PASS** (mock/API) | Scenario F; one commission lock; idempotent confirm; single payout |
| **G** Persistence | **PASS** (mock/API) | Scenario G; game-state re-fetch; client cannot inject points / force inactive entitlement away |

### Live testnet through Mini App — this run

| Scenario | Result | Evidence |
| --- | --- | --- |
| **A–G live** | **BLOCKED** | Deployer balance 0; official faucet requires interactive Telegram captcha unavailable to this agent |

### Quality gates

| Gate | Result |
| --- | --- |
| Contract compile | **PASS** |
| Contract sandbox + split tests | **PASS** (10/10) |
| Backend tests (incl. scenarios) | **PASS** (62/62) |
| Frontend `tsc --noEmit` | **PASS** |
| Frontend `vite build` | **PASS** |

---

## Telegram policy

Official Bot Payments docs require **Telegram Stars (`XTR`)** for digital goods/services inside Mini Apps — cryptocurrency checkout is not allowed for production digital sales ([payments-stars](https://core.telegram.org/bots/payments-stars)). TON Connect remains appropriate for TON-native wallet features ([blockchain guidelines](https://core.telegram.org/bots/blockchain-guidelines)).

**Implication for YORZA:** keep this TON subscription path **testnet-only**. Production digital subscription benefits need a Stars invoice architecture (optional later bridge of Stars revenue via Fragment/TON). This does not replace building/testing the TON router on testnet.

---

## Settlement / eligibility notes (implemented)

- Eligibility consumed only on `CONFIRMED` with commission > 0 (`tonFirstCommissionConsumed`).
- Failed/expired intents release the commission lock.
- Activation only in `activateSubscription()` after both expected payouts verify.
- `PARTIALLY_SETTLED` never activates and never credits referral TON ledger.
- Contract `sweep_excess` recovers bounced/stuck balance to treasury under signer auth.
