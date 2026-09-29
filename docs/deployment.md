# Live rollout

GitHub stores the source. Shiksha also needs a Next.js server host, a reachable
Supabase project and server-side OpenAI credentials. It uses API routes and
streaming, so a static GitHub Pages deployment cannot run the application.

## Current readiness

The main improvements are merged in `staticparity/shiksha` (PR #3). The operational
follow-up adds onboarding fixes, repeatable CI checks and the preflight below.
Local tests use isolated fixtures and do not establish production readiness.
At the last check, the Supabase hostname in `.env.local` did not resolve and no
hosting project was linked. Confirm the intended project before migrating data.

## Deployment sequence

1. Connect the intended Supabase account and Next.js hosting project. For Vercel,
   import `staticparity/shiksha`, choose Next.js and use the repository root.
   Use Node.js 22 and pnpm 10.33.0. Keep the application's existing access policy.
2. Confirm the database project URL and inspect its migration history. Apply
   missing migrations in order, including `006_authoritative_assessments.sql`.
   Do not rerun migration 006 if it has already been applied. It changes grants,
   membership provisioning and scoring, so deploy compatible application code
   immediately afterward; avoid doing this during active lessons. Preserve
   existing data and review historical privileged memberships.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in the host's environment.
   Public Supabase values are needed at build time. The service-role and OpenAI
   keys must remain server-only. Set the same intended environment before
   building; do not reuse the test fixtures' keys.
4. Run `pnpm check:deployment` from a securely configured checkout. Node loads
   `.env.local` when present; process environment variables take precedence.
   The command reads Auth/schema metadata and checks anonymous answer-key
   restrictions. It prints no credential values, reads no student rows, writes
   nothing and makes no model calls. A successful result is a prerequisite,
   not proof of full authenticated authorization or model behavior.
5. Deploy the tested commit. In Supabase Auth URL Configuration set the live
   Site URL and allow the exact `<live-origin>/callback` redirect. Keep email
   confirmation enabled for a public rollout and configure working email
   delivery. The standard confirmation link should route through Supabase's
   verification endpoint to the application's callback. If using a customized
   token-hash email template, restore the standard flow or implement and test
   that template's endpoint before launch.
6. Complete the smoke test below against the live URL before inviting learners.

## Smoke test

- Sign up a teacher, receive and follow the confirmation email in the same
  browser, and reach the teacher workspace. Try an expired link and confirm
  the recovery message.
- Create a class and topic with key concepts. Enroll one verified existing
  student without supplying a new password; provision a separate new student
  with a temporary password. A mismatched name must require confirmation.
- Sign in as a student and verify that only enrolled topics are visible.
  Send an explanation, refresh, and confirm transcript recovery. Finish the
  session and check the results, credits and teacher's latest-attempt view.
- Test a second account with no enrollment; it must not access the first
  student's session or the teacher workspace. Check mobile navigation.
- Confirm that live server logs contain no failed migration RPCs and that the
  application handles provider failures with usable recovery actions.

The lesson/scoring step makes real model calls and should use a dedicated pilot
account and a small number of turns. Record the deployed commit, migration
versions and test outcome. Keep launch marked incomplete if email delivery,
database authorization or scoring cannot be verified.

## Automated checks

The GitHub workflow runs lint, unit tests, deployment-check tests, the production
build, PostgreSQL migration/authorization checks and isolated Chromium browser
tests. It uses dummy configuration; no hosted database or paid models are used.
It does not automatically migrate or deploy production. Repository administrators
can require the `Shiksha checks / verify` check before merging.

References: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs),
[Vercel environment variables](https://vercel.com/docs/environment-variables),
[Supabase signup behavior](https://supabase.com/docs/reference/javascript/auth-signup).
