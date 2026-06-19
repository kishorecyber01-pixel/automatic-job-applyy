// ─── YOUR PROFILE ───────────────────────────────────────────────────────────
// Edit this file to update your skills, keywords, and target countries.
// The matcher scores every job against this profile.

module.exports = {

  // ── Personal details (used in auto-fill forms) ──────────────────────────
  personal: {
    name:     "Kishore K",
    email:    process.env.YOUR_EMAIL    || "kishorecyber01@gmail.com",
    phone:    process.env.YOUR_PHONE    || "+91-XXXXXXXXXX",
    linkedin: process.env.YOUR_LINKEDIN || "https://linkedin.com/in/yourprofile",
    github:   "",
    location: "Chennai, India",
    notice:   "Immediate / 30 days",
    resume:   "./data/resume.pdf",   // path to your PDF resume
  },

  // ── Job titles to search for ─────────────────────────────────────────────
  jobTitles: [
    "SOC Analyst",
    "Cybersecurity Analyst",
    "Information Security Analyst",
    "IT Security Analyst",
    "Network Security Analyst",
    "Service Desk Analyst",
    "IT Support Analyst",
    "IT Helpdesk",
    "IT Trainee",
    "Junior Security Engineer",
  ],

  // ── Skills (each matched against job description) ────────────────────────
  // Higher-weight skills score more points when matched
  skills: [
    { name: "CEH",              weight: 10 },
    { name: "Active Directory", weight: 9  },
    { name: "SIEM",             weight: 9  },
    { name: "SOC",              weight: 9  },
    { name: "Network Security", weight: 8  },
    { name: "Incident Response",weight: 8  },
    { name: "Wireshark",        weight: 7  },
    { name: "Firewall",         weight: 7  },
    { name: "Python",           weight: 7  },
    { name: "Linux",            weight: 6  },
    { name: "Windows Server",   weight: 6  },
    { name: "Backup Monitoring",weight: 5  },
    { name: "IT Support",       weight: 5  },
    { name: "Service Desk",     weight: 5  },
    { name: "Threat Hunting",   weight: 7  },
    { name: "Vulnerability Assessment", weight: 7 },
    { name: "ITIL",             weight: 4  },
    { name: "VPN",              weight: 4  },
    { name: "TCP/IP",           weight: 5  },
  ],

  // ── Keywords that MUST appear for visa sponsorship ────────────────────────
  visaKeywords: [
    "visa sponsorship",
    "sponsor visa",
    "work permit",
    "will sponsor",
    "open to sponsorship",
    "h-1b",
    "tier 2",
    "skilled worker visa",
    "employment pass",
    "work authorization",
    "relocation assistance",
    "international candidates",
    "candidates from abroad",
  ],

  // ── Keywords that disqualify a job (skip it) ─────────────────────────────
  blacklistKeywords: [
    "US citizen only",
    "security clearance required",
    "must be authorized",
    "no sponsorship",
    "no visa",
    "citizens only",
    "permanent resident only",
    "local candidates only",
  ],

  // ── Target countries and their job boards ────────────────────────────────
  targetCountries: [
    { country: "India",          code: "in", currency: "INR", visaType: "Local / No visa needed"        },
    { country: "United Kingdom", code: "gb", currency: "GBP", visaType: "Skilled Worker Visa (Tier 2)" },
    { country: "Malaysia",       code: "my", currency: "MYR", visaType: "Employment Pass"              },
    { country: "Singapore",      code: "sg", currency: "SGD", visaType: "Employment Pass / S Pass"     },
    { country: "Canada",         code: "ca", currency: "CAD", visaType: "LMIA / Express Entry"         },
    { country: "Ireland",        code: "ie", currency: "EUR", visaType: "Critical Skills Work Permit"  },
    { country: "Germany",        code: "de", currency: "EUR", visaType: "EU Blue Card"                 },
    { country: "Australia",      code: "au", currency: "AUD", visaType: "TSS 482 Visa"                 },
    { country: "Netherlands",    code: "nl", currency: "EUR", visaType: "Highly Skilled Migrant"       },
    { country: "Sweden",         code: "se", currency: "SEK", visaType: "Work Permit"                  },
    { country: "United States",  code: "us", currency: "USD", visaType: "H-1B / OPT"                  },
  ],

  // ── Scoring thresholds ────────────────────────────────────────────────────
  scoring: {
    minScoreToApply:  70,   // don't apply below this score
    highMatchScore:   90,   // shown as "high match" in dashboard
    maxApplyPerDay:   20,   // safety cap
  },
};
