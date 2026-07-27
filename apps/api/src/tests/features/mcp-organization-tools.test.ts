import { describe, expect, it } from "vitest";
import { registerOrganizationTools } from "../../features/mcp/mcp-server/organization-tools.js";

function makeHarness() {
  const tools = new Map<string, (input: any) => any>();
  const configs = new Map<string, any>();
  const listMembersCalls: string[] = [];

  const server = {
    registerTool(name: string, config: unknown, handler: any) {
      tools.set(name, handler);
      configs.set(name, config);
    },
  };

  const orgSvc = {
    listOrgs: () => [],
    createOrg: () => ({}),
    listMembers(orgId: string) {
      listMembersCalls.push(orgId);
      return [
        {
          userId: "user-1",
          organizationId: orgId,
          role: "owner",
          user: {
            id: "user-1",
            displayName: "Ada",
            email: "ada@example.com",
          },
        },
        {
          userId: "user-2",
          organizationId: orgId,
          role: "member",
          user: {
            id: "user-2",
            displayName: "Grace",
            email: "grace@example.com",
          },
        },
      ];
    },
  };

  registerOrganizationTools(server as any, orgSvc as any, "user-1");

  return { tools, configs, listMembersCalls };
}

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe("list_members MCP tool", () => {
  it("is registered with an orgId input schema", () => {
    const { tools, configs } = makeHarness();

    expect(tools.get("list_members")).toBeDefined();
    expect(configs.get("list_members").inputSchema.orgId).toBeDefined();
  });

  it("forwards the orgId to the organization service", () => {
    const { tools, listMembersCalls } = makeHarness();

    tools.get("list_members")!({ orgId: "org-1" });

    expect(listMembersCalls).toEqual(["org-1"]);
  });

  it("returns members as flat {id, displayName, role} entries", () => {
    const { tools } = makeHarness();

    const members = parse(tools.get("list_members")!({ orgId: "org-1" }));

    expect(members).toEqual([
      { id: "user-1", displayName: "Ada", role: "owner" },
      { id: "user-2", displayName: "Grace", role: "member" },
    ]);
  });
});
