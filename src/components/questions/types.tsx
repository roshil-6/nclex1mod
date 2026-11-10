import type { AnswerKey, PublicQuestion, Response } from "@/lib/validation/schema";

export type ResponseOf<T extends Response["type"]> = Extract<Response, { type: T }>;
export type KeyOf<T extends Response["type"]> = Extract<AnswerKey, { type: T }>;

export interface QuestionProps<T extends Response["type"]> {
  question: PublicQuestion;
  response: ResponseOf<T> | undefined;
  onChange: (r: ResponseOf<T>) => void;
  disabled?: boolean;
  /** When provided (review / feedback), choices are marked correct / incorrect. */
  answerKey?: KeyOf<T>;
}

export type Mark = "correct" | "incorrect" | "missed" | null;

export function markClass(m: Mark): string {
  switch (m) {
    case "correct":
      return "border-good bg-good-soft";
    case "incorrect":
      return "border-bad bg-bad-soft";
    case "missed":
      return "border-good border-dashed";
    default:
      return "";
  }
}

export function MarkLabel({ mark }: { mark: Mark }) {
  if (!mark) return null;
  const text = mark === "correct" ? "Correct" : mark === "incorrect" ? "Incorrect" : "Correct answer (not selected)";
  const cls = mark === "incorrect" ? "text-bad" : "text-good";
  return <span className={`ml-auto shrink-0 pl-2 text-xs font-semibold ${cls}`}>{text}</span>;
}
