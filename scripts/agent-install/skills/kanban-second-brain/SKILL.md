---
name: "kanban-second-brain"
description: "Use Kanban as a durable second brain through its MCP server: capture inbox items, maintain wiki/task links, separate human-readable content from structured properties, and answer from validated knowledge with citations."
---

# Kanban Second Brain

Use this skill when the user wants to save, retrieve, organize, link, review, or reason over knowledge in a Kanban instance.

## Core Model

Kanban is the durable memory. The LLM is only an operator.

- Wiki pages hold durable knowledge and decisions.
- Tasks hold actionable work.
- Wiki page `properties` hold frontmatter-like metadata.
- Markdown body content stays human-readable.
- Durable interlinks use normal Markdown links with Kanban schemes:
  - Wiki page: `[label](wiki://<WIKI_PAGE_UUID>)`
  - Task: `[label](task://<TASK_UUID>)`

Never invent UUIDs. Search or fetch the target first, then link to the returned id.

## Content vs Properties

Put prose in the page body:

- explanations
- decisions
- research summaries
- runbooks
- source notes written for humans
- task context written for humans

Put structured metadata in wiki page `properties`:

- `doc_type`
- `status`
- `jurisdiction`
- `validation_status`
- `source_status`
- `source_urls`
- `effective_from`
- `effective_to`
- `freshness`
- `cite_required`
- `rag`
- `related_wiki_ids`
- `related_task_ids`
- `owner`
- `review_after`
- `captured_from`

Prefer updating one property with `set_wiki_page_property` when only metadata changes.

## Capture Inbox

When the user says "remember this", "capture this", "save this", "make a note", "turn this into tasks", or gives useful context that should survive the conversation:

1. Decide whether it is raw capture, durable knowledge, or actionable work.
2. If unclear, create an inbox wiki page or inbox task rather than losing it.
3. Use a short title that can be found later.
4. Add enough body context that another agent can understand it without this conversation.
5. Add metadata properties so it can be triaged.

Recommended inbox wiki properties:

```json
{
  "doc_type": "capture",
  "status": "inbox",
  "validation_status": "draft",
  "source_status": "user_provided",
  "captured_from": "llm_conversation",
  "review_after": "YYYY-MM-DD",
  "related_wiki_ids": [],
  "related_task_ids": []
}
```

Recommended inbox task tags:

- `capture`
- `inbox`
- `triage`

## Triage

When triaging captures:

- Promote stable knowledge to a wiki page with `doc_type` such as `note`, `decision`, `source_registry`, `runbook`, `kb_rule`, or `project_context`.
- Promote actionable work to one or more tasks.
- Link the created items back to the source capture.
- Mark handled captures with `status: triaged`.
- Preserve uncertainty in properties rather than polishing it away.

## Answering From Kanban

Before answering from project memory:

1. Search/list relevant wiki pages and tasks.
2. Fetch the specific pages/tasks you rely on.
3. Respect `validation_status`, `source_status`, `effective_from`, `effective_to`, `freshness`, and `cite_required`.
4. Cite with visible Markdown links to `wiki://` and `task://` items when the answer uses Kanban knowledge.
5. If sources are stale, unvalidated, missing, or jurisdictionally ambiguous, say so and ask for clarification or create a validation task.

For regulated or high-stakes domains, do not convert draft or stale notes into confident advice. Use the metadata as guardrails.

## Freshness

Treat freshness as a generic second-brain rule:

- If `review_after` is in the past, mark the page stale or create a review task.
- If a page has `cite_required: true` and no `source_urls`, do not use it as authoritative.
- If `effective_to` has passed, do not present the page as current.
- If the topic is time-sensitive, verify before answering or create a freshness task.

## Task Creation Patterns

Good second-brain tasks include:

- objective
- source wiki links
- acceptance criteria
- validation owner if needed
- due date
- tags

Use Markdown links in descriptions, for example:

```md
Review [source note](wiki://00000000-0000-0000-0000-000000000000) and update [target page](wiki://11111111-1111-1111-1111-111111111111).
```

## Do Not

- Do not store secrets in wiki pages or tasks.
- Do not hide important assumptions in prose when they belong in properties.
- Do not create links with fake UUIDs.
- Do not overwrite a user's page structure without preserving existing links and metadata.
- Do not treat Kanban as only a todo list; keep the knowledge/action loop intact.
