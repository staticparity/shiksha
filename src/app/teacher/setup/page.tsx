"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { createClient } from "@/lib/supabase/client";
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
  const [topicSubject, setTopicSubject] = useState("");
  const [topicChapter, setTopicChapter] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [concepts, setConcepts] = useState([{ concept: "", description: "" }]);

  // Student form
  const [studentClassId, setStudentClassId] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

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
      showMessage("success", `Class "${data.name}" created!`);
      setClassName("");
      setClassSubject("");
      setClassGrade("");
      loadClasses();
    } else {
      showMessage("error", data.error || "Failed to create class");
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_topic",
        classId: selectedClassId,
        title: topicTitle,
        subject: topicSubject,
        chapter: topicChapter,
        description: topicDescription,
        knowledgeConcepts: concepts.filter((c) => c.concept.trim()),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      showMessage("success", `Topic "${data.title}" created!`);
      setTopicTitle("");
      setTopicSubject("");
      setTopicChapter("");
      setTopicDescription("");
      setConcepts([{ concept: "", description: "" }]);
    } else {
      showMessage("error", data.error || "Failed to create topic");
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_student",
        classId: studentClassId,
        studentEmail,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      showMessage("success", `${data.studentName} enrolled!`);
      setStudentEmail("");
    } else {
      showMessage("error", data.error || "Failed to add student");
    }
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
          Create classes, add topics, and enroll students.
        </p>

        {/* Message Toast */}
        {message && (
          <div className={`${styles.toast} ${message.type === "error" ? styles.toastError : styles.toastSuccess}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "class" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("class")}
          >
            📁 New Class
          </button>
          <button
            className={`${styles.tab} ${activeTab === "topic" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("topic")}
            disabled={classes.length === 0}
          >
            📘 New Topic
          </button>
          <button
            className={`${styles.tab} ${activeTab === "student" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("student")}
            disabled={classes.length === 0}
          >
            👤 Add Student
          </button>
        </div>

        {/* Create Class */}
        {activeTab === "class" && (
          <GlassCard>
            <form onSubmit={handleCreateClass} className={styles.form}>
              <h2 className={styles.formTitle}>Create a New Class</h2>
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
                {loading ? "Creating..." : "Create Class"}
              </button>
            </form>
          </GlassCard>
        )}

        {/* Create Topic */}
        {activeTab === "topic" && (
          <GlassCard>
            <form onSubmit={handleCreateTopic} className={styles.form}>
              <h2 className={styles.formTitle}>Add a Topic</h2>
              <p className={styles.formHint}>
                The knowledge base concepts are what the Wisdom Agent uses to score students.
                Be specific — these are your answer key.
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
                  <label className={styles.label}>Topic Title</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Photosynthesis"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Subject</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Biology"
                    value={topicSubject}
                    onChange={(e) => setTopicSubject(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
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

              <div className={styles.field}>
                <label className={styles.label}>Description (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Brief context about what students should know..."
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Knowledge Base Concepts */}
              <div className={styles.conceptsSection}>
                <label className={styles.label}>
                  Knowledge Base — Key Concepts
                  <span className={styles.labelHint}>(the Wisdom Agent's answer key)</span>
                </label>
                {concepts.map((c, i) => (
                  <div key={i} className={styles.conceptRow}>
                    <input
                      className={styles.conceptInput}
                      placeholder="Concept name"
                      value={c.concept}
                      onChange={(e) => updateConcept(i, "concept", e.target.value)}
                    />
                    <input
                      className={styles.conceptDesc}
                      placeholder="What students should explain about this concept..."
                      value={c.description}
                      onChange={(e) => updateConcept(i, "description", e.target.value)}
                    />
                    {concepts.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeConcept(i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addConceptBtn} onClick={addConcept}>
                  + Add Concept
                </button>
              </div>

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Topic"}
              </button>
            </form>
          </GlassCard>
        )}

        {/* Add Student */}
        {activeTab === "student" && (
          <GlassCard>
            <form onSubmit={handleAddStudent} className={styles.form}>
              <h2 className={styles.formTitle}>Enroll a Student</h2>
              <p className={styles.formHint}>
                The student must have already signed up and been added to your school.
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
                <label className={styles.label}>Student Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="student@school.edu"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
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
