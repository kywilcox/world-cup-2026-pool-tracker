import fs from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const distRoot = new URL("dist/", projectRoot);

async function copyFile(path) {
  await fs.cp(new URL(path, projectRoot), new URL(path, distRoot), {
    recursive: true,
    force: true
  });
}

await fs.rm(distRoot, { recursive: true, force: true });
await fs.mkdir(distRoot, { recursive: true });

for (const path of ["index.html", "styles.css", "app.js", "scoring.js", "live-feed.js", "assets", "data"]) {
  await copyFile(path);
}

console.log("Built static site in dist/.");
