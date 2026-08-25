<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent development

### Product demo

Open `/demo` for the product test ground (also linked as **Try the demo** on the landing page).

| Role | Email | Password |
| --- | --- | --- |
| Student | `rohan@greenfield.edu` | `password123` |
| Teacher | `ananya@greenfield.edu` | `password123` |

### Secrets (optional if using local Supabase)

| Secret | Required when |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Using a hosted Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Using a hosted Supabase project |
| `OPENAI_API_KEY` | Always required for chat / mastery scoring |

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
| Lint | `pnpm lint` |
| Local Supabase | `pnpm exec supabase start --network-id local-network` |

Docker in this VM needs legacy iptables and a `local-network` bridge bound to `127.0.0.1` for nested containers.
