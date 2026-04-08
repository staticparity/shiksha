import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResultsClient } from "./client";
import { calculateCredits } from "@/lib/scoring/mastery-calculator";

export const dynamic = "force-dynamic";

export default async function ResultsPage(props: PageProps<"/results/[sessionId]">) {
  const { sessionId } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `
      id,
      mastery_score,
      strengths,
      gaps,
      assessment,
      duration_seconds,
      recitation_detected,
      follow_up_quality,
      topic_id,
      status,
      topics (
        title,
        subject
      )
    `
    )
    .eq("id", sessionId)
    .eq("student_id", user.id)
    .single();

  if (!session || session.status !== "completed") {
    redirect("/dashboard");
  }

  const creditsEarned = calculateCredits(session.mastery_score ?? 0);

  return <ResultsClient session={session as any} creditsEarned={creditsEarned} />;
}
