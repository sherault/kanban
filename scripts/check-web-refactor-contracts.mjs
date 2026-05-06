import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const repoRoot = new URL("..", import.meta.url).pathname;
const actionsRoot = join(repoRoot, "apps/web/src/actions");
const failures = [];

const taskFacade = parse(join(actionsRoot, "tasks.ts"));
const taskActionModules = ["crud.ts", "lifecycle.ts", "relations.ts"].map((file) =>
  parse(join(actionsRoot, "task-actions", file)),
);

const facadeExports = exportedAsyncFunctions(taskFacade);
const splitExports = new Set(
  taskActionModules.flatMap((sourceFile) => [...exportedAsyncFunctions(sourceFile)]),
);

for (const name of splitExports) {
  if (!facadeExports.has(name)) {
    failures.push(`tasks.ts does not re-expose ${name}`);
  }
}

for (const name of facadeExports) {
  if (!splitExports.has(name)) {
    failures.push(`tasks.ts exports ${name}, but no split module owns it`);
  }
}

const apiFacade = readFileSync(join(repoRoot, "apps/web/src/lib/api.ts"), "utf8");
for (const namespace of ["auth", "invite", "orgs", "profile", "projects", "tasks", "wiki"]) {
  if (!apiFacade.includes(`${namespace}: ${namespace}Api`)) {
    failures.push(`lib/api.ts is missing api.${namespace}`);
  }
}

if (failures.length > 0) {
  console.error("Web refactor contract check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Web refactor contracts are intact.");

function parse(filePath) {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function exportedAsyncFunctions(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    if (!statement.name || !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (!hasModifier(statement, ts.SyntaxKind.AsyncKeyword)) continue;
    names.add(statement.name.text);
  }
  return names;
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}
