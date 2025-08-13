import puppeteer from "puppeteer";
import fs from "fs";
import { parse } from "json2csv";

import { BASE_URL } from "./url.js";
import { TEAM_CATEGORIES } from "./teams-extended.js";
import { player } from "./player.js";
import { teamNamePrettier } from "./util.js";

// Helper function to add delays between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize Puppeteer browser with anti-detection settings
 */
async function initBrowser() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  
  // Set viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  });

  return { browser, page };
}

/**
 * Get each team's URL.
 */
function getTeamsUrl(team) {
  let baseUrl = BASE_URL;
  return `${baseUrl}/teams/${team}`;
}

/**
 * Get all player urls in one team using Puppeteer.
 */
async function getPlayersUrlsFromEachTeam(page, team) {
  let playerUrls = [];
  let teamUrl = getTeamsUrl(team);

  try {
    console.log(`Navigating to ${teamUrl}...`);
    await page.goto(teamUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for Cloudflare challenge to complete if present
    await delay(5000);
    
    // Check if we're on a Cloudflare challenge page
    const challengeTitle = await page.$('title');
    if (challengeTitle) {
      const titleText = await page.evaluate(el => el.textContent, challengeTitle);
      if (titleText.includes('Just a moment')) {
        console.log('Cloudflare challenge detected, waiting...');
        await delay(10000); // Wait longer for challenge to complete
      }
    }

    // Wait for the table to load
    await page.waitForSelector('tbody', { timeout: 30000 });
    
    // Extract player URLs
    playerUrls = await page.evaluate(() => {
      const entries = document.querySelectorAll('tbody .entry-font a');
      return Array.from(entries).map(entry => entry.href);
    });

    if (playerUrls.length > 0) {
      console.log(`Found ${playerUrls.length} players for ${team}`);
      return playerUrls;
    } else {
      throw new Error("Empty playerUrls length");
    }
  } catch (error) {
    console.log(`Error fetching players for ${team}:`, error.message);
    throw new Error("Failed to get player detail response.");
  }
}

/**
 * Get each player's attribute details using Puppeteer.
 */
async function getPlayerDetail(page, team, playerUrl) {
  try {
    console.log(`Fetching player details from ${playerUrl}...`);
    await page.goto(playerUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for Cloudflare challenge to complete if present
    await delay(3000);
    
    // Check if we're on a Cloudflare challenge page
    const challengeTitle = await page.$('title');
    if (challengeTitle) {
      const titleText = await page.evaluate(el => el.textContent, challengeTitle);
      if (titleText.includes('Just a moment')) {
        console.log('Cloudflare challenge detected, waiting...');
        await delay(8000);
      }
    }

    var p = new player();

    // Extract player data using page.evaluate
    const playerData = await page.evaluate(() => {
      // name
      const nameDiv = document.querySelector('h1');
      const name = nameDiv ? nameDiv.textContent.trim() : '';

      // overall attribute
      const overallAttribute = document.querySelector('.attribute-box-player');
      const overall = overallAttribute ? parseInt(overallAttribute.textContent.trim()) : 0;

      // height + position
      const generalStatParent = document.querySelector('.header-subtitle');
      let height = '';
      let position = '';
      
      if (generalStatParent && generalStatParent.children.length > 6) {
        height = generalStatParent.children[6]?.children[1]?.children[0]?.data || '';
        position = generalStatParent.children[4]?.children[1]?.children[0]?.data || '';
      }

      // attributes
      const attributes = document.querySelectorAll('.content .card .card-body .list-no-bullet li .attribute-box');
      const attributeValues = Array.from(attributes).map(attr => parseInt(attr.textContent.trim()) || 0);

      // badges
      const badgeCounts = document.querySelectorAll('.badge-count');
      const badgeValues = Array.from(badgeCounts).map(badge => parseInt(badge.textContent.trim()) || 0);

      // badge category counts
      const outsideScoringCount = document.querySelector('#pills-outscoring-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const insideScoringCount = document.querySelector('#pills-inscoring-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const playmakingCount = document.querySelector('#pills-playmaking-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const defenseCount = document.querySelector('#pills-defense-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const reboundingCount = document.querySelector('#pills-rebounding-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const generalOffenseCount = document.querySelector('#pills-genoffense-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;
      const allAroundCount = document.querySelector('#pills-allaround-tab')?.textContent.match(/\((\d+)\)/)?.[1] || 0;

      return {
        name,
        overall,
        height,
        position,
        attributeValues,
        badgeValues,
        outsideScoringCount: parseInt(outsideScoringCount),
        insideScoringCount: parseInt(insideScoringCount),
        playmakingCount: parseInt(playmakingCount),
        defenseCount: parseInt(defenseCount),
        reboundingCount: parseInt(reboundingCount),
        generalOffenseCount: parseInt(generalOffenseCount),
        allAroundCount: parseInt(allAroundCount)
      };
    });

    // Populate player object
    p.name = playerData.name;
    p.overallAttribute = playerData.overall;
    p.team = team;
    p.height = playerData.height;
    p.position = playerData.position;

    // Badges
    if (playerData.badgeValues.length >= 6) {
      p.legendaryBadgeCount = playerData.badgeValues[0];
      p.purpleBadgeCount = playerData.badgeValues[1];
      p.goldBadgeCount = playerData.badgeValues[2];
      p.silverBadgeCount = playerData.badgeValues[3];
      p.bronzeBadgeCount = playerData.badgeValues[4];
      p.badgeCount = playerData.badgeValues[5];
    }

    p.outsideScoringBadgeCount = playerData.outsideScoringCount;
    p.insideScoringBadgeCount = playerData.insideScoringCount;
    p.playmakingBadgeCount = playerData.playmakingCount;
    p.defensiveBadgeCount = playerData.defenseCount;
    p.reboundingBadgeCount = playerData.reboundingCount;
    p.generalOffenseBadgeCount = playerData.generalOffenseCount;
    p.allAroundBadgeCount = playerData.allAroundCount;

    // Attributes (assuming the order from the original scraper)
    if (playerData.attributeValues.length >= 35) {
      // Outside scoring
      p.closeShot = playerData.attributeValues[0];
      p.midRangeShot = playerData.attributeValues[1];
      p.threePointShot = playerData.attributeValues[2];
      p.freeThrow = playerData.attributeValues[3];
      p.shotIQ = playerData.attributeValues[4];
      p.offensiveConsistency = playerData.attributeValues[5];

      // Athleticism
      p.speed = playerData.attributeValues[6];
      p.agility = playerData.attributeValues[7];
      p.strength = playerData.attributeValues[8];
      p.vertical = playerData.attributeValues[9];
      p.stamina = playerData.attributeValues[10];
      p.hustle = playerData.attributeValues[11];
      p.overallDurability = playerData.attributeValues[12];

      // Inside scoring
      p.layup = playerData.attributeValues[13];
      p.standingDunk = playerData.attributeValues[14];
      p.drivingDunk = playerData.attributeValues[15];
      p.postHook = playerData.attributeValues[16];
      p.postFade = playerData.attributeValues[17];
      p.postControl = playerData.attributeValues[18];
      p.drawFoul = playerData.attributeValues[19];
      p.hands = playerData.attributeValues[20];

      // Playmaking
      p.passAccuracy = playerData.attributeValues[21];
      p.ballHandle = playerData.attributeValues[22];
      p.speedWithBall = playerData.attributeValues[23];
      p.passIQ = playerData.attributeValues[24];
      p.passVision = playerData.attributeValues[25];

      // Defense
      p.interiorDefense = playerData.attributeValues[26];
      p.perimeterDefense = playerData.attributeValues[27];
      p.steal = playerData.attributeValues[28];
      p.block = playerData.attributeValues[29];
      p.helpDefenseIQ = playerData.attributeValues[30];
      p.passPerception = playerData.attributeValues[31];
      p.defensiveConsistency = playerData.attributeValues[32];

      // Rebounding
      p.offensiveRebound = playerData.attributeValues[33];
      p.defensiveRebound = playerData.attributeValues[34];
    }

    return p;
  } catch (error) {
    console.log(`Error fetching player details:`, error.message);
    throw new Error("Failed to get player details");
  }
}

/**
 * Player sorting comparator to group by each team, then sort all players by overall attributes from highest to lowest among the team
 */
function sortPlayersWithTeamGroupBy(a, b) {
  return a.team === b.team
    ? b.overallAttribute - a.overallAttribute
    : a.team < b.team;
}

/**
 * Player sorting comparator to sort all players by overall attributes from highest to lowest among the whole league.
 */
function sortPlayersWithoutTeamGroupBy(a, b) {
  return b.overallAttribute - a.overallAttribute;
}

/**
 * Save data to local disk. Every new run generates a new file.
 */
function saveData(db, filename) {
  const csvData = parse(db);
  let filePath = `./data/${filename}.csv`;
  
  fs.writeFile(filePath, csvData, error => {
      if (error == null) {
          console.log(`Successfully saved ${filename}.csv`);
      } else {
          console.log(`Failed to save ${filename}.csv:`, error);
      }
  })
}

/**
 * Main scraping function that can handle different team categories
 */
const main = async function (teamCategory = 'current') {
  let teams = TEAM_CATEGORIES[teamCategory] || TEAM_CATEGORIES.current;
  let browser = null;
  let page = null;

  console.log(`Starting scrape for ${teamCategory} teams (${teams.length} teams total)`);

  try {
    // Initialize browser
    console.log("################ Initializing browser ... ################");
    const browserData = await initBrowser();
    browser = browserData.browser;
    page = browserData.page;

    // <teams, all player urls>
    var roster = new Map();

    // all players details
    var players = [];

    console.log("################ Fetching player urls ... ################");
    for (let team of teams) {
      try {
        let playerUrls = await getPlayersUrlsFromEachTeam(page, team);
        roster.set(team, playerUrls);
        // Add delay between team requests to avoid overwhelming the server
        await delay(2000);
      } catch (error) {
        console.log(`Skipping ${team} due to error:`, error.message);
        continue;
      }
    }

    console.log("################ Fetching player details ... ################");
    for (let team of teams) {
      let playerUrls = roster.get(team);
      if (!playerUrls) continue;
      
      let prettiedTeamName = teamNamePrettier(team);

      console.log(`---------- ${prettiedTeamName} ----------`);

      // Process players sequentially with delays to avoid rate limiting
      for (let playerUrl of playerUrls) {
        try {
          let player = await getPlayerDetail(page, prettiedTeamName, playerUrl);
          players.push(player);
          console.log(`Successfully fetched ${player.name}'s detail.`);
          // Add delay between player requests
          await delay(1000);
        } catch (error) {
          console.log(`Failed to fetch player from ${playerUrl}:`, error.message);
          continue;
        }
      }
    }

    if (players.length === 0) {
      console.log("No players were successfully scraped!");
      return;
    }

    let teamResult = [...players].sort(sortPlayersWithTeamGroupBy);
    let leagueResult = players.sort(sortPlayersWithoutTeamGroupBy);

    console.log("################ Saving data to disk ... ################");
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    saveData(teamResult, `2kroster_${teamCategory}_by_team_${timestamp}`);
    saveData(leagueResult, `2kroster_${teamCategory}_by_league_${timestamp}`);

    console.log(`\nScraping complete!`);
    console.log(`- Total players scraped: ${players.length}`);
    console.log(`- Teams processed: ${roster.size}`);
    console.log(`- Files saved: 2kroster_${teamCategory}_by_team_${timestamp}.csv and 2kroster_${teamCategory}_by_league_${timestamp}.csv`);

  } catch (error) {
    console.error("Error in main:", error);
  } finally {
    // Always close the browser
    if (browser) {
      await browser.close();
    }
  }
};

// Get command line arguments
const args = process.argv.slice(2);
const teamCategory = args[0] || 'current';

// Validate team category
const validCategories = Object.keys(TEAM_CATEGORIES);
if (!validCategories.includes(teamCategory)) {
  console.log(`Invalid team category: ${teamCategory}`);
  console.log(`Valid categories: ${validCategories.join(', ')}`);
  console.log(`Usage: node src/index-puppeteer-extended.js [category]`);
  console.log(`Examples:`);
  console.log(`  node src/index-puppeteer-extended.js current     # Current NBA teams only`);
  console.log(`  node src/index-puppeteer-extended.js allTime     # All-time teams only`);
  console.log(`  node src/index-puppeteer-extended.js classic     # Classic teams only`);
  console.log(`  node src/index-puppeteer-extended.js all         # All teams (very long!)`);
  process.exit(1);
}

main(teamCategory);
