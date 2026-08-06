import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve(import.meta.dirname, "../dist");
const html = await readFile(resolve(distDirectory, "control/index.html"), "utf8");
const resourcePaths = [...html.matchAll(/(?:src|href)="(\/control\/[^"?#]+)"/gu)]
  .map((match) => match[1]);

if (resourcePaths.length === 0) {
  throw new Error("Control build does not reference any /control/ resources");
}

const missing = [];
for (const pathname of resourcePaths) {
  try {
    await access(resolve(distDirectory, pathname.slice(1)));
  } catch {
    missing.push(pathname);
  }
}

if (missing.length > 0) {
  throw new Error(`Control build references missing assets:\n${missing.join("\n")}`);
}

console.log(`Verified ${resourcePaths.length} control asset paths.`);
