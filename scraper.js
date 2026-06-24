// scraper.js — Fetches jobs from multiple sources (no paid API keys required)
// Sources: LinkedIn, Remotive, Arbeitnow, WeWorkRemotely, Jobicy,
//          The Muse, Adzuna (optional), Indeed RSS (optional)

const axios   = require("axios");
const cheerio = require("cheerio");
const crypto  = require("crypto");
const profile = require("./profile");

// ── Utility ──────────────────────────────────────────────────────────────────
function makeId(source, str) {
  return source + "_" + crypto.createHash("md5").update(str).digest("hex").slice(0, 10);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(str) {
  return (str || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── 1. LinkedIn (public job search — no login needed for listings) ────────────
// Uses LinkedIn's public jobs search API (no key, no auth, rate-limited so we go slow)
async function scrapeLinkedIn(query) {
  const jobs = [];
  try {
    // LinkedIn's public search endpoint — returns JSON for guest users
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` +
      `?keywords=${encodeURIComponent(query)}` +
      `&location=Worldwide&f_WT=2&f_TPR=r86400&start=0`; // Remote, posted last 24h

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const $ = cheerio.load(res.data);

    $("li").each((_, el) => {
      const title   = $(el).find(".base-search-card__title").text().trim();
      const company = $(el).find(".base-search-card__subtitle").text().trim();
      const location= $(el).find(".job-search-card__location").text().trim();
      const link    = $(el).find("a.base-card__full-link").attr("href") ||
                      $(el).find("a").attr("href") || "";
      const jobId   = $(el).attr("data-entity-urn") || link;

      if (!title || !link) return;

      jobs.push({
        jobId:       makeId("linkedin", jobId),
        title,
        company:     company || "Unknown",
        location,
        country:     location,
        countryCode: "remote",
        description: `${title} at ${company}. ${location}. Apply on LinkedIn.`,
        applyUrl:    link.split("?")[0], // clean tracking params
        source:      "linkedin",
        workType:    "Remote",
        salary:      "",
        foundAt:     new Date(),
      });
    });

    // Also try the regular search page for more results
    const url2 = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&f_WT=2&f_TPR=r604800`;
    const res2 = await axios.get(url2, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const $2 = cheerio.load(res2.data);
    $2(".jobs-search__results-list li, .base-card").each((_, el) => {
      const title   = $2(el).find(".base-search-card__title, h3").first().text().trim();
      const company = $2(el).find(".base-search-card__subtitle, h4").first().text().trim();
      const location= $2(el).find(".job-search-card__location, .base-search-card__metadata").first().text().trim();
      const link    = $2(el).find("a").attr("href") || "";
      if (!title || !link || !link.includes("linkedin.com/jobs")) return;
      jobs.push({
        jobId:       makeId("linkedin", link),
        title,
        company:     company || "Unknown",
        location,
        country:     location,
        countryCode: "remote",
        description: `${title} at ${company}. ${location}. Apply on LinkedIn.`,
        applyUrl:    link.split("?")[0],
        source:      "linkedin",
        workType:    "Remote",
        salary:      "",
        foundAt:     new Date(),
      });
    });

  } catch (e) {
    console.error(`[LinkedIn] ${e.message}`);
  }
  return jobs;
}

// ── 2. Remotive (remote tech jobs — free JSON API) ────────────────────────────
async function scrapeRemotive(query) {
  const jobs = [];
  try {
    const res = await axios.get(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`,
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
        description: stripHtml(item.description),
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

// ── 3. WeWorkRemotely (popular remote job board — free RSS) ──────────────────
async function scrapeWeWorkRemotely(query) {
  const jobs = [];
  // WWR has RSS feeds per category — security/IT falls under "devops-sysadmin"
  const feeds = [
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
    "https://weworkremotely.com/remote-jobs.rss",
  ];

  for (const feedUrl of feeds) {
    try {
      const res = await axios.get(feedUrl, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const $ = cheerio.load(res.data, { xmlMode: true });
      const qLower = query.toLowerCase();

      $("item").each((_, el) => {
        const title   = $("title", el).first().text().replace("<![CDATA[", "").replace("]]>", "").trim();
        const link    = $("link", el).text().trim() || $("guid", el).text().trim();
        const desc    = $("description", el).text();
        const company = $("region", el).text().trim() || "Unknown";

        // Only include if title/description is relevant to the query
        const combined = `${title} ${desc}`.toLowerCase();
        if (!title || !link) return;
        if (!combined.includes(qLower.split(" ")[0]) && !combined.includes("security") && !combined.includes("soc")) return;

        jobs.push({
          jobId:       makeId("wwr", link),
          title,
          company,
          location:    "Remote",
          country:     "Worldwide (Remote)",
          countryCode: "remote",
          description: stripHtml(desc),
          applyUrl:    link.startsWith("http") ? link : `https://weworkremotely.com${link}`,
          source:      "weworkremotely",
          workType:    "Remote",
          salary:      "",
          foundAt:     new Date(),
        });
      });
      await sleep(500);
    } catch (e) {
      console.error(`[WWR] ${e.message}`);
    }
  }
  return jobs;
}

// ── 4. Jobicy (remote jobs — free JSON API, no key) ──────────────────────────
async function scrapeJobicy(query) {
  const jobs = [];
  try {
    const res = await axios.get(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(query)}`,
      { timeout: 10000 }
    );
    const items = res.data?.jobs || [];
    for (const item of items) {
      jobs.push({
        jobId:       makeId("jobicy", String(item.id)),
        title:       item.jobTitle,
        company:     item.companyName,
        location:    item.jobGeo || "Remote",
        country:     item.jobGeo || "Worldwide",
        countryCode: "remote",
        description: stripHtml(item.jobDescription || item.jobExcerpt || ""),
        applyUrl:    item.url,
        source:      "jobicy",
        workType:    "Remote",
        salary:      item.annualSalaryMin
                       ? `$${item.annualSalaryMin}–$${item.annualSalaryMax}`
                       : "",
        foundAt:     new Date(item.pubDate) || new Date(),
      });
    }
  } catch (e) {
    console.error(`[Jobicy] ${e.message}`);
  }
  return jobs;
}

// ── 5. The Muse (global jobs — free JSON API) ────────────────────────────────
async function scrapeTheMuse(query) {
  const jobs = [];
  try {
    const res = await axios.get(
      `https://www.themuse.com/api/public/jobs?category=IT+%26+Security&level=Entry+Level&level=Mid+Level&page=1&descended=true`,
      { timeout: 10000 }
    );
    const items = res.data?.results || [];
    const qLower = query.toLowerCase();

    for (const item of items) {
      const title = item.name || "";
      const desc  = stripHtml(item.contents || "");
      // Filter to relevant roles only
      if (!title.toLowerCase().includes(qLower.split(" ")[0]) &&
          !title.toLowerCase().includes("security") &&
          !title.toLowerCase().includes("soc") &&
          !title.toLowerCase().includes("it support")) continue;

      const location = item.locations?.[0]?.name || "Remote";
      jobs.push({
        jobId:       makeId("themuse", String(item.id)),
        title,
        company:     item.company?.name || "Unknown",
        location,
        country:     location,
        countryCode: "remote",
        description: desc,
        applyUrl:    item.refs?.landing_page || `https://www.themuse.com/jobs/${item.id}`,
        source:      "themuse",
        workType:    item.locations?.[0]?.name?.toLowerCase().includes("remote") ? "Remote" : "On-site",
        salary:      "",
        foundAt:     new Date(item.publication_date) || new Date(),
      });
    }
  } catch (e) {
    console.error(`[TheMuse] ${e.message}`);
  }
  return jobs;
}

// ── 6. Arbeitnow (EU visa-sponsored jobs — free, no key) ─────────────────────
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
        description: stripHtml(item.description),
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

// ── 7. Indeed RSS (country-specific) ────────────────────────────────────────
async function scrapeIndeed(query, countryCode, countryName) {
  const jobs = [];
  const tldMap = {
    gb: "co.uk", us: "com", ca: "ca", au: "com.au", in: "co.in",
    sg: "com.sg", my: "com.my", de: "de", ie: "ie",
    nl: "nl", se: "se",
  };
  const tld = tldMap[countryCode];
  if (!tld) return jobs;

  const url = `https://${tld}.indeed.com/rss?q=${encodeURIComponent(query)}+visa+sponsorship&sort=date&limit=25`;
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoApply/1.0)" },
    });
    const $ = cheerio.load(res.data, { xmlMode: true });
    $("item").each((_, el) => {
      const title       = $(el).find("title").text().trim();
      const link        = $(el).find("link").text().trim() || $(el).find("guid").text().trim();
      const description = stripHtml($(el).find("description").text());
      const pubDate     = $(el).find("pubDate").text().trim();
      const company     = $(el).find("source").text().trim() || "Unknown";
      if (!title || !link) return;
      jobs.push({
        jobId:       makeId("indeed_" + countryCode, link),
        title, company,
        location:    countryName,
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

// ── 8. Adzuna (optional — free API key, 250 req/month) ───────────────────────
async function scrapeAdzuna(query, countryCode) {
  const jobs = [];
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return jobs;

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

// ── Main scrape function ──────────────────────────────────────────────────────
async function scrapeAllJobs(logFn) {
  const allJobs = [];
  logFn("info", "Starting job scrape across all sources...");

  // 1. LinkedIn (global remote — biggest source)
  let linkedInCount = 0;
  for (const title of profile.jobTitles.slice(0, 4)) {
    const jobs = await scrapeLinkedIn(title);
    allJobs.push(...jobs);
    linkedInCount += jobs.length;
    await sleep(2000); // LinkedIn needs a longer delay to avoid rate limiting
  }
  logFn("ok", `LinkedIn: ${linkedInCount} jobs fetched`);

  // 2. Remotive (global remote)
  let remotiveStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 4)) {
    const jobs = await scrapeRemotive(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `Remotive: ${allJobs.length - remotiveStart} jobs fetched`);

  // 3. WeWorkRemotely (remote jobs)
  let wwrStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 3)) {
    const jobs = await scrapeWeWorkRemotely(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `WeWorkRemotely: ${allJobs.length - wwrStart} jobs fetched`);

  // 4. Jobicy (remote jobs)
  let jobicyStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 3)) {
    const jobs = await scrapeJobicy(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `Jobicy: ${allJobs.length - jobicyStart} jobs fetched`);

  // 5. The Muse (global)
  let museStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 2)) {
    const jobs = await scrapeTheMuse(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `TheMuse: ${allJobs.length - museStart} jobs fetched`);

  // 6. Arbeitnow (EU visa-sponsored)
  let arbStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 3)) {
    const jobs = await scrapeArbeitnow(title);
    allJobs.push(...jobs);
    await sleep(500);
  }
  logFn("ok", `Arbeitnow (EU visa-sponsored): ${allJobs.length - arbStart} jobs fetched`);


  // 8. Naukri.com (India jobs — no key needed)
  let naukriStart = allJobs.length;
  for (const title of profile.jobTitles.slice(0, 4)) {
    const jobs = await scrapeNaukri(title);
    allJobs.push(...jobs);
    await sleep(1000);
  }
  logFn("ok", `Naukri (India): ${allJobs.length - naukriStart} jobs fetched`);

  // 9. Indeed RSS per country
  let indeedCount = 0;
  for (const c of profile.targetCountries) {
    for (const title of profile.jobTitles.slice(0, 2)) {
      const jobs = await scrapeIndeed(title, c.code, c.country);
      allJobs.push(...jobs);
      indeedCount += jobs.length;
      await sleep(800);
    }
  }
  logFn("ok", `Indeed: ${indeedCount} jobs fetched across ${profile.targetCountries.length} countries`);

  // 8. Adzuna (if API keys provided in .env)
  if (process.env.ADZUNA_APP_ID) {
    let adzunaCount = 0;
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

// ── 9. Naukri.com (India's biggest job board — injected at module load) ───────
// Uses Naukri's internal search API (no official public API but this endpoint
// is stable and used by their own website).
async function scrapeNaukri(query) {
  const jobs = [];
  try {
    const encoded = encodeURIComponent(query);
    const res = await axios.get(
      `https://www.naukri.com/jobapi/v3/search?noOfResults=30&urlType=search_by_keyword&searchType=adv&keyword=${encoded}&pageNo=1&seoKey=${encoded}-jobs&src=jobsearchDesk&latLong=`,
      {
        timeout: 15000,
        headers: {
          "User-Agent":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept":       "application/json",
          "appid":        "109",
          "systemid":     "Naukri",
          "Referer":      `https://www.naukri.com/${encoded.replace(/%20/g,"-")}-jobs`,
        },
      }
    );

    const items = res.data?.jobDetails || [];
    for (const item of items) {
      const salary = item.placeholders?.find(p => p.type === "salary")?.label || "";
      const loc    = item.placeholders?.find(p => p.type === "location")?.label || "India";
      jobs.push({
        jobId:       makeId("naukri", String(item.jobId || item.title)),
        title:       item.title,
        company:     item.companyName,
        location:    loc,
        country:     "India",
        countryCode: "in",
        description: stripHtml(item.jobDescription || item.tagsAndSkills || ""),
        applyUrl:    item.jdURL ? `https://www.naukri.com${item.jdURL}` : "https://www.naukri.com",
        source:      "naukri",
        workType:    item.isWork_from_home ? "Remote" : "On-site",
        salary,
        foundAt:     new Date(),
      });
    }
  } catch (e) {
    console.error(`[Naukri] ${e.message}`);
  }
  return jobs;
}
