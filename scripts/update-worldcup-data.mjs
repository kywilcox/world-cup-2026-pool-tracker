import fs from "node:fs/promises";

const args = new Set(process.argv.slice(2));
const projectRoot = new URL("../", import.meta.url);
const outPath = new URL("data/worldcup.json", projectRoot);
const samplePath = new URL("data/worldcup.sample.json", projectRoot);

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function writeJson(path, data) {
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

if (args.has("--sample")) {
  const sample = JSON.parse(await fs.readFile(samplePath, "utf8"));
  await writeJson(outPath, {
    ...sample,
    source: "sample-demo-data",
    lastUpdated: new Date().toISOString()
  });
  console.log("Copied sample demo data to data/worldcup.json.");
  process.exit(0);
}

function parseWorldCup26Date(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, month, day, year, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00-05:00`;
}

function stageFromWorldCup26Type(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "group") return "GROUP_STAGE";
  if (normalized === "r32") return "ROUND_OF_32";
  if (normalized === "r16") return "ROUND_OF_16";
  if (normalized === "qf") return "QUARTERFINAL";
  if (normalized === "sf") return "SEMIFINAL";
  if (normalized === "final") return "FINAL";
  return normalized.toUpperCase() || "UNKNOWN";
}

function statusFromWorldCup26(game) {
  if (String(game.finished || "").toUpperCase() === "TRUE") return "FINISHED";
  const elapsed = String(game.time_elapsed || "").toLowerCase();
  if (elapsed && elapsed !== "notstarted") return "IN_PLAY";
  return "TIMED";
}

function scoreNumber(value, status) {
  if (status === "TIMED") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function winnerFromScore(home, away, status) {
  if (status !== "FINISHED" || home === null || away === null) return null;
  if (home > away) return "HOME_TEAM";
  if (away > home) return "AWAY_TEAM";
  return "DRAW";
}

function convertWorldCup26Game(game) {
  const status = statusFromWorldCup26(game);
  const home = scoreNumber(game.home_score, status);
  const away = scoreNumber(game.away_score, status);
  const homeName = game.home_team_name_en || game.home_team_label || "TBD";
  const awayName = game.away_team_name_en || game.away_team_label || "TBD";

  return {
    id: `worldcup26-${game.id}`,
    utcDate: parseWorldCup26Date(game.local_date),
    stage: stageFromWorldCup26Type(game.type),
    group: game.group ? `Group ${game.group}` : null,
    status,
    minute: game.time_elapsed || null,
    homeTeam: { name: homeName },
    awayTeam: { name: awayName },
    score: {
      winner: winnerFromScore(home, away, status),
      fullTime: { home, away }
    }
  };
}

async function updateFromWorldCup26() {
  const response = await fetch("https://worldcup26.ir/get/games", {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`worldcup26.ir returned ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const games = Array.isArray(payload.games) ? payload.games : [];
  const output = {
    schemaVersion: 1,
    source: "worldcup26.ir",
    providerUrl: "https://worldcup26.ir/get/games",
    lastUpdated: new Date().toISOString(),
    competition: {
      name: "FIFA World Cup 2026",
      code: "WC"
    },
    resultSet: {
      count: games.length,
      finished: games.filter((game) => String(game.finished || "").toUpperCase() === "TRUE").length
    },
    matches: games.map(convertWorldCup26Game)
  };

  await writeJson(outPath, output);
  console.log(`Updated ${output.matches.length} matches from worldcup26.ir.`);
}

const provider = argValue("--provider", process.env.WORLD_CUP_PROVIDER || "worldcup26");
if (provider === "worldcup26") {
  await updateFromWorldCup26();
  process.exit(0);
}

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) {
  const message = "FOOTBALL_DATA_TOKEN is not set; leaving data/worldcup.json unchanged.";
  if (args.has("--skip-if-missing-token")) {
    console.log(message);
    process.exit(0);
  }
  throw new Error(message);
}

const competition = argValue("--competition", "WC");
const season = argValue("--season", "2026");
const url = new URL(`https://api.football-data.org/v4/competitions/${competition}/matches`);
url.searchParams.set("season", season);

const response = await fetch(url, {
  headers: {
    "X-Auth-Token": token,
    Accept: "application/json"
  }
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`football-data.org returned ${response.status}: ${text.slice(0, 500)}`);
}

const payload = await response.json();
const output = {
  schemaVersion: 1,
  source: "football-data.org",
  providerUrl: "https://www.football-data.org/",
  lastUpdated: new Date().toISOString(),
  competition: payload.competition || { code: competition },
  resultSet: payload.resultSet || null,
  matches: payload.matches || []
};

await writeJson(outPath, output);
console.log(`Updated ${output.matches.length} matches from football-data.org.`);
