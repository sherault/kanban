# Project Wiki

The Kanban Wiki is a powerful, integrated documentation system that allows you to maintain project knowledge alongside your tasks. It features a custom-built, real-time collaborative editor and deep integration with the rest of the platform.

## Key Features

### Collaborative Markdown Editor

The wiki uses a custom-built imperative editor designed for performance and reliability. Unlike many collaborative editors, it does not rely on heavy libraries like TipTap or Yjs. Instead, it implements:

- **Real-time Synchronization**: Changes are pushed instantly via WebSockets.
- **Echo Filtering**: Intelligent filtering prevents your own changes from disrupting your cursor position.
- **Conflict Resolution**: If concurrent edits occur, the system manages them gracefully to ensure content integrity.

### Advanced Interface

- **Tabbed Browsing**: Keep multiple wiki pages open at once and switch between them using the tab bar.
- **Split View**: Enable "Split View" to view or edit two pages side-by-side. This is ideal for cross-referencing documentation while writing or comparing different versions.
- **Wiki Sidebar**: A hierarchical view of all pages in the current organization, allowing for easy navigation and page management.

### Page Metadata (Properties)

Each wiki page supports frontmatter-style metadata properties.

- **Structured Data**: Store key-value pairs (JSON) for each page.
- **Dynamic Usage**: Properties can be used to categorize pages, store technical metadata, or integrate with external tools.
- **MCP Access**: Properties are fully readable and writable via the MCP server.

Recommended properties for AI/second-brain workflows include:

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
- `related_wiki_ids`
- `related_task_ids`

Use page content for human-readable Markdown. Use properties for machine-readable details and attributes that agents should preserve.

### Revision History

The wiki maintains a full history of every change made to a page.

- **Transparency**: See who made changes and when.
- **Revisions**: Access previous versions of the content and metadata.

### Intelligent Linking & Search

- **Markdown Links**: Use standard Markdown syntax to link to other wiki pages or even specific tasks.
- **Kanban Link Schemes**: Use `[label](wiki://<WIKI_PAGE_UUID>)` for wiki pages and `[label](task://<TASK_UUID>)` for tasks.
- **Unified Search**: Press `Cmd+K` (or `Ctrl+K`) to open the global search bar at the bottom. It searches across both tasks and wiki pages simultaneously, providing a fast way to navigate your entire workspace.

## MCP Integration

The wiki is fully exposed to AI assistants through the Model Context Protocol (MCP). This allows agents like Claude to:

- **Analyze Documentation**: Read wiki pages to understand project requirements or technical specs.
- **Update Knowledge**: Automatically update wiki pages as tasks are completed or new information becomes available.
- **Manage Structure**: Create, move, or delete pages programmatically.

### Available MCP Tools for Wiki:

- `list_wiki_pages`: Enumerate all pages in an organization.
- `get_wiki_page`: Fetch full content, parent information, and metadata.
- `create_wiki_page`: Create a new page with Markdown and optional properties.
- `update_wiki_page`: Modify content, title, or metadata.
- `delete_wiki_page`: Permanent removal of a page.
- `get_wiki_history`: Retrieve the revision log.
- `search_wiki`: Find pages by title.

When an MCP client writes Markdown, it should use `wiki://` and `task://` links for durable references. It should search or fetch the target first and never invent UUIDs.

## Getting Started with the Wiki

To access the wiki, click the **Wiki** tab in any project sidebar. From there, you can create your first page (usually "Home" or "Index") and start building your project's knowledge base.
