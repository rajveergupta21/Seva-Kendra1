/**
 * Conversational State Machine for JanKalyan Voice Gateway
 * Manages the 5 Spoken Questions and Dialog Transitions
 */

import { extractSlotsFromSpokenHindi, textToSpeech } from './sarvam.js';
import { matchSchemes } from '../engine/eligibility.js';

export const QUESTIONS = [
  {
    index: 0,
    field: "age_and_marital",
    spoken_hi: "नमस्ते दीदी। मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। सबसे पहले बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेली हैं?",
    hint: "जैसे: 'हम 48 साल के हैं, हमारे पति नहीं रहे'"
  },
  {
    index: 1,
    field: "landholding",
    spoken_hi: "क्या आपके या आपके परिवार के नाम पर कोई खेती की ज़मीन है? अगर हाँ, तो कितनी?",
    hint: "जैसे: 'हमारे पास कोई ज़मीन नहीं है, हम मजदूरी करते हैं' या '2 बीघा है'"
  },
  {
    index: 2,
    field: "income_ration",
    spoken_hi: "आपके परिवार की साल भर की कुल कमाई कितनी हो जाती है? या आपके पास कौन से रंग का राशन कार्ड है—पीला, गुलाबी या सफेद?",
    hint: "जैसे: 'महीने में 4 हजार बनता है' या 'पीला बीपीएल राशन कार्ड है'"
  },
  {
    index: 3,
    field: "family_children",
    spoken_hi: "घर में कितने बच्चे हैं दीदी? क्या कोई 18 साल से कम उम्र की बेटी या पढ़ने वाले बच्चे हैं?",
    hint: "जैसे: 'दो बेटियां हैं, स्कूल जाती हैं'"
  },
  {
    index: 4,
    field: "location",
    spoken_hi: "आखिरी सवाल दीदी, आप किस राज्य और जिले में रहती हैं?",
    hint: "जैसे: 'उत्तर प्रदेश, चंदौली' या 'बिहार, समस्तीपुर'"
  }
];

// In-Memory Session Cache (keyed by session_id or phone_number)
const SESSIONS = new Map();

export function getOrCreateSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      id: sessionId,
      currentStep: 0,
      profile: {
        age: null,
        gender: "female",
        marital_status: null,
        landholding_acres: 0.0,
        annual_income_inr: 50000,
        is_tax_payer: false,
        pregnant_or_lactating: false,
        has_minor_daughter: false,
        kutcha_house_or_homeless: true,
        is_informal_worker_or_vendor: false,
        state: "Uttar Pradesh",
        district: ""
      },
      history: [],
      isCompleted: false,
      evaluationResult: null,
      createdAt: Date.now()
    });
  }
  return SESSIONS.get(sessionId);
}

/**
 * Advances dialog state based on user spoken or transcribed input
 */
export async function processDialogTurn(sessionId, userSpeechText) {
  const session = getOrCreateSession(sessionId);

  // If already completed, return cached evaluation
  if (session.isCompleted) {
    return {
      session,
      isCompleted: true,
      nextPromptText: session.evaluationResult.spokenScript,
      evaluationResult: session.evaluationResult
    };
  }

  // 1. Extract slots from user utterance
  const extracted = extractSlotsFromSpokenHindi(userSpeechText, session.currentStep);
  Object.assign(session.profile, extracted);

  session.history.push({
    step: session.currentStep,
    userText: userSpeechText,
    extractedSlots: extracted,
    timestamp: Date.now()
  });

  // 2. Advance to next question
  session.currentStep += 1;

  // 3. Check if all questions completed
  if (session.currentStep >= QUESTIONS.length) {
    session.isCompleted = true;
    session.evaluationResult = matchSchemes(session.profile);

    // Generate Bulbul TTS audio for final spoken result
    const ttsResult = await textToSpeech(session.evaluationResult.spokenScript);

    return {
      session,
      isCompleted: true,
      nextPromptText: session.evaluationResult.spokenScript,
      ttsAudioBase64: ttsResult.audio_base64,
      evaluationResult: session.evaluationResult
    };
  }

  // Prepare next question prompt
  const nextQ = QUESTIONS[session.currentStep];
  const ttsResult = await textToSpeech(nextQ.spoken_hi);

  return {
    session,
    isCompleted: false,
    nextQuestionIndex: session.currentStep,
    nextPromptText: nextQ.spoken_hi,
    nextPromptHint: nextQ.hint,
    ttsAudioBase64: ttsResult.audio_base64
  };
}

/**
 * Resets a session
 */
export function resetSession(sessionId) {
  SESSIONS.delete(sessionId);
  return getOrCreateSession(sessionId);
}
