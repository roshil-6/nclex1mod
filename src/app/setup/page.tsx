import { Shell } from "@/components/ui/Shell";
import { SetupForm } from "@/components/exam/SetupForm";
import { eligibleUnits, loadBank, poolStats } from "@/lib/question-bank/stats";
import type { ExamMode } from "@/types/exam";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const m: ExamMode = mode === "full" || mode === "case" || mode === "custom" ? mode : "quick";
  const bank = loadBank();
  return (
    <Shell>
      <SetupForm initialMode={m} stats={poolStats(bank, eligibleUnits(bank))} />
    </Shell>
  );
}
