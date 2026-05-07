## Kanban Second Brain

Use the `kanban` MCP server as durable project memory when it is available.

Kanban supports first-class Markdown interlinks:

- Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
- Task: `[label](task://<TASK_UUID>)`

Never invent UUIDs. Search or fetch the page/task first, then link to the returned id.

Wiki page body content is for human-readable Markdown. Wiki page `properties` are the frontmatter-like details/attributes layer for structured metadata such as `doc_type`, `jurisdiction`, `validation_status`, `source_urls`, `freshness`, `cite_required`, `related_wiki_ids`, and `related_task_ids`.

When the user asks to remember, capture, save, organize, triage, or review knowledge:

1. Use Kanban wiki pages for durable knowledge.
2. Use Kanban tasks for actionable work.
3. Use `wiki://` and `task://` links to keep context connected.
4. Preserve validation, freshness, source, and jurisdiction metadata in page properties.
5. Create inbox captures with `doc_type: "capture"` and `status: "inbox"` when the final destination is unclear.

For high-stakes or time-sensitive answers, respect `validation_status`, `source_status`, `effective_from`, `effective_to`, `freshness`, and `cite_required`. If the available Kanban knowledge is stale, draft, unsourced, or ambiguous, say so and create or suggest a validation/freshness task instead of answering confidently.
