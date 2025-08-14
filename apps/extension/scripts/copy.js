import { mkdirSync, copyFileSync } from "fs";
import { dirname } from "path";

const files = [
  ["src/options.html", "dist/options.html"],
  ["src/ui.css", "dist/ui.css"],
];

for (const [from, to] of files) {
  const dir = dirname(to);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  try {
    copyFileSync(from, to);
    console.log("copied", from, "→", to);
  } catch (e) {
    console.error("copy failed for", from, "→", to, e?.message || e);
    process.exitCode = 1;
  }
}
