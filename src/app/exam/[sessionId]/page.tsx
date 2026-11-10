import { ExamRunner } from "@/components/exam/ExamRunner";

export default async function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ExamRunner sessionId={sessionId} />;
}
