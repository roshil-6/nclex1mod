# Clinical Mock Exam

A nursing mock-examination platform built with Next.js (App Router), TypeScript, Tailwind CSS and Zod. It supports timed exams, practice modes, multi-part clinical case studies with record tabs, seven interactive question formats, deterministic structured scoring, refresh-proof sessions, answer review and a protected admin area.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit + component tests (Vitest)
npm run build        # validates the question bank, then builds
npm run test:e2e     # Playwright browser tests (builds must exist: run npm run build first)
```

See `docs/` for the [extraction report](docs/extraction-report.md), [reference analysis](docs/reference-analysis.md), [answer verification](docs/answer-verification.md) and [deployment](docs/deployment.md).

## Structure

```
data/cases/                   case-study shared records (tabs released by part via fromPart)
data/questions/original/      150 original questions (scored)
data/questions/extracted/     transcribed licensed content (empty, see extraction report)
data/questions/pending/       records awaiting verification (never scored)
src/lib/validation/schema.ts  Zod schemas + TypeScript types for questions, cases, responses, keys
src/lib/scoring/              scoring engine (score.ts) and server-side grading (grade.ts)
src/lib/question-bank/        server-only loader, eligibility, admin writes
src/lib/session/              exam planning (server), IndexedDB store + one-shot submission (client)
src/lib/timer/                deadline-based countdown helpers
src/components/questions/     one interactive component per question type
src/components/clinical-records/  record tabs
src/app/                      pages + API routes (/api/sessions, /api/score, /api/check, /api/admin/*)
scripts/                      image inventory, grouping, contact sheets, bank validation
tests/unit, tests/e2e         Vitest + Testing Library, Playwright
```

## Development report (2026-11-10)

| # | Item | Result |
|---|---|---|
| 1 | Screenshots inspected | **230** (4 archives) + 17:26 reference video sampled at 30 s |
| 2 | Unique source questions identified | **50** (one 50-question test; 48 have exam-view captures, all 50 have review captures; 5 exact duplicate images) |
| — | Source questions transcribed | **0.** The screenshots are a commercial, subscription question bank with a named subscriber's email and IP watermark, so the content was not reproduced (see the extraction report) |
| 3 | Complete questions in the bank | **150** original questions (96 standalone + 9 six-part case studies) |
| 4 | Validated, scored-eligible questions | **150** (all `author-reviewed`; set `SCORED_ANSWER_STATUSES=verified` to require clinician sign-off) |
| 5 | Questions requiring verification | **150** awaiting licensed nurse-educator sign-off; 5 flagged for specific review points |
| 6 | Question types implemented | single answer, multiple response, matrix single (expected/unexpected, indicated/contraindicated, improved/declined), matrix multiple, dropdown (sentence and table), highlight (text and table), bowtie; any type inside case studies |
| 7 | Tests | Vitest **59/59** passing (scoring policies, schema, bank integrity, planning, tokens, persistence, single-shot submission, admin middleware, every component against real records). Playwright **7/7** passing (full case-study journey with reload, flags, navigator, submit, results, review and retake; timer persistence and auto-submit on expiry; practice feedback; all 44 questions interactive; admin protection; mobile Pixel 7 layout, overflow and rotation) |
| 8 | Build | `npm run build` succeeds (bank validation + Next.js production build); client bundles contain no answer keys |
| 9 | Deployment | **Not deployed.** The Vercel CLI is not signed in on this machine; steps are in `docs/deployment.md` |
| 10 | Public URL | None yet |

**Full 150-question mode** is available: 150 unique questions, a 5-hour timer and exam mode with no reveals. It locks again automatically if any question is disabled or loses verification, because questions are never duplicated to reach 150.
