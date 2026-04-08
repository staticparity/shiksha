import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeachPageClient } from "./client";

export default async function TeachPage(props: PageProps<"/teach/[topicId]">) {
  const { topicId } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: topic } = await supabase
    .from("topics")
    .select("title, subject, chapter, class_id, classes(school_id)")
    .eq("id", topicId)
    .single();

  if (!topic) redirect("/dashboard");

  return (
    <TeachPageClient
      topicId={topicId}
      topic={topic as any}
      userId={user.id}
    />
  );
}
