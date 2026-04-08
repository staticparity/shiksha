import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StudentHeader } from "@/components/layout/student-header";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Fetch current streak
  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  let streak = 0;
  if (membership) {
    const { data: streakData } = await supabase
      .from("streaks")
      .select("current_streak")
      .eq("student_id", user.id)
      .eq("school_id", membership.school_id)
      .single();
    streak = streakData?.current_streak ?? 0;
  }

  const userName = profile?.full_name ?? user.email ?? "Student";

  return (
    <>
      <StudentHeader userName={userName} streak={streak} />
      <main>{children}</main>
    </>
  );
}
