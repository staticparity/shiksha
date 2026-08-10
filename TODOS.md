# TODOS

Deferred work captured during `/plan-ceo-review` (2026-08-08). Each item has a trigger
condition for when to act on it.

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
