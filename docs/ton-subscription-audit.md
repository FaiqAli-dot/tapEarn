# YORZA TON Subscription — Pre-Implementation Audit

**Repo:** `FaiqAli-dot/tapEarn`  
**Audit date:** 2026-10-26  
**Branch base:** `main` @ merge of admin panel / V2 land  
**Network policy:** TON **TESTNET ONLY** — mainnet not supported  

This audit is the source-of-truth inventory before implementing first-only commission, staged settlement, subscription activation, and E2E testnet scenarios A–G.

---

## 1. What exists

### React / TypeScript Mini App
| Path | Role |
| --- | --- |
| `src/main.tsx` | `TonConnectUIProvider` + router |
| `src/App.tsx` | Mini App shell; mounts wallet / screens |
| `src/screens/ConnectWalletScreen.tsx` | Connect → ton_proof → quote → intent → TON Connect pay → submit |
| `src/screens/InviteFriendsScreen.tsx` | Referral link + TON payout / subscription history |
| `src/config/ton.ts` | Manifest + testnet explorer helpers |
| `src/services/api.ts` | `/payments/*`, `/ton-proof/*` clients |
| `public/tonconnect-manifest.json` | TON Connect manifest (GitHub Pages) |

Purchase UI lives inside the wallet screen (no separate Plans page).

### Express backend + Mongo models
| Path | Role |
| --- | --- |
| `backend/src/app.js` | Mounts `/api/payments`, `/api/ton-proof` |
| `backend/src/routes/paymentRoutes.js` | quote, intent, history, submit, confirm, payouts, legacy `/complete` |
| `backend/src/services/tonPaymentService.js` | Intent, submit, confirm, history, quote |
| `backend/src/services/tonContractPayload.js` | ed25519 auth cell + subscribe BOC |
| `backend/src/services/tonChainService.js` | toncenter inbound / outbound verify |
| `backend/src/services/tonProofService.js` | ton_proof + wallet bind |
| `backend/src/services/referralService.js` | Signup attribution + legacy YP first-payment commission |
| `backend/src/config/tonConfig.js` | Server pricing, fee/split math, testnet guards |
| `backend/src/models/Payment.js` | Lifecycle + nanotons |
| `backend/src/models/User.js` | `referrerId`, wallet, TON referral earnings |
| `backend/src/models/ReferralTonPayout.js` | On-chain TON referral ledger |
| `backend/src/models/TonProofNonce.js` | Single-use proof nonces |

### FunC contracts
| Path | Role |
| --- | --- |
| `contracts/ReferralPayment.fc` | **Live V2 router** — `subscribe` op, ed25519 auth, 50/50 after fees, replay dict |
| `contracts/TapEarn.fc` | Legacy draft (Jetton/upgrades); **not** the subscription path |

### Auth, referral, chain tooling
- Telegram HMAC `initData` → JWT; ton_proof challenge/verify binds wallet.
- Referral locked at signup (`referrerId`); TON path loads referrer wallet from DB only.
- Scripts: `contracts/scripts/compile.js`, `deploy-testnet.js`, `pay-testnet.js`.
- Testnet V2 deploy recorded in `contracts/README.md` (0.1 TON split + replay reject proven).

---

## 2. Complete and working

- Native TON (not Jetton) on V2 router; exact `msg_value == amount`.
- Server-side quote/pricing (`getSubscriptionAmountNanoton` / `computePaymentSplit`).
- Integer nanoTON; odd remainder → treasury (config + contract + split tests).
- Backend-signed ed25519 auth verified on-chain; expiry; `sender == subscriber`; replay via `payment_id`.
- Referrer address never taken from the frontend.
- Payment status enum: PENDING → AUTHORIZED → SUBMITTED → PROCESSING → CONFIRMED / PARTIALLY_SETTLED / FAILED / EXPIRED.
- Unique `externalPaymentId`; verified-wallet gate on intents.
- ton_proof challenge/verify path implemented.
- Legacy YP first-payment commission idempotent (`mvp.test.js`).
- Mainnet blocked by design in `tonConfig.assertTestnetOnly`.

---

## 3. Partial

| Area | State |
| --- | --- |
| Frontend purchase | UI exists; submits TON Connect **BOC** as `inboundTxHash`; no poll/confirm loop |
| Confirm / settlement | Outbound discovery not automatic; stuck in PROCESSING without client-supplied payout hashes |
| `PARTIALLY_SETTLED` | Set when one side verified; referral ledger can grant early; no bounce recovery |
| `isFirstPayment` | Computed on intent — **unused for split** (always 50/50 when referrer present) |
| No-referrer | Intent AUTHORIZED **without** `contractPayloadBoc` → Mini App cannot pay |
| Subscription product | No activate / expire / renew / entitlement fields on `User` |
| Chain monitor | Request-driven only; no worker |
| Docs | `MVP_STATUS.md` still describes pre-V2 gaps; price docs say 1 TON vs env 0.1 |

---

## 4. Missing or insecure (vs owner spec)

| Requirement | Status |
| --- | --- |
| 50% **first payment only**; renewals → full treasury | **Missing** — contract + backend always 50/50 when referrer in auth |
| One-time commission; failed payments do not consume eligibility | **Partial** — failed ≠ CONFIRMED (good), but every success with referrer still pays 50% |
| Staged settlement / partial payout failure | **Critical gap** — bounces ignored on-chain; no auto out_msg discovery; confirm needs client hashes |
| Idempotent subscription activation after verified settlement | **Missing** |
| Frontend pending until backend verifies | **Broken** — BOC-as-hash; no confirm polling |
| Signed auth binds commission amount / eligibility | **Missing** — auth has no commission field |
| Concurrent intent eligibility lock | **Missing** |

**Telegram policy (official):** Digital goods/services inside Mini Apps must use **Telegram Stars (`XTR`)**, not cryptocurrency. A TON-only checkout for subscription benefits is **not** allowed for production Mini App sales. Keep TON checkout **testnet-only**; production would need Stars (+ optional TON for non-digital / off-Telegram flows). Sources: [Bot Payments API for Digital Goods](https://core.telegram.org/bots/payments-stars), [Blockchain Guidelines](https://core.telegram.org/bots/blockchain-guidelines).

---

## 5. Files that need changes

**Contract:** `contracts/ReferralPayment.fc`, `contracts/tests/router.test.js`, `contracts/tests/split.test.js`, `contracts/scripts/deploy-testnet.js`, `contracts/scripts/pay-testnet.js`, `contracts/README.md`

**Backend:** `tonPaymentService.js`, `tonConfig.js`, `tonContractPayload.js`, `tonChainService.js`, `Payment.js`, `User.js`, `tonPayments.test.js`; new reconcile helper / settlement discovery

**Frontend:** `ConnectWalletScreen.tsx`, `api.ts`, `types/game.ts` (subscription status)

**Docs / config:** `docs/ton-subscription-audit.md` (this file), `docs/ton-subscription-testnet.md`, `backend/env.example`, `.gitignore` (secrets dirs)

**PR #9 overlap:** `cursor/yorza-point-history-nav-4466` touches `api.ts`, `App.tsx`, `BottomNavigation`, `ProfileScreen`, `userController`, `MVP_STATUS` — **not** contracts or ton payment core. Soft-touch `api.ts` / types carefully; rebase onto main if #9 merges.

---

## 6. Tests available before this work

| File | Coverage |
| --- | --- |
| `backend/tests/tonPayments.test.js` | Split math; signed BOC; ton_proof; intent gates; mock confirm; PARTIALLY_SETTLED; history; legacy YP |
| `contracts/tests/split.test.js` | Fee-before-split; odd nano → treasury |
| `contracts/tests/router.test.js` | Sandbox deploy; 50/50; replay; underpayment |
| `backend/tests/mvp.test.js` | Referral lock; YP first-payment 50% |
| `backend/tests/adminPanel.test.js`, `engagement.test.js`, `rateLimit.test.js` | Unrelated |

**Not covered before:** renewals → treasury-only; subscription activation; BOC→tx resolve; auto out_msg discovery; bounce/partial recovery; frontend E2E; concurrent eligibility lock.

---

## Final status (updated after implementation)

### Implemented
1. **V3 router** (`contracts/ReferralPayment.fc`): signed `commission`; `0` → treasury-only; `sweep_excess` for bounced funds; replay before sends.
2. **Backend**: first-only eligibility lock; renewals/no-referrer commission `0`; BOC≠hash; auto-discover outs; activate subscription only on `CONFIRMED`; no commission grant on partial.
3. **Frontend**: BOC submit + confirm polling; pending UI; renewal copy; subscription status from server.
4. **Tests**: contract sandbox + split; backend tonPayments + scenarios A–G (mock); frontend build/typecheck.
5. **Docs**: this audit + `docs/ton-subscription-testnet.md`.

### Live testnet (after owner funding)
- Deployer funded (~2 TON); subscribers funded 0.4 TON each; V3 deployed at `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4` (code hash matches build).
- Live scenarios A–G via backend+chain harness: **PASS** (see `docs/ton-subscription-testnet.md`).
- Telegram Mini App / TON Connect WebView purchase: **NOT RUN** in this environment.

### Telegram policy
Stars required for production digital goods in Mini Apps; TON checkout remains testnet-only.
