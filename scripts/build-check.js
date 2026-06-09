import { access } from "node:fs/promises";
import process from "node:process";

const requiredFiles = [
  "src/server/index.js",
  "src/server/app.js",
  "src/server/config.js",
  "src/server/storage.js",
  "public/index.html",
  "public/app.js",
  "public/styles.css"
];

for (const file of requiredFiles) {
  try {
    await access(new URL(`../${file}`, import.meta.url));
  } catch {
    console.error(`Missing required build artifact source: ${file}`);
    process.exit(1);
  }
}

console.log("Build check passed.");
