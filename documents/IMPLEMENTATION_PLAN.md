# TapEarn — Implementation Plan (Missing Work)

**Goal:** Finish the off-chain MVP first, design game data/flows so the TON subscription contract plugs in later, then build the contract last.  
**Related:** [`MVP_STATUS.md`](./MVP_STATUS.md)  
**Updated:** 2026-08-26

---

## Guiding rules

1. **Contract is last** — no FunC/deploy work until off-chain game + wallets + referrals are solid.
2. **Design for the contract now** — every feature below should leave the right fields, APIs, and UI hooks so subscription payouts do not require a rewrite.
3. **Server is source of truth** — points, referrals, subscription status, and wallets are never trusted from the client alone.
4. **Referral is permanent** — set once at registration; never changed; required for the future 50/50 TON split.

---

## Future contract (rough — build last)

> Placeholder design so Phase 1–6 stay aligned. Do **not** implement this yet.

### Product rule

When a user **buys a subscription**, they send **1 TON** to the contract.

Contract receives the payment, then:

1. Deduct **transaction / network fee** (and any fixed protocol fee if you add one later).
2. Split the **remaining amount into 2 equal parts**:
   - **50% → referrer** (the user whose referral code this buyer used at signup)
   - **50% → owner** (project treasury / admin wallet)

```
User pays 1 TON
      ↓
Contract receives payment
      ↓
Subtract fees
      ↓
Remaining ÷ 2
   ├──→ Referrer wallet
   └──→ Owner wallet
```

### What this forces the off-chain app to already have

| Needed for contract | Must exist in DB / backend before contract |
| --- | --- |
| Who referred whom | Immutable `referrerId` (user id, not only code string) |
| Where to send referrer share | Referrer’s verified `walletAddress` |
| Where to send owner share | Configured `OWNER_WALLET` |
| Did this user already subscribe? | `subscription` status + history (prevent double subscribe abuse) |
| Link payment ↔ user | Pending payment / tx hash / claim confirmation records |
| Buyer identity on-chain | Buyer’s connected TON wallet tied to Telegram user |

### Off-chain behavior until contract exists

- Subscription can be modeled as a **state machine** in MongoDB:
  - `none` → `pending_payment` → `active` → `expired` (if timed)
- UI + APIs for “Buy subscription” should call a **SubscriptionService** abstraction:
  - **Now:** mock / manual / admin-activate (dev only)
  - **Later:** create pending → user sends 1 TON via TON Connect → backend/indexer confirms → mark `active`
- Referral earnings from subscriptions should have a ledger field ready:
  - `subscriptionReferralEarningsTon` (or a `Payout` collection)
  - Even if amounts stay `0` until contract live

**Do not** use the current draft `TapEarn.fc` claim/upgrade design as-is — rewrite later around **subscription payment + fee + 50/50 split**.

---

## Work order overview

| Phase | Name | Why this order | Depends on |
| ---: | --- | --- | --- |
| **1** | Telegram auth + bot | Everything else is spoofable without this | — |
| **2** | Referral system (real + locked) | Growth loop + future 50/50 payouts | Phase 1 |
| **3** | Server-authoritative game economy | Fair points; anti-cheat | Phase 1 |
| **4** | Wallet bind + verification | Needed before any real TON money moves | Phase 1 |
| **5** | Subscription product (off-chain first) | Core monetization; shapes contract later | Phases 2 + 4 |
| **6** | Dashboard polish + leaderboard | Retention / social proof | Phases 2–3 |
| **7** | Admin + production deploy | Operate and ship | Phases 1–6 |
| **8** | TON subscription contract (LAST) | Real fee + 50/50 split on-chain | Phases 2, 4, 5, 7 |

---

## Phase 1 — Telegram authentication + bot

**Outcome:** Only real Telegram users can play; bot opens Mini App and carries referral codes.

### Do

1. **Bot**
   - Implement Telegram bot (`/start`, optional `/help`).
   - Handle `/start ref_CODE` → store start param → open Mini App with that referral context.
   - Set real bot username everywhere (replace `@your_bot_username`).
2. **Auth**
   - Frontend sends full `initData` string to backend (not only `initDataUnsafe`).
   - Backend verifies HMAC with bot token (Telegram WebApp auth algorithm).
   - Issue short-lived session/JWT after verify; all game APIs require that session.
3. **Kill spoofing**
   - Stop trusting raw `x-user-id` / query `userId` as identity.
   - Identity = verified Telegram id from `initData`.

### Done when

- Unverified API calls are rejected.
- Opening `t.me/<bot>?start=ref_XXXX` launches the app with that referral context.

---

## Phase 2 — Referral system (contract-ready)

**Outcome:** Every user has exactly one permanent referrer; invites and counts are real; data is ready for later TON splits.

### Do

1. **Registration gate**
   - New users must provide a valid referral code (from deep link or manual entry).
   - Public landing page (simple) that can hand out / explain how to get a code if they have none.
2. **Rules**
   - Reject self-referral.
   - Reject invalid / unknown codes.
   - Store `referrerId` (Mongo user id or telegram id of referrer) **and** `referralCodeUsed`.
   - **Never allow changing referrer** after first save.
3. **Tracking**
   - Separate `Referral` collection (or hardened embedded docs):
     - `referrerId`, `referredUserId`, `createdAt`, `rewardPoints` (off-chain), `subscriptionPayouts[]` (for later TON)
   - Replace mock referral lists on Invite / Profile with API data.
4. **Off-chain referral rewards (points)**
   - Decide simple MVP rules (e.g. bonus on signup + % of referred taps **or** milestone bonuses).
   - Credit on server only; update `referralEarnings` + history.
5. **Contract prep fields on User**
   - `referrerId` (immutable)
   - `walletAddress` (for receiving future subscription splits — filled in Phase 4)
   - Counters: `referralCount`, `subscriptionReferralEarningsTon` (default 0)

### Done when

- No user exists without a locked referrer (except maybe a single seeded genesis/owner account).
- Invite screen shows real referrals and earnings.
- Data model can answer: “Who gets 50% when user X subscribes?”

---

## Phase 3 — Click / earning economy (secure)

**Outcome:** Points only move through trusted server actions.

### Do

1. Remove or severely restrict `POST /game-state` so clients cannot set `points` / `totalTaps` / `referralEarnings`.
2. Keep / improve:
   - `POST /tap` or batched `POST /sync-taps`
   - Energy (or daily limits) enforced server-side
3. Add **rate limiting** on tap/sync (use existing `express-rate-limit`).
4. Add **Click / Earning** history collection:
   - `userId`, `amount`, `type` (`tap` | `task` | `referral` | `subscription_bonus` | …), `timestamp`
5. Keep upgrades / daily tasks / video codes if desired — but all rewards server-granted after validation.

### Done when

- Manipulating the client cannot inflate balance.
- You can audit a user’s point history.

---

## Phase 4 — Wallet connect (bind to user)

**Outcome:** Each Telegram user can bind one TON wallet for later payouts / payments.

### Do

1. Dedicated APIs:
   - `POST /wallet/connect` — save address after TON Connect session
   - `POST /wallet/disconnect` — with rules (e.g. not while `pending_payment`)
2. **Ownership verification** when needed (proof message / ton_proof).
3. Persist on User; show on Profile.
4. **Policy for referrers:** warn that subscription referral TON can only be paid if referrer has a connected wallet (UI copy now; enforce at contract time).

### Done when

- Wallet address is stored against verified user, not only in local React state.
- Disconnect/change rules are documented and enforced lightly.

---

## Phase 5 — Subscription product (inner game around contract)

**Outcome:** Subscription is a first-class game feature off-chain, with payment flow designed to swap to the contract later.

### Product decisions to lock now

| Decision | Suggested MVP default |
| --- | --- |
| Price | **1 TON** |
| Split after fees | **50% referrer / 50% owner** |
| What subscription unlocks | Define clearly (e.g. higher tap power, extra energy, exclusive tasks, badge, multiplier) — pick 1–2 benefits so UI is honest |
| Duration | Decide: lifetime vs 30-day (affects `expiresAt`) |
| Who can buy | Active registered user with referrer + connected wallet |

### Do (off-chain)

1. **User fields**
   - `subscriptionStatus`: `none | pending | active | expired`
   - `subscriptionStartedAt`, `subscriptionExpiresAt` (nullable)
   - `subscriptionPaymentTx` (nullable until chain)
2. **SubscriptionService interface**
   - `startPurchase(userId)` → create pending record
   - `confirmPurchase(userId, txHash)` → activate (later: verify on-chain)
   - `getStatus(userId)`
3. **UI**
   - Clear “Subscribe — 1 TON” screen
   - Explains: fee + half to your inviter + half to project (transparency builds trust)
   - Shows whether referrer has a wallet (payout readiness)
4. **Ledger**
   - `SubscriptionPayment` records: buyer, referrer, amountTon, feeTon, referrerShare, ownerShare, status, txHash
5. **Game gating**
   - Wire at least one real gameplay benefit to `subscriptionStatus === active` so the economy already “orbits” subscription.

### Dev / staging without contract

- Admin endpoint or script to mark subscription `active` for testing gameplay benefits.
- Keep the same `SubscriptionPayment` shape you’d use after mainnet.

### Done when

- Subscribed vs free users behave differently in-game.
- Creating a purchase writes a ledger row that already has referrer + owner share fields (even if settlement is simulated).

---

## Phase 6 — Dashboard polish

**Outcome:** Users understand progress and competition.

### Do

1. Leaderboard screen (use existing API; show rank, name/username, points).
2. Dashboard cards: points, taps, referral count, referral point earnings, subscription status, (later) TON referral earnings.
3. Invite flow polish: copy link, share, show milestone progress from **real** data.

### Done when

- Leaderboard visible in nav.
- No mock referral history left in production paths.

---

## Phase 7 — Admin + production

**Outcome:** You can run this for real users.

### Do

1. **Admin (basic)**
   - Users list, referral graph peek, subscription status override (staging), config: owner wallet, subscription price, fee note.
   - Replace hardcoded admin password with env-based auth.
2. **Deploy**
   - Backend on a real host (Railway / Render / VPS / etc.).
   - MongoDB Atlas (or equivalent).
   - Frontend env pointing at production API.
   - Secrets: bot token, JWT secret — **never** commit mnemonics; avoid storing private keys if contract can receive user-paid TON directly.
3. **Observability**
   - Health checks, basic logs for auth failures / tap abuse / subscription pending.

### Done when

- Real Telegram users can register → refer → tap → bind wallet → (test) subscribe on staging.

---

## Phase 8 — TON subscription contract (LAST)

**Outcome:** Real 1 TON subscription payments settle fee + 50/50 on-chain.

### Contract responsibilities

1. Accept subscription payment (**1 TON** from buyer).
2. Identify / receive necessary payload: buyer + referrer addresses (exact encoding TBD).
3. Subtract fees.
4. Send 50% of remainder to **referrer wallet**.
5. Send 50% of remainder to **owner wallet**.
6. Emit / persist enough info for backend to mark subscription `active` (event / tx parse).
7. Protect against double-subscribe / replay as needed.
8. Admin controls: update owner, pause, withdraw stuck funds if appropriate.

### Backend after contract

1. Replace mock confirm with: wait for tx → parse → verify amount/addresses → set `active` + fill ledger shares.
2. Indexer or toncenter polling for confirmation.
3. If referrer has no wallet at payment time: define policy (reject purchase **or** hold referrer share on contract for later claim — decide before coding).

### Explicitly out of scope for this contract version

- Per-click on-chain txs  
- Full Jetton economy (unless you later add a separate token)  
- DAO / staking / NFT  

---

## Suggested build sequence (practical sprints)

```
Sprint A  → Phase 1 (Bot + initData auth)
Sprint B  → Phase 2 (Referrals locked + real UI)
Sprint C  → Phase 3 (Server economy + rate limits + history)
Sprint D  → Phase 4 (Wallet bind/verify)
Sprint E  → Phase 5 (Subscription off-chain + gameplay benefits)
Sprint F  → Phase 6 + 7 (Leaderboard, admin, production)
Sprint G  → Phase 8 (Contract + integration)   ← LAST
```

---

## Data model sketch (align Phases 2–5 now)

```text
User
  telegramId
  referralCode
  referrerId              // immutable
  points, totalTaps, energy...
  referralEarnings        // points
  subscriptionReferralEarningsTon
  walletAddress, walletVerifiedAt
  subscriptionStatus, subscriptionStartedAt, subscriptionExpiresAt
  createdAt

Referral
  referrerId
  referredUserId
  createdAt
  signupBonusPoints

EarningEvent
  userId, amount, type, meta, createdAt

SubscriptionPayment
  buyerUserId
  referrerUserId
  buyerWallet
  referrerWallet
  ownerWallet
  amountTon               // 1
  feeTon
  referrerShareTon        // (amount - fee) / 2
  ownerShareTon           // (amount - fee) / 2
  status                  // pending | confirmed | failed
  txHash
  createdAt, confirmedAt
```

---

## What not to do yet

- Do not rewrite / deploy `contracts/TapEarn.fc` for claims/upgrades.
- Do not put private keys in the app for “sending” referrer share from a hot wallet if the contract can split itself.
- Do not leave client-writable balances once Phase 3 starts.
- Do not ship referral links with placeholder bot username.

---

## Success definition for “MVP without contract”

A real Telegram user can:

1. Open bot with someone’s referral link  
2. Authenticate securely  
3. Get a locked referrer + own invite link  
4. Tap and earn with server-trusted balance  
5. See dashboard + leaderboard  
6. Connect a TON wallet  
7. Enter a subscription flow that records a pending/active subscription and unlocks gameplay benefits  

Then Phase 8 only replaces **how payment settles**, not **how the game works**.
