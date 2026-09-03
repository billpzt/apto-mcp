# Apto Project Guide

Apto is an MCP server and Next.js dashboard for job search workflow management. The MCP layer (`apto-mcp/`) exposes tools over HTTP for AI assistants to interact with the underlying job database, while the Next.js frontend provides a Kanban board UI, job analysis, and skill tracking.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Prisma v6 |
| AI API | Anthropic SDK |
| UI Icons | lucide-react |

## Project Structure

```
apto/
├── app/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Index redirect
│   ├── jobs/page.tsx             # Kanban board
│   ├── skills/page.tsx           # Skill management
│   ├── contacts/page.tsx         # CRM (stub)
│   ├── resume/page.tsx           # Resume manager (stub)
│   └── api/
│       ├── jobs/route.ts         # GET/POST job operations
│       ├── jobs/[id]/route.ts    # GET/PATCH/DELETE single job
│       ├── skills/route.ts       # GET/POST skill operations
│       ├── skills/[id]/route.ts  # PATCH/DELETE single skill
│       ├── mcp/route.ts          # MCP server endpoint
│       └── chat/route.ts         # Claude API proxy
├── components/
│   ├── Sidebar.tsx               # Navigation
│   ├── KanbanBoard.tsx           # Main board UI
│   ├── JobCard.tsx               # Job card component
│   └── AddJobModal.tsx           # Create/edit modal
├── lib/
│   ├── db.ts                     # Prisma client singleton
│   ├── constants.ts              # Enums, colors, config
│   ├── assistant-tools.ts        # MCP tool definitions
│   ├── assistant-service.ts      # MCP tool implementations
│   └── oauth.ts                  # Auth utilities
├── apto-mcp/
│   └── index.js                  # HTTP client to app/api/mcp
└── prisma/
    ├── schema.prisma             # Data model
    └── seed.ts                   # Database seeding
```

## Key Conventions

- No em dashes in authored copy: use commas or colons.
- Server Components fetch data from Prisma directly; Client Components call `/api/*` routes.
- All dates are stored as `DateTime` in Prisma; serialize to ISO 8601 strings before passing to frontend.
- Status and color configuration lives in `lib/constants.ts` as the single source of truth.

## Job Statuses

`BACKLOG`, `PROFILE_LIVE`, `APPLIED`, `ASSESSMENT`, `STANDBY`, `CLOSED`, `STALLED`, `REJECTED`, `WITHDRAWN`

## Skill Levels

1: Beginner, 2: Basic, 3: Intermediate, 4: Advanced, 5: Expert

## Development Setup

```bash
npm install              # Installs dependencies and runs prisma generate
npm run db:push          # Applies schema to your PostgreSQL database
npm run db:seed          # Seeds with test data
npm run dev              # Starts localhost:3000
npm run typecheck        # TypeScript check (run before committing)
npm run lint             # ESLint check (run before committing)
```

A PostgreSQL database is required. Set environment variables in `.env`:
- `DATABASE_URL`: pooled connection string (with `connect_timeout=15`)
- `DIRECT_URL`: unpooled connection string (migrations only)
- `ANTHROPIC_API_KEY` or another AI provider key

See `.env.example` for the template. Prisma CLI reads `.env`, not `.env.local`.

## How to Add an MCP Tool

1. **Define the tool schema** in `lib/assistant-tools.ts`:
   - Add the tool name to `ASSISTANT_TOOL_NAMES`
   - Define the tool object with `name`, `description`, and `inputSchema`
   - Implement the dispatch logic in `callAssistantTool()`

2. **Implement the logic** in `lib/assistant-service.ts`:
   - Write the handler function (e.g. `recordApplication()`)
   - Import it in `assistant-tools.ts`
   - Call it from the dispatch function

3. **Expose via HTTP** in `app/api/mcp/route.ts`:
   - The route already serves all `ASSISTANT_TOOLS` over MCP Streamable HTTP transport
   - It validates the `Authorization: Bearer <APTO_MCP_TOKEN>` header
   - No additional wiring needed

See `app/api/jobs/route.ts` for REST API patterns and `lib/assistant-service.ts` for Prisma query examples.

## Never Rules

1. **Never commit `.db` files or `.env*` files** (except `.env.example`). The `.gitignore` already covers these.

2. **Never seed real personal data.** The seed file is intentionally fictional to keep the repo safe for public cloning.

3. **Never run `prisma db push` against a shared or production database.** Use `prisma db execute` with targeted SQL for schema changes on live databases to avoid dropping tables.

4. **Never hardcode deployment hostnames, owner information, or API keys.** Read these from environment variables.
