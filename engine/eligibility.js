/**
 * JanKalyan Voice Gateway - Deterministic Eligibility Rules Engine
 * Evaluates verified scheme rules against extracted user profile.
 * AI understands words; rules engine + verified database decide facts.
 * Honest wording only: "you may be eligible", "final verification and approval happen at the office".
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import schemesData from '../schemes_data.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let SCHEMES_CACHE = schemesData || [];

// Known West Bengal districts mapping
const WB_DISTRICTS = [
  'kolkata', 'howrah', 'hooghly', 'bardhaman', 'burdwan', 'purba bardhaman', 'paschim bardhaman',
  'nadia', 'murshidabad', 'north 24 parganas', 'south 24 parganas', 'uttar 24 pargana', 'dakshin 24 pargana',
  'birbhum', 'bankura', 'purulia', 'malda', 'darjeeling', 'kalimpong', 'jalpaiguri', 'alipurduar',
  'cooch behar', 'uttar dinajpur', 'dakshin dinajpur', 'jhargram', 'paschim medinipur', 'purba medinipur'
];

export function normalizeState(state, district) {
  if (district) {
    const dLower = String(district).toLowerCase().trim();
    if (WB_DISTRICTS.some(d => dLower.includes(d))) {
      return "West Bengal";
    }
  }

  if (!state) return null;
  const s = String(state).toLowerCase().trim();
  if (s === "wb" || s.includes("bengal") || s.includes("বাংলা") || s.includes("পশ্চিমবঙ্গ") || s.includes("पश्चिम बंगाल")) {
    return "West Bengal";
  }
  if (s === "up" || s.includes("uttar pradesh") || s.includes("उत्तर प्रदेश") || s.includes("यूपी")) {
    return "Uttar Pradesh";
  }
  if (s === "br" || s.includes("bihar") || s.includes("बिहार")) {
    return "Bihar";
  }
  if (s === "mp" || s.includes("madhya pradesh") || s.includes("मध्य प्रदेश")) {
    return "Madhya Pradesh";
  }
  if (s === "dl" || s.includes("delhi") || s.includes("दिल्ली")) {
    return "Delhi";
  }
  return state;
}

/**
 * Determines eligibility for a single scheme against user profile
 */
export function evaluateSchemeEligibility(scheme, profile = {}, language = "hi") {
  const rules = scheme.rules || {};
  const normState = normalizeState(profile.state, profile.district);
  const lang = (language === "bn" || language === "bengali") ? "bn" :
               (language === "en" || language === "english") ? "en" : "hi";

  // Unverified scheme handling
  if (scheme.status === "unverified") {
    return {
      status: "unverified",
      eligible: false,
      isRelevant: Boolean(profile.has_children || profile.pregnant_or_lactating),
      why_you_may_qualify: {
        en: "Ask at the local Anganwadi office for current maternal, child nutrition, or scholarship support.",
        bn: "মাতৃ ও শিশু পুষ্টি বা বৃত্তির সুবিধার জন্য স্থানীয় অঙ্গনওয়াড়ি অফিসে যোগাযোগ করুন।",
        hi: "मातृ एवं बाल पोषण या छात्रवृत्ति सहायता के लिए स्थानीय आंगनवाड़ी केंद्र में संपर्क करें।"
      }[lang]
    };
  }

  // Special check for Sukanya Samriddhi Yojana (Parent of daughter under 10 OR girl child under 10)
  if (scheme.id === "central_ssy") {
    const isGirlUnder10 = profile.gender === 'female' && typeof profile.age === 'number' && profile.age <= 10;
    const hasYoungDaughter = Boolean(profile.has_daughter || profile.has_minor_daughter || profile.daughter_under_10);
    if (!isGirlUnder10 && !hasYoungDaughter) {
      return { status: "ineligible", eligible: false, reason: "Targeted for girl child under 10" };
    }
  }

  // Special check for PMMVY (Pregnant or Lactating mothers)
  if (scheme.id === "central_pmmvy") {
    if (!profile.pregnant_or_lactating) {
      return { status: "ineligible", eligible: false, reason: "Requires pregnancy or lactation" };
    }
  }

  // 1. State Filter (Hard check)
  if (rules.states && rules.states.length > 0) {
    if (!normState) {
      return { status: "needs_info", missingField: "state", eligible: false };
    }
    if (!rules.states.includes(normState)) {
      return { status: "ineligible", eligible: false, reason: "State not eligible" };
    }
  }

  // 2. Gender check
  if (rules.gender && rules.gender.length > 0) {
    if (!profile.gender && scheme.id !== "central_ssy") {
      return { status: "needs_info", missingField: "gender", eligible: false };
    }
    if (profile.gender && !rules.gender.includes(profile.gender.toLowerCase()) && scheme.id !== "central_ssy") {
      return { status: "ineligible", eligible: false, reason: "Gender condition not satisfied" };
    }
  }

  // 3. Marital status check
  if (rules.marital_status && rules.marital_status.length > 0) {
    if (!profile.marital_status) {
      return { status: "needs_info", missingField: "marital_status", eligible: false };
    }
    const userMarital = profile.marital_status.toLowerCase();
    const matched = rules.marital_status.some(m => m.toLowerCase() === userMarital || (m === "single" && userMarital === "unmarried") || (m === "unmarried" && userMarital === "single"));
    if (!matched) {
      return { status: "ineligible", eligible: false, reason: "Marital status condition not satisfied" };
    }
  }

  // 4. Age checks
  if (typeof rules.min_age === 'number') {
    if (typeof profile.age !== 'number') {
      return { status: "needs_info", missingField: "age", eligible: false };
    }
    if (profile.age < rules.min_age) {
      return { status: "ineligible", eligible: false, reason: `Age is below min_age ${rules.min_age}` };
    }
  }
  if (typeof rules.max_age === 'number') {
    if (typeof profile.age === 'number' && profile.age > rules.max_age) {
      return { status: "ineligible", eligible: false, reason: `Age exceeds max_age ${rules.max_age}` };
    }
  }

  // 5. Exclusions (Govt employee / Tax payer)
  if (rules.exclude_govt_employee_or_pensioner && profile.is_govt_employee_or_taxpayer === true) {
    return { status: "ineligible", eligible: false, reason: "Government employee or tax payer exclusion" };
  }
  if (rules.exclude_income_tax_payer && profile.is_tax_payer === true) {
    return { status: "ineligible", eligible: false, reason: "Income tax payer exclusion" };
  }

  // 6. BPL requirement
  if (rules.requires_bpl) {
    if (profile.bpl_or_ration_card === undefined || profile.bpl_or_ration_card === null) {
      return { status: "needs_info", missingField: "bpl_or_ration_card", eligible: false };
    }
    if (profile.bpl_or_ration_card === false) {
      return { status: "ineligible", eligible: false, reason: "Requires BPL card" };
    }
  }

  // Build localized user-specific why_you_may_qualify description
  let whyMsg = "";
  const ageDisplay = profile.age ? profile.age : "";

  if (scheme.id === "wb_annapurna_yojana") {
    if (lang === "bn") {
      whyMsg = `আপনি পশ্চিমবঙ্গের বাসিন্দা, আপনার বয়স ${ageDisplay} বছর (২৫–৬০ বছরের মধ্যে) এবং আপনি সরকারি চাকরি বা আয়কর দেন না।`;
    } else if (lang === "en") {
      whyMsg = `You are a female resident of West Bengal aged ${ageDisplay} (within the 25–60 window) and not an income tax payer or government employee.`;
    } else {
      whyMsg = `आप पश्चिम बंगाल की निवासी हैं, आपकी उम्र ${ageDisplay} वर्ष (25–60 वर्ष की सीमा में) है और आप सरकारी नौकरी या आयकर दाता नहीं हैं।`;
    }
  } else if (scheme.id === "central_ignwps") {
    if (lang === "bn") {
      whyMsg = `আপনি ${ageDisplay} বছর বয়সী বিধবা (৪০–৭৯ বছরের মধ্যে) এবং বিপিএল পরিবারের সদস্য।`;
    } else if (lang === "en") {
      whyMsg = `You are a widow aged ${ageDisplay} (within the 40–79 age bracket) from a BPL household.`;
    } else {
      whyMsg = `आप ${ageDisplay} वर्ष की विधवा हैं (40–79 वर्ष की आयु सीमा में) और बीपीएल परिवार से हैं।`;
    }
  } else if (scheme.id === "wb_widow_pension") {
    if (lang === "bn") {
      whyMsg = `আপনি পশ্চিমবঙ্গের বাসিন্দা বিধবা এবং আর্থিক সহায়তার যোগ্য।`;
    } else if (lang === "en") {
      whyMsg = `You are a destitute widow residing in West Bengal.`;
    } else {
      whyMsg = `आप पश्चिम बंगाल की निवासी विधवा हैं।`;
    }
  } else if (scheme.id === "central_ignoaps") {
    if (lang === "bn") {
      whyMsg = `আপনার বয়স ${ageDisplay} বছর (৬০ বছর বা তার বেশি) এবং আপনি বিপিএল পরিবারের সদস্য।`;
    } else if (lang === "en") {
      whyMsg = `You are aged ${ageDisplay} (60 years or above) from a BPL household.`;
    } else {
      whyMsg = `आपकी उम्र ${ageDisplay} वर्ष (60 वर्ष या अधिक) है और आप बीपीएल परिवार से हैं।`;
    }
  } else if (scheme.id === "wb_old_age_pension") {
    if (lang === "bn") {
      whyMsg = `আপনি পশ্চিমবঙ্গের প্রবীণ বাসিন্দা, আপনার বয়স ${ageDisplay} বছর (৬০ বছর বা তার বেশি)।`;
    } else if (lang === "en") {
      whyMsg = `You are an elderly resident of West Bengal aged ${ageDisplay} (60 years or above).`;
    } else {
      whyMsg = `आप पश्चिम बंगाल के वरिष्ठ निवासी हैं, उम्र ${ageDisplay} वर्ष (60 वर्ष या अधिक)।`;
    }
  } else if (scheme.id === "wb_kanyashree") {
    if (lang === "bn") {
      whyMsg = `আপনি পশ্চিমবঙ্গের ${ageDisplay} বছর বয়সী অবিবাহিত ছাত্রী (১৩–১৯ বছর)।`;
    } else if (lang === "en") {
      whyMsg = `You are an unmarried adolescent female student aged ${ageDisplay} in West Bengal.`;
    } else {
      whyMsg = `आप पश्चिम बंगाल की ${ageDisplay} वर्ष की अविवाहित छात्रा हैं (13–19 वर्ष)।`;
    }
  } else if (scheme.id === "wb_rupashree") {
    if (lang === "bn") {
      whyMsg = `আপনি পশ্চিমবঙ্গের প্রাপ্তবয়স্ক অবিবাহিত নারী (১৮+ বছর) এবং বিবাহের প্রস্তাব রয়েছে।`;
    } else if (lang === "en") {
      whyMsg = `You are an adult unmarried woman aged ${ageDisplay} (18+) residing in West Bengal proposing marriage.`;
    } else {
      whyMsg = `आप पश्चिम बंगाल की 18 वर्ष से अधिक उम्र की अविवाहित महिला हैं जो विवाह करने जा रही हैं।`;
    }
  } else if (scheme.id === "central_ssy") {
    if (lang === "bn") {
      whyMsg = `১০ বছরের কম বয়সী কন্যা সন্তানের ভবিষ্যতের সঞ্চয়ের জন্য প্রযোজ্য।`;
    } else if (lang === "en") {
      whyMsg = `Eligible for parents of a girl child under 10 years of age for secure high-interest savings.`;
    } else {
      whyMsg = `10 वर्ष से कम उम्र की बेटी के सुरक्षित भविष्य और बचत के लिए मान्य।`;
    }
  } else if (scheme.id === "central_pmmvy") {
    if (lang === "bn") {
      whyMsg = `১৯ বছর বা তদূর্ধ্ব বয়সী গর্ভবতী ও স্তন্যদানকারী মায়েদের জন্য আর্থিক সহায়তা।`;
    } else if (lang === "en") {
      whyMsg = `Maternity benefit for pregnant women and lactating mothers aged 19+.`;
    } else {
      whyMsg = `19 वर्ष या अधिक उम्र की गर्भवती एवं धात्री माताओं के लिए मातृत्व सहायता।`;
    }
  } else if (scheme.id === "central_ugc_single_girl") {
    if (lang === "bn") {
      whyMsg = `স্নাতকোত্তর স্তরে পাঠরত পরিবারের একমাত্র কন্যা সন্তানের জন্য বৃত্তি।`;
    } else if (lang === "en") {
      whyMsg = `Postgraduate scholarship for a single girl child in the family up to 30 years of age.`;
    } else {
      whyMsg = `परिवार की इकलौती बेटी के लिए पीजी स्तर की उच्च शिक्षा छात्रवृत्ति।`;
    }
  } else {
    whyMsg = `You meet the general age and demographic eligibility criteria.`;
  }

  // Fill what_to_say template
  let whatToSay = "";
  if (scheme.what_to_say_templates) {
    const tmpl = scheme.what_to_say_templates[lang] || scheme.what_to_say_templates.en || "";
    whatToSay = tmpl.replace('{age}', String(profile.age || ''));
  }

  return {
    status: "eligible",
    eligible: true,
    why_you_may_qualify: whyMsg,
    what_to_say: whatToSay
  };
}

/**
 * Evaluates all schemes in database against user profile
 */
export function evaluateAllSchemes(profile = {}, language = "hi") {
  const normState = normalizeState(profile.state, profile.district);
  const lang = (language === "bn" || language === "bengali") ? "bn" :
               (language === "en" || language === "english") ? "en" : "hi";

  const matchedVerified = [];
  const unverifiedSchemes = [];
  const missingFields = new Set();

  for (const scheme of SCHEMES_CACHE) {
    // State filtering (always include state === "ALL" or matching state)
    if (scheme.state !== "ALL" && normState && scheme.state !== normState) {
      continue;
    }

    const evalRes = evaluateSchemeEligibility(scheme, profile, lang);

    if (evalRes.status === "eligible") {
      matchedVerified.push({
        id: scheme.id,
        name: scheme.name,
        status: "verified",
        benefit: scheme.benefit,
        why_you_may_qualify: evalRes.why_you_may_qualify,
        documents: scheme.documents || [],
        office_to_visit: scheme.office_to_visit || "",
        what_to_say: evalRes.what_to_say || "",
        source_url: scheme.source_url || "",
        last_verified: scheme.last_verified || "2026-11-21"
      });
    } else if (evalRes.status === "needs_info") {
      if (evalRes.missingField) {
        missingFields.add(evalRes.missingField);
      }
    } else if (evalRes.status === "unverified") {
      unverifiedSchemes.push({
        id: scheme.id,
        name: scheme.name,
        status: "unverified",
        benefit: scheme.benefit,
        why_you_may_qualify: evalRes.why_you_may_qualify,
        documents: scheme.documents || [],
        office_to_visit: scheme.office_to_visit || "",
        what_to_say: "Ask at office for current local guidelines.",
        source_url: scheme.source_url || "",
        last_verified: scheme.last_verified || "2026-11-21"
      });
    }
  }

  // Determine single highest-priority missing field for follow-up question
  let needsInfo = null;
  if (!normState) {
    needsInfo = {
      field: "state",
      question: {
        en: "Which state and district do you live in?",
        bn: "আপনি কোন রাজ্য এবং জেলায় থাকেন?",
        hi: "आप किस राज्य और जिले में रहते हैं?"
      }[lang]
    };
  } else if (profile.age === null || profile.age === undefined) {
    needsInfo = {
      field: "age",
      question: {
        en: "How old are you?",
        bn: "আপনার বয়স কত বছর?",
        hi: "आपकी उम्र कितने साल है?"
      }[lang]
    };
  } else if (!profile.gender) {
    needsInfo = {
      field: "gender",
      question: {
        en: "Are you female or male?",
        bn: "আপনি কি মহিলা নাকি পুরুষ?",
        hi: "आप महिला हैं या पुरुष?"
      }[lang]
    };
  } else if (profile.gender === 'female' && profile.age >= 40 && !profile.marital_status) {
    needsInfo = {
      field: "marital_status",
      question: {
        en: "What is your marital status (married, widowed, or single)?",
        bn: "আপনার বৈবাহিক অবস্থা কী (বিবাহিত, বিধবা, নাকি একা থাকেন)?",
        hi: "कृपया बताएं, क्या आप शादीशुदा हैं, विधवा हैं, या अकेले रहते हैं?"
      }[lang]
    };
  } else if ((profile.marital_status === 'widow' || profile.age >= 60) && (profile.bpl_or_ration_card === null || profile.bpl_or_ration_card === undefined)) {
    needsInfo = {
      field: "bpl_or_ration_card",
      question: {
        en: "Do you or your household have a BPL card or ration card?",
        bn: "আপনার বা আপনার পরিবারের কি বিপিএল কার্ড বা রেশন কার্ড আছে?",
        hi: "क्या आपके पास बीपीएल राशन कार्ड है?"
      }[lang]
    };
  }

  // Combined screen schemes
  const allScreenSchemes = [...matchedVerified];
  if (unverifiedSchemes.length > 0 && (matchedVerified.length === 0 || profile.has_children)) {
    allScreenSchemes.push(...unverifiedSchemes);
  }

  return {
    matchedVerified,
    unverifiedSchemes,
    allScreenSchemes,
    needsInfo
  };
}

// Backward compatibility export
export function matchSchemes(profile = {}, language = "hi") {
  const result = evaluateAllSchemes(profile, language);
  return {
    matchedCount: result.matchedVerified.length,
    eligible: result.matchedVerified,
    topSchemes: result.matchedVerified,
    allScreenSchemes: result.allScreenSchemes,
    needsInfo: result.needsInfo
  };
}

export { SCHEMES_CACHE };
