# YORZA TON Subscription — Testnet Setup, Scenarios, Results

**Network:** TON **testnet only**  
**Updated:** 2026-10-26 (fee-aware V3.1 code on branch; **not redeployed**)  
**Branch:** `cursor/ton-subscription-e2e-8f7c`  
**PR:** https://github.com/FaiqAli-dot/tapEarn/pull/15

---

## V3.1 fee-aware status (awaiting owner deploy approval)

| Item | Status |
| --- | --- |
| Fee audit of scenario A gap | Done — `docs/ton-subscription-fee-audit.md` |
| On-chain 50/50 **of net** (eligibility flag, not fixed commission) | Implemented in `contracts/ReferralPayment.fc` (V3.1) |
| Backend quotes/confirm reconcile to observed 50/50 net | Implemented (`FEE_POLICY_VERSION=v3.1-net-50-50`) |
| New testnet deploy | **NOT DONE** — keep live V3 contract + A–G evidence until owner approves |
| Live V3 contract still authoritative on-chain | `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4` |

---

## Deployed V3 contract (live evidence — do not replace without approval)

| Item | Value |
| --- | --- |
| Network | `testnet` |
| Contract | `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4` |
| Code hash | `e319b075bcc380405aee1a06854561e34f2510d79624e47f935d142bb7c27ec7` |
| Code matches local build | **YES** |
| Deploy tx | `bEz3Dv0V85q/SKbkcF46B42N1jn2IYF5ehOf6H4omtc=` |
| Deploy explorer | https://testnet.tonscan.org/tx/bEz3Dv0V85q/SKbkcF46B42N1jn2IYF5ehOf6H4omtc= |
| Contract explorer | https://testnet.tonscan.org/address/0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4 |
| Treasury | `0QBXYguW_m-DxMIpfk5qFY27w1wg-jX-BOltcYq6iz_y6h_9` |
| Signer pubkey | `86c5a2f386ba8a8bca2267a92c287171e16d5ab12a11ff5315f9ffa12d84f4e0` |
| Deployer | `0QANyHbIihz5LpLpoQVq03Pv_5-sQREzam5wzV-uyGEJdneK` |

---

## Funding (from deployer after owner credited ~2 TON)

Deployer balance verified before funding: **1.999999999 TON**.

| Role | Address | Amount | Tx ID |
| --- | --- | --- | --- |
| Subscriber B | `0QDuzDxzyWpjuCoigrt0Us_PaKCvGgVILZioGvB8Ls5_xLqP` | 0.4 TON (non-bounceable) | `gTNb2Ea4bIh68WffrKTemrxHst5l6qXm2yg2iL2JJ7A=` |
| Subscriber no-ref | `0QDuzIQhdis4Iif2ULHNn3mKap4mxCNVTUdkm-8zegl5uxR0` | 0.4 TON | `a/7KKTd9ep612fiEkHUFYZD6XzxXg4rKnluV6G1hlJg=` |
| Subscriber renewal | `0QCczMoV3C7Ny8gfpimS2i-_vMD2LryljPVlvHqXj9NBCIHA` | 0.4 TON | `6IkaEjhKzRLFy2JMOLKdKFnbcFo3S7ZuzhjZ8LhVq7Q=` |

Deployer remaining after funding: **~0.798 TON** (kept for deploy + gas).  
Treasury / Referrer A were not pre-funded; later activated via their own first external messages (state_init) so bounceable router payouts succeed.

---

## Live scenario results (backend API + on-chain; disposable wallets)

Harness: `backend/scripts/liveTonE2E.js` (TON Connect Mini App WebView **not** driven in this agent — marked below).

| Scenario | Result | Evidence |
| --- | --- | --- |
| **A** Referred first purchase | **PASS** | Tx `5nrnXskpEEeOau29stEmZP83LfhMaXU55gZlpA+TYYs=` — outs 38,250,000 → referrer, 54,036,132 → treasury; backend `CONFIRMED`; subscription active; `ReferralTonPayout` created; treasuryΔ≈53.98M, referrerΔ≈38.20M (fees) |
| **B** No referrer | **PASS** | Tx `FpmTNch7y9/FU9Fg+QL4qLyW7UNVgRrk16A2pjdwykI=` — 1 out to treasury; commission `0`; `CONFIRMED`; active |
| **C** Renewal | **PASS** | First `peQ5tuH7B2El2G3s9Tm7HT815ytVtNpvSraOCXLm/xA=`; renewal `bo6Jlyd5LqAIUIu1+gGeyG9H8eUHiHkonuYAnascZTA=`; renewal commission `0`; referrerΔ on renewal `0`; expiry extended; payout count stayed 1; re-confirm idempotent |
| **D** Tampering | **PASS** | Expired auth rejected; wrong-user confirm rejected; replay exit **104** tx `dc82821f90f4fc6b39064667c6b5bc44ccb60b806fae478003e30684b3c04d71`; underpayment exit **103** tx `c38596e4afa83c9c9853d167eb81167f925a2a4df592c4e92543710069a533fd` |
| **E** Delayed / partial | **PASS** | BOC-only submit → `PROCESSING`, subscription inactive (`inbound_tx_already_claimed` / no new chain tx). Earlier uninit-treasury bounce left funds in contract (not treated as settled without verified outs) |
| **F** Duplicates / concurrency | **PASS** | Concurrent intents → exactly 1 commission-eligible; duplicate confirm `alreadyConfirmed` |
| **G** Persistence | **PASS** | game-state re-fetch shows active+expiry; client `points`/`tonSubscriptionActive` inject rejected (400) |

### Mini App UI / Telegram WebView

| Item | Result |
| --- | --- |
| Purchase through TON Connect UI in Telegram WebView | **NOT RUN** — no interactive Telegram/TON Connect session in this environment; live path exercised via backend intent → wallet mnemonic send → submit/confirm (same settlement rules) |

---

## Balances after live E2E (nanoton)

| Account | Balance |
| --- | --- |
| Deployer | 502,925,274 |
| Treasury | 488,959,954 |
| Referrer A | 163,643,437 |
| Subscriber B | 196,002,291 |
| Subscriber no-ref | 197,818,039 |
| Subscriber renewal | 197,813,770 |
| Contract | 288,904,951 (includes earlier bounced payouts before wallet activation + reserves) |

---

## Setup (reproduce)

```bash
# secrets from prior run must exist — do not silently regenerate
test -f .secrets/ton-testnet-wallets.json

cd contracts && npm run build && npm run deploy:from-secrets

# backend live harness
cd backend
export TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4
export TON_TESTNET_TREASURY_ADDRESS=0QBXYguW_m-DxMIpfk5qFY27w1wg-jX-BOltcYq6iz_y6h_9
export TON_PAYMENT_SIGNER_PUBLIC_KEY=86c5a2f386ba8a8bca2267a92c287171e16d5ab12a11ff5315f9ffa12d84f4e0
# TON_PAYMENT_SIGNER_PRIVATE_KEY from .secrets (never commit)
unset TON_CHAIN_MOCK
node scripts/liveTonE2E.js
```

---

## Telegram policy

Digital goods/services inside Mini Apps require **Telegram Stars (`XTR`)** for production. Keep this TON checkout **testnet-only**.

---

## Notes

- Bounceable router payouts require **active** destination wallets (balance alone / non-bounceable credit is not enough). Activate via each wallet’s first external message with `state_init`.
- Backend address matching uses `Address.parse().toRawString()` so `0Q`/`EQ`/`0:` forms compare correctly.
- Discovery refuses inbound tx hashes already claimed by another payment (prevents false confirm from BOC-only submit).
