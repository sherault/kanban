# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Breaking changes

- MCP `list_tasks`: tasks no longer carry `description` by default. Each task
  now has a `descriptionLength` field (character count, `0` when there is no
  description). Pass `includeDescription: true` to get the previous response
  shape back.

### Added

- MCP `get_board`: optional `includeDescription` parameter (default `false`)
  that renders each task description, indented by four spaces, under its task
  line. The default rendering is unchanged.
- MCP `get_task`: optional `sections` parameter — a list of level-2 Markdown
  headings (e.g. `["## Files", "## Dependencies"]`). The returned description
  keeps only those sections, in their original order; requested sections that
  are not found are listed in `missingSections`. Headings inside fenced code
  blocks are ignored.
- MCP `get_task`: optional `ifUpdatedSince` parameter (ISO-8601, UTC when no
  zone is given). When the task `updatedAt` is at or before that date, the tool
  returns only `{ id, updatedAt, unchanged: true }`.

Without these parameters, `get_task` responds exactly as before.
