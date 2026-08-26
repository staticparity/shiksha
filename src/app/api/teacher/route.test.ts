import { describe, it, expect, vi, beforeEach } from "vitest";

const createUserMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { createUser: createUserMock } },
  })),
}));

// Sequenced rpc().single() results — shift one per call, so a test can set up
// "not found, then found on retry" (the conflict path) precisely.
let rpcResults: Array<{ data: unknown; error: unknown }> = [];
let insertResult: { error: unknown } = { error: null };
const insertCalls: Array<Record<string, unknown>> = [];

function makeSupabase() {
  return {
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn(() => Promise.resolve(rpcResults.shift() ?? { data: null, error: null })),
    })),
    from: vi.fn(() => ({
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertCalls.push(payload);
        return Promise.resolve(insertResult);
      }),
    })),
  };
}

const { enrollStudent, POST } = await import("./route");

const baseParams = {
  classId: "class-1",
  schoolId: "school-1",
  studentEmail: "priya@example.com",
  studentName: "Priya",
  studentPassword: "correct-horse",
  createdByTeacherId: "teacher-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  rpcResults = [];
  insertResult = { error: null };
  insertCalls.length = 0;
});

describe("enrollStudent", () => {
  it("surfaces a clear error when the lookup RPC itself fails, instead of silently attempting account creation", async () => {
    rpcResults = [{ data: null, error: { message: "connection reset" } }];

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: false, status: 500, error: expect.stringContaining("Try again") });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects an empty password before touching the database", async () => {
    const result = await enrollStudent(makeSupabase() as any, { ...baseParams, studentPassword: "" });
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("at least 6 characters") });
  });

  it("rejects a password shorter than 6 characters with a clear message", async () => {
    const result = await enrollStudent(makeSupabase() as any, { ...baseParams, studentPassword: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("at least 6 characters");
    }
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("does not reject a short/empty password when the student already has an account (password is never used on that path)", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Priya" }, error: null }];

    const result = await enrollStudent(makeSupabase() as any, { ...baseParams, studentPassword: "" });

    expect(result).toEqual({ ok: true, studentName: "Priya", created: false });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("enrolls an existing student directly when the name matches, without creating a new account", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Priya" }, error: null }];

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: true, studentName: "Priya", created: false });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(insertCalls[0]).toEqual({ class_id: "class-1", student_id: "student-1" });
  });

  it("matches names case-insensitively and ignoring surrounding whitespace, not a byte-exact comparison", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: " priya " }, error: null }];

    const result = await enrollStudent(makeSupabase() as any, { ...baseParams, studentName: "PRIYA" });

    expect(result).toEqual({ ok: true, studentName: " priya ", created: false });
  });

  it("flags a name mismatch instead of silently merging a different person into the existing account (the sibling-shared-email case)", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Raj" }, error: null }];

    const result = await enrollStudent(makeSupabase() as any, { ...baseParams, studentName: "Priya" });

    expect(result).toEqual({
      ok: false,
      status: 409,
      needsConfirmation: true,
      existingStudentName: "Raj",
      error: expect.stringContaining("Raj"),
    });
    expect(insertCalls.length).toBe(0);
  });

  it("proceeds with the name-mismatched account when the tutor explicitly confirms", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Raj" }, error: null }];

    const result = await enrollStudent(makeSupabase() as any, {
      ...baseParams,
      studentName: "Priya",
      confirmed: true,
    });

    expect(result).toEqual({ ok: true, studentName: "Raj", created: false });
    expect(insertCalls[0]).toEqual({ class_id: "class-1", student_id: "student-1" });
  });

  it("creates a new account when no existing student is found, and reports created:true", async () => {
    rpcResults = [{ data: null, error: null }];
    createUserMock.mockResolvedValueOnce({ data: { user: { id: "student-new" } }, error: null });

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: true, studentName: "Priya", created: true });
    expect(insertCalls[0]).toEqual({ class_id: "class-1", student_id: "student-new" });
  });

  it("passes schoolId explicitly in user_metadata so handle_new_user() doesn't fall back to domain matching", async () => {
    rpcResults = [{ data: null, error: null }];
    createUserMock.mockResolvedValueOnce({ data: { user: { id: "student-new" } }, error: null });

    await enrollStudent(makeSupabase() as any, baseParams);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          school_id: "school-1",
          role: "student",
          created_by_teacher_id: "teacher-1",
        }),
      })
    );
  });

  it("on a creation conflict, looks up the now-existing account in this school and enrolls it", async () => {
    // First lookup: not found. Retry lookup after conflict: found.
    rpcResults = [
      { data: null, error: null },
      { data: { user_id: "student-race", full_name: "Priya Race" }, error: null },
    ];
    createUserMock.mockResolvedValueOnce({
      data: null,
      error: { code: "email_exists", message: "A user with this email address has already been registered" },
    });

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: true, studentName: "Priya Race", created: false });
    expect(insertCalls[0]).toEqual({ class_id: "class-1", student_id: "student-race" });
  });

  it("on a creation conflict where the email belongs to a different school, returns a specific 409 (not a retry-implying generic error)", async () => {
    rpcResults = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    createUserMock.mockResolvedValueOnce({
      data: null,
      error: { code: "user_already_exists", message: "A user with this email address has already been registered" },
    });

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toContain("different school");
    }
  });

  it("returns a specific 400 for an invalid email, distinct from the generic fallback", async () => {
    rpcResults = [{ data: null, error: null }];
    createUserMock.mockResolvedValueOnce({ data: null, error: { code: "email_address_invalid", message: "Unable to validate email address: invalid format" } });

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain(baseParams.studentEmail);
    }
  });

  it("returns a generic fallback for an unrecognized account-creation error (e.g. a rejected weak password)", async () => {
    rpcResults = [{ data: null, error: null }];
    createUserMock.mockResolvedValueOnce({ data: null, error: { code: "weak_password", message: "Password should be at least 8 characters" } });

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).not.toContain("undefined");
    }
  });

  it("returns 409 'already enrolled' when the class_enrollments insert hits the duplicate constraint", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Priya" }, error: null }];
    insertResult = { error: { code: "23505", message: "duplicate key" } };

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: false, status: 409, error: "Student is already enrolled" });
  });

  it("returns 500 with the raw message for an unexpected enrollment DB error", async () => {
    rpcResults = [{ data: { user_id: "student-1", full_name: "Priya" }, error: null }];
    insertResult = { error: { code: "OTHER", message: "connection reset" } };

    const result = await enrollStudent(makeSupabase() as any, baseParams);

    expect(result).toEqual({ ok: false, status: 500, error: "connection reset" });
  });
});

describe("POST /api/teacher — add_student wiring", () => {
  function makeRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/teacher", { method: "POST", body: JSON.stringify(body) });
  }

  function mockAuthedTeacher() {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(() =>
        Promise.resolve({
          auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "teacher-1" } } })) },
          from: vi.fn((table: string) => {
            if (table === "school_members") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      single: () => Promise.resolve({ data: { role: "teacher", school_id: "school-1" } }),
                    }),
                  }),
                }),
              };
            }
            if (table === "classes") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      single: () => Promise.resolve({ data: { id: "class-1" } }),
                    }),
                  }),
                }),
              };
            }
            return { insert: vi.fn((payload: Record<string, unknown>) => { insertCalls.push(payload); return Promise.resolve(insertResult); }) };
          }),
          rpc: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(rpcResults.shift() ?? { data: null, error: null })) })),
        })
      ),
    }));
  }

  it("returns 400 when studentPassword is missing", async () => {
    vi.resetModules();
    mockAuthedTeacher();
    const { POST: freshPOST } = await import("./route");

    const res = await freshPOST(
      makeRequest({ action: "add_student", classId: "class-1", studentEmail: "a@b.com", studentName: "A" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("studentPassword");
  });

  it("returns 404 when classId doesn't belong to the calling teacher, without creating an account", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(() =>
        Promise.resolve({
          auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "teacher-1" } } })) },
          from: vi.fn((table: string) => {
            if (table === "school_members") {
              return {
                select: () => ({
                  eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: "teacher", school_id: "school-1" } }) }) }),
                }),
              };
            }
            if (table === "classes") {
              // Not this teacher's class — .eq("teacher_id", ...) would filter it out for real.
              return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) };
            }
            return {};
          }),
          rpc: vi.fn(),
        })
      ),
    }));
    const { POST: freshPOST } = await import("./route");

    const res = await freshPOST(
      makeRequest({
        action: "add_student",
        classId: "someone-elses-class",
        studentEmail: "priya@example.com",
        studentName: "Priya",
        studentPassword: "correct-horse",
      })
    );

    expect(res.status).toBe(404);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("happy path: returns 200 with success, studentName, and created on the response body", async () => {
    vi.resetModules();
    mockAuthedTeacher();
    rpcResults = [{ data: null, error: null }];
    createUserMock.mockResolvedValueOnce({ data: { user: { id: "student-new" } }, error: null });
    const { POST: freshPOST } = await import("./route");

    const res = await freshPOST(
      makeRequest({
        action: "add_student",
        classId: "class-1",
        studentEmail: "priya@example.com",
        studentName: "Priya",
        studentPassword: "correct-horse",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, studentName: "Priya", created: true });
  });
});
