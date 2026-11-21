/**
 * Seva Kendra - Dynamic Assistant Pipeline
 * 3-Stage Dynamic Processing Pipeline:
 * Stage A: Intent & Structured Profile Extraction (LLM Call #1, JSON Mode)
 * Stage B: Deterministic Routing & Rules Engine (No LLM)
 * Stage C: User-Specific Spoken Reply Generation (LLM Call #2 -> Sarvam TTS)
 */

import { evaluateAllSchemes, normalizeState } from '../engine/eligibility.js';
import { diagnoseStoppage } from '../engine/triage.js';
import { callLlm } from './llm.js';
import { textToSpeech } from './sarvam.js';
import { getOrSynthesizeCachedAudio } from './tts_cache.js';

// In-memory conversation state store
const SESSIONS = new Map();

export const SAFETY_HELPLINES = [
  { name: "Emergency Helpline", number: "112", description: "National Emergency Services / Police / Ambulance" },
  { name: "Women Helpline", number: "181", description: "Women in Distress / Domestic Violence" },
  { name: "Childline", number: "1098", description: "24x7 Child Abuse / Child Protection" },
  { name: "National Legal Aid Helpline", number: "15100", description: "Free Legal Aid & Counseling" },
  { name: "Tele-MANAS", number: "14416", description: "Mental Health & Crisis Support" }
];

export function getOrCreateSession(sessionId, preferredLanguage = "hi") {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      id: sessionId,
      language: preferredLanguage,
      userProfile: {
        age: null,
        gender: null,
        marital_status: null,
        state: null,
        district: null,
        bpl_or_ration_card: null,
        has_children: null,
        is_govt_employee_or_taxpayer: null
      },
      history: []
    });
  }
  return SESSIONS.get(sessionId);
}

export function resetSession(sessionId) {
  SESSIONS.delete(sessionId);
}

// Convert Bengali and Devanagari numerals to ASCII
export function convertIndicDigitsToAscii(str) {
  if (!str) return "";
  return String(str)
    .replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6))
    .replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966));
}

/**
 * Fast-path fallback safety detector (guarantees safety check even if LLM network call drops)
 */
export function fastCheckSafety(rawText) {
  if (!rawText) return false;
  const t = String(rawText).toLowerCase();
  return (
    t.includes("मारता") || t.includes("मारपीट") || t.includes("মারধর") || t.includes("মারে") ||
    t.includes("घर से निकाल") || t.includes("বের করে") || t.includes("गाली") || t.includes("beats me") ||
    t.includes("violence") || t.includes("torture") || t.includes("धमकी") || t.includes("आत्महत्या") ||
    t.includes("মরতে চাই") || t.includes("suicide") || t.includes("बाल विवाह") || t.includes("child marriage") ||
    ((t.includes("बेटा") || t.includes("बेटी") || t.includes("बच्चा") || t.includes("ছেলে") || t.includes("kid")) &&
     (t.includes("काम करता") || t.includes("দোকানে কাজ") || t.includes("child labour") || t.includes("child labor")))
  );
}

/**
 * Stage A: Intent & Structured Profile Extraction via LLM Call #1 (JSON Mode)
 */
export async function extractIntentAndProfile(userUtterance, currentProfile = {}, history = [], preferredLang = "hi") {
  const asciiUtterance = convertIndicDigitsToAscii(userUtterance);

  // Fast offline regex detection for emergency safety
  if (fastCheckSafety(asciiUtterance)) {
    return {
      intent: "safety_emergency",
      danger_detected: true,
      language_reply: preferredLang.startsWith("bn") ? "bn" : (preferredLang.startsWith("en") ? "en" : "hi"),
      extracted_fields: {},
      user_question: userUtterance
    };
  }

  const systemPrompt = `You are the NLU intent and entity extraction parser for "Seva Kendra", an Indian public welfare voice gateway.
You understand spoken and written English, Hindi, Bengali (including Bengali numerals ০-৯ and number words), Bhojpuri, and Maithili.
For Bhojpuri or Maithili speakers, set "language_reply" to "hi". For Bengali, set "bn". For English, set "en". For Hindi, set "hi".

Current user profile state:
${JSON.stringify(currentProfile, null, 2)}

You must return ONLY a JSON object matching this schema:
{
  "intent": "safety_emergency | payment_stopped | scheme_eligibility | general_question | correction",
  "danger_detected": boolean,
  "language_reply": "bn | hi | en",
  "extracted_fields": {
    "age": number or null (e.g. 47, extract only real person age, ignore money amounts like 500 rupees),
    "gender": "female" | "male" | null,
    "marital_status": "widow" | "married" | "single" | "separated" | null (Note: "family/parivar" does NOT mean married. "husband died" or "bidhaba" means widow),
    "state": string or null (e.g. "West Bengal", "Uttar Pradesh", "Bihar", "Delhi". Any district in West Bengal like Bardhaman, Kolkata, Howrah, Hooghly, Nadia, 24 Parganas MUST set state to "West Bengal". Never match "support" as UP),
    "district": string or null (e.g. "Bardhaman", "Kolkata", "Patna"),
    "bpl_or_ration_card": boolean or null (true if BPL card, yellow/red ration card, or poor is mentioned; false if APL/taxpayer),
    "has_children": boolean or null,
    "is_govt_employee_or_taxpayer": boolean or null
  },
  "user_question": "brief summary of user utterance"
}

Important Guardrails:
1. "danger_detected": true if user mentions domestic violence, abuse, beating, threats, thrown out of house, child labor, child marriage, or suicide/self-harm.
2. "intent": "payment_stopped" if user says pension, salary, or DBT money has stopped, is held up, or did not arrive.
3. Never invent facts. If a field was not explicitly stated or implied, leave it as null.`;

  try {
    const messages = [];
    // Include last 2 turns of conversation history for context
    const recentHistory = history.slice(-4);
    for (const h of recentHistory) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: asciiUtterance });

    const result = await callLlm({
      systemPrompt,
      messages,
      jsonMode: true,
      temperature: 0.1
    });

    if (result && typeof result === 'object' && result.intent) {
      // Normalize state based on district
      if (result.extracted_fields) {
        result.extracted_fields.state = normalizeState(result.extracted_fields.state, result.extracted_fields.district);
      }
      return result;
    }
  } catch (err) {
    console.error("[Stage A LLM Extraction Error]", err.message);
  }

  // Graceful rule-based extraction fallback if LLM is unreachable
  return fallbackRuleExtraction(asciiUtterance, currentProfile, preferredLang);
}

/**
 * Robust rule-based fallback extractor if LLM is unavailable
 */
function fallbackRuleExtraction(text, currentProfile, preferredLang) {
  const lower = text.toLowerCase();
  const extracted = {};
  let intent = "scheme_eligibility";
  let danger_detected = fastCheckSafety(text);

  if (danger_detected) {
    return {
      intent: "safety_emergency",
      danger_detected: true,
      language_reply: preferredLang,
      extracted_fields: {},
      user_question: text
    };
  }

  if (
    lower.includes("payment") ||
    lower.includes("stopped") ||
    lower.includes("stoppage") ||
    lower.includes("not received") ||
    lower.includes("not credited") ||
    (lower.includes("pension") && (lower.includes("stop") || lower.includes("not") || lower.includes("delay") || lower.includes("held"))) ||
    lower.includes("रुकी") ||
    lower.includes("रुक गई") ||
    lower.includes("पेंशन नहीं") ||
    lower.includes("पैसा नहीं") ||
    lower.includes("बंद") ||
    lower.includes("আসেনি") ||
    lower.includes("আটকে") ||
    lower.includes("টাকা আসেনি")
  ) {
    intent = "payment_stopped";
  }

  // Age extraction (handle decomposed and precomposed Indic Unicode)
  const ageMatch = text.match(/(?:i\s*am|i'm|aged?|age\s*(?:is)?|ব[য়য]়?স|ব[য়য]়?েস|উমর|उम्र|वयस)\s*[:=]?\s*(\d{1,2})\b/i) ||
                   text.match(/(\d{1,2})\s*(?:साल|वर्ष|उम्र|बरस|बछर|বছর|ব[য়য]়?েস|years?|yrs?|yr|yo|old)/i) ||
                   text.match(/(?:age|উমর|ব[য়য]়?স)\s*[:=]?\s*(\d{1,2})/i) ||
                   text.match(/^\s*(\d{1,2})\s*$/);
  if (ageMatch) {
    const candidate = parseInt(ageMatch[1], 10);
    if (candidate >= 18 && candidate <= 100) extracted.age = candidate;
  }

  // Marital Status & Gender
  if (
    lower.includes("widow") ||
    lower.includes("বিধবা") ||
    lower.includes("विधवा") ||
    lower.includes("স্বামী মারা") ||
    /husband\s+(?:has\s+)?(?:died|passed|left)/i.test(lower) ||
    /husband\s+is\s+no\s+more/i.test(lower) ||
    /lost\s+my\s+husband/i.test(lower) ||
    lower.includes("husband died") ||
    lower.includes("पति नहीं") ||
    lower.includes("पति गुजर") ||
    lower.includes("पति शांत") ||
    lower.includes("पति नइखन") ||
    lower.includes("घरवाला नहीं")
  ) {
    extracted.marital_status = "widow";
    extracted.gender = "female";
  } else if (lower.includes("married") || lower.includes("विवाहित") || lower.includes("शादीशुदा") || lower.includes("বিবাহিত")) {
    extracted.marital_status = "married";
  } else if (lower.includes("unmarried") || lower.includes("अविवाहित") || lower.includes("অবিবাহিত") || lower.includes("single") || lower.includes("कुंवारी") || lower.includes("शादी नहीं")) {
    extracted.marital_status = "single";
  }

  // Pregnant or lactating mother
  if (lower.includes("pregnant") || lower.includes("गर्भवती") || lower.includes("গর্ভাবস্থা") || lower.includes("lactating") || lower.includes("स्तनपान") || lower.includes("দুধ খাওয়া") || lower.includes("baby") || lower.includes("बच्चा होने")) {
    extracted.pregnant_or_lactating = true;
    extracted.gender = "female";
  }

  // Daughter / girl child
  if (lower.includes("daughter") || lower.includes("बेटी") || lower.includes("लड़की") || lower.includes("মেয়ে") || lower.includes("কন্যা")) {
    extracted.has_daughter = true;
  }

  // Gender detection (if not already set)
  if (!extracted.gender) {
    if (lower.includes("महिला") || lower.includes("स्त्री") || lower.includes("female") || lower.includes("woman")) {
      extracted.gender = "female";
    } else if (lower.includes("पुरुष") || lower.includes("मर्द") || lower.includes("male") || lower.includes("man")) {
      extracted.gender = "male";
    }
  }

  // Landholding
  if (lower.includes("कोई जमीन नहीं") || lower.includes("जमीन नहीं") || lower.includes("भूमिहीन") || lower.includes("জমি নেই") || lower.includes("no land") || lower.includes("landless")) {
    extracted.landholding_acres = 0.0;
  }

  // State & District
  if (lower.includes("bardhaman") || lower.includes("বর্ধমান") || lower.includes("kolkata") || lower.includes("কলকাতা") || lower.includes("bengal") || lower.includes("পশ্চিমবঙ্গ")) {
    extracted.state = "West Bengal";
    if (lower.includes("bardhaman") || lower.includes("বর্ধমান")) extracted.district = "Bardhaman";
    if (lower.includes("kolkata") || lower.includes("কলকাতা")) extracted.district = "Kolkata";
  } else if (lower.includes("delhi") || lower.includes("दिल्ली")) {
    extracted.state = "Delhi";
  } else if (/\b(uttar\s+pradesh|u\.p\.)\b/i.test(lower) || lower.includes("उत्तर प्रदेश") || lower.includes("यूपी")) {
    extracted.state = "Uttar Pradesh";
  }

  // BPL
  if (lower.includes("bpl") || lower.includes("बीपीएल") || lower.includes("বিপিএল") || lower.includes("ration card") || lower.includes("राशन कार्ड")) {
    extracted.bpl_or_ration_card = true;
  }

  let langReply = preferredLang || "hi";
  if (lower.includes("বাংলা") || /[অ-হ]/.test(text)) {
    langReply = "bn";
  } else if (/[अ-ह]/.test(text)) {
    langReply = "hi";
  } else if (lower.includes("english") || (preferredLang === "en" && /^[a-z0-9\s.,!?'"()\-]+$/i.test(text.trim()))) {
    langReply = "en";
  }

  return {
    intent,
    danger_detected: false,
    language_reply: langReply,
    extracted_fields: extracted,
    user_question: text
  };
}

/**
 * Stage C: User-Specific Spoken Reply Generation via LLM Call #2
 * Zero markdown, zero bullets, zero URLs. Max 2-3 short, warm sentences.
 */
export async function generateSpokenReply({ stageBResult, userProfile, languageReply = "hi", userQuestion = "" }) {
  const lang = (languageReply === "bn" || languageReply === "bengali") ? "bn" :
               (languageReply === "en" || languageReply === "english") ? "en" : "hi";

  const systemPrompt = `You are Seva Kendra's voice assistant speaking to a rural Indian citizen.
Generate an auditory voice reply strictly in "${lang}" (Hindi if 'hi', Bengali if 'bn', English if 'en').

STRICT RULES:
1. MAX 2 to 3 SHORT, NATURAL, WARM SENTENCES. Suitable for immediate Text-to-Speech playback.
2. ZERO markdown (*, #, _, -). ZERO bullet points. ZERO URLs. ZERO technical jargon.
3. HONEST WORDING ONLY: Say "you may be eligible" and "final verification and approval happen at the office". NEVER say "approved" or "SMS sent".
4. If missing info is needed: Acknowledge what was noted and ask ONE single question.
5. If schemes matched: Name the matched scheme(s), state that they may be eligible, and mention the necessary documents and office to visit are shown on the screen.`;

  const contextData = {
    flow: stageBResult.flow,
    needsInfo: stageBResult.needsInfo,
    matchedSchemes: stageBResult.screen_data?.schemes?.map(s => ({
      id: s.id,
      name: s.name,
      benefit: s.benefit,
      why_you_may_qualify: s.why_you_may_qualify
    })) || [],
    userProfile
  };

  try {
    const rawReply = await callLlm({
      systemPrompt,
      messages: [
        { role: 'user', content: `Citizen context:\n${JSON.stringify(contextData)}\nCitizen asked: "${userQuestion}"` }
      ],
      jsonMode: false,
      temperature: 0.3
    });

    let cleanReply = (rawReply || "").replace(/[*#_`\-\[\]]/g, '').replace(/https?:\/\/\S+/g, '').trim();
    if (cleanReply.length > 0) {
      return cleanReply;
    }
  } catch (err) {
    console.error("[Stage C LLM Spoken Reply Error]", err.message);
  }

  // Fallback spoken replies if LLM is offline
  if (stageBResult.flow === 'safety') {
    return {
      hi: "घबराइए मत, आप सुरक्षित जगह पर रहें और तुरंत आपातकालीन सहायता नंबर 112 या महिला हेल्पलाइन 181 पर कॉल करें।",
      bn: "ভয় পাবেন না, নিরাপদ স্থানে থাকুন এবং অবিলম্বে জরুরি নম্বর ১১২ অথবা ১৮১ নম্বরে কল করুন।",
      en: "Please stay safe. Immediately call emergency helpline 112 or women helpline 181 for help."
    }[lang];
  }

  if (stageBResult.flow === 'payment_triage') {
    return {
      hi: "आपकी पेंशन या मजदूरी रुकने की जांच के लिए बैंक खाता सक्रियता और आधार लिंक की सूची स्क्रीन पर दी गई है। अंतिम जांच पंचायत या बैंक में कराएं।",
      bn: "আপনার টাকা আটকে যাওয়ার সম্ভাব্য কারণ ও করণীয় স্ক্রিনে দেখানো হয়েছে। চূড়ান্ত যাচাই পঞ্চায়েত বা ব্যাংকে করান।",
      en: "The steps to resolve your delayed payment are displayed on your screen. Please verify your Aadhaar seeding at your bank or Panchayat office."
    }[lang];
  }

  if (stageBResult.flow === 'follow_up' && stageBResult.needsInfo?.question) {
    return stageBResult.needsInfo.question;
  }

  const matchedNames = stageBResult.screen_data?.schemes?.filter(s => s.status === 'verified').map(s => s.name).join(', ');
  if (matchedNames) {
    return {
      hi: `आप ${matchedNames} के लिए पात्र हो सकती हैं। ज़रूरी कागजात और जाने का कार्यालय स्क्रीन पर दिख रहे हैं, अंतिम मंज़ूरी दफ़्तर में होगी।`,
      bn: `আপনি ${matchedNames} প্রকল্পের জন্য যোগ্য হতে পারেন। প্রয়োজনীয় নথি ও অফিসের বিবরণ স্ক্রিনে দেওয়া রয়েছে, চূড়ান্ত অনুমোদন অফিসে হবে।`,
      en: `You may be eligible for ${matchedNames}. Required documents and office details are displayed on your screen, and final verification happens at the office.`
    }[lang];
  }

  return {
    hi: "आपकी जानकारी नोट कर ली गई है। विस्तृत पात्रता के लिए कृपया अपने नजदीकी ब्लॉक या पंचायत कार्यालय में संपर्क करें।",
    bn: "আপনার বিবরণ নোট করা হয়েছে। বিস্তারিত যোগ্যতার জন্য স্থানীয় বিডিও বা পঞ্চায়েত অফিসে যোগাযোগ করুন।",
    en: "Your details have been noted. For full scheme eligibility, please inquire at your local Panchayat or Block Development Office."
  }[lang];
}

/**
 * Main 3-Stage Dynamic Turn Processor
 */
export async function processDynamicTurn(sessionId, userSpeechText, language = "hi", generateTts = true) {
  const session = getOrCreateSession(sessionId, language);

  // --------------------------------------------------------------------------
  // STAGE A: Intent & Structured Profile Extraction (LLM Call #1, JSON Mode)
  // --------------------------------------------------------------------------
  const extraction = await extractIntentAndProfile(
    userSpeechText,
    session.userProfile,
    session.history,
    language
  );

  const intent = extraction.intent || "scheme_eligibility";
  const dangerDetected = Boolean(extraction.danger_detected);
  const languageReply = extraction.language_reply || language;

  // Merge non-null extracted fields into session profile
  if (extraction.extracted_fields && !dangerDetected) {
    for (const [key, value] of Object.entries(extraction.extracted_fields)) {
      if (value !== null && value !== undefined) {
        session.userProfile[key] = value;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STAGE B: Deterministic Routing & Rules Engine (No LLM)
  // --------------------------------------------------------------------------
  let stageBResult = null;

  // PRIORITY 1: SAFETY OVERRIDE
  if (dangerDetected || intent === "safety_emergency") {
    // Immediate override: do NOT persist this turn in conversation history
    stageBResult = {
      flow: "safety",
      screen_data: {
        schemes: [],
        triage_checklist: [],
        helplines: SAFETY_HELPLINES
      }
    };
  }
  // PRIORITY 2: PAYMENT STOPPED
  else if (intent === "payment_stopped") {
    const triage = diagnoseStoppage(userSpeechText, session.userProfile, languageReply);
    stageBResult = {
      flow: "payment_triage",
      screen_data: {
        schemes: [],
        triage_checklist: triage.checklist,
        helplines: []
      }
    };
  }
  // PRIORITY 3: ELIGIBILITY ENGINE
  else {
    const evalResult = evaluateAllSchemes(session.userProfile, languageReply);
    const hasFollowUp = Boolean(evalResult.needsInfo);
    const flow = (hasFollowUp && evalResult.matchedVerified.length === 0) ? "follow_up" : "results";

    stageBResult = {
      flow,
      needsInfo: evalResult.needsInfo,
      screen_data: {
        schemes: evalResult.allScreenSchemes,
        triage_checklist: [],
        helplines: []
      }
    };
  }

  // --------------------------------------------------------------------------
  // STAGE C: User-Specific Spoken Reply Generation (LLM Call #2 -> Sarvam TTS)
  // --------------------------------------------------------------------------
  const spokenReply = await generateSpokenReply({
    stageBResult,
    userProfile: session.userProfile,
    languageReply,
    userQuestion: userSpeechText
  });

  const matchedIds = stageBResult.screen_data?.schemes?.map(s => s.id) || [];
  console.log("[TURN] sessionId:", sessionId, "| userText:", userSpeechText);
  console.log("[STAGE A - EXTRACTED]:", JSON.stringify(extraction.extracted_fields || {}));
  console.log("[STAGE B - ELIGIBILITY]:", JSON.stringify({ flow: stageBResult.flow, matchedIds, needsInfo: stageBResult.needsInfo }));
  console.log("[STAGE C - SPOKEN REPLY]:", spokenReply);

  // Synthesize audio via Sarvam TTS or Cache
  let audioUrl = null;
  let audioBase64 = null;
  if (generateTts) {
    try {
      const cached = await getOrSynthesizeCachedAudio(spokenReply, languageReply);
      if (cached) {
        audioUrl = cached.url;
      } else {
        const tts = await textToSpeech(spokenReply, languageReply, "aarti_hi_customer");
        audioBase64 = tts.audio_base64;
      }
    } catch (e) {
      console.warn("[TTS Synthesis Warning]", e.message);
    }
  }

  // Only store non-safety turns in history
  if (stageBResult.flow !== "safety") {
    session.history.push({ role: 'user', content: userSpeechText });
    session.history.push({ role: 'assistant', content: spokenReply });
  }

  // Standardized API response
  return {
    sessionId,
    flow: stageBResult.flow,
    language: languageReply,
    spoken_reply: spokenReply,
    replyText: spokenReply, // backward compatibility
    audio_base64_or_url: audioUrl || (audioBase64 ? `data:audio/wav;base64,${audioBase64}` : null),
    audioUrl,
    audioBase64,
    extracted_profile: session.userProfile,
    profile: session.userProfile, // backward compatibility
    screen_data: stageBResult.screen_data,
    type: stageBResult.flow === 'safety' ? 'SAFETY_ALERT' :
          stageBResult.flow === 'payment_triage' ? 'TRIAGE_RESOLVED' :
          stageBResult.flow === 'results' ? 'SCHEMES_MATCHED' : 'FOLLOW_UP_QUESTION'
  };
}
