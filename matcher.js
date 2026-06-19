// matcher.js — Scores a job description against your profile

const profile = require("./profile");

/**
 * Score a job against your skills and keywords.
 * Returns { score: 0-100, matchedSkills: [], hasVisa: bool, isBlacklisted: bool }
 */
function scoreJob(job) {
  const text = `${job.title} ${job.description} ${job.company}`.toLowerCase();

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

  // ── Skills scoring ───────────────────────────────────────────────────────
  let totalWeight = 0;
  let earnedWeight = 0;
  const matchedSkills = [];

  for (const skill of profile.skills) {
    totalWeight += skill.weight;
    if (text.includes(skill.name.toLowerCase())) {
      earnedWeight += skill.weight;
      matchedSkills.push(skill.name);
    }
  }

  // ── Title relevance bonus (0–20 extra points) ────────────────────────────
  let titleBonus = 0;
  const jobTitle = job.title.toLowerCase();
  for (const t of profile.jobTitles) {
    if (jobTitle.includes(t.toLowerCase().split(" ")[0])) {
      titleBonus = 20;
      break;
    }
  }

  // ── Visa bonus (10 points) ───────────────────────────────────────────────
  const visaBonus = hasVisa ? 10 : 0;

  // ── Compute final score (0–100) ───────────────────────────────────────────
  const skillScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 70 : 0;
  const rawScore   = skillScore + titleBonus + visaBonus;
  const score      = Math.min(100, Math.round(rawScore));

  return { score, matchedSkills, hasVisa, isBlacklisted: false };
}

module.exports = { scoreJob };
