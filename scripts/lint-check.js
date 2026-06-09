import { readFile } from "node:fs/promises";
import process from "node:process";

const files = [
  "src/server/index.js",
  "src/server/app.js",
  "src/server/config.js",
  "src/server/storage.js",
  "public/app.js",
  "public/styles.css"
];

for (const file of files) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (content.includes("\t")) {
    console.error(`Tabs detected in ${file}.`);
    process.exit(1);
  }
}

console.log("Lint check passed.");
