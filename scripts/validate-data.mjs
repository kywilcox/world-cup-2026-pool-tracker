import fs from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);

async function readJson(path) {
  const raw = await fs.readFile(new URL(path, projectRoot), "utf8");
  return JSON.parse(raw);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const pool = await readJson("data/pool.json");
const feed = await readJson("data/worldcup.json");
const sample = await readJson("data/worldcup.sample.json");

assert(Array.isArray(pool.owners), "pool owners must be an array");
assert(pool.owners.length > 0, "pool must include at least one owner");
assert(Array.isArray(pool.rules), "pool rules must be an array");

const teams = new Set();
for (const owner of pool.owners) {
  assert(owner.name, "each owner needs a name");
  assert(owner.color, `${owner.name} needs a color`);
  assert(Array.isArray(owner.teams), `${owner.name} needs a teams array`);
  assert(owner.teams.length === 6, `${owner.name} should have exactly 6 teams`);
  for (const team of owner.teams) {
    assert(!teams.has(team), `${team} is drafted more than once`);
    teams.add(team);
  }
}

assert(teams.size === 48, `expected 48 drafted teams, found ${teams.size}`);

for (const rule of pool.rules) {
  assert(rule.id, "each rule needs an id");
  assert(rule.label, `${rule.id} needs a label`);
  assert(Number.isFinite(rule.points), `${rule.id} points must be numeric`);
}

for (const [label, data] of [
  ["data/worldcup.json", feed],
  ["data/worldcup.sample.json", sample]
]) {
  assert(data.schemaVersion === 1, `${label} schemaVersion must be 1`);
  assert(Array.isArray(data.matches), `${label} matches must be an array`);
}

console.log("Validated pool rules, 48 drafted teams, and feed schemas.");
