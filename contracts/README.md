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

## Signing (backend only)

| Item | Detail |
| --- | --- |
| Key | `TON_PAYMENT_SIGNER_PRIVATE_KEY` (ed25519, 32-byte seed hex) |
| Public key | `TON_PAYMENT_SIGNER_PUBLIC_KEY` or derived; stored in contract init |
| Payload | Canonical JSON sorted keys (`buildAuthorizationPayload` in backend) |
| Replay | `payment_id` uint256 in contract `processed` dict + DB `externalPaymentId` |
| Rotation | Deploy new contract with new pubkey; update env; pause old contract |

## Required env vars (deploy)

```
TON_NETWORK=testnet
TON_DEPLOYER_MNEMONIC=          # 24 words — NEVER commit
TON_TESTNET_TREASURY_ADDRESS=     # YORZA testnet treasury
TON_PAYMENT_SIGNER_PUBLIC_KEY=    # ed25519 hex for contract init
TON_SUBSCRIPTION_AMOUNT=0.1
```

## Deploy (when secrets available)

1. Install [Blueprint](https://github.com/ton-org/blueprint) or `func` + `fift` toolchain locally.
2. Compile `ReferralPayment.fc` with stdlib imports.
3. Deploy to **testnet** with init: `(admin, treasury, signer_pubkey, paused=0, empty dict)`.
4. Record deploy tx hash and contract address in Render env as `TON_TESTNET_REFERRAL_CONTRACT_ADDRESS`.

## Partial settlement

If inbound tx confirms but one outbound payout bounces, backend marks `PARTIALLY_SETTLED`. Contract sends both messages atomically in one recv_internal; bounce handling is off-chain reconciliation.

## Status

Deploy blocked in CI/agent runs without `TON_DEPLOYER_MNEMONIC`. Code + split tests ship; address recorded after manual testnet deploy.
