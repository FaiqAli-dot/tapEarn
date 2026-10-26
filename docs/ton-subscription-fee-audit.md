# Fee audit — Scenario A live trace (before code changes)

**Contract (deployed V3):** `0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4`  
**Scenario A tx:** `5nrnXskpEEeOau29stEmZP83LfhMaXU55gZlpA+TYYs=`  
**Explorer:** https://testnet.tonscan.org/tx/5nrnXskpEEeOau29stEmZP83LfhMaXU55gZlpA+TYYs=  
**Audit date:** 2026-10-26  
**Source:** tonapi transaction phases + contract FunC (no invented fee values)

---

## Observed amounts (nanoton)

| Leg | Amount | TON |
| --- | ---: | ---: |
| Incoming `msg_value` / credit | 100,000,000 | 0.100000000 |
| Out → referrer | 38,250,000 | 0.038250000 |
| Out → treasury | 54,036,132 | 0.054036132 |
| **Out sum** | **92,286,132** | **0.092286132** |
| **Gap (in − outs)** | **7,713,868** | **≈ 0.007713868** |

User-facing “0.00775 TON gap” matches this residual within rounding of displayed decimals.

---

## Phase fees from the same tx (tonapi)

| Phase | Field | Nanoton | Who pays / effect |
| --- | --- | ---: | --- |
| Storage | `fees_collected` | 6 | Taken from contract balance |
| Compute | `gas_fees` | 823,001 | Taken from contract balance (actual gas, **not** equal to RAWRESERVE) |
| Compute | `gas_used` | 12,345 | Metered steps |
| Inbound msg | `fwd_fee` | 121,513 | Paid by **sender** path for delivering the subscribe message (not part of the 100M credit gap in the same way; credit phase credited full 100M) |
| Out msg (referrer) | `fwd_fee` | 44,446 | Paid from contract when sending (mode 1) |
| Out msg (treasury) | `fwd_fee` | 44,446 | Paid from contract when sending (mode 1) |
| Bounces | — | none | Both outs `bounced: false` |

**Important:** Actual compute gas (823,001) ≪ contract `RAWRESERVE(7_500_000)`. A reserve is a **balance lock**, not the realized fee.

---

## How the deployed V3 contract accounts for the payment

From `ReferralPayment.fc` (deployed behavior):

1. Require `msg_value == signed amount` (100M).
2. `execution_reserve = 4_000_000 + 3_500_000 = 7_500_000`
3. `raw_reserve(execution_reserve, 0)` — locks ≥7.5M on the contract for this tx.
4. `outgoing_fees = GETFORWARDFEE(out_msg) × out_count` (here ×2).
5. `distributable = amount − execution_reserve − outgoing_fees`
6. If signed `commission > 0`: send **exactly `commission`** to referrer; send `distributable − commission` to treasury.
7. Mode `1` on sends: forward fees come from remaining contract balance (after reserve).

Implied from outs + formula:

- `distributable ≈ 38,250,000 + 54,036,132 = 92,286,132`
- `amount − reserve − distributable = 100M − 7.5M − 92,286,132 = **213,868**` → contract’s `outgoing_fees` budget for two msgs
- Observed per-out `fwd_fee` tags (44,446×2 = 88,892) are in the same order of magnitude as that budget (remainder covers action/compute interplay / rounding of GETFORWARDFEE inputs)

---

## Root cause of the ~0.00775 TON gap

The gap is **not** “mystery lost TON” and is **not** equal to actual gas burned.

| Component | ≈ Nanoton | Explanation |
| --- | ---: | --- |
| Execution `RAWRESERVE` | 7,500,000 | Locked on contract; **unused reserve is not refunded to subscriber** — stays on contract (recoverable later via `sweep_excess`) |
| Contract outbound fee budget | ~213,868 | `GETFORWARDFEE×2` deducted from distributable before payouts |
| **Sum** | **≈ 7,713,868** | Matches `in − outSum` |

Actual burned compute (823,001) + storage (6) + out fwd tags (~88,892) are paid from contract balance / fee mechanics **inside** that reserved+fee accounting — they do not add another 0.00775 on top of the gap.

**Trapped / unaccounted?** The unused portion of the 7.5M reserve remains on the contract balance (along with earlier historical bounce leftovers). It is not sent to treasury/referrer automatically. `sweep_excess` exists to move excess to treasury under signer auth — not silent discard, but also not automatic refund to the subscriber.

---

## Why the split was not 50/50 of net

Backend (live E2E) used a **high estimated** forward fee (`TON_TESTNET_FWD_FEE_NANOTON=8000000`):

- Estimated net ≈ `100M − 7.5M − 16M = 76.5M`
- Signed fixed commission = `76.5M / 2 = 38.25M`

On-chain actual net (distributable) ≈ **92.286M**. True 50/50 would be **≈ 46.143M each**.

Deployed contract paid the **signed fixed commission** (38.25M) to the referrer and gave the **remainder of actual net** to treasury (54.036M).

So:

- Gap vs gross → mostly **reserve + actual outbound fee budget** (auditable).
- Asymmetry vs 50/50-of-net → **fixed signed commission + overestimated off-chain fees**, not an extra hidden gas drain.

---

## Answers to audit questions

| Question | Answer |
| --- | --- |
| Who pays each fee? | Inbound fwd: sender route; compute/storage/out fwd: contract balance; reserve: locked on contract from payment |
| Which fees come out of the subscription amount? | On-chain: `RAWRESERVE` + `GETFORWARDFEE×N` are subtracted before distributable; realized gas ≤ reserve |
| Fixed amounts or percentages? | **Fixed** signed `commission` coins; treasury gets remainder of distributable (not an on-chain 50% of actual net) |
| Anything trapped? | Yes — unused reserve (and any prior bounce residue) on contract until `sweep_excess` |
| Can design know actual costs before distribute? | **No** for compute gas. It **can** know `GETFORWARDFEE` at runtime and can lock a reserve. Exact gas is only known after compute |

---

## Design implication (before edits)

To implement **50/50 of net after defined on-chain costs** safely:

1. At runtime: reserve execution, subtract actual `GETFORWARDFEE×out_count`, then `ref = distributable/2`, `tre = distributable − ref` when eligible.
2. Treat signed `commission > 0` as **eligibility**, not as the payout amount (amount cannot be known exactly off-chain).
3. `commission == 0` → full distributable to treasury (renewals / no referrer).
4. Off-chain quotes remain **estimates** only; confirmation must use observed outs.
5. Unused reserve stays on contract (sweepable) — never silently discarded to nowhere, never promised as subscriber refund unless a future explicit refund op is designed.

**Deploy note:** This changes on-chain payout math vs the live V3 contract → a **new testnet deploy is required** after owner approval. Do not redeploy in this task.

---

## Implementation locked in (V3.1 code — not deployed)

Exact on-chain formula (preferred policy):

```
execution_reserve = 4_000_000 + 3_500_000   # RAWRESERVE lock; ≠ actual gas
outgoing_fees     = GETFORWARDFEE(out_msg) × N   # N=2 if commission>0 else 1
distributable     = amount − execution_reserve − outgoing_fees
if commission > 0:
  referrer = distributable / 2          # floor
  treasury = distributable − referrer   # odd nano → treasury
else:
  treasury = distributable
```

- Signed `commission` is **eligibility only** (`>0` → split; backend signs `1` / `0`).
- Unused RAWRESERVE remains on the contract; recover via `sweep_excess` (never silent discard).
- Processed-id dict uses **`udict`** (uint256 keys); `idict` rejected high-bit keys with exit 5.
- Off-chain `computePaymentSplit` / quotes remain **estimates**; confirm uses `reconcileNetSplit` on observed outs.
