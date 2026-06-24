// telegram.js — Sends instant job alerts to your Telegram phone app
// Setup (free, takes 3 minutes):
//   1. Open Telegram → search @BotFather → /newbot → copy the token
//   2. Search your new bot → send it any message
//   3. Open https://api.telegram.org/bot<TOKEN>/getUpdates → copy "chat"."id"
//   4. Add to Render env: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

const axios = require("axios");

async function sendTelegramAlert(jobs, runDate) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("[Telegram] Not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in env.");
    return false;
  }

  if (!jobs || jobs.length === 0) return false;

  // Send a summary header message first
  const header = [
    `🤖 *AutoApply Daily Report* — ${runDate.toDateString()}`,
    `✅ *${jobs.length} job${jobs.length !== 1 ? "s" : ""} matched* your profile today`,
    ``,
    `Top matches 👇`,
  ].join("\n");

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text:       header,
      parse_mode: "Markdown",
    });

    // Send each job as a separate message with an inline Apply button
    for (const job of jobs.slice(0, 10)) { // max 10 alerts per run
      const scoreEmoji = job.matchScore >= 80 ? "⭐" : job.matchScore >= 60 ? "🎯" : "📌";
      const skills = job.matchedSkills?.slice(0, 4).join(" • ") || "General match";

      const text = [
        `${scoreEmoji} *${job.title}*`,
        `🏢 ${job.company}`,
        `🌍 ${job.country || job.location || "Remote"}`,
        `📊 Match: *${job.matchScore}%*`,
        `🔧 ${skills}`,
        `📋 Source: ${job.source || "job board"}`,
      ].join("\n");

      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id:    chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "Apply Now →", url: job.applyUrl },
          ]],
        },
      });

      // Small delay between messages to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    if (jobs.length > 10) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id:    chatId,
        text:       `📧 +${jobs.length - 10} more jobs in your email digest. Check your inbox!`,
        parse_mode: "Markdown",
      });
    }

    console.log(`[Telegram] Sent ${Math.min(jobs.length, 10)} job alerts`);
    return true;
  } catch (e) {
    console.error("[Telegram] Failed:", e.message);
    return false;
  }
}

module.exports = { sendTelegramAlert };
