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
  if (normalized === "third") return "THIRD";
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

  return {
    id: `worldcup26-${game.id}`,
    utcDate: parseWorldCup26Date(game.local_date),
    stage: stageFromWorldCup26Type(game.type),
    group: game.group ? `Group ${game.group}` : null,
    status,
    minute: game.time_elapsed || null,
    homeTeam: { name: game.home_team_name_en || game.home_team_label || "TBD" },
    awayTeam: { name: game.away_team_name_en || game.away_team_label || "TBD" },
    score: {
      winner: winnerFromScore(home, away, status),
      fullTime: { home, away }
    }
  };
}

export async function loadWorldCup26Feed() {
  const response = await fetch("https://worldcup26.ir/get/games", {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`worldcup26.ir returned ${response.status}`);
  }

  const payload = await response.json();
  const games = Array.isArray(payload.games) ? payload.games : [];
  return {
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
}
