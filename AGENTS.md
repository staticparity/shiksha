<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent development

Required environment secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`. The start script writes these to `.env.local` on boot.

The Supabase project must have migrations in `supabase/migrations/` applied and `supabase/seed.sql` loaded for E2E demo accounts (`rohan@greenfield.edu` / `ananya@greenfield.edu`, password `password123`).

| Task | Command |
| --- | --- |
| Unit tests | `pnpm test` |
| Production build | `pnpm build` |
| Dev server | `pnpm dev` (also started automatically via environment terminals) |
| E2E tests | `pnpm test:e2e` |
| Lint | `pnpm lint` |
