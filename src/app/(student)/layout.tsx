import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StudentHeader } from "@/components/layout/student-header";
import { loadStudentStreak } from "@/lib/learning/rewards";

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

  const streak = await loadStudentStreak(supabase, user.id);

  const userName = profile?.full_name ?? user.email ?? "Student";

  return (
    <>
      <StudentHeader userName={userName} streak={streak} />
      <main>{children}</main>
    </>
  );
}
