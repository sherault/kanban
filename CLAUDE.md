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
