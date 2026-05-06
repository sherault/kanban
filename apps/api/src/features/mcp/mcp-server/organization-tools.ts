import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OrganizationService } from "../../organization/organization.service.js";
import { jsonText } from "./utils.js";

export function registerOrganizationTools(
  server: McpServer,
  orgSvc: OrganizationService,
  userId: string,
) {
  server.registerTool(
    "list_organizations",
    { description: "List all organizations the current user belongs to" },
    () => jsonText(orgSvc.listOrgs(userId)),
  );

  server.registerTool(
    "create_organization",
    {
      description: "Create a new organization",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Organization name"),
        website: z.string().url().optional().describe("Optional website URL"),
      },
    },
    ({ name, website }) =>
      jsonText(orgSvc.createOrg(userId, { name, website: website ?? null })),
  );
}
