# YORZA V3 — Non-Custodial TON Subscription Payment Router (Testnet)

**MAINNET NOT DEPLOYED** — testnet-only deployment.

## Router design

- Ops: `subscribe` (`0x591a2b3c`), `sweep_excess` (`0x7a3e91d0`) for bounced/stuck balance → treasury
- Backend ed25519 authorization binds: `payment_id`, `subscriber`, `referrer`, `amount`, **`commission`**, `expiry`, `nonce`
- `commission > 0` → referrer gets commission, treasury gets remainder (first payment)
- `commission == 0` → full distributable to treasury (renewals / no referrer)
- Fees: `RAWRESERVE(EXEC_BASE+EXEC_DICT)` + `GETFORWARDFEE × outbound_count`
- Odd nanotons on 50/50 → treasury (backend uses floor(`/2`))
- Replay protection via processed `payment_id` dict (marked before sends in the same tx)
- Bounces ignored on ingress (funds stay in contract); backend must not treat partial as settled
- **No** admin/pause/treasury mutation

## Fee policy (v3-router)

| Step | On-chain |
| --- | --- |
| Incoming | `msg_value` must equal signed `amount` |
| Execution reserve | `RAWRESERVE(EXEC_BASE + EXEC_DICT_OP)` |
| Outgoing fees | `GETFORWARDFEE × (commission > 0 ? 2 : 1)` |
| Distributable | `amount - execution_reserve - outgoing_fees` |
| Split | signed `commission` to referrer (if > 0); remainder to treasury |

## Eligibility (backend)

- First successful **CONFIRMED** payment with a verified referrer wallet may include 50% commission.
- Failed / expired intents do **not** consume eligibility.
- Concurrent intents: atomic lock on `User.tonFirstCommissionLockPaymentId`.
- Renewals always `commission = 0`.

## Settlement

1. Client submits BOC or hash after TON Connect (BOC ≠ activation).
2. Backend discovers contract inbound tx and inspects `out_msgs` on the **same** tx.
3. `CONFIRMED` only when all expected payouts verify; then subscription activates.
4. `PARTIALLY_SETTLED` if a leg is missing/bounced — **no** activation, **no** referral ledger credit.
5. Use signer-authorized `sweep_excess` to recover bounced balance to treasury.

## Deploy (testnet)

```bash
cd contracts
npm install
npm run build
npm run wallets:generate   # writes .secrets/ (gitignored)
# Fund deployer via Telegram @testgiver_ton_bot (captcha) — programmatic faucets are unreliable
npm run deploy:from-secrets
```

Never set `TON_NETWORK=mainnet`. Never commit `.secrets/`.

## Tests (local)

| Suite | Command |
| --- | --- |
| Split math | `npm run test:split` |
| Sandbox router | `npm test` |
| Backend + scenarios A–G (mock chain) | `cd ../backend && npm test` |

## Live V3 deploy (2026-10-26)

| Item | Value |
| --- | --- |
| Contract | `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4` |
| Code hash | `e319b075bcc380405aee1a06854561e34f2510d79624e47f935d142bb7c27ec7` |
| Deploy tx | `bEz3Dv0V85q/SKbkcF46B42N1jn2IYF5ehOf6H4omtc=` |
| Explorer | https://testnet.tonscan.org/address/0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4 |

## Prior V2 deploy (superseded by V3 auth shape)

V2 contracts that omit the `commission` field are incompatible with V3 payloads.

Legacy V2 address (do not use for V3 payments): `0QDb2mg_3L8FMmA-wiX5c8Eec9PDz8OZVufWZMmdI7xUgJ3w`
