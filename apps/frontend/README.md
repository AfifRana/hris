# DayOne AI Frontend

Next.js 16 (App Router) UI for the DayOne AI onboarding copilot: employee dashboard, copilot chat, and an HR knowledge-base manager.

## Setup

```bash
cp .env.example .env.local   # then edit values
npm ci
npm run dev                  # http://localhost:3000
```

| Variable | Required | Description |
|---|---|---|
| `DEMO_PASSCODE` | yes | Passcode for the access gate (`/login`) |
| `BACKEND_API_URL` | no | Backend base URL, default `http://localhost:8000` |
| `GCP_BEARER_TOKEN` | no | Static identity token for a private Cloud Run backend; auto-fetched on Cloud Run |

## How it talks to the backend

The browser calls `/api/proxy/*`; [the proxy route](src/app/api/proxy/[...path]/route.ts) forwards to `${BACKEND_API_URL}/api/v1/*`, attaching the IAM token and the `x-user-id` / `x-access-level` headers.

The demo users `user_001` and `user_002` need onboarding profiles in the backend (`POST /profile`) or tasks, progress and chat return 404.

> Demo only: the role is chosen client-side and trusted by the backend. Do not expose publicly without real authentication.

## Scripts

`npm run dev`, `npm run build`, `npm run lint`

## Docker

```bash
docker build -t dayone-frontend .
docker run -p 8080:8080 -e DEMO_PASSCODE=... -e BACKEND_API_URL=... dayone-frontend
```
