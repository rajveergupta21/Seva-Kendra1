/**
 * JanKalyan Voice Gateway - Deterministic Eligibility Rules Engine
 * 100% Hallucination-Free Rule Matching Core
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load verified schemes dataset
const schemesPath = path.join(__dirname, '..', 'schemes_data.json');
let SCHEMES_CACHE = [];

try {
  const raw = fs.readFileSync(schemesPath, 'utf8');
  SCHEMES_CACHE = JSON.parse(raw);
} catch (e) {
  console.error("Failed to load schemes_data.json", e);
}

/**
 * Evaluates whether a user profile matches a single scheme's deterministic conditions.
 */
export function evaluateSchemeConditions(scheme, profile) {
  const conds = scheme.conditions || {};

  // 1. Gender check
  if (conds.gender && conds.gender.length > 0) {
    if (!profile.gender || !conds.gender.includes(profile.gender.toLowerCase())) {
      return false;
    }
  }

  // 2. Marital Status check
  if (conds.marital_status && conds.marital_status.length > 0) {
    if (!profile.marital_status || !conds.marital_status.includes(profile.marital_status.toLowerCase())) {
      return false;
    }
  }

  // 3. Min Age check
  if (typeof conds.min_age === 'number') {
    if (typeof profile.age !== 'number' || profile.age < conds.min_age) {
      return false;
    }
  }

  // 4. Max Age check
  if (typeof conds.max_age === 'number') {
    if (typeof profile.age === 'number' && profile.age > conds.max_age) {
      return false;
    }
  }

  // 5. Landholding checks
  if (typeof conds.min_landholding_acres === 'number') {
    if (typeof profile.landholding_acres !== 'number' || profile.landholding_acres < conds.min_landholding_acres) {
      return false;
    }
  }
  if (typeof conds.max_landholding_acres === 'number') {
    if (typeof profile.landholding_acres === 'number' && profile.landholding_acres > conds.max_landholding_acres) {
      return false;
    }
  }

  // 6. Max Annual Income check
  if (typeof conds.max_annual_income_inr === 'number') {
    if (typeof profile.annual_income_inr === 'number' && profile.annual_income_inr > conds.max_annual_income_inr) {
      return false;
    }
  }

  // 7. Income Tax Payer check (exclusion rule)
  if (conds.is_tax_payer === false && profile.is_tax_payer === true) {
    return false;
  }

  // 8. Specific status flags
  if (conds.pregnant_or_lactating && !profile.pregnant_or_lactating) {
    return false;
  }
  if (conds.has_minor_daughter && !profile.has_minor_daughter) {
    return false;
  }
  if (conds.kutcha_house_or_homeless && !profile.kutcha_house_or_homeless) {
    return false;
  }
  if (conds.is_informal_worker_or_vendor && !profile.is_informal_worker_or_vendor) {
    return false;
  }

  return true;
}

/**
 * Matches profile against all schemes, sorts by impact, and generates actionable outputs.
 */
export function matchSchemes(profile) {
  const matched = [];

  for (const scheme of SCHEMES_CACHE) {
    if (evaluateSchemeConditions(scheme, profile)) {
      matched.push(scheme);
    }
  }

  // Rank schemes by immediate economic impact (annual benefit or recurring monthly cash)
  matched.sort((a, b) => {
    const scoreA = (a.monthly_benefit_inr * 12) + (a.annual_benefit_inr || 0);
    const scoreB = (b.monthly_benefit_inr * 12) + (b.annual_benefit_inr || 0);
    return scoreB - scoreA;
  });

  // Limit cognitive load: Take top 2 to 3 highest impact schemes
  const topSchemes = matched.slice(0, 3);

  // Extract and deduplicate documents (max 3-4 documents)
  const docSet = new Set();
  const officesSet = new Set();

  for (const s of topSchemes) {
    if (s.documents_hi) {
      s.documents_hi.forEach(doc => docSet.add(doc));
    }
    if (s.where_to_submit_hi) {
      officesSet.add(s.where_to_submit_hi);
    }
  }

  const primaryDocuments = Array.from(docSet).slice(0, 3);
  const primaryOffice = Array.from(officesSet)[0] || "अपने गाँव के पंचायत भवन (पंचायत सहायक) या नजदीकी जन सेवा केंद्र (CSC)";

  // Compose Spoken Hindi Script for Sarvam Bulbul TTS
  let spokenScript = "";
  if (topSchemes.length === 0) {
    spokenScript = "दीदी, आपकी दी गई जानकारी के अनुसार फिलहाल कोई सीधी नकद योजना नहीं मिली है, लेकिन आप पंचायत भवन जाकर जन कल्याण योजनाओं की नई लिस्ट जरूर जांचें।";
  } else {
    spokenScript = `दीदी, आपके लिए ${topSchemes.length} बड़ी सरकारी योजनाएं मिली हैं। `;
    topSchemes.forEach((s, idx) => {
      spokenScript += `योजना ${idx + 1}: ${s.title_hi}। इसमें ${s.spoken_summary_hi} `;
    });
    spokenScript += `इसके लिए आपको मुख्य रूप से ${primaryDocuments.length} कागज़ ले जाने होंगे: ${primaryDocuments.join(', ')}। `;
    spokenScript += `कल सुबह आप ${primaryOffice} पर जाकर यह आवेदन करवा सकती हैं। हमने आपके मोबाइल पर पूरी जानकारी का मैसेज भी भेज दिया है।`;
  }

  // Compose SMS Action Slip
  let smsChecklist = `[सेवा भंडार - योजना पर्ची]\n`;
  if (topSchemes.length === 0) {
    smsChecklist += `दीदी, नजदीकी CSC केंद्र या पंचायत भवन में जाकर नई योजनाओं की सूची देखें।`;
  } else {
    smsChecklist += `दीदी, आप इन योजनाओं के लिए पात्र हैं:\n`;
    topSchemes.forEach((s, i) => {
      const amt = s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr}/माह` : `₹${s.annual_benefit_inr}`;
      smsChecklist += `${i + 1}. ${s.title_hi}: ${amt}\n`;
    });
    smsChecklist += `\nजरूरी कागज़:\n`;
    primaryDocuments.forEach((doc, i) => {
      smsChecklist += `[ ] ${i + 1}. ${doc}\n`;
    });
    smsChecklist += `\nकहाँ जाएं: ${primaryOffice}\n(यह मैसेज पंचायत ऑपरेटर को दिखाएं)`;
  }

  return {
    matchedCount: matched.length,
    topSchemes,
    primaryDocuments,
    primaryOffice,
    spokenScript,
    smsChecklist
  };
}
