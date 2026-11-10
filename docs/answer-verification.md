# Answer verification

## Status model

| Field | Values | Meaning |
|---|---|---|
| `contentVerificationStatus` | `verified` / `partial` / `unverified` | Is the question text, record data and option list complete and correct? |
| `answerVerificationStatus` | `verified` | Key confirmed by a qualified clinical reviewer |
| | `author-reviewed` | Key written and checked by the content author against standard references; **not** yet signed off by a licensed nurse educator |
| | `unverified` / `disputed` | Never scored |

A question enters scored sessions only when it is enabled, is not in `pending/`, has `contentVerificationStatus: verified`, passes schema validation, and has an answer status listed in the `SCORED_ANSWER_STATUSES` environment variable (default `verified,author-reviewed`). A case study is used only when **all** of its parts are eligible.

To admit only clinician-verified keys, set `SCORED_ANSWER_STATUSES=verified`. The Quick, Case Study and Custom modes will then report 0 available questions until a reviewer upgrades items in the admin area.

## Current bank (version shown by `npm run validate`)

All 44 questions are original, `contentVerificationStatus: verified`, `answerVerificationStatus: author-reviewed`.

- **Author:** the AI assistant that built this application. Each key and rationale was written from standard nursing and clinical knowledge. The `references` field names the guideline or topic the answer is based on (for example *ISPAD 2022 DKA guideline*, *CDC 2007 Isolation Precautions*, *ACOG Practice Bulletin 222*). These are pointers to the evidence base, not page-level citations.
- **Results and review pages tell students** that author-reviewed items have not been signed off by a licensed nurse educator.

### Items flagged for reviewer attention

| ID | Note |
|---|---|
| `sa-magnesium` | Oliguria is deliberately not keyed as a *sign* of magnesium toxicity (it is a risk factor). Confirm this matches the house style. |
| `sb-hip-precautions` | Keyed for a posterior surgical approach; hip precautions vary by surgeon. |
| `sb-copd-o2` | 88–92% target per the BTS guideline; some institutions use different targets. |

### Recommended review workflow

1. Sign in at `/admin` (requires `ADMIN_PASSWORD`).
2. Filter **Needs verification** or open any question; the live preview shows the key.
3. Edit the key or rationale if needed, set **Answer verification** to `verified`, and save.
4. On a read-only host such as Vercel, use **Export JSON**, commit the file under `data/`, and redeploy. Locally, saving writes straight to `data/questions/...`.
