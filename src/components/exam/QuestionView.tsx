"use client";
import type { AnswerKey, CaseStudy, PublicQuestion, Response } from "@/lib/validation/schema";
import { RecordTabs } from "@/components/clinical-records/RecordTabs";
import { QuestionRenderer } from "@/components/questions/QuestionRenderer";

export interface QuestionViewProps {
  question: PublicQuestion;
  caseStudy?: CaseStudy;
  response: Response | undefined;
  onChange: (r: Response) => void;
  disabled?: boolean;
  answerKey?: AnswerKey;
}

/** Instructions + scenario + clinical records + interactive answer area. */
export function QuestionView({ question, caseStudy, response, onChange, disabled, answerKey }: QuestionViewProps) {
  const part = question.caseStudyPart;
  const tabs = caseStudy ? [...caseStudy.records, ...question.clinicalRecords] : question.clinicalRecords;
  const isCase = !!caseStudy && part !== null;

  return (
    <article className="space-y-4">
      {isCase ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
          <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">Case study</span>
          <span className="font-semibold text-accent-strong" data-testid="case-progress">
            Case Study — Part {part} of {caseStudy!.totalParts}
          </span>
          <span className="text-ink-soft">The following scenario applies to the next {caseStudy!.totalParts} items.</span>
        </div>
      ) : null}

      {isCase ? <p className="exam-text text-[16px]">{caseStudy!.scenario}</p> : null}
      {question.scenario ? <p className="exam-text text-[16px]">{question.scenario}</p> : null}

      {tabs.length > 0 ? <RecordTabs key={question.id} tabs={tabs} part={isCase ? part : null} idPrefix={`rec-${question.id}`} /> : null}

      <div className="space-y-2">
        <h2 className="exam-text text-[17px] font-semibold leading-relaxed" id={`stem-${question.id}`}>
          {question.questionText}
        </h2>
        {question.instructions ? <p className="text-sm text-ink-soft">{question.instructions}</p> : null}
      </div>

      <div aria-labelledby={`stem-${question.id}`}>
        <QuestionRenderer question={question} response={response} onChange={onChange} disabled={disabled} answerKey={answerKey} />
      </div>
    </article>
  );
}
