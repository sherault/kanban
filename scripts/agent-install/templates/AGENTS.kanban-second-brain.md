## {{MCP_SERVER_NAME}} Second Brain

Use the `{{MCP_SERVER_ID}}` MCP server as durable project memory when it is available.

Kanban supports first-class Markdown interlinks:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Never invent UUIDs. Search or fetch the page/task first, then link to the returned id.
Prefer `search_knowledge` when it is available because it searches wiki content, wiki properties, and tasks together.

Wiki page body content is for human-readable Markdown. Wiki page `properties` are the frontmatter-like details/attributes layer for structured metadata such as `doc_type`, `jurisdiction`, `validation_status`, `source_urls`, `freshness`, `cite_required`, `related_wiki_ids`, and `related_task_ids`.

When the user asks to remember, capture, save, organize, triage, or review knowledge:

1. Prefer `create_capture` for raw inbox capture.
2. Use `promote_capture_to_wiki_page` for durable knowledge.
3. Use `promote_capture_to_task` for actionable work.
4. Use `wiki://` and `task://` links to keep context connected.
5. Preserve validation, freshness, source, and jurisdiction metadata in page properties.
6. Create inbox captures with `doc_type: "capture"` and `status: "inbox"` when the final destination is unclear.

For high-stakes or time-sensitive answers, respect `validation_status`, `source_status`, `effective_from`, `effective_to`, `freshness`, and `cite_required`. If the available Kanban knowledge is stale, draft, unsourced, or ambiguous, say so and create or suggest a validation/freshness task instead of answering confidently.

For knowledge audits, prefer `audit_knowledge_freshness` when available. Run it without `createTasks` first; use `createTasks: true` only when the user wants review work created.
