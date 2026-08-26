import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_PASSWORD_LENGTH = 6;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type EnrollResult =
  | { ok: true; studentName: string; created: boolean }
  | { ok: false; status: number; error: string; needsConfirmation?: boolean; existingStudentName?: string };

type LookupResult =
  | { failed: false; student: { user_id: string; full_name: string } | null }
  | { failed: true };

async function lookupStudent(
  supabase: SupabaseServerClient,
  email: string,
  schoolId: string
): Promise<LookupResult> {
  // maybeSingle(), not single(): zero rows is the normal "new student" case,
  // not an error. single() treats zero rows as PGRST116 (no rows found),
  // which would be indistinguishable here from a genuine RPC failure.
  const { data, error } = (await supabase
    .rpc("find_student_by_email", { p_email: email, p_school_id: schoolId })
    .maybeSingle()) as { data: { user_id: string; full_name: string } | null; error: unknown };

  if (error) return { failed: true };
  return { failed: false, student: data };
}

/** Returns true if classId exists and belongs to this teacher. */
async function verifyClassOwnership(
  supabase: SupabaseServerClient,
  classId: string,
  teacherId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .single();
  return !!data;
}

/**
 * Enrolls a student by email — reusing their account if one already exists
 * in this school, or provisioning a new one (tutor-set password) if not.
 * school_id is passed explicitly into the new account's metadata so
 * handle_new_user() assigns it directly instead of falling back to
 * email-domain matching (see migrations/005_admin_provisioned_school_assignment.sql).
 */
export async function enrollStudent(
  supabase: SupabaseServerClient,
  params: {
    classId: string;
    schoolId: string;
    studentEmail: string;
    studentName: string;
    studentPassword: string;
    createdByTeacherId: string;
    confirmed?: boolean;
  }
): Promise<EnrollResult> {
  const { classId, schoolId, studentEmail, studentName, studentPassword, createdByTeacherId, confirmed } = params;

  let studentId: string;
  let resolvedName: string;
  let created = false;

  const lookup = await lookupStudent(supabase, studentEmail, schoolId);
  if (lookup.failed) {
    console.error("enrollStudent: lookup RPC failed", { studentEmail, schoolId, classId });
    return { ok: false, status: 500, error: "Couldn't check enrollment status. Try again in a moment." };
  }
  const existing = lookup.student;

  if (existing) {
    // Already has an account — studentPassword is irrelevant here (the tutor
    // can't know in advance whether this email is new or existing), so don't
    // validate a value that's never going to be used.
    //
    // Name mismatch is the real signal something's wrong: two students
    // sharing one email (e.g. siblings using a parent's address) would
    // otherwise silently merge into a single account on the second
    // enrollment — same email, different intended person, no error. Same
    // name (the tutor knowingly re-enrolling a student they know already
    // has an account — the common case) proceeds without friction.
    const nameMismatch = existing.full_name.trim().toLowerCase() !== studentName.trim().toLowerCase();
    if (nameMismatch && !confirmed) {
      return {
        ok: false,
        status: 409,
        needsConfirmation: true,
        existingStudentName: existing.full_name,
        error: `"${studentEmail}" is already registered to ${existing.full_name}, not "${studentName}".`,
      };
    }
    studentId = existing.user_id;
    resolvedName = existing.full_name;
  } else {
    if (!studentPassword || studentPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    const admin = createAdminClient();
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: {
        full_name: studentName,
        role: "student",
        school_id: schoolId,
        created_by_teacher_id: createdByTeacherId,
      },
    });

    if (createError) {
      // Stable error codes (@supabase/auth-js ErrorCode), not message text —
      // message is display copy, not an API contract, and shouldn't be matched.
      const isConflict = createError.code === "email_exists" || createError.code === "user_already_exists";
      const isInvalidEmail = createError.code === "email_address_invalid";

      if (isConflict) {
        // Race: signed up (or was already created by a retried request)
        // between our lookup and this call. If they're in THIS school,
        // enroll them like any existing student. If not found here at all,
        // the email belongs to a different school — not retriable.
        const retryLookup = await lookupStudent(supabase, studentEmail, schoolId);
        if (retryLookup.failed || !retryLookup.student) {
          console.error("enrollStudent: createUser conflict, but retry lookup found no match in this school", {
            studentEmail,
            schoolId,
            classId,
            retryFailed: retryLookup.failed,
          });
          return {
            ok: false,
            status: 409,
            error: `"${studentEmail}" is already registered to a different school. Ask them which account they used, or try a different email.`,
          };
        }
        studentId = retryLookup.student.user_id;
        resolvedName = retryLookup.student.full_name;
      } else if (isInvalidEmail) {
        return {
          ok: false,
          status: 400,
          error: `"${studentEmail}" doesn't look like a valid email address.`,
        };
      } else {
        console.error("enrollStudent: createUser failed with an unrecognized error code", {
          studentEmail,
          schoolId,
          classId,
          code: createError.code,
          message: createError.message,
        });
        return { ok: false, status: 500, error: "Couldn't create that account. Try again in a moment." };
      }
    } else {
      studentId = createData.user.id;
      resolvedName = studentName;
      created = true;
    }
  }

  const { error: enrollError } = await supabase
    .from("class_enrollments")
    .insert({ class_id: classId, student_id: studentId });

  if (enrollError) {
    if (enrollError.code === "23505") {
      return { ok: false, status: 409, error: "Student is already enrolled" };
    }
    console.error("enrollStudent: class_enrollments insert failed", {
      studentEmail,
      classId,
      studentId,
      code: enrollError.code,
      message: enrollError.message,
    });
    return { ok: false, status: 500, error: enrollError.message };
  }

  return { ok: true, studentName: resolvedName, created };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify teacher role
  const { data: membership } = await supabase
    .from("school_members")
    .select("role, school_id")
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .single();

  if (!membership) {
    return Response.json({ error: "Not a teacher" }, { status: 403 });
  }

  const body = await req.json();

  // ── Create Class ──────────────────────────────────────────────
  if (body.action === "create_class") {
    const { name, subject, grade } = body;
    if (!name || !subject) {
      return Response.json({ error: "Name and subject are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("classes")
      .insert({
        school_id: membership.school_id,
        teacher_id: user.id,
        name,
        subject,
        grade: grade || null,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  // ── Create Topic ──────────────────────────────────────────────
  if (body.action === "create_topic") {
    const { classId, title, subject, chapter, description, knowledgeConcepts } = body;
    if (!classId || !title || !subject) {
      return Response.json({ error: "classId, title, and subject are required" }, { status: 400 });
    }

    if (!(await verifyClassOwnership(supabase, classId, user.id))) {
      return Response.json({ error: "Class not found or not yours" }, { status: 404 });
    }

    // Build knowledge_base from concepts
    const knowledge_base = knowledgeConcepts && knowledgeConcepts.length > 0
      ? {
          key_concepts: knowledgeConcepts.map((c: any) => ({
            concept: c.concept,
            description: c.description,
          })),
          common_misconceptions: [],
          difficulty_level: "intermediate",
        }
      : null;

    const { data, error } = await supabase
      .from("topics")
      .insert({
        class_id: classId,
        title,
        subject,
        chapter: chapter || null,
        description: description || null,
        knowledge_base,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  // ── Add Student to Class ──────────────────────────────────────
  if (body.action === "add_student") {
    const { classId, studentEmail, studentName, studentPassword, confirmed } = body;
    if (!classId || !studentEmail || !studentName || !studentPassword) {
      return Response.json(
        { error: "classId, studentEmail, studentName, and studentPassword are required" },
        { status: 400 }
      );
    }

    // Without this, a bad/foreign classId would still create a real Auth
    // user (admin.createUser() runs on the service-role client, which
    // bypasses RLS) before the enrollment insert below failed on RLS anyway.
    if (!(await verifyClassOwnership(supabase, classId, user.id))) {
      return Response.json({ error: "Class not found or not yours" }, { status: 404 });
    }

    const result = await enrollStudent(supabase, {
      classId,
      schoolId: membership.school_id,
      studentEmail,
      studentName,
      studentPassword,
      createdByTeacherId: user.id,
      confirmed: !!confirmed,
    });

    if (!result.ok) {
      return Response.json(
        { error: result.error, needsConfirmation: result.needsConfirmation, existingStudentName: result.existingStudentName },
        { status: result.status }
      );
    }

    return Response.json({ success: true, studentName: result.studentName, created: result.created });
  }

  // ── Get Teacher's Classes ─────────────────────────────────────
  if (body.action === "get_classes") {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, subject, grade")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
