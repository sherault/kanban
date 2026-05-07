## Kanban Second Brain

Use the `kanban` MCP server as durable project memory when it is available.

Kanban Markdown links:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Always search or fetch the target before linking. Do not invent UUIDs.

Use wiki page body content for human-readable Markdown. Use wiki page `properties` for structured frontmatter-like details and attributes: `doc_type`, `jurisdiction`, `validation_status`, `source_urls`, `freshness`, `cite_required`, `related_wiki_ids`, and `related_task_ids`.

Capture workflow:

1. If the user says to remember, capture, save, organize, triage, or review knowledge, use Kanban.
2. Create inbox captures as wiki pages with `doc_type: "capture"` and `status: "inbox"` when the destination is unclear.
3. Promote durable knowledge to wiki pages.
4. Promote actionable work to tasks.
5. Link related items with `wiki://` and `task://` Markdown links.

Safety workflow:

- Respect validation, freshness, source, and jurisdiction metadata.
- If a page is stale, draft, unsourced, or out of scope, say so.
- For regulated or high-stakes topics, create or suggest a validation/freshness task instead of answering from weak knowledge.
