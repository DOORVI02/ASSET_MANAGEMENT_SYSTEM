# Claude Project Instructions

`Agents.md` is the canonical working guide for every coding agent in this repository. Read it, `.agents/plan.md`, and `.agents/phases.md` before making changes.

Claude-specific reminders:

- Treat `.agents/phases.md` as the only progress tracker; do not copy phase status into this file.
- Preserve the active `frontend/` Vite application and its existing design system.
- During frontend phases, do not read `supabase.txt` or `cloudinary.txt`, connect external services, or begin backend work.
- Record durable product and architecture decisions in `.agents/plan.md`; record user journeys in `.agents/flow.md`.
- Do not commit, push, deploy, or mutate external services unless the user explicitly asks.

If this file conflicts with `Agents.md`, follow `Agents.md`.
