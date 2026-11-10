import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Clinical records                                                    */
/* ------------------------------------------------------------------ */

/** Part from which a block becomes visible in a case study (1-based). Omitted = always visible. */
const fromPart = z.number().int().min(1).optional();

export const TextBlockSchema = z.object({
  kind: z.literal("text"),
  heading: z.string().optional(),
  paragraphs: z.array(z.string().min(1)).min(1),
  fromPart,
});

export const EntriesBlockSchema = z.object({
  kind: z.literal("entries"),
  heading: z.string().optional(),
  entries: z.array(z.object({ time: z.string().min(1), text: z.string().min(1), fromPart })).min(1),
  fromPart,
});

export const TableBlockSchema = z
  .object({
    kind: z.literal("table"),
    heading: z.string().optional(),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.object({ cells: z.array(z.string()), fromPart })).min(1),
    fromPart,
  })
  .superRefine((t, ctx) => {
    t.rows.forEach((r, i) => {
      if (r.cells.length !== t.columns.length)
        ctx.addIssue({ code: "custom", message: `table row ${i} has ${r.cells.length} cells, expected ${t.columns.length}` });
    });
  });

export const RecordBlockSchema = z.union([TextBlockSchema, EntriesBlockSchema, TableBlockSchema]);

export const RecordTabSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  blocks: z.array(RecordBlockSchema).min(1),
  fromPart,
});

/* ------------------------------------------------------------------ */
/* Question content                                                    */
/* ------------------------------------------------------------------ */

export const QuestionTypeSchema = z.enum([
  "single",
  "multiple",
  "matrix-single",
  "matrix-multiple",
  "dropdown",
  "highlight",
  "bowtie",
]);

export const ScoringPolicySchema = z.enum(["dichotomous", "plus-minus", "zero-one"]);
export const OriginSchema = z.enum(["extracted", "original", "pending"]);
export const ContentStatusSchema = z.enum(["verified", "partial", "unverified"]);
export const AnswerStatusSchema = z.enum(["verified", "author-reviewed", "unverified", "disputed"]);

const Option = z.object({ id: z.string().min(1), text: z.string().min(1) });

export const DropdownFieldSchema = z.object({
  id: z.string().min(1),
  /** Row label when layout is "table" */
  label: z.string().optional(),
  options: z.array(Option).min(2),
});

export const BowtieSchema = z.object({
  left: z.object({ label: z.string(), slots: z.number().int().min(1), options: z.array(Option).min(2) }),
  center: z.object({ label: z.string(), slots: z.number().int().min(1), options: z.array(Option).min(2) }),
  right: z.object({ label: z.string(), slots: z.number().int().min(1), options: z.array(Option).min(2) }),
});

export const HighlightItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Row group label when layout is "table" (e.g. body system). */
  group: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Responses and answer keys (same shapes)                             */
/* ------------------------------------------------------------------ */

export const ResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single"), optionId: z.string().nullable() }),
  z.object({ type: z.literal("multiple"), optionIds: z.array(z.string()) }),
  z.object({ type: z.literal("matrix-single"), selections: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("matrix-multiple"), selections: z.record(z.string(), z.array(z.string())) }),
  z.object({ type: z.literal("dropdown"), values: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("highlight"), itemIds: z.array(z.string()) }),
  z.object({
    type: z.literal("bowtie"),
    left: z.array(z.string()),
    center: z.array(z.string()),
    right: z.array(z.string()),
  }),
]);

export const AnswerKeySchema = ResponseSchema;

/* ------------------------------------------------------------------ */
/* Question                                                            */
/* ------------------------------------------------------------------ */

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    origin: OriginSchema,
    enabled: z.boolean().default(true),
    originalQuestionNumber: z.number().int().nullable().default(null),
    questionType: QuestionTypeSchema,
    clinicalCategory: z.string().min(1),
    caseStudyId: z.string().nullable().default(null),
    caseStudyPart: z.number().int().min(1).nullable().default(null),
    /** Short scenario shown above the stem (standalone items). */
    scenario: z.string().optional(),
    questionText: z.string().min(1),
    instructions: z.string().optional(),
    options: z.array(Option).default([]),
    /** Exact number of selections required, only when the item explicitly says so. */
    requiredCount: z.number().int().min(1).optional(),
    clinicalRecords: z.array(RecordTabSchema).default([]),
    /** Heading above the row labels in a matrix (e.g. "Assessment finding"). */
    matrixRowHeading: z.string().optional(),
    matrixRows: z.array(Option).default([]),
    matrixColumns: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).default([]),
    dropdownLayout: z.enum(["sentence", "table"]).optional(),
    /** Sentence template with {{fieldId}} placeholders (layout "sentence"). */
    dropdownTemplate: z.string().optional(),
    dropdownTableHeadings: z.tuple([z.string(), z.string()]).optional(),
    dropdownFields: z.array(DropdownFieldSchema).default([]),
    highlightLayout: z.enum(["text", "table"]).optional(),
    highlightTableHeadings: z.tuple([z.string(), z.string()]).optional(),
    highlightItems: z.array(HighlightItemSchema).default([]),
    bowtie: BowtieSchema.optional(),
    answerKey: AnswerKeySchema,
    scoringPolicy: ScoringPolicySchema,
    rationale: z.string().default(""),
    references: z.array(z.string()).default([]),
    sourceImages: z.array(z.string()).default([]),
    contentVerificationStatus: ContentStatusSchema,
    answerVerificationStatus: AnswerStatusSchema,
    reviewNotes: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message: `${q.id}: ${message}` });
    if (q.answerKey.type !== q.questionType) issue(`answerKey.type "${q.answerKey.type}" does not match questionType`);
    if ((q.caseStudyId === null) !== (q.caseStudyPart === null)) issue("caseStudyId and caseStudyPart must be set together");

    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const dupes = (xs: { id: string }[], what: string) => {
      if (ids(xs).size !== xs.length) issue(`duplicate ${what} ids`);
    };
    const k = q.answerKey;

    switch (q.questionType) {
      case "single":
      case "multiple": {
        if (q.options.length < 2) issue("needs at least 2 options");
        dupes(q.options, "option");
        const valid = ids(q.options);
        if (k.type === "single") {
          if (!k.optionId || !valid.has(k.optionId)) issue("single answerKey must reference an option");
          if (q.scoringPolicy !== "dichotomous") issue("single-answer items use dichotomous scoring");
        }
        if (k.type === "multiple") {
          if (k.optionIds.length < 1) issue("multiple answerKey needs at least one option");
          k.optionIds.forEach((o) => !valid.has(o) && issue(`answerKey option ${o} not found`));
          if (q.requiredCount && q.requiredCount !== k.optionIds.length) issue("requiredCount differs from keyed answers");
          if (q.scoringPolicy === "zero-one") issue("multiple-response items use plus-minus or dichotomous");
        }
        break;
      }
      case "matrix-single":
      case "matrix-multiple": {
        if (q.matrixRows.length < 1 || q.matrixColumns.length < 2) issue("matrix needs rows and at least 2 columns");
        dupes(q.matrixRows, "row");
        dupes(q.matrixColumns, "column");
        const rows = ids(q.matrixRows);
        const cols = ids(q.matrixColumns);
        if (k.type === "matrix-single") {
          q.matrixRows.forEach((r) => !k.selections[r.id] && issue(`row ${r.id} has no key`));
          Object.entries(k.selections).forEach(([r, c]) => {
            if (!rows.has(r)) issue(`key row ${r} not found`);
            if (!cols.has(c)) issue(`key column ${c} not found`);
          });
          if (q.scoringPolicy === "plus-minus") issue("matrix-single items use zero-one or dichotomous");
        }
        if (k.type === "matrix-multiple") {
          Object.entries(k.selections).forEach(([r, cs]) => {
            if (!rows.has(r)) issue(`key row ${r} not found`);
            cs.forEach((c) => !cols.has(c) && issue(`key column ${c} not found`));
          });
          if (Object.values(k.selections).flat().length === 0) issue("matrix-multiple key is empty");
        }
        break;
      }
      case "dropdown": {
        if (!q.dropdownLayout) issue("dropdownLayout required");
        if (q.dropdownFields.length < 1) issue("needs dropdownFields");
        dupes(q.dropdownFields, "dropdown field");
        if (q.dropdownLayout === "sentence") {
          const tpl = q.dropdownTemplate ?? "";
          q.dropdownFields.forEach((f) => !tpl.includes(`{{${f.id}}}`) && issue(`template lacks {{${f.id}}}`));
        }
        if (q.dropdownLayout === "table") q.dropdownFields.forEach((f) => !f.label && issue(`table field ${f.id} needs a label`));
        if (k.type === "dropdown") {
          q.dropdownFields.forEach((f) => {
            const v = k.values[f.id];
            if (!v) issue(`field ${f.id} has no key`);
            else if (!f.options.some((o) => o.id === v)) issue(`field ${f.id} key ${v} not an option`);
          });
          if (q.scoringPolicy === "plus-minus") issue("dropdown items use zero-one or dichotomous");
        }
        break;
      }
      case "highlight": {
        if (!q.highlightLayout) issue("highlightLayout required");
        if (q.highlightItems.length < 2) issue("needs highlightItems");
        dupes(q.highlightItems, "highlight item");
        const valid = ids(q.highlightItems);
        if (k.type === "highlight") {
          if (k.itemIds.length < 1) issue("highlight key empty");
          k.itemIds.forEach((i) => !valid.has(i) && issue(`key item ${i} not found`));
          if (q.requiredCount && q.requiredCount !== k.itemIds.length) issue("requiredCount differs from keyed items");
          if (q.scoringPolicy === "zero-one") issue("highlight items use plus-minus or dichotomous");
        }
        break;
      }
      case "bowtie": {
        if (!q.bowtie) {
          issue("bowtie definition required");
          break;
        }
        const b = q.bowtie;
        if (k.type === "bowtie") {
          (["left", "center", "right"] as const).forEach((side) => {
            const valid = ids(b[side].options);
            if (k[side].length !== b[side].slots) issue(`bowtie ${side} key must have ${b[side].slots} entries`);
            k[side].forEach((o) => !valid.has(o) && issue(`bowtie ${side} key ${o} not an option`));
          });
          if (q.scoringPolicy === "plus-minus") issue("bowtie items use zero-one or dichotomous");
        }
        break;
      }
    }
  });

export const CaseStudySchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1),
  clinicalCategory: z.string().min(1),
  /** Shared scenario sentence shown on every part. */
  scenario: z.string().min(1),
  totalParts: z.number().int().min(1),
  records: z.array(RecordTabSchema).min(1),
  origin: OriginSchema,
});

export type RecordBlock = z.infer<typeof RecordBlockSchema>;
export type RecordTab = z.infer<typeof RecordTabSchema>;
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export type ScoringPolicy = z.infer<typeof ScoringPolicySchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionInput = z.input<typeof QuestionSchema>;
export type CaseStudy = z.infer<typeof CaseStudySchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type AnswerKey = z.infer<typeof AnswerKeySchema>;
export type AnswerStatus = z.infer<typeof AnswerStatusSchema>;

/** Question as delivered to an examinee: no key, no rationale, no review notes. */
export type PublicQuestion = Omit<Question, "answerKey" | "rationale" | "reviewNotes" | "references">;
