/**
 * Seva Kendra (सेवा केंद्र) - Master Client Application
 * Low-Latency Voice Gateway, AudioWorklet 16kHz Streaming, VAD Conversation Mode,
 * Single Unlocked Audio, Barge-in Support, and Edge Telemetry
 */

const API_BASE = window.location.origin;
let currentSessionId = `session_${Date.now()}`;
let currentLanguage = 'hi';

// Audio Playback Management: Single persistent unlocked <audio> element
let masterAudio = null;
let isAudioUnlocked = false;
let isAssistantSpeaking = false;
let currentPromptAudioUrl = null;
let currentPromptAudioBase64 = null;
let currentSpokenAudioUrl = null;
let currentSpokenAudioBase64 = null;
let currentTriageAudioUrl = null;
let currentTriageScriptText = "";

// AudioWorklet & Web Audio Capture State
let audioCtx = null;
let rawMicStream = null;
let mediaStreamSource = null;
let workletNode = null;
let isAudioCapturing = false;
let isRecording = false;
window.isRecording = false;
window.isAudioCapturing = false;

// Audio Buffer Accumulator (for REST fallback & RMS analysis)
let accumulatedPcmBuffers = [];
let totalRecordedBytes = 0;
let userHasSpokenInTurn = false;
let consecutiveSilenceMs = 0;

// VAD & Turn Configuration
const VAD_SPEECH_RMS_THRESHOLD = 0.012;
const VAD_SILENCE_RMS_THRESHOLD = 0.007;
const VAD_SILENCE_LIMIT_MS = 800; // 800ms silence = End of Speech
const BARGE_IN_RMS_THRESHOLD = 0.030; // Voice loudness to interrupt assistant

// WebSocket Streaming State
let ws = null;
let isWsConnected = false;
let clientSpeechEndTimestamp = null;
let pendingTurnId = null;

// Conversation Mode (Hands-Free Listening after assistant finishes)
let isConversationModeActive = false;

// Latency Instrumentation
let lastTurnMetrics = null;

// Verified Schemes Cache
let allLoadedSchemes = [];

// --------------------------------------------------------------------------
// 1. Comprehensive Multilingual UI Dictionary (i18n)
// --------------------------------------------------------------------------
const I18N_TRANSLATIONS = {
  hi: {
    langName: "हिन्दी",
    sttCode: "hi-IN",
    brandName: "सेवा केंद्र (Seva Kendra)",
    brandTagline: "ग्रामीण नागरिक कल्याण एवं योजना सहायता",
    menuBtnText: "अन्य सेवाएं",
    heroTitle: "बोलकर जानिए अपने हक की सरकारी योजनाएं",
    heroSubtitle: "बिना किसी फॉर्म या दलाल के — सिर्फ अपनी मातृभाषा में बोलें और तुरंत लाभ व ज़रूरी कागज़ जानें।",
    assistantTag: "सेवा केंद्र वाणी सहायक:",
    welcomePrompt: "नमस्ते, सेवा केंद्र में आपका स्वागत है। बताइए, आप किस योजना के बारे में जानना चाहते हैं, या अपनी उम्र और स्थिति बताइए?",
    welcomeHint: '💡 माइक बटन दबाएं और अपनी उम्र, स्थिति या किसी भी योजना के बारे में बोलें',
    micLabelIdle: "बोलने के लिए दबाएं",
    micLabelRecording: "सुन रहे हैं (बोलें...)",
    micStatusIdle: "बटन दबाकर अपनी मातृभाषा में बोलें",
    micStatusListening: "🎙️ सुन रहे हैं... कृपया बोलिए (रुकने पर अपने-आप उत्तर मिलेगा)",
    micStatusProcessing: "जांच की जा रही है...",
    manualPlaceholder: "या यहाँ बोलकर/लिखकर बताएं...",
    sendBtn: "जवाब भेजें ➔",
    chipsLabel: "⚡ बोलकर पूछने के उदाहरण:",
    slotsTitle: "📋 आपकी सत्यापित जानकारी (Verified Profile):",
    slotAgeLabel: "उम्र:",
    slotMaritalLabel: "वैवाहिक स्थिति:",
    slotLandLabel: "खेती की ज़मीन:",
    slotIncomeLabel: "सालाना कमाई:",
    slotStateLabel: "राज्य/जिला:",
    resultsTitle: "🎉 आपके लिए स्वीकृत सरकारी योजनाएं",
    voiceExpTitle: "🔊 वाणी समाधान (Spoken Solution):",
    triadSchemesTitle: "💰 1. मिलने वाली योजनाएं",
    triadDocsTitle: "📂 2. सिर्फ ये 3 कागज़ ले जाएं",
    triadOfficeTitle: "📍 3. यहाँ जाकर जमा करें",
    smsSlipTitle: "📱 आपके मोबाइल पर भेजा गया SMS (पंचायत ऑपरेटर को दिखाएं)",
    drawerHeading: "अतिरिक्त सेवाएं व टूल्स",
    langModalTitle: "अपनी भाषा चुनें / Select Language",
    langModalSub: "आप सेवा केंद्र से किस भाषा में बात करना चाहते हैं?"
  },
  bhojpuri: {
    langName: "भोजपुरी",
    sttCode: "hi-IN",
    brandName: "सेवा केंद्र (Seva Kendra)",
    brandTagline: "गाँव-जवार कल्याण आ योजना सहायता केंद्र",
    menuBtnText: "अउरी सेवा",
    heroTitle: "बोल के जानीं अपना हक के सरकारी योजना",
    heroSubtitle: "बिना कवनो फॉर्म या दलाल के — अपना बोली में बताईं आ तुरंत लाभ आ कागजात जानीं।",
    assistantTag: "सेवा केंद्र वाणी सहायक:",
    welcomePrompt: "प्रणाम, सेवा केंद्र में राउर स्वागत बा। बताईं, राउर कवनो योजना के बारे में जाने के बा, या उमिर केतना बा?",
    welcomeHint: '💡 माइक दबाईं आ आपन उमिर, स्थिति या कवनो योजना के बारे में बोलीं',
    micLabelIdle: "बोले खातिर दबाईं",
    micLabelRecording: "सुनत बानी (बोलीं...)",
    micStatusIdle: "बटन दबाके अपना बोली में बोलीं",
    micStatusListening: "🎙️ सुनत बानी... बोलीं (रुकला पर अपने-आप जवाब मिली)",
    micStatusProcessing: "जांच हो रहल बा...",
    manualPlaceholder: "या इहाँ बोल के/लिख के बताईं...",
    sendBtn: "भेजीं ➔",
    chipsLabel: "⚡ बोल के पूछे के उदाहरण:",
    slotsTitle: "📋 राउर जाँचल जानकारी (Verified Profile):",
    slotAgeLabel: "उमिर:",
    slotMaritalLabel: "वैवाहिक स्थिति:",
    slotLandLabel: "खेती के ज़मीन:",
    slotIncomeLabel: "सालाना कमाई:",
    slotStateLabel: "राज्य/जिला:",
    resultsTitle: "🎉 राउर मंजूर भइल सरकारी योजना",
    voiceExpTitle: "🔊 वाणी समाधान (Spoken Solution):",
    triadSchemesTitle: "💰 1. मिले वाला योजना",
    triadDocsTitle: "📂 2. बस ई 3 गो कागजात ले जाईं",
    triadOfficeTitle: "📍 3. इहाँ जाके जमा करीं",
    smsSlipTitle: "📱 राउर मोबाइल पर भेजल SMS (पंचायत में देखाईं)",
    drawerHeading: "अउरी सेवा आ टूल्स",
    langModalTitle: "भाषा चुनीं / Select Language",
    langModalSub: "रउआ सेवा केंद्र से कवन भाषा में बात करल चाहत बानी?"
  },
  bn: {
    langName: "বাংলা",
    sttCode: "bn-IN",
    brandName: "সেবা কেন্দ্র (Seva Kendra)",
    brandTagline: "গ্রামীণ নাগরিক কল্যাণ ও সরকারি প্রকল্প সহায়তা কেন্দ্র",
    menuBtnText: "অন্যান্য পরিষেবা",
    heroTitle: "মুখে বলে জানুন আপনার প্রাপ্য সরকারি প্রকল্প",
    heroSubtitle: "কোনো ফর্ম বা দালাল ছাড়াই — নিজের ভাষায় বলুন এবং সাথে সাথে সুবিধা ও প্রয়োজনীয় নথি জানুন।",
    assistantTag: "সেবা কেন্দ্র কন্ঠ সহকারী:",
    welcomePrompt: "নমস্কার, সেবা কেন্দ্রে আপনাকে স্বাগত। বলুন, আপনার বয়স কত বা কোন প্রকল্প সম্পর্কে জানতে চান?",
    welcomeHint: '💡 মাইক টিপুন এবং আপনার বয়স বা যেকোনো প্রকল্পের বিষয়ে বলুন',
    micLabelIdle: "বলার জন্য চাপুন",
    micLabelRecording: "শুনছি (বলুন...)",
    micStatusIdle: "বোতাম চেপে নিজের ভাষায় বলুন",
    micStatusListening: "🎙️ শুনছি... বলুন (থামলে স্বয়ংক্রিয় উত্তর আসবে)",
    micStatusProcessing: "যাচাই করা হচ্ছে...",
    manualPlaceholder: "অথবা এখানে লিখে/বলে জানান...",
    sendBtn: "পাঠান ➔",
    chipsLabel: "⚡ বলে জানার উদাহরণ:",
    slotsTitle: "📋 আপনার যাচাইকৃত তথ্য (Verified Profile):",
    slotAgeLabel: "বয়স:",
    slotMaritalLabel: "বৈবাহিক অবস্থা:",
    slotLandLabel: "চাষের জমি:",
    slotIncomeLabel: "বার্ষিক আয়:",
    slotStateLabel: "রাজ্য/জেলা:",
    resultsTitle: "🎉 আপনার জন্য অনুমোদিত সরকারি প্রকল্পসমূহ",
    voiceExpTitle: "🔊 সমাধান (Spoken Solution):",
    triadSchemesTitle: "💰 ১. প্রাপ্যতা প্রকল্পসমূহ",
    triadDocsTitle: "📂 ২. শুধুমাত্র এই ৩টি নথি সাথে নিন",
    triadOfficeTitle: "📍 ৩. এখানে গিয়ে জমা দিন",
    smsSlipTitle: "📱 আপনার মোবাইলে পাঠানো SMS (পঞ্চায়েতে দেখান)",
    drawerHeading: "অতিরিক্ত পরিষেবা ও টুলস",
    langModalTitle: "ভাষা নির্বাচন করুন / Select Language",
    langModalSub: "আপনি সেবা কেন্দ্রের সাথে কোন ভাষায় কথা বলতে চান?"
  },
  maithili: {
    langName: "मैथिली",
    sttCode: "mai-IN",
    brandName: "सेवा केंद्र (Seva Kendra)",
    brandTagline: "ग्रामीण नागरिक कल्याण आ योजना सहायता केंद्र",
    menuBtnText: "अन्य सेवा",
    heroTitle: "बाज के जानू अपन हकक सरकारी योजना",
    heroSubtitle: "बिना कोनो फॉर्म या दलालक — अपन मातृभाषा में कहू आ तुरंत लाभ आ कागजात जानू।",
    assistantTag: "सेवा केंद्र वाणी सहायक:",
    welcomePrompt: "प्रणाम, सेवा केंद्र में अहाँक स्वागत अछि। कहू, अहाँक उमर कते अछि, आ कोनो योजनाक जानकारी चाही?",
    welcomeHint: '💡 माइक दबाउ आ अपन उमर या कोनो योजनाक विषय में कहू',
    micLabelIdle: "बाजए लेल दबाउ",
    micLabelRecording: "सुनैत छी (कहू...)",
    micStatusIdle: "बटन दबा क अपन मातृभाषा में कहू",
    micStatusListening: "🎙️ सुनैत छी... कहू (रुकला पर अपने-आप उत्तर भेटत)",
    micStatusProcessing: "जांच भ रहल अछि...",
    manualPlaceholder: "या एतय बाज के/लिख क पठाउ...",
    sendBtn: "पठाउ ➔",
    chipsLabel: "⚡ बाज के पूछए क उदाहरण:",
    slotsTitle: "📋 अहाँक सत्यापित जानकारी (Verified Profile):",
    slotAgeLabel: "उमर:",
    slotMaritalLabel: "वैवाहिक स्थिति:",
    slotLandLabel: "खेतीक ज़मीन:",
    slotIncomeLabel: "सालाना कमाई:",
    slotStateLabel: "राज्य/जिला:",
    resultsTitle: "🎉 अहाँक लेल स्वीकृत सरकारी योजना",
    voiceExpTitle: "🔊 वाणी समाधान (Spoken Solution):",
    triadSchemesTitle: "💰 1. भेटय बला योजना",
    triadDocsTitle: "📂 2. मात्र ई 3 टा कागजात ल जाउ",
    triadOfficeTitle: "📍 3. एतय जा क जमा करू",
    smsSlipTitle: "📱 अहाँक मोबाइल पर पठाओल गेल SMS",
    drawerHeading: "अन्य सेवा आ टूल्स",
    langModalTitle: "भाषा चुनू / Select Language",
    langModalSub: "अहाँ सेवा केंद्र सँ कोन भाषा में बात करब?"
  },
  en: {
    langName: "English",
    sttCode: "en-IN",
    brandName: "Seva Kendra",
    brandTagline: "Rural Public Welfare & Direct Scheme Access Centre",
    menuBtnText: "More Services",
    heroTitle: "Discover Your Eligible Government Schemes by Voice",
    heroSubtitle: "Zero forms, zero brokers — just speak in your native dialect to find your entitlements and required documents.",
    assistantTag: "Seva Kendra Voice Assistant:",
    welcomePrompt: "Welcome to Seva Kendra. To begin, please tell me your age, and what scheme or assistance you need.",
    welcomeHint: '💡 Press the mic button and speak about your age, family situation, or any scheme',
    micLabelIdle: "Tap to Speak",
    micLabelRecording: "Listening (Speak...)",
    micStatusIdle: "Press button and speak in your language",
    micStatusListening: "🎙️ Listening... please speak (stops automatically when done)",
    micStatusProcessing: "Processing your details...",
    manualPlaceholder: "Or type/speak your query here...",
    sendBtn: "Submit ➔",
    chipsLabel: "⚡ Example voice queries:",
    slotsTitle: "📋 Verified Profile Information:",
    slotAgeLabel: "Age:",
    slotMaritalLabel: "Marital Status:",
    slotLandLabel: "Agricultural Land:",
    slotIncomeLabel: "Annual Income:",
    slotStateLabel: "State/District:",
    resultsTitle: "🎉 Qualified Government Schemes",
    voiceExpTitle: "🔊 Spoken Solution:",
    triadSchemesTitle: "💰 1. Qualified Schemes",
    triadDocsTitle: "📂 2. Bring Only These 3 Documents",
    triadOfficeTitle: "📍 3. Submit At This Local Office",
    smsSlipTitle: "📱 SMS Action Checklist (Show to Panchayat Operator)",
    drawerHeading: "Additional Services & Tools",
    langModalTitle: "Select Language / अपनी भाषा चुनें",
    langModalSub: "In which language would you like to speak with Seva Kendra?"
  }
};

// --------------------------------------------------------------------------
// 2. Error Definitions (Empathetic, distinct messages in all languages)
// --------------------------------------------------------------------------
const ERROR_MESSAGES = {
  MIC_PERMISSION_DENIED: {
    hi: "माइक की अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में जाकर माइक की अनुमति दें।",
    bhojpuri: "माइक के अनुमति नइखे मिलल। कृपा कके ब्राउज़र सेटिंग्स में जाके माइक चालू करीं।",
    bn: "মাইক ব্যবহারের অনুমতি পাওয়া যায়নি। দয়া করে ব্রাউজার সেটিংসে গিয়ে মাইক চালু করুন।",
    maithili: "माइकक अनुमति नहि भेटल। कृपया ब्राउज़र सेटिंग्समे जाकए माइक चालू करू।",
    en: "Microphone permission denied. Please allow microphone access in your browser settings."
  },
  NO_INPUT_DEVICE: {
    hi: "आपके डिवाइस में कोई माइक नहीं मिला। कृपया माइक या ईयरफोन कनेक्ट करें।",
    bhojpuri: "राउर मोबाइल में कवनो माइक नइखे मिलल। ईयरफोन या माइक लगाईं।",
    bn: "আপনার ডিভাইসে কোনো মাইক পাওয়া যায়নি। দয়া করে মাইক বা ইয়ারফোন সংযুক্ত করুন।",
    maithili: "अहाँक फोनमे कोनो माइक नहि भेटल। कृपया इयरफोन या माइक जोड़ू।",
    en: "No microphone detected on your device. Please connect a microphone or headset."
  },
  MIC_SILENT: {
    hi: "माइक से कोई आवाज़ नहीं आई। कृपया माइक के पास आकर थोड़ा तेज़ बोलें।",
    bhojpuri: "कवनो आवाज़ नइखे आइल। तनी माइक के लगे आके जोर से बोलीं।",
    bn: "মাইকে কোনো শব্দ ধরা পড়েনি। দয়া করে মাইকের কাছে এসে আরেকটু স্পষ্ট ও জোরে বলুন।",
    maithili: "कोनो आवाज नहि आएल। कृपया माइकक लग आबि कए जोर सं बाहू।",
    en: "No sound detected from your microphone. Please speak closer to the mic."
  },
  STT_API_ERROR: {
    hi: "सर्वर से संपर्क करने में तकनीकी समस्या आई है। कृपया एक क्षण बाद पुनः प्रयास करें।",
    bhojpuri: "सर्वर से जुड़े में तकनीकी अड़चन आइल बा। तनी देर बाद फिर से बोलीं।",
    bn: "সার্ভারের সাথে সংযোগে সাময়িক প্রযুক্তিগত সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    maithili: "सर्वर सं जुड़े मे तकनीकी समस्या भेल। कृपया किछु काल बाद पुनः प्रयास करू।",
    en: "Technical issue communicating with the voice server. Please try again in a moment."
  },
  NETWORK_OFFLINE: {
    hi: "इंटरनेट कनेक्शन बंद है। कृपया अपना मोबाइल डेटा या वाई-फाई चेक करें।",
    bhojpuri: "इंटरनेट बंद बा। आपन मोबाइल डेटा या वाई-फाई जांच करीं।",
    bn: "ইন্টারনেট সংযোগ বিচ্ছিন্ন। দয়া করে মোবাইল ডেটা বা ওয়াই-ফাই পরীক্ষা করুন।",
    maithili: "इंटरनेट बंद अछि। कृपया अपन मोबाइल डेटा वा वाई-फाई जांचू।",
    en: "You appear to be offline. Please check your internet connection."
  },
  TRULY_EMPTY_SPEECH: {
    hi: "आपकी आवाज़ साफ सुनाई नहीं दी। कृपया थोड़ा साफ और दोबारा बोलें।",
    bhojpuri: "राउर आवाज़ साफ नइखे बुझाइल। कृपा कके फिर से साफ-साफ बोलीं।",
    bn: "আপনার কথা স্পষ্ট শোনা যায়নি। দয়া করে আরেকবার পরিষ্কার করে বলুন।",
    maithili: "अहाँक आवाज स्पष्ट नहि बुझायल। कृपया फेर सं साफ बाहू।",
    en: "Could not clearly understand your speech. Please try speaking again clearly."
  }
};

function displayErrorMessage(errorCode) {
  const code = ERROR_MESSAGES[errorCode] ? errorCode : 'TRULY_EMPTY_SPEECH';
  const langKey = currentLanguage === 'bn' ? 'bn' : (currentLanguage === 'bhojpuri' ? 'bhojpuri' : (currentLanguage === 'maithili' ? 'maithili' : (currentLanguage === 'en' ? 'en' : 'hi')));
  const msg = ERROR_MESSAGES[code][langKey] || ERROR_MESSAGES[code].hi;

  showLiveSpeechBox(true);
  const liveText = document.getElementById('liveSpeechTranscript');
  if (liveText) liveText.textContent = `⚠️ ${msg}`;

  const micStatus = document.getElementById('mic-status-text');
  if (micStatus) micStatus.textContent = msg;

  playBrowserFallbackSpeech(msg);
}

// --------------------------------------------------------------------------
// 3. AudioContext & Unlocked Playback Management (iOS/Android Safe)
// --------------------------------------------------------------------------
function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

async function unlockAudioPlayback() {
  if (isAudioUnlocked) return;
  try {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    masterAudio = document.getElementById('masterAudio') || new Audio();
    // Play microscopic silent WAV to satisfy iOS Safari & Chrome user-gesture policy
    masterAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    await masterAudio.play();
    masterAudio.pause();
    isAudioUnlocked = true;
    console.log("✓ Audio playback channel unlocked for mobile browsers.");
  } catch (err) {
    console.warn("Audio unlock notice:", err.message);
  }
}

function stopAllAudio() {
  if (masterAudio) {
    try {
      masterAudio.pause();
      masterAudio.currentTime = 0;
    } catch (e) {}
  }
  isAssistantSpeaking = false;
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
}

/**
 * Plays audio through the single persistent unlocked <audio> element
 */
async function playAudio(url, base64Audio, fallbackText, onEndedCallback) {
  stopAllAudio();
  isAssistantSpeaking = true;

  if (!masterAudio) {
    masterAudio = document.getElementById('masterAudio') || new Audio();
  }

  const t_playback_start = Date.now();

  const handleEnded = () => {
    isAssistantSpeaking = false;
    masterAudio.removeEventListener('ended', handleEnded);
    if (onEndedCallback) onEndedCallback();
    // Hands-free conversation mode: auto-listen after reply
    if (isConversationModeActive && !isRecording) {
      setTimeout(() => {
        if (!isAssistantSpeaking && !isRecording) {
          startRecording(true);
        }
      }, 350);
    }
  };

  masterAudio.addEventListener('ended', handleEnded);

  // Send playback start timestamp to metrics endpoint
  if (pendingTurnId) {
    fetch(`${API_BASE}/api/metrics/playback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId: pendingTurnId, t_playback_start })
    }).catch(() => {});
  }

  // 1. Play from URL (cached TTS)
  if (url) {
    try {
      masterAudio.src = url.startsWith('http') ? url : `${API_BASE}${url}`;
      await masterAudio.play();
      return;
    } catch (e) {
      console.warn("Failed playing from URL, trying base64/fallback:", e.message);
    }
  }

  // 2. Play from base64
  if (base64Audio && base64Audio.length > 50) {
    try {
      masterAudio.src = `data:audio/wav;base64,${base64Audio}`;
      await masterAudio.play();
      return;
    } catch (e) {
      console.warn("Failed playing base64 audio, trying browser speech:", e.message);
    }
  }

  // 3. Fallback: Web Speech Synthesis
  if (fallbackText) {
    playBrowserFallbackSpeech(fallbackText, handleEnded);
  } else {
    isAssistantSpeaking = false;
  }
}

function playBrowserFallbackSpeech(text, onEnded) {
  if (!('speechSynthesis' in window)) {
    if (onEnded) onEnded();
    return;
  }
  stopAllAudio();
  const utter = new SpeechSynthesisUtterance(text);
  const cfg = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  utter.lang = cfg.sttCode;
  utter.rate = 0.95;
  utter.onend = () => {
    isAssistantSpeaking = false;
    if (onEnded) onEnded();
    if (isConversationModeActive && !isRecording) {
      setTimeout(() => startRecording(true), 350);
    }
  };
  window.speechSynthesis.speak(utter);
}

// Play instant subtle acknowledgement earcon (<50ms feedback on speech stop)
function playInstantEarcon() {
  const earconAudio = new Audio(`${API_BASE}/api/tts/earcon`);
  earconAudio.volume = 0.45;
  earconAudio.play().catch(() => {});
}

// --------------------------------------------------------------------------
// 4. WebSocket Streaming Gateway Management
// --------------------------------------------------------------------------
function ensureWebSocketConnection() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/speech`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isWsConnected = true;
      ws.send(JSON.stringify({
        type: 'init',
        sessionId: currentSessionId,
        language: currentLanguage
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };

    ws.onerror = (err) => {
      console.warn("WS error, will fallback to REST if needed", err);
      isWsConnected = false;
    };

    ws.onclose = () => {
      isWsConnected = false;
    };
  } catch (err) {
    console.warn("WS init error", err);
    isWsConnected = false;
  }
}

function handleWebSocketMessage(msg) {
  // Real-time partial transcript for live captioning
  if (msg.type === 'partial_transcript') {
    const transcriptEl = document.getElementById('liveSpeechTranscript');
    if (transcriptEl && msg.transcript) {
      transcriptEl.textContent = `"${msg.transcript}"`;
    }
    const manualInput = document.getElementById('manual-speech-input');
    if (manualInput && msg.transcript) {
      manualInput.value = msg.transcript;
    }
  }

  // Final transcript locked in
  else if (msg.type === 'final_transcript') {
    const transcriptEl = document.getElementById('liveSpeechTranscript');
    if (transcriptEl) transcriptEl.textContent = `"${msg.transcript}"`;
    const manualInput = document.getElementById('manual-speech-input');
    if (manualInput) manualInput.value = msg.transcript;
  }

  // Turn Result from Dynamic Assistant
  else if (msg.type === 'turn_result') {
    handleTurnResponse(msg.result);
  }

  // Distinct Error from Server
  else if (msg.type === 'error') {
    displayErrorMessage(msg.errorCode || 'STT_API_ERROR');
    setMicButtonState(false);
  }
}

// --------------------------------------------------------------------------
// 5. AudioWorklet 16kHz PCM Capture, VAD & Hands-Free Conversation
// --------------------------------------------------------------------------
async function toggleRecording() {
  await unlockAudioPlayback();
  isConversationModeActive = true;

  if (isRecording || isAudioCapturing) {
    await stopRecording(false);
  } else {
    await startRecording(false);
  }
}

async function startRecording(autoListen = false) {
  // Stop assistant playback before recording
  stopAllAudio();

  // Network check
  if (!navigator.onLine) {
    displayErrorMessage('NETWORK_OFFLINE');
    return;
  }

  // 1. SET CAPTURE STATE BEFORE AWAITING getUserMedia (Fix for Root Cause 3)
  isRecording = true;
  isAudioCapturing = true;
  window.isRecording = true;
  window.isAudioCapturing = true;
  userHasSpokenInTurn = false;
  consecutiveSilenceMs = 0;
  accumulatedPcmBuffers = [];
  totalRecordedBytes = 0;
  clientSpeechEndTimestamp = null;

  showLiveSpeechBox(true);
  setMicButtonState(true);

  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  const micStatus = document.getElementById('mic-status-text');
  if (micStatus) micStatus.textContent = t.micStatusListening;

  const liveText = document.getElementById('liveSpeechTranscript');
  if (liveText) liveText.textContent = `"${t.micStatusListening}"`;

  // Ensure WebSocket is open and initialized
  ensureWebSocketConnection();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'init', sessionId: currentSessionId, language: currentLanguage }));
  }

  // 2. AudioContext & AudioWorklet Setup
  try {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Load AudioWorklet module if not yet loaded
    if (!ctx.audioWorkletRegistered) {
      await ctx.audioWorklet.addModule('/audio-processor.js');
      ctx.audioWorkletRegistered = true;
    }

    rawMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    mediaStreamSource = ctx.createMediaStreamSource(rawMicStream);
    workletNode = new AudioWorkletNode(ctx, 'pcm-resampler-processor');

    workletNode.port.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.pcm) return;

      const pcmBuffer = data.pcm;
      const rms = data.rms || 0;
      const isSpeech = data.isSpeech;

      // BARGE-IN: If assistant is talking and citizen speaks loudly, interrupt assistant
      if (isAssistantSpeaking && rms > BARGE_IN_RMS_THRESHOLD) {
        stopAllAudio();
      }

      if (!isRecording) return;

      // Accumulate buffer
      accumulatedPcmBuffers.push(new Uint8Array(pcmBuffer));
      totalRecordedBytes += pcmBuffer.byteLength;

      // Stream to WebSocket in real-time
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(pcmBuffer);
      }

      // VOICE ACTIVITY DETECTION (VAD)
      if (isSpeech || rms > VAD_SPEECH_RMS_THRESHOLD) {
        userHasSpokenInTurn = true;
        consecutiveSilenceMs = 0;
      } else if (userHasSpokenInTurn && rms < VAD_SILENCE_RMS_THRESHOLD) {
        consecutiveSilenceMs += 100; // Each frame is 100ms
        // If silence threshold reached, automatically trigger end of speech!
        if (consecutiveSilenceMs >= VAD_SILENCE_LIMIT_MS) {
          clientSpeechEndTimestamp = Date.now();
          stopRecording(true);
        }
      }
    };

    mediaStreamSource.connect(workletNode);
    workletNode.connect(ctx.destination);
  } catch (err) {
    console.error("Microphone capture error:", err);
    isRecording = false;
    isAudioCapturing = false;
    setMicButtonState(false);

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      displayErrorMessage('MIC_PERMISSION_DENIED');
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      displayErrorMessage('NO_INPUT_DEVICE');
    } else {
      displayErrorMessage('STT_API_ERROR');
    }
  }
}

async function stopRecording(isVAD = false) {
  if (!isRecording && !isAudioCapturing) return;

  clientSpeechEndTimestamp = clientSpeechEndTimestamp || Date.now();
  setMicButtonState(false);
  isRecording = false;
  isAudioCapturing = false;
  window.isRecording = false;
  window.isAudioCapturing = false;

  const micStatus = document.getElementById('mic-status-text');
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  if (micStatus) micStatus.textContent = t.micStatusProcessing;

  // Cleanup hardware mic tracks
  if (workletNode) {
    try { workletNode.disconnect(); } catch (e) {}
  }
  if (mediaStreamSource) {
    try { mediaStreamSource.disconnect(); } catch (e) {}
  }
  if (rawMicStream) {
    rawMicStream.getTracks().forEach(t => t.stop());
  }

  // Play instant earcon acoustic acknowledgment tone
  playInstantEarcon();

  // If WebSocket is connected, signal End of Speech (EOS)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'eos',
      clientSpeechEndTimestamp: clientSpeechEndTimestamp,
      language: currentLanguage
    }));
    return;
  }

  // REST Fallback if WebSocket is not available
  if (accumulatedPcmBuffers.length > 0) {
    const wavBlob = buildWavFromPcmChunks(accumulatedPcmBuffers, 16000);
    await sendAudioViaRest(wavBlob, clientSpeechEndTimestamp);
  } else {
    displayErrorMessage('MIC_SILENT');
  }
}

function buildWavFromPcmChunks(chunks, sampleRate = 16000) {
  let totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new ArrayBuffer(44 + totalLength);
  const view = new DataView(buffer);

  // WAV Header
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalLength, true);
  writeWavString(view, 8, 'WAVE');
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeWavString(view, 36, 'data');
  view.setUint32(40, totalLength, true);

  const uint8View = new Uint8Array(buffer, 44);
  let offset = 0;
  for (const c of chunks) {
    uint8View.set(c, offset);
    offset += c.length;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeWavString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

async function sendAudioViaRest(audioBlob, speechEndTs) {
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;

  try {
    const res = await fetch(`${API_BASE}/api/chat/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-session-id': currentSessionId,
        'x-language': currentLanguage,
        'x-speech-end': String(speechEndTs || Date.now())
      },
      body: audioBlob
    });

    if (res.status === 413) {
      displayErrorMessage('STT_API_ERROR');
      return;
    }

    const result = await res.json();
    if (result.type === 'ERROR') {
      displayErrorMessage(result.errorCode);
      return;
    }

    handleTurnResponse(result);
  } catch (err) {
    console.error("Audio REST upload error", err);
    displayErrorMessage('STT_API_ERROR');
  }
}

// --------------------------------------------------------------------------
// 6. Manual Text Fallback & Turn Dispatch
// --------------------------------------------------------------------------
async function sendSpokenText(forcedText = null) {
  await unlockAudioPlayback();
  const input = document.getElementById('manual-speech-input');
  const text = (forcedText || (input ? input.value : "")).trim();
  if (!text) return;

  stopAllAudio();
  showLiveSpeechBox(true);
  const liveText = document.getElementById('liveSpeechTranscript');
  if (liveText) liveText.textContent = `"${text}"`;

  const micStatus = document.getElementById('mic-status-text');
  if (micStatus) micStatus.textContent = `जांच चल रही है...`;

  try {
    const res = await fetch(`${API_BASE}/api/chat/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        text: text,
        language: currentLanguage
      })
    });
    const result = await res.json();
    handleTurnResponse(result);
  } catch (err) {
    console.error("Turn error", err);
    displayErrorMessage('STT_API_ERROR');
  }
}

function setQuickInput(text) {
  const input = document.getElementById('manual-speech-input');
  if (input) input.value = text;
  sendSpokenText(text);
}

// --------------------------------------------------------------------------
// 7. Turn Response Handler (Unified Dynamic Router & Telemetry)
// --------------------------------------------------------------------------
function handleTurnResponse(result) {
  const micStatus = document.getElementById('mic-status-text');
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  if (micStatus) micStatus.textContent = t.micStatusIdle;

  if (result.metrics) {
    lastTurnMetrics = result.metrics;
    pendingTurnId = result.metrics.turnId;
    updateDebugOverlay(result.metrics);
  }

  // 1. Update Verified Profile Slots
  const profile = result.profile || (result.session ? result.session.profile : {});
  if (profile.age) {
    const el = document.getElementById('slot-age');
    if (el) el.textContent = `${profile.age} वर्ष`;
  }
  if (profile.marital_status) {
    const el = document.getElementById('slot-marital');
    if (el) el.textContent = profile.marital_status === 'widow' ? 'विधवा' : (profile.marital_status === 'married' ? 'विवाहित' : profile.marital_status);
  }
  if (profile.landholding_acres !== undefined && profile.landholding_acres !== null) {
    const el = document.getElementById('slot-land');
    if (el) el.textContent = profile.landholding_acres === 0 ? "भूमिहीन" : `${profile.landholding_acres} एकड़`;
  }
  if (profile.annual_income_inr) {
    const el = document.getElementById('slot-income');
    if (el) el.textContent = `₹${profile.annual_income_inr.toLocaleString('en-IN')}`;
  }
  if (profile.state) {
    const el = document.getElementById('slot-location');
    if (el) el.textContent = `${profile.state} ${profile.district || ''}`;
  }

  // 2. Show Recognized Words
  if (result.userTranscript) {
    const liveText = document.getElementById('liveSpeechTranscript');
    if (liveText) liveText.textContent = `"${result.userTranscript}"`;
    const manualInput = document.getElementById('manual-speech-input');
    if (manualInput) manualInput.value = result.userTranscript;
  }

  // 3. Dynamic Result Branching & Audio Playback
  if (result.type === 'TRIAGE_RESOLVED') {
    openSlidingDrawer();
    switchDrawerModule('drawer-triage');
    renderTriageView(result.triageData);
    playAudio(result.audioUrl, result.audioBase64, result.diagnosis?.citizen_friendly_script);
  } else if (result.type === 'SCHEMES_MATCHED' || result.isCompleted) {
    renderEvaluationResults(result.evaluationResult, result.audioUrl, result.audioBase64 || result.firstSentenceAudioBase64);
  } else {
    setPrompt(result.replyText || result.nextPromptText, result.promptHint, result.audioUrl, result.audioBase64 || result.firstSentenceAudioBase64);
  }
}

// --------------------------------------------------------------------------
// 8. Results Rendering (Actionable Triad)
// --------------------------------------------------------------------------
function renderEvaluationResults(evaluation, audioUrl, audioBase64) {
  const card = document.getElementById('results-card');
  card.style.display = 'block';

  document.getElementById('badge-count').textContent = `${evaluation.matchedCount} योजनाएं स्वीकृत`;
  document.getElementById('spoken-audio-transcript').textContent = evaluation.spokenScript;

  // Render Schemes
  const schemesList = document.getElementById('schemes-list');
  schemesList.innerHTML = evaluation.matchedSchemes.map(s => `
    <div class="scheme-card-box">
      <div class="scheme-title-text">✓ ${s.title_hi}</div>
      <div class="scheme-benefit-text">लाभ: ${s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr.toLocaleString('en-IN')}/माह` : `₹${s.annual_benefit_inr.toLocaleString('en-IN')} वार्षिक अनुदान`}</div>
    </div>
  `).join('');

  // Render 3 Physical Documents
  const docsList = document.getElementById('docs-list');
  docsList.innerHTML = evaluation.primaryDocuments.map((doc, idx) => `
    <li><strong>[ ] ${idx + 1}.</strong> ${doc}</li>
  `).join('');

  // Render Office Destination
  document.getElementById('office-destination').textContent = evaluation.primaryOffice;

  // Render SMS Action Slip
  document.getElementById('sms-text-content').textContent = evaluation.smsChecklist;

  currentSpokenAudioUrl = audioUrl;
  currentSpokenAudioBase64 = audioBase64;
  playAudio(audioUrl, audioBase64, evaluation.spokenScript);

  card.scrollIntoView({ behavior: 'smooth' });
}

function replaySpokenAudio() {
  if (currentSpokenAudioUrl || currentSpokenAudioBase64) {
    playAudio(currentSpokenAudioUrl, currentSpokenAudioBase64, document.getElementById('spoken-audio-transcript').textContent);
  } else {
    const text = document.getElementById('spoken-audio-transcript').textContent;
    playBrowserFallbackSpeech(text);
  }
}

// --------------------------------------------------------------------------
// 9. Session Reset & Prompt Setting
// --------------------------------------------------------------------------
async function initSession() {
  currentSessionId = `session_${Date.now()}`;
  const resultsCard = document.getElementById('results-card');
  if (resultsCard) resultsCard.style.display = 'none';

  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;

  try {
    const res = await fetch(`${API_BASE}/api/chat/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId, language: currentLanguage })
    });
    const data = await res.json();
    setPrompt(data.promptText || t.welcomePrompt, data.promptHint || t.welcomeHint, data.audioUrl, data.audioBase64);
  } catch (err) {
    console.warn("Init fallback:", err);
    setPrompt(t.welcomePrompt, t.welcomeHint, null, null);
  }
}

function setPrompt(text, hint, audioUrl, audioBase64) {
  const textEl = document.getElementById('assistant-prompt-text');
  const hintEl = document.getElementById('assistant-prompt-hint');
  if (textEl) textEl.textContent = text;
  if (hintEl) hintEl.textContent = hint;

  currentPromptAudioUrl = audioUrl;
  currentPromptAudioBase64 = audioBase64;
  playAudio(audioUrl, audioBase64, text);
}

function replayCurrentPromptAudio() {
  if (currentPromptAudioUrl || currentPromptAudioBase64) {
    playAudio(currentPromptAudioUrl, currentPromptAudioBase64, document.getElementById('assistant-prompt-text').textContent);
  } else {
    const text = document.getElementById('assistant-prompt-text').textContent;
    playBrowserFallbackSpeech(text);
  }
}

function resetInterview() {
  document.getElementById('slot-age').textContent = "--";
  document.getElementById('slot-marital').textContent = "--";
  document.getElementById('slot-land').textContent = "--";
  document.getElementById('slot-income').textContent = "--";
  document.getElementById('slot-location').textContent = "--";
  document.getElementById('results-card').style.display = 'none';
  showLiveSpeechBox(false);
  initSession();
}

function resetToHome() {
  closeSlidingDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 10. Sliding Menu Drawer & Triage Modules
// --------------------------------------------------------------------------
function toggleSlidingDrawer() {
  const drawer = document.getElementById('slidingDrawer');
  if (drawer.classList.contains('active')) closeSlidingDrawer();
  else openSlidingDrawer();
}

function openSlidingDrawer() {
  const drawer = document.getElementById('slidingDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.add('active');
  if (backdrop) backdrop.classList.add('active');
}

function closeSlidingDrawer() {
  const drawer = document.getElementById('slidingDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function switchDrawerModule(moduleId) {
  document.querySelectorAll('.drawer-module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.drawer-item-btn').forEach(b => b.classList.remove('active'));

  const targetModule = document.getElementById(moduleId);
  if (targetModule) targetModule.classList.add('active');

  document.querySelectorAll('.drawer-item-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(moduleId)) {
      btn.classList.add('active');
    }
  });
}

async function runPensionTriage() {
  const idInput = document.getElementById('triageIdentifierInput');
  const identifier = idInput ? idInput.value.trim() : "7193";

  try {
    const res = await fetch(`${API_BASE}/api/triage/pension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "हमार पेंशन तीन महीना से ना आवता",
        identifier: identifier,
        language: currentLanguage === 'bn' ? 'bengali' : 'bhojpuri'
      })
    });
    const data = await res.json();
    renderTriageView(data);
  } catch (err) {
    console.error("Triage error", err);
  }
}

function renderTriageView(data) {
  const resCard = document.getElementById('triageResultCard');
  if (!resCard) return;

  const d = data.diagnosis;
  document.getElementById('triageBeneficiaryName').textContent = data.beneficiary.name;
  document.getElementById('triageSchemeName').textContent = data.beneficiary.scheme;
  document.getElementById('triageVillageName').textContent = data.beneficiary.village;
  document.getElementById('triageAccountNo').textContent = data.beneficiary.account_masked;
  document.getElementById('triageBlockedAmount').textContent = data.beneficiary.amount_blocked;
  document.getElementById('triageLastCreditDate').textContent = data.beneficiary.last_credit_date;
  document.getElementById('triageErrorCode').textContent = d.code;
  document.getElementById('triageRootCause').textContent = d.root_cause;
  document.getElementById('triageActionSlip').textContent = d.immediate_action_step;
  document.getElementById('triageDeskOfficer').textContent = d.where_to_go;
  document.getElementById('triageCitizenScript').textContent = d.citizen_friendly_script;

  currentTriageAudioUrl = data.audioUrl;
  currentTriageScriptText = d.citizen_friendly_script;

  resCard.style.display = 'block';
  playAudio(data.audioUrl, null, d.citizen_friendly_script);
}

function replayTriageAudio() {
  if (currentTriageAudioUrl || currentTriageScriptText) {
    playAudio(currentTriageAudioUrl, null, currentTriageScriptText);
  }
}

function simulateWAIncoming(citizenName, scenarioText) {
  const chatBody = document.getElementById('waChatBody');
  if (!chatBody) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'wa-bubble user';
  userMsg.innerHTML = `
    <div style="font-weight: 700; font-size: 11px; margin-bottom: 2px;">${citizenName} (व्हाट्सएप ऑडियो)</div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <span>🎤 0:08</span>
      <span style="font-size: 10px; opacity: 0.8;"> ▂▃▅▆</span>
    </div>
    <div style="font-size: 11px; opacity: 0.85; margin-top: 3px;">"${scenarioText}"</div>
    <div style="font-size: 9px; text-align: right; margin-top: 2px;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  chatBody.appendChild(userMsg);

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'wa-bubble bot';
    botMsg.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span>▶️ 0:24</span>
        <span style="font-size: 10px; opacity: 0.8;"> ▂▃▅▆▇</span>
      </div>
      <div style="margin-top: 4px; font-size: 12px; line-height: 1.4;">
        <strong>सेवा केंद्र योजना पर्ची:</strong><br>
        ✓ उ.प्र. विधवा पेंशन: ₹1,000/माह<br>
        ✓ पीएम आवास: ₹1,20,000<br>
        <small style="color: #0369a1;">3 कागज़ ले जाएं: आधार, मृत्यु प्रमाण पत्र, बैंक पासबुक।</small>
      </div>
      <div style="font-size: 9px; text-align: right; margin-top: 2px;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    chatBody.appendChild(botMsg);
    chatBody.scrollTop = chatBody.scrollHeight;

    playAudio(null, null, "दीदी, आपका वॉइस नोट सुन लिया गया है। आप विधवा पेंशन और आवास योजना के लिए पात्र हैं।");
  }, 1400);
}

async function loadSchemesCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/schemes`);
    allLoadedSchemes = await res.json();
    renderSchemesCards(allLoadedSchemes);
  } catch (err) {
    console.error("Schemes catalog load error", err);
  }
}

function renderSchemesCards(schemes) {
  const container = document.getElementById('schemesCardsContainer');
  if (!container) return;

  container.innerHTML = schemes.map(s => `
    <div class="scheme-drawer-item">
      <div class="scheme-drawer-title">${s.title_hi}</div>
      <div class="scheme-drawer-benefit">💰 ${s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr.toLocaleString('en-IN')}/माह` : `₹${s.annual_benefit_inr.toLocaleString('en-IN')} वार्षिक अनुदान`}</div>
      <div class="scheme-drawer-docs">
        <strong>ज़रूरी कागज़:</strong> ${s.documents_hi ? s.documents_hi.slice(0, 3).join(', ') : 'आधार, पासबुक'}<br>
        <strong>जमा करें:</strong> ${s.where_to_submit_hi || 'पंचायत भवन'}
      </div>
      <button class="offline-demo-btn" style="margin-top: 8px; padding: 6px 12px; font-size: 12px;" onclick="applySchemeFromDrawer('${s.title_hi}')">
        🎙️ इस योजना के लिए बोलें
      </button>
    </div>
  `).join('');
}

function applySchemeFromDrawer(schemeTitle) {
  closeSlidingDrawer();
  setQuickInput(`हम ${schemeTitle} के लिए आवेदन करना चाहते हैं।`);
}

async function loadPanchayatGrievances() {
  const tbody = document.getElementById('grievanceTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/panchayat/grievances`);
    const data = await res.json();
    const list = data.grievances || [];

    tbody.innerHTML = list.map(g => `
      <tr>
        <td><strong>${g.citizen}</strong><br><small style="color:#64748b;">${g.phone}</small></td>
        <td>${g.scheme}</td>
        <td><strong style="color:#dc2626;">${g.amount_blocked}</strong></td>
        <td>${g.remediation}</td>
        <td><span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">${g.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Grievances load error", err);
  }
}

// --------------------------------------------------------------------------
// 11. UI Helpers & Language Switching
// --------------------------------------------------------------------------
function showLiveSpeechBox(show) {
  const box = document.getElementById('liveSpeechBox');
  if (box) {
    if (show) box.classList.add('active');
    else box.classList.remove('active');
  }
}

function setMicButtonState(recording) {
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const micStatus = document.getElementById('mic-status-text');
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;

  if (recording) {
    if (micBtn) micBtn.classList.add('recording');
    if (micLabel) micLabel.textContent = t.micLabelRecording;
    if (micStatus) micStatus.textContent = t.micStatusListening;
    setWaveformActive(true);
  } else {
    if (micBtn) micBtn.classList.remove('recording');
    if (micLabel) micLabel.textContent = t.micLabelIdle;
    if (micStatus) micStatus.textContent = t.micStatusIdle;
    setWaveformActive(false);
  }
}

function setWaveformActive(active) {
  document.querySelectorAll('.wave-pillar').forEach(p => {
    if (active) p.classList.add('active');
    else p.classList.remove('active');
  });
}

function openLanguageModal() {
  stopAllAudio();
  const overlay = document.getElementById('langModalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function closeLanguageModal() {
  const overlay = document.getElementById('langModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function selectInitialLanguage(langCode) {
  await unlockAudioPlayback();
  currentLanguage = langCode || 'hi';
  localStorage.setItem('sevakendra_lang', currentLanguage);
  sessionStorage.setItem('sevakendra_lang_confirmed', 'true');

  applyLanguage(currentLanguage);
  closeLanguageModal();

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'init', sessionId: currentSessionId, language: currentLanguage }));
  }

  await initSession();
}

function applyLanguage(langCode) {
  const t = I18N_TRANSLATIONS[langCode] || I18N_TRANSLATIONS.hi;
  document.documentElement.lang = langCode === 'bn' ? 'bn' : (langCode === 'en' ? 'en' : 'hi');

  const langLabel = document.getElementById('ui-currentLangLabel');
  if (langLabel) langLabel.textContent = t.langName;
  const brandName = document.getElementById('ui-brandName');
  if (brandName) brandName.textContent = t.brandName;
  const brandTagline = document.getElementById('ui-brandTagline');
  if (brandTagline) brandTagline.textContent = t.brandTagline;
  const menuBtnText = document.getElementById('ui-menuBtnText');
  if (menuBtnText) menuBtnText.textContent = t.menuBtnText;
  const heroTitle = document.getElementById('ui-heroTitle');
  if (heroTitle) heroTitle.textContent = t.heroTitle;
  const heroSubtitle = document.getElementById('ui-heroSubtitle');
  if (heroSubtitle) heroSubtitle.textContent = t.heroSubtitle;
  const assistantTag = document.getElementById('ui-assistantTag');
  if (assistantTag) assistantTag.textContent = t.assistantTag;
  const promptText = document.getElementById('assistant-prompt-text');
  if (promptText) promptText.textContent = t.welcomePrompt;
  const promptHint = document.getElementById('assistant-prompt-hint');
  if (promptHint) promptHint.textContent = t.welcomeHint;
  const micLabel = document.getElementById('mic-label');
  if (micLabel) micLabel.textContent = isRecording ? t.micLabelRecording : t.micLabelIdle;
  const micStatus = document.getElementById('mic-status-text');
  if (micStatus) micStatus.textContent = isRecording ? t.micStatusListening : t.micStatusIdle;
  const manualInput = document.getElementById('manual-speech-input');
  if (manualInput) manualInput.placeholder = t.manualPlaceholder;
  const sendBtn = document.getElementById('ui-sendBtn');
  if (sendBtn) sendBtn.textContent = t.sendBtn;
  const chipsLabel = document.getElementById('ui-chipsLabel');
  if (chipsLabel) chipsLabel.textContent = t.chipsLabel;
  const slotsTitle = document.getElementById('ui-slotsTitle');
  if (slotsTitle) slotsTitle.textContent = t.slotsTitle;
  const slotAge = document.getElementById('ui-slotAgeLabel');
  if (slotAge) slotAge.textContent = t.slotAgeLabel;
  const slotMar = document.getElementById('ui-slotMaritalLabel');
  if (slotMar) slotMar.textContent = t.slotMaritalLabel;
  const slotLand = document.getElementById('ui-slotLandLabel');
  if (slotLand) slotLand.textContent = t.slotLandLabel;
  const slotInc = document.getElementById('ui-slotIncomeLabel');
  if (slotInc) slotInc.textContent = t.slotIncomeLabel;
  const slotState = document.getElementById('ui-slotStateLabel');
  if (slotState) slotState.textContent = t.slotStateLabel;
  const resTitle = document.getElementById('ui-resultsTitle');
  if (resTitle) resTitle.textContent = t.resultsTitle;
  const voiceExp = document.getElementById('ui-voiceExpTitle');
  if (voiceExp) voiceExp.textContent = t.voiceExpTitle;
  const triadSch = document.getElementById('ui-triadSchemesTitle');
  if (triadSch) triadSch.textContent = t.triadSchemesTitle;
  const triadDoc = document.getElementById('ui-triadDocsTitle');
  if (triadDoc) triadDoc.textContent = t.triadDocsTitle;
  const triadOff = document.getElementById('ui-triadOfficeTitle');
  if (triadOff) triadOff.textContent = t.triadOfficeTitle;
  const smsTitle = document.getElementById('ui-smsSlipTitle');
  if (smsTitle) smsTitle.textContent = t.smsSlipTitle;
  const drawerHead = document.getElementById('ui-drawerHeading');
  if (drawerHead) drawerHead.textContent = t.drawerHeading;

  document.querySelectorAll('.lang-option-card').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick')?.includes(langCode)) {
      btn.classList.add('active');
    }
  });
}

// --------------------------------------------------------------------------
// 12. Edge Telemetry & Real-Time Latency Debug Overlay (?debug=1)
// --------------------------------------------------------------------------
function setupDebugOverlay() {
  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
  const overlay = document.getElementById('debugLatencyOverlay');
  if (!overlay) return;

  if (isDebug) {
    overlay.style.display = 'block';
    overlay.innerHTML = `
      <div class="debug-title"><span>⚡ Edge Telemetry</span> <span>DEBUG</span></div>
      <div class="debug-metric"><span>STT Duration:</span> <span class="debug-val" id="dbg-stt">--</span></div>
      <div class="debug-metric"><span>NLU / Logic:</span> <span class="debug-val" id="dbg-nlu">--</span></div>
      <div class="debug-metric"><span>TTS 1st Byte:</span> <span class="debug-val" id="dbg-tts">--</span></div>
      <div class="debug-metric"><span>E2E First Audio:</span> <span class="debug-val" id="dbg-e2e">--</span></div>
      <div class="debug-metric"><span>Target p50 ≤1.5s:</span> <span class="target-pass" id="dbg-p50">PASS</span></div>
      <div class="debug-metric"><span>Target p95 ≤3.0s:</span> <span class="target-pass" id="dbg-p95">PASS</span></div>
    `;
  }
}

function updateDebugOverlay(m) {
  const overlay = document.getElementById('debugLatencyOverlay');
  if (!overlay || overlay.style.display === 'none') return;

  const sttEl = document.getElementById('dbg-stt');
  const nluEl = document.getElementById('dbg-nlu');
  const ttsEl = document.getElementById('dbg-tts');
  const e2eEl = document.getElementById('dbg-e2e');
  const p50El = document.getElementById('dbg-p50');

  if (sttEl) sttEl.textContent = `${m.stt_ms}ms`;
  if (nluEl) nluEl.textContent = `${m.nlu_ms}ms`;
  if (ttsEl) ttsEl.textContent = `${m.tts_first_byte_ms}ms`;
  if (e2eEl) {
    e2eEl.textContent = `${m.e2e_first_audio_ms}ms`;
    e2eEl.style.color = m.e2e_first_audio_ms <= 1500 ? '#34d399' : (m.e2e_first_audio_ms <= 3000 ? '#fbbf24' : '#f87171');
  }
  if (p50El) {
    p50El.textContent = m.e2e_first_audio_ms <= 1500 ? "PASS" : "WARN";
    p50El.className = m.e2e_first_audio_ms <= 1500 ? "target-pass" : "target-warn";
  }
}

// --------------------------------------------------------------------------
// 13. DOM Initialization
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  setupDebugOverlay();
  await loadSchemesCatalog();
  await loadPanchayatGrievances();

  // Unlock audio on first page click or touch
  const unlockHandler = () => {
    unlockAudioPlayback();
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
  };
  window.addEventListener('click', unlockHandler, { once: true });
  window.addEventListener('touchstart', unlockHandler, { once: true });

  const storedLang = localStorage.getItem('sevakendra_lang');
  const sessionConfirmed = sessionStorage.getItem('sevakendra_lang_confirmed');

  if (!sessionConfirmed) {
    openLanguageModal();
  } else {
    currentLanguage = storedLang || 'hi';
    applyLanguage(currentLanguage);
    await initSession();
  }
});
