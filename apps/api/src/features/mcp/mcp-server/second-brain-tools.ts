import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import type { WikiService } from "../../wiki/wiki.service.js";
import { jsonText, textResult } from "./utils.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function arrayProperty(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringProperty(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function objectProperty(value: unknown): Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function normalizedText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  return JSON.stringify(value).toLowerCase();
}

function compactText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return JSON.stringify(value).replace(/\s+/g, " ").trim();
}

function searchTokens(query: string): string[] {
  return uniq(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  );
}

function scoreParts(
  query: string,
  tokens: string[],
  parts: Array<{ value: unknown; weight: number }>,
): number {
  const phrase = normalizedText(query).trim();
  let score = 0;

  for (const part of parts) {
    const text = normalizedText(part.value);
    if (!text) continue;
    if (phrase && text.includes(phrase)) score += part.weight * 8;
    for (const token of tokens) {
      if (text.includes(token)) score += part.weight;
    }
  }

  return score;
}

function snippetFrom(value: unknown, tokens: string[]): string | undefined {
  const text = compactText(value);
  if (!text) return undefined;

  const lower = text.toLowerCase();
  const hit = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const start = Math.max(0, (hit ?? 0) - 80);
  const end = Math.min(text.length, start + 220);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function mergeProperties(
  existing: Record<string, any> | null | undefined,
  next: Record<string, any> | null | undefined,
): Record<string, any> {
  return {
    ...(existing ?? {}),
    ...(next ?? {}),
  };
}

function isDueDate(value: string, todayDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= todayDate;
}

function freshnessFindings(
  page: {
    title: string;
    properties?: Record<string, any> | null | undefined;
  },
  todayDate: string,
): string[] {
  const properties = page.properties ?? {};
  const freshness = objectProperty(properties["freshness"]);
  const findings = new Set<string>();

  if (!stringProperty(properties["doc_type"])) findings.add("missing_doc_type");
  if (isDueDate(stringProperty(properties["review_after"]), todayDate)) {
    findings.add("review_after_due");
  }
  if (
    isDueDate(stringProperty(freshness["review_after"]), todayDate) ||
    isDueDate(stringProperty(freshness["next_review"]), todayDate)
  ) {
    findings.add("freshness_due");
  }
  if (isDueDate(stringProperty(properties["effective_to"]), todayDate)) {
    findings.add("effective_date_expired");
  }
  if (
    properties["cite_required"] === true &&
    arrayProperty(properties["source_urls"]).length === 0
  ) {
    findings.add("missing_required_sources");
  }
  if (
    ["draft", "needs_validation", "unvalidated"].includes(
      stringProperty(properties["validation_status"]),
    )
  ) {
    findings.add("needs_validation");
  }
  if (["stale", "expired"].includes(stringProperty(freshness["status"]))) {
    findings.add(`freshness_${stringProperty(freshness["status"])}`);
  }

  return [...findings];
}

function captureProperties(
  properties: Record<string, any> | null | undefined,
  input: {
    capturedFrom?: string | undefined;
    sourceUrls?: string[] | undefined;
    relatedWikiIds?: string[] | undefined;
    relatedTaskIds?: string[] | undefined;
  },
): Record<string, any> {
  const merged = mergeProperties(
    {
      doc_type: "capture",
      status: "inbox",
      validation_status: "draft",
      source_status: "user_provided",
      cite_required: false,
      captured_from: input.capturedFrom ?? "mcp",
      source_urls: input.sourceUrls ?? [],
      related_wiki_ids: input.relatedWikiIds ?? [],
      related_task_ids: input.relatedTaskIds ?? [],
      rag: {
        include: true,
        retrieval_priority: "normal",
        chunking: "section",
      },
    },
    properties,
  );

  return {
    ...merged,
    related_wiki_ids: uniq(arrayProperty(merged["related_wiki_ids"])),
    related_task_ids: uniq(arrayProperty(merged["related_task_ids"])),
    source_urls: uniq(arrayProperty(merged["source_urls"])),
  };
}

async function updateCaptureLinks(
  wikiSvc: WikiService,
  userId: string,
  pageId: string,
  input: {
    status?: string | undefined;
    relatedWikiIds?: string[] | undefined;
    relatedTaskIds?: string[] | undefined;
    triageNote?: string | undefined;
  },
) {
  const page = await wikiSvc.getPage(pageId);
  if (!page) return undefined;

  const current = page.properties ?? {};
  const relatedWikiIds = uniq([
    ...arrayProperty(current["related_wiki_ids"]),
    ...(input.relatedWikiIds ?? []),
  ]);
  const relatedTaskIds = uniq([
    ...arrayProperty(current["related_task_ids"]),
    ...(input.relatedTaskIds ?? []),
  ]);

  return wikiSvc.updatePage(pageId, userId, {
    properties: {
      ...current,
      ...(input.status ? { status: input.status } : {}),
      ...(input.triageNote ? { triage_note: input.triageNote } : {}),
      triaged_at:
        input.status === "triaged"
          ? new Date().toISOString()
          : current["triaged_at"],
      related_wiki_ids: relatedWikiIds,
      related_task_ids: relatedTaskIds,
    },
  });
}

export function registerSecondBrainTools(
  server: McpServer,
  wikiSvc: WikiService,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "create_capture",
    {
      description:
        "Create a second-brain inbox capture as a wiki page. Use this when the user asks to remember, save, capture, or preserve context whose final destination is unclear. Captures use properties doc_type=capture and status=inbox, and may optionally create a triage task linked with task:// and wiki:// Markdown.",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        title: z.string().min(1).max(200).describe("Capture title"),
        content: z
          .string()
          .describe("Human-readable Markdown body for the captured context"),
        projectId: z
          .string()
          .optional()
          .describe("Optional project ID to associate with the capture page"),
        parentId: z
          .string()
          .optional()
          .describe(
            "Optional parent wiki page, such as a Second Brain Inbox page",
          ),
        capturedFrom: z
          .string()
          .optional()
          .describe(
            "Where the capture came from, e.g. codex, claude, chatgpt, browser",
          ),
        sourceUrls: z
          .array(z.string())
          .optional()
          .describe("Source URLs related to this capture"),
        relatedWikiIds: z
          .array(z.string())
          .optional()
          .describe("Existing wiki page IDs related to this capture"),
        relatedTaskIds: z
          .array(z.string())
          .optional()
          .describe("Existing task IDs related to this capture"),
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe("Additional frontmatter-like metadata properties"),
        createTriageTask: z
          .boolean()
          .optional()
          .describe("When true, create a todo task to triage this capture"),
        taskProjectId: z
          .string()
          .optional()
          .describe(
            "Project ID for the triage task; defaults to projectId when present",
          ),
        taskEndDate: dateSchema
          .optional()
          .describe("Optional triage task due date in YYYY-MM-DD format"),
      },
    },
    async ({
      orgId,
      title,
      content,
      projectId,
      parentId,
      capturedFrom,
      sourceUrls,
      relatedWikiIds,
      relatedTaskIds,
      properties,
      createTriageTask,
      taskProjectId,
      taskEndDate,
    }) => {
      const capturePage = await wikiSvc.createPage(orgId, userId, {
        title,
        content,
        parentId,
        projectId,
        properties: captureProperties(properties ?? null, {
          capturedFrom,
          sourceUrls,
          relatedWikiIds,
          relatedTaskIds,
        }),
      });

      if (!createTriageTask) return jsonText({ capturePage });

      const projectForTask = taskProjectId ?? projectId;
      if (!projectForTask) {
        return jsonText({
          capturePage,
          warning:
            "Capture created, but no projectId/taskProjectId was provided for the triage task.",
        });
      }

      const dueDate = taskEndDate ?? today();
      const triageTask = taskSvc.createTask(
        projectForTask,
        userId,
        {
          title: `Triage capture: ${title}`,
          description: `Review [${title}](wiki://${capturePage.id}) and promote it into durable wiki knowledge, actionable tasks, or discard it with a note.`,
          objective: "Triage second-brain capture",
          startDate: today(),
          endDate: dueDate,
          column: "todo",
          globalSubject: "Second Brain",
          backgroundColor: "#f97316",
          tags: ["capture", "inbox", "triage"],
        },
        true,
      );

      const updatedCapturePage = await updateCaptureLinks(
        wikiSvc,
        userId,
        capturePage.id,
        { relatedTaskIds: [triageTask.id] },
      );

      return jsonText({
        capturePage: updatedCapturePage ?? capturePage,
        triageTask,
      });
    },
  );

  server.registerTool(
    "search_knowledge",
    {
      description:
        "Search the second-brain knowledge base across wiki page titles, content, properties, and tasks. Returns real wiki:// and task:// links so agents can reference existing knowledge without inventing ids.",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        query: z.string().min(1).describe("Search query"),
        projectId: z
          .string()
          .optional()
          .describe(
            "Optional project scope. Tasks are filtered to this project; wiki pages include org-level pages and pages mapped to this project.",
          ),
        docTypes: z
          .array(z.string())
          .optional()
          .describe("Optional wiki properties.doc_type filter"),
        statuses: z
          .array(z.string())
          .optional()
          .describe("Optional wiki properties.status filter"),
        includeWiki: z
          .boolean()
          .optional()
          .describe("Include wiki pages; defaults to true"),
        includeTasks: z
          .boolean()
          .optional()
          .describe("Include tasks; defaults to true"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum combined results; defaults to 10"),
      },
    },
    async ({
      orgId,
      query,
      projectId,
      docTypes,
      statuses,
      includeWiki,
      includeTasks,
      limit,
    }) => {
      const resultLimit = limit ?? 10;
      const tokens = searchTokens(query);
      const results: Array<Record<string, any>> = [];
      let wikiCandidates = 0;
      let taskCandidates = 0;

      if (includeWiki ?? true) {
        const summaries = await wikiSvc.listPages(orgId, userId);
        const pages = await Promise.all(
          summaries.map((summary) => wikiSvc.getPage(summary.id)),
        );

        for (const page of pages) {
          if (!page) continue;

          if (
            projectId &&
            page.projectId !== null &&
            page.projectId !== projectId
          ) {
            continue;
          }

          const properties = page.properties ?? {};
          if (
            docTypes?.length &&
            !docTypes.includes(String(properties["doc_type"] ?? ""))
          ) {
            continue;
          }
          if (
            statuses?.length &&
            !statuses.includes(String(properties["status"] ?? ""))
          ) {
            continue;
          }

          wikiCandidates += 1;
          const score = scoreParts(query, tokens, [
            { value: page.title, weight: 6 },
            { value: page.content, weight: 3 },
            { value: properties, weight: 2 },
          ]);
          if (score <= 0) continue;

          results.push({
            type: "wiki_page",
            id: page.id,
            title: page.title,
            link: `wiki://${page.id}`,
            score,
            snippet:
              snippetFrom(page.content, tokens) ??
              snippetFrom(properties, tokens),
            parentId: page.parentId,
            projectId: page.projectId,
            properties,
          });
        }
      }

      if (includeTasks ?? true) {
        const tasks = projectId
          ? taskSvc.listTasks(projectId, { search: query })
          : taskSvc.searchTasksInOrg(orgId, query, resultLimit * 3);
        taskCandidates = tasks.length;

        for (const task of tasks) {
          const score = scoreParts(query, tokens, [
            { value: task.title, weight: 6 },
            { value: task.description, weight: 3 },
            { value: task.objective, weight: 2 },
            { value: task.globalSubject, weight: 2 },
            { value: task.tags, weight: 1 },
          ]);
          if (score <= 0) continue;

          results.push({
            type: "task",
            id: task.id,
            title: task.title,
            link: `task://${task.id}`,
            score,
            snippet:
              snippetFrom(task.description, tokens) ??
              snippetFrom(task.objective, tokens),
            projectId: task.projectId,
            projectName: "projectName" in task ? task.projectName : undefined,
            column: task.column,
            tags: task.tags,
          });
        }
      }

      results.sort((a, b) => {
        if (b["score"] !== a["score"]) return b["score"] - a["score"];
        return String(a["title"]).localeCompare(String(b["title"]));
      });

      return jsonText({
        query,
        results: results.slice(0, resultLimit),
        totals: {
          wikiCandidates,
          taskCandidates,
          matched: results.length,
        },
      });
    },
  );

  server.registerTool(
    "audit_knowledge_freshness",
    {
      description:
        "Audit wiki pages for second-brain freshness and anti-hallucination guardrails. Finds pages with stale review dates, expired effective dates, missing required sources, draft validation status, stale freshness metadata, or missing doc_type. Can optionally create review tasks linked back with wiki://.",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        projectId: z
          .string()
          .optional()
          .describe(
            "Optional project scope. Required when createTasks is true.",
          ),
        todayDate: dateSchema
          .optional()
          .describe(
            "Date to evaluate against in YYYY-MM-DD; defaults to today",
          ),
        createTasks: z
          .boolean()
          .optional()
          .describe("Create review tasks for findings; defaults to false"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            "Maximum pages to return or create tasks for; defaults to 20",
          ),
      },
    },
    async ({ orgId, projectId, todayDate, createTasks, limit }) => {
      const effectiveToday = todayDate ?? today();
      const resultLimit = limit ?? 20;

      if (createTasks && !projectId) {
        return textResult(
          "projectId is required when createTasks is true",
          true,
        );
      }

      const summaries = await wikiSvc.listPages(orgId, userId);
      const findings = summaries
        .filter((page) => {
          if (!projectId) return true;
          return page.projectId === null || page.projectId === projectId;
        })
        .map((page) => ({
          page,
          findings: freshnessFindings(page, effectiveToday),
        }))
        .filter(({ page, findings }) => {
          const properties = page.properties ?? {};
          return (
            findings.length > 0 &&
            !(
              stringProperty(properties["doc_type"]) === "capture" &&
              stringProperty(properties["status"], "inbox") === "inbox"
            )
          );
        })
        .slice(0, resultLimit);

      const tasksCreated = [];
      if (createTasks && projectId) {
        for (const { page, findings: pageFindings } of findings) {
          const task = taskSvc.createTask(
            projectId,
            userId,
            {
              title: `Review freshness: ${page.title}`,
              description: `Validate whether [${page.title}](wiki://${page.id}) is still current.\n\nFindings: ${pageFindings.join(", ")}`,
              objective: "Refresh second-brain knowledge",
              startDate: effectiveToday,
              endDate: effectiveToday,
              column: "todo",
              globalSubject: "Second Brain",
              backgroundColor: "#0ea5e9",
              tags: ["freshness", "review", "second-brain"],
            },
            true,
          );

          const fullPage = await wikiSvc.getPage(page.id);
          if (fullPage) {
            const current = fullPage.properties ?? {};
            const freshness = objectProperty(current["freshness"]);
            await wikiSvc.updatePage(page.id, userId, {
              properties: {
                ...current,
                freshness: {
                  ...freshness,
                  status: "review_requested",
                  review_task_id: task.id,
                  requested_at: new Date().toISOString(),
                  findings: pageFindings,
                },
                related_task_ids: uniq([
                  ...arrayProperty(current["related_task_ids"]),
                  task.id,
                ]),
              },
            });
          }

          tasksCreated.push({
            pageId: page.id,
            taskId: task.id,
            link: `task://${task.id}`,
          });
        }
      }

      return jsonText({
        todayDate: effectiveToday,
        findings: findings.map(({ page, findings: pageFindings }) => ({
          pageId: page.id,
          title: page.title,
          link: `wiki://${page.id}`,
          projectId: page.projectId,
          findings: pageFindings,
          properties: page.properties ?? null,
        })),
        tasksCreated,
      });
    },
  );

  server.registerTool(
    "promote_capture_to_task",
    {
      description:
        "Promote an existing capture wiki page into an actionable Kanban task, link the task back to the capture with wiki://, and mark the capture as triaged.",
      inputSchema: {
        capturePageId: z.string().describe("Capture wiki page ID"),
        projectId: z.string().describe("Project ID for the created task"),
        title: z.string().min(1).max(500).describe("Task title"),
        description: z
          .string()
          .optional()
          .describe("Additional task description Markdown"),
        objective: z.string().optional().describe("Task objective"),
        startDate: dateSchema.optional().describe("Start date (YYYY-MM-DD)"),
        endDate: dateSchema.optional().describe("End date (YYYY-MM-DD)"),
        tags: z.array(z.string()).optional().describe("Task tags"),
        triageNote: z
          .string()
          .optional()
          .describe("Optional note stored on the capture properties"),
      },
    },
    async ({
      capturePageId,
      projectId,
      title,
      description,
      objective,
      startDate,
      endDate,
      tags,
      triageNote,
    }) => {
      const capture = await wikiSvc.getPage(capturePageId);
      if (!capture) return textResult("Capture page not found", true);

      const task = taskSvc.createTask(
        projectId,
        userId,
        {
          title,
          description: [
            `Source capture: [${capture.title}](wiki://${capture.id})`,
            description,
          ]
            .filter(Boolean)
            .join("\n\n"),
          objective: objective ?? "Promoted from second-brain capture",
          startDate: startDate ?? today(),
          endDate: endDate ?? today(),
          column: "todo",
          globalSubject: "Second Brain",
          tags: uniq(["capture-promoted", ...(tags ?? [])]),
        },
        true,
      );

      const updatedCapture = await updateCaptureLinks(
        wikiSvc,
        userId,
        capturePageId,
        {
          status: "triaged",
          relatedTaskIds: [task.id],
          triageNote,
        },
      );

      return jsonText({ task, capturePage: updatedCapture });
    },
  );

  server.registerTool(
    "promote_capture_to_wiki_page",
    {
      description:
        "Promote an existing capture into a durable wiki page, link the new page back to the capture, and mark the capture as triaged.",
      inputSchema: {
        capturePageId: z.string().describe("Capture wiki page ID"),
        title: z.string().min(1).max(200).describe("New wiki page title"),
        content: z.string().describe("New wiki page Markdown content"),
        parentId: z.string().optional().describe("Optional parent page ID"),
        projectId: z.string().optional().describe("Optional project mapping"),
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe("Metadata properties for the promoted wiki page"),
        triageNote: z
          .string()
          .optional()
          .describe("Optional note stored on the capture properties"),
      },
    },
    async ({
      capturePageId,
      title,
      content,
      parentId,
      projectId,
      properties,
      triageNote,
    }) => {
      const capture = await wikiSvc.getPage(capturePageId);
      if (!capture) return textResult("Capture page not found", true);

      const wikiPage = await wikiSvc.createPage(
        capture.organizationId,
        userId,
        {
          title,
          content: `${content.trim()}\n\nSource capture: [${capture.title}](wiki://${capture.id})\n`,
          parentId,
          projectId: projectId ?? capture.projectId ?? undefined,
          properties: mergeProperties(
            {
              doc_type: "note",
              validation_status: "draft",
              source_status: "user_provided",
              related_wiki_ids: [capture.id],
              related_task_ids: [],
            },
            properties ?? null,
          ),
        },
      );

      const updatedCapture = await updateCaptureLinks(
        wikiSvc,
        userId,
        capturePageId,
        {
          status: "triaged",
          relatedWikiIds: [wikiPage.id],
          triageNote,
        },
      );

      return jsonText({ wikiPage, capturePage: updatedCapture });
    },
  );
}
