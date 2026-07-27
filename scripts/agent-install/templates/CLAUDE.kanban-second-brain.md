## {{MCP_SERVER_NAME}} Second Brain

Use the `{{MCP_SERVER_ID}}` MCP server as durable project memory when it is available.

Kanban Markdown links:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Always search or fetch the target before linking. Do not invent UUIDs.
Prefer `search_knowledge` when it is available because it searches wiki content, wiki properties, and tasks together.

Use wiki page body content for human-readable Markdown. Use wiki page `properties` for structured frontmatter-like details and attributes: `doc_type`, `jurisdiction`, `validation_status`, `source_urls`, `freshness`, `cite_required`, `related_wiki_ids`, and `related_task_ids`.

Capture workflow:

1. If the user says to remember, capture, save, organize, triage, or review knowledge, use Kanban.
2. Prefer `create_capture` for raw inbox capture.
3. Prefer `promote_capture_to_wiki_page` for durable knowledge.
4. Prefer `promote_capture_to_task` for actionable work.
5. Link related items with `wiki://` and `task://` Markdown links.

Safety workflow:

- Respect validation, freshness, source, and jurisdiction metadata.
- Prefer `audit_knowledge_freshness` for knowledge audits.
- If a page is stale, draft, unsourced, or out of scope, say so.
- For regulated or high-stakes topics, create or suggest a validation/freshness task instead of answering from weak knowledge.
