import fs from "fs";
import path from "path";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

fs.mkdirSync(DIST, { recursive: true });

const files = new Set([
  "manifest.json",
  "options.html",
  "ui.css",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "icons/icon256.png",
  "icons/icon512.png",
]);
for (const rel of files) {
  const src = path.join(SRC, rel);
  const dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("copied", rel);
}
