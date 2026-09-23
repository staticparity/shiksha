# Shiksha code assessment — 24 September 2026

The existing Next.js 16.2.2 / React 19 / TypeScript stack is a reasonable fit for this app. Supabase handles authentication and Postgres authorization; AI SDK 6 handles model calls and streaming. CSS Modules and the existing test tools are sufficient for the current interface. The concrete problems found in this pass concern state recovery, progress accuracy, accessibility and query behavior; a framework rewrite would not address them.

The adjacent Shiksha V2 folder is a standalone interface prototype and supporting PDFs, not a second integrated application. Its additional input modes should be treated as proposed features until their storage, evaluation and accessibility behavior are implemented.

## Findings addressed in this pass

| Finding | Result |
| --- | --- |
| Reloading a lesson discarded the visible conversation and teaching signals. | The latest unfinished session restores its saved transcript, start time and confirmed signals. Older unfinished sessions do not override a newer completed attempt. |
| Failed or interrupted turns had no reliable recovery path. | Sending and scoring pause until the student restores server state. Recovery preserves an unsaved draft and recognizes a turn already committed by the server. |
| Progress cards labeled an older best score as the latest result. | Latest result and personal best are separate; timestamp comparisons account for time zones. |
| Student topic loading made a session query for each topic. | A shared paginated progress loader replaces per-topic requests in the dashboard and topics API. |
| Auth callbacks concatenated an unvalidated return path into a URL. | Only same-origin paths pass redirect validation. |
| Lesson overlays lacked modal focus behavior and Escape handling. | Native dialogs make the background inert, handle Escape and return focus to the trigger. |
| Enter could send while an IME composition was active. | Composition Enter no longer submits a reply. |
| Pip's entrance animation moved its speech bubble partly off the mobile screen. | The animation preserves horizontal position; long words wrap. |

The existing teacher workspace changes remain in place: class switching, searchable and filtered student progress, pagination, individual check-ins, and contextual setup links. Browser regressions cover those workflows alongside student lesson recovery.

## Validation and remaining work

Unit tests cover session ownership and response validation, redirect validation, progress ordering/pagination, restored messages, and the existing server scoring and authorization behavior. Isolated browser tests cover teacher workflows, lesson recovery, mobile layout, progress labels, dialog focus and IME input. Production build and lint are also checked.

Latest local results: `pnpm test` — 171 passed, 3 skipped; `pnpm test:e2e:teacher` — 11 passed; `pnpm lint` and `pnpm build` — passed.

The browser fixture simulates Auth and database responses; it does not prove hosted Supabase configuration or live model behavior. Existing SQL authorization checks use an in-memory PostgreSQL engine. Before rollout, apply migration `006_authoritative_assessments.sql` to the target database and verify the full signup → enrollment → lesson → score flow there. This work has not deployed that migration or called paid models. Historical privileged school memberships still need review, as described in the README.

The current recovery flow reconciles saved state but does not guarantee exactly-once delivery across concurrent browser tabs or a request that is still finishing while recovery runs. A durable client turn ID with a unique server constraint is the next improvement if cross-tab delivery guarantees are required. Live pedagogical evaluations also remain necessary: tests with mocked models cannot establish score quality or prevent every instance of answer leakage.

## Teacher follow-up improvements

- Student check-ins now open in a native dialog with saved gap explanations, severity, misconception status, attempt date and a conversation starter. Corrected findings remain visible as progress, while active and accepted misconceptions prompt follow-up even at high scores.
- Class alerts filter the roster to affected students and move keyboard focus to the learning table. Clearing a focus or changing class restores the appropriate roster. Refresh resets pagination so shrinking results do not leave an empty later page.
- Gap and misconception aggregation is scoped to each topic, counts each student once, excludes removed students and older attempts, and uses the assessed population for its explicit denominator. The 40% threshold is checked before rounding. Concepts group by trimmed, case-insensitive exact text; differently worded diagnoses are not assumed equivalent.
- Latest-attempt comparisons now use actual timestamps, with a deterministic session-ID tie break. This also corrects last-activity calculations across different UTC offsets.
- The dashboard response is marked private and non-cacheable. The endpoint still verifies class ownership and uses the authenticated database client. No new model calls or database migration are required for these dashboard additions.
