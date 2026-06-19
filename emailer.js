// emailer.js — Sends daily summary email via Gmail

const nodemailer = require("nodemailer");

async function sendDailySummary({ appliedJobs, skipped, failed, duration, runDate }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[Email] No credentials set — skipping email.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (not your real password)
    },
  });

  const jobRows = appliedJobs.map(j => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${j.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${j.company}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${j.country}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
        <span style="background:${j.matchScore>=90?"#d4edda":"#fff3cd"};color:${j.matchScore>=90?"#155724":"#856404"};
        padding:2px 8px;border-radius:12px;font-size:12px">${j.matchScore}%</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">
        <a href="${j.applyUrl}" style="color:#185FA5;text-decoration:none">View</a>
      </td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#333">
  <div style="background:#185FA5;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">🤖 AutoApply — Daily Report</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${runDate.toDateString()}</p>
  </div>

  <div style="background:#f8f9fa;padding:20px 24px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
    <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:28px;font-weight:bold;color:#185FA5">${appliedJobs.length}</div>
      <div style="font-size:12px;color:#666;margin-top:2px">Applied</div>
    </div>
    <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:28px;font-weight:bold;color:#3B6D11">${appliedJobs.filter(j=>j.matchScore>=90).length}</div>
      <div style="font-size:12px;color:#666;margin-top:2px">High match</div>
    </div>
    <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:28px;font-weight:bold;color:#854F0B">${skipped}</div>
      <div style="font-size:12px;color:#666;margin-top:2px">Skipped</div>
    </div>
    <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:28px;font-weight:bold;color:#666">${Math.round(duration)}s</div>
      <div style="font-size:12px;color:#666;margin-top:2px">Duration</div>
    </div>
  </div>

  <div style="padding:20px 24px">
    <h2 style="font-size:16px;margin:0 0 12px">Jobs applied today</h2>
    ${appliedJobs.length === 0
      ? '<p style="color:#666;font-size:14px">No jobs applied today. Check your profile settings.</p>'
      : `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f3f5">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Title</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Company</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Country</th>
              <th style="padding:8px 12px;text-align:center;font-weight:600">Match</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Link</th>
            </tr>
          </thead>
          <tbody>${jobRows}</tbody>
        </table>`
    }
    ${failed > 0 ? `<p style="color:#dc3545;font-size:13px;margin-top:12px">⚠️ ${failed} applications failed — check logs.</p>` : ""}
  </div>

  <div style="background:#f8f9fa;padding:14px 24px;font-size:12px;color:#888;border-top:1px solid #eee">
    AutoApply • Running locally on your machine •
    <a href="http://localhost:${process.env.PORT||3500}" style="color:#185FA5">Open dashboard</a>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"AutoApply 🤖" <${process.env.EMAIL_USER}>`,
      to:      process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `✅ AutoApply: ${appliedJobs.length} jobs applied — ${runDate.toDateString()}`,
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
