# TapEarn test report

**Commit tested:** `48d5ee2dc9b9a7bb20fb7e3cd843ef776b8d078b` (`main`, 2026-03-09)  
**Tester:** Cursor Cloud Agent  
**Date:** 2026-08-26

## What this app is

**Telegram Mini App (frontend) + Express/MongoDB API (backend) + FunC TON contract stub.**

| Layer | Stack | Role |
| --- | --- | --- |
| Frontend (`/`) | React 18 + TypeScript + Vite + Tailwind + Framer Motion + TON Connect | Tap-to-earn Mini App UI (home tap, daily tasks/videos, upgrades, referrals, wallet, video-code admin) |
| Backend (`/backend`) | Express (ESM `.js`) + Mongoose | REST API for users/game state/taps/upgrades and video-code CRUD/verify; `/health` |
| Contracts (`/contracts`) | FunC (`TapEarn.fc`) | On-chain sketch; not wired into the current Node entrypoint |

Hypothesis confirmed: Mini App + backend. Current `backend/src/index.js` does **not** start a Telegram bot poller despite `node-telegram-bot-api` / `TELEGRAM_BOT_TOKEN` docs; identity comes from Telegram WebApp `initData` (or `?userId=` / mock user `123456789` outside Telegram).

## How to run

### Frontend
```bash
npm ci
cp env.example .env   # optional; defaults exist for local API
npm run dev           # Vite on :3000
npm run build && npm run preview
```

### Backend
```bash
cd backend
npm ci
cp env.example .env
# Set MONGODB_URI (required). TELEGRAM_BOT_TOKEN not used by current index.js.
npm start             # or npm run dev (nodemon)
```

### Both
```bash
npm run start   # concurrently backend + frontend (needs MongoDB)
```

## Env vars

### Frontend (`env.example` → `.env`)
- `VITE_TELEGRAM_BOT_USERNAME`
- `VITE_TON_CONNECT_MANIFEST_URL`
- `VITE_API_BASE_URL` (default used in code: `http://localhost:3001/api`)
- `VITE_APP_NAME`, `VITE_APP_VERSION`
- `VITE_ENABLE_ANALYTICS`, `VITE_ENABLE_DEBUG_MODE`

### Backend (`backend/env.example` → `.env`)
- **Required to stay up:** `MONGODB_URI` (defaults to `mongodb://localhost:27017/tapearn`; process exits if connect fails)
- Documented but **not required by current `index.js`:** `TELEGRAM_BOT_TOKEN`, `TON_RPC_URL`, `TON_CONTRACT_ADDRESS`, `TON_WALLET_MNEMONIC`, Redis, JWT
- Optional: `PORT` (3001), `NODE_ENV`, `FRONTEND_URL`, rate-limit / logging flags

No real secrets were present in the repo (placeholders only). None were fabricated.

## Commands run and results

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` (root) | **PASS** | 245 packages |
| `npm ci` (backend) | **PASS** | 415 packages; deprecation warnings (multer/request/etc.) |
| `npm test` (root & backend) | **N/A** | No `test` script (README claims tests exist; they do not) |
| `npm run lint` | **N/A** | No lint script |
| `npx tsc --noEmit` (frontend) | **FAIL** | 25 TypeScript errors (see below) |
| `npm run build` (frontend) | **PASS** | Vite production build ~7s → `dist/` |
| `npm run preview` | **PASS** | HTTP 200 on built `index.html` |
| `cd backend && npm run build` (`tsc`) | **FAIL** | No backend `tsconfig`; tsc walks up and typechecks frontend with same 25 errors |
| `node backend/src/index.js` (no Mongo) | **FAIL (expected)** | Listens briefly, then `process.exit(1)` on `ECONNREFUSED :27017` |
| Ad-hoc API smoke with in-memory Mongo | **PASS** | `/health`, `/api/users/init`, `/game-state`, `/tap`, `/api/video-codes`, `/verify` all 200 |
| Ad-hoc pure helper smoke (`src/config/videos.ts` via `tsx`) | **PASS** | `extractYouTubeId` / `isYouTubeUrl` / codes OK |
| Contract compile/test | **Not run** | No `func` toolchain / scripts in repo |

### Typecheck failures (actionable)

Strict `tsc` fails with unused locals/params (`TS6133`) across App/screens/components, plus:

- Missing `vite/client` types: `ImportMeta.env` errors in `ProtectedAdminRoute.tsx` (no `src/vite-env.d.ts`)
- `src/config/videos.ts`: indexing `VIDEO_CONFIG[type][category]` without a string index signature (`TS7053`)

Vite build still succeeds (transpile-only).

### Backend notes from smoke

- Warning: package.json lacks `"type": "module"` (Node reparses as ESM).
- Deprecated mongoose connect options `useNewUrlParser` / `useUnifiedTopology`.
- `GET /api/video-codes` returned `[]` until seeded; `POST /api/video-codes/verify` still succeeds using **hardcoded defaults** in `VideoCode.getByTaskId` (including returning `correctCode` to the client).

## CI (GitHub Actions)

- **No project workflow** under `.github/workflows/`.
- Only GitHub’s built-in **pages-build-deployment** (gh-pages). No check-runs/statuses on `main` @ `48d5ee2`.
- There is nothing for this commit to “pass” as app CI; Pages workflow is unrelated to PR test gates.

## Untested / blocked

- Live Telegram Mini App UX (BotFather, WebApp initData, haptic, theme, share)
- Real Telegram bot token flows (docs mention them; current server entrypoint does not use the bot)
- Persistent MongoDB / Redis in this environment (no local mongod/docker; memory Mongo used only for ad-hoc API smoke)
- TON wallet connect, on-chain claims, FunC contract compile/deploy
- End-to-end video watch + code entry UI
- Referral milestones / offline earnings over time
- Admin panel auth beyond frontend route guard
- npm audit findings (frontend 19 / backend 25 reported; not remediated)

## Fixes applied during testing

None. Failures were missing scripts, strict TS issues, or missing MongoDB—not trivial install/config breakage for the suite itself (there is no suite). No secrets committed; no drive-by refactors.

## Suggested next steps for the author

1. Add MongoDB to local/dev (or document Docker Compose).
2. Align README: remove nonexistent `npm test` / bot-required claims, or restore bot code / real tests.
3. Add `"type": "module"` to `backend/package.json` and a real backend `tsconfig` (or drop `npm run build`).
4. Add `src/vite-env.d.ts` and clean unused imports so `tsc --noEmit` matches Vite.
5. Decide whether video verify should return `correctCode` to clients.
