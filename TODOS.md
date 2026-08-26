# TODOS

Deferred work captured during `/plan-ceo-review` (2026-08-08). Each item has a trigger
condition for when to act on it.

---

## Eng: PDF upload for AI-generated topic content

**What:** Support real PDF file upload (basic text extraction, not OCR) for
the "Generate from content" feature, in addition to plain-text paste.

**Why:** Surfaced during `/plan-eng-review` (2026-08-25) for
`docs/designs/ai-content-generation-from-uploads.md`. The tutor's actual
material is "a mix of own notes and textbook/PDF excerpts" — v1 ships
paste-only since copying text out of a PDF is low-friction compared to the
actual pain point (typing structured concept rows by hand), but the PDF
half of that mix is still a real, if smaller, friction point.

**Pros:** Closes the loop for the PDF half of the stated material mix;
removes a real (if small) manual step.

**Cons:** New dependency (a PDF-to-text library), new file-upload UI,
server-side extraction step — moves effort from S/M toward M.

**Context:** Deliberately deferred, not ruled out, to keep the v1 feature's
effort proportional to the actual stated pain (manual typing, not file
format). Distinct from the OCR/document-parsing pipeline that was correctly
ruled out entirely (see the design doc's landscape check) — this is just
basic text extraction from a well-formed PDF, a much smaller ask.

**Depends on / blocked by:** Real signal from the tutor's actual use of the
paste-only v1 — whether PDF copy-paste turns out to be an actual complaint
or a non-issue in practice.

**Trigger:** If the tutor reports PDF copy-paste as a real friction point
after using the paste-only version for real topics.

---

## Eng: No-email identity path for students without independent access

**What:** Design and build a way for a student without their own email (younger
students especially) to have a Shiksha identity — PIN/code-based login, or
similar — instead of requiring every student to have a distinct email address.

**Why:** The target user for the tutor-enrollment fix (see
`docs/designs/tutoring-class-enrollment.md`) explicitly includes "younger
students who may not have independent email access" (Premise 2) — but the
shipped mechanism still requires one distinct email per student. Surfaced by
an outside-voice cross-model review during `/plan-ceo-review` (2026-08-25):
the design doc already flagged this as an unresolved Open Question, not a
silently-missed gap, but it's still genuinely unresolved.

**Pros:** Actually serves the demographic the feature was framed around;
closes a real gap between stated target user and shipped mechanism.

**Cons:** A real identity-model rethink (not a small patch) — touches auth,
not just the enrollment form. Real risk of scope creep if picked up before
there's a confirmed need.

**Context:** The *dangerous* half of this gap (two students silently sharing
one identity if they share an email) is already fixed — `enrollStudent()` now
detects a name mismatch on an existing account and makes the tutor confirm
before proceeding, rather than silently merging. What's left unsolved is
narrower: a student with literally no email at all still has no path onto
the platform. Distinct from the TODO below it (email-invite vs.
tutor-set-password) — that one is about *mechanism* for students who DO have
an email; this one is about students who don't have one at all.

**Depends on / blocked by:** Real signal from this week's pilot on whether
the actual tutoring class has students in this situation.

**Trigger:** If the pilot tutor reports a student who genuinely has no email
to give.

---

## Eng: Force password change on first login for tutor-set-password accounts

**What:** When a tutor sets a student's initial password directly (see
`docs/designs/tutoring-class-enrollment.md`), force the student to change it
on their first login instead of leaving it optional indefinitely.

**Why:** Surfaced by an outside-voice cross-model review during
`/plan-ceo-review` (2026-08-25): today the tutor is a permanent password
custodian for what's often a minor's account — "they can change it
afterward" is optional, never enforced.

**Pros:** Meaningfully better data-handling posture for what's frequently a
minor's account; cheap once someone's already in this code.

**Cons:** Adds a forced first-login step — slightly more friction than
today's silent pass-through.

**Context:** Same area of the code as the email-invite-vs-tutor-set-password
TODO below — worth picking up together rather than as two separate passes
through the same enrollment flow.

**Depends on / blocked by:** Nothing — can happen independently.

**Trigger:** Next time the tutor-set-password mechanism gets revisited.

---

## Eng: Route-wide logging + fix plain-text 401/403 in chat/route.ts and topics/route.ts

**What:** Add structured logging to `create_class`, `create_topic`, and
`get_classes` in `src/app/api/teacher/route.ts` (only `add_student` got
logging in this pass). Also fix `chat/route.ts` and `topics/route.ts`, which
have the same `new Response("Unauthorized", { status: 401 })` plain-text bug
that `teacher/route.ts` had — a session-expiry mid-action crashes the
client's `res.json()` call and freezes the UI silently.

**Why:** Surfaced during `/plan-ceo-review` (2026-08-25) Sections 4 and 8
while fixing the identical issues in `teacher/route.ts`. Same root cause,
different files, not touched by this PR since they're unrelated to the
enrollment-friction feature.

**Pros:** Consistent debuggability across the whole API surface; no more
silently-frozen buttons anywhere in the app on session expiry.

**Cons:** Touches files with no other reason to change in this PR.

**Context:** The fix pattern is already proven — `Response.json({error},
{status})` instead of `new Response(text, {status})`, plus `console.error`
at real failure branches. Purely mechanical to replicate.

**Depends on / blocked by:** Nothing — can happen independently, any time.

**Trigger:** Next dedicated cross-cutting pass, or the next time either file
is touched for another reason.

---

## Eng: Let a tutor choose email-invite vs. tutor-set-password per student

**What:** The tutor-enrollment flow (see `docs/designs/tutoring-class-enrollment.md`)
defaults every new student to a tutor-set password (told to the student directly),
not Supabase's email-invite flow. Add the option to choose either per student.

**Why:** Surfaced by the outside-voice cross-model review during `/plan-eng-review`
(2026-08-25): tutor-set-password was picked because it avoids relying on a young
student checking email before their first login. But some tutors or students may
genuinely prefer email self-setup — no way to know without the real-world test.

**Context:** Deferred rather than built now specifically to keep this week's change
narrow. Revisit once the real tutoring class (see design doc's Assignment) has
actually used the tutor-set-password flow and there's a real signal either way.

**Depends on / blocked by:** Real usage signal from the enrollment-friction fix's
first test.

**Trigger:** After the real tutor test, if password-relay turns out to be its own
friction point (e.g. tutor forgets what they set, or a student loses it).

---

## Eng: Test coverage for the rest of /api/teacher

**What:** `create_class`, `create_topic`, and `get_classes` actions in
`src/app/api/teacher/route.ts` have zero test coverage. Only `add_student` (the
action modified by the tutor-enrollment work) gets tests committed as part of that
change.

**Why:** Surfaced during `/plan-eng-review` (2026-08-25) while scoping test coverage
for the `add_student` change — the gap in the other three actions pre-dates this
work and isn't a regression, but it's the same file getting more attention now.

**Context:** Deliberately not bundled into the tutor-enrollment PR — closing it
would expand that change well beyond the narrow wedge the design doc committed to.

**Depends on / blocked by:** Nothing — can happen independently, any time.

**Trigger:** Next dedicated test-coverage pass, or the next time any action in this
route file is touched for another reason.

---

## V2: Remediation pathway for diagnosed gaps

**What:** Design a repair-content pathway for what happens after a gap is diagnosed —
currently the plan only diagnoses (two-axis score + misconception status), it doesn't
prescribe a fix.

**Why:** Design Philosophy principle #7 (see design doc) calls this non-negotiable, and
it's the field's documented #1 unsolved gap — all three of the assessment framework's
source research reports flag it independently as the weakest-covered part of the whole
field. Shipping the diagnostic upgrade without at least a provisional remediation path
inherits that known weakness, and it's also v1's current limitation (it only shows a
score, no prescribed next step).

**Context:** Neither source PDF (`AI_Feynman_Worked_Examples.pdf`,
`Master_Conversational_Assessment_Framework_Examiner-Student.pdf`) nor this design
session validates an actual remediation protocol. The assessment framework's own gap
analysis states the best available idea — corrective activity plus retest — is "a
recommendation, not a validated pathway." Whoever picks this up should design against
*real* diagnosed gaps from the shipped two-axis build, not hypothetical ones.

**Depends on / blocked by:** The two-axis diagnostic build (design doc:
`~/.gstack/projects/Antigravity/adityajagadeesan-main-design-20260808-130101.md`)
shipping first — needs real diagnoses to design repair content against.

**Trigger:** After the two-axis build ships and produces its first batch of real
session diagnoses.

---

## V2: Real production deployment target

**What:** Decide and set up a real production deployment target for Shiksha. v1 has
never been confirmed deployed — the README documents local setup only.

**Why:** Any validation with testers outside the founder's own machine needs a live
URL. The design doc's Success Criteria depends on "real, unprompted" sessions, which
is hard to guarantee reliably on localhost (network setup, browser access, etc. for a
non-technical tester).

**Context:** Stack is Next.js 16 + Supabase, so Vercel is the natural fit given the
existing stack, but this hasn't been decided or actioned. Mostly account setup and env
var configuration, not new code.

**Depends on / blocked by:** Nothing — can happen in parallel with the two-axis code
build.

**Trigger:** Before recruiting any tester who isn't sitting at the founder's own
laptop.

---

## ~~V2: Split error handling in /api/mastery by failure type~~ — DONE (2026-08-09)

`route.ts`'s catch block now branches on `NoObjectGeneratedError` (invalid Wisdom
Agent schema output → 502), `APICallError` (OpenAI down/rate-limited → 503, message
varies by `isRetryable`), and a genuinely unexpected fallback (→ 500) — each with
its own log line and student-facing message. Also fixed a real latent bug found
while doing this: the post-scoring `sessions` update never checked its `{ error }`
return (Supabase doesn't throw), so a failed write would silently leave the session
stuck in `"scoring"` status forever with the student never told. Now checked
explicitly, reverts to `"active"` so Finish & Score can be retried, and returns a
distinct "Could not save your score" message (500).

6 new tests in `route.test.ts` (previously no test file existed for this route at
all) cover all 4 branches plus the happy path, using real `ai` SDK error classes
(`NoObjectGeneratedError`, `APICallError`), not stand-ins. 93/96 tests passing,
clean build.

---

## V2: Class-wide misconception alerts for teacher dashboard

**What:** `src/app/api/dashboard/route.ts` already computes class-wide gap alerts
(40% threshold) for teachers. Once T3 ships real misconception-status data, build the
analogous aggregation — e.g. "40% of the class holds the Lamarckian misconception on
Natural Selection."

**Why:** Surfaced by the eng-review outside-voice pass: this fell through the crack
between T3 (student-facing results screen only) and T4 (routing/remediation) — not
built by either, not explicitly deferred until now. Teachers already get an analogous
signal for coverage gaps; misconception status without the same surfacing is an
inconsistent teacher experience.

**Context:** Depends on T3 shipping and misconception_status being an array (per the
schema revision below), since a class-wide alert needs to count occurrences of the
*same* misconception across students' sessions, not just "had a misconception: y/n."

**Depends on / blocked by:** T3 (schema) shipping first.

**Trigger:** After T3 ships and has real misconception data to aggregate against.

**Note:** the eng review also surfaced that no generated Supabase types exist
anywhere in this codebase (every consumer hand-types its own interface, some with
`as any` casts) — the systemic fix for that was chosen to happen *now*, folded into
T3's build rather than deferred here. See this session's Implementation Tasks.

---

## ~~Design: Restrict the signature gradient to one moment, app-wide~~ — DONE (2026-08-09)

All 11 decorative `--accent-gradient` usages (Button's primary variant, sidebar
avatar, student-header logo/avatar, chat send button, progress-bar fill, error/404
pages, teacher setup/dashboard) flattened to solid `--accent-primary`, with a
`--accent-primary-deep` hover added on Button to replace the gradient's implicit
depth cue. The gradient now lives in exactly one place: `.gradient-text` on the
landing page's tagline ("The AI that *refuses to teach*") — the app's single
identity statement. The results screen's axis-fill bars use their own separate
meaningful-gradient tokens (`--axis-understanding`/`--axis-explanation`) and were
untouched, since those already encode real data, not decoration.

Also fixed a stale hardcoded teal `rgba(51, 190, 204, ...)` border on the landing
page's hero badge (a pre-Pip leftover that never got migrated to the rust/bamboo
palette) and removed the now-dead `--accent-gradient-subtle` token. See DESIGN.md
Decisions Log (2026-08-09). Clean build (13/13 routes), 93/96 tests passing
(unchanged from before this change).

---

## Design: Implement the Pip character

**Status (2026-08-09): mostly done, signals checklist now real.**
`components/pip/pip-avatar.tsx` (breathing disc, speech bubble wired to the real
Learner Agent's streamed messages, typing state, mood emoji) and
`components/pip/ambient-leaves.tsx` (drifting leaves, client-only to avoid SSR
hydration mismatch) are built and integrated into `ChatContainer` — replaced the
old always-visible scrolling message log with Pip's actual interaction model
(one bubble at a time, full history behind a "☰ Transcript" toggle). Build
clean, 98/101 tests passing.

**The "signals" checklist is done, for real** (2026-08-09): `EvalResultSchema`
in `lib/agents/evaluator.ts` now has a `signals` field (definition/example/
mechanism/cause/connection booleans), judged by the LLM per-turn on the
student's latest message in isolation — not the prototype's client-side regex,
which was deliberately ruled out. `/api/chat` sends the per-turn read as an
`X-Pip-Signals` response header (the plain text-stream protocol this transport
uses has no data-part channel, so a header — read via a custom `fetch` passed
to `TextStreamChatTransport` — was the minimal-plumbing option over switching
the whole chat pipeline to the UI-message-stream protocol). `ChatContainer`
OR-merges each turn's read into cumulative session state (a signal true once
stays true) and passes it to `PipAvatar`, which renders it as a live chip row
below the character.

**What's left:**
- **Real Pip illustration.** Still the bear-cub placeholder ("PIP · ART COMING")
  from the prototype — actual art was never blocking-verified as existing
  anywhere, including in the prototype itself. No image-generation tool is
  available in this environment to produce it.
- **Mood beyond typing/idle.** Currently only toggles curious↔think. The
  signals now landed are a natural real trigger for this (e.g. "happy" once
  most signals are lit) — no longer blocked on a schema decision, just needs
  doing.

**Depends on / blocked by:** real art depends on someone producing actual
illustration assets (outside this tool's capability); mood states are now
unblocked.

**Trigger:** Next dedicated UI implementation pass.
