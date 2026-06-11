const DEFAULT_RULE_POINTS = {
  group_win: 3,
  group_draw: 1,
  round_of_32: 5,
  round_of_16: 8,
  quarterfinal: 12,
  semifinal: 18,
  final: 25,
  champion: 40
};

const APPEARANCE_BY_STAGE = {
  ROUND_OF_32: "round_of_32",
  ROUND_OF_16: "round_of_16",
  QUARTERFINAL: "quarterfinal",
  SEMIFINAL: "semifinal",
  FINAL: "final"
};

const STAGE_LABELS = {
  GROUP_STAGE: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTERFINAL: "Quarterfinal",
  SEMIFINAL: "Semifinal",
  FINAL: "Final",
  THIRD: "Third Place"
};

function key(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function makeRulePoints(pool) {
  const points = { ...DEFAULT_RULE_POINTS };
  for (const rule of pool.rules || []) {
    points[rule.id] = Number(rule.points || 0);
  }
  return points;
}

function buildIndexes(pool) {
  const teamOwners = new Map();
  const aliases = new Map();
  const teams = new Map();

  for (const owner of pool.owners || []) {
    for (const team of owner.teams || []) {
      const teamKey = key(team);
      const record = {
        name: team,
        owner: owner.name,
        ownerColor: owner.color,
        total: 0,
        entries: []
      };
      teams.set(team, record);
      aliases.set(teamKey, team);
      teamOwners.set(team, owner.name);
    }
  }

  for (const [alias, canonical] of Object.entries(pool.aliases || {})) {
    const canonicalTeam =
      aliases.get(key(canonical)) ||
      Array.from(teams.keys()).find((team) => key(team) === key(canonical));
    if (canonicalTeam) {
      aliases.set(key(alias), canonicalTeam);
    }
  }

  return { aliases, teams, teamOwners };
}

export function canonicalTeamName(name, pool) {
  if (!name) {
    return null;
  }

  const indexes = buildIndexes(pool);
  return indexes.aliases.get(key(name)) || null;
}

export function normalizeStage(match) {
  const raw = key(match.stage || match.round || match.matchday || "");
  if (String(match.stage || "").toUpperCase() === "GROUP_STAGE") return "GROUP_STAGE";
  if (String(match.stage || "").toUpperCase() === "ROUND_OF_32") return "ROUND_OF_32";
  if (String(match.stage || "").toUpperCase() === "ROUND_OF_16") return "ROUND_OF_16";
  if (String(match.stage || "").toUpperCase() === "QUARTERFINAL") return "QUARTERFINAL";
  if (String(match.stage || "").toUpperCase() === "SEMIFINAL") return "SEMIFINAL";
  if (String(match.stage || "").toUpperCase() === "FINAL") return "FINAL";
  if (String(match.stage || "").toUpperCase() === "THIRD") return "THIRD";
  if (raw.includes("group")) return "GROUP_STAGE";
  if (match.group && !raw.includes("last") && !raw.includes("round")) return "GROUP_STAGE";
  if (raw.includes("last 32") || raw.includes("round of 32") || raw.includes("round 32")) {
    return "ROUND_OF_32";
  }
  if (raw.includes("last 16") || raw.includes("round of 16") || raw.includes("round 16")) {
    return "ROUND_OF_16";
  }
  if (raw.includes("quarter")) return "QUARTERFINAL";
  if (raw.includes("semi")) return "SEMIFINAL";
  if (raw === "final" || raw.endsWith(" final")) return "FINAL";
  if (String(match.stage || "").toUpperCase() === "LAST_32") return "ROUND_OF_32";
  if (String(match.stage || "").toUpperCase() === "LAST_16") return "ROUND_OF_16";
  if (String(match.stage || "").toUpperCase() === "QUARTER_FINALS") return "QUARTERFINAL";
  if (String(match.stage || "").toUpperCase() === "SEMI_FINALS") return "SEMIFINAL";
  return String(match.stage || "UNKNOWN").toUpperCase();
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || titleCase(String(stage || "Unknown").replace(/_/g, " "));
}

function titleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rawTeamName(team) {
  return team?.name || team?.shortName || team?.tla || "";
}

function isPlaceholderTeamName(name) {
  const normalized = key(name);
  return (
    !normalized ||
    normalized === "tbd" ||
    normalized.startsWith("winner match") ||
    normalized.startsWith("loser match") ||
    normalized.startsWith("winner group") ||
    normalized.startsWith("runner up group") ||
    normalized.startsWith("3rd group")
  );
}

function isFinished(match) {
  return ["FINISHED", "AWARDED"].includes(String(match.status || "").toUpperCase());
}

function scoreWinner(match) {
  const winner = String(match.score?.winner || "").toUpperCase();
  if (winner) return winner;

  const home = match.score?.fullTime?.home;
  const away = match.score?.fullTime?.away;
  if (Number.isFinite(home) && Number.isFinite(away)) {
    if (home > away) return "HOME_TEAM";
    if (away > home) return "AWAY_TEAM";
    return "DRAW";
  }

  return "";
}

function matchScore(match) {
  const home = match.score?.fullTime?.home;
  const away = match.score?.fullTime?.away;
  if (home === null || home === undefined || away === null || away === undefined) {
    return "";
  }
  return `${home}-${away}`;
}

function matchDateValue(match) {
  const value = Date.parse(match.utcDate || match.date || "");
  return Number.isFinite(value) ? value : 0;
}

export function formatMatch(match, pool) {
  const homeRaw = rawTeamName(match.homeTeam);
  const awayRaw = rawTeamName(match.awayTeam);
  return {
    id: match.id || `${homeRaw}-${awayRaw}-${match.utcDate || ""}`,
    utcDate: match.utcDate || match.date || null,
    status: match.status || "UNKNOWN",
    stage: normalizeStage(match),
    stageLabel: stageLabel(normalizeStage(match)),
    homeRaw,
    awayRaw,
    home: canonicalTeamName(homeRaw, pool) || homeRaw || "TBD",
    away: canonicalTeamName(awayRaw, pool) || awayRaw || "TBD",
    score: matchScore(match),
    finished: isFinished(match)
  };
}

export function calculateScoreboard(pool, feed) {
  const rulePoints = makeRulePoints(pool);
  const indexes = buildIndexes(pool);
  const teamRecords = indexes.teams;
  const appearanceAwards = new Set();
  const championAwards = new Set();
  const unknownTeams = new Set();
  const matches = Array.isArray(feed.matches) ? feed.matches : [];

  function resolveTeam(rawName) {
    const canonical = indexes.aliases.get(key(rawName));
    if (!canonical && rawName && !isPlaceholderTeamName(rawName)) {
      unknownTeams.add(rawName);
    }
    return canonical || null;
  }

  function award(teamName, ruleId, match, detail) {
    if (!teamName || !teamRecords.has(teamName)) return;
    const points = rulePoints[ruleId] || 0;
    if (!points) return;
    const record = teamRecords.get(teamName);
    record.total += points;
    record.entries.push({
      ruleId,
      label: (pool.rules || []).find((rule) => rule.id === ruleId)?.label || ruleId,
      points,
      matchId: match.id,
      utcDate: match.utcDate || match.date || null,
      detail
    });
  }

  for (const match of matches) {
    const stage = normalizeStage(match);
    const home = resolveTeam(rawTeamName(match.homeTeam));
    const away = resolveTeam(rawTeamName(match.awayTeam));

    const appearanceRule = APPEARANCE_BY_STAGE[stage];
    if (appearanceRule) {
      for (const team of [home, away]) {
        const awardKey = `${team}:${appearanceRule}`;
        if (team && !appearanceAwards.has(awardKey)) {
          appearanceAwards.add(awardKey);
          award(team, appearanceRule, match, `${stageLabel(stage)} appearance`);
        }
      }
    }

    if (stage === "GROUP_STAGE" && isFinished(match)) {
      const winner = scoreWinner(match);
      if (winner === "DRAW") {
        award(home, "group_draw", match, `Draw vs ${away || rawTeamName(match.awayTeam)}`);
        award(away, "group_draw", match, `Draw vs ${home || rawTeamName(match.homeTeam)}`);
      } else if (winner === "HOME_TEAM") {
        award(home, "group_win", match, `Win vs ${away || rawTeamName(match.awayTeam)}`);
      } else if (winner === "AWAY_TEAM") {
        award(away, "group_win", match, `Win vs ${home || rawTeamName(match.homeTeam)}`);
      }
    }

    if (stage === "FINAL" && isFinished(match)) {
      const winner = scoreWinner(match);
      const champion = winner === "HOME_TEAM" ? home : winner === "AWAY_TEAM" ? away : null;
      if (champion && !championAwards.has(champion)) {
        championAwards.add(champion);
        award(champion, "champion", match, "World Cup Champion");
      }
    }
  }

  const owners = (pool.owners || []).map((owner) => {
    const teams = (owner.teams || []).map((team) => teamRecords.get(team));
    const total = teams.reduce((sum, team) => sum + (team?.total || 0), 0);
    const topTeam = [...teams].sort((a, b) => (b?.total || 0) - (a?.total || 0))[0];
    return {
      name: owner.name,
      color: owner.color,
      textColor: owner.textColor || "#ffffff",
      draftOrder: pool.owners.indexOf(owner),
      total,
      topTeam: topTeam?.total > 0 ? topTeam.name : "",
      teams
    };
  });

  owners.sort((a, b) => b.total - a.total || a.draftOrder - b.draftOrder);

  const formattedMatches = matches
    .map((match) => formatMatch(match, pool))
    .sort((a, b) => matchDateValue(b) - matchDateValue(a));

  return {
    owners,
    matches: formattedMatches,
    rules: pool.rules || [],
    stats: {
      matchesTotal: matches.length,
      matchesFinished: matches.filter(isFinished).length,
      matchesScored: owners.reduce((sum, owner) => sum + owner.total, 0),
      unknownTeams: [...unknownTeams].sort()
    }
  };
}
