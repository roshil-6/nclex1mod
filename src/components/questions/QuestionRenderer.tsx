"use client";
import type { AnswerKey, PublicQuestion, Response } from "@/lib/validation/schema";
import { MultipleChoice, SingleChoice } from "./ChoiceQuestion";
import { MatrixMultiple, MatrixSingle } from "./MatrixQuestion";
import { DropdownQuestion } from "./DropdownQuestion";
import { HighlightQuestion } from "./HighlightQuestion";
import { BowtieQuestion } from "./BowtieQuestion";

export interface RendererProps {
  question: PublicQuestion;
  response: Response | undefined;
  onChange: (r: Response) => void;
  disabled?: boolean;
  answerKey?: AnswerKey;
}

/** Dispatches to the interactive component for the question's type. */
export function QuestionRenderer({ question, response, onChange, disabled, answerKey }: RendererProps) {
  // Each branch narrows the response and key to the matching shape (a mismatched shape is ignored).
  const r = <T extends Response["type"]>(t: T) => (response?.type === t ? (response as Extract<Response, { type: T }>) : undefined);
  const k = <T extends Response["type"]>(t: T) => (answerKey?.type === t ? (answerKey as Extract<AnswerKey, { type: T }>) : undefined);
  const common = { question, onChange, disabled };
  switch (question.questionType) {
    case "single":
      return <SingleChoice {...common} response={r("single")} answerKey={k("single")} />;
    case "multiple":
      return <MultipleChoice {...common} response={r("multiple")} answerKey={k("multiple")} />;
    case "matrix-single":
      return <MatrixSingle {...common} response={r("matrix-single")} answerKey={k("matrix-single")} />;
    case "matrix-multiple":
      return <MatrixMultiple {...common} response={r("matrix-multiple")} answerKey={k("matrix-multiple")} />;
    case "dropdown":
      return <DropdownQuestion {...common} response={r("dropdown")} answerKey={k("dropdown")} />;
    case "highlight":
      return <HighlightQuestion {...common} response={r("highlight")} answerKey={k("highlight")} />;
    case "bowtie":
      return <BowtieQuestion {...common} response={r("bowtie")} answerKey={k("bowtie")} />;
  }
}

export const QUESTION_TYPE_LABELS: Record<PublicQuestion["questionType"], string> = {
  single: "Multiple choice (single answer)",
  multiple: "Multiple response (select all that apply)",
  "matrix-single": "Matrix (one answer per row)",
  "matrix-multiple": "Matrix multiple response",
  dropdown: "Drop-down completion",
  highlight: "Highlight findings",
  bowtie: "Bowtie",
};
