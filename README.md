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
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (or local via `npx supabase start`)
- OpenAI API key

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your keys:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# OPENAI_API_KEY=

# 3. Apply database migrations
npx supabase db push

# 4. Seed demo data (optional)
npx supabase db seed --file supabase/seed.sql

# 5. Run dev server
pnpm dev
```

### Demo Accounts (after seeding)

| Role | Name | Email |
|------|------|-------|
| Teacher | Ananya Sharma | ananya@greenfield.edu |
| Student | Rohan Mehta | rohan@greenfield.edu |
| Student | Priya Gupta | priya@greenfield.edu |
| Student | Arjun Singh (struggling) | arjun@greenfield.edu |
| Student | Diya Patel | diya@greenfield.edu |
| Student | Kabir Verma (new) | kabir@greenfield.edu |

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup, callback
│   ├── (student)/        # Student dashboard, teach, results
│   │   ├── dashboard/
│   │   ├── teach/[topicId]/
│   │   └── results/[sessionId]/
│   ├── teacher/          # Teacher dashboard
│   │   └── dashboard/
│   ├── api/
│   │   ├── chat/         # Learner Agent streaming
│   │   ├── mastery/      # Wisdom Agent scoring
│   │   ├── topics/       # CRUD
│   │   └── dashboard/    # Teacher analytics
│   └── page.tsx          # Landing page
├── components/
│   ├── chat/             # Chat interface components
│   └── ui/               # Design system components
├── lib/
│   ├── agents/           # LLM prompt engineering
│   ├── scoring/          # Mastery calculator, gap detector, credits
│   ├── supabase/         # Client/server helpers
│   └── utils/            # Formatting, classnames
└── middleware.ts          # Auth guard + role routing
```

## Mastery Scoring

| Score | Level | Credits | Color |
|-------|-------|---------|-------|
| 90-100 | Expert | 3 | 🟢 Green |
| 70-89 | Proficient | 2 | 🟢 Teal |
| 40-69 | Developing | 1 | 🟡 Amber |
| 0-39 | Beginning | 0 | 🔴 Red |

## Anti-Gaming Measures

1. **Recitation Detection**: If explanation reads like a textbook passage, score is capped at 50%
2. **Follow-up Quality**: Wisdom Agent scores how students handle probing questions
3. **Zero-Knowledge Defense**: Learner Agent structurally cannot provide answers (no knowledge in context)
4. **Prompt Injection Defense**: Hardened system prompt that stays in character regardless of student input

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT-4o/4o-mini |

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the complete schema including:
- Multi-tenant school architecture
- Row-Level Security policies
- Atomic transcript append RPC
- Mastery credits ledger

## License

MIT

---

Built with 🇮🇳 by the Shiksha team. *Because understanding is not optional.*
