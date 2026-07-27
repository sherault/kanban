#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const installer = path.join(repoRoot, "scripts", "kanban-agent-install.mjs");
const envHelper = path.join(repoRoot, "scripts", "kanban-agent-env.mjs");
const tmpRoot = mkdtempSync(path.join(tmpdir(), "kanban-agent-install-"));
const kanbanHome = path.join(tmpRoot, ".kanban");
const workspace = path.join(tmpRoot, "workspace");
const rawKey = "kbk_smoke_test_key_secret";

function executeInstaller(args) {
  execFileSync("node", [installer, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      KANBAN_HOME: kanbanHome,
      KANBAN_APP_DIR: repoRoot,
    },
    stdio: "pipe",
  });
}

function runInstaller(integrationName, extraArgs = []) {
  executeInstaller([
    "--mode",
    "external",
    "--url",
    "http://localhost:3999",
    "--email",
    "smoke@example.com",
    "--mcp-key",
    rawKey,
    "--clients",
    "codex,claude,antigravity",
    "--workspace",
    workspace,
    "--integration-name",
    integrationName,
    "--skip-provision",
    "--no-keychain",
    ...extraArgs,
  ]);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return readFileSync(path.join(workspace, relativePath), "utf8");
}

try {
  mkdirSync(workspace, { recursive: true });
  execFileSync("git", ["init"], { cwd: workspace, stdio: "ignore" });

  writeFileSync(
    path.join(workspace, ".mcp.json"),
    '{ "mcpServers": { "existing": { "url": "http://existing.test/mcp/" } } }\n',
  );
  mkdirSync(path.join(workspace, ".codex"), { recursive: true });
  writeFileSync(
    path.join(workspace, ".codex", "config.toml"),
    '[mcp_servers.existing]\nurl = "http://existing.test/mcp/"\n',
  );
  execFileSync("git", ["add", ".mcp.json", ".codex/config.toml"], {
    cwd: workspace,
    stdio: "ignore",
  });

  runInstaller("Work Memory");
  let collisionDetected = false;
  try {
    runInstaller("Work Memory");
  } catch {
    collisionDetected = true;
  }
  assert(collisionDetected, "same-name reinstall should detect a collision");
  runInstaller("Work Memory", ["--replace-existing"]);
  runInstaller("Personal Brain");
  writeFileSync(path.join(kanbanHome, "docker-compose.yml"), "existing\n");
  let dockerCollisionDetected = false;
  try {
    executeInstaller([
      "--mode",
      "docker",
      "--port",
      "3998",
      "--email",
      "smoke@example.com",
      "--mcp-key",
      rawKey,
      "--clients",
      "codex",
      "--workspace",
      workspace,
      "--integration-name",
      "Docker Probe",
      "--skip-provision",
      "--no-keychain",
    ]);
  } catch {
    dockerCollisionDetected = true;
  }
  assert(
    dockerCollisionDetected,
    "Docker install should stop when local install files exist",
  );

  const agentEnv = readFileSync(
    path.join(kanbanHome, "agent-work-memory.env"),
    "utf8",
  );
  const mcpJson = read(".mcp.json");
  const codexConfig = read(".codex/config.toml");
  const antigravityConfig = read(".antigravity/mcp.json");
  const agents = read("AGENTS.md");
  const claude = read("CLAUDE.md");
  const installedSkill = read(
    ".codex/skills/work-memory-second-brain/SKILL.md",
  );

  assert(
    agentEnv.includes(`WORK_MEMORY_MCP_API_KEY=${rawKey}`),
    "agent.env lost MCP key",
  );
  assert(
    mcpJson.includes("WORK_MEMORY_MCP_API_KEY") &&
      mcpJson.includes("PERSONAL_BRAIN_MCP_API_KEY") &&
      mcpJson.includes('"existing"') &&
      !mcpJson.includes(rawKey),
    ".mcp.json should preserve existing servers and use env placeholders",
  );
  assert(
    codexConfig.includes("WORK_MEMORY_MCP_API_KEY") &&
      codexConfig.includes("PERSONAL_BRAIN_MCP_API_KEY") &&
      codexConfig.includes("[mcp_servers.existing]") &&
      !codexConfig.includes(rawKey),
    ".codex/config.toml should preserve existing servers and use env placeholders",
  );
  assert(
    antigravityConfig.includes("WORK_MEMORY_MCP_API_KEY") &&
      antigravityConfig.includes("PERSONAL_BRAIN_MCP_API_KEY") &&
      !antigravityConfig.includes(rawKey),
    ".antigravity/mcp.json should merge named servers without raw keys",
  );
  assert(
    existsSync(
      path.join(
        workspace,
        ".codex",
        "skills",
        "work-memory-second-brain",
        "SKILL.md",
      ),
    ),
    "Codex skill was not installed",
  );
  assert(
    existsSync(
      path.join(workspace, ".claude", "skills", "work-memory-second-brain.md"),
    ),
    "Claude skill was not installed",
  );
  assert(
    installedSkill.includes('name: "work-memory-second-brain"') &&
      installedSkill.includes("`work-memory`") &&
      !installedSkill.includes("{{"),
    "named skill template was not rendered",
  );
  assert(
    existsSync(path.join(workspace, ".antigravity", "mcp.json")),
    "Antigravity MCP config was not installed",
  );
  assert(
    (agents.match(/BEGIN WORK MEMORY SECOND BRAIN/g) || []).length === 1 &&
      (agents.match(/BEGIN PERSONAL BRAIN SECOND BRAIN/g) || []).length === 1,
    "AGENTS.md managed block should be idempotent",
  );
  assert(
    (claude.match(/BEGIN WORK MEMORY SECOND BRAIN/g) || []).length === 1 &&
      (claude.match(/BEGIN PERSONAL BRAIN SECOND BRAIN/g) || []).length === 1,
    "CLAUDE.md managed block should be idempotent",
  );
  const loadedKey = execFileSync(
    "node",
    [
      envHelper,
      "--env",
      path.join(kanbanHome, "agent-work-memory.env"),
      "--env",
      path.join(kanbanHome, "agent-personal-brain.env"),
      "--",
      "node",
      "-e",
      "process.stdout.write([process.env.WORK_MEMORY_MCP_API_KEY, process.env.PERSONAL_BRAIN_MCP_API_KEY].join(','))",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert(
    loadedKey === `${rawKey},${rawKey}`,
    "agent env helper did not load named MCP keys",
  );

  console.log("Installer smoke test passed.");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
