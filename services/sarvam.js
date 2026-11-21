/**
 * Sarvam AI Service Integration
 * Speech-to-Text (Saarika v2), Text-to-Speech (Bulbul v2), and Indic Slot Extraction
 */

const SARVAM_API_BASE = "https://api.sarvam.ai";

/**
 * Speech-to-Text using Sarvam AI Saarika v2
 */
export async function speechToText(audioBuffer, mimeType = "audio/wav", apiKey = process.env.SARVAM_API_KEY) {
  if (!apiKey) {
    return {
      transcript: "हम 48 साल के हैं, हमारे पति नहीं रहे और हमारे पास कोई ज़मीन नहीं है।",
      language_code: "hi-IN",
      is_fallback: true
    };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append("file", blob, "recording.wav");
    formData.append("model", "saarika:v2");
    formData.append("language_code", "hi-IN");

    const res = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sarvam STT error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      transcript: data.transcript || "",
      language_code: data.language_code || "hi-IN",
      is_fallback: false
    };
  } catch (error) {
    console.error("[Sarvam STT Exception]", error.message);
    return {
      transcript: "",
      error: error.message,
      is_fallback: true
    };
  }
}

/**
 * Text-to-Speech using Sarvam AI Bulbul v2
 */
export async function textToSpeech(text, speaker = "kavya", apiKey = process.env.SARVAM_API_KEY) {
  if (!apiKey) {
    return {
      audio_base64: null,
      is_fallback: true,
      text
    };
  }

  try {
    const payload = {
      inputs: [text],
      target_language_code: "hi-IN",
      speaker: speaker,
      pace: 0.95,
      speech_sample_rate: 16000,
      enable_preprocessing: true,
      model: "bulbul:v2"
    };

    const res = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sarvam TTS error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const audioBase64 = data.audios && data.audios[0] ? data.audios[0] : null;

    return {
      audio_base64: audioBase64,
      is_fallback: false,
      text
    };
  } catch (error) {
    console.error("[Sarvam TTS Exception]", error.message);
    return {
      audio_base64: null,
      error: error.message,
      is_fallback: true,
      text
    };
  }
}

/**
 * Indic Dialect & Number Slot Extraction Parser
 * Robust extraction taking into account colloquial vernacular words and dialog step
 */
export function extractSlotsFromSpokenHindi(text, currentQuestionIndex = 0) {
  const normalized = text.toLowerCase().trim();
  const slots = {};

  // 1. Age extraction
  // Only extract age if followed by age words, or during Step 0 (Age question)
  const ageMatch = normalized.match(/(\d{1,2})\s*(?:साल|वर्ष|उम्र|age)/i);
  if (ageMatch) {
    const parsedAge = parseInt(ageMatch[1], 10);
    if (parsedAge >= 10 && parsedAge <= 110) {
      slots.age = parsedAge;
    }
  } else if (currentQuestionIndex === 0) {
    // If during age question and starts with number not followed by thousand/lakh
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
    else if (amt < 500 && (normalized.includes("महीना") || normalized.includes("महीने"))) amt *= 1000; // e.g. "3-4 हजार"

    // If monthly
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
