# YORZA ReferralPayment Contract (Testnet)

**MAINNET NOT DEPLOYED** — testnet-only deployment.

## Economic rule

After applicable TON transaction and payout fees are deducted, the remaining net subscription amount is split 50/50 between the verified referrer and YORZA.

## Fee policy (v1)

| Field | Value |
| --- | --- |
| `FEE_RESERVE_NANOTON` | 50_000_000 (0.05 TON estimate) |
| Deduction | Subtracted from **gross** before split |
| Split | `referrer = net / 2`, `treasury = net - referrer` (odd nanotons → treasury) |
| Default gross | `TON_SUBSCRIPTION_AMOUNT=0.1` (100_000_000 nanoton) |

## Testnet deploy (2026-08-31)

| Item | Value |
| --- | --- |
| Network | `testnet` |
| Status | **DEPLOYED** |
| Contract | `0QCxSMBZy7Z9PkkrmIE-2H-tz4H6BsVGxXeue9pbI_uu6Xf2` |
| Deploy tx | `Lglz8FL9LWLyRif/9RuD5xm0md2q24fBqMLYzWE8BF4=` |
| Treasury | `0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T` |
| Signer pubkey (ed25519) | `b2fef7892defd10b586ebdb66da83c94e7a6faffbf23681d712193cd51494736` |
| Deployer | `0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU` |

### Explorers

- Contract: https://testnet.tonscan.org/address/0QCxSMBZy7Z9PkkrmIE-2H-tz4H6BsVGxXeue9pbI_uu6Xf2
- Deploy tx: https://testnet.tonscan.org/tx/Lglz8FL9LWLyRif/9RuD5xm0md2q24fBqMLYzWE8BF4=
- Treasury: https://testnet.tonscan.org/address/0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T
- Deployer: https://testnet.tonscan.org/address/0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU

### Live payment test (0.1 TON)

| Check | Result |
| --- | --- |
| 0.1 TON gross on testnet | **BLOCKED** — deployer balance depleted (~0.09 TON remaining; need ≥0.1 TON + gas for subscriber payment) |
| Sandbox 0.1 TON split | **PASS** — 25_000_000 / 25_000_000 nanoton nominal; ~24_876_400 received each after outbound forward fees |
| Replay / duplicate | **PASS** in sandbox (second identical `payment_id` does not pay again) |
| Wrong amount | **PASS** in sandbox (underpay rejected; no extra payout) |

Re-run live payment after topping up deployer or funded subscriber wallet:

```bash
cd contracts
npm install
npm run build
node scripts/pay-testnet.js   # single 0.1 TON payment against deployed contract
```

## Tooling

```bash
cd contracts
npm install
npm run build          # compile ReferralPayment.fc
npm run deploy         # deploy + integration tests (secrets in .deploy-secrets.json, gitignored)
npm test               # split math tests
```

## Required env vars (Render / backend)

```
TON_NETWORK=testnet
TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=0QCxSMBZy7Z9PkkrmIE-2H-tz4H6BsVGxXeue9pbI_uu6Xf2
TON_TESTNET_TREASURY_ADDRESS=0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T
TON_PAYMENT_SIGNER_PUBLIC_KEY=b2fef7892defd10b586ebdb66da83c94e7a6faffbf23681d712193cd51494736
TON_PAYMENT_SIGNER_PRIVATE_KEY=            # from deploy secrets — NEVER commit
TON_SUBSCRIPTION_AMOUNT=0.1
```

## Tests (local)

| Suite | Result |
| --- | --- |
| `contracts/tests/split.test.js` | 4/4 pass |
| `backend/tests/*.test.js` | 41/41 pass |

## Partial settlement

If inbound tx confirms but one outbound payout bounces, backend marks `PARTIALLY_SETTLED`. Contract sends both outbound messages atomically in one `recv_internal`; bounce simulation is not available in the deploy script.
