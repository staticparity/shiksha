import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeachPageClient } from "./client";

interface TopicData {
  title: string;
  subject: string;
  chapter: string | null;
  class_id: string;
  classes: { school_id: string };
}

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

  const typedTopic = topic as unknown as TopicData;

  return (
    <TeachPageClient
      topicId={topicId}
      topicTitle={typedTopic.title}
      topicSubject={typedTopic.subject}
      topicChapter={typedTopic.chapter}
      classId={typedTopic.class_id}
      schoolId={typedTopic.classes.school_id}
      userId={user.id}
    />
  );
}
