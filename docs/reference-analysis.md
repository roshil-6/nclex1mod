# Reference interface analysis

Sources: the reference video (17:26, sampled every 30 s) and the 230 screenshots. These were used for interaction and layout ideas only; no branding, logos, artwork or question content was reproduced.

## Interaction patterns observed → implementation

| Observed in reference | Implemented as |
|---|---|
| Top bar with "N / 50" counter, progress bar and countdown | Exam top bar: name, "Question N of M", HH:MM countdown, answered-progress bar, Mark for review, Finish examination |
| Flag control | `Mark for review` toggle, persisted; shown in the navigator |
| Bottom bar with Previous / Submit | Sticky bottom bar: Previous, Questions (mobile navigator), Submit answer (practice feedback only), Next / Finish |
| Case study banner: "The following scenario applies to the next 6 items", "Item X of 6" | Banner "Case Study — Part X of 6" plus the shared scenario |
| Clinical record tabs (Nurses' Notes, History and Physical, Vital Signs, Laboratory Results, MAR; Client 1–4) | `RecordTabs`. Tabs have no effect on answers; only tabs with content are shown; horizontally scrollable on phones |
| New nurses' notes and labs appear as the case progresses | `fromPart` on tabs, blocks, rows and entries; newly released items get a "New" tag |
| Multiple choice / select all that apply | Radio list / checkbox list (`requiredCount` supported) |
| Matrix with radios per row (expected/unexpected, indicated/contraindicated, improved/declined) | `matrix-single` |
| Matrix with checkboxes (multi-column) | `matrix-multiple` |
| Dropdowns inside sentences | `dropdown` with `layout: "sentence"` and a `{{field}}` template |
| Dropdown per row in a "Clinical decision / Nurse's selection" table | `dropdown` with `layout: "table"` |
| "Click to highlight N findings" in text or body-system tables | `highlight` with `layout: "text" \| "table"` |
| Drag-and-drop bowtie (actions — condition — parameters) | `bowtie`, using tap-to-place instead of dragging so it works with touch, keyboard and screen readers |
| Review screens: "Your answer" vs "Correct answer", score per item, rationale | Review page: "Your response (marked)" / "Correct answer" toggle, item score, rationale, reference basis |

## Formats seen but not implemented as separate types

- **Ordering / ranking** ("first, second, third action"). Not built as its own component. These items can be expressed as a `dropdown` table, with each position a row whose options are the actions.
- **Grouped checklists** (checkboxes grouped under headings). These are expressible as `matrix-multiple` or as several `multiple` items.

## Visual direction

White examination surfaces on a light-grey page, a muted blue accent (`#2f5f8f`), thin borders, small corner radii, serif text for clinical content and questions, and sans-serif for controls. There are no gradients, glows, decorative animation or marketing elements.
