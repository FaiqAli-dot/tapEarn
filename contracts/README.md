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
| Rounding | Integer division; remainder to treasury |
| Default gross | `TON_SUBSCRIPTION_AMOUNT=0.1` (100_000_000 nanoton) |

## Testnet deploy status (2026-08-31)

| Item | Value |
| --- | --- |
| Network | `testnet` |
| Status | **FUNDING_REQUIRED** — deployer wallet unfunded; contract not yet on-chain |
| Deployer (needs testnet TON) | `0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU` |
| Treasury (YORZA testnet) | `0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T` |
| Payment signer pubkey (ed25519) | `b2fef7892defd10b586ebdb66da83c94e7a6faffbf23681d712193cd51494736` |
| Contract address | _pending deploy after funding_ |
| Deploy tx hash | _pending deploy after funding_ |

### Fund deployer (human step)

Automated HTTP faucets returned 401/404 in CI/agent runs. Fund the deployer with testnet GRAM, then re-run deploy:

1. Open Telegram **@testgiver_ton_bot**
2. Tap **Get 2 GRAM in testnet**, complete captcha
3. Paste deployer address: `0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU`
4. Verify on [testnet.tonscan.org](https://testnet.tonscan.org/address/0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU)
5. Alternative: [Chainstack TON testnet faucet](https://faucet.chainstack.com/ton-testnet-faucet) (requires free API key; wallet must be initialized)

### Explorers (public addresses)

- Deployer: https://testnet.tonscan.org/address/0QDDV5J02yNB8mEU8GfXqa9fqz0X6nCP8KwgketmbIFRgIJU
- Treasury: https://testnet.tonscan.org/address/0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T

## Tooling

```bash
cd contracts
npm install
npm run build          # compile ReferralPayment.fc → build/ReferralPayment.compiled.json
npm run deploy         # generate wallets (gitignored), fund deployer, deploy + test on testnet
npm test               # split math tests (../backend computePaymentSplit)
```

Secrets (mnemonics, signer seed) are written to `contracts/.deploy-secrets.json` (gitignored). Never commit mnemonics or private keys.

## Signing (backend only)

| Item | Detail |
| --- | --- |
| Key | `TON_PAYMENT_SIGNER_PRIVATE_KEY` (ed25519, 32-byte seed hex) |
| Public key | `TON_PAYMENT_SIGNER_PUBLIC_KEY` or derived; stored in contract init |
| On-chain auth | ed25519 over `cell_hash` of `(payment_id, subscriber, referrer, gross, fee_reserve, expiry)` |
| Off-chain API | Canonical JSON (`buildAuthorizationPayload` in backend) |
| Replay | `payment_id` uint256 in contract `processed` dict + DB `externalPaymentId` |
| Rotation | Deploy new contract with new pubkey; update env; pause old contract |

## Required env vars (Render / backend)

```
TON_NETWORK=testnet
TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=   # set after deploy
TON_TESTNET_TREASURY_ADDRESS=0QBVP_9rEHfTB8iextldwtqq0ugRUtaccJioD8Z_gWSprS1T
TON_PAYMENT_SIGNER_PUBLIC_KEY=b2fef7892defd10b586ebdb66da83c94e7a6faffbf23681d712193cd51494736
TON_PAYMENT_SIGNER_PRIVATE_KEY=            # from deploy secrets — NEVER commit
TON_SUBSCRIPTION_AMOUNT=0.1
```

## Tests (local, passing)

| Suite | Result |
| --- | --- |
| `contracts/tests/split.test.js` | 4/4 pass |
| `backend/tests/*.test.js` | 41/41 pass (includes TON payment mock flows) |

On-chain payment tests (gross 0.1 TON → 0.05 fee reserve → 25M/25M split) run automatically via `npm run deploy` once deployer is funded.

## Partial settlement

If inbound tx confirms but one outbound payout bounces, backend marks `PARTIALLY_SETTLED`. Contract sends both messages atomically in one `recv_internal`; bounce handling is off-chain reconciliation. Bounce simulation is not available in the deploy script; underpayment is rejected on-chain via `error::insufficient`.
