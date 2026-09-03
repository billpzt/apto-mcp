# Contributing to Apto

Contributions are welcome, including bug reports, questions and "I tried to set this up and got stuck at step three".

## Before you start

For anything larger than a bug fix, open an issue first and describe what you want to change. It is a small project and a short conversation saves a wasted afternoon.

## Setup

See [Quick start](./README.md#quick-start). Short version:

```bash
npm install
cp .env.example .env.local && cp .env.example .env
npm run db:push && npm run db:seed
npm run dev
```

## Before you open a pull request

```bash
npm run typecheck    # tsc --noEmit, must pass
npm run lint
```

There is a pre-commit hook that runs the typecheck. Do not disable it.

## The one rule that matters

**This project holds someone's job search.** Anything that could quietly change the state of an application has to be explicit, reversible and logged. Concretely:

- **Never widen a write path.** `apto_record_application` is the only thing that may set `appliedAt`. Importing, analysing and note-taking must not touch it, no matter how convenient that would be.
- **Never retry a write.** Reads retry once. Writes do not, because a write that timed out may already have landed. If you add a mutating endpoint, follow the existing pattern and return a hint instead of retrying.
- **Never let a note stand in for a state change.** If your feature can describe something but not change it, the thing it describes will resurface forever. Two separate bugs in this repo came from exactly that.
- **Never commit real data.** `prisma/seed.ts` is fictional on purpose. The database is gitignored on purpose. A job search contains other people's names and your own compensation numbers.

## Style

- TypeScript, strict. No `any` without a comment saying why.
- Server Components read from Prisma directly. Client Components go through `/api/*`.
- Status values and colours live in `lib/constants.ts`. One source of truth.
- Dates are `DateTime` in Prisma, serialized to ISO strings before crossing into a Client Component.
- No em dashes in user-facing copy. Commas and colons work fine.

## Adding an MCP tool

1. Add the schema to `lib/assistant-tools.ts`.
2. Add the implementation to `lib/assistant-service.ts`.
3. Both transports pick it up automatically. Do not register it in two places.
4. Say in the description what the tool does **not** do. The descriptions are the only thing standing between an eager agent and your data.

## Licensing

By contributing, you agree that your contribution is licensed under [AGPL-3.0](./LICENSE), and that the project maintainer may also offer the combined work under a separate commercial licence.
