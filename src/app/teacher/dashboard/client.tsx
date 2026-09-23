'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { summarizeClass, Topic } from '@/lib/dashboard/summary';
import styles from './page.module.css';
import { StudentCheckIn } from './student-check-in';

type ClassInfo = { id: string; name: string; subject: string; grade: string | null };
type DashboardData = ReturnType<typeof summarizeClass> & { classInfo: ClassInfo; topics: Topic[] };
const PAGE_SIZE = 15;
export function TeacherDashboardClient({ classes }: { classes: ClassInfo[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!classId);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!classId) return;
    const abort = new AbortController();
    fetch(`/api/dashboard?classId=${encodeURIComponent(classId)}`, { signal: abort.signal })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Could not load your class.'); return body; })
      .then(body => { if (!abort.signal.aborted) { setData(body); setError(''); setLoading(false); } })
      .catch(e => { if (!abort.signal.aborted) { setError(e.message); setLoading(false); } });
    return () => abort.abort();
  }, [classId, refresh]);
  const reload = () => { setLoading(true); setError(''); setPage(1); setSelectedStudent(null); setRefresh(v => v + 1); };
  const setup = (tab: string) => `/teacher/setup?tab=${tab}&classId=${encodeURIComponent(classId)}`;
  const focus = data?.alerts.find(a => a.id === focusId);
  const rows = (data?.heatmap ?? []).filter(s => (!focus || focus.studentIds.includes(s.studentId)) && s.studentName.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === 'all' || (filter === 'support' ? s.needsSupport : s.avgMastery === null)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const student = data?.heatmap.find(s => s.studentId === selectedStudent);
  const overview = data?.overview;
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>YOUR TEACHING WORKSPACE</p><h1>Small insights.<br /><em>Meaningful progress.</em></h1>
          <p className={styles.subtitle}>See where understanding is growing, and who could use a little help.</p></div>
        <Link href={setup('topic')} className={styles.primary}>+ Add a topic</Link>
      </header>
      {!classes.length ? (
        <section className={styles.welcome}>
          <span className={styles.emptyIcon}>✳</span><p className={styles.eyebrow}>A FRESH START</p><h2>Your classroom starts here.</h2>
          <p>Create a class, choose a topic, and invite your students. Their explanations will turn into a clearer picture of what they understand.</p>
          <div className={styles.steps}><span>01 · Create your class</span><span>02 · Add a learning topic</span><span>03 · Invite students</span></div>
          <Link className={styles.primary} href="/teacher/setup">Create your first class →</Link>
        </section>
      ) : <>
        <div className={styles.classBar}>
          <div className={styles.classPicker}><label htmlFor="class-picker">Class overview</label>
            <select id="class-picker" value={classId} onChange={e => { setClassId(e.target.value); setLoading(true); setError(''); setData(null); setPage(1); setSelectedStudent(null); setFocusId(null); setSearch(''); setFilter('all'); }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.subject}{c.grade ? ` · Grade ${c.grade}` : ''}</option>)}
            </select></div>
          <div className={styles.actions}><Link href={setup('student')}>Invite students ↗</Link><button onClick={reload} disabled={loading}>↻ Refresh</button></div>
        </div>
        {loading ? <div role="status" className={styles.loading}><div className={styles.skeleton} /><div className={styles.skeleton} /><p>Gathering your class progress…</p></div>
        : error ? <section className={styles.welcome} role="alert"><h2>We couldn’t load this class.</h2><p>{error}</p><button className={styles.primary} onClick={reload}>Try again</button></section>
        : data && <>
          <section className={styles.stats} aria-label="Class statistics">
            {[
              ['Students', overview!.studentCount, 'Enrolled in this class'],
              ['Average mastery', overview!.avgMastery === null ? '—' : `${overview!.avgMastery}%`, `${overview!.assessedStudents} students assessed · latest attempts`],
              ['Needs a check-in', overview!.needsSupport, 'Low score or unresolved misconception'],
              ['Active today', overview!.activeToday, 'Completed a session · India time'],
            ].map(([label, value, hint], i) => <div className={styles.stat} key={label} data-accent={i === 2}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
          </section>
          <div className={styles.workspace}>
            <section className={styles.panel}>
              <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>THE LEARNING PICTURE</p><h2 id="student-understanding" tabIndex={-1}>Student understanding</h2></div><span className={styles.count}>{data.topics.length} topics</span></div>
              <p className={styles.explainer}>Each score is the latest completed attempt. Select a student to plan their next step.</p>
              <div className={styles.toolbar}><input aria-label="Search students" placeholder="Search students…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                <select aria-label="Filter students" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">All students</option><option value="support">Needs a check-in</option><option value="unassessed">Not yet assessed</option></select></div>
              {focus && <div className={styles.activeFocus} role="status"><span>{focus.message}</span><button onClick={() => { setFocusId(null); setPage(1); }}>Clear focus</button></div>}
              <div className={styles.legend}><span>● 70–100% Proficient</span><span>● 40–69% Developing</span><span>● Below 40% Beginning</span><span>— Not attempted</span></div>
              {!data.heatmap.length ? <div className={styles.empty}><h3>Make room for your learners.</h3><p>Invite students to start seeing their progress here.</p><Link href={setup('student')}>Invite your first student →</Link></div>
              : !data.topics.length ? <div className={styles.empty}><h3>What will your class explain first?</h3><p>Add a topic and the key ideas you want students to understand.</p><Link href={setup('topic')}>Add your first topic →</Link></div>
              : <><div className={styles.tableWrap}><table className={styles.table}><caption className={styles.srOnly}>Latest student mastery scores by topic</caption><thead><tr><th scope="col">Student</th>{data.topics.map(t => <th scope="col" key={t.id}>{t.title}</th>)}<th scope="col">Average</th></tr></thead>
                <tbody>{rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(s => <tr key={s.studentId} data-selected={selectedStudent === s.studentId}>
                  <th scope="row"><button className={styles.studentButton} onClick={() => setSelectedStudent(s.studentId)} aria-haspopup="dialog"><span className={styles.avatar}>{s.studentName.split(' ').map(n => n[0]).slice(0,2).join('')}</span><span>{s.studentName}<small>{s.needsSupport ? 'Check-in suggested' : s.avgMastery === null ? 'Waiting for first attempt' : `${s.attemptedTopics} topics attempted`}</small></span></button></th>
                  {data.topics.map(t => { const score = s.topicScores[t.id]; return <td key={t.id}><span className={styles.score} data-band={score === null ? 'none' : score < 40 ? 'low' : score < 70 ? 'mid' : 'high'}>{score === null ? '—' : `${score}%`}</span></td>; })}<td className={styles.average}>{s.avgMastery === null ? '—' : `${s.avgMastery}%`}</td>
                </tr>)}</tbody></table></div>
                {!rows.length && <div className={styles.empty}>No students match this search or filter.</div>}
                <div className={styles.pagination}><span>{rows.length ? (currentPage-1)*PAGE_SIZE+1 : 0}–{Math.min(currentPage*PAGE_SIZE, rows.length)} of {rows.length} students</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">←</button><span>{currentPage} / {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">→</button></div></div></>}
            </section>
            <aside className={styles.rail}>
              <section className={styles.focusCard}><p className={styles.eyebrow}>WHERE TO FOCUS</p><h2>A little attention<br />goes a long way.</h2>
                {data.alerts.length ? <ul>{data.alerts.map(a => <li key={a.id} data-severity={a.severity}><span>{a.type === 'low_score' ? 'CHECK IN' : a.type === 'class_wide_gap' ? 'REVISIT TOGETHER' : a.type === 'misconception' ? 'CHECK A MISCONCEPTION' : 'RECONNECT'}</span><p>{a.message}</p><button onClick={() => {
                  setFocusId(a.id); setFilter('all'); setSearch(''); setPage(1);
                  document.getElementById('student-understanding')?.focus();
                }} aria-label={`Show students: ${a.concept ?? (a.type === 'inactive' ? 'No recent sessions' : 'Needs a check-in')}${a.topicId ? ` · ${data.topics.find(t => t.id === a.topicId)?.title}` : ''}`}>Show {a.studentIds.length} students →</button></li>)}</ul>
                : <p className={styles.focusEmpty}>{overview!.assessedStudents ? 'No check-ins flagged. Keep the conversations going.' : 'Once students complete a session, you’ll see suggested follow-ups here.'}</p>}
              </section>
              <section className={styles.note}><span>✳</span><h3>Listen for the “why.”</h3><p>A score is a starting point. Ask students to explain their reasoning before deciding what to revisit.</p></section>
            </aside>
          </div>
          {student && <StudentCheckIn student={student} topics={data.topics} onClose={() => setSelectedStudent(null)} />}
        </>}
      </>}
    </div>
  );
}
