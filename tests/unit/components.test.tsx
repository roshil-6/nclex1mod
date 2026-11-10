import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionView } from "@/components/exam/QuestionView";
import { QuestionNavigator } from "@/components/navigation/QuestionNavigator";
import { CaseStudySchema, QuestionSchema, type CaseStudy, type PublicQuestion, type Response } from "@/lib/validation/schema";
const questionFiles = import.meta.glob("../../data/questions/original/*.json", { eager: true, import: "default" }) as Record<string, unknown[]>;
const caseFiles = import.meta.glob("../../data/cases/*.json", { eager: true, import: "default" }) as Record<string, unknown[]>;
const all: PublicQuestion[] = Object.values(questionFiles).flat().map((q) => QuestionSchema.parse(q));
const cases: CaseStudy[] = Object.values(caseFiles).flat().map((c) => CaseStudySchema.parse(c));
const byId = (id: string) => all.find((q) => q.id === id)!;
const caseOf = (id: string) => cases.find((c) => c.id === id)!;

/** Stateful harness that mirrors how the exam runner stores the response. */
function Harness({ q, caseStudy, onResponse }: { q: PublicQuestion; caseStudy?: CaseStudy; onResponse?: (r: Response) => void }) {
  const [r, setR] = useState<Response | undefined>();
  return (
    <>
      <QuestionView
        question={q}
        caseStudy={caseStudy}
        response={r}
        onChange={(x) => {
          setR(x);
          onResponse?.(x);
        }}
      />
      <pre data-testid="state">{JSON.stringify(r ?? null)}</pre>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent || "null");

describe("question components (real bank records)", () => {
  it("loads all 150 questions", () => expect(all).toHaveLength(150));

  it("every question renders without crashing", () => {
    for (const q of all) {
      const c = q.caseStudyId ? cases.find((x) => x.id === q.caseStudyId) : undefined;
      const { unmount } = render(<Harness q={q} caseStudy={c} />);
      expect(screen.getByText(q.questionText)).toBeInTheDocument();
      unmount();
    }
  });

  it("radio: selecting a new option deselects the previous one", async () => {
    render(<Harness q={byId("sa-warfarin")} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.click(radios[0]);
    await userEvent.click(radios[1]);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(state()).toEqual({ type: "single", optionId: "b" });
  });

  it("checkboxes toggle independently", async () => {
    render(<Harness q={byId("sa-neutropenia")} />);
    const boxes = screen.getAllByRole("checkbox");
    await userEvent.click(boxes[0]);
    await userEvent.click(boxes[3]);
    await userEvent.click(boxes[1]);
    await userEvent.click(boxes[0]);
    expect(state()).toEqual({ type: "multiple", optionIds: ["b", "d"] });
  });

  it("matrix single: one answer per row, rows independent", async () => {
    render(<Harness q={byId("sb-precautions")} />);
    await userEvent.click(screen.getByLabelText("Suspected pulmonary tuberculosis: Contact"));
    await userEvent.click(screen.getByLabelText("Suspected pulmonary tuberculosis: Airborne"));
    await userEvent.click(screen.getByLabelText("Influenza: Droplet"));
    expect(screen.getByLabelText("Suspected pulmonary tuberculosis: Contact")).not.toBeChecked();
    expect(state()).toEqual({ type: "matrix-single", selections: { tb: "airborne", flu: "droplet" } });
  });

  it("matrix multiple: several cells per row", async () => {
    render(<Harness q={byId("sb-drug-labs")} />);
    await userEvent.click(screen.getByLabelText("Unfractionated heparin infusion: aPTT"));
    await userEvent.click(screen.getByLabelText("Unfractionated heparin infusion: Platelet count"));
    await userEvent.click(screen.getByLabelText("Warfarin: INR"));
    expect(state()).toEqual({ type: "matrix-multiple", selections: { heparin: ["aptt", "plt"], warfarin: ["inr"] } });
  });

  it("dropdown (sentence): each blank saves independently", async () => {
    render(<Harness q={byId("vte-2")} caseStudy={caseOf("case-vte")} />);
    await userEvent.selectOptions(screen.getByLabelText("Blank 1"), "pe");
    await userEvent.selectOptions(screen.getByLabelText("Blank 3"), "refused");
    expect(state()).toEqual({ type: "dropdown", values: { c1: "pe", e2: "refused" } });
  });

  it("dropdown (table) renders labelled selects", async () => {
    render(<Harness q={byId("sb-transfusion")} />);
    await userEvent.selectOptions(screen.getByLabelText("First action"), "stop");
    expect(state()).toEqual({ type: "dropdown", values: { first: "stop" } });
  });

  it("highlight: tap toggles findings", async () => {
    render(<Harness q={byId("sb-clozapine")} />);
    const item = screen.getByRole("checkbox", { name: /Sore throat/ });
    await userEvent.click(item);
    expect(item).toHaveAttribute("aria-checked", "true");
    await userEvent.click(item);
    expect(state()).toEqual({ type: "highlight", itemIds: [] });
  });

  it("bowtie: places options into slots and respects slot limits", async () => {
    render(<Harness q={byId("sb-bowtie-anaphylaxis")} />);
    await userEvent.click(screen.getByRole("button", { name: "Anaphylaxis" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop the ceftriaxone infusion" }));
    await userEvent.click(screen.getByRole("button", { name: "Administer intramuscular epinephrine as prescribed" }));
    expect(screen.getByRole("button", { name: "Sit the client upright with legs dangling" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Blood pressure" }));
    expect(state()).toEqual({ type: "bowtie", left: ["stop", "epi"], center: ["anaph"], right: ["bp"] });
  });

  it("switching clinical record tabs does not reset the answer", async () => {
    render(<Harness q={byId("vte-3")} caseStudy={caseOf("case-vte")} />);
    await userEvent.click(screen.getAllByRole("radio")[1]);
    const tabs = screen.getByRole("tablist", { name: "Clinical records" });
    await userEvent.click(within(tabs).getByRole("tab", { name: "Vital Signs" }));
    expect(screen.getByText("124/min")).toBeInTheDocument();
    await userEvent.click(within(tabs).getByRole("tab", { name: "Laboratory Results" }));
    await userEvent.click(within(tabs).getByRole("tab", { name: "Nurses' Notes" }));
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
    expect(state()).toEqual({ type: "single", optionId: "b" });
  });

  it("case study shows part progress and only records released by that part", async () => {
    const { unmount } = render(<Harness q={byId("vte-1")} caseStudy={caseOf("case-vte")} />);
    expect(screen.getByTestId("case-progress")).toHaveTextContent("Case Study — Part 1 of 6");
    await userEvent.click(screen.getByRole("tab", { name: "Vital Signs" }));
    expect(screen.queryByText("124/min")).not.toBeInTheDocument(); // 10:30 vitals appear from part 3
    await userEvent.click(screen.getByRole("tab", { name: "Prescriptions" }));
    expect(screen.queryByText(/weight-based protocol/)).not.toBeInTheDocument(); // part 5
    unmount();
    render(<Harness q={byId("vte-5")} caseStudy={caseOf("case-vte")} />);
    expect(screen.getByTestId("case-progress")).toHaveTextContent("Part 5 of 6");
    fireEvent.click(screen.getByRole("tab", { name: "Prescriptions" }));
    expect(screen.getByText(/weight-based protocol/)).toBeInTheDocument();
  });

  it("review mode marks correct and incorrect selections", () => {
    const q = byId("sa-warfarin");
    render(<QuestionView question={q} response={{ type: "single", optionId: "a" }} answerKey={{ type: "single", optionId: "b" }} onChange={() => {}} disabled />);
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Correct answer (not selected)")).toBeInTheDocument();
  });
});

describe("question navigator", () => {
  it("distinguishes current, answered, unanswered and flagged", async () => {
    const picked: number[] = [];
    render(
      <QuestionNavigator
        questionIds={["a", "b", "c"]}
        currentIndex={1}
        responses={{ a: { type: "single", optionId: "x" } }}
        flagged={["c"]}
        onSelect={(i) => picked.push(i)}
      />,
    );
    expect(screen.getByRole("button", { name: /Question 1: answered/ })).toHaveAttribute("data-state", "answered");
    expect(screen.getByRole("button", { name: /Question 2: current, unanswered/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Question 3: unanswered, flagged/ })).toHaveAttribute("data-flagged", "true");
    await userEvent.click(screen.getByRole("button", { name: /Question 3/ }));
    expect(picked).toEqual([2]);
  });
});
