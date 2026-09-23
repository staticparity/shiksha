'use client';

import { Dialog } from '@/components/ui/dialog';
import type { summarizeClass, Topic } from '@/lib/dashboard/summary';
import styles from './page.module.css';

type StudentSummary = ReturnType<typeof summarizeClass>['heatmap'][number];
export function StudentCheckIn({ student, topics, onClose }: {
  student: StudentSummary; topics: Topic[]; onClose: () => void;
}) {
  return <Dialog labelledBy="check-in-title" className={styles.checkIn} onClose={onClose}>
    <div className={styles.checkInHeader}>
      <div><p className={styles.eyebrow}>STUDENT CHECK-IN</p><h2 id="check-in-title">{student.studentName}</h2></div>
      <button onClick={onClose} aria-label="Close student details">✕</button>
    </div>
    <p className={styles.checkInIntro}>Use these assessment findings to guide a conversation. Confirm the student’s reasoning before deciding what to revisit.</p>
    <div className={styles.detailTopics}>{topics.map(topic => {
      const score = student.topicScores[topic.id];
      const detail = student.topicDetails[topic.id];
      const unresolved = detail?.misconceptions.some(m => m.status !== 'corrected');
      return <section key={topic.id} className={styles.topicDetail} aria-label={topic.title}>
        <h3>{topic.title}</h3>
        <strong>{score === null ? 'Not assessed' : `${score}% mastery`}</strong>
        {detail?.endedAt && <p className={styles.attemptDate}>Latest attempt · {new Date(detail.endedAt).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}</p>}
        {!!detail?.gaps.length && <><h4>Gaps to revisit</h4><ul>{detail.gaps.map((gap, i) => <li key={i}>
          <b>{gap.concept}</b>{gap.severity && <span className={styles.severity} data-severity={gap.severity}>{gap.severity}</span>}
          {gap.explanation && <p>{gap.explanation}</p>}
        </li>)}</ul></>}
        {!!detail?.misconceptions.length && <><h4>Misconceptions identified</h4><ul>{detail.misconceptions.map((item, i) => <li key={i}>
          <span className={styles.misconceptionStatus} data-resolved={item.status === 'corrected'}>{item.status === 'corrected' ? 'Corrected in this attempt' : item.status === 'accepted' ? 'Agreed with a false claim' : 'Needs follow-up'}</span>
          <p>“{item.concept}”</p>
        </li>)}</ul></>}
        {detail && !detail.gaps.length && !detail.misconceptions.length && <p>No specific gaps or misconceptions were recorded for this attempt.</p>}
        <div className={styles.nextStep}><h4>Conversation starter</h4><p>{!detail ? 'Invite a first explanation in their own words.'
          : unresolved ? 'Ask them to explain the flagged claim and test it against a concrete example. Revisit the correct idea together before trying again.'
          : detail.gaps.length ? `Ask them to explain “${detail.gaps[0].concept}” using an example, then describe why it works.`
          : score !== null && score < 40 ? 'Revisit the basics together and ask for a concrete example.'
          : score !== null && score < 70 ? 'Ask what happens, then why it happens.' : 'Try applying the idea in a new context.'}</p></div>
      </section>;
    })}</div>
  </Dialog>;
}
