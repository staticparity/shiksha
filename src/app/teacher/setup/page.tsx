"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import styles from "./page.module.css";

interface ClassData {
  id: string;
  name: string;
  subject: string;
  grade: string;
}

export default function TeacherSetupPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [activeTab, setActiveTab] = useState<"class" | "topic" | "student">("class");
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
  const [concepts, setConcepts] = useState([{ concept: "", description: "" }]);

  // Student form
  const [studentClassId, setStudentClassId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [newAccountInfo, setNewAccountInfo] = useState<{ name: string; password: string } | null>(null);
  const [confirmMismatch, setConfirmMismatch] = useState<{ existingName: string } | null>(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_classes" }),
    });
    if (res.ok) {
      const data = await res.json();
      setClasses(data);
      if (data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
        setStudentClassId(data[0].id);
      }
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Auto-advance after successful class creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_class",
        name: className,
        subject: classSubject,
        grade: classGrade,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      showMessage("success", `Class "${data.name}" created! Now add a topic.`);
      setClassName("");
      setClassSubject("");
      setClassGrade("");
      await loadClasses();
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

    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_topic",
        classId: selectedClassId,
        title: topicTitle,
        subject: selectedClass?.subject ?? "",
        chapter: topicChapter,
        knowledgeConcepts: concepts.filter((c) => c.concept.trim()),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      showMessage("success", `Topic "${data.title}" added! Add another or enroll students.`);
      setTopicTitle("");
      setTopicChapter("");
      setConcepts([{ concept: "", description: "" }]);
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
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_student",
        classId: studentClassId,
        studentName,
        studentEmail,
        studentPassword,
        confirmed,
      }),
    });
    const data = await res.json();
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
    updated[index][field] = value;
    setConcepts(updated);
  };

  const removeConcept = (index: number) => {
    if (concepts.length <= 1) return;
    setConcepts(concepts.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.pageTitle}>⚙️ Manage Class</h1>
        <p className={styles.pageSubtitle}>
          Set up your class in 3 steps: create a class, add what students should learn, then invite them.
        </p>

        {/* Message Toast */}
        {message && (
          <div className={`${styles.toast} ${message.type === "error" ? styles.toastError : styles.toastSuccess}`}>
            {message.text}
          </div>
        )}

        {/* Step Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "class" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("class")}
          >
            <span className={styles.tabStep}>1</span> Create Class
          </button>
          <button
            className={`${styles.tab} ${activeTab === "topic" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("topic")}
            disabled={classes.length === 0}
          >
            <span className={styles.tabStep}>2</span> Add Topics
          </button>
          <button
            className={`${styles.tab} ${activeTab === "student" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("student")}
            disabled={classes.length === 0}
          >
            <span className={styles.tabStep}>3</span> Invite Students
          </button>
        </div>

        {/* ── Step 1: Create Class ─────────────────────────────── */}
        {activeTab === "class" && (
          <GlassCard>
            <form onSubmit={handleCreateClass} className={styles.form}>
              <h2 className={styles.formTitle}>Create a Class</h2>
              <p className={styles.formHint}>
                A class groups your students and the topics you want them to learn.
              </p>
              <div className={styles.field}>
                <label className={styles.label}>Class Name</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 8-B Biology"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Subject</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Biology"
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Grade (optional)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 8"
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                  />
                </div>
              </div>
              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Class →"}
              </button>
            </form>
          </GlassCard>
        )}

        {/* ── Step 2: Add Topic ────────────────────────────────── */}
        {activeTab === "topic" && (
          <GlassCard>
            <form onSubmit={handleCreateTopic} className={styles.form}>
              <h2 className={styles.formTitle}>Add a Topic</h2>
              <p className={styles.formHint}>
                A topic is something students learn — like &quot;Photosynthesis&quot; or &quot;Quadratic Equations.&quot;
                Students will teach this topic back to the AI, and their understanding gets scored.
              </p>

              <div className={styles.field}>
                <label className={styles.label}>Class</label>
                <select
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
                  <label className={styles.label}>Topic Name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Photosynthesis"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Chapter (optional)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Chapter 7"
                    value={topicChapter}
                    onChange={(e) => setTopicChapter(e.target.value)}
                  />
                </div>
              </div>

              {/* Key Things to Know */}
              <div className={styles.conceptsSection}>
                <label className={styles.label}>
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
                        placeholder="Key idea (e.g. &quot;Role of chlorophyll&quot;)"
                        value={c.concept}
                        onChange={(e) => updateConcept(i, "concept", e.target.value)}
                      />
                      <input
                        className={styles.conceptDesc}
                        placeholder="What a correct explanation looks like (e.g. &quot;Chlorophyll absorbs light energy for the reaction&quot;)"
                        value={c.description}
                        onChange={(e) => updateConcept(i, "description", e.target.value)}
                      />
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

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? "Creating..." : "Add Topic"}
              </button>
            </form>
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
                  Give them this password to log in — they can change it afterward.
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
                  <button type="button" className={styles.dismissBtn} onClick={handleConfirmMismatch} disabled={loading}>
                    {loading ? "Enrolling..." : `Yes, that's ${confirmMismatch.existingName}`}
                  </button>
                  <button type="button" className={styles.mismatchCancelBtn} onClick={() => setConfirmMismatch(null)}>
                    No, use a different email
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddStudent} className={styles.form}>
              <h2 className={styles.formTitle}>Invite a Student</h2>
              <p className={styles.formHint}>
                Add a new student, or enroll one who already has a Shiksha account —
                just fill in their details below.
              </p>

              <div className={styles.field}>
                <label className={styles.label}>Class</label>
                <select
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
                <label className={styles.label}>Student&apos;s Name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Student&apos;s Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="student@gmail.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Temporary Password
                  <span className={styles.labelHint}>only used if they don&apos;t have an account yet</span>
                </label>
                <input
                  className={styles.input}
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. sunshine42"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                />
              </div>

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? "Enrolling..." : "Enroll Student"}
              </button>
            </form>
          </GlassCard>
        )}

        {/* Existing Classes */}
        {classes.length > 0 && (
          <div className={styles.existingSection}>
            <h2 className={styles.sectionTitle}>Your Classes</h2>
            <div className={styles.classList}>
              {classes.map((c) => (
                <GlassCard key={c.id} interactive>
                  <div className={styles.classItem}>
                    <span className={styles.classIcon}>📁</span>
                    <div>
                      <div className={styles.classItemName}>{c.name}</div>
                      <div className={styles.classItemMeta}>
                        {c.subject}{c.grade ? ` · Grade ${c.grade}` : ""}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
