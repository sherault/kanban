#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const installRoot =
  process.env["KANBAN_HOME"] || path.join(homedir(), ".kanban");
const appDir = process.env["KANBAN_APP_DIR"] || repoRoot;
const dataDir = path.join(installRoot, "data");
const composePath = path.join(installRoot, "docker-compose.yml");
const agentEnvPath = path.join(installRoot, "agent.env");
const skillSource = path.join(
  repoRoot,
  "scripts",
  "agent-install",
  "skills",
  "kanban-second-brain",
  "SKILL.md",
);
const templateDir = path.join(
  repoRoot,
  "scripts",
  "agent-install",
  "templates",
);
const placeholderConfigPaths = new Set();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "");
}

function mcpUrlFor(baseUrl) {
  return `${normalizeUrl(baseUrl)}/mcp/`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "inherit",
    input: options.input,
    encoding: options.input ? "utf8" : undefined,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${stderr}`);
  }
  return result.stdout?.toString().trim() ?? "";
}

function hasCommand(command) {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

async function ask(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function choose(question, options, defaultValue) {
  const labels = options.map((option) => option.value).join("/");
  while (true) {
    const answer = await ask(`${question} (${labels})`, defaultValue);
    const match = options.find((option) => option.value === answer);
    if (match) return match.value;
    console.log(`Choose one of: ${labels}`);
  }
}

async function chooseMany(question, defaults) {
  const answer = await ask(question, defaults.join(","));
  return answer
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function showCredentialsOnce(email, password, webUrl) {
  console.log("");
  console.log("Kanban user created. Store these credentials now:");
  console.log("");
  console.log(`  URL:      ${webUrl}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("");
}

async function waitForEnter(message) {
  await rl.question(`${message} Press Enter to continue.`);
}

function clearScreen() {
  if (process.stdout.isTTY) process.stdout.write("\x1Bc");
}

function writeFilePrivate(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // chmod is best effort on non-POSIX filesystems.
  }
}

async function writeComposeFile(webPort) {
  const appPath = appDir.replaceAll("\\", "/");
  const caddyPath = path.join(appDir, "Caddyfile").replaceAll("\\", "/");
  const content = `services:
  api:
    build:
      context: "${appPath}"
      dockerfile: Dockerfile
      target: api
    env_file:
      - ".env"
    environment:
      DATABASE_URL: /data/kanban.db
      JWT_SECRET: \${JWT_SECRET}
      REFRESH_SECRET: \${REFRESH_SECRET}
      PORT: 3001
      APP_URL: \${APP_URL:-http://localhost:${webPort}}
      SMTP_HOST: \${SMTP_HOST:-}
      SMTP_PORT: \${SMTP_PORT:-587}
      SMTP_SECURE: \${SMTP_SECURE:-false}
      SMTP_USER: \${SMTP_USER:-}
      SMTP_PASS: \${SMTP_PASS:-}
      SMTP_FROM: \${SMTP_FROM:-noreply@example.com}
    volumes:
      - ./data:/data
    restart: unless-stopped

  web:
    build:
      context: "${appPath}"
      dockerfile: Dockerfile
      target: web
    environment:
      API_URL: http://api:3001
      WS_URL: \${WS_URL:-}
      APP_URL: \${APP_URL:-http://localhost:${webPort}}
    depends_on:
      - api
    restart: unless-stopped

  proxy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "${webPort}:80"
    environment:
      DOMAIN: \${DOMAIN:-http://localhost}
    volumes:
      - "${caddyPath}:/etc/caddy/Caddyfile:ro"
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
      - web

volumes:
  caddy_data:
  caddy_config:
`;
  await mkdir(installRoot, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await writeFile(composePath, content);
}

async function writeDockerEnv(webUrl) {
  const content = `JWT_SECRET=${generateSecret()}
REFRESH_SECRET=${generateSecret()}
APP_URL=${webUrl}
PUBLIC_API_URL=${webUrl}
LOG_LEVEL=info
ENABLE_HSTS=false
WS_URL=${webUrl.replace(/^http/, "ws")}/ws
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com
`;
  await writeFile(path.join(installRoot, ".env"), content, { mode: 0o600 });
}

async function waitForDockerDatabase(timeoutMs = 120000) {
  const dbPath = path.join(dataDir, "kanban.db");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(dbPath)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Timed out waiting for Docker database creation");
}

function dockerCompose(args, options = {}) {
  return run("docker", ["compose", "-f", composePath, ...args], options);
}

async function setupDocker() {
  if (!hasCommand("docker")) {
    throw new Error(
      "Docker was not found. Install Docker or choose external mode.",
    );
  }

  const webPort = await ask("Local web port", "3000");
  const webUrl = `http://localhost:${webPort}`;
  await writeComposeFile(webPort);
  await writeDockerEnv(webUrl);

  console.log("");
  console.log(`Starting Kanban with Docker in ${installRoot}`);
  dockerCompose(["up", "-d", "--build"], { cwd: installRoot });
  await waitForDockerDatabase();

  return {
    mode: "docker",
    webUrl,
    mcpUrl: mcpUrlFor(webUrl),
  };
}

async function setupExternal() {
  const webUrl = normalizeUrl(
    await ask("Kanban URL", "https://kanban.example.com"),
  );
  return {
    mode: "external",
    webUrl,
    mcpUrl: mcpUrlFor(webUrl),
  };
}

async function setupNative() {
  const webUrl = normalizeUrl(
    await ask("Kanban URL for this native instance", "http://localhost:3009"),
  );
  return {
    mode: "native",
    webUrl,
    mcpUrl: mcpUrlFor(webUrl),
  };
}

const dockerSeedCode = String.raw`
const fs = require("node:fs");
const { randomBytes, randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const argon2 = require("argon2");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

(async () => {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const db = new Database("/data/kanban.db");
  db.pragma("foreign_keys = ON");

  const now = new Date().toISOString();
  const userId = randomUUID();
  const orgId = randomUUID();
  const projectId = randomUUID();
  const inboxPageId = randomUUID();
  const indexPageId = randomUUID();
  const taskId = randomUUID();
  const keyId = randomUUID();
  const keySecret = randomBytes(32).toString("hex");
  const rawKey = "kbk_" + keyId + "_" + keySecret;

  const passwordHash = await argon2.hash(input.password);
  const hashedKey = await argon2.hash(rawKey);

  const existingUser = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(input.email);
  const finalUserId = existingUser?.id ?? userId;

  if (existingUser) {
    db.prepare(
      "UPDATE users SET password_hash = ?, display_name = ?, email_verified = 1 WHERE id = ?",
    ).run(passwordHash, input.displayName, finalUserId);
  } else {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, email_verified, max_open_panels, enable_notifications, max_notifications, notification_duration, created_at) VALUES (?, ?, ?, ?, 1, 5, 1, 3, 5, ?)",
    ).run(finalUserId, input.email, passwordHash, input.displayName, now);
  }

  const existingOrg = db
    .prepare("SELECT id FROM organizations WHERE name = ?")
    .get(input.orgName);
  const finalOrgId = existingOrg?.id ?? orgId;
  if (!existingOrg) {
    db.prepare(
      "INSERT INTO organizations (id, name, website, created_at) VALUES (?, ?, NULL, ?)",
    ).run(finalOrgId, input.orgName, now);
  }

  db.prepare(
    "INSERT OR REPLACE INTO memberships (user_id, organization_id, role) VALUES (?, ?, 'owner')",
  ).run(finalUserId, finalOrgId);

  const existingProject = db
    .prepare("SELECT id FROM projects WHERE organization_id = ? AND name = ?")
    .get(finalOrgId, input.projectName);
  const finalProjectId = existingProject?.id ?? projectId;
  if (!existingProject) {
    db.prepare(
      "INSERT INTO projects (id, organization_id, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(finalProjectId, finalOrgId, input.projectName, now);
  }

  function upsertPage(id, title, parentId, content, properties) {
    const existing = db
      .prepare(
        "SELECT id FROM wiki_pages WHERE organization_id = ? AND project_id = ? AND title = ?",
      )
      .get(finalOrgId, finalProjectId, title);
    if (existing) return existing.id;
    db.prepare(
      "INSERT INTO wiki_pages (id, organization_id, project_id, parent_id, title, slug, content, properties, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      finalOrgId,
      finalProjectId,
      parentId,
      title,
      slugify(title),
      content,
      JSON.stringify(properties),
      finalUserId,
      finalUserId,
      now,
      now,
    );
    return id;
  }

  const finalIndexPageId = upsertPage(
    indexPageId,
    "Second Brain Index",
    null,
    "# Second Brain Index\n\nUse this page as the top-level map for durable notes, decisions, sources, and capture workflows.\n\n- [Inbox](wiki://" + inboxPageId + ")\n",
    {
      doc_type: "index",
      status: "active",
      validation_status: "draft",
      source_status: "user_provided",
      rag: { include: true, retrieval_priority: "high", chunking: "section" },
      related_wiki_ids: [inboxPageId],
      related_task_ids: [],
    },
  );

  const finalInboxPageId = upsertPage(
    inboxPageId,
    "Second Brain Inbox",
    finalIndexPageId,
    "# Second Brain Inbox\n\nCapture raw notes here when their final destination is unclear. Triage captures into durable wiki pages or actionable tasks, then mark them with status: triaged in properties.\n",
    {
      doc_type: "capture_inbox",
      status: "active",
      validation_status: "draft",
      source_status: "user_provided",
      cite_required: false,
      related_wiki_ids: [finalIndexPageId],
      related_task_ids: [],
    },
  );

  db.prepare(
    "UPDATE wiki_pages SET content = ?, properties = ?, updated_at = ?, updated_by = ? WHERE id = ?",
  ).run(
    "# Second Brain Index\n\nUse this page as the top-level map for durable notes, decisions, sources, and capture workflows.\n\n- [Inbox](wiki://" + finalInboxPageId + ")\n",
    JSON.stringify({
      doc_type: "index",
      status: "active",
      validation_status: "draft",
      source_status: "user_provided",
      rag: { include: true, retrieval_priority: "high", chunking: "section" },
      related_wiki_ids: [finalInboxPageId],
      related_task_ids: [],
    }),
    now,
    finalUserId,
    finalIndexPageId,
  );

  const existingTask = db
    .prepare("SELECT id FROM tasks WHERE project_id = ? AND title = ?")
    .get(finalProjectId, "Triage second-brain inbox");
  const finalTaskId = existingTask?.id ?? taskId;
  if (!existingTask) {
    db.prepare(
      "INSERT INTO tasks (id, project_id, column, title, description, objective, start_date, end_date, background_color, global_subject, reporter_id, position, created_at, updated_at) VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    ).run(
      finalTaskId,
      finalProjectId,
      "Triage second-brain inbox",
      "Review [Second Brain Inbox](wiki://" + finalInboxPageId + ") and promote captures into wiki pages or tasks.",
      "Keep captured knowledge connected to action.",
      today(),
      today(),
      "#f97316",
      "Second Brain",
      finalUserId,
      now,
      now,
    );
    for (const tag of ["second-brain", "capture", "triage"]) {
      db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)").run(
        finalTaskId,
        tag,
      );
    }
  }

  db.prepare(
    "INSERT INTO api_keys (id, user_id, hashed_key, label, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(keyId, finalUserId, hashedKey, "Kanban second brain MCP", now);

  console.log(
    JSON.stringify({
      userId: finalUserId,
      organizationId: finalOrgId,
      projectId: finalProjectId,
      indexPageId: finalIndexPageId,
      inboxPageId: finalInboxPageId,
      triageTaskId: finalTaskId,
      rawKey,
    }),
  );
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
`;

async function seedDocker(instance) {
  const email = await ask(
    "Email for the verified Kanban user",
    "you@example.com",
  );
  const displayName = await ask("Display name", "Default User");
  const orgName = await ask("Organization name", "Default");
  const projectName = await ask("Project name", "Default");
  const password = generateSecret(12);

  const seedInput = JSON.stringify({
    email,
    displayName,
    orgName,
    projectName,
    password,
  });

  const output = dockerCompose(
    ["exec", "-T", "api", "node", "-e", dockerSeedCode],
    {
      input: seedInput,
      cwd: installRoot,
    },
  );
  const parsed = JSON.parse(output.split("\n").at(-1));

  showCredentialsOnce(email, password, instance.webUrl);
  await waitForEnter("After storing the credentials,");
  clearScreen();

  return {
    ...instance,
    email,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    indexPageId: parsed.indexPageId,
    inboxPageId: parsed.inboxPageId,
    triageTaskId: parsed.triageTaskId,
    rawKey: parsed.rawKey,
  };
}

async function apiRequest(baseUrl, pathName, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `${options.method || "GET"} ${pathName} failed: ${response.status} ${text}`,
    );
  }
  return response.json();
}

async function seedViaApi(instance) {
  const apiUrl = normalizeUrl(await ask("Public API URL", instance.webUrl));
  const email = await ask("Verified account email", "you@example.com");
  const password = await ask("Account password");
  const orgName = await ask("Organization name", "Default");
  const projectName = await ask("Project name", "Default");

  const login = await apiRequest(apiUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const token = login.accessToken;
  const orgs = await apiRequest(apiUrl, "/organizations", { token });
  let org = orgs.find((item) => item.name === orgName);
  if (!org) {
    org = await apiRequest(apiUrl, "/organizations", {
      method: "POST",
      token,
      body: { name: orgName },
    });
  }
  const projects = await apiRequest(
    apiUrl,
    `/organizations/${org.id}/projects`,
    {
      token,
    },
  );
  let project = projects.find((item) => item.name === projectName);
  if (!project) {
    project = await apiRequest(apiUrl, `/organizations/${org.id}/projects`, {
      method: "POST",
      token,
      body: { name: projectName },
    });
  }
  const key = await apiRequest(apiUrl, "/profile/api-keys", {
    method: "POST",
    token,
    body: { label: "Kanban second brain MCP" },
  });

  return {
    ...instance,
    apiUrl,
    email,
    organizationId: org.id,
    projectId: project.id,
    rawKey: key.rawKey,
  };
}

function storeInMacKeychain(account, rawKey) {
  if (process.platform !== "darwin" || !hasCommand("security")) return false;
  const result = spawnSync(
    "security",
    [
      "add-generic-password",
      "-a",
      account,
      "-s",
      "kanban-mcp-api-key",
      "-w",
      rawKey,
      "-U",
    ],
    { stdio: "ignore" },
  );
  return result.status === 0;
}

function storeInSecretTool(account, rawKey) {
  if (!hasCommand("secret-tool")) return false;
  const result = spawnSync(
    "secret-tool",
    [
      "store",
      "--label=Kanban MCP API Key",
      "service",
      "kanban-mcp-api-key",
      "account",
      account,
    ],
    { input: rawKey, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] },
  );
  return result.status === 0;
}

function storeSecret(instance) {
  const account = `${instance.email}:${instance.mcpUrl}`;
  const keychainStored =
    storeInMacKeychain(account, instance.rawKey) ||
    storeInSecretTool(account, instance.rawKey);

  const envContent = keychainStored
    ? `KANBAN_URL=${instance.webUrl}
KANBAN_MCP_URL=${instance.mcpUrl}
KANBAN_MCP_API_KEY=${instance.rawKey}
KANBAN_MCP_KEY_STORAGE=keychain
KANBAN_MCP_KEY_ACCOUNT=${account}
`
    : `KANBAN_URL=${instance.webUrl}
KANBAN_MCP_URL=${instance.mcpUrl}
KANBAN_MCP_API_KEY=${instance.rawKey}
`;

  writeFilePrivate(agentEnvPath, envContent);
  return keychainStored ? "keychain" : "agent.env";
}

function isGitTracked(workspaceDir, relativePath) {
  const result = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", relativePath],
    {
      cwd: workspaceDir,
      stdio: "ignore",
    },
  );
  return result.status === 0;
}

async function readTemplate(name) {
  return readFile(path.join(templateDir, name), "utf8");
}

async function appendManagedBlock(filePath, blockName, content) {
  const start = `<!-- BEGIN ${blockName} -->`;
  const end = `<!-- END ${blockName} -->`;
  let current = "";
  if (existsSync(filePath)) current = await readFile(filePath, "utf8");

  const block = `${start}\n${content.trim()}\n${end}`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  const next = pattern.test(current)
    ? current.replace(pattern, block)
    : `${current.trimEnd()}\n\n${block}\n`;
  await writeFile(filePath, next);
}

async function writeJson(filePath, value, privateFile = false) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
  if (privateFile) {
    try {
      chmodSync(filePath, 0o600);
    } catch {
      // chmod is best effort on non-POSIX filesystems.
    }
  }
}

async function mergeMcpJson(filePath, serverConfig, privateFile) {
  let current = {};
  if (existsSync(filePath)) {
    current = JSON.parse(await readFile(filePath, "utf8"));
  }
  current.mcpServers = {
    ...(current.mcpServers || {}),
    kanban: serverConfig,
  };
  await writeJson(filePath, current, privateFile);
}

async function appendTomlBlock(filePath, blockName, content) {
  const start = `# BEGIN ${blockName}`;
  const end = `# END ${blockName}`;
  let current = "";
  if (existsSync(filePath)) current = await readFile(filePath, "utf8");
  const block = `${start}\n${content.trim()}\n${end}`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  const next = pattern.test(current)
    ? current.replace(pattern, block)
    : `${current.trimEnd()}\n\n${block}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, next);
}

function authorizationValue(instance, workspaceDir, relativeConfigPath) {
  const tracked = isGitTracked(workspaceDir, relativeConfigPath);
  if (tracked) {
    placeholderConfigPaths.add(relativeConfigPath);
    return "Bearer ${KANBAN_MCP_API_KEY}";
  }
  return `Bearer ${instance.rawKey}`;
}

async function installCodex(workspaceDir, instance) {
  const agentsPath = path.join(workspaceDir, "AGENTS.md");
  await appendManagedBlock(
    agentsPath,
    "KANBAN SECOND BRAIN",
    await readTemplate("AGENTS.kanban-second-brain.md"),
  );

  await mkdir(
    path.join(workspaceDir, ".codex", "skills", "kanban-second-brain"),
    {
      recursive: true,
    },
  );
  await copyFile(
    skillSource,
    path.join(
      workspaceDir,
      ".codex",
      "skills",
      "kanban-second-brain",
      "SKILL.md",
    ),
  );

  const relativeConfigPath = path.join(".codex", "config.toml");
  const auth = authorizationValue(instance, workspaceDir, relativeConfigPath);
  await appendTomlBlock(
    path.join(workspaceDir, relativeConfigPath),
    "KANBAN MCP",
    `[mcp_servers.kanban]
type = "http"
url = "${instance.mcpUrl}"
headers = { Authorization = "${auth}" }`,
  );
}

async function installClaude(workspaceDir, instance) {
  const claudePath = path.join(workspaceDir, "CLAUDE.md");
  await appendManagedBlock(
    claudePath,
    "KANBAN SECOND BRAIN",
    await readTemplate("CLAUDE.kanban-second-brain.md"),
  );

  await mkdir(path.join(workspaceDir, ".claude", "skills"), {
    recursive: true,
  });
  await copyFile(
    skillSource,
    path.join(workspaceDir, ".claude", "skills", "kanban-second-brain.md"),
  );

  const relativeConfigPath = ".mcp.json";
  const auth = authorizationValue(instance, workspaceDir, relativeConfigPath);
  await mergeMcpJson(
    path.join(workspaceDir, relativeConfigPath),
    {
      type: "http",
      url: instance.mcpUrl,
      headers: { Authorization: auth },
    },
    auth.includes(instance.rawKey),
  );
}

async function installAntigravity(workspaceDir, instance) {
  const agentsPath = path.join(workspaceDir, "AGENTS.md");
  await appendManagedBlock(
    agentsPath,
    "KANBAN SECOND BRAIN",
    await readTemplate("ANTIGRAVITY.kanban-second-brain.md"),
  );

  const relativeConfigPath = path.join(".antigravity", "mcp.json");
  const auth = authorizationValue(instance, workspaceDir, relativeConfigPath);
  await mergeMcpJson(
    path.join(workspaceDir, relativeConfigPath),
    {
      type: "http",
      url: instance.mcpUrl,
      headers: { Authorization: auth },
    },
    auth.includes(instance.rawKey),
  );
}

async function installClients(instance) {
  const workspaceDir = path.resolve(
    await ask("Workspace to configure", process.cwd()),
  );
  const clients = await chooseMany(
    "Install for which agents? comma-separated: codex, claude, antigravity",
    ["codex", "claude"],
  );

  for (const client of clients) {
    if (client === "codex") await installCodex(workspaceDir, instance);
    else if (client === "claude") await installClaude(workspaceDir, instance);
    else if (client === "antigravity")
      await installAntigravity(workspaceDir, instance);
    else console.log(`Skipping unknown client: ${client}`);
  }

  return { workspaceDir, clients };
}

async function main() {
  console.log("Kanban second-brain installer");
  console.log("");

  const mode = await choose(
    "Where should Kanban run?",
    [{ value: "docker" }, { value: "external" }, { value: "native" }],
    "docker",
  );

  let instance;
  if (mode === "docker") instance = await setupDocker();
  else if (mode === "external") instance = await setupExternal();
  else instance = await setupNative();

  const provisioned =
    mode === "docker" ? await seedDocker(instance) : await seedViaApi(instance);
  const secretStorage = storeSecret(provisioned);
  const install = await installClients(provisioned);

  console.log("");
  console.log("Kanban second-brain setup complete.");
  console.log(`Kanban: ${provisioned.webUrl}`);
  console.log(`MCP:    ${provisioned.mcpUrl}`);
  console.log(
    `Secret storage: ${secretStorage === "keychain" ? "OS keychain plus ~/.kanban/agent.env" : agentEnvPath}`,
  );
  console.log(`Workspace: ${install.workspaceDir}`);
  console.log(`Clients: ${install.clients.join(", ")}`);
  if (provisioned.inboxPageId) {
    console.log(`Inbox: wiki://${provisioned.inboxPageId}`);
  }
  if (provisioned.triageTaskId) {
    console.log(`Triage task: task://${provisioned.triageTaskId}`);
  }
  if (placeholderConfigPaths.size > 0) {
    console.log("");
    console.log(
      `Tracked config files use KANBAN_MCP_API_KEY placeholders. Load ${agentEnvPath} before launching those agents.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
