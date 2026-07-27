# Plant Maintenance and Machine Asset Register

A role-based asset register for SAIL Bhilai Steel Plant machinery, parts, maintenance, repairs, images, dashboards, and report-ready data.

## Development strategy

The project is frontend-first. Pages and workflows are completed against typed in-memory data before the database schema is frozen. Supabase and Cloudinary integration remain blocked until all frontend pages are accepted and the user explicitly starts the backend phase.

Progress and verification evidence live only in [`.agents/phases.md`](.agents/phases.md).

## Repository map

```text
.
├── frontend/       # Active Vite + React application
├── .agents/
│   ├── plan.md       # Product and technical architecture
│   ├── phases.md     # Roadmap, progress, and evidence
│   └── flow.md       # User journeys
├── Agents.md         # Canonical agent working rules
├── Claude.md         # Claude-specific pointer
└── README.md
```

`frontend/` is the active application. A legacy root `frontend/` directory, if present, is outside the active scope and should not be changed unless explicitly requested.

## Frontend stack

- React 19, Vite 7, and TypeScript
- Tailwind CSS 4
- Wouter routing
- shadcn/ui and Radix UI
- TanStack Query
- Vitest and React Testing Library
- ESLint and Prettier
- pnpm

## Local commands

Run commands from `frontend/`:

```bash
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The current UI uses mock authentication and typed in-memory data. Demo role controls are preview-only and do not provide security.

## Planned backend

After explicit frontend acceptance:

- Supabase PostgreSQL and versioned SQL migrations
- Supabase email/password Auth; Gmail addresses are normal email addresses, not Google OAuth
- PostgreSQL Row Level Security for Officer and Supervisor
- Supabase Edge Functions for Cloudinary signed uploads, deletion, cleanup, and operations requiring secrets

There will be no separate Express or FastAPI backend. The repository will contain the Vite frontend and Supabase backend infrastructure.

Never commit or expose `.env*`, passwords, tokens, Supabase service-role keys, Cloudinary secrets, or real employee data.

## Documentation

- Start implementation work with [`Agents.md`](Agents.md).
- Read [`.agents/plan.md`](.agents/plan.md) for durable requirements and architecture.
- Read [`.agents/phases.md`](.agents/phases.md) for the current task and completion evidence.
- Read [`.agents/flow.md`](.agents/flow.md) when implementing navigation or role-specific journeys.
