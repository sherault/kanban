# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (both apps)
pnpm dev

# Test (API only — web has no tests yet)
pnpm test
cd apps/api && pnpm test

# Lint
pnpm lint

# Build
pnpm build

# Format
pnpm format

# DB migrations (run from apps/api)
cd apps/api && pnpm drizzle-kit generate
cd apps/api && pnpm drizzle-kit studio
```

## Architecture

**Monorepo:** pnpm workspaces + Turborepo. Two apps (`apps/api`, `apps/web`), two packages (`packages/shared`, `packages/eslint-config`).

**API** (`apps/api`): Hono on Node.js. All domain logic, DB access, WebSockets, and MCP server live here. Entry: `src/index.ts` → runs migrations → starts Hono server on port 3001.

**Web** (`apps/web`): Next.js 14 App Router as BFF — server components fetch from the API and reshape to view models. No direct DB access.

**Shared** (`packages/shared`): TypeScript DTOs and enums only. No ORM types ever leave `apps/api`.

**DB:** Drizzle ORM + `better-sqlite3`. Schema: `apps/api/src/db/schema/`. Migrations: `apps/api/drizzle/migrations/` (committed). Swap to PostgreSQL: change `DATABASE_URL` + swap driver — zero app code changes.

**Testing:** Vitest in `apps/api`. Integration tests use `:memory:` SQLite via `createTestDb()` from `src/db/test-utils.ts`.

<!-- code-review-graph MCP tools -->

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review — token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
