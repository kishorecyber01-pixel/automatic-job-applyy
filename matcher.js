// matcher.js — Scores a job description against your profile
// Scoring logic: rewards skill matches proportionally, doesn't penalise
// for skills the job doesn't mention (realistic — no job lists every tool).

const profile = require("./profile");

/**
 * Score a job against your skills and keywords.
 * Returns { score: 0-100, matchedSkills: [], hasVisa: bool, isBlacklisted: bool }
 *
 * Score breakdown (max 100):
 *   - Title match:      30 pts  (job title contains one of your target titles)
 *   - Skill matches:    60 pts  (proportional — each matched skill earns points
 *                                based on its weight vs the top possible weight)
 *   - Visa sponsorship: 10 pts  (job mentions visa/sponsorship keywords)
 */
function scoreJob(job) {
  const text = `${job.title} ${job.description} ${job.company}`.toLowerCase();
  const jobTitle = job.title.toLowerCase();

  // ── Blacklist check ──────────────────────────────────────────────────────
  for (const kw of profile.blacklistKeywords) {
    if (text.includes(kw.toLowerCase())) {
      return { score: 0, matchedSkills: [], hasVisa: false, isBlacklisted: true };
    }
  }

  // ── Visa sponsorship check ───────────────────────────────────────────────
  let hasVisa = false;
  for (const kw of profile.visaKeywords) {
    if (text.includes(kw.toLowerCase())) {
      hasVisa = true;
      break;
    }
  }

  // ── Title relevance (0 or 30 pts) ────────────────────────────────────────
  // Full 30 pts if any target job title word appears in the job title.
  // Partial 15 pts if only found in description (not title).
  let titleScore = 0;
  for (const t of profile.jobTitles) {
    const words = t.toLowerCase().split(" ");
    const inTitle = words.some(w => w.length > 3 && jobTitle.includes(w));
    const inDesc  = words.some(w => w.length > 3 && text.includes(w));
    if (inTitle) { titleScore = 30; break; }
    if (inDesc  && titleScore < 15) titleScore = 15;
  }

  // ── Skills scoring (0–60 pts) ─────────────────────────────────────────────
  // Strategy: find matched skills, score them against the TOP-N possible skills
  // rather than ALL skills. This means matching 4 out of your top skills scores
  // well, instead of needing to match all 21 to get a decent score.
  const matchedSkills = [];
  const matchedWeights = [];

  for (const skill of profile.skills) {
    // Check full skill name and common abbreviations
    const skillLower = skill.name.toLowerCase();
    if (text.includes(skillLower)) {
      matchedSkills.push(skill.name);
      matchedWeights.push(skill.weight);
    }
  }

  // Score against top-8 possible skill weights (realistic bar for a job listing)
  const sortedWeights = [...profile.skills.map(s => s.weight)].sort((a,b) => b-a);
  const topN = 8;
  const maxPossible = sortedWeights.slice(0, topN).reduce((a,b) => a+b, 0);
  const earned      = matchedWeights.reduce((a,b) => a+b, 0);
  const skillScore  = maxPossible > 0
    ? Math.min(60, Math.round((earned / maxPossible) * 60))
    : 0;

  // ── Visa bonus (10 pts) ───────────────────────────────────────────────────
  const visaBonus = hasVisa ? 10 : 0;

  // ── Final score ───────────────────────────────────────────────────────────
  const score = Math.min(100, titleScore + skillScore + visaBonus);

  return { score, matchedSkills, hasVisa, isBlacklisted: false };
}

module.exports = { scoreJob };
