# TapEarn MVP — Progress Status

**Audited against:** Telegram Click-to-Earn App — MVP Requirements (v1)  
**Repo:** `FaiqAli-dot/tapEarn`  
**Audit date:** 2026-08-26  
**Codebase reviewed:** `main` (source) + `gh-pages` (frontend deploy)

---

## Executive summary

| Metric | Estimate |
| --- | --- |
| **Overall MVP completion** | **~45–55%** |
| Frontend Mini App shell | ~70% |
| Backend core APIs | ~50% |
| Referral system (complete + secure) | ~35% |
| Auth & security | ~20% |
| TON wallet + claim flow | ~25% |
| Smart contract (production-ready) | ~15% |
| Production deployment | ~30% |

**Verdict:** The project has a working tap-to-earn Mini App UI, MongoDB-backed users, basic tap syncing, referral code generation, TON Connect UI, and a draft FunC contract. The largest gaps are **real Telegram auth verification**, a **proper bot + deep-link referral loop**, **server-authoritative security**, **leaderboard UI**, **wallet ownership verification**, and an **end-to-end on-chain claim flow**.

---

## Stack present today

| Layer | Status | Notes |
| --- | --- | --- |
| Frontend | Done (shell) | React 18 + TypeScript + Vite + Tailwind + Framer Motion |
| Backend | Partial | Express + MongoDB/Mongoose; JS (not TypeScript) |
| Telegram Bot | Missing | `node-telegram-bot-api` is in deps but unused |
| TON Connect | Partial | UI connect/disconnect works; no claim txs |
| Smart contract | Draft only | `contracts/TapEarn.fc` exists; not deployed / not integrated |
| Database | Partial | `User` + `VideoCode` only — no Click/Earning or Referral entities |
| Deploy | Partial | Frontend on GitHub Pages; backend not clearly production-hosted |

---

## Checklist status (Section 8)

Legend: ✅ Done · 🟡 Partial · ❌ Not done

| # | Item | Status | Evidence / gap |
| --- | ---: | --- | --- |
| 1 | Telegram Bot | ❌ | No bot process, handlers, or `/start` deep-link handling |
| 2 | Telegram Mini App | 🟡 | App UI exists; bot username still placeholder (`@your_bot_username`) |
| 3 | Telegram authentication | 🟡 | Uses `initDataUnsafe` only — **no server HMAC verification of `initData`** |
| 4 | User registration | ✅ | `GET /api/users/init` creates MongoDB user by Telegram ID |
| 5 | Referral code generation | ✅ | Auto-generated unique 8-char code on user create |
| 6 | Referral link / deep linking | 🟡 | UI builds `t.me/...?start=ref_CODE`; bot username hardcoded placeholder; no bot `/start` handler |
| 7 | Referral tracking | 🟡 | `referredBy` + `referrals[]` stored; missing self-ref checks, reward credit, immutable rules |
| 8 | Click / earning system | 🟡 | Tap + batched sync + energy; no click history entity; client can also overwrite game state |
| 9 | Anti-cheat / rate limiting | 🟡 | Energy clamp on sync; `express-rate-limit` installed but **not applied**; auth spoofable |
| 10 | User dashboard | ✅ | Points, taps, referrals, earnings shown (Home / Profile / Invite) |
| 11 | Leaderboard | 🟡 | Backend `GET /users/leaderboard` exists; **no frontend screen** |
| 12 | TON Connect | ✅ | `@tonconnect/ui-react` connect / disconnect UI |
| 13 | Wallet storage | 🟡 | `walletAddress` / `walletConnected` on User; persisted via game-state update path |
| 14 | Wallet verification | ❌ | No signature / proof-of-ownership check |
| 15 | TON contract | 🟡 | Draft FunC with claim/admin ops; not compiled/deployed; incomplete vs Jetton standard |
| 16 | Reward / claim mechanism | ❌ | UI mentions claiming; no backend eligibility + on-chain claim flow |
| 17 | Double-claim protection | ❌ | No claim ledger off-chain; contract does not track claimed amounts as a separate ledger |
| 18 | Backend ↔ TON integration | ❌ | TON SDK deps present; no service calling RPC / contract |
| 19 | Production deployment | 🟡 | Frontend on `gh-pages`; backend + contract not production-ready |
| 20 | Basic admin panel | 🟡 | Video-code admin exists; not a full ops/admin panel; weak password gate |

**Rough score: 4 ✅ · 11 🟡 · 5 ❌**

---

## Feature-by-feature audit

### 1. Authentication

| Requirement | Status | Detail |
| --- | --- | --- |
| Telegram Mini App login | 🟡 | `useTelegram` reads WebApp user |
| Telegram user ID as identity | ✅ | `telegramId` unique on User |
| Backend verification of `initData` | ❌ | Frontend trusts `initDataUnsafe`; API trusts `x-user-id` / query `userId` with no crypto check |

**Risk:** Anyone can impersonate any Telegram user by sending another `userId`.

---

### 2. Click / earning system

| Requirement | Status | Detail |
| --- | --- | --- |
| Tap / click button | ✅ | `HomeScreen` + `useGameState.tap` |
| Server-authoritative balance | 🟡 | `POST /tap` and `/sync-taps` update server; **but** `POST /game-state` accepts client-supplied points |
| Anti-cheat / rate limiting | 🟡 | Caps sync to energy; no request rate limit middleware wired |
| Click / earning history | ❌ | No `Click` / `Earning` collection; only counters on User |
| Daily limits | 🟡 | Energy system acts as a soft limit; no explicit daily click cap |

**Extra (beyond MVP, already built):** energy regen, upgrades, offline earnings, daily tasks, YouTube video-code rewards.

---

### 3. Referral system

| Requirement | Status | Detail |
| --- | --- | --- |
| Unique referral code | ✅ | Generated on user create |
| Link like `/start ref_CODE` | 🟡 | Format used in UI; bot not implemented; placeholder username |
| Store `referrer_id` | 🟡 | Stored as `referredBy` (code string, not referrer user id) |
| Prevent self-referrals | ❌ | No check that code ≠ own code |
| Prevent changing referrer | 🟡 | Only set on create; no explicit lock / reject on later updates |
| Referral count | ✅ | `referrals.length` exposed as `referralCount` |
| Referral rewards | ❌ | Field exists; Invite UI shows milestones; **backend never credits rewards**; Invite history is mock data |
| Public site to obtain a code if no referral | ❌ | Not implemented |

**Bugs / wiring issues:**

- Frontend sends `startParam`; backend reads `userData.start` — param name mismatch risk.
- Referral history on Invite / Profile screens uses **hardcoded mock users**, not `user.referrals`.

---

### 4. User dashboard

| Requirement | Status | Detail |
| --- | --- | --- |
| Current points | ✅ | |
| Total clicks | ✅ | `totalTaps` |
| Referral count | ✅ | |
| Referral earnings | 🟡 | Displayed; usually stays `0` without reward logic |
| Basic leaderboard | 🟡 | API only — no UI |

---

### 5. Wallet

| Requirement | Status | Detail |
| --- | --- | --- |
| Connect TON wallet | ✅ | TON Connect UI |
| Store wallet address | 🟡 | Model + game-state path |
| Verify ownership / signature | ❌ | |
| Disconnect / change with restrictions | 🟡 | Disconnect works in UI; no server-side change policy |

---

### 6. Backend entities vs MVP schema

| Entity | Required fields | Status |
| --- | --- | --- |
| **User** | id, telegram_id, username, referral_code, referrer_id, points, total_clicks, referral_earnings, wallet_address, created_at | 🟡 Present with extra game fields; `referrer_id` is referral **code** string (`referredBy`), not ObjectId |
| **Click / Earning** | user_id, amount, type, timestamp | ❌ Missing |
| **Referral** | referrer_id, referred_user_id, reward, created_at | 🟡 Embedded array on User; no reward amount / separate collection |

---

### 7. TON smart contract

| Requirement | Status | Detail |
| --- | --- | --- |
| Contract source | 🟡 | `contracts/TapEarn.fc` |
| Deployment | ❌ | No deploy scripts / addresses in use |
| Owner / admin | 🟡 | Owner checks in draft |
| Reward / token config | 🟡 | `min_claim_amount`, `jetton_master` stubs |
| User claim OR admin distribution | 🟡 | `claim_points` op drafted |
| Prevent double claiming | ❌ | Deducts points in contract storage, but no off-chain claim records + no robust eligibility bridge |
| Track claimed amounts | ❌ | No dedicated claimed-amount map |
| Emergency / admin controls | 🟡 | withdraw, set prices, set jetton master |
| Standard Jetton (Master + Wallet) | ❌ | Mentions jetton master; does not implement Jetton architecture |
| Backend ↔ contract integration | ❌ | |

**Claim flow (required):** not implemented end-to-end. UI only advertises “Claim Points as Tokens”.

---

### 8. Security requirements

| Requirement | Status |
| --- | --- |
| Never trust Telegram data without server verification | ❌ |
| Never trust click counts from client | 🟡 (sync path better; game-state overwrite path fails this) |
| Prevent duplicate / reforged referral claims | ❌ |
| Prevent self-referrals | ❌ |
| Prevent multi-account referral abuse | ❌ |
| Rate-limit clicking APIs | ❌ (dep unused) |
| Validate TON txs server-side | ❌ |
| Never store private keys | 🟡 (`TON_WALLET_MNEMONIC` in env.example is a red flag for ops hygiene) |
| Wallet ownership crypto verification | ❌ |
| Contract double-claim prevention | ❌ |

---

### 9. Out of scope (Section 7)

These are correctly **not** required for MVP. Current codebase has already started some adjacent features (energy upgrades, offline earn, video tasks). That is fine, but they should not be mistaken for MVP completion.

---

## What’s done well

1. Playable Mini App shell with tap loop, energy, upgrades, daily tasks.
2. MongoDB user model with referral codes and wallet fields.
3. Server tap / sync endpoints with energy-based clamping.
4. TON Connect wired into the React app + `tonconnect-manifest.json`.
5. Video-code admin / verification (extra product surface).
6. Frontend static deploy on GitHub Pages (`https://faiqali-dot.github.io/tapEarn/`).

---

## What’s remaining (priority order)

### P0 — MVP blockers

1. **Telegram `initData` server verification** — stop trusting raw `userId`.
2. **Telegram Bot** — `/start`, Mini App launch button, `ref_CODE` deep links.
3. **Referral hardening** — self-ref block, immutable referrer, real rewards, real referral lists (no mocks), fix start-param wiring.
4. **Server-authoritative economy** — remove or lock down client `POST /game-state` point writes; add click history.
5. **Rate limiting** on tap/sync endpoints.

### P1 — Wallet & chain

6. Persist wallet via dedicated API; verify ownership when needed.
7. Finish / rewrite contract for claim-only rewards (off-chain points → on-chain claim).
8. Double-claim protection (DB claim records + contract checks).
9. Backend TON integration for eligibility + claim confirmation.
10. Optional Jetton Master/Wallet if launching a token.

### P2 — Product polish

11. Leaderboard screen.
12. Public landing page to distribute referral codes.
13. Production backend hosting + env secrets.
14. Basic admin panel for users / claims / config (beyond video codes).
15. Replace placeholder bot username / Telegram meta tags.

---

## Suggested completion bands

| Area | Done | Remaining |
| --- | ---: | ---: |
| Mini App UI / dashboard | 75% | Polish, leaderboard UI, real referral lists |
| Auth + bot | 15% | Bot + initData verify |
| Click economy | 55% | History, rate limits, no client balance overwrite |
| Referrals | 35% | Rewards, security, deep links via bot |
| Wallet | 40% | Persist + verify + claim UX |
| Contract + claims | 15% | Deploy, jetton/claim design, integration |
| Deploy / admin | 35% | Backend prod, real admin, secrets |

**Overall: roughly half the MVP is in place as a prototype; the other half is security, bot/referral loop, and on-chain claims.**

---

## File map (where things live)

```
src/                          # Mini App frontend
  hooks/useTelegram.ts        # Telegram WebApp (unsafe user)
  hooks/useGameState.ts       # Tap / sync / upgrades
  screens/*                   # Home, Invite, Wallet, Profile, Daily
  services/api.ts             # REST client
backend/src/
  models/User.js              # Main entity
  controllers/userController.js
  routes/userRoutes.js
  models/VideoCode.js         # Extra feature
contracts/TapEarn.fc          # Draft FunC contract
public/tonconnect-manifest.json
```

---

## Next recommended milestone

Ship a **secure closed beta** before touching Jettons:

1. Bot + Mini App with verified `initData`
2. Mandatory referral on first open
3. Server-only tap credits + rate limits
4. Real referral rewards + count
5. Wallet connect stored on user
6. Leaderboard UI

Then implement claim: eligibility API → user signs tx → contract pays → backend marks claimed.
