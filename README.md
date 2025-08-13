# Boston.com Daily — v3.2 (Multi-Section RSS)
- Pulls multiple Boston.com section RSS feeds in one API call:
  Local, National, Politics, Crime, Traffic, Sports, Culture
- Summarizes items (60–80 words) via OpenAI if OPENAI_API_KEY is set
- Punch card & reader UI unchanged
- Query params:
  - /api/brief?perSection=3 (default 3)
  - /api/brief?limit=18 (overall cap)

## Deploy
1) Upload this repo to GitHub (root contains /public, /api, vercel.json, package.json)
2) Import in Vercel → Framework: Other
3) Env vars:
   - OPENAI_API_KEY (required for AI summaries; optional otherwise)
   - AUTH0_DOMAIN, AUTH0_CLIENT_ID (optional; for SSO)
4) Deploy
