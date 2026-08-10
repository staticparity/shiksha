import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TeacherDashboardClient } from "./client";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get teacher's first class
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .limit(1);

  if (!classes || classes.length === 0) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        textAlign: "center" as const,
      }}>
        <div>
          <p style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>📊</p>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)" as any, marginBottom: "var(--space-2)", color: "var(--text-primary)" }}>
            No classes yet
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
            Create a class and add topics to start seeing student mastery data.
          </p>
          <Link
            href="/teacher/setup"
            style={{
              display: "inline-block",
              padding: "var(--space-3) var(--space-6)",
              background: "var(--accent-primary)",
              color: "white",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
            }}
          >
            Create Your First Class →
          </Link>
        </div>
      </div>
    );
  }

  return <TeacherDashboardClient classId={classes[0].id} />;
}
