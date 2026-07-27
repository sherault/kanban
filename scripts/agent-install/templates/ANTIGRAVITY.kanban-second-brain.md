## {{MCP_SERVER_NAME}} Second Brain

Use the configured `{{MCP_SERVER_ID}}` MCP server as durable memory.

Kanban Markdown links:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Search or fetch before linking. Do not invent UUIDs.
Prefer `search_knowledge` when it is available because it searches wiki content, wiki properties, and tasks together.

Use wiki page Markdown content for prose and wiki page `properties` for structured frontmatter-like metadata such as `doc_type`, `validation_status`, `source_urls`, `freshness`, `jurisdiction`, and related ids.

Prefer `create_capture` for raw inbox capture, `promote_capture_to_wiki_page` for durable knowledge, and `promote_capture_to_task` for actionable work. Use Kanban wiki pages for durable knowledge, Kanban tasks for actionable work, and inbox captures with `doc_type: "capture"` plus `status: "inbox"` when the destination is unclear.

For knowledge audits, prefer `audit_knowledge_freshness` when available. Run it without `createTasks` first; use `createTasks: true` only when the user wants review work created.
