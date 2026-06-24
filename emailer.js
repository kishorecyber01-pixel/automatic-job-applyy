// emailer.js — Sends daily summary email with ALL matched jobs to click & apply

const nodemailer = require("nodemailer");

async function sendDailySummary({ appliedJobs, skipped, failed, duration, runDate, totalFound }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[Email] No credentials set — skipping email.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const high   = appliedJobs.filter(j => j.matchScore >= 80);
  const medium = appliedJobs.filter(j => j.matchScore >= 60 && j.matchScore < 80);
  const lower  = appliedJobs.filter(j => j.matchScore < 60);

  function jobRows(jobs) {
    if (!jobs.length) return `<tr><td colspan="6" style="padding:12px;color:#888;text-align:center">None in this range</td></tr>`;
    return jobs.map(j => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a">
          <strong style="color:#e0e0f0">${j.title}</strong>
          <div style="font-size:11px;color:#888;margin-top:2px">${j.matchedSkills?.slice(0,4).join(", ") || ""}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a;color:#ccc">${j.company}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a;color:#ccc">${j.country || j.location || "Remote"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a;text-align:center">
          <span style="background:${j.matchScore>=80?"#1a3a2a":"#2a2a1a"};color:${j.matchScore>=80?"#4caf50":"#ffc107"};
            padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${j.matchScore}%</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a;font-size:11px;color:#888">${j.source || ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a3a;text-align:center">
          <a href="${j.applyUrl}" style="background:#185FA5;color:#fff;padding:5px 14px;border-radius:6px;
            text-decoration:none;font-size:12px;font-weight:600">Apply →</a>
        </td>
      </tr>`).join("");
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0d0d1a;color:#e0e0f0;margin:0;padding:0">
<div style="max-width:750px;margin:0 auto;padding:20px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#185FA5,#1a3a6a);padding:24px 28px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px;color:#fff">🤖 AutoApply — Daily Job Report</h1>
    <p style="margin:6px 0 0;opacity:0.75;font-size:13px">${runDate.toDateString()} • ${Math.round(duration)}s run time</p>
  </div>

  <!-- Stats bar -->
  <div style="background:#13132a;padding:16px 28px;display:flex;gap:0;border-bottom:1px solid #2a2a3a">
    ${[
      ["📋", totalFound || 0,         "Scraped",  "#888"],
      ["✅", appliedJobs.length,       "Matched",  "#4caf50"],
      ["⭐", high.length,              "High (80%+)","#ffc107"],
      ["⏭️", skipped,                 "Skipped",  "#888"],
    ].map(([icon, val, label, color]) => `
      <div style="flex:1;text-align:center;padding:8px">
        <div style="font-size:26px;font-weight:800;color:${color}">${val}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${icon} ${label}</div>
      </div>`).join("")}
  </div>

  ${appliedJobs.length === 0 ? `
  <div style="background:#13132a;padding:32px;text-align:center;border-radius:0 0 12px 12px">
    <div style="font-size:40px;margin-bottom:12px">🔍</div>
    <div style="color:#888;font-size:14px">No jobs matched today. The system scraped ${totalFound || 0} listings.<br>
    Try lowering MIN_MATCH_SCORE in Render environment variables.</div>
  </div>` : `

  <!-- High match jobs -->
  <div style="background:#13132a;padding:20px 28px;margin-top:2px">
    <h2 style="color:#4caf50;font-size:15px;margin:0 0 12px">⭐ High Match (80%+) — Apply to these first</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#1a1a2e">
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Role</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Company</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Location</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Score</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Source</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Action</th>
      </tr></thead>
      <tbody>${jobRows(high)}</tbody>
    </table>
  </div>

  <!-- Medium match jobs -->
  <div style="background:#13132a;padding:20px 28px;margin-top:2px">
    <h2 style="color:#ffc107;font-size:15px;margin:0 0 12px">🎯 Good Match (60–79%)</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#1a1a2e">
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Role</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Company</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Location</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Score</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Source</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Action</th>
      </tr></thead>
      <tbody>${jobRows(medium)}</tbody>
    </table>
  </div>

  <!-- Lower match -->
  ${lower.length > 0 ? `
  <div style="background:#13132a;padding:20px 28px;margin-top:2px">
    <h2 style="color:#888;font-size:15px;margin:0 0 12px">📌 Other Matches (below 60%)</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#1a1a2e">
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Role</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Company</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Location</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Score</th>
        <th style="padding:8px 10px;text-align:left;color:#888;font-weight:600">Source</th>
        <th style="padding:8px 10px;text-align:center;color:#888;font-weight:600">Action</th>
      </tr></thead>
      <tbody>${jobRows(lower)}</tbody>
    </table>
  </div>` : ""}
  `}

  <!-- Footer -->
  <div style="background:#0d0d1a;padding:16px 28px;font-size:11px;color:#444;border-top:1px solid #1a1a2e;border-radius:0 0 12px 12px">
    AutoApply • <a href="http://automatic-job-applyy.onrender.com" style="color:#185FA5">Open dashboard</a> •
    Running on Render • Jobs scraped from LinkedIn, Remotive, Arbeitnow, Naukri & more
  </div>

</div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"AutoApply 🤖" <${process.env.EMAIL_USER}>`,
      to:      process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `🎯 AutoApply: ${appliedJobs.length} jobs matched — ${runDate.toDateString()}`,
      html,
    });
    console.log("[Email] Daily summary sent.");
    return true;
  } catch (e) {
    console.error("[Email] Failed to send:", e.message);
    return false;
  }
}

module.exports = { sendDailySummary };
