<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent development

### Secrets (optional if using local Supabase)

| Secret | Required when |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Using a hosted Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Using a hosted Supabase project |
| `OPENAI_API_KEY` | Always required for chat / mastery scoring |
| `SUPABASE_SERVICE_ROLE_KEY` | Always required — chat/scoring request leases, AI quotas, and account provisioning all run server-side against it |

If Supabase secrets are absent, the start script boots **local Supabase** via Docker (`supabase start`) and writes demo keys to `.env.local`.

Local demo accounts (password `password123`):
- Teacher: `ananya@greenfield.edu`
- Student: `rohan@greenfield.edu`

### Commands

| Task | Command |
| --- | --- |
| Unit tests | `pnpm test` |
| Production build | `pnpm build` |
| Dev server | `pnpm dev` (also started via environment terminals) |
| E2E tests | `pnpm test:e2e` |
| Teacher workspace E2E (isolated fixtures, no hosted data/AI) | `pnpm test:e2e:teacher` |
| DB migrations + RLS/authorization checks (in-memory Postgres) | `pnpm test:db` |
| Read-only deployment/config checks against a live project | `pnpm check:deployment` |
| Lint | `pnpm lint` |
| Local Supabase | `pnpm exec supabase start --network-id local-network` |

Docker in this VM needs legacy iptables and a `local-network` bridge bound to `127.0.0.1` for nested containers.
