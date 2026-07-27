# Second-Brain Testing Guide

Use this guide to verify the Kanban second-brain workflow end to end: installer, MCP tools, UI inbox triage, freshness review, and secret handling.

## Automated Checks

Run these from the repository root:

```bash
pnpm agent:install:smoke
pnpm agent:install -- --dry-run --mode external --url http://localhost:3000 \
  --clients codex,claude --workspace /tmp/kanban-smoke \
  --integration-name "Test Kanban" \
  --skip-provision --mcp-key kbk_smoke_test_key_secret --no-keychain
pnpm --filter @kanban/api exec vitest run src/tests/features/mcp-second-brain-tools.test.ts
pnpm --filter @kanban/api typecheck
pnpm --filter @kanban/web typecheck
pnpm --filter @kanban/api test
```

Expected result:

- the installer smoke test passes;
- the smoke test confirms an unrelated MCP is preserved, differently named connections coexist, same-name replacement requires `--replace-existing`, and existing Docker state blocks reuse by default;
- the dry run prints a plan without prompting;
- the focused MCP test passes;
- API and web typechecks pass;
- the API suite passes.

## Local UI Test

Start the app:

```bash
pnpm dev
```

Then verify the human triage loop:

1. Sign in and open a project.
2. Open the Wiki tab.
3. In the wiki sidebar, find the Second Brain panel.
4. Click the plus button, create a capture, and save it.
5. Confirm a new wiki page opens and its properties include:

```json
{
  "doc_type": "capture",
  "status": "inbox",
  "captured_from": "kanban_ui"
}
```

6. Return to the Wiki tab and confirm the capture appears under Inbox.
7. Click Task on that capture.
8. Open the Board tab and confirm a triage task exists with a `wiki://...` link back to the capture.
9. Return to the Wiki tab and click Done on the capture.
10. Confirm the capture leaves the Inbox list and its properties include `status: "triaged"`.

## Freshness UI Test

Create or update a wiki page with these properties:

```json
{
  "doc_type": "decision",
  "status": "active",
  "validation_status": "draft",
  "cite_required": true,
  "source_urls": [],
  "review_after": "2026-05-01"
}
```

On or after May 12, 2026, this page should appear in the Second Brain panel under Review Due. Click Review, then confirm:

- a freshness review task appears on the board;
- the task description links back to the wiki page with `wiki://...`;
- the wiki page properties include `freshness.status: "review_requested"` and a `freshness.review_task_id`.

## MCP Agent Test

Install or configure an MCP client with the installer:

```bash
pnpm agent:install
```

When prompted for an MCP/skill connection name, use `Kanban` for the default
connection or a distinct name such as `Personal Kanban` when that workspace
already has a Kanban MCP. A distinct name creates separate MCP config, skill,
managed instruction block, and key env file.

For the default connection, launch the agent through:

```bash
pnpm agent:env -- codex
pnpm agent:env -- claude
```

For a named connection installed from GitHub without a local checkout, launch
the agent through its generated env file:

```bash
node ~/.kanban/app/scripts/kanban-agent-env.mjs \
  --env ~/.kanban/agent-personal-kanban.env -- codex
```

For two named connections installed into one workspace, pass both env files:

```bash
node ~/.kanban/app/scripts/kanban-agent-env.mjs \
  --env ~/.kanban/agent-work-kanban.env \
  --env ~/.kanban/agent-personal-kanban.env -- codex
```

In Codex, Claude Code, or another MCP client, verify these tool flows:

1. Call `list_organizations`, then `list_projects`.
2. Call `create_capture` with an organization id, project id, title, and Markdown body.
3. Call `search_knowledge` for a phrase from the capture and confirm it returns a real `wiki://<id>` link.
4. Call `promote_capture_to_task` and confirm the created task links to the source capture.
5. Call `promote_capture_to_wiki_page` for a second capture and confirm the new wiki page links back to the capture.
6. Call `audit_knowledge_freshness` with `createTasks: false`.
7. If findings are correct, call `audit_knowledge_freshness` again with `createTasks: true` and a `projectId`.

Expected result:

- no tool invents UUIDs;
- links use `wiki://` and `task://`;
- metadata stays in wiki page properties;
- human-readable prose stays in page content or task descriptions;
- audit-created tasks link back to their source wiki pages.

## Secret Handling Test

After installing into a workspace, verify config files do not contain the raw MCP key:

```bash
rg "kbk_" .mcp.json .codex/config.toml .antigravity/mcp.json
```

Expected result:

- config files use a variable such as `${KANBAN_MCP_API_KEY}` or `${PERSONAL_KANBAN_MCP_API_KEY}` instead of a raw key;
- `~/.kanban/agent.env` or the named file such as `~/.kanban/agent-personal-kanban.env` is private;
- when keychain storage succeeds, the env file contains `KANBAN_MCP_KEY_STORAGE=keychain` and not the raw key;
- when `--no-keychain` is used, the env file contains its named MCP key variable.

On macOS, keychain-backed launch should work through:

```bash
pnpm agent:env -- node -e "console.log(Boolean(process.env.KANBAN_MCP_API_KEY))"
```

The command should print `true`.
