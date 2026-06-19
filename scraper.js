// scraper.js — Fetches jobs from multiple free sources

const axios   = require("axios");
const cheerio = require("cheerio");
const crypto  = require("crypto");
const profile = require("./profile");

// ── Utility ──────────────────────────────────────────────────────────────────
function makeId(source, str) {
  return source + "_" + crypto.createHash("md5").update(str).digest("hex").slice(0, 10);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 1. Indeed RSS (no API key needed) ────────────────────────────────────────
async function scrapeIndeed(query, countryCode, countryName) {
  const jobs = [];
  // Indeed has country-specific RSS feeds
  const tldMap = {
    gb: "co.uk", us: "com", ca: "ca", au: "com.au", in: "co.in",
    sg: "com.sg", my: "com.my", de: "de", ie: "ie",
    nl: "nl", se: "se",
  };
  const tld = tldMap[countryCode] || "com";
  const url = `https://${tld}.indeed.com/rss?q=${encodeURIComponent(query)}+visa+sponsorship&l=&sort=date&limit=25`;

  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoApply/1.0)" },
    });
    const $ = cheerio.load(res.data, { xmlMode: true });

    $("item").each((_, el) => {
      const title       = $(el).find("title").text().trim();
      const link        = $(el).find("link").text().trim() || $(el).find("guid").text().trim();
      const description = $(el).find("description").text().replace(/<[^>]+>/g, " ").trim();
      const pubDate     = $(el).find("pubDate").text().trim();
      const company     = $(el).find("source").text().trim() || "Unknown";
      const location    = countryName;

      if (!title || !link) return;

      jobs.push({
        jobId:       makeId("indeed_" + countryCode, link),
        title,
        company,
        location,
        country:     countryName,
        countryCode,
        description,
        applyUrl:    link,
        source:      "indeed",
        workType:    description.toLowerCase().includes("remote") ? "Remote" : "On-site",
        salary:      "",
        foundAt:     new Date(pubDate) || new Date(),
      });
    });
  } catch (e) {
    console.error(`[Indeed/${countryCode}] ${e.message}`);
  }
  return jobs;
}

// ── 2. Remotive (remote tech jobs — free JSON API) ────────────────────────────
async function scrapeRemotive(query) {
  const jobs = [];
  try {
    const res = await axios.get(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=30`,
      { timeout: 10000 }
    );
    const items = res.data?.jobs || [];
    for (const item of items) {
      jobs.push({
        jobId:       makeId("remotive", String(item.id)),
        title:       item.title,
        company:     item.company_name,
        location:    item.candidate_required_location || "Worldwide",
        country:     "Worldwide (Remote)",
        countryCode: "remote",
        description: (item.description || "").replace(/<[^>]+>/g, " "),
        applyUrl:    item.url,
        source:      "remotive",
        workType:    "Remote",
        salary:      item.salary || "",
        foundAt:     new Date(item.publication_date) || new Date(),
      });
    }
  } catch (e) {
    console.error(`[Remotive] ${e.message}`);
  }
  return jobs;
}

// ── 3. Adzuna (free API — 250 req/month free tier) ───────────────────────────
// Sign up at https://developer.adzuna.com/ — free account, 250 calls/month
async function scrapeAdzuna(query, countryCode) {
  const jobs = [];
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return jobs; // skip if not configured

  const countryMap = { gb: "gb", us: "us", ca: "ca", au: "au", de: "de", sg: "sg" };
  const code = countryMap[countryCode];
  if (!code) return jobs;

  try {
    const res = await axios.get(
      `https://api.adzuna.com/v1/api/jobs/${code}/search/1` +
      `?app_id=${appId}&app_key=${appKey}` +
      `&results_per_page=20&what=${encodeURIComponent(query)}&what_and=visa+sponsorship`,
      { timeout: 10000 }
    );
    const items = res.data?.results || [];
    for (const item of items) {
      jobs.push({
        jobId:       makeId("adzuna_" + code, String(item.id)),
        title:       item.title,
        company:     item.company?.display_name || "Unknown",
        location:    item.location?.display_name || code.toUpperCase(),
        country:     item.location?.display_name || code.toUpperCase(),
        countryCode: code,
        description: item.description || "",
        applyUrl:    item.redirect_url,
        source:      "adzuna",
        workType:    item.contract_type === "permanent" ? "On-site" : "Contract",
        salary:      item.salary_min
                       ? `${Math.round(item.salary_min)}–${Math.round(item.salary_max || item.salary_min)}`
                       : "",
        foundAt:     new Date(item.created) || new Date(),
      });
    }
  } catch (e) {
    console.error(`[Adzuna/${code}] ${e.message}`);
  }
  return jobs;
}

// ── 4. Arbeitnow (EU jobs — free, no key needed) ─────────────────────────────
async function scrapeArbeitnow(query) {
  const jobs = [];
  try {
    const res = await axios.get(
      `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}&visa_sponsorship=true`,
      { timeout: 10000 }
    );
    const items = res.data?.data || [];
    for (const item of items) {
      jobs.push({
        jobId:       makeId("arbeitnow", item.slug || String(item.created_at)),
        title:       item.title,
        company:     item.company_name,
        location:    item.location || "Europe",
        country:     item.location || "Europe",
        countryCode: "eu",
        description: (item.description || "").replace(/<[^>]+>/g, " "),
        applyUrl:    item.url,
        source:      "arbeitnow",
        workType:    item.remote ? "Remote" : "On-site",
        salary:      "",
        foundAt:     new Date(item.created_at * 1000) || new Date(),
      });
    }
  } catch (e) {
    console.error(`[Arbeitnow] ${e.message}`);
  }
  return jobs;
}

// ── Main scrape function ──────────────────────────────────────────────────────
async function scrapeAllJobs(logFn) {
  const allJobs = [];
  logFn("info", "Starting job scrape across all sources...");

  // Remotive (global remote — no key needed)
  for (const title of profile.jobTitles.slice(0, 4)) {
    const jobs = await scrapeRemotive(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `Remotive: ${allJobs.length} jobs fetched`);

  // Arbeitnow (EU visa-sponsored — no key needed)
  for (const title of profile.jobTitles.slice(0, 3)) {
    const jobs = await scrapeArbeitnow(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `Arbeitnow: fetched EU visa-sponsored jobs`);

  // Indeed RSS per country
  let indeedCount = 0;
  for (const c of profile.targetCountries) {
    for (const title of profile.jobTitles.slice(0, 2)) {
      const jobs = await scrapeIndeed(title, c.code, c.country);
      allJobs.push(...jobs);
      indeedCount += jobs.length;
      await sleep(800); // be polite
    }
  }
  logFn("ok", `Indeed: ${indeedCount} jobs fetched across ${profile.targetCountries.length} countries`);

  // Adzuna (if API keys provided)
  let adzunaCount = 0;
  if (process.env.ADZUNA_APP_ID) {
    for (const c of ["gb", "us", "ca", "au"]) {
      for (const title of profile.jobTitles.slice(0, 2)) {
        const jobs = await scrapeAdzuna(title, c);
        allJobs.push(...jobs);
        adzunaCount += jobs.length;
        await sleep(500);
      }
    }
    logFn("ok", `Adzuna: ${adzunaCount} jobs fetched`);
  }

  logFn("info", `Total scraped: ${allJobs.length} jobs`);
  return allJobs;
}

module.exports = { scrapeAllJobs };
