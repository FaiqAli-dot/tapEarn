# Phase 1 — Telegram Auth + Bot

## What changed

- Backend verifies Telegram Mini App `initData` (HMAC) before creating a session.
- Game APIs require `Authorization: Bearer <JWT>` — raw `userId` / `x-user-id` is no longer trusted.
- Telegram bot responds to `/start` and `/start ref_CODE` with a Mini App button.
- Local browser testing uses `POST /api/auth/dev` only when `ALLOW_DEV_AUTH=true` and `NODE_ENV !== production`.

## Required secrets / config

You must provide these (do not commit real values):

| Variable | Where | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | `backend/.env` | Verify initData + run bot |
| `TELEGRAM_BOT_USERNAME` | `backend/.env` | Referral links |
| `FRONTEND_URL` | `backend/.env` | Mini App URL opened by the bot |
| `JWT_SECRET` | `backend/.env` | Sign session tokens |
| `MONGODB_URI` | `backend/.env` | Database |
| `VITE_TELEGRAM_BOT_USERNAME` | frontend `.env` | Invite links in UI |
| `VITE_API_BASE_URL` | frontend `.env` | e.g. `http://localhost:3001/api` |

## Local test (no Telegram)

1. `backend/.env`: set `ALLOW_DEV_AUTH=true`, `NODE_ENV=development`, MongoDB URI.
2. Start backend + frontend.
3. Open `http://localhost:5173/?userId=123456789`

## Telegram test

1. Create a bot with @BotFather and set the Mini App / Web App URL to your HTTPS frontend.
2. Put the bot token in `TELEGRAM_BOT_TOKEN`.
3. Set `FRONTEND_URL` to that same HTTPS URL.
4. Set `ALLOW_DEV_AUTH=false` (or leave unset) when testing real auth.
5. Message the bot: `/start` or `/start ref_SOMECODE`.

## API

- `POST /api/auth/telegram` `{ "initData": "<raw initData string>" }` → `{ token, user }`
- `POST /api/auth/dev` (dev only) `{ "telegramId": "..." , "start": "ref_CODE" }` → `{ token, user }`
- `GET /api/auth/me` (Bearer) → current session
- All `/api/users/*` and `/api/video-codes/*` require Bearer token
