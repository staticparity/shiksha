# Design System — Shiksha

## Product Context
- **What this is:** An AI teach-back tutoring app (Feynman method) — students explain
  a concept to a zero-knowledge companion AI ("Pip") and get diagnosed on Understanding
  and Explanation as separate axes, plus misconception status, instead of one collapsed
  mastery score.
- **Who it's for:** Students and teachers in India, multi-tenant (schools/classes).
- **Space/industry:** AI-powered education / edtech.
- **Project type:** Light-mode-first, illustrated companion-character web app (Next.js).
- **Memorable thing:** "It actually knows if I understood it — and it's honest about it,
  warmly." Pip's own copy says this best: *"Pip never tells you the answer — that's
  the whole point."* Warmth is in the delivery; honesty is in the mechanism. Those are
  not in tension.

## Aesthetic Direction
- **Direction:** Organic/Natural, blended with Playful/Toy-like — a living companion
  character (Pip) the student teaches, not a dashboard the student reads.
- **Decoration level:** Expressive — ambient drifting leaves, a breathing character,
  mood micro-interactions, hand-warm illustration rather than flat UI chrome.
- **Mood:** Warm, curious, unhurried, a little literary. Pip is genuinely delighted to
  be taught, and genuinely won't pretend to understand something it doesn't.
- **Reference:** `Shiksha V2/Shiksha Session from WhatsApp.html` — a complete, working
  prototype and now the primary source of truth for this direction, not a mood board.

**Superseded reasoning (kept for the record, see Decisions Log):** an earlier pass of
this document argued for a restrained, dark, no-mascot direction, reasoning that a
cute/gamified visual language would undercut Shiksha's "won't let a wrong answer
slide" mechanism (using Khanmigo as the cautionary contrast). The Pip prototype proves
that reasoning drew too tight a link between *warmth* and *dishonesty* — Pip is warm
in delivery and still uncompromising in the scorecard ("Still thin: a clear
definition, a concrete example..." stated plainly, no softening). The mechanism, not
the mascot, is what carries the honesty. This document now follows the prototype.

## Typography
- **Voice/Display:** Fraunces (serif, variable optical size 9..144) — Pip's dialogue,
  headlines, and the scorecard title. Carries the storytelling register.
- **UI/Body:** Nunito Sans (weights 600–900) — buttons, labels, body text, score
  numbers. Rounded and warm, not neutral-clinical.
- **Data/Scores:** No separate monospace treatment — this reverses the prior pass's
  "JetBrains Mono for measurements" idea. The prototype never uses a mono font
  anywhere, including for score numbers (`.axis .lab b` is Nunito Sans, bold). A
  distinct "measurement font" fought the warmth; drop it.
- **Loading:** Google Fonts —
  `family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Nunito+Sans:wght@600;700;800;900`.
- **Scale:** Inherits v1's existing `--text-*` scale — unchanged.

## Color
- **Approach:** Balanced-to-expressive — two axis colors (not four generic tiers),
  each with real meaning: rust for Understanding, bamboo for Explanation.
- **Ink (primary text):** `#4A3527` (warm dark brown, not black).
- **Rust (Understanding axis / primary accent):** `#C0562A`, deep `#9E4420`.
- **Bamboo (Explanation axis / secondary accent):** `#6E9A4F`, deep `#527A38`.
- **Gold (tertiary / highlight):** `#E5A22B` — quote callouts, gradient endpoints.
- **Background:** Light, warm radial gradient — `#FEF8ED → #FBEFD8 → #EBD3A8 →
  #D8B884` (parchment, not dark near-black). **This reverses the prior pass's
  dark-mode-default decision.** The 2026 research that justified dark-mode-default
  was about data-dense dashboards in general; it didn't account for a product whose
  primary screen is a conversation with a character, where the earlier khanmigo.ai
  contrast research actually argued the opposite direction for warmth.
- **Surfaces:** `#FFFCF5` (cream) cards, `#F0DBB4` / `#EAD9BC` warm borders.
- **Axis fill (data visualization):** the 4-band categorical value already stored in
  the schema (`secure`/`partial`/`prompt_dependent`/`unresolved`, see `wisdom.ts`)
  renders as a **4-segment fill bar** (adapted from the prototype's native 5-dot
  scale to match the real 4-band data model — do not change the schema to fit the
  prototype's 1-5 scale, adapt the visual instead): rust→gold gradient fill for
  Understanding, bamboo gradient fill for Explanation. `secure` = all 4 segments
  filled, `unresolved` = 1 segment filled.
- **Dark mode:** Not primary. If ever added, it's a genuine alternate, not the
  product's identity — the identity is the parchment/character world.

## Spacing
- **Base unit:** 4px, unchanged from v1.
- **Density:** Comfortable, centered/conversational rather than dense-dashboard —
  the teach-back and scorecard screens are single-focus, generously spaced around
  Pip and the message bubble.

## Layout
- **Approach:** Hybrid. Student-facing moments (teach-back, results/scorecard) are
  conversational and centered — a character and a bubble, not a grid. Teacher-facing
  data views (dashboard, class roster) stay grid-disciplined — a roster table
  genuinely needs alignment and scan-ability regardless of the aesthetic skin: apply
  Pip's color/type/warmth there, not the floating-character layout.
- **Border radius:** Generously rounded — cards ~24px, buttons/chips ~12-14px,
  message bubbles ~22px. Softer than v1's `--radius-md: 10px` default; update the
  radius scale to match Pip's rounder language where it's user-facing.

## Motion
- **Approach:** Expressive. **This reverses the prior pass's "intentional, not
  expressive" rule.** Ambient drifting leaf particles in the background, a subtly
  breathing character (4.6s ease-in-out loop), a speech bubble that enters with a
  spring bounce then gently sways, a typing indicator, and mood-emoji "bump" pulses
  on state change. This is deliberate personality, not decoration for its own sake —
  it's what makes Pip read as alive rather than as a chatbot.
- **What stays restrained:** the scorecard itself. No confetti, no point animations,
  no leaderboard framing on the actual diagnosis — "Still thin: ..." is stated
  plainly. Expressiveness lives in Pip's presence, not in how the honest parts of the
  product are delivered.

## Implementation Status
- **Tokens applied (2026-08-08):** `globals.css` background/color/font variables,
  `mastery-ring.module.css`, results screen (`page.module.css`, `client.tsx`) —
  see Decisions Log.
- **Pip character (2026-08-09):** breathing avatar, speech bubble, drifting-leaf
  ambient system, and the live "signals" checklist are all built and wired to
  real data (see TODOS.md "Implement the Pip character"). Still open: real
  illustration art (still the bear-cub placeholder) and additional mood states.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-08 (early) | Initial design system: dark, restrained, no mascot | Evolved v1's existing dark/glassmorphic system; validated by 2026 dashboard-design research and a Khanmigo-vs-Linear contrast. Superseded same day, see below. |
| 2026-08-08 (later) | Replaced with Pip's warm/illustrated/organic direction | A complete, working prototype (`Shiksha Session from WhatsApp.html`) surfaced after the first pass shipped — real design work outranks a research-derived hypothesis once it exists. The prototype independently arrived at the same two-axis diagnostic idea with an unflinching scorecard, proving warmth and honesty aren't actually in tension — the earlier reasoning conflated "not cute" with "not dishonest." Typography, color, motion, and dark-mode-default all reversed; the 4-band schema (already built in T3) was kept and adapted to the prototype's visual language rather than changed to match its native 1-5 scale. |
| 2026-08-09 | Signals checklist built as a real Evaluator-driven feature, not the prototype's client-side regex | The prototype's `scan()` function flips 5 booleans (definition/example/how/why/connection) via regex against the student's raw text — explicitly ruled out as a port target earlier. The real version has the Evaluator Agent (already running once per turn) judge the same 5 signals via `generateObject`, sent to the client via a response header and OR-merged into cumulative session state. Rendered as a chip row below Pip using `--accent-secondary` (bamboo) for the "on" state, matching the Explanation axis' color identity from the results screen. |
| 2026-08-09 | Restricted `--accent-gradient` to one moment: `.gradient-text` on the landing-page tagline ("The AI that *refuses to teach*") | Was used decoratively as background-fill across 11 files (Button's primary variant, sidebar/header avatars, chat send button, progress bar, error/404 pages, teacher forms) — wallpaper, not meaning. Flattened all of those to solid `--accent-primary` (with a `--accent-primary-deep` hover state on Button, replacing the gradient's implicit depth cue). The tagline is the one place in the app that states the product's identity in a single sentence — kept as the sole gradient moment. The axis-fill bars on the results screen (`--axis-understanding` / `--axis-explanation`) already had their own dedicated meaningful-gradient tokens and were untouched. Also fixed a stale hardcoded teal `rgba(51, 190, 204, ...)` border color on the landing page's hero badge — a leftover from the pre-Pip dark palette that never got migrated — and removed the now-unused `--accent-gradient-subtle` token. |
