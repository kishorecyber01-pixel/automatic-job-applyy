// server.js — AutoApply local server (VS Code terminal)

require("dotenv").config();
const express   = require("express");
const http      = require("http");
const path      = require("path");
const cors      = require("cors");
const cron      = require("node-cron");
const mongoose  = require("mongoose");
const { Server } = require("socket.io");

const { runDailyApply, getRunState } = require("./runner");
const { Job, RunLog, Profile }        = require("./models/Job");
const profile = require("./profile");
const multer  = require("multer");
const { parseResume } = require("./resumeParser");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are accepted"));
    }
    cb(null, true);
  },
});

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });
const PORT   = process.env.PORT || 3500;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Dashboard auth ─────────────────────────────────────────────────────────
// Protects state-changing/sensitive routes once DASHBOARD_SECRET is set.
// If DASHBOARD_SECRET is unset or still the project default, auth is skipped
// with a loud warning — fine for purely local use, NOT fine once deployed.
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET;
const INSECURE_DEFAULT = "kishore_autoapply_2024";

if (!DASHBOARD_SECRET || DASHBOARD_SECRET === INSECURE_DEFAULT) {
  console.warn("⚠️  DASHBOARD_SECRET is missing or using the insecure default.");
  console.warn("   Set a strong random value in .env before deploying publicly.");
}

function requireAuth(req, res, next) {
  if (!DASHBOARD_SECRET || DASHBOARD_SECRET === INSECURE_DEFAULT) {
    // Local-only safety net: refuse to run unauthenticated once NODE_ENV=production
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ ok: false, message: "Server misconfigured: set DASHBOARD_SECRET" });
    }
    return next(); // allow during local dev so npm run dev still works out of the box
  }
  const provided = req.headers["x-dashboard-secret"] || req.query.secret;
  if (provided !== DASHBOARD_SECRET) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

// ── MongoDB ────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/autoapply")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(e => {
    console.warn("⚠️  MongoDB not available — running without persistence.");
    console.warn("   Install MongoDB or use MongoDB Atlas (free tier).");
  });

// ── Cron scheduler ────────────────────────────────────────────────────────────
const cronSchedule = process.env.CRON_SCHEDULE || "0 6 * * *";
console.log(`🕐 Daily run scheduled: ${cronSchedule}`);

cron.schedule(cronSchedule, async () => {
  console.log("\n🤖 Starting scheduled daily run...\n");
  await runDailyApply(io);
}, {
  timezone: "Asia/Kolkata", // IST — change if needed
});

// ── API Routes ─────────────────────────────────────────────────────────────────

// Dashboard stats
app.get("/api/stats", async (req, res) => {
  try {
    const [totalJobs, appliedJobs, highMatch, latestRun] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: "applied" }),
      Job.countDocuments({ status: "applied", matchScore: { $gte: 90 } }),
      RunLog.findOne().sort({ runAt: -1 }),
    ]);
    res.json({ totalJobs, appliedJobs, highMatch, latestRun, countries: profile.targetCountries.length });
  } catch {
    res.json({ totalJobs: 0, appliedJobs: 0, highMatch: 0, latestRun: null, countries: profile.targetCountries.length });
  }
});

// All jobs with filter
app.get("/api/jobs", async (req, res) => {
  try {
    const { status, minScore, country, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status)   query.status    = status;
    if (minScore) query.matchScore = { $gte: parseInt(minScore) };
    if (country)  query.country   = { $regex: country, $options: "i" };

    const jobs = await Job.find(query)
      .sort({ matchScore: -1, foundAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Job.countDocuments(query);
    res.json({ jobs, total, page: parseInt(page) });
  } catch (e) {
    res.json({ jobs: [], total: 0 });
  }
});

// Run history
app.get("/api/runs", async (req, res) => {
  try {
    const runs = await RunLog.find().sort({ runAt: -1 }).limit(14);
    res.json(runs);
  } catch {
    res.json([]);
  }
});

// Manually trigger a run (dashboard button)
app.post("/api/run", requireAuth, async (req, res) => {
  const state = getRunState();
  if (state && state.running) {
    return res.json({ ok: false, message: "Run already in progress" });
  }
  res.json({ ok: true, message: "Run started" });
  // Run async — live updates via Socket.io
  runDailyApply(io).catch(console.error);
});

// Get profile (for dashboard display) — merges resume-derived skills if present
app.get("/api/profile", async (req, res) => {
  let extraSkills = [];
  let resumeFileName = null;
  try {
    const stored = await Profile.findOne().sort({ uploadedAt: -1 });
    if (stored) {
      extraSkills = stored.extractedSkills || [];
      resumeFileName = stored.resumeFileName;
    }
  } catch {}

  // Merge: base skills from profile.js + any new ones found in the resume
  // (dedupe by name, base file wins on conflicting weight)
  const baseNames = new Set(profile.skills.map(s => s.name.toLowerCase()));
  const merged = [...profile.skills, ...extraSkills.filter(s => !baseNames.has(s.name.toLowerCase()))];

  res.json({
    jobTitles:       profile.jobTitles,
    skills:          merged,
    targetCountries: profile.targetCountries,
    scoring:         profile.scoring,
    resumeFileName,
  });
});

// Upload + parse resume PDF -> extract skills -> persist to DB
app.post("/api/profile/resume", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });

    const { text, skills } = await parseResume(req.file.buffer);

    await Profile.create({
      resumeFileName: req.file.originalname,
      resumeText: text.slice(0, 20000), // cap stored text, resumes can be long
      extractedSkills: skills,
    });

    res.json({ ok: true, fileName: req.file.originalname, skillsFound: skills });
  } catch (e) {
    console.error("[Resume upload]", e.message);
    res.status(500).json({ ok: false, message: e.message || "Failed to parse resume" });
  }
});

// Update scoring threshold live
app.post("/api/profile/threshold", requireAuth, (req, res) => {
  const { minScore } = req.body;
  if (minScore >= 0 && minScore <= 100) {
    profile.scoring.minScoreToApply = parseInt(minScore);
    res.json({ ok: true, minScore: profile.scoring.minScoreToApply });
  } else {
    res.json({ ok: false, message: "Invalid score" });
  }
});

// Manually mark a job as applied — used by the dashboard's "Open & mark applied"
// button. This does NOT submit anything on the user's behalf; it just records
// that the user applied themselves after opening the listing.
app.post("/api/jobs/:jobId/mark-applied", requireAuth, async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { jobId: req.params.jobId },
      { status: "applied", appliedAt: new Date(), notes: "Marked applied by user" },
      { new: true }
    );
    if (!job) return res.status(404).json({ ok: false, message: "Job not found" });
    res.json({ ok: true, job });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("[Socket] Dashboard connected");
  // Send current run state if one is active
  const state = getRunState();
  if (state) {
    socket.emit("run:state", state);
  }
});

// ── Serve dashboard ─────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║  🤖 AutoApply running on port ${PORT}       ║`);
  console.log(`║  Dashboard → http://localhost:${PORT}       ║`);
  console.log(`║  Daily run → ${cronSchedule} IST          ║`);
  console.log("╚══════════════════════════════════════════╝\n");

  // Auto-open browser
  try {
    const { exec } = require("child_process");
    exec(`start http://localhost:${PORT}`); // Windows
  } catch {}
});
