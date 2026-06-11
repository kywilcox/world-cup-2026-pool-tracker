import { calculateScoreboard } from "./scoring.js";

const DATA_PARAM = new URLSearchParams(window.location.search).get("data");
const DEMO_PARAM = new URLSearchParams(window.location.search).get("demo");
const FEED_PATH = DATA_PARAM === "sample" || DEMO_PARAM === "1" ? "./data/worldcup.sample.json" : "./data/worldcup.json";

const elements = {
  sourceName: document.querySelector("#sourceName"),
  lastUpdated: document.querySelector("#lastUpdated"),
  matchesScored: document.querySelector("#matchesScored"),
  leaderSummary: document.querySelector("#leaderSummary"),
  standingsTable: document.querySelector("#standingsTable"),
  ownerGrid: document.querySelector("#ownerGrid"),
  matchList: document.querySelector("#matchList"),
  rulesList: document.querySelector("#rulesList")
};

let poolData = null;
let activeFeed = null;
let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Not connected yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function sourceLabel(feed) {
  if (feed.source === "waiting-for-feed") return "Waiting for live feed";
  if (feed.source === "sample-demo-data") return "Sample demo data";
  if (feed.source === "worldcup26.ir") return "WorldCup26 live API";
  return feed.source || "Unknown";
}

function renderStatus(feed, scoreboard) {
  elements.sourceName.textContent = sourceLabel(feed);
  elements.lastUpdated.textContent = formatDate(feed.lastUpdated);
  elements.matchesScored.textContent = String(scoreboard.stats.matchesScored);
}

function renderLeader(scoreboard) {
  const leader = scoreboard.owners[0];
  const hasLeader = leader && leader.total > 0;
  const finished = scoreboard.stats.matchesFinished;
  const total = scoreboard.stats.matchesTotal;
  const unknownNote = scoreboard.stats.unknownTeams.length
    ? `<p class="bar-label">Unmatched feed names: ${escapeHtml(scoreboard.stats.unknownTeams.join(", "))}</p>`
    : "";
  const leaderName = hasLeader ? leader.name : "Waiting for first points";
  const leaderText = hasLeader
    ? `${leader.topTeam} is the top drafted team so far.`
    : "The first finished group match or named knockout appearance will start the race.";

  elements.leaderSummary.innerHTML = `
    <article class="leader-card">
      <div class="rank-badge">${hasLeader ? "1" : "0"}</div>
      <div>
        <p class="leader-name">${escapeHtml(leaderName)}</p>
        <p class="leader-points">${escapeHtml(leaderText)}</p>
      </div>
    </article>
    <article class="pace-card">
      <span class="status-label">Tournament pace</span>
      <span class="pace-value">${finished}/${total}</span>
      <span class="leader-points">finished matches in the current feed</span>
      ${unknownNote}
    </article>
  `;
}

function renderStandings(scoreboard) {
  const max = Math.max(1, ...scoreboard.owners.map((owner) => owner.total));
  const rows = scoreboard.owners
    .map((owner, index) => {
      const topTeam = owner.topTeam ? `${owner.topTeam} leading team` : "Waiting for points";
      const barWidth = Math.round((owner.total / max) * 100);
      return `
        <div class="standings-row">
          <strong>#${index + 1}</strong>
          <div class="player-cell" style="--owner-color: ${escapeHtml(owner.color)}">
            <span class="swatch" aria-hidden="true"></span>
            <span>${escapeHtml(owner.name)}</span>
          </div>
          <div class="points-cell">${owner.total}</div>
          <div class="bar-cell">
            <div class="bar" style="--bar-width: ${barWidth}%"><span></span></div>
            <div class="bar-label">${escapeHtml(topTeam)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  elements.standingsTable.innerHTML = `
    <div class="standings-row standings-row--header">
      <span>Rank</span>
      <span>Player</span>
      <span>Points</span>
      <span class="bar-cell">Progress</span>
    </div>
    ${rows}
  `;
}

function renderOwners(scoreboard) {
  elements.ownerGrid.innerHTML = scoreboard.owners
    .map((owner) => {
      const teams = owner.teams
        .map((team) => {
          const detail = team.entries.length
            ? team.entries
                .slice(-2)
                .map((entry) => `${entry.label}: +${entry.points}`)
                .join(" | ")
            : "No scoring events yet";
          return `
            <li class="team-row">
              <span class="team-name">${escapeHtml(team.name)}</span>
              <span class="team-points">${team.total}</span>
              <span class="team-detail">${escapeHtml(detail)}</span>
            </li>
          `;
        })
        .join("");

      return `
        <article class="owner-card" style="--owner-color: ${escapeHtml(owner.color)}; --owner-text: ${escapeHtml(owner.textColor)}">
          <div class="owner-card__head">
            <h3>${escapeHtml(owner.name)}</h3>
            <span class="owner-card__total">${owner.total}</span>
          </div>
          <ul class="team-list">${teams}</ul>
        </article>
      `;
    })
    .join("");
}

function renderMatches(scoreboard) {
  const matches = scoreboard.matches.slice(0, 12);
  if (!matches.length) {
    elements.matchList.innerHTML = `
      <div class="empty-state">
        No match feed has been connected yet. Once the scheduled updater runs with an API token, recent and upcoming matches will appear here.
      </div>
    `;
    return;
  }

  elements.matchList.innerHTML = matches
    .map((match) => {
      const score = match.score || (match.status === "TIMED" || match.status === "SCHEDULED" ? "Soon" : "-");
      return `
        <article class="match-row">
          <div class="match-date">${escapeHtml(formatDate(match.utcDate))}</div>
          <div>
            <div class="match-teams">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</div>
            <div class="match-stage">${escapeHtml(match.stageLabel)} | ${escapeHtml(match.status)}</div>
          </div>
          <div class="match-score">${escapeHtml(score)}</div>
        </article>
      `;
    })
    .join("");
}

function renderRules(scoreboard) {
  elements.rulesList.innerHTML = scoreboard.rules
    .map(
      (rule) => `
        <li>
          <span>${escapeHtml(rule.label)}</span>
          <span class="rule-points">${escapeHtml(rule.points)} ${Number(rule.points) === 1 ? "pt" : "pts"}</span>
        </li>
      `
    )
    .join("");
}

function renderError(error) {
  const message = escapeHtml(error.message || error);
  elements.leaderSummary.innerHTML = `<div class="error-state">Could not load the tracker data: ${message}</div>`;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

function render(pool, feed) {
  const scoreboard = calculateScoreboard(pool, feed);
  renderStatus(feed, scoreboard);
  renderLeader(scoreboard);
  renderStandings(scoreboard);
  renderOwners(scoreboard);
  renderMatches(scoreboard);
  renderRules(scoreboard);
}

async function refreshFeed() {
  if (!poolData || DATA_PARAM === "sample" || DEMO_PARAM === "1") {
    return;
  }

  try {
    activeFeed = await loadJson(`${FEED_PATH}?t=${Date.now()}`);
    render(poolData, activeFeed);
  } catch (error) {
    console.warn("Could not refresh match feed", error);
  }
}

async function main() {
  try {
    const [pool, feed] = await Promise.all([loadJson("./data/pool.json"), loadJson(FEED_PATH)]);
    poolData = pool;
    activeFeed = feed;
    render(poolData, activeFeed);
    if (DATA_PARAM !== "sample" && DEMO_PARAM !== "1") {
      refreshTimer = window.setInterval(refreshFeed, 60_000);
    }
  } catch (error) {
    renderError(error);
  }
}

main();

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});
