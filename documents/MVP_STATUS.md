# YORZA MVP — Progress Status

**Product:** YORZA (Telegram Mini App via @YORZAEARNBOT)  
**Repo:** `FaiqAli-dot/tapEarn`  
**Audit date:** 2026-08-31  
**Branch reviewed:** `main` (+ point-history / nav polish)

**Related:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`LOCAL_DEV.md`](./LOCAL_DEV.md)

---

## Executive summary

| Metric | Estimate |
| --- | --- |
| **Overall MVP completion** | **~75–85%** |
| Telegram auth + bot | ~90% |
| Referral system (direct, locked, 50% first payment) | ~85% |
| Server-authoritative economy | ~85% |
| Campaigns + quests + engagement | ~80% |
| Leaderboards | ~90% |
| TON wallet + proof + testnet subscription flow | ~70% |
| Smart contract (production subscription split) | ~15% (draft only) |
| Admin / ops dashboard | ~45% |
| Production deployment | ~75% |

**Verdict:** The off-chain MVP is largely in place: JWT session auth, Telegram bot, locked one-level referrals, auditable `PointTransaction` ledger, tap/quest/campaign earning, leaderboards, TON Connect + wallet proof, and a **testnet** TON subscription payment flow with 50/50 referrer/treasury split authorization. Remaining work is mainly **full admin ops**, **production TON contract**, **UI polish / YORZA branding consistency**, and **hardening edge cases** before mainnet money.

---

## Stack today

| Layer | Status | Notes |
| --- | --- | --- |
| Frontend | Done (shell) | React 18 + TS + Vite + Tailwind; GitHub Pages at `/tapEarn/` |
| Backend | Strong | Express + Mongoose; JWT auth; rate limits; 41 automated tests |
| Telegram Bot | Done | `/start`, `ref_CODE` deep links, Mini App button |
| Database | Strong | User, Campaign, PointTransaction, Payment, ReferralReward, etc. |
| TON Connect | Partial | Connect + ton-proof verify; testnet subscription intents |
| Smart contract | Draft | `contracts/TapEarn.fc` — not aligned with subscription split; build last |
| Deploy | Partial | Frontend on GitHub Pages; backend on Render (`yorza.onrender.com`) |

---

## Checklist (original MVP §8)

Legend: ✅ Done · 🟡 Partial · ❌ Not done

| # | Item | Status | Notes |
| ---: | --- | --- | --- |
| 1 | Telegram Bot | ✅ | `telegramBot.js` — `/start`, referral param, Web App URL |
| 2 | Telegram Mini App | ✅ | Routes, auth on load; @YORZAEARNBOT meta |
| 3 | Telegram authentication | ✅ | HMAC `initData` verify + JWT; dev auth for local |
| 4 | User registration | ✅ | Auth + `GET /users/init` |
| 5 | Referral code generation | ✅ | Unique code on user create |
| 6 | Referral link / deep linking | ✅ | `t.me/YORZAEARNBOT?start=ref_CODE` |
| 7 | Referral tracking | ✅ | `referrerId` locked; self-referral blocked |
| 8 | Click / earning system | ✅ | Server taps + sync; `PointTransaction` ledger |
| 9 | Anti-cheat / rate limiting | 🟡 | Tap rate limit + energy clamp; general rate limit |
| 10 | User dashboard | ✅ | Home, Profile, stats, earning history |
| 11 | Leaderboard | ✅ | API + `LeaderboardScreen`; bottom nav tab |
| 12 | TON Connect | ✅ | UI connect/disconnect |
| 13 | Wallet storage | ✅ | `walletAddress` on User; wallet-only game-state sync |
| 14 | Wallet verification | ✅ | TON proof challenge + verify |
| 15 | TON contract | 🟡 | Draft FunC; off-chain testnet flow exists |
| 16 | Subscription / payment | 🟡 | Testnet intent + confirm; legacy YP webhook for points |
| 17 | Double-claim protection | ✅ | Idempotent `referenceId` on PointTransaction + Payment |
| 18 | Backend ↔ TON integration | 🟡 | toncenter mock/verify in tests; testnet config |
| 19 | Production deployment | 🟡 | GH Pages + Render; env vars documented |
| 20 | Admin panel | 🟡 | Campaign admin + video codes; JWT `ADMIN_TELEGRAM_IDS` |

**Rough score: 14 ✅ · 6 🟡 · 0 ❌**

---

## Referral rule (product)

| Rule | Status |
| --- | --- |
| Only **direct** referrer earns | ✅ Multi-level test in `mvp.test.js` |
| **50% of first payment** to referrer | ✅ `referralService.recordPayment` + TON split |
| Referrer locked at signup | ✅ `applyReferralOnSignup` |
| Self-referral blocked | ✅ Code + telegramId checks |

---

## Security posture

| Area | Status |
| --- | --- |
| Client cannot set points/taps/XP | ✅ `game-state` rejects economy fields |
| `PATCH /users/update` whitelist | ✅ `ALLOWED_PROFILE_FIELDS` only |
| API auth | ✅ Bearer JWT on user routes |
| Payment webhook | ✅ `PAYMENT_WEBHOOK_SECRET` header |
| Admin routes | ✅ `ADMIN_TELEGRAM_IDS` middleware |
| Video-code admin UI | ✅ Backend JWT check (no hardcoded password) |

---

## Navigation (YORZA spec)

Bottom nav: **Home · Earn · Referrals · Leaderboard · Profile**  
Wallet: link from Profile → Connect Wallet screen.

---

## Remaining before “MVP complete”

1. **Production TON contract** — 1 TON subscription → fee → 50% referrer / 50% owner (replace draft `TapEarn.fc`).
2. **Mainnet deployment** — treasury wallet, indexer/RPC reliability, monitoring.
3. **Full admin dashboard** — user search, audited balance adjustments, campaign analytics.
4. **Branding pass** — consistent YORZA naming across all screens (in progress).
5. **E2E manual QA** — Telegram WebApp on real device, Render + GH Pages together.
6. **Optional:** push notifications, timed subscription expiry UI.

---

## Test coverage

Run: `cd backend && npm test`

Covers: dev auth, referrals (self-ref, lock, 50%, no multi-level), taps, campaigns, leaderboards, admin ACL, payment webhook, engagement, rate limits, TON payment intents/confirm, point history.
