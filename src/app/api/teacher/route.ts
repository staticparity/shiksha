import { z } from "zod";
import { readBody } from "@/lib/api/validation";
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

function checkStudentName(existingName: string, requestedName: string, email: string, confirmed?: boolean): EnrollResult | null {
  if (existingName.trim().toLowerCase() === requestedName.trim().toLowerCase() || confirmed) return null;
  return { ok: false, status: 409, needsConfirmation: true, existingStudentName: existingName,
    error: `"${email}" is already registered to ${existingName}, not "${requestedName}".` };
}

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
 * Trusted app_metadata assigns provisioned students to this school; verified
 * self-signups remain unassigned until enrollment (migration 006).
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
    const mismatch = checkStudentName(existing.full_name, studentName, studentEmail, confirmed);
    if (mismatch) return mismatch;
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
      app_metadata: { school_id: schoolId },
      user_metadata: {
        full_name: studentName,
        role: "student",
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
        // it may be unverified or belong to another school.
        const retryLookup = await lookupStudent(supabase, studentEmail, schoolId);
        if (retryLookup.failed) return { ok: false, status: 503, error: "Couldn't check enrollment status. Please try again." };
        if (!retryLookup.student) {
          console.error("enrollStudent: createUser conflict, but retry lookup found no match in this school", {
            studentEmail,
            schoolId,
            classId,
            retryFailed: retryLookup.failed,
          });
          return {
            ok: false,
            status: 409,
            error: `"${studentEmail}" already has an account that cannot be enrolled here. Ask the student to verify their email and check their school membership.`,
          };
        }
        const mismatch = checkStudentName(retryLookup.student.full_name, studentName, studentEmail, confirmed);
        if (mismatch) return mismatch;
        studentId = retryLookup.student.user_id;
        resolvedName = retryLookup.student.full_name;
      } else if (isInvalidEmail) {
        return {
          ok: false,
          status: 400,
          error: `"${studentEmail}" doesn't look like a valid email address.`,
        };
      } else if (createError.code === "weak_password") {
        return { ok: false, status: 400, error: "Choose a stronger temporary password that meets your school's password requirements." };
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

  const { error: enrollError } = await supabase.rpc("enroll_verified_student", { p_class_id: classId, p_student_id: studentId });

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
    return { ok: false, status: 500, error: "Couldn't finish enrollment. Your entries are still available; please try again." };
  }

  return { ok: true, studentName: resolvedName, created };
}

const teacherBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get_classes") }),
  z.object({ action: z.literal("create_class"), name: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(120), grade: z.string().trim().max(30).optional() }),
  z.object({ action: z.literal("create_topic"), classId: z.string().min(1).max(100), title: z.string().trim().min(1).max(200), subject: z.string().trim().min(1).max(120), chapter: z.string().max(200).optional(), description: z.string().max(2000).optional(), knowledgeConcepts: z.array(z.object({ concept: z.string().trim().min(1).max(200), description: z.string().trim().max(3000) })).max(30).optional() }),
  z.object({ action: z.literal("add_student"), classId: z.string().min(1).max(100), studentEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)), studentName: z.string().trim().min(1).max(120), studentPassword: z.string().max(200).default(""), confirmed: z.boolean().optional() }),
]);

export async function POST(req: Request) {
  try {
    return await handleTeacherRequest(req);
  } catch (error) {
    console.error('[Teacher request]', error);
    return Response.json({ error: "Could not complete this request. Your entries are still available; please try again." }, { status: 500 });
  }
}

async function handleTeacherRequest(req: Request) {
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

  const parsed = teacherBody.safeParse(await readBody(req).catch(() => null));
  if (!parsed.success) return Response.json({ error: `Invalid request: ${parsed.error.issues.map(i => i.path.join(".")).join(", ")}` }, { status: 400 });
  const body = parsed.data;

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
      .select("id, name, subject, grade")
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
          key_concepts: knowledgeConcepts.map((c) => ({
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
      .select("id, title, subject, chapter, class_id")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  // ── Add Student to Class ──────────────────────────────────────
  if (body.action === "add_student") {
    const { classId, studentEmail, studentName, studentPassword, confirmed } = body;
    if (!classId || !studentEmail || !studentName) {
      return Response.json(
        { error: "classId, studentEmail, and studentName are required" },
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
