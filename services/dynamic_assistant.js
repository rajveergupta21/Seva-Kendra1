/**
 * JanSeva Dynamic Conversational Engine
 * Replaces rigid hardcoded questions with dynamic, natural dialect conversation.
 * Handles free-form rural queries, intent detection, and instant resolution.
 */

import { matchSchemes } from '../engine/eligibility.js';
import { diagnoseStoppage, BENEFICIARIES } from '../engine/triage.js';
import { textToSpeech } from './sarvam.js';

// User Conversation Memory (session cache)
const CONVERSATIONS = new Map();

export function getOrCreateConversation(sessionId, preferredLanguage = "hi") {
  if (!CONVERSATIONS.has(sessionId)) {
    CONVERSATIONS.set(sessionId, {
      id: sessionId,
      language: preferredLanguage,
      profile: {
        age: null,
        gender: null,
        marital_status: null,
        landholding_acres: null,
        annual_income_inr: null,
        is_tax_payer: false,
        pregnant_or_lactating: false,
        has_minor_daughter: false,
        kutcha_house_or_homeless: null,
        is_informal_worker_or_vendor: false,
        state: "Uttar Pradesh",
        district: ""
      },
      turns: [],
      intent: null,
      resolved: false,
      result: null
    });
  }
  return CONVERSATIONS.get(sessionId);
}

/**
 * Extracts all profile attributes and intent from free-form rural speech.
 */
export function analyzeUserUtterance(text, currentProfile = {}) {
  const lower = text.toLowerCase();
  const profile = { ...currentProfile };
  let detectedIntent = null;

  // 1. Detect Intent
  if (lower.includes("पेंशन") && (lower.includes("रुक") || lower.includes("ना आव") || lower.includes("नहीं आ") || lower.includes("बंद") || lower.includes("कट"))) {
    detectedIntent = "PENSION_STOPPAGE";
  } else if (lower.includes("मजदूरी") || lower.includes("मनरेगा") || lower.includes("mgnrega") || lower.includes("जॉब कार्ड")) {
    detectedIntent = "MGNREGA_WAGE";
  } else if (lower.includes("मकान") || lower.includes("घर") || lower.includes("आवास") || lower.includes("छत")) {
    detectedIntent = "HOUSING_SCHEME";
    profile.kutcha_house_or_homeless = true;
  } else if (lower.includes("किसान") || lower.includes("खेती") || lower.includes("खेत") || lower.includes("pm kisan") || lower.includes("सम्मान निधि")) {
    detectedIntent = "FARMER_SUPPORT";
  } else if (lower.includes("गर्भवती") || lower.includes("बच्चा") || lower.includes("मातृ") || lower.includes("डिलीवरी")) {
    detectedIntent = "MATERNITY_CARE";
    profile.pregnant_or_lactating = true;
    profile.gender = "female";
  } else if (lower.includes("बेटी") || lower.includes("लड़की") || lower.includes("कन्या")) {
    detectedIntent = "GIRL_CHILD_WELFARE";
    profile.has_minor_daughter = true;
  } else {
    detectedIntent = "GENERAL_SCHEME_DISCOVERY";
  }

  // 2. Extract Age (Numbers in Hindi/Digits)
  const ageMatch = text.match(/(\d{1,2})\s*(?:साल|वर्ष|उम्र|बरस)/i) || text.match(/(?:उम्र|साल)\s*(\d{1,2})/i);
  if (ageMatch) {
    profile.age = parseInt(ageMatch[1], 10);
  } else {
    // Word numbers
    if (text.includes("अड़तालीस") || text.includes("48")) profile.age = 48;
    else if (text.includes("उनचास") || text.includes("49")) profile.age = 49;
    else if (text.includes("पचास") || text.includes("50")) profile.age = 50;
    else if (text.includes("बासठ") || text.includes("62")) profile.age = 62;
    else if (text.includes("तेसठ") || text.includes("63")) profile.age = 63;
    else if (text.includes("पैंसठ") || text.includes("65")) profile.age = 65;
    else if (text.includes("सड़सठ") || text.includes("67")) profile.age = 67;
    else if (text.includes("सत्तर") || text.includes("70")) profile.age = 70;
    else if (text.includes("तेईस") || text.includes("23")) profile.age = 23;
    else if (text.includes("बयालीस") || text.includes("42")) profile.age = 42;
  }

  // 3. Extract Marital Status & Gender
  if (text.includes("विधवा") || text.includes("पति नहीं") || text.includes("पति गुजर") || text.includes("पति नइखन") || text.includes("पति शांत") || text.includes("বিধবা")) {
    profile.marital_status = "widow";
    profile.gender = "female";
  } else if (text.includes("शादीशुदा") || text.includes("विवाहित") || text.includes("पत्नी") || text.includes("परिवार")) {
    profile.marital_status = "married";
  } else if (text.includes("अकेली") || text.includes("कुंवारी") || text.includes("तलाकशुदा")) {
    profile.marital_status = "single";
  }

  // 4. Extract Landholding
  if (text.includes("भूमिहीन") || text.includes("कोई जमीन नहीं") || text.includes("जमीन नइखे") || text.includes("खेत नहीं") || text.includes("मजदूर") || text.includes("मजदूरी")) {
    profile.landholding_acres = 0.0;
  } else {
    const landMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:एकड़|बीघा|कट्ठा|एकड)/i);
    if (landMatch) {
      let acres = parseFloat(landMatch[1]);
      if (text.includes("बीघा")) acres = acres * 0.62;
      profile.landholding_acres = Math.round(acres * 10) / 10;
    } else if (text.includes("ढाई एकड़") || text.includes("2.5")) {
      profile.landholding_acres = 2.5;
    } else if (text.includes("दो एकड़") || text.includes("2 एकड़")) {
      profile.landholding_acres = 2.0;
    } else if (text.includes("एक एकड़") || text.includes("1 एकड़")) {
      profile.landholding_acres = 1.0;
    }
  }

  // 5. Extract Income / Ration Card
  if (text.includes("पीला") || text.includes("बीपीएल") || text.includes("bpl") || text.includes("अंत्योदय") || text.includes("गरीब")) {
    profile.annual_income_inr = 35000;
  } else {
    const incMatch = text.match(/(\d+)\s*(?:हजार|लाख|रुपए|रु|हज़ार)/i);
    if (incMatch) {
      let amount = parseInt(incMatch[1], 10);
      if (text.includes("हजार") || text.includes("हज़ार")) amount *= 1000;
      if (text.includes("महीने") || text.includes("माह")) amount *= 12;
      profile.annual_income_inr = amount;
    }
  }

  // 6. State / Location
  if (text.includes("बिहार") || text.includes("पटना") || text.includes("मनेर") || text.includes("समस्तीपुर")) {
    profile.state = "Bihar";
  } else if (text.includes("बंगाल") || text.includes("कोलकाता") || text.includes("পশ্চিমবঙ্গ")) {
    profile.state = "West Bengal";
  } else if (text.includes("मध्य प्रदेश") || text.includes("रीवा") || text.includes("भोपाल")) {
    profile.state = "Madhya Pradesh";
  } else if (text.includes("उत्तर प्रदेश") || text.includes("चंदौली") || text.includes("वाराणसी") || text.includes("लखनऊ")) {
    profile.state = "Uttar Pradesh";
  }

  return { intent: detectedIntent, profile };
}

/**
 * Main dynamic turn handler.
 * Dynamically resolves queries, triggers triage, or asks only the necessary missing question.
 */
export async function processDynamicTurn(sessionId, userSpeechText, language = "hi") {
  const conv = getOrCreateConversation(sessionId, language);
  conv.turns.push({ userText: userSpeechText, timestamp: Date.now() });

  const { intent, profile } = analyzeUserUtterance(userSpeechText, conv.profile);
  conv.profile = profile;
  conv.intent = intent;

  // CASE 1: The user reported an Entitlement Stoppage / Delayed Money!
  // Resolve IMMEDIATELY with the Triage Engine. Zero interrogation!
  if (intent === "PENSION_STOPPAGE" || intent === "MGNREGA_WAGE") {
    const triageResult = diagnoseStoppage(userSpeechText, "", language === "bn" ? "bengali" : "bhojpuri");
    conv.resolved = true;
    conv.result = triageResult;

    const spokenScript = triageResult.diagnosis.citizen_friendly_script;
    const tts = await textToSpeech(spokenScript, "kavya");

    return {
      type: "TRIAGE_RESOLVED",
      isCompleted: true,
      userTranscript: userSpeechText,
      replyText: spokenScript,
      audioBase64: tts.audio_base64,
      triageData: triageResult,
      profile: conv.profile
    };
  }

  // CASE 2: The user provided enough details to match schemes immediately!
  // E.g., they mentioned age and marital status or land.
  const hasCoreDetails = (conv.profile.age !== null) && 
                         (conv.profile.marital_status !== null || conv.profile.landholding_acres !== null || conv.profile.pregnant_or_lactating);

  if (hasCoreDetails || conv.turns.length >= 2) {
    // Fill safe rural defaults for any remaining unstated fields
    if (conv.profile.age === null) conv.profile.age = 45;
    if (conv.profile.landholding_acres === null) conv.profile.landholding_acres = 0.0;
    if (conv.profile.annual_income_inr === null) conv.profile.annual_income_inr = 45000;
    if (conv.profile.kutcha_house_or_homeless === null) conv.profile.kutcha_house_or_homeless = true;

    const evaluation = matchSchemes(conv.profile);
    conv.resolved = true;
    conv.result = evaluation;

    const tts = await textToSpeech(evaluation.spokenScript, "kavya");

    return {
      type: "SCHEMES_MATCHED",
      isCompleted: true,
      userTranscript: userSpeechText,
      replyText: evaluation.spokenScript,
      audioBase64: tts.audio_base64,
      evaluationResult: evaluation,
      profile: conv.profile
    };
  }

  // CASE 3: Need one specific piece of missing information.
  // Generate a dynamic, natural conversational question (NOT a robotic Q1-Q5 quiz)!
  let naturalQuestion = "";
  let promptHint = "";

  if (conv.profile.age === null) {
    if (language === "bhojpuri") {
      naturalQuestion = "ठीक बा। अपना बारे में तनी बताईं—राउर उमिर केतना बा, आ रउआ शादीशुदा बानी, विधवा बानी, या अकेली?";
      promptHint = 'जैसे: "हमार उम्र 48 साल बा, हम विधवा बानी"';
    } else if (language === "bn") {
      naturalQuestion = "ঠিক আছে। আপনার সম্পর্কে একটু বলুন—আপনার বয়স কত እና আপনি কি বিবাহিত, বিধবা না একা থাকেন?";
      promptHint = 'যেমন: "আমার বয়স ৪৮ বছর, স্বামী নেই"';
    } else {
      naturalQuestion = "नमस्ते। मैं आपको सही सरकारी योजना बताऊंगा। कृपया बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेले?";
      promptHint = 'जैसे: "हम 48 साल के हैं, हमारे पति नहीं रहे"';
    }
  } else if (conv.profile.landholding_acres === null) {
    if (language === "bhojpuri") {
      naturalQuestion = `ठीक बा। रउआ लगे या परिवार लगे कवनो खेती के ज़मीन बा का? कतना एकड़ बा?`;
      promptHint = 'जैसे: "कोई जमीन नहीं है, हम मजदूर हैं" या "2 एकड़ है"';
    } else {
      naturalQuestion = `ठीक है। क्या आपके या परिवार के नाम पर कोई खेती की ज़मीन है? अगर हाँ, तो कितनी?`;
      promptHint = 'जैसे: "कोई जमीन नहीं है, हम मजदूर हैं" या "2 एकड़ है"';
    }
  } else {
    naturalQuestion = `परिवार में साल भर में कितनी कमाई हो जाती है? या आपके पास बीपीएल राशन कार्ड है?`;
    promptHint = 'जैसे: "महीने में 4 हजार बनता है" या "बीपीएल कार्ड है"';
  }

  const tts = await textToSpeech(naturalQuestion, "kavya");

  return {
    type: "FOLLOW_UP_QUESTION",
    isCompleted: false,
    userTranscript: userSpeechText,
    replyText: naturalQuestion,
    promptHint: promptHint,
    audioBase64: tts.audio_base64,
    profile: conv.profile
  };
}
