"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH } from "@/lib/agents/concept-generator";
import styles from "./page.module.css";

interface ClassData {
  id: string;
  name: string;
  subject: string;
  grade: string;
}

interface ConceptRow {
  concept: string;
  description: string;
  sourceExcerpt?: string;
}

  async function teacherRequest(body: Record<string, unknown>) {
    try {
      return await fetch("/api/teacher", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } catch {
      return Response.json({ error: "Could not connect. Your entries are saved here; please try again." }, { status: 503 });
    }
  }


export default function TeacherSetupPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [activeTab, setActiveTab] = useState<"class" | "topic" | "student">("class");
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Class form
  const [className, setClassName] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [classGrade, setClassGrade] = useState("");

  // Topic form
  const [selectedClassId, setSelectedClassId] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [topicChapter, setTopicChapter] = useState("");
  const [concepts, setConcepts] = useState<ConceptRow[]>([{ concept: "", description: "" }]);
  const [topicContent, setTopicContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Student form
  const [studentClassId, setStudentClassId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [newAccountInfo, setNewAccountInfo] = useState<{ name: string; password: string } | null>(null);
  const [confirmMismatch, setConfirmMismatch] = useState<{ existingName: string } | null>(null);

  const loadClasses = useCallback(async (preferredId = "", tab: string | null = null) => {
    setClassesLoading(true);
    setClassesError(false);
    try {
      const res = await teacherRequest({ action: "get_classes" });
      if (!res.ok) throw new Error("Could not load classes");
      const data: ClassData[] = await res.json();
      setClasses(data);
      const id = data.find(c => c.id === preferredId)?.id ?? data[0]?.id ?? "";
      if (id) { setSelectedClassId(id); setStudentClassId(id); }
      if (data.length && (tab === "topic" || tab === "student")) setActiveTab(tab);
    } catch { setClassesError(true); }
    finally { setClassesLoading(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    loadClasses(params.get("classId") ?? "", tab);
  }, [loadClasses]);



  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });

  };

  // Auto-advance after successful class creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await teacherRequest({
        action: "create_class",
        name: className,
        subject: classSubject,
        grade: classGrade,
    });
    const data = await res.json().catch(() => ({ error: "Unexpected response. Please try again." }));
    setLoading(false);

    if (res.ok) {
      showMessage("success", `Class "${data.name}" created! Now add a topic.`);
      setClassName("");
      setClassSubject("");
      setClassGrade("");
      await loadClasses(data.id);
      setActiveTab("topic"); // Auto-advance to topic creation
    } else {
      showMessage("error", data.error || "Failed to create class");
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Get the selected class to auto-fill subject
    const selectedClass = classes.find((c) => c.id === selectedClassId);

    const res = await teacherRequest({
        action: "create_topic",
        classId: selectedClassId,
        title: topicTitle,
        subject: selectedClass?.subject ?? "",
        chapter: topicChapter,
        knowledgeConcepts: concepts
          .filter((c) => c.concept.trim())
          .map(({ concept, description }) => ({ concept, description })),
    });
    const data = await res.json().catch(() => ({ error: "Unexpected response. Please try again." }));
    setLoading(false);

    if (res.ok) {
      showMessage("success", `Topic "${data.title}" added! Add another or enroll students.`);
      setTopicTitle("");
      setTopicChapter("");
      setConcepts([{ concept: "", description: "" }]);
      setTopicContent("");
    } else {
      showMessage("error", data.error || "Failed to create topic");
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitAddStudent(false);
  };

  const submitAddStudent = async (confirmed: boolean) => {
    setLoading(true);
    setNewAccountInfo(null);
    const res = await teacherRequest({
        action: "add_student",
        classId: studentClassId,
        studentName,
        studentEmail,
        studentPassword,
        confirmed,
    });
    const data = await res.json().catch(() => ({ error: "Unexpected response. Please try again." }));
    setLoading(false);

    if (res.ok) {
      setConfirmMismatch(null);
      if (data.created) {
        // Persistent, not a timed toast — the tutor needs to read this back
        // and relay the password, which the password field itself no longer
        // holds once it's cleared below.
        setNewAccountInfo({ name: data.studentName, password: studentPassword });
      } else {
        showMessage("success", `${data.studentName} enrolled!`);
      }
      setStudentName("");
      setStudentEmail("");
      setStudentPassword("");
    } else if (data.needsConfirmation) {
      // Name on file for this email doesn't match what was just typed — could
      // be two different people sharing one email (e.g. siblings). Don't
      // silently merge; make the tutor confirm it's really the same student.
      setConfirmMismatch({ existingName: data.existingStudentName });
    } else {
      setConfirmMismatch(null);
      showMessage("error", data.error || "Failed to add student");
    }
  };

  const handleConfirmMismatch = () => {
    submitAddStudent(true);
  };

  const addConcept = () => {
    setConcepts([...concepts, { concept: "", description: "" }]);
  };

  const updateConcept = (index: number, field: "concept" | "description", value: string) => {
    const updated = [...concepts];
    // Editing a generated row by hand means the excerpt no longer reliably
    // points at the (now-edited) text — drop the stale hint rather than
    // leave a misleading pointer.
    updated[index] = { ...updated[index], [field]: value, sourceExcerpt: undefined };
    setConcepts(updated);
  };

  const removeConcept = (index: number) => {
    if (concepts.length <= 1) return;
    setConcepts(concepts.filter((_, i) => i !== index));
  };

  const hasTypedConcepts = () =>
    concepts.some((c) => c.concept.trim() || c.description.trim());

  const handleGenerateClick = () => {
    if (hasTypedConcepts()) {
      setConfirmReplace(true);
    } else {
      runGenerate();
    }
  };

  const handleConfirmReplace = () => {
    setConfirmReplace(false);
    runGenerate();
  };

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/teacher/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: topicContent }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Existing rows are untouched — a failed generation never wipes
        // what the teacher already typed.
        showMessage("error", data.message || data.error || "Couldn't generate concepts. Try again or add them manually.");
        return;
      }

      const generated: ConceptRow[] = data.key_concepts ?? [];
      if (generated.length === 0) {
        showMessage("error", "Couldn't find clear concepts in that — try different content or add them manually.");
        return;
      }

      setConcepts(generated);
      showMessage(
        "success",
        `Generated ${generated.length} concept${generated.length === 1 ? "" : "s"} — review before adding the topic.`
      );
    } catch {
      showMessage("error", "Could not connect. Your concept rows are unchanged; please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}><div><p className={styles.eyebrow}>MAKE SPACE FOR UNDERSTANDING</p><h1 className={styles.pageTitle}>Your classroom, thoughtfully prepared.</h1></div><Link className={styles.backLink} href="/teacher/dashboard">← Class overview</Link></div>
        <p className={styles.pageSubtitle}>
          A place for your learners, the ideas that matter, and the conversations that make them stick.
        </p>

        {/* Message Toast */}
        {message && (
          <div role={message.type === "error" ? "alert" : "status"} className={`${styles.toast} ${message.type === "error" ? styles.toastError : styles.toastSuccess}`}>
            {message.text}<button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message">✕</button>
          </div>
        )}

        {classesLoading && <p role="status" className={styles.loadNotice}>Loading your classes…</p>}
        {classesError && <div role="alert" className={styles.loadNotice}>We couldn’t load your classes. <button type="button" onClick={() => loadClasses()}>Try again</button></div>}
        {/* Step Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "class" ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab("class"); setMessage(null); }}
            disabled={loading || generating}
          >
            <span className={styles.tabStep}>1</span> Create Class
          </button>
          <button
            className={`${styles.tab} ${activeTab === "topic" ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab("topic"); setMessage(null); }}
            disabled={classesLoading || classes.length === 0 || loading || generating}
          >
            <span className={styles.tabStep}>2</span> Add Topics
          </button>
          <button
            className={`${styles.tab} ${activeTab === "student" ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab("student"); setMessage(null); }}
            disabled={classesLoading || classes.length === 0 || loading || generating}
          >
            <span className={styles.tabStep}>3</span> Invite Students
          </button>
        </div>

        {/* ── Step 1: Create Class ─────────────────────────────── */}
        {activeTab === "class" && (
          <GlassCard>
            <form onSubmit={handleCreateClass}><fieldset disabled={loading} className={styles.form}>
              <h2 className={styles.formTitle}>Create a Class</h2>
              <p className={styles.formHint}>
                A class groups your students and the topics you want them to learn.
              </p>
              <div className={styles.field}>
                <label htmlFor="setup-field-1" className={styles.label}>Class Name</label>
                <input id="setup-field-1"
                  className={styles.input}
                  placeholder="e.g. 8-B Biology"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="setup-field-2" className={styles.label}>Subject</label>
                  <input id="setup-field-2"
                    className={styles.input}
                    placeholder="e.g. Biology"
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="setup-field-3" className={styles.label}>Grade (optional)</label>
                  <input id="setup-field-3"
                    className={styles.input}
                    placeholder="e.g. 8"
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                  />
                </div>
              </div>
              <button className={styles.submitBtn} type="submit" disabled={loading || generating}>
                {loading ? "Creating..." : "Create Class →"}
              </button>
            </fieldset></form>
          </GlassCard>
        )}

        {/* ── Step 2: Add Topic ────────────────────────────────── */}
        {activeTab === "topic" && (
          <GlassCard>
            <form onSubmit={handleCreateTopic}><fieldset disabled={loading || generating} className={styles.form}>
              <h2 className={styles.formTitle}>Add a Topic</h2>
              <p className={styles.formHint}>
                A topic is something students learn — like &quot;Photosynthesis&quot; or &quot;Quadratic Equations.&quot;
                Students will teach this topic back to the AI, and their understanding gets scored.
              </p>

              <div className={styles.field}>
                <label htmlFor="setup-field-4" className={styles.label}>Class</label>
                <select id="setup-field-4"
                  className={styles.input}
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  required
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="setup-field-5" className={styles.label}>Topic Name</label>
                  <input id="setup-field-5"
                    className={styles.input}
                    placeholder="e.g. Photosynthesis"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="setup-field-6" className={styles.label}>Chapter (optional)</label>
                  <input id="setup-field-6"
                    className={styles.input}
                    placeholder="e.g. Chapter 7"
                    value={topicChapter}
                    onChange={(e) => setTopicChapter(e.target.value)}
                  />
                </div>
              </div>

              {/* Generate from Content */}
              <div className={styles.generateSection}>
                <label htmlFor="setup-field-7" className={styles.label}>
                  Generate from content
                  <span className={styles.labelHint}>optional — paste notes or a textbook excerpt</span>
                </label>
                <textarea id="setup-field-7"
                  className={styles.textarea}
                  placeholder="Paste your notes, a textbook excerpt, or other prep material here..."
                  value={topicContent}
                  onChange={(e) => setTopicContent(e.target.value)}
                  rows={5}
                  maxLength={MAX_CONTENT_LENGTH}
                />
                <div className={styles.generateRow}>
                  <span className={styles.charCount}>
                    {topicContent.trim().length}/{MAX_CONTENT_LENGTH}
                  </span>
                  <button
                    type="button"
                    className={styles.generateBtn}
                    onClick={handleGenerateClick}
                    disabled={generating || topicContent.trim().length < MIN_CONTENT_LENGTH}
                  >
                    {generating ? "Generating..." : "✨ Generate from content"}
                  </button>
                </div>

                {confirmReplace && (
                  <div className={styles.mismatchCard}>
                    <div className={styles.mismatchHeader}>
                      <span>⚠️</span>
                      <strong>This replaces what you&apos;ve typed below</strong>
                    </div>
                    <p className={styles.mismatchHint}>
                      Generating will overwrite the concept rows you&apos;ve already filled in. You can still edit
                      anything afterward.
                    </p>
                    <div className={styles.mismatchActions}>
                      <button
                        type="button"
                        className={styles.dismissBtn}
                        onClick={handleConfirmReplace}
                        disabled={generating}
                      >
                        {generating ? "Generating..." : "Yes, replace and generate"}
                      </button>
                      <button
                        type="button"
                        className={styles.mismatchCancelBtn}
                        onClick={() => setConfirmReplace(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Key Things to Know */}
              <div className={styles.conceptsSection}>
                <label htmlFor="setup-field-8" className={styles.label}>
                  What should students know about this topic?
                </label>
                <p className={styles.conceptHint}>
                  List the key things a student should be able to explain.
                  The AI uses this as its scoring rubric — it won&apos;t show these to students.
                </p>
                {concepts.map((c, i) => (
                  <div key={i} className={styles.conceptRow}>
                    <div className={styles.conceptNumber}>{i + 1}</div>
                    <div className={styles.conceptFields}>
                      <input
                        className={styles.conceptInput}
                        aria-label={`Concept ${i + 1}`}
                        placeholder="Key idea (e.g. &quot;Role of chlorophyll&quot;)"
                        value={c.concept}
                        onChange={(e) => updateConcept(i, "concept", e.target.value)}
                      />
                      <input
                        className={styles.conceptDesc}
                        aria-label={`Correct explanation for concept ${i + 1}`}
                        placeholder="What a correct explanation looks like (e.g. &quot;Chlorophyll absorbs light energy for the reaction&quot;)"
                        value={c.description}
                        onChange={(e) => updateConcept(i, "description", e.target.value)}
                      />
                      {c.sourceExcerpt && (
                        <div className={styles.sourceExcerpt}>from: &quot;{c.sourceExcerpt}&quot;</div>
                      )}
                    </div>
                    {concepts.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeConcept(i)}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addConceptBtn} onClick={addConcept}>
                  + Add another
                </button>
              </div>

              <button className={styles.submitBtn} type="submit" disabled={loading || generating}>
                {loading ? "Creating..." : "Add Topic"}
              </button>
            </fieldset></form>
          </GlassCard>
        )}

        {/* ── Step 3: Invite Student ──────────────────────────── */}
        {activeTab === "student" && (
          <GlassCard>
            {newAccountInfo && (
              <div className={styles.newAccountCard}>
                <div className={styles.newAccountHeader}>
                  <span>🎉</span>
                  <strong>{newAccountInfo.name}&apos;s account is ready</strong>
                </div>
                <p className={styles.newAccountHint}>
                  Share this temporary password privately so they can log in.
                </p>
                <div className={styles.newAccountPassword}>{newAccountInfo.password}</div>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={() => setNewAccountInfo(null)}
                >
                  Got it
                </button>
              </div>
            )}

            {confirmMismatch && (
              <div className={styles.mismatchCard}>
                <div className={styles.mismatchHeader}>
                  <span>⚠️</span>
                  <strong>That email already belongs to {confirmMismatch.existingName}</strong>
                </div>
                <p className={styles.mismatchHint}>
                  You typed &quot;{studentName}&quot;. If that&apos;s the same person, confirm below.
                  If not — two students can&apos;t share one email — use a different email instead.
                </p>
                <div className={styles.mismatchActions}>
                  <button type="button" className={styles.dismissBtn} onClick={handleConfirmMismatch} disabled={loading || generating}>
                    {loading ? "Enrolling..." : `Yes, that's ${confirmMismatch.existingName}`}
                  </button>
                  <button type="button" className={styles.mismatchCancelBtn} onClick={() => setConfirmMismatch(null)}>
                    No, use a different email
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddStudent}><fieldset disabled={loading} className={styles.form}>
              <h2 className={styles.formTitle}>Invite a Student</h2>
              <p className={styles.formHint}>
                Add a new student, or enroll one who already has a Shiksha account —
                just fill in their details below.
              </p>

              <div className={styles.field}>
                <label className={styles.label}>Class</label>
                <select id="setup-field-8"
                  className={styles.input}
                  value={studentClassId}
                  onChange={(e) => setStudentClassId(e.target.value)}
                  required
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="setup-field-9" className={styles.label}>Student&apos;s Name</label>
                <input id="setup-field-9"
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="setup-field-10" className={styles.label}>Student&apos;s Email</label>
                <input id="setup-field-10"
                  className={styles.input}
                  type="email"
                  placeholder="student@gmail.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="setup-field-11" className={styles.label}>
                  Temporary Password
                  <span className={styles.labelHint}>only used if they don&apos;t have an account yet</span>
                </label>
                <input id="setup-field-11"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  placeholder="e.g. sunshine42"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                />
              </div>

              <button className={styles.submitBtn} type="submit" disabled={loading || generating}>
                {loading ? "Enrolling..." : "Enroll Student"}
              </button>
            </fieldset></form>
          </GlassCard>
        )}

        {/* Existing Classes */}
        {classes.length > 0 && (
          <div className={styles.existingSection}>
            <h2 className={styles.sectionTitle}>Your Classes</h2>
            <div className={styles.classList}>
              {classes.map((c) => (
                <GlassCard key={c.id} interactive>
                  <Link href={`/teacher/setup?classId=${c.id}&tab=topic`} onClick={() => { setSelectedClassId(c.id); setStudentClassId(c.id); setActiveTab("topic"); }} className={styles.classItem}>
                    <span className={styles.classIcon}>▤</span>
                    <div>
                      <div className={styles.classItemName}>{c.name}</div>
                      <div className={styles.classItemMeta}>
                        {c.subject}{c.grade ? ` · Grade ${c.grade}` : ""}
                      </div>
                    </div>
                  </Link>
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
