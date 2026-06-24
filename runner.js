// runner.js — Core daily job application engine

const { Job, RunLog } = require("./models/Job");
const { scrapeAllJobs } = require("./scraper");
const { scoreJob }      = require("./matcher");
const { sendDailySummary } = require("./emailer");
const { sendTelegramAlert } = require("./telegram");
const profile = require("./profile");

let currentRun = null;
function getRunState() { return currentRun; }

async function applyToJob(job, logFn) {
  try {
    await Job.findOneAndUpdate(
      { jobId: job.jobId },
      { status: "applied", appliedAt: new Date(), notes: "Marked applied via AutoApply" },
      { upsert: true }
    );
    logFn("ok", `Matched → ${job.title} at ${job.company} (${job.country}) [${job.matchScore}%]`);
    return true;
  } catch (e) {
    logFn("warn", `Failed → ${job.title}: ${e.message}`);
    await Job.findOneAndUpdate({ jobId: job.jobId }, { status: "failed" });
    return false;
  }
}

async function runDailyApply(io) {
  const startTime = Date.now();
  const runDate   = new Date();
  const logs      = [];
  let totalFound = 0, totalMatched = 0, totalApplied = 0, totalSkipped = 0, totalFailed = 0;

  function logFn(level, message) {
    const entry = { time: new Date(), level, message };
    logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${message}`);
    if (io) io.emit("log", entry);
    if (currentRun) currentRun.logs.push(entry);
  }

  currentRun = {
    running: true, startedAt: runDate, logs: [],
    stats: { found: 0, matched: 0, applied: 0, skipped: 0, failed: 0 },
    appliedJobs: [], matchedJobs: [],
  };
  if (io) io.emit("run:start", { startedAt: runDate });

  try {
    logFn("info", "═══ AutoApply daily run started ═══");

    // ── Step 1: Scrape ──────────────────────────────────────────────────────
    const scrapedJobs = await scrapeAllJobs(logFn);
    totalFound = scrapedJobs.length;
    currentRun.stats.found = totalFound;
    if (io) io.emit("run:stats", currentRun.stats);
    logFn("info", `Scraped ${totalFound} total listings`);

    // ── Step 2: Score & filter ──────────────────────────────────────────────
    const maxPerDay = parseInt(process.env.MAX_APPLY_PER_DAY) || profile.scoring.maxApplyPerDay;
    const minScore  = parseInt(process.env.MIN_MATCH_SCORE)   || profile.scoring.minScoreToApply;
    const candidateJobs = [];

    for (const raw of scrapedJobs) {
      const existing = await Job.findOne({ jobId: raw.jobId });
      if (existing && ["applied", "skipped"].includes(existing.status)) {
        totalSkipped++;
        continue;
      }

      const { score, matchedSkills, hasVisa, isBlacklisted } = scoreJob(raw);

      await Job.findOneAndUpdate(
        { jobId: raw.jobId },
        {
          ...raw,
          matchScore:    score,
          matchedSkills,
          visaSponsored: hasVisa,
          status: isBlacklisted || score < minScore ? "skipped" : "matched",
        },
        { upsert: true, new: true }
      );

      if (isBlacklisted) { totalSkipped++; continue; }
      if (score < minScore) { totalSkipped++; continue; }

      candidateJobs.push({ ...raw, matchScore: score, matchedSkills, visaSponsored: hasVisa });
    }

    candidateJobs.sort((a, b) => b.matchScore - a.matchScore);
    totalMatched = candidateJobs.length;
    currentRun.stats.matched = totalMatched;
    currentRun.matchedJobs   = candidateJobs; // ← store ALL matched for email
    if (io) io.emit("run:stats", currentRun.stats);

    logFn("ok", `${totalMatched} jobs passed matching (score ≥ ${minScore}%)`);
    logFn("ok", `${totalSkipped} duplicates/low-match skipped`);

    // ── Step 3: Mark top matches ────────────────────────────────────────────
    const toApply = candidateJobs.slice(0, maxPerDay);
    logFn("info", `Marking top ${toApply.length} jobs (cap: ${maxPerDay}/day)`);

    for (const job of toApply) {
      const ok = await applyToJob(job, logFn);
      if (ok) { totalApplied++; currentRun.appliedJobs.push(job); }
      else     { totalFailed++; }
      currentRun.stats.applied = totalApplied;
      currentRun.stats.failed  = totalFailed;
      if (io) io.emit("run:stats", currentRun.stats);
      await new Promise(r => setTimeout(r, 300));
    }

    // ── Step 4: Save run log ────────────────────────────────────────────────
    const duration = (Date.now() - startTime) / 1000;
    const runLog = await RunLog.create({
      runAt: runDate, totalFound, totalMatched,
      totalApplied, totalSkipped, totalFailed, duration, logs,
      countries: profile.targetCountries.map(c => c.country),
    });

    logFn("ok", `Run complete — ${totalApplied} marked, ${totalSkipped} skipped, ${totalFailed} failed`);
    logFn("info", `Duration: ${Math.round(duration)}s`);

    // ── Step 5: Send email with ALL matched jobs (not just auto-applied) ────
    logFn("info", "Sending daily summary email...");
    const emailSent = await sendDailySummary({
      appliedJobs: currentRun.matchedJobs,   // ← ALL matched, not just auto-applied
      skipped:     totalSkipped,
      failed:      totalFailed,
      duration,
      runDate,
      totalFound,
    });
    await RunLog.findByIdAndUpdate(runLog._id, { emailSent });
    if (emailSent) logFn("ok", "Email summary sent ✓");

    // ── Step 6: Telegram alerts for top 5 high-match jobs ──────────────────
    const topJobs = candidateJobs.slice(0, 5);
    if (topJobs.length > 0) {
      await sendTelegramAlert(topJobs, runDate);
      if (topJobs.length) logFn("ok", `Telegram: alerted ${topJobs.length} top matches`);
    }

    logFn("info", "═══ AutoApply run finished ═══");

  } catch (err) {
    logFn("warn", `Run error: ${err.message}`);
    console.error(err);
  }

  currentRun.running = false;
  if (io) io.emit("run:end", { stats: currentRun.stats });
  return currentRun;
}

module.exports = { runDailyApply, getRunState };
