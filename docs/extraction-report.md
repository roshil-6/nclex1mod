# Extraction report

## Source material

| Item | Location (local only) | Notes |
|---|---|---|
| 4 ZIP archives (`WhatsApp Unknown 2026-11-10 at 4.04.21 / 4.04.51 / 4.04.57 / 4.05.00 PM.zip`) | `Downloads/` | Extracted unchanged to `source/raw/zip1…zip4` |
| 230 JPEG screenshots | `source/screens/S001.jpg … S230.jpg` | Stable IDs in chronological order; originals preserved in `source/raw` |
| Reference video `WhatsApp Video 2026-10-27 at 5.52.20 PM.mp4` (17 min 26 s) | `Downloads/` | Located by duration; frames sampled every 30 s into `source/video-frames/` |

`source/` is git-ignored and excluded from builds and deployment (`.gitignore`, `.vercelignore`, `outputFileTracingExcludes`).

## Process (reproducible)

```bash
python -E -P scripts/extract-images/inventory.py source/raw source/screens        # IDs, sizes, SHA-1, pHash/dHash, duplicates
python -E -P scripts/extract-images/contact_sheets.py source/screens source/contact # visual survey sheets
python -E -P scripts/organise-screenshots/group.py source/screens/inventory.json    # question-number grouping
python -E -P scripts/organise-screenshots/report.py                                 # tables below
```

The on-screen "N / 50" counter was cropped from every screenshot into one sheet (`source/contact/counters.png`) and read visually. Perceptual hashing alone could not group screenshots, because every page shares the same exam template (pHash distance ≤ 6 across unrelated questions). Grouping therefore uses the counter, with hashing used only for duplicate detection.

## Findings

- **The 230 screenshots are one 50-question practice test** ("INITIAL ASSESSMENT_50Q"), captured twice:
  - **S001–S117, exam in progress.** These show 48 of the 50 questions; Q23 and Q39 were never captured. Many questions appear in several screenshots, one per expanded dropdown (for example Q18 spans S053–S062).
  - **S118–S230, the vendor's answer-review screens.** These cover all 50 questions and show "Your answer / Correct answer" panels, the vendor's scoring rule (for example "+/- scoring", "0/1 scoring"), a percentage of other users who answered correctly, illustrations and rationales.
- **Duplicates:** S218–S222 are byte-identical to S213–S217. Eight review screenshots are scrolled views with no visible counter. Their grouping (S212–S222) is marked low-confidence in `inventory.json`.
- **Question formats observed:** single-answer multiple choice; select-all-that-apply; highlight-in-text and highlight-in-table; dropdown-in-sentence; dropdown-per-row tables; matrix with radio or checkbox cells; grouped checklists; drag-and-drop bowtie; ordering ("first / second / third action"); multi-client case studies with tabs (Client 1–4, Laboratory Results); and 6-item case studies ("The following scenario applies to the next 6 items", "Item X of 6") with Nurses' Notes, History and Physical, Vital Signs, Laboratory Results and Medication Administration Record tabs.
- **Selections in the screenshots** are the original participant's answers. On the review pages, the participant's answers are often marked incorrect, which confirms they cannot be treated as keys.

Full per-image grouping is in [extraction-report-tables.md](extraction-report-tables.md), and per-image metadata (zip, original filename, size, hashes, phase, question number, duplicate status) is in `source/screens/inventory.json`.

## Why the questions were not transcribed into the app

The screenshots are pages of a **commercial, subscription question bank** (the browser address bar shows `applern.com/qbdashboard`). Every page carries a **per-subscriber watermark with a named person's email address and IP address**. Transcribing the 50 questions, their answer keys and rationales into a public website would:

1. reproduce copyrighted, licensed content without the rights holder's permission, and
2. redistribute material tied to an identifiable individual's subscription, together with their personal data.

So no question text, answer, rationale or illustration from the screenshots was copied into the question bank. Instead:

- The screenshots and video were used only to identify the **formats and interactions** the platform must support. All of them are implemented.
- The bank ships with **44 original questions** written for this project on comparable clinical topics, including three 6-part case studies. Every record is labelled `"origin": "original"`.
- The extraction pipeline, `data/questions/extracted/` folder, `sourceImages` field, admin screenshot viewer and import tool are all in place. If you hold rights to content, for example your own material or a licence that permits it, it can be transcribed and imported with `"origin": "extracted"` and honest verification statuses.

## Transcription audit

| Category | Count |
|---|---|
| Screenshots inspected and inventoried | 230 |
| Unique source questions identified | 50 |
| Source questions with exam-view screenshots | 48 |
| Source questions transcribed into the bank | 0 (see above) |
| Original questions authored | 44 (26 standalone + 3 × 6 case-study items) |
