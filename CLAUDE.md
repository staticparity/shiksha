@AGENTS.md

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Deploy Configuration (configured by /setup-deploy)
- Platform: Vercel
- Production URL: not yet deployed — see README.md "Production Deployment"; update
  this line with the real `*.vercel.app` (or custom) URL after the first import.
- Deploy workflow: automatic on push to `main`, once the GitHub repo is imported
  into a Vercel project
- Deploy status command: `vercel ls --prod` (requires `vercel` CLI + login) or check
  the Vercel dashboard
- Merge method: direct push to main (no PR workflow currently)
- Project type: web app (Next.js 16)
- Post-deploy health check: HTTP GET on the production URL once known

### Custom deploy hooks
- Pre-merge: `pnpm build && pnpm test`
- Deploy trigger: automatic on push to main (Vercel's GitHub integration)
- Deploy status: poll production URL, or `vercel ls --prod`
- Health check: production URL (update once deployed)

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
