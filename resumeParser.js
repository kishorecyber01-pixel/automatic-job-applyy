// resumeParser.js — Extracts text from an uploaded resume PDF and detects
// relevant skills against a known dictionary. Designed for IT/security roles
// (matches profile.js's domain) but the dictionary can be extended freely.

const pdfParse = require("pdf-parse");

// Master dictionary: skill name -> weight (1-10, mirrors profile.js scale).
// Only skills found in the resume text get returned — this is a lookup table,
// not an output list.
const SKILL_DICTIONARY = [
  { name: "CEH", weight: 10 },
  { name: "CISSP", weight: 10 },
  { name: "CompTIA Security+", weight: 9 },
  { name: "Active Directory", weight: 9 },
  { name: "SIEM", weight: 9 },
  { name: "SOC", weight: 9 },
  { name: "Splunk", weight: 8 },
  { name: "QRadar", weight: 8 },
  { name: "Network Security", weight: 8 },
  { name: "Incident Response", weight: 8 },
  { name: "Penetration Testing", weight: 8 },
  { name: "Wireshark", weight: 7 },
  { name: "Firewall", weight: 7 },
  { name: "Python", weight: 7 },
  { name: "Nmap", weight: 7 },
  { name: "Metasploit", weight: 7 },
  { name: "Threat Hunting", weight: 7 },
  { name: "Vulnerability Assessment", weight: 7 },
  { name: "Linux", weight: 6 },
  { name: "Windows Server", weight: 6 },
  { name: "AWS", weight: 6 },
  { name: "Azure", weight: 6 },
  { name: "Backup Monitoring", weight: 5 },
  { name: "IT Support", weight: 5 },
  { name: "Service Desk", weight: 5 },
  { name: "TCP/IP", weight: 5 },
  { name: "DNS", weight: 5 },
  { name: "ITIL", weight: 4 },
  { name: "VPN", weight: 4 },
  { name: "SQL", weight: 4 },
];

/**
 * Parse a resume PDF buffer and return extracted text + matched skills.
 * @param {Buffer} fileBuffer - raw PDF file contents
 * @returns {Promise<{ text: string, skills: Array<{name, weight}> }>}
 */
async function parseResume(fileBuffer) {
  const data = await pdfParse(fileBuffer);
  const text = data.text || "";
  const lowerText = text.toLowerCase();

  const skills = SKILL_DICTIONARY.filter(skill =>
    lowerText.includes(skill.name.toLowerCase())
  );

  return { text, skills };
}

module.exports = { parseResume, SKILL_DICTIONARY };
