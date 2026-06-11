import fs from "node:fs/promises";
import { calculateScoreboard } from "../scoring.js";

const projectRoot = new URL("../", import.meta.url);

async function readJson(path) {
  const raw = await fs.readFile(new URL(path, projectRoot), "utf8");
  return JSON.parse(raw);
}

const pool = await readJson("data/pool.json");
const sample = await readJson("data/worldcup.sample.json");
const scoreboard = calculateScoreboard(pool, sample);

const standings = scoreboard.owners.map((owner) => `${owner.name}: ${owner.total}`).join(", ");
console.log(standings);

const expected = new Map([
  ["Caul", 8],
  ["Reid", 8],
  ["Bailey", 6],
  ["Preston", 6],
  ["Byron", 3],
  ["Chase", 3],
  ["Rodney", 0],
  ["Rylan", 0]
]);

for (const owner of scoreboard.owners) {
  if (owner.total !== expected.get(owner.name)) {
    throw new Error(`Expected ${owner.name} sample total to be ${expected.get(owner.name)}, got ${owner.total}`);
  }
}

console.log("Sample scoring check passed.");
