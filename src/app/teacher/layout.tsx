import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import styles from "./layout.module.css";

export default async function TeacherLayout({
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

  const userName = profile?.full_name ?? user.email ?? "Teacher";

  return (
    <div className={styles.layout}>
      <Sidebar role="teacher" userName={userName} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
