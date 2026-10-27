import { describe, it, expect } from "vitest";
import { registerTaskLifecycleTools } from "../../features/mcp/mcp-server/task-lifecycle-tools.js";

function makeHarness() {
  const tools = new Map<string, (input: any) => any>();
  const calls: any[] = [];
  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };
  const taskSvc = {
    transferTask(taskId: string, userId: string, input: any, isMcp: boolean) {
      calls.push({ taskId, userId, input, isMcp });
      return { id: taskId, projectId: input.targetProjectId };
    },
  };
  registerTaskLifecycleTools(server as any, taskSvc as any, "user-1");
  return { tools, calls };
}

describe("transfer_task MCP tool", () => {
  it("forwards to the task service as an MCP call and returns the task", () => {
    const { tools, calls } = makeHarness();

    const result = tools.get("transfer_task")!({
      taskId: "task-1",
      targetProjectId: "project-2",
    });

    expect(calls).toEqual([
      {
        taskId: "task-1",
        userId: "user-1",
        input: { targetProjectId: "project-2" },
        isMcp: true,
      },
    ]);
    expect(JSON.parse(result.content[0].text)).toEqual({
      id: "task-1",
      projectId: "project-2",
    });
  });
});
