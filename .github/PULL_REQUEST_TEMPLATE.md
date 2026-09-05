## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The problem, not the patch. -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` is no worse than before
- [ ] No real job-search data, credentials, or `.env` files in the diff
- [ ] No new database write path that changes a job's status or `appliedAt` without a reason recorded in its history

## If this touches the agent layer

Tool schemas live in `lib/assistant-tools.ts` and are the single source of truth for
both the HTTP transport and the stdio bridge. If you changed one, say which clients
you tested against.

Writes are never retried. If you added a request path, keep that asymmetry: a write
that timed out may already have landed.
