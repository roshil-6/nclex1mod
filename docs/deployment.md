# Deployment

## Status

**Not deployed.** The Vercel CLI on this machine has no stored credentials (`vercel whoami` reports "No existing credentials found"), and signing in needs your own account. No public URL exists yet.

## Deploy to Vercel (about 5 minutes)

```bash
cd "nclex questions"
vercel login
vercel link                      # create or select a project
vercel env add SESSION_SECRET production     # paste a long random string (32+ chars)
vercel env add ADMIN_PASSWORD production     # optional; omit to disable /admin entirely
vercel --prod
```

`vercel --prod` runs `npm run build`, which runs `npm run validate` first. The deploy fails if any question record is invalid.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes (production) | Signs exam-session tokens, so the server only grades and reveals keys for sessions it issued |
| `ADMIN_PASSWORD` | Optional | Enables `/admin`. When unset, admin pages and APIs are refused |
| `SCORED_ANSWER_STATUSES` | Optional | Default `verified,author-reviewed`; set to `verified` for clinician-verified keys only |

### What is and is not deployed

- `data/**/*.json` (the question bank) is bundled with the server functions and never sent to the browser as a file. The public API strips keys and rationales.
- `source/` (screenshots, video frames) is excluded through `.gitignore`, `.vercelignore` and `outputFileTracingExcludes`.

### Editing content on Vercel

Vercel's file system is read-only, so admin **Save** returns a clear error there. Edit locally (`npm run dev`), or export JSON from the deployed admin page, commit it under `data/`, and redeploy.

## Run locally

```bash
npm install
npm run dev                 # http://localhost:3000
# or a production server
npm run build && npm start
```

Set `ADMIN_PASSWORD` in `.env.local` to use the admin area locally.

## Future: student accounts and cloud sync

Sessions are stored per device in IndexedDB (`src/lib/session/store.ts`). All persistence goes through `saveSession`, `loadSession`, `updateSession` and `listSessions`, so a Supabase (or similar) back end can replace that module without touching the exam UI. The signed session token already carries everything the server needs to grade an attempt.
