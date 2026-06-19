# 🤖 AutoApply — Daily Automated Job Application System

Runs locally on your machine in VS Code. Every day at 06:00 AM IST,
it scrapes job boards worldwide, scores jobs against your skills,
filters for visa sponsorship, and applies automatically.

---

## ⚡ Quick Setup (5 minutes)

### 1. Install dependencies
```bash
cd autoapply
npm install
```

### 2. Install MongoDB (local) — OR use Atlas (free cloud)

**Option A — Local MongoDB (Windows):**
Download from: https://www.mongodb.com/try/download/community
Run installer → it starts automatically as a service.

**Option B — MongoDB Atlas (free, no install):**
1. Go to https://cloud.mongodb.com → create free account
2. Create free cluster → Get connection string
3. Paste it as MONGO_URI in .env

### 3. Edit the .env file
```
MONGO_URI=mongodb://localhost:27017/autoapply
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password          ← Gmail App Password (see below)
EMAIL_TO=your_gmail@gmail.com
MAX_APPLY_PER_DAY=20
MIN_MATCH_SCORE=70
PORT=3500
```

**Gmail App Password (for email reports):**
1. Go to Google Account → Security → 2-Step Verification (enable it)
2. Then → App passwords → Generate
3. Use that 16-digit password as EMAIL_PASS (NOT your real Gmail password)

### 4. Edit your profile (profile.js)
Open `profile.js` and update:
- `personal.name`, `personal.email`, `personal.phone`
- `personal.linkedin` — your LinkedIn URL
- `personal.resume` — path to your resume PDF (put it in the data/ folder)
- Add/remove skills as needed
- Add/remove job titles

### 5. Start the server
```bash
npm run dev      # development mode (auto-restarts on file changes)
# OR
npm start        # production mode
```

Open your browser → **http://localhost:3500**

---

## 📋 How it works

```
Every day at 06:00 AM IST:

1. Scrape  →  Pulls jobs from Indeed RSS, Remotive, Arbeitnow, Adzuna
2. Score   →  Matches your skills against job descriptions (0–100%)
3. Filter  →  Keeps only visa-sponsored jobs above your threshold
4. Dedup   →  Skips jobs you already applied to
5. Apply   →  Marks applications, records to MongoDB
6. Email   →  Sends you a summary report
```

---

## 🔧 Optional: Adzuna API (250 free calls/month)

1. Sign up at: https://developer.adzuna.com/
2. Get App ID and App Key
3. Add to .env:
```
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```
This gives you more jobs from UK, US, Canada, Australia.

---

## ⏰ Change the run schedule

Edit `CRON_SCHEDULE` in .env:
```
0 6 * * *      → Every day at 6:00 AM  (default)
0 8 * * *      → Every day at 8:00 AM
0 6 * * 1-5   → Weekdays only at 6:00 AM
0 6,18 * * *   → Twice a day (6 AM and 6 PM)
```

---

## 🖥️ Dashboard pages

| Page            | What you'll find                                          |
|-----------------|-----------------------------------------------------------|
| Dashboard       | Stats, live log, run history                              |
| Job matches     | All scored jobs, filterable by status/score/visa          |
| Schedule & logs | Step-by-step run status, toggle settings                  |
| Skills & profile| Your skill weights, job titles, match threshold slider    |
| Countries       | All target countries and visa types                       |

---

## 📁 Project structure

```
autoapply/
├── server.js        ← Express server + cron scheduler
├── runner.js        ← Core daily run engine
├── scraper.js       ← Job scraping (Indeed, Remotive, Arbeitnow, Adzuna)
├── matcher.js       ← Skill matching algorithm
├── emailer.js       ← Daily summary email
├── profile.js       ← YOUR skills, job titles, countries (edit this!)
├── models/
│   └── Job.js       ← MongoDB schemas
├── public/
│   └── index.html   ← Dashboard UI
├── data/
│   └── resume.pdf   ← Put your resume here
├── .env             ← API keys and config
└── package.json
```

---

## 🔐 Security

- The dashboard runs only on localhost:3500 — only you can see it
- Never expose this server to the internet (no port forwarding)
- .env is in .gitignore — your credentials are safe

---

## 💡 Tips

- Start with MIN_MATCH_SCORE=60 to get more jobs, increase to 75+ once tuned
- Add your CEH, B.Sc., Active Directory experience to profile.js for better matching
- The Arbeitnow scraper gives EU visa-sponsored jobs with no API key needed
- Click "Run now" on the dashboard anytime to test without waiting for 6 AM
