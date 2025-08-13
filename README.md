# NBA2K-Player-Ratings

Scrape the latest NBA 2K player ratings and attributes from `2kratings.com` and export them to CSV.

This project fetches every NBA team's roster page, visits each player page, scrapes attributes/badges, and writes the consolidated dataset to `./data`.

### Features

- **Full league scrape**: Visits all teams listed in `src/teams.js`.
- **Rich player schema**: General info, overall, 2K attributes, and badge counts.
- **CSV export**: Outputs a single CSV per run to `./data` with a date-based filename.

### Requirements

- Node.js 18+ (ESM modules enabled via `type: module`)
- Yarn or npm
- Internet access (scrapes public pages on `2kratings.com`)

### Install

```bash
git clone https://github.com/yourname/nba2k-player-ratings.git
cd nba2k-player-ratings
yarn install   # or: npm install
```

### Run

**Option 1: Standard scraper (may be blocked by Cloudflare)**
```bash
yarn start     # or: npm run start
```

**Option 2: Puppeteer scraper (recommended - handles Cloudflare challenges)**
```bash
npm run start:puppeteer
```

**Option 3: Extended Puppeteer scraper (all-time, classic, and more teams)**
```bash
# Scrape current NBA teams only
npm run scrape:current

# Scrape all-time teams (best players from each franchise's history)
npm run scrape:alltime

# Scrape classic teams (specific historical seasons)
npm run scrape:classic

# Scrape ALL teams (current, all-time, classic, all-decade, all-star, FIBA)
npm run scrape:all

# Or use the generic command with category parameter
npm run start:extended [category]
```

The Puppeteer version opens a real browser window and can handle Cloudflare's bot protection. You should see logs like:

```text
################ Initializing browser ... ################
################ Fetching player urls ... ################
Navigating to https://www.2kratings.com/teams/atlanta-hawks...
Found 15 players for atlanta-hawks
################ Fetching player details ... ################
---------- Atlanta Hawks ----------
Successfully fetched Trae Young's detail.
...
################ Saving data to disk ... ################
Successfully saved the latest rosters.
```

### Output

- A single CSV is written to `./data` named like: `2kroster_Mon Sep 23 2024.csv`.
- Note: The script currently calls `saveData` twice with the same filename; the second write overwrites the first during the same run, so you end up with one CSV per run (league-sorted). See Known limitations below.

### Data schema (CSV columns)

All fields come from `src/player.js` and scraping logic in `src/index.js`.

- General
  - `name` (string)
  - `height` (string)
  - `position` (string)
  - `team` (string; prettified from slug)
  - `overallAttribute` (int)
- Badges
  - `legendaryBadgeCount` (int)
  - `purpleBadgeCount` (int)
  - `goldBadgeCount` (int)
  - `silverBadgeCount` (int)
  - `bronzeBadgeCount` (int)
  - `badgeCount` (int; total)
  - `outsideScoringBadgeCount` (int)
  - `insideScoringBadgeCount` (int)
  - `generalOffenseBadgeCount` (int)
  - `playmakingBadgeCount` (int)
  - `defensiveBadgeCount` (int)
  - `reboundingBadgeCount` (int)
  - `allAroundBadgeCount` (int)
- Outside scoring
  - `closeShot`, `midRangeShot`, `threePointShot`, `freeThrow`, `shotIQ`, `offensiveConsistency` (ints)
- Athleticism
  - `speed`, `agility`, `strength`, `vertical`, `stamina`, `hustle`, `overallDurability` (ints)
- Inside scoring
  - `layup`, `standingDunk`, `drivingDunk`, `postHook`, `postFade`, `postControl`, `drawFoul`, `hands` (ints)
- Playmaking
  - `passAccuracy`, `ballHandle`, `speedWithBall`, `passIQ`, `passVision` (ints)
- Defense
  - `interiorDefense`, `perimeterDefense`, `steal`, `block`, `helpDefenseIQ`, `passPerception`, `defensiveConsistency` (ints)
- Rebounding
  - `offensiveRebound`, `defensiveRebound` (ints)

### How it works

- `src/index.js`
  - Builds team URLs from `BASE_URL` + `teams` slugs
  - Fetches each team page and collects player profile URLs
  - Fetches each player page and parses attributes/badges with Cheerio
  - Sorts players and writes CSV via `json2csv`
- `src/player.js`: Defines the player object schema used to collect fields
- `src/teams.js`: Defines `CURRENT_TEAMS` (team slugs used in URLs)
- `src/url.js`: Defines `BASE_URL`
- `src/util.js`: `teamNamePrettier` converts slugs to human-readable team names

### Configuration

- Change teams: edit `src/teams.js` (current teams) or `src/teams-extended.js` (all categories)
- Change base site: edit `src/url.js`
- Output directory: files are written to `./data/` (ensure it exists)

### Available Team Categories

The extended scraper supports these team categories:

- **`current`** (30 teams): Current NBA teams
- **`allTime`** (30 teams): All-time teams (best players from each franchise's history)
- **`classic`** (60+ teams): Classic teams (specific historical seasons like 1995-96 Bulls, 2000-01 Lakers, etc.)
- **`allDecade`** (6 teams): All-decade all-star teams (1960s through 2010s)
- **`allStar`** (2 teams): Current all-star teams (Eastern/Western Conference)
- **`fiba`** (6 teams): International FIBA teams (USA, France, Canada, etc.)
- **`all`** (130+ teams): All available teams combined

Each category creates separate CSV files with descriptive names like `2kroster_allTime_by_league_2024-01-15.csv`.

### Known limitations / notes

- The script calls `saveData` twice with the same filename, so only the second dataset remains on disk per run. If you need both variants, change filenames (e.g., append `-by-team` and `-by-league`).
- The scraper relies on current CSS selectors/structure of `2kratings.com`. Site changes can break parsing.
- **Cloudflare protection**: The standard scraper (`npm start`) may be blocked by Cloudflare. Use the Puppeteer version (`npm run start:puppeteer`) which opens a real browser and can handle Cloudflare challenges.
- **Rate limiting**: Both versions include delays to avoid overwhelming the server. The Puppeteer version uses longer delays (2s between teams, 1s between players).
- **Browser window**: The Puppeteer version opens a visible browser window by default. Set `headless: true` in `src/index-puppeteer.js` for headless operation.

### Tech stack

- Node.js, ESM
- Dependencies: `axios`, `cheerio`, `json2csv`, `puppeteer` (for Cloudflare bypass)

### License

ISC

### Disclaimer

This project scrapes publicly available data from `2kratings.com`. Use responsibly and follow the source website's terms of use. This project is not affiliated with 2K or `2kratings.com`.
