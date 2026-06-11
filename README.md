# World Cup 2026 Pool Tracker

Standalone static tracker for the World Cup 2026 office pool. It is separate from the Alpaca trading dashboard and can live in its own GitHub repository.

## What It Does

- Shows standings for Chase, Caul, Byron, Bailey, Rylan, Reid, Rodney, and Preston.
- Scores the drafted teams from `data/pool.json`.
- Reads match data from `data/worldcup.json`.
- Supports a demo feed with `?data=sample`.
- Includes a scheduled GitHub Pages workflow that can refresh scores every 5 minutes.

## Scoring Rules

- Group Stage Win: 3 points
- Group Stage Draw: 1 point
- Round of 32 appearance: 5 points
- Round of 16 appearance: 8 points
- Quarterfinal appearance: 12 points
- Semifinal appearance: 18 points
- Final appearance: 25 points
- World Cup Champion: 40 points

## Local Preview

From this folder:

```powershell
npm run validate
npm run score:sample
npm run start
```

Then open:

- Live/empty feed: `http://localhost:4173/`
- Demo scoring feed: `http://localhost:4173/?data=sample`

## Automatic Updates

The default updater uses the public WorldCup26 API at `https://worldcup26.ir/get/games`, so no token is required for the basic live tracker. The scheduled job runs server-side in GitHub Actions and deploys the already-generated JSON to GitHub Pages. The browser re-checks `data/worldcup.json` every 60 seconds while the page is open.

`football-data.org` remains supported as an optional fallback if you later add a `FOOTBALL_DATA_TOKEN` secret and run:

```powershell
node scripts/update-worldcup-data.mjs --provider=football-data
```

Setup:

1. Create a new GitHub repository for this folder.
2. Push these files to that repository.
3. In GitHub, go to `Settings > Pages` and set the source to `GitHub Actions`.
4. Run the `Update and deploy pool tracker` workflow manually once.

The public URL will be shown on the workflow run and under `Settings > Pages`.

## Data Source Notes

- WorldCup26 public API source: https://github.com/rezarahiminia/worldcup2026
- WorldCup26 games endpoint: https://worldcup26.ir/get/games
- football-data.org API docs: https://www.football-data.org/documentation/api
- Competition matches endpoint docs: https://docs.football-data.org/general/v4/competition.html#matches
- API tokens, if added later, should stay in GitHub Actions, Netlify, Cloudflare, or another server-side environment.
- If WorldCup26 or football-data.org does not expose the exact match truth needed, the same `data/worldcup.json` shape can be produced by Sportmonks, API-Football, a Google Sheet export, or a small manual admin script.

## Files

- `index.html`: static page shell.
- `styles.css`: responsive dashboard styling.
- `app.js`: browser rendering.
- `scoring.js`: pure scoring engine shared by browser and scripts.
- `data/pool.json`: players, teams, aliases, and rules.
- `data/worldcup.json`: live feed target written by the updater.
- `data/worldcup.sample.json`: fake sample data for testing and demos only.
- `scripts/update-worldcup-data.mjs`: scheduled feed updater.
- `.github/workflows/pages.yml`: hourly GitHub Pages deployment.
