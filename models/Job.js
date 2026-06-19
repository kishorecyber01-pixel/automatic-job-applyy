// models/Job.js — Mongoose schemas for jobs and run logs

const mongoose = require("mongoose");

// ── Job schema ───────────────────────────────────────────────────────────────
const jobSchema = new mongoose.Schema({
  jobId:       { type: String, unique: true },  // dedupe key (source+id hash)
  title:       String,
  company:     String,
  location:    String,
  country:     String,
  countryCode: String,
  salary:      String,
  workType:    String,   // Remote / Hybrid / On-site
  description: String,
  applyUrl:    String,
  source:      String,   // "indeed" | "linkedin" | "adzuna" | "remotive"
  visaSponsored: { type: Boolean, default: false },
  matchScore:  { type: Number, default: 0 },
  matchedSkills: [String],
  status: {
    type: String,
    enum: ["found", "matched", "applied", "skipped", "failed"],
    default: "found",
  },
  appliedAt:   Date,
  foundAt:     { type: Date, default: Date.now },
  notes:       String,
});

// ── Daily run log schema ─────────────────────────────────────────────────────
const runLogSchema = new mongoose.Schema({
  runAt:        { type: Date, default: Date.now },
  totalFound:   { type: Number, default: 0 },
  totalMatched: { type: Number, default: 0 },
  totalApplied: { type: Number, default: 0 },
  totalSkipped: { type: Number, default: 0 },
  totalFailed:  { type: Number, default: 0 },
  countries:    [String],
  duration:     Number,  // seconds
  logs:         [{ time: Date, level: String, message: String }],
  emailSent:    { type: Boolean, default: false },
});

const Job    = mongoose.model("Job",    jobSchema);
const RunLog = mongoose.model("RunLog", runLogSchema);

// ── Profile schema (resume-derived overrides, persisted in DB) ───────────────
const profileSchema = new mongoose.Schema({
  resumeFileName:   String,
  resumeText:       String,            // extracted text, for reference/search
  extractedSkills:  [{ name: String, weight: Number }],
  uploadedAt:        { type: Date, default: Date.now },
});

const Profile = mongoose.model("Profile", profileSchema);

module.exports = { Job, RunLog, Profile };
