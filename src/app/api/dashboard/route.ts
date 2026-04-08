/**
 * GET /api/dashboard — Teacher analytics dashboard data
 *
 * Returns:
 * - Class overview stats
 * - Student x Topic mastery heatmap
 * - Red flag alerts
 */

import { createClient } from "@/lib/supabase/server";

interface Alert {
  type: "low_score" | "class_wide_gap" | "inactive";
  message: string;
  severity: "critical" | "warning" | "info";
}

interface EnrollmentRow {
  student_id: string;
  profiles: { id: string; full_name: string; avatar_url: string | null };
}

interface SessionRow {
  student_id: string;
  topic_id: string;
  mastery_score: number | null;
  ended_at: string | null;
  gaps: Array<{ concept: string }> | null;
  status: string;
}

interface TopicRow {
  id: string;
  title: string;
  subject: string;
  chapter: string | null;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = 20;

    if (!classId) {
      return Response.json(
        { error: "Missing classId parameter" },
        { status: 400 }
      );
    }

    // Verify teacher owns this class
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, subject, grade, school_id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .single();

    if (!classData) {
      return Response.json(
        { error: "Class not found or unauthorized" },
        { status: 403 }
      );
    }

    // Get enrolled students with profiles
    const { data: rawEnrollments } = await supabase
      .from("class_enrollments")
      .select(
        `
        student_id,
        profiles:student_id (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq("class_id", classId)
      .range((page - 1) * perPage, page * perPage - 1);

    const enrollments = (rawEnrollments ?? []) as unknown as EnrollmentRow[];

    // Get all topics for this class
    const { data: rawTopics } = await supabase
      .from("topics")
      .select("id, title, subject, chapter")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    const topics = (rawTopics ?? []) as TopicRow[];

    // Get all completed sessions for this class
    const { data: rawSessions } = await supabase
      .from("sessions")
      .select("student_id, topic_id, mastery_score, ended_at, gaps, status")
      .eq("class_id", classId)
      .eq("status", "completed");

    const sessions = (rawSessions ?? []) as unknown as SessionRow[];

    // Build heatmap: for each student, best score per topic
    const heatmap = enrollments.map((enrollment) => {
      const profile = enrollment.profiles;
      const studentSessions = sessions.filter(
        (s) => s.student_id === enrollment.student_id
      );

      const topicScores: Record<string, number | null> = {};
      for (const topic of topics) {
        const topicSessions = studentSessions.filter(
          (s) => s.topic_id === topic.id
        );
        topicScores[topic.id] =
          topicSessions.length > 0
            ? Math.max(...topicSessions.map((s) => s.mastery_score ?? 0))
            : null;
      }

      const scores = Object.values(topicScores).filter(
        (s): s is number => s !== null
      );
      const avgMastery =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      const lastActive =
        studentSessions.length > 0
          ? studentSessions
              .map((s) => s.ended_at)
              .filter(Boolean)
              .sort()
              .pop() ?? null
          : null;

      return {
        studentId: enrollment.student_id,
        studentName: profile?.full_name ?? "Unknown",
        avatarUrl: profile?.avatar_url ?? null,
        topicScores,
        avgMastery,
        lastActive,
      };
    });

    // Class overview stats
    const allScores = heatmap
      .map((h) => h.avgMastery)
      .filter((s): s is number => s !== null);
    const avgClassMastery =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

    const today = new Date().toISOString().split("T")[0];
    const activeToday = heatmap.filter(
      (h) => h.lastActive?.startsWith(today)
    ).length;

    // Build alerts
    const alerts: Alert[] = [];

    // Students below 40% on any topic
    for (const student of heatmap) {
      for (const [topicId, score] of Object.entries(student.topicScores)) {
        if (score !== null && score < 40) {
          const topic = topics.find((t) => t.id === topicId);
          alerts.push({
            type: "low_score",
            message: `${student.studentName} scored ${score}% on ${topic?.title ?? "a topic"}`,
            severity: "critical",
          });
        }
      }
    }

    // Common gaps across class
    const gapCounts: Record<string, number> = {};
    for (const session of sessions) {
      if (Array.isArray(session.gaps)) {
        for (const gap of session.gaps) {
          gapCounts[gap.concept] = (gapCounts[gap.concept] ?? 0) + 1;
        }
      }
    }

    const studentCount = heatmap.length;
    for (const [concept, count] of Object.entries(gapCounts)) {
      const pct = Math.round((count / Math.max(studentCount, 1)) * 100);
      if (pct >= 40) {
        alerts.push({
          type: "class_wide_gap",
          message: `"${concept}" gap detected in ${pct}% of class`,
          severity: pct >= 60 ? "critical" : "warning",
        });
      }
    }

    // Inactive students (no activity in 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    for (const student of heatmap) {
      if (
        !student.lastActive ||
        new Date(student.lastActive) < sevenDaysAgo
      ) {
        alerts.push({
          type: "inactive",
          message: `${student.studentName} has not attempted any topics this week`,
          severity: "warning",
        });
      }
    }

    // Sort: critical first
    alerts.sort((a, b) =>
      a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0
    );

    return Response.json({
      classInfo: classData,
      overview: {
        studentCount,
        avgMastery: avgClassMastery,
        activeToday,
        topicCount: topics.length,
      },
      topics,
      heatmap,
      alerts,
      pagination: { page, perPage, total: studentCount },
    });
  } catch (error) {
    console.error("[/api/dashboard GET] Error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
