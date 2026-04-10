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

Or if you have the Supabase CLI linked:

```bash
npx supabase db push
```

**Important:** After running migrations, also create the helper RPCs by running this SQL:

```sql
-- Student email lookup (used by teacher enrollment)
CREATE OR REPLACE FUNCTION public.find_student_by_email(p_email TEXT, p_school_id UUID)
RETURNS TABLE(user_id UUID, full_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, p.full_name
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  JOIN school_members sm ON sm.user_id = au.id
  WHERE au.email = p_email
    AND sm.school_id = p_school_id
    AND sm.role = 'student'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Token tracking (used by chat API)
CREATE OR REPLACE FUNCTION public.increment_session_tokens(p_session_id UUID, p_tokens INT)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET total_tokens = COALESCE(total_tokens, 0) + p_tokens
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
5. **Sign up a student** in a different browser/incognito → select "📘 Student"
6. **Enroll the student** using their email on the teacher Manage page
7. Student logs in → sees the topic on their dashboard → clicks to start teaching

### 7. Verify Everything Works

```bash
# Unit tests (73 tests)
pnpm test

# Build check
pnpm build
```

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
