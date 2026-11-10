import { ReviewView } from "@/components/results/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ReviewView sessionId={sessionId} />;
}
