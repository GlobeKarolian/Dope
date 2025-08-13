# Boston.com Daily — v3 (RSS + AI summaries + SSO, Vercel)

This repo is ready-to-deploy on **Vercel** from GitHub. It fetches Boston.com RSS, summarizes with OpenAI, and ships a fun dopamine UI with streaks, punch-card sections, autoplay, mastery, micro-rewards, an achievements modal, and a seeded friends leaderboard.

## One-time setup
1. **Create a new GitHub repo** and upload this entire folder.
2. **Connect the repo to Vercel** → “Import Project” → Framework = “Other”.

### Environment variables (Vercel → Settings → Environment Variables)
- `OPENAI_API_KEY` (required) — your OpenAI API key.
- `FEED_URL` (optional) — defaults to `https://www.boston.com/feed/`. You can also point at any RSS.
- `AUTH0_DOMAIN` (optional) — e.g. `dev-xxxxx.us.auth0.com`
- `AUTH0_CLIENT_ID` (optional)
- `AUTH0_AUDIENCE` (optional) — if set, API will verify Access Tokens for protected calls.

### Auth (SSO)
- Uses **Auth0** SPA (PKCE). Configure an Application (Single Page App).
- Allowed Callback URLS: `https://<your-vercel-deploy>/` (root)
- Allowed Logout URLs: same
- If you pass `AUTH0_AUDIENCE`, the API will verify JWT using JWKS. If omitted, API runs unauthenticated for demo.

## Endpoints
- `GET /api/brief?limit=10` — fetch RSS (FEED_URL), summarize with OpenAI to ~75 words per item, return JSON payload.
  - Caches for 5 minutes with Cache-Control.

## Local dev (optional)
- Install `vercel` CLI, run `vercel dev` (needs Node 18+).

## Front-end
- Static app in `/public` calls `/api/brief` and renders stories with autoplay, progress ring, streaks, mastery, punch-card, and seeded friends leaderboard (Boston Globe Media leadership).

