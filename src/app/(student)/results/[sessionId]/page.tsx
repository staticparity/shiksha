import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResultsClient } from "./client";
import { calculateCredits } from "@/lib/scoring/mastery-calculator";
import { SESSION_FIELDS } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function ResultsPage(props: PageProps<"/results/[sessionId]">) {
  const { sessionId } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Field list is the shared SESSION_FIELDS constant (database.types.ts) plus
  // this page's own additions (topic_id, the joined topics relation) — keeps
  // the sessions-table portion in sync with what route.ts writes.
  const { data: session } = await supabase
    .from("sessions")
    .select(
      `${SESSION_FIELDS}, topic_id, topics ( title, subject, knowledge_base )`
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
