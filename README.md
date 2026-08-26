# 🎓 Shiksha — The AI That Refuses to Teach

> Students explain. AI questions. Understanding gets measured.

Shiksha is a dual-agent pedagogy engine that transforms passive learning into active understanding using the **Feynman Method**. Students teach concepts to an AI that genuinely knows nothing — then a separate AI evaluates mastery against ground truth.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Student types   │────▶│  LEARNER AGENT   │────▶│  Streaming     │
│  explanation     │     │  (gpt-4o-mini)   │     │  response      │
│                  │     │  ZERO knowledge  │     │                │
└─────────────────┘     └──────────────────┘     └────────────────┘
                               │
                               │ Transcript
                               ▼
                        ┌──────────────────┐     ┌────────────────┐
                        │  WISDOM AGENT    │────▶│  Structured    │
                        │  (gpt-4o)        │     │  mastery score │
                        │  HAS knowledge   │     │  + gap report  │
                        └──────────────────┘     └────────────────┘
```

### Why Two Agents?

- **Learner Agent** (student-facing): Knows NOTHING about the topic. Only receives the title. Cannot leak answers even under prompt injection — the knowledge structurally doesn't exist in its context.
- **Wisdom Agent** (backend-only): Has the full knowledge base. Evaluates the transcript for coverage, accuracy, depth, and clarity. Detects recitation vs genuine understanding.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | Supabase (Postgres + RLS) |
| AI | Vercel AI SDK v6, OpenAI GPT-4o/4o-mini |
| Styling | Vanilla CSS Modules (glassmorphic design system) |
| Testing | Vitest (unit), Playwright (e2e) |

---

## Local Setup (Step by Step)

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **pnpm 9+** — `npm i -g pnpm` (or use npm/yarn)
- **Supabase project** — free at [supabase.com](https://supabase.com)
- **OpenAI API key** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 1. Clone & Install

```bash
git clone https://github.com/staticparity/shiksha.git
cd shiksha
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual keys:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### 3. Database Setup

Run the SQL migrations against your Supabase project. Go to **Supabase Dashboard → SQL Editor** and run these files in order:

1. `supabase/migrations/001_initial_schema.sql` — tables, trigger, RPC functions
2. `supabase/migrations/002_rls_policies.sql` — Row-Level Security policies
3. `supabase/migrations/003_two_axis_scoring.sql` — understanding_band/explanation_band/misconceptions columns (two-axis diagnostic scoring)
4. `supabase/migrations/004_table_grants.sql` — explicit table GRANTs (required on local/some hosted setups or PostgREST returns 42501) plus the `find_student_by_email`/`increment_session_tokens` helper RPCs
5. `supabase/migrations/005_admin_provisioned_school_assignment.sql` — lets a tutor-created student account carry an explicit `school_id`, bypassing `handle_new_user()`'s email-domain-matching fallback (see `docs/designs/tutoring-class-enrollment.md`)

Or if you have the Supabase CLI linked:

```bash
npx supabase db push
```

### 4. Supabase Auth Config

In your Supabase Dashboard → Authentication → Settings:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: Add `http://localhost:3000/callback`
- Disable email confirmation for local dev (optional): Authentication → Providers → Email → turn off "Confirm email"

### 5. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. First-Time Setup

1. **Sign up as Teacher** at `/signup` → select "📊 Teacher"
2. You'll be redirected to `/teacher/dashboard` → click "Manage" in the sidebar
3. **Create a class** (e.g., "8-B Biology" / "Biology" / grade "8")
4. **Add a topic** (e.g., "Photosynthesis") with key concepts the AI will grade against
5. **Add a student** on the teacher Manage page's "Invite a Student" tab — either
   enter a Name + Email + Temporary Password to create a brand-new account
   directly (no self-signup needed — tell the student their email + password
   to log in with), or enter the email of a student who already self-signed-up
   (in a different browser/incognito, select "📘 Student" at `/signup`) to
   enroll their existing account
6. Student logs in → sees the topic on their dashboard → clicks to start teaching

### 7. Verify Everything Works

```bash
# Unit tests
pnpm test

# Build check
pnpm build
```

---

## Production Deployment

The app has never had a confirmed live deployment — this is the checklist for the
first one (Vercel + a fresh Supabase project; the app is stack-agnostic on hosting,
but Vercel is the natural fit for Next.js).

### 1. New Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine to
   start).
2. **Supabase Dashboard → SQL Editor**, run in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_two_axis_scoring.sql`
   - `supabase/migrations/004_table_grants.sql`
   - `supabase/migrations/005_admin_provisioned_school_assignment.sql`
3. Optionally run `supabase/seed.sql` if you want sample data instead of creating a
   class/topic by hand.
4. Note the **Project URL** and **anon public key** from Settings → API — you'll need
   both for Vercel's env vars.

### 2. Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import `staticparity/shiksha` from
   GitHub (grant Vercel repo access if this is the first import).
2. Framework preset auto-detects as Next.js — no changes needed.
3. Add environment variables (Project Settings → Environment Variables, or during
   import): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `OPENAI_API_KEY` — same three as `.env.local`, values from the new Supabase
   project (step 1) and your OpenAI account. Never commit these — `.env.local` and
   `.env.example` with real values are both gitignored/reverted for a reason.
4. Deploy. Vercel builds with `pnpm` automatically (detected from `pnpm-lock.yaml`).

### 3. Point Supabase Auth at the real URL

Chicken-and-egg: you only get the production URL after the first deploy. Once you
have it, go back to **Supabase Dashboard → Authentication → Settings** and update:

- **Site URL**: `https://your-app.vercel.app` (or your custom domain)
- **Redirect URLs**: add `https://your-app.vercel.app/callback`

Auth won't work correctly against the deployed app until this step is done — signup
and login will redirect back to `localhost`.

### 4. Verify

Repeat [step 6, First-Time Setup](#6-first-time-setup) against the production URL
instead of localhost — sign up as both a teacher and a student, enroll, run a full
teach-back session, and confirm a mastery score comes back.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup, callback
│   ├── (student)/        # Student dashboard, teach, results
│   │   ├── dashboard/
│   │   ├── teach/[topicId]/
│   │   └── results/[sessionId]/
│   ├── teacher/          # Teacher dashboard + setup
│   │   ├── dashboard/
│   │   └── setup/
│   ├── api/
│   │   ├── chat/         # Learner Agent streaming
│   │   ├── mastery/      # Wisdom Agent scoring
│   │   ├── teacher/      # Class/topic/enrollment CRUD
│   │   ├── topics/       # Student topic listing
│   │   └── dashboard/    # Teacher analytics
│   └── page.tsx          # Landing page
├── components/
│   ├── chat/             # Chat interface
│   ├── layout/           # Student header, teacher sidebar
│   └── ui/               # Design system (Button, GlassCard, etc.)
├── lib/
│   ├── agents/           # LLM prompt engineering
│   │   ├── learner.ts    # Zero-knowledge Socratic agent
│   │   ├── evaluator.ts  # Inter-turn understanding scorer
│   │   └── wisdom.ts     # Final mastery evaluator
│   ├── scoring/          # Mastery calculator, credits, streaks
│   ├── supabase/         # Client/server/proxy helpers
│   └── utils/            # Formatting, classnames
└── proxy.ts              # Auth guard + role routing (was middleware.ts)
```

## Mastery Scoring

| Score | Level | Credits | Color |
|-------|-------|---------|-------|
| 90-100 | Expert | 3 | 🟢 Green |
| 70-89 | Proficient | 2 | 🟢 Teal |
| 40-69 | Developing | 1 | 🟡 Amber |
| 0-39 | Beginning | 0 | 🔴 Red |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `AuthApiError: Invalid Refresh Token` | Clear browser cookies for localhost, or use incognito |
| Port 3000 in use | `lsof -ti :3000 \| xargs kill -9` then `pnpm dev` |
| `middleware` deprecation warning | Already fixed — using `proxy.ts` (Next.js 16 convention) |
| Student not found when enrolling | Student must sign up first, and both must be in the same school (same email domain matches automatically) |

## License

MIT

---

Built with 🇮🇳 by the Shiksha team. *Because understanding is not optional.*
