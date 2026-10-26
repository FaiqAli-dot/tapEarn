# YORZA V2 — Non-Custodial TON Referral & Subscription Router (Testnet)

**MAINNET NOT DEPLOYED** — testnet-only deployment.

## Router design

- Single `subscribe` op (`0x591a2b3c`)
- Backend ed25519 authorization: `payment_id`, `subscriber`, `referrer`, `amount`, `expiry`, `nonce`
- On-chain: `RAWRESERVE` execution gas + `GETFORWARDFEE` ×2, then 50/50 split of distributable amount
- Odd nanotons → treasury
- Replay protection via processed `payment_id` dict
- **No** admin, pause, withdraw, treasury change, or user state on-chain

## Fee policy (v2-router)

| Step | On-chain |
| --- | --- |
| Incoming | `msg_value` must equal signed `amount` |
| Execution reserve | `RAWRESERVE(EXEC_BASE + EXEC_DICT_OP)` |
| Outgoing fees | `2 × GETFORWARDFEE` for bounceable internal transfers |
| Distributable | `amount - execution_reserve - outgoing_fees` |
| Split | `referrer = distributable / 2`, `treasury = distributable - referrer` |

Backend quotes mirror this with configurable `TON_TESTNET_FWD_FEE_NANOTON` estimate; on-chain config is authoritative.

## Testnet deploy (V2 router — 2026-09-01)

| Item | Value |
| --- | --- |
| Network | `testnet` |
| Status | **LIVE** — 0.1 TON split proven on-chain; replay rejected (exit 104) |
| Contract | `0QDb2mg_3L8FMmA-wiX5c8Eec9PDz8OZVufWZmmdI7xUgJ3w` |
| Deploy tx | `7/jllwi5QLFDH52nC6Mp1SMrrbwfxSisRmZ4UKddoYU=` |
| Treasury | `0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T` |
| Signer pubkey | `b2fef7892defd10b586ebdb66da83c94e7a6faffbf23681d712193cd51494736` |
| Deployer | `0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU` |

### V1 contract (superseded — do not use for new payments)

`0QCxSMBZy7Z9PkkrmIE-2H-tz4H6BsVGxXeue9pbI_uu6Xf2` — had admin/pause and hardcoded fee_reserve; replaced by V2 router.

### On-chain verification (V2)

| Event | Link |
| --- | --- |
| Contract | https://testnet.tonscan.org/address/0QDb2mg_3L8FMmA-wiX5c8Eec9PDz8OZVufWZMmdI7xUgJ3w |
| Deploy tx | https://testnet.tonscan.org/tx/7/jllwi5QLFDH52nC6Mp1SMrrbwfxSisRmZ4UKddoYU= |
| 0.1 TON split (46,143,066 / 46,143,066 nanotons, no bounce) | https://testnet.tonscan.org/tx/%2FcNd0Y8r0FBIQ07SIFdxV4mu0Rcz6ASQ9sY6quZ1J%2F4%3D |
| Replay rejected (exit 104) | https://testnet.tonscan.org/tx/ULhTVMc9Z20WjfH6JT4k4lscG/6CRwbYFUn1ngXtZt0= |

```bash
cd contracts
npm install
npm run build
export TON_DEPLOYER_MNEMONIC="..."
export TON_TESTNET_TREASURY_ADDRESS="..."
export TON_PAYMENT_SIGNER_PRIVATE_KEY="..."
export TON_PAYMENT_SIGNER_PUBLIC_KEY="..."
npm run deploy
```

## Tests (local)

| Suite | Command |
| --- | --- |
| Split math | `npm run test:split` |
| Sandbox router | `npm test` |
| Backend | `cd ../backend && npm test` |

## Required backend env

```
TON_NETWORK=testnet
TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=<from deploy-report.json>
TON_TESTNET_TREASURY_ADDRESS=...
TON_PAYMENT_SIGNER_PUBLIC_KEY=...
TON_PAYMENT_SIGNER_PRIVATE_KEY=...   # NEVER commit
TON_SUBSCRIPTION_AMOUNT=0.1
```
