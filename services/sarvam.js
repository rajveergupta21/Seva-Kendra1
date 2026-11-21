/**
 * Sarvam AI Official SDK Service Integration
 * Uses the official 'sarvamai@1.1.21' npm package.
 * Text-to-Speech: bulbul:v4-flash (speaker: aarti_hi_customer, 24kHz)
 * Speech-to-Text: saaras:v3 (REST & WebSocket Streaming)
 */

import { SarvamAIClient } from 'sarvamai';
import './env_loader.js';

let cachedClient = null;

/**
 * Validates and retrieves the singleton SarvamAIClient instance.
 * Fails fast if SARVAM_API_KEY is missing. Never prints key to logs.
 */
export function getSarvamClient(customKey) {
  const apiKey = customKey || process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("FATAL: SARVAM_API_KEY environment variable is missing. Please set it in your .env or environment.");
  }

  if (!cachedClient || (customKey && cachedClient._options?.apiSubscriptionKey !== customKey)) {
    cachedClient = new SarvamAIClient({
      apiSubscriptionKey: apiKey
    });
  }
  return cachedClient;
}

/**
 * Maps incoming dialect/language strings to official Sarvam BCP-47 language_code for STT
 * Exact SDK options: 'hi-IN', 'bn-IN', 'en-IN', 'mai-IN', 'unknown'
 */
export function getSttLanguageCode(lang = "hi") {
  if (!lang) return "unknown";
  const lower = String(lang).toLowerCase().trim();

  if (lower === "bn" || lower === "bn-in" || lower.includes("bengali") || lower.includes("bangla")) {
    return "bn-IN";
  }
  if (lower === "en" || lower === "en-in" || lower.includes("english")) {
    return "en-IN";
  }
  if (lower === "mai" || lower === "mai-in" || lower.includes("maithili")) {
    return "mai-IN";
  }
  if (lower === "hi" || lower === "hi-in" || lower.includes("hindi")) {
    return "hi-IN";
  }
  if (lower.includes("bhojpuri")) {
    // Sarvam STT supports Hindi dialect model for Bhojpuri, or 'unknown' for auto-detect
    return "hi-IN";
  }
  if (lower === "unknown") {
    return "unknown";
  }

  // Uncertain language -> auto-detect
  return "unknown";
}

/**
 * Maps language to Sarvam TTS target_language_code
 */
export function getTtsLanguageCode(lang = "hi") {
  if (!lang) return "hi-IN";
  const lower = String(lang).toLowerCase().trim();
  if (lower === "bn" || lower === "bn-in" || lower.includes("bengali")) return "bn-IN";
  if (lower === "en" || lower === "en-in" || lower.includes("english")) return "en-IN";
  // Hindi, Bhojpuri, Maithili are synthesized via hi-IN speaker
  return "hi-IN";
}

/**
 * Splits text into natural spoken sentences for streaming TTS
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  // Match Indic Danda (।), period, question mark, exclamation, or newline
  const rawParts = text.split(/(?<=[।\.\?!;:\n])\s+/);
  const sentences = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      // Keep individual sentences under 450 chars for Bulbul v4 limit
      if (trimmed.length > 450) {
        const sub = trimmed.match(/.{1,400}(?:\s+|$)/g) || [trimmed];
        sentences.push(...sub.map(s => s.trim()).filter(Boolean));
      } else {
        sentences.push(trimmed);
      }
    }
  }
  return sentences.length > 0 ? sentences : [text.trim()];
}

/**
 * REST Text-to-Speech using Sarvam AI Bulbul v4-flash
 */
export async function textToSpeech(text, arg2 = "hi", arg3 = "aarti_hi_customer", arg4 = undefined) {
  let language = "hi";
  let speaker = "aarti_hi_customer";
  let apiKey = process.env.SARVAM_API_KEY;

  if (typeof arg2 === 'string' && (arg2.startsWith('sk_') || arg2.length > 30)) {
    apiKey = arg2;
  } else if (typeof arg3 === 'string' && (arg3.startsWith('sk_') || arg3.length > 30)) {
    apiKey = arg3;
    language = arg2 || "hi";
  } else {
    if (arg2) language = arg2;
    if (arg3 && !arg3.startsWith('sk_')) speaker = arg3;
    if (arg4) apiKey = arg4;
  }

  if (speaker === "kavya" || !speaker) {
    speaker = "aarti_hi_customer";
  }

  try {
    const client = getSarvamClient(apiKey);
    let cleanText = (text || "").trim();

    if (cleanText.length > 480) {
      const cut = cleanText.slice(0, 480);
      const lastPunct = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
      cleanText = lastPunct > 150 ? cut.slice(0, lastPunct + 1) : cut.slice(0, 475) + "...";
    }

    const targetLangCode = getTtsLanguageCode(language);

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
    console.error("[Sarvam SDK TTS Error]", error.statusCode || error.message);
    return {
      audio_base64: null,
      error: error.message,
      is_fallback: true,
      text
    };
  }
}

/**
 * Streaming TTS: Returns a BinaryResponse stream using client.textToSpeech.convertStream
 */
export async function convertSpeechStream(text, language = "hi", speaker = "aarti_hi_customer", apiKey = process.env.SARVAM_API_KEY) {
  const client = getSarvamClient(apiKey);
  const targetLangCode = getTtsLanguageCode(language);

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
 * REST Speech-to-Text using Sarvam AI Saaras v3
 * NOTE: The SDK field is `language_code` (NOT `languageCode`).
 */
export async function speechToText(audioBuffer, mimeType = "audio/wav", apiKey = process.env.SARVAM_API_KEY, languageCode = "hi-IN") {
  try {
    const client = getSarvamClient(apiKey);
    const targetLangCode = getSttLanguageCode(languageCode);
    const blob = new Blob([audioBuffer], { type: mimeType });

    // EXACT SDK FIELD: language_code
    const res = await client.speechToText.transcribe({
      file: blob,
      model: "saaras:v3",
      language_code: targetLangCode
    });

    return {
      transcript: res.transcript ? res.transcript.trim() : "",
      language_code: res.language_code || targetLangCode,
      is_fallback: false,
      raw: res
    };
  } catch (error) {
    const httpStatus = error.statusCode || error.status || 500;
    console.error(`[Sarvam SDK STT Error] HTTP ${httpStatus}: ${error.message}`);
    return {
      transcript: "",
      error: error.message,
      statusCode: httpStatus,
      is_fallback: true
    };
  }
}

/**
 * Realtime Streaming Speech-to-Text Session over Sarvam WebSocket
 */
export async function createSttStreamingSession({
  languageCode = "hi-IN",
  apiKey = process.env.SARVAM_API_KEY,
  onPartial = () => {},
  onFinal = () => {},
  onError = () => {}
}) {
  const client = getSarvamClient(apiKey);
  const targetLangCode = getSttLanguageCode(languageCode);

  try {
    const socket = await client.speechToTextStreaming.connect({
      "language-code": targetLangCode,
      model: "saaras:v3",
      input_audio_codec: "wav",
      sample_rate: "16000"
    });

    await socket.waitForOpen();

    let fullTranscript = "";

    socket.on("message", (msg) => {
      if (msg.type === "data" && msg.data) {
        const text = (msg.data.transcript || "").trim();
        if (text) {
          fullTranscript = text;
          onPartial(text);
        }
      } else if (msg.type === "error") {
        console.error("[Sarvam Streaming STT Socket Error Message]", msg.data);
        onError(new Error(msg.data?.message || "Streaming STT error"));
      }
    });

    socket.on("error", (err) => {
      console.error("[Sarvam Streaming STT Socket Error]", err.message);
      onError(err);
    });

    return {
      sendAudioPcmChunk(pcmBase64) {
        if (socket.readyState === 1) { // OPEN
          socket.transcribe({
            audio: pcmBase64,
            sample_rate: 16000,
            encoding: "audio/wav"
          });
        }
      },
      flush() {
        if (socket.readyState === 1) {
          socket.flush();
        }
      },
      close() {
        try {
          socket.close();
        } catch (e) {}
      },
      getTranscript() {
        return fullTranscript;
      }
    };
  } catch (err) {
    console.error("[Sarvam Streaming STT Connection Error]", err.message);
    throw err;
  }
}

/**
 * Indic Dialect & Number Slot Extraction Parser
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
