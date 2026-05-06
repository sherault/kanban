import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const repoRoot = new URL("..", import.meta.url).pathname;
const sourceRoot = join(repoRoot, "apps/web/src");
const validExtensions = new Set([".ts", ".tsx"]);
const errors = [];
let checkedFiles = 0;

for (const filePath of walk(sourceRoot)) {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  if (!hasUseServerDirective(sourceFile)) continue;
  checkedFiles += 1;
  checkServerActionExports(sourceFile, filePath);
}

if (errors.length > 0) {
  console.error("Invalid exports in \"use server\" files:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Checked ${checkedFiles} \"use server\" file(s).`);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (validExtensions.has(extname(path))) {
      yield path;
    }
  }
}

function hasUseServerDirective(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression)
    ) {
      if (statement.expression.text === "use server") return true;
      continue;
    }
    return false;
  }
  return false;
}

function checkServerActionExports(sourceFile, filePath) {
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.isTypeOnly) report(filePath, statement, "value re-export");
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      report(filePath, statement, "export assignment");
      continue;
    }
    if (!hasExportModifier(statement)) continue;

    if (ts.isFunctionDeclaration(statement)) {
      if (!hasAsyncModifier(statement)) {
        report(filePath, statement, "non-async exported function");
      }
      continue;
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      continue;
    }
    report(filePath, statement, `exported ${ts.SyntaxKind[statement.kind]}`);
  }
}

function hasExportModifier(node) {
  return node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
}

function hasAsyncModifier(node) {
  return node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword);
}

function report(filePath, node, reason) {
  const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.pos).line + 1;
  errors.push(`${relative(repoRoot, filePath)}:${line} uses ${reason}`);
}
