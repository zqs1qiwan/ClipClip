// Lint/quality gate for ClipClip.
//
// The project is zero-dependency, so "lint" stays small but real:
//   1. tabs are not allowed in JS/CSS sources (they break the project style)
//   2. every JS source file must parse (node --check), including tests and scripts
//
// `node --check <file>` respects the nearest package.json ("type": "module") on modern
// Node.js. For runtimes where it does not, the file is re-checked through stdin with
// --input-type=module so ESM syntax is still validated instead of failing the gate.
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const scanDirs = ["src", "public", "scripts", "tests"];
const cssFiles = ["public/styles.css"];

const failures = [];
const javascriptFiles = [];

async function collectJavaScript(relativeDir) {
  const directoryUrl = new URL(`../${relativeDir}/`, import.meta.url);
  let entries;

  try {
    entries = await readdir(directoryUrl, { withFileTypes: true });
  } catch {
    failures.push(`Missing source directory: ${relativeDir}`);
    return;
  }

  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectJavaScript(relativePath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      javascriptFiles.push(relativePath);
    }
  }
}

async function checkTextFile(relativePath) {
  let content;

  try {
    content = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  } catch (error) {
    failures.push(`Cannot read ${relativePath}: ${error.message}`);
    return null;
  }

  if (content.trim().length === 0) {
    failures.push(`${relativePath} is empty.`);
    return null;
  }

  if (content.includes("\t")) {
    failures.push(`Tabs detected in ${relativePath}.`);
  }

  return content;
}

function checkSyntax(relativePath, content) {
  const absolutePath = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const direct = spawnSync(process.execPath, ["--check", absolutePath], {
    encoding: "utf8",
    timeout: 15000
  });

  if (direct.error) {
    failures.push(
      `Failed to run node --check for ${relativePath}: ${direct.error.code || direct.error.message}`
    );
    return;
  }

  if (direct.status === null) {
    failures.push(`node --check did not finish for ${relativePath} (timeout or interruption).`);
    return;
  }

  if (direct.status === 0) {
    return;
  }

  const stderr = `${direct.stderr || ""}`;
  const looksLikeModuleFormatIssue =
    /Cannot use import statement outside a module|Unexpected token 'export'|Failed to load the ES module/i.test(
      stderr
    );

  if (!looksLikeModuleFormatIssue) {
    failures.push(`Syntax error in ${relativePath}:\n${indent(stderr.trim())}`);
    return;
  }

  const fallback = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: content,
    timeout: 15000
  });

  if (fallback.error || fallback.status !== 0) {
    const detail = fallback.error
      ? `failed to run the ESM fallback check: ${fallback.error.code || fallback.error.message}`
      : `${fallback.stderr || ""}`.trim();
    failures.push(`Syntax error in ${relativePath}:\n${indent(detail)}`);
  }
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

for (const directory of scanDirs) {
  await collectJavaScript(directory);
}

if (javascriptFiles.length === 0) {
  failures.push("No JavaScript source files found to lint.");
}

for (const file of [...javascriptFiles, ...cssFiles]) {
  const content = await checkTextFile(file);
  if (content !== null && file.endsWith(".js")) {
    checkSyntax(file, content);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  console.error(`Lint check failed with ${failures.length} problem(s).`);
  process.exit(1);
}

console.log(
  `Lint check passed (${javascriptFiles.length} JS files parsed, ${cssFiles.length} CSS file(s) checked).`
);