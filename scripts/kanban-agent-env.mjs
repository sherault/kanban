#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function parseArgs(args) {
  const parsed = { command: [], envFiles: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      parsed.command = args.slice(i + 1);
      break;
    }
    if (arg === "--env") {
      parsed.envFiles.push(args[i + 1]);
      i += 1;
    } else if (arg === "--help") {
      parsed.help = true;
    } else {
      parsed.command = args.slice(i);
      break;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Load Kanban MCP env and run an agent command.

Usage:
  node scripts/kanban-agent-env.mjs -- codex
  node scripts/kanban-agent-env.mjs -- claude
  node scripts/kanban-agent-env.mjs --env ~/.kanban/agent.env -- codex
  node scripts/kanban-agent-env.mjs --env ~/.kanban/agent-work.env --env ~/.kanban/agent-personal.env -- codex

Resolves the MCP API key named by KANBAN_MCP_KEY_ENV from macOS Keychain or
Linux secret-tool when agent.env contains KANBAN_MCP_KEY_STORAGE=keychain.
`);
}

function parseEnvFile(filePath) {
  const env = {};
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
}

function hasCommand(command) {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function readMacKeychain(account) {
  if (process.platform !== "darwin" || !hasCommand("security")) return "";
  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", account, "-s", "kanban-mcp-api-key", "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

function readSecretTool(account) {
  if (!hasCommand("secret-tool")) return "";
  const result = spawnSync(
    "secret-tool",
    ["lookup", "service", "kanban-mcp-api-key", "account", account],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

function resolveSecret(env) {
  const keyEnvName = env.KANBAN_MCP_KEY_ENV || "KANBAN_MCP_API_KEY";
  if (env[keyEnvName]) return env;
  if (
    env.KANBAN_MCP_KEY_STORAGE !== "keychain" ||
    !env.KANBAN_MCP_KEY_ACCOUNT
  ) {
    return env;
  }

  const apiKey =
    readMacKeychain(env.KANBAN_MCP_KEY_ACCOUNT) ||
    readSecretTool(env.KANBAN_MCP_KEY_ACCOUNT);
  if (!apiKey) {
    console.error(
      `Kanban MCP API key was not found in the OS keychain for account: ${env.KANBAN_MCP_KEY_ACCOUNT}`,
    );
    process.exit(1);
  }

  return { ...env, [keyEnvName]: apiKey };
}

const options = parseArgs(process.argv.slice(2));

if (options.help || options.command.length === 0) {
  printHelp();
  process.exit(options.help ? 0 : 1);
}

const envFiles = (
  options.envFiles.length > 0
    ? options.envFiles
    : [path.join(homedir(), ".kanban", "agent.env")]
).map((envFile) => path.resolve(envFile.replace(/^~/, homedir())));

const agentEnv = {};
for (const envFile of envFiles) {
  if (!existsSync(envFile)) {
    console.error(`Kanban env file not found: ${envFile}`);
    process.exit(1);
  }
  Object.assign(agentEnv, resolveSecret(parseEnvFile(envFile)));
}

const child = spawn(options.command[0], options.command.slice(1), {
  stdio: "inherit",
  env: {
    ...process.env,
    ...agentEnv,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
