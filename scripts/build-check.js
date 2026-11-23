// Build/artifact gate for ClipClip.
//
// Validates that every runtime artifact referenced by the server and the browser exists
// before the Docker image is built, so a partial checkout cannot produce an image that
// boots but serves a broken UI: HTML pages must not reference missing absolute assets and
// browser modules must not import missing relative modules (public/app.js imports
// ./button-feedback.js and ./lib/clipboard.js).
import { access, readdir, readFile } from "node:fs/promises";
import process from "node:process";

const requiredFiles = [
  "package.json",
  "src/server/index.js",
  "src/server/app.js",
  "src/server/config.js",
  "src/server/storage.js",
  "public/index.html",
  "public/app.js",
  "public/button-feedback.js",
  "public/lib/clipboard.js",
  "public/styles.css",
  "scripts/healthcheck.js"
];

const failures = [];
let checkedPages = 0;
let checkedModules = 0;

function fileUrl(relativePath) {
  return new URL(`../${relativePath}`, import.meta.url);
}

async function fileExists(relativePath) {
  try {
    await access(fileUrl(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (!(await fileExists(file))) {
      failures.push(`Missing required source file: ${file}`);
    }
  }
}

async function checkPackageManifest() {
  let manifest;

  try {
    manifest = JSON.parse(await readFile(fileUrl("package.json"), "utf8"));
  } catch (error) {
    failures.push(`package.json is not valid JSON: ${error.message}`);
    return;
  }

  if (manifest.type !== "module") {
    failures.push('package.json must keep "type": "module" (server and browser code use ESM).');
  }

  for (const scriptName of ["start", "build", "test", "lint"]) {
    if (!manifest.scripts?.[scriptName]) {
      failures.push(`package.json is missing the "${scriptName}" script.`);
    }
  }
}

async function collectFiles(relativeDir, extension) {
  const directoryUrl = new URL(`../${relativeDir}/`, import.meta.url);
  let entries;

  try {
    entries = await readdir(directoryUrl, { withFileTypes: true });
  } catch {
    failures.push(`Missing source directory: ${relativeDir}`);
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const childPath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(childPath, extension)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(childPath);
    }
  }
  return files;
}

async function checkHtmlReferences() {
  for (const page of await collectFiles("public", ".html")) {
    let html;

    try {
      html = await readFile(fileUrl(page), "utf8");
    } catch {
      continue; // reported by checkRequiredFiles for known pages
    }

    checkedPages += 1;
    for (const match of html.matchAll(/(?:src|href)=["'](\/[^"'?#]+)["']/g)) {
      const target = `public${match[1]}`;
      if (!(await fileExists(target))) {
        failures.push(`${page} references missing asset: ${match[1]}`);
      }
    }
  }
}

async function checkBrowserImports() {
  for (const modulePath of await collectFiles("public", ".js")) {
    let source;

    try {
      source = await readFile(fileUrl(modulePath), "utf8");
    } catch {
      continue; // reported by checkRequiredFiles for known modules
    }

    checkedModules += 1;
    for (const match of source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const specifier = match[1];
      const resolvedUrl = new URL(specifier, fileUrl(modulePath));
      let exists = true;

      try {
        await access(resolvedUrl);
      } catch {
        exists = false;
      }

      if (!exists) {
        failures.push(`${modulePath} imports missing module: ${specifier}`);
      }
    }
  }
}

await checkRequiredFiles();
await checkPackageManifest();
await checkHtmlReferences();
await checkBrowserImports();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  console.error(`Build check failed with ${failures.length} problem(s).`);
  process.exit(1);
}

console.log(
  `Build check passed (${requiredFiles.length} required files, ${checkedPages} HTML page(s), ${checkedModules} browser module(s) verified).`
);