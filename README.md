# Kanban

A self-hosted, real-time project management board with built-in MCP server — so AI assistants like Claude can read and write your tasks directly.

> **Built with AI tools:** This project was developed using [Claude Code](https://claude.ai/code), [RTK-AI](https://github.com/rtk-ai/rtk), and [code-review-graph](https://github.com/tirth8205/code-review-graph/).

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Docker](#docker)
- [Demo Data](#demo-data)
- [MCP Integration (Claude / AI)](#mcp-integration-claude--ai)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)

---

## Features

### Authentication & Security
- **Email + password registration** with email verification (SMTP or console fallback in dev)
- **Two-factor authentication (TOTP)** — Google Authenticator, Authy, 1Password, any TOTP app
- **Two-step login** — email/password then TOTP code when 2FA is enabled
- **JWT access tokens** (short-lived) + **HTTP-only refresh token cookies** (rotated on each use)
- **API keys** — long-lived bearer tokens for MCP / programmatic access

### Organizations & Members
- Create multiple organizations per account
- Invite members via single-use invitation links (shareable URL)
- Role system: **owner** and **member**
- Owner can **transfer ownership** to any member
- Owner can **delete the organization** (requires at least one other org)
- Rename organization and set optional website

### Projects
- Multiple projects per organization
- Create, rename, and delete projects
- All members of the org have access to all projects

### Kanban Board
- Four columns: **Ideas → To Do → Doing → Done**
- Tasks sorted by **due date ascending** (overdue first)
- **Drag-and-drop** tasks between columns
- **Ideas column** collapsible to save horizontal space
- **Color-coded task cards** — set a custom background colour per task
- Auto-assign the moving user as **doer** when dragging a task to Doing (no doer set)
- Auto-clear doer when moving back to Todo

### Task Detail
Each task has a rich detail sidebar with:
- **Title** and **description** (multi-line)
- **Objective** — group tasks under a goal
- **Global subject** — cross-cutting label
- **Start date** and **end date**
- **Reporter**, **Doer**, **Validator** — assignable to any org member
- **Watchers** and **Advisors** — additional stakeholders
- **Tags** — free-form, with autocomplete from existing tags
- **Linked tasks** — bidirectional links between tasks
- **Custom background colour** — colour picker
- **History log** — every field change recorded with who changed it and when
- **Conflict detection** — if two users edit the same field simultaneously, the second user gets a warning with merge options

### Filtering
- Filter by **tag** — click any tag chip on a card
- Filter by **objective**
- Filter by **doer** — click an avatar
- Multiple active filters combine (AND)
- Active filters shown as removable chips with "Clear all"

### Archive
- Multi-select Done tasks with checkboxes
- Archive in bulk with one click
- **Resizable archive panel** at the bottom — drag to resize
- Search archived tasks by title
- Paginated results
- Restore archived tasks back to Todo

### CSV Import
- Upload a `.csv` file to bulk-create tasks
- Columns: `title`, `description`, `startDate`, `endDate`, `column`
- Invalid rows are skipped and reported; valid rows are imported atomically

### Real-Time Collaboration
- **WebSocket** connection per board — live dot indicator (green = connected)
- Task creates, updates, deletes, moves, and reorders pushed to all connected users instantly
- **Conflict-aware editing** — if you are typing in a field and a remote update arrives, the change is held until you blur, then you are shown a diff and asked to choose

### Profile
- View and update display name
- Manage **TOTP 2FA** — enable with QR code scan, disable with code confirmation
- Resend email verification link
- Generate and revoke **MCP API keys** with labels

### MCP Server (Model Context Protocol)
- Exposes your board as an MCP server for AI tools
- **Streamable HTTP** transport (modern, recommended)
- **Legacy SSE** transport (for older MCP clients)
- Authenticated via API key (`Authorization: Bearer <key>`)
- Tools available to AI:
  - `list_organizations`, `create_organization`
  - `list_projects`, `create_project`
  - `list_tasks`, `create_task`, `update_task`, `move_task`, `delete_task`

---

## Screenshots

### Sign in
![Sign in](docs/screenshots/01-login.png)

### Organizations
![Organizations](docs/screenshots/02-orgs.png)

### Projects
![Projects](docs/screenshots/03-org-home.png)

### Kanban Board
Tasks sorted by due date, colour-coded, with tags and assignees visible at a glance. The Ideas column is expanded on the left.

![Kanban Board](docs/screenshots/04-board.png)

### Task Detail Sidebar
Click any card to open the full detail panel — description, dates, assignees, tags, linked tasks, colour picker, and history.

![Task Detail](docs/screenshots/05-task-sidebar.png)

### Tag Filtering
Click any tag chip to filter the board. Active filters shown as removable chips.

![Filtering](docs/screenshots/06-filtered.png)

### Archive Panel
Archived tasks are searchable and restorable from the collapsible panel at the bottom.

![Archive](docs/screenshots/07-archive.png)

### Profile & MCP API Keys
Set up 2FA, generate API keys, copy the MCP config snippet for Claude.

![Profile](docs/screenshots/09-profile.png)

### Registration
![Register](docs/screenshots/10-register.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | [Hono](https://hono.dev/) on Node.js |
| Database | SQLite via [Drizzle ORM](https://orm.drizzle.team/) + `better-sqlite3` |
| Real-time | WebSockets (`@hono/node-ws`) |
| Web | [Next.js 14](https://nextjs.org/) App Router (Server Components + Server Actions) |
| Auth | JWT access tokens, HTTP-only refresh cookies, Argon2 password hashing |
| 2FA | [otplib](https://github.com/yeojz/otplib) (TOTP) + [qrcode](https://github.com/soldair/node-qrcode) |
| Email | [nodemailer](https://nodemailer.com/) (SMTP) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| MCP | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| Monorepo | pnpm workspaces + Turborepo |
| Tests | Vitest + in-memory SQLite |

---

## Getting Started

### Local Development

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 9

```bash
# Clone and install
git clone https://github.com/sherault/kanban
cd kanban
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET and REFRESH_SECRET at minimum (must be ≥ 32 chars)
# For example using `openssl rand -hex 32` in your terminal

# Start both apps (right now hardcoded for API on :3010, Web on :3009 on the respective package.json)
pnpm dev
```

Open [http://localhost:3009](http://localhost:3009) in your browser.

The database file is created automatically at `apps/api/kanban.db` on first start. Migrations run automatically on startup.

> **Email verification in dev:** If no `SMTP_HOST` is set, verification links are printed to the API console instead of sent by email. Check the terminal after registering.

### Docker

```bash
# Copy env and set your secrets
cp .env.example .env

# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

- Web: [http://localhost:3009](http://localhost:3009)
- API: [http://localhost:3010](http://localhost:3010)

The SQLite database is persisted to `./data/kanban.db` on the host (bind mount).

To stop:
```bash
docker compose down
```

---

## Demo Data

A seed script creates three demo users, one organization, two projects, and a realistic set of tasks across all columns — including tags, assignees, linked tasks, and archived tasks.

**Requirements:** both `pnpm dev` servers must be running.

```bash
node scripts/seed.mjs
```

This creates:

| Name | Email | Password |
|---|---|---|
| Alice Martin | alice@acmecorp.io | demo1234 |
| Bob Chen | bob@acmecorp.io | demo1234 |
| Carol Singh | carol@acmecorp.io | demo1234 |

**Organization:** Acme Corp (all three members)

**Projects:**
- **Website Redesign** — 10 tasks across all columns (3 archived), tagged, colour-coded, linked
- **Mobile App v2** — 5 tasks across all columns

Log in as Alice to see the full board. Bob is assigned the "Design system tokens" task, Carol is on the "SEO audit" task.

---

## MCP Integration (Claude / AI)

Connect Claude (or any MCP-compatible AI) to your board so it can read tasks, create new ones, move them between columns, and update details — all from a conversation.

### Setup

1. Go to your **Profile** page
2. Under **MCP API Keys**, enter a label and click **Generate key**
3. Copy the raw key (shown only once)
4. Add the config to your Claude desktop / CLI config:

**Streamable HTTP (recommended)**
```json
{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "http://localhost:3010/mcp/",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}
```

**Legacy SSE (older clients)**
```json
{
  "mcpServers": {
    "kanban": {
      "type": "sse",
      "url": "http://localhost:3010/mcp/sse",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}
```

### What Claude can do

Once connected, you can ask things like:

> *"What tasks are currently in Doing?"*
> *"Create a task in To Do: 'Write release notes', due April 30th"*
> *"Move the SEO audit task to Done"*
> *"List all tasks tagged 'bug'"*

All changes appear on the board in real-time for all connected users.

---

## Architecture

```
kanban/
├── apps/
│   ├── api/          # Hono API — all domain logic, DB, WebSockets, MCP
│   │   ├── src/
│   │   │   ├── features/   # identity, org, project, task, mcp, ws
│   │   │   ├── db/         # Drizzle schema + migrations
│   │   │   └── lib/        # password, jwt, mailer, otp, errors
│   │   └── drizzle/
│   │       └── migrations/  # committed SQL migration files
│   └── web/          # Next.js 14 App Router — BFF, no direct DB access
│       └── src/
│           ├── app/
│           │   ├── (app)/   # authenticated routes
│           │   └── (auth)/  # login, register, verify-email
│           ├── actions/     # Server Actions (form mutations)
│           └── hooks/       # useProjectSocket (WebSocket)
└── packages/
    └── shared/       # TypeScript DTOs and enums only
```

**Key design decisions:**
- The web layer is a pure BFF — all data lives in the API, no direct DB access from Next.js
- ORM types never leave `apps/api`; only DTOs from `packages/shared` cross the boundary
- SQLite makes the project self-contained and trivially deployable; swapping to PostgreSQL requires only changing `DATABASE_URL` and the Drizzle driver
- Fractional indexing (`position: real`) for task ordering — drag-and-drop never renumbers the entire column
- Refresh token rotation on every use — reuse of an old token invalidates the session

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Secret for signing access tokens (≥ 32 chars) |
| `REFRESH_SECRET` | Yes | Secret for refresh tokens (≥ 32 chars) |
| `DATABASE_URL` | No | Path to SQLite file (default: `kanban.db`) |
| `PORT` | No | API port (default: `3010`) |
| `APP_URL` | No | Public URL for email links (default: `http://localhost:3009`) |
| `SMTP_HOST` | No | SMTP server hostname — omit to log links to console |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_SECURE` | No | `true` for TLS on port 465 |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address (default: `noreply@kanban.local`) |
| `NEXT_PUBLIC_API_URL` | Yes (web) | API base URL visible to the browser |
| `NEXT_PUBLIC_WS_URL` | Yes (web) | WebSocket base URL visible to the browser |

---

## Running Tests

Tests live in `apps/api` only. Each test spins up an in-memory SQLite database — no external services needed.

```bash
# Run all tests
pnpm test

# Watch mode
cd apps/api && pnpm test --watch

# Coverage
cd apps/api && pnpm test --coverage
```

Test coverage includes:
- Auth flows (register, login, refresh, logout, TOTP, email verification)
- Organization and member management
- Project CRUD
- Task CRUD, move, reorder, tags, links, watchers, advisors, history
- CSV import
- API key management
- WebSocket room management
- Invitation flow
