## Kanban Second Brain

Use the configured `kanban` MCP server as durable memory.

Kanban Markdown links:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Search or fetch before linking. Do not invent UUIDs.

Use wiki page Markdown content for prose and wiki page `properties` for structured frontmatter-like metadata such as `doc_type`, `validation_status`, `source_urls`, `freshness`, `jurisdiction`, and related ids.

Use Kanban wiki pages for durable knowledge, Kanban tasks for actionable work, and inbox captures with `doc_type: "capture"` plus `status: "inbox"` when the destination is unclear.
