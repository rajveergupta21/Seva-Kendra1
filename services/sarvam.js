/**
 * Sarvam AI Official SDK Service Integration
 * Uses the official 'sarvamai' npm package.
 * Text-to-Speech: bulbul:v4-flash (speaker: aarti_hi_customer, 24kHz)
 * Speech-to-Text: saaras:v3
 */

import { SarvamAIClient } from 'sarvamai';

const DEFAULT_API_KEY = process.env.SARVAM_API_KEY || "sk_x00bjnt4_2SgyfD37o214xLKsJk539Taz";

let sarvamClient = null;

export function getSarvamClient(apiKey = process.env.SARVAM_API_KEY || DEFAULT_API_KEY) {
  const effectiveKey = apiKey || DEFAULT_API_KEY;
  if (!sarvamClient || (effectiveKey && sarvamClient._options?.apiSubscriptionKey !== effectiveKey)) {
    sarvamClient = new SarvamAIClient({
      apiSubscriptionKey: effectiveKey
    });
  }
  return sarvamClient;
}

/**
 * Maps incoming dialect/language strings to official Sarvam target_language_code
 */
export function getLanguageCode(lang = "hi") {
  if (!lang) return "hi-IN";
  const lower = lang.toLowerCase();
  if (lower.startsWith("bn") || lower.includes("bengali")) return "bn-IN";
  if (lower.startsWith("en") || lower.includes("english")) return "en-IN";
  return "hi-IN"; // Hindi, Bhojpuri, Maithili use hi-IN
}

/**
 * Text-to-Speech using Sarvam AI Bulbul v4-flash
 * Supports multi-language synthesis with aarti_hi_customer at 24000Hz
 * Polymorphic parameters support:
 *   textToSpeech(text, language, speaker, apiKey)
 *   textToSpeech(text, speaker, apiKey)
 *   textToSpeech(text)
 */
export async function textToSpeech(text, arg2 = "hi", arg3 = "aarti_hi_customer", arg4 = undefined) {
  let language = "hi";
  let speaker = "aarti_hi_customer";
  let apiKey = process.env.SARVAM_API_KEY || DEFAULT_API_KEY;

  if (typeof arg2 === 'string' && (arg2.startsWith('sk_') || arg2.length > 30)) {
    apiKey = arg2;
  } else if (typeof arg3 === 'string' && (arg3.startsWith('sk_') || arg3.length > 30)) {
    apiKey = arg3;
    if (['hi', 'bn', 'en', 'bhojpuri', 'maithili', 'hi-IN', 'bn-IN', 'en-IN'].includes(arg2)) {
      language = arg2;
    } else {
      speaker = arg2;
    }
  } else {
    if (arg2) language = arg2;
    if (arg3 && !arg3.startsWith('sk_')) speaker = arg3;
    if (arg4) apiKey = arg4;
  }

  // Fallback to valid bulbul:v4-flash speaker if older v2/v3 speaker name (like 'kavya') was passed
  if (speaker === "kavya" || !speaker) {
    speaker = "aarti_hi_customer";
  }

  if (!apiKey) {
    return {
      audio_base64: null,
      is_fallback: true,
      text
    };
  }

  try {
    const client = getSarvamClient(apiKey);
    let cleanText = (text || "").trim();

    // Enforce 480 char boundary for Sarvam Bulbul API
    if (cleanText.length > 480) {
      const cut = cleanText.slice(0, 480);
      const lastPunct = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
      cleanText = lastPunct > 150 ? cut.slice(0, lastPunct + 1) : cut.slice(0, 475) + "...";
    }

    const targetLangCode = getLanguageCode(language);

    const res = await client.textToSpeech.convert({
      text: cleanText,
      target_language_code: targetLangCode,
      speaker: speaker || "aarti_hi_customer",
      model: "bulbul:v4-flash",
      pace: 1,
      speech_sample_rate: 24000
    });

    const audioBase64 = res.audios && res.audios[0] ? res.audios[0] : null;

    return {
      audio_base64: audioBase64,
      is_fallback: false,
      text: cleanText,
      language_code: targetLangCode,
      model: "bulbul:v4-flash"
    };
  } catch (error) {
    console.error("[Sarvam SDK TTS Exception]", error.message);
    return {
      audio_base64: null,
      error: error.message,
      is_fallback: true,
      text
    };
  }
}

/**
 * Convert Text to Speech Stream (as requested in user snippet)
 */
export async function convertSpeechStream(text, language = "hi", speaker = "aarti_hi_customer", apiKey = process.env.SARVAM_API_KEY || DEFAULT_API_KEY) {
  const client = getSarvamClient(apiKey);
  const targetLangCode = getLanguageCode(language);

  return await client.textToSpeech.convertStream({
    text: text,
    target_language_code: targetLangCode,
    speaker: speaker || "aarti_hi_customer",
    model: "bulbul:v4-flash",
    pace: 1,
    speech_sample_rate: 24000
  });
}

/**
 * Speech-to-Text using Sarvam AI Saaras v3 / v4
 */
export async function speechToText(audioBuffer, mimeType = "audio/wav", apiKey = process.env.SARVAM_API_KEY || DEFAULT_API_KEY, languageCode = "hi-IN") {
  const effectiveKey = apiKey || DEFAULT_API_KEY;
  if (!effectiveKey) {
    return {
      transcript: "",
      language_code: languageCode,
      is_fallback: true
    };
  }

  try {
    const client = getSarvamClient(effectiveKey);
    const targetLangCode = getLanguageCode(languageCode);
    const blob = new Blob([audioBuffer], { type: mimeType });

    const res = await client.speechToText.transcribe({
      file: blob,
      model: "saaras:v3",
      languageCode: targetLangCode
    });

    return {
      transcript: res.transcript ? res.transcript.trim() : "",
      language_code: res.language_code || targetLangCode,
      is_fallback: false
    };
  } catch (error) {
    console.error("[Sarvam SDK STT Exception]", error.message);
    return {
      transcript: "",
      error: error.message,
      is_fallback: true
    };
  }
}

/**
 * Indic Dialect & Number Slot Extraction Parser
 * Robust extraction taking into account colloquial vernacular words and dialog step
 */
export function extractSlotsFromSpokenHindi(text, currentQuestionIndex = 0) {
  if (!text || typeof text !== 'string') return {};
  const normalized = text.toLowerCase().trim();
  const slots = {};

  // 1. Age extraction
  const ageMatch = normalized.match(/(\d{1,2})\s*(?:साल|वर्ष|उम्र|age)/i);
  if (ageMatch) {
    const parsedAge = parseInt(ageMatch[1], 10);
    if (parsedAge >= 10 && parsedAge <= 110) {
      slots.age = parsedAge;
    }
  } else if (currentQuestionIndex === 0) {
    const standaloneMatch = normalized.match(/(?:^|\D)(\d{1,2})(?!\s*(?:हजार|हज़ार|लाख|रुप|रू|सौ))(?:\D|$)/);
    if (standaloneMatch) {
      const parsedAge = parseInt(standaloneMatch[1], 10);
      if (parsedAge >= 10 && parsedAge <= 110) {
        slots.age = parsedAge;
      }
    }
  }

  // Hindi number word approximations for age
  if (!slots.age && (currentQuestionIndex === 0 || normalized.includes("उम्र") || normalized.includes("साल"))) {
    if (normalized.includes("चालीस") || normalized.includes("पैंतालीस")) slots.age = 45;
    else if (normalized.includes("अड़तालीस") || normalized.includes("पचास")) slots.age = 49;
    else if (normalized.includes("साठ") || normalized.includes("पैंसठ")) slots.age = 62;
    else if (normalized.includes("तीस") || normalized.includes("पैंतीस")) slots.age = 32;
    else if (normalized.includes("बीस") || normalized.includes("पच्चीस")) slots.age = 24;
  }

  // 2. Marital Status & Gender
  if (
    normalized.includes("विधवा") ||
    normalized.includes("पति गुजर") ||
    normalized.includes("पति नहीं रहे") ||
    normalized.includes("पति की मृत्यु") ||
    normalized.includes("widow")
  ) {
    slots.marital_status = "widow";
    slots.gender = "female";
  } else if (normalized.includes("शादीशुदा") || normalized.includes("विवाहित") || normalized.includes("married")) {
    slots.marital_status = "married";
  } else if (normalized.includes("अकेली") || normalized.includes("कुंवारी") || normalized.includes("single")) {
    slots.marital_status = "single";
  }

  if (normalized.includes("महिला") || normalized.includes("औरत") || normalized.includes("दीदी") || normalized.includes("बहन")) {
    slots.gender = "female";
  } else if (normalized.includes("पुरुष") || normalized.includes("आदमी") || normalized.includes("भाई") || normalized.includes("किसान")) {
    slots.gender = "male";
  }

  // 3. Landholding (ज़मीन)
  if (
    normalized.includes("कोई जमीन नहीं") ||
    normalized.includes("जमीन नहीं है") ||
    normalized.includes("भूमिहीन") ||
    normalized.includes("मजदूरी") ||
    normalized.includes("मजूरी") ||
    normalized.includes("landless") ||
    normalized.includes("0 बीघा") ||
    normalized.includes("शून्य")
  ) {
    slots.landholding_acres = 0.0;
    slots.is_landless = true;
  } else {
    // Check colloquial Hindi fractions: ढाई (2.5), डेढ़ (1.5), आधा (0.5), सवा (1.25)
    if (normalized.includes("ढाई एकड़") || normalized.includes("ढाई एकड") || normalized.includes("ढाई बीघा")) {
      slots.landholding_acres = normalized.includes("बीघा") ? 1.55 : 2.5;
    } else if (normalized.includes("डेढ़ एकड़") || normalized.includes("डेढ़ बीघा")) {
      slots.landholding_acres = normalized.includes("बीघा") ? 0.93 : 1.5;
    } else if (normalized.includes("आधा एकड़") || normalized.includes("आधा बीघा")) {
      slots.landholding_acres = normalized.includes("बीघा") ? 0.31 : 0.5;
    } else {
      const landMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:एकड़|एकड|बीघा|acre|bigha|डिसमिल)/i);
      if (landMatch) {
        let acres = parseFloat(landMatch[1]);
        if (normalized.includes("बीघा")) {
          acres = acres * 0.62;
        }
        slots.landholding_acres = Number(acres.toFixed(2));
      }
    }
  }

  // 4. Income & BPL / Ration Card
  if (
    normalized.includes("बीपीएल") ||
    normalized.includes("पीला कार्ड") ||
    normalized.includes("गुलाबी कार्ड") ||
    normalized.includes("लाल कार्ड") ||
    normalized.includes("अंत्योदय") ||
    normalized.includes("गरीब")
  ) {
    slots.bpl_status = true;
    slots.annual_income_inr = slots.annual_income_inr || 40000;
  }

  // Income numeric patterns: "75 हजार", "4 हजार", "1 लाख"
  const incomeMatch = normalized.match(/(\d+)\s*(हज़ार|हजार|लाख|thousand)?\s*(?:महीना|महीने|साल|कमाई|रुप|रू)?/i);
  if (incomeMatch && (incomeMatch[2] || normalized.includes("कमाई") || normalized.includes("महीने") || normalized.includes("साल") || currentQuestionIndex === 2)) {
    let amt = parseInt(incomeMatch[1], 10);
    const unit = incomeMatch[2];
    if (unit && (unit.includes("लाख"))) amt *= 100000;
    else if (unit && (unit.includes("हजार") || unit.includes("हज़ार"))) amt *= 1000;
    else if (amt < 500 && (normalized.includes("महीना") || normalized.includes("महीने"))) amt *= 1000;

    if (normalized.includes("महीना") || normalized.includes("महीने")) {
      amt *= 12;
    }
    if (amt > 500) {
      slots.annual_income_inr = amt;
    }
  }

  // 5. Children & Daughters
  if (
    normalized.includes("बेटी") ||
    normalized.includes("लड़की") ||
    normalized.includes("कन्या") ||
    normalized.includes("daughter")
  ) {
    slots.has_minor_daughter = true;
  }

  if (
    normalized.includes("कच्चा मकान") ||
    normalized.includes("झोपड़ी") ||
    normalized.includes("घर नहीं है") ||
    normalized.includes("कच्चा घर")
  ) {
    slots.kutcha_house_or_homeless = true;
  }

  if (
    normalized.includes("ठेला") ||
    normalized.includes("रेहड़ी") ||
    normalized.includes("पटरी") ||
    normalized.includes("दुकानदार") ||
    normalized.includes("सब्जी बेचते")
  ) {
    slots.is_informal_worker_or_vendor = true;
  }

  // 6. Location / State
  if (normalized.includes("उत्तर प्रदेश") || normalized.includes("यूपी") || normalized.includes("up")) {
    slots.state = "Uttar Pradesh";
  } else if (normalized.includes("बिहार") || normalized.includes("bihar")) {
    slots.state = "Bihar";
  } else if (normalized.includes("मध्य प्रदेश") || normalized.includes("mp")) {
    slots.state = "Madhya Pradesh";
  }

  return slots;
}
