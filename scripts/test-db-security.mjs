// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js
// or install @electric-sql/pglite in a temporary prefix. No hosted DB is touched.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function role(name, id, fn) {
  await db.exec(`SET ROLE ${name}`);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}
async function denied(sql, values = []) { await assert.rejects(db.query(sql, values)); }
const teacher = '00000000-0000-4000-8000-000000000001';
const student = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const classId = '00000000-0000-4000-8000-000000000004';
const topic = '00000000-0000-4000-8000-000000000005';
const session = '00000000-0000-4000-8000-000000000006';
const lease = '00000000-0000-4000-8000-000000000007';
const otherLease = '00000000-0000-4000-8000-000000000008';
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', raw_app_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;`);
  for (const file of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES ($1,'teacher@example.com','{\"role\":\"teacher\"}',now())", [teacher]);
  const school = (await db.query('SELECT school_id FROM school_members WHERE user_id=$1', [teacher])).rows[0].school_id;
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3,now())', [outsider, 'attacker@example.com', { role: 'admin', school_id: school }]);
  await check('editable signup metadata cannot join a school or request admin', async () => {
    assert.equal((await db.query('SELECT * FROM school_members WHERE user_id=$1', [outsider])).rows.length, 0);
  });
  await db.query('INSERT INTO auth.users(id,email,raw_app_meta_data,email_confirmed_at) VALUES($1,$2,$3,now())', [student, 'student@example.com', { school_id: school }]);
  await db.query('INSERT INTO classes(id, school_id, teacher_id, name, subject) VALUES($1,$2,$3,$4,$5)', [classId, school, teacher, 'Biology', 'Science']);
  await role('authenticated', teacher, () => db.query('SELECT enroll_verified_student($1,$2)', [classId, student]));
  await db.query('INSERT INTO topics(id,class_id,title,subject,knowledge_base) VALUES($1,$2,$3,$4,$5)', [topic, classId, 'Plants', 'Science', { key_concepts: ['secret'] }]);
  await check('enrolled students can read topic titles but not answer keys', () => role('authenticated', student, async () => {
    assert.equal((await db.query('SELECT title FROM topics')).rows.length, 1);
    await denied('SELECT knowledge_base FROM topics');
    await denied('SELECT * FROM topics');
  }));
  await check('students can create only valid, unscored enrolled sessions', () => role('authenticated', student, async () => {
    await denied('INSERT INTO sessions(student_id,topic_id,class_id,school_id,mastery_score) VALUES($1,$2,$3,$4,100)', [student,topic,classId,school]);
    await denied("INSERT INTO sessions(student_id,topic_id,class_id,school_id,status) VALUES($1,$2,$3,$4,'completed')", [student,topic,classId,school]);
    const created = await db.query('INSERT INTO sessions(student_id,topic_id,class_id,school_id) VALUES($1,$2,$3,$4) RETURNING id', [student,topic,classId,school]);
    assert.equal(created.rows.length,1);
  }));
  await db.query('INSERT INTO sessions(id,student_id,topic_id,class_id,school_id) VALUES($1,$2,$3,$4,$5)', [session,student,topic,classId,school]);
  await check('students cannot forge transcripts, scores, credits or streaks', () => role('authenticated', student, async () => {
    await denied('UPDATE sessions SET mastery_score=100 WHERE id=$1', [session]);
    await denied("UPDATE sessions SET transcript='[]' WHERE id=$1", [session]);
    await denied('INSERT INTO mastery_credits(student_id,session_id,school_id,credits_earned) VALUES($1,$2,$3,100)', [student,session,school]);
    await denied('INSERT INTO streaks(student_id,school_id,current_streak) VALUES($1,$2,100)', [student,school]);
    await denied("SELECT append_to_transcript($1,'[]'::jsonb)", [session]);
    await denied('SELECT increment_session_tokens($1,100)', [session]);
    await denied('SELECT claim_session($1,$2,$3,false)', [session,student,lease]);
  }));
  await check('anonymous callers cannot invoke privileged RPCs', () => role('anon', null, async () => {
    await denied('SELECT find_student_by_email($1,$2)', ['student@example.com', school]);
    await denied('SELECT increment_session_tokens($1,100)', [session]);
    await denied('SELECT consume_ai_quota($1)', [student]);
  }));
  await check('unassigned users cannot access classes or self-enroll', () => role('authenticated', outsider, async () => {
    assert.equal((await db.query('SELECT id FROM classes')).rows.length,0);
    await denied('SELECT enroll_verified_student($1,$2)', [classId, outsider]);
    await denied('INSERT INTO sessions(student_id,topic_id,class_id,school_id) VALUES($1,$2,$3,$4)', [outsider,topic,classId,school]);
    await denied('INSERT INTO classes(school_id,teacher_id,name,subject) VALUES($1,$2,$3,$4)', [school,outsider,'Fake','Math']);
  }));
  await check('teacher can enroll a verified, previously unassigned student', () => role('authenticated', teacher, async () => {
    const found = await db.query('SELECT * FROM find_student_by_email($1,$2)', ['attacker@example.com', school]);
    assert.equal(found.rows[0].user_id, outsider);
    await db.query('SELECT enroll_verified_student($1,$2)', [classId, outsider]);
  }));
  await check('session lease prevents concurrent turns and foreign ownership', () => role('service_role', null, async () => {
    assert.equal((await db.query('SELECT * FROM claim_session($1,$2,$3,false)', [session,outsider,lease])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM claim_session($1,$2,$3,false)', [session,student,lease])).rows.length,1);
    assert.equal((await db.query('SELECT * FROM claim_session($1,$2,$3,true)', [session,student,otherLease])).rows.length,0);
    await db.query('SELECT release_session($1,$2)', [session,otherLease]);
    assert.equal((await db.query('SELECT request_id FROM sessions WHERE id=$1', [session])).rows[0].request_id, lease);
  }));
  await check('chat persists an array and usage once, then releases its lease', () => role('service_role', null, async () => {
    const args = [session,lease,[{ role:'student',content:'Light powers photosynthesis' },{ role:'learner',content:'How?' }],30];
    assert.equal((await db.query('SELECT complete_chat($1,$2,$3,$4) AS ok', args)).rows[0].ok,true);
    assert.equal((await db.query('SELECT complete_chat($1,$2,$3,$4) AS ok', args)).rows[0].ok,false);
    const row = (await db.query('SELECT transcript,message_count,total_tokens FROM sessions WHERE id=$1',[session])).rows[0];
    assert.equal(row.transcript.length,2); assert.equal(row.message_count,2); assert.equal(row.total_tokens,30);
  }));
  await check('failed scoring transactions leave no credits and can be retried', () => role('service_role', null, async () => {
    await db.query('SELECT * FROM claim_session($1,$2,$3,true)', [session,student,lease]);
    await denied('SELECT complete_mastery($1,$2,$3,30)', [session,lease,{masteryScore:999}]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM mastery_credits')).rows[0].n,0);
    await db.query('SELECT release_session($1,$2)',[session,lease]);
    assert.equal((await db.query('SELECT status FROM sessions WHERE id=$1',[session])).rows[0].status,'active');
  }));
  await check('score, credit and streak completion is atomic and idempotent', () => role('service_role', null, async () => {
    await db.query('SELECT * FROM claim_session($1,$2,$3,true)', [session,student,lease]);
    const result = {masteryScore:90,understandingBand:'secure',explanationBand:'secure',misconceptions:[],strengths:[],gaps:[],overallAssessment:'Good',recitationDetected:false,followUpQuality:'good'};
    const saved = (await db.query('SELECT complete_mastery($1,$2,$3,20) AS result',[session,lease,result])).rows[0].result;
    assert.equal(saved.creditsEarned,3); assert.equal(saved.currentStreak,1);
    await denied('SELECT complete_mastery($1,$2,$3,20)',[session,lease,result]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM mastery_credits WHERE session_id=$1',[session])).rows[0].n,1);
    assert.equal((await db.query('SELECT status FROM sessions WHERE id=$1',[session])).rows[0].status,'completed');
  }));
  await check('expired scoring leases can be reclaimed; stale completions cannot write', () => role('service_role', null, async () => {
    const active = (await db.query("SELECT id FROM sessions WHERE status='active' LIMIT 1")).rows[0].id;
    await db.query('SELECT * FROM claim_session($1,$2,$3,true)', [active,student,lease]);
    await db.query("UPDATE sessions SET lease_until=now()-interval '1 second' WHERE id=$1",[active]);
    assert.equal((await db.query('SELECT * FROM claim_session($1,$2,$3,true)',[active,student,otherLease])).rows.length,1);
    await denied("SELECT complete_mastery($1,$2,'{}',0)",[active,lease]);
    await db.query('SELECT release_session($1,$2)',[active,otherLease]);
  }));
  await check('per-account hourly quota is enforced', () => role('service_role', null, async () => {
    for(let i=0;i<120;i++) assert.equal((await db.query('SELECT consume_ai_quota($1) AS ok',[student])).rows[0].ok,true);
    assert.equal((await db.query('SELECT consume_ai_quota($1) AS ok',[student])).rows[0].ok,false);
  }));
  console.log(`${checks} database integration checks passed.`);
} finally { await db.close(); }
