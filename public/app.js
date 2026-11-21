/**
 * Seva Kendra (सेवा केंद्र) - Master Client Application
 * Hardware-Friendly, Multilingual (Hi, Bhojpuri, Bn, Maithili, En), Single-Audio Controlled,
 * 16kHz PCM WAV Audio Capture + Sarvam AI Engine
 */

const API_BASE = window.location.origin;
let currentSessionId = `session_${Date.now()}`;
let currentLanguage = 'hi';

// Audio Management: Single instance to prevent multiple voices playing simultaneously
let currentAudioInstance = null;
let currentPromptAudioBase64 = null;
let currentSpokenAudioBase64 = null;
let currentTriageAudioBase64 = null;
let currentTriageScriptText = "";

// Web Audio PCM Capture State
let audioCtx = null;
let rawMicStream = null;
let mediaStreamSource = null;
let scriptProcessorNode = null;
let pcmBuffers = [];
let isAudioCapturing = false;
let isRecording = false;

// Speech Recognition (Visual Feedback) State
let speechRecognitionInstance = null;
let isSpeechRecognizing = false;
let latestInterimTranscript = "";

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
    welcomePrompt: "नमस्ते, सेवा केंद्र में आपका स्वागत है। बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेली हैं?",
    welcomeHint: '💡 बोलें: "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है"',
    micLabelIdle: "बोलने के लिए दबाएं",
    micLabelRecording: "रोकने के लिए दबाएं",
    micStatusIdle: "बटन दबाकर अपनी मातृभाषा में बोलें",
    micStatusListening: "🎙️ सुन रहे हैं... कृपया बोलिए",
    micStatusProcessing: "जांच की जा रही है...",
    manualPlaceholder: "या यहाँ बोलकर/लिखकर बताएं...",
    sendBtn: "जवाब भेजें ➔",
    chipsLabel: "⚡ त्वरित उदाहरण बोलें:",
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
    welcomePrompt: "प्रणाम, सेवा केंद्र में राउर स्वागत बा। बताईं, राउर उमिर केतना बा, आ रउआ शादीशुदा बानी, विधवा बानी, या अकेले बानी?",
    welcomeHint: '💡 बोलीं: "हम 48 साल के बानी, हमार पति नइखन, जमीन नइखे"',
    micLabelIdle: "बोले खातिर दबाईं",
    micLabelRecording: "रोके खातिर दबाईं",
    micStatusIdle: "बटन दबाके अपना बोली में बोलीं",
    micStatusListening: "🎙️ सुनत बानी... बोलीं",
    micStatusProcessing: "जांच हो रहल बा...",
    manualPlaceholder: "या इहाँ बोल के/लिख के बताईं...",
    sendBtn: "भेजीं ➔",
    chipsLabel: "⚡ तुरंत बोले वाला उदाहरण:",
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
    welcomePrompt: "নমস্কার, সেবা কেন্দ্রে আপনাকে স্বাগত। বলুন, আপনার বয়স কত এবং আপনি বিবাহিত, বিধবা না একা থাকেন?",
    welcomeHint: '💡 বলুন: "আমার বয়স ৪৮ বছর, স্বামী নেই, জমি নেই"',
    micLabelIdle: "বলার জন্য চাপুন",
    micLabelRecording: "থামানোর জন্য চাপুন",
    micStatusIdle: "বোতাম চেপে নিজের ভাষায় বলুন",
    micStatusListening: "🎙️ শুনছি... বলুন",
    micStatusProcessing: "যাচাই করা হচ্ছে...",
    manualPlaceholder: "অথবা এখানে লিখে/বলে জানান...",
    sendBtn: "পাঠান ➔",
    chipsLabel: "⚡ এক ক্লিকে বলার উদাহরণ:",
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
    sttCode: "hi-IN",
    brandName: "सेवा केंद्र (Seva Kendra)",
    brandTagline: "ग्रामीण नागरिक कल्याण आ योजना सहायता केंद्र",
    menuBtnText: "अन्य सेवा",
    heroTitle: "बाज के जानू अपन हकक सरकारी योजना",
    heroSubtitle: "बिना कोनो फॉर्म या दलालक — अपन मातृभाषा में कहू आ तुरंत लाभ आ कागजात जानू।",
    assistantTag: "सेवा केंद्र वाणी सहायक:",
    welcomePrompt: "प्रणाम, सेवा केंद्र में अहाँक स्वागत अछि। कहू, अहाँक उमर कते अछि, आ अहाँ विवाहित छी, विधवा छी, या अकेली छी?",
    welcomeHint: '💡 कहू: "हमर उमर 48 साल अछि, पति नहि छथि, जमीन नहि अछि"',
    micLabelIdle: "बाजए लेल दबाउ",
    micLabelRecording: "रोकए लेल दबाउ",
    micStatusIdle: "बटन दबा क अपन मातृभाषा में कहू",
    micStatusListening: "🎙️ सुनैत छी... कहू",
    micStatusProcessing: "जांच भ रहल अछि...",
    manualPlaceholder: "या एतय बाज के/लिख क पठाउ...",
    sendBtn: "पठाउ ➔",
    chipsLabel: "⚡ त्वरित उदाहरण कहू:",
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
    welcomePrompt: "Welcome to Seva Kendra. To begin, please tell me your age, and whether you are married, widowed, or single?",
    welcomeHint: '💡 Say: "I am 48 years old, a widow, and landless"',
    micLabelIdle: "Tap to Speak",
    micLabelRecording: "Tap to Stop",
    micStatusIdle: "Press button and speak in your language",
    micStatusListening: "🎙️ Listening... please speak",
    micStatusProcessing: "Processing your details...",
    manualPlaceholder: "Or type/speak your query here...",
    sendBtn: "Submit ➔",
    chipsLabel: "⚡ Quick Speech Examples:",
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
// 2. Audio Management (Zero Overlapping Voices)
// --------------------------------------------------------------------------
function stopAllAudio() {
  if (currentAudioInstance) {
    try {
      currentAudioInstance.pause();
      currentAudioInstance.currentTime = 0;
    } catch (e) {}
    currentAudioInstance = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

function playSpokenAudio(base64Audio, fallbackText = "") {
  stopAllAudio();

  if (base64Audio && base64Audio.length > 100) {
    try {
      currentAudioInstance = new Audio("data:audio/wav;base64," + base64Audio);
      currentAudioInstance.play().catch(err => {
        console.warn("Audio autoplay blocked by browser policy, fallback to TTS:", err);
        if (fallbackText) speakBrowserTTS(fallbackText);
      });
    } catch (e) {
      console.warn("Audio instance error:", e);
      if (fallbackText) speakBrowserTTS(fallbackText);
    }
  } else if (fallbackText) {
    speakBrowserTTS(fallbackText);
  }
}

function speakBrowserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  stopAllAudio();
  const utter = new SpeechSynthesisUtterance(text);
  const cfg = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  utter.lang = cfg.sttCode;
  utter.rate = 0.92;
  window.speechSynthesis.speak(utter);
}

// --------------------------------------------------------------------------
// 3. Application Initialization & Language Handling
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  initSpeechRecognition();
  await loadSchemesCatalog();
  await loadPanchayatGrievances();

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
  currentLanguage = langCode || 'hi';
  localStorage.setItem('sevakendra_lang', currentLanguage);
  sessionStorage.setItem('sevakendra_lang_confirmed', 'true');

  applyLanguage(currentLanguage);
  closeLanguageModal();

  // Reset conversation session with the new language and speak greeting
  await initSession();
}

function applyLanguage(langCode) {
  const t = I18N_TRANSLATIONS[langCode] || I18N_TRANSLATIONS.hi;
  document.documentElement.lang = langCode === 'bn' ? 'bn' : (langCode === 'en' ? 'en' : 'hi');

  // Update Language Badge in Header
  const langLabel = document.getElementById('ui-currentLangLabel');
  if (langLabel) langLabel.textContent = t.langName;

  // Update Brand and Header Texts
  const brandName = document.getElementById('ui-brandName');
  if (brandName) brandName.textContent = t.brandName;
  const brandTagline = document.getElementById('ui-brandTagline');
  if (brandTagline) brandTagline.textContent = t.brandTagline;
  const menuBtnText = document.getElementById('ui-menuBtnText');
  if (menuBtnText) menuBtnText.textContent = t.menuBtnText;

  // Update Hero Section
  const heroTitle = document.getElementById('ui-heroTitle');
  if (heroTitle) heroTitle.textContent = t.heroTitle;
  const heroSubtitle = document.getElementById('ui-heroSubtitle');
  if (heroSubtitle) heroSubtitle.textContent = t.heroSubtitle;

  // Update Assistant Prompt Area
  const assistantTag = document.getElementById('ui-assistantTag');
  if (assistantTag) assistantTag.textContent = t.assistantTag;
  const promptText = document.getElementById('assistant-prompt-text');
  if (promptText) promptText.textContent = t.welcomePrompt;
  const promptHint = document.getElementById('assistant-prompt-hint');
  if (promptHint) promptHint.textContent = t.welcomeHint;

  // Update Mic and Inputs
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

  // Update Verified Slots
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

  // Update Results Card
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

  // Update Drawer
  const drawerHead = document.getElementById('ui-drawerHeading');
  if (drawerHead) drawerHead.textContent = t.drawerHeading;

  // Update Active Card in Language Modal
  document.querySelectorAll('.lang-option-card').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick')?.includes(langCode)) {
      btn.classList.add('active');
    }
  });
}

// --------------------------------------------------------------------------
// 4. Sliding Menu Drawer Controls
// --------------------------------------------------------------------------
function toggleSlidingDrawer() {
  const drawer = document.getElementById('slidingDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer.classList.contains('active')) {
    closeSlidingDrawer();
  } else {
    openSlidingDrawer();
  }
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

// --------------------------------------------------------------------------
// 5. Web Audio PCM Capture & 16kHz WAV Encoding (Zero-Hallucination Audio)
// --------------------------------------------------------------------------
function writeWavString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF Chunk
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeWavString(view, 8, 'WAVE');

  // fmt Subchunk
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, 1, true);             // Mono
  view.setUint32(24, sampleRate, true);    // 16000
  view.setUint32(28, sampleRate * 2, true);// ByteRate
  view.setUint16(32, 2, true);             // BlockAlign
  view.setUint16(34, 16, true);            // 16-bit

  // data Subchunk
  writeWavString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM Float to 16-bit Int conversion
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function downsampleBuffer(buffers, inputSampleRate, targetSampleRate = 16000) {
  let totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  let merged = new Float32Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    merged.set(b, offset);
    offset += b.length;
  }

  if (inputSampleRate === targetSampleRate) return merged;

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(totalLength / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetMerged = 0;

  while (offsetResult < newLength) {
    const nextOffsetMerged = Math.round((offsetResult + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let i = offsetMerged; i < nextOffsetMerged && i < totalLength; i++) {
      sum += merged[i];
      count++;
    }
    result[offsetResult] = count > 0 ? sum / count : 0;
    offsetResult++;
    offsetMerged = nextOffsetMerged;
  }
  return result;
}

// --------------------------------------------------------------------------
// 6. Real-Time Speech Recognition (Live Visual Captioning)
// --------------------------------------------------------------------------
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API not supported; AudioContext PCM used exclusively.");
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = true;
  speechRecognitionInstance.interimResults = true;
  speechRecognitionInstance.maxAlternatives = 1;

  speechRecognitionInstance.onstart = () => {
    isSpeechRecognizing = true;
    showLiveSpeechBox(true);
    setMicButtonState(true);
  };

  speechRecognitionInstance.onresult = (event) => {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    const currentText = (final || interim).trim();
    if (currentText) {
      latestInterimTranscript = currentText;
      const transcriptEl = document.getElementById('liveSpeechTranscript');
      if (transcriptEl) transcriptEl.textContent = `"${currentText}"`;
      const manualInput = document.getElementById('manual-speech-input');
      if (manualInput) manualInput.value = currentText;
    }
  };

  speechRecognitionInstance.onerror = (event) => {
    console.warn("Web Speech note:", event.error);
  };

  speechRecognitionInstance.onend = () => {
    isSpeechRecognizing = false;
  };
}

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

// --------------------------------------------------------------------------
// 7. Microphone Recording Toggle & Turn Execution
// --------------------------------------------------------------------------
async function toggleRecording() {
  if (isRecording || isAudioCapturing) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  stopAllAudio(); // Stop any audio playing before starting recording
  latestInterimTranscript = "";
  pcmBuffers = [];
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;

  showLiveSpeechBox(true);
  setMicButtonState(true);

  // 1. Start parallel Web Speech API for visual text feedback
  if (speechRecognitionInstance) {
    try {
      speechRecognitionInstance.lang = t.sttCode;
      speechRecognitionInstance.start();
    } catch (e) {
      console.warn("SpeechRecognition start exception:", e.message);
    }
  }

  // 2. Start Web Audio API PCM capture (genuine 16kHz WAV for Sarvam STT)
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    rawMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    mediaStreamSource = audioCtx.createMediaStreamSource(rawMicStream);
    scriptProcessorNode = audioCtx.createScriptProcessor(4096, 1, 1);

    scriptProcessorNode.onaudioprocess = (e) => {
      if (!isRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      pcmBuffers.push(new Float32Array(input));
    };

    mediaStreamSource.connect(scriptProcessorNode);
    scriptProcessorNode.connect(audioCtx.destination);

    isRecording = true;
    isAudioCapturing = true;
  } catch (err) {
    console.warn("getUserMedia failed:", err);
    isRecording = Boolean(speechRecognitionInstance && isSpeechRecognizing);
    if (!isRecording) {
      setMicButtonState(false);
      const statusText = document.getElementById('mic-status-text');
      if (statusText) statusText.textContent = "⚠️ माइक की अनुमति नहीं मिली। नीचे दिए गए उदाहरण चुनें या लिखकर भेजें।";
    }
  }
}

async function stopRecording() {
  const wasCapturing = isRecording || isAudioCapturing;
  setMicButtonState(false);
  isRecording = false;
  isAudioCapturing = false;

  // Stop Web Speech
  if (speechRecognitionInstance) {
    try { speechRecognitionInstance.stop(); } catch (e) {}
  }

  // Disconnect AudioContext and stop tracks
  if (scriptProcessorNode) {
    try { scriptProcessorNode.disconnect(); } catch (e) {}
  }
  if (mediaStreamSource) {
    try { mediaStreamSource.disconnect(); } catch (e) {}
  }
  if (rawMicStream) {
    rawMicStream.getTracks().forEach(t => t.stop());
  }

  const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
  if (audioCtx && audioCtx.state !== 'closed') {
    try { audioCtx.close(); } catch (e) {}
  }

  // If PCM samples were captured, encode genuine 16kHz mono WAV Blob
  if (pcmBuffers.length > 0) {
    const micStatus = document.getElementById('mic-status-text');
    if (micStatus) micStatus.textContent = "पहचान की जा रही है (Sarvam STT)...";

    const downsampledSamples = downsampleBuffer(pcmBuffers, sampleRate, 16000);
    const wavBlob = encodeWav(downsampledSamples, 16000);
    await sendAudioToServer(wavBlob);
  } else if (latestInterimTranscript && latestInterimTranscript.trim().length > 1) {
    await sendSpokenText(latestInterimTranscript.trim());
  } else if (wasCapturing) {
    const micStatus = document.getElementById('mic-status-text');
    if (micStatus) micStatus.textContent = "आवाज़ नहीं सुनाई दी। कृपया दोबारा बोलें।";
  }
}

async function sendAudioToServer(audioBlob) {
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;

  try {
    const res = await fetch(`${API_BASE}/api/chat/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-session-id': currentSessionId,
        'x-language': t.sttCode,
        'x-fallback-transcript': encodeURIComponent(latestInterimTranscript || '')
      },
      body: audioBlob
    });
    const result = await res.json();
    handleTurnResponse(result);
  } catch (err) {
    console.error("Audio upload error", err);
    if (latestInterimTranscript) {
      sendSpokenText(latestInterimTranscript);
    }
  }
}

async function sendSpokenText(forcedText = null) {
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
  }
}

function setQuickInput(text) {
  const input = document.getElementById('manual-speech-input');
  if (input) input.value = text;
  sendSpokenText(text);
}

// --------------------------------------------------------------------------
// 8. Turn Response Handler (Unified Dynamic Router)
// --------------------------------------------------------------------------
function handleTurnResponse(result) {
  const micStatus = document.getElementById('mic-status-text');
  const t = I18N_TRANSLATIONS[currentLanguage] || I18N_TRANSLATIONS.hi;
  if (micStatus) micStatus.textContent = t.micStatusIdle;

  if (result.type === 'NO_SPEECH_DETECTED') {
    const liveText = document.getElementById('liveSpeechTranscript');
    if (liveText) liveText.textContent = `"${result.replyText}"`;
    playSpokenAudio(null, result.replyText);
    return;
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

  // 3. Dynamic Result Branching
  if (result.type === 'TRIAGE_RESOLVED') {
    // Open Stalled Pension Drawer module immediately!
    openSlidingDrawer();
    switchDrawerModule('drawer-triage');
    renderTriageView(result.triageData);
  } else if (result.type === 'SCHEMES_MATCHED' || result.isCompleted) {
    // Render Actionable Triad Results underneath
    renderEvaluationResults(result.evaluationResult, result.audioBase64);
  } else {
    // Natural Follow-Up Question
    setPrompt(result.replyText || result.nextPromptText, result.promptHint, result.audioBase64);
  }
}

// --------------------------------------------------------------------------
// 9. Results Rendering (Actionable Triad)
// --------------------------------------------------------------------------
function renderEvaluationResults(evaluation, audioBase64) {
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

  currentSpokenAudioBase64 = audioBase64;
  playSpokenAudio(audioBase64, evaluation.spokenScript);

  card.scrollIntoView({ behavior: 'smooth' });
}

function replaySpokenAudio() {
  if (currentSpokenAudioBase64) {
    playSpokenAudio(currentSpokenAudioBase64);
  } else {
    const text = document.getElementById('spoken-audio-transcript').textContent;
    speakBrowserTTS(text);
  }
}

// --------------------------------------------------------------------------
// 10. Session Reset & Prompt Setting
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
    setPrompt(data.promptText || t.welcomePrompt, data.promptHint || t.welcomeHint, data.audioBase64);
  } catch (err) {
    console.warn("Init fallback:", err);
    setPrompt(t.welcomePrompt, t.welcomeHint, null);
  }
}

function setPrompt(text, hint, audioBase64) {
  const textEl = document.getElementById('assistant-prompt-text');
  const hintEl = document.getElementById('assistant-prompt-hint');
  if (textEl) textEl.textContent = text;
  if (hintEl) hintEl.textContent = hint;

  currentPromptAudioBase64 = audioBase64;
  playSpokenAudio(audioBase64, text);
}

function replayCurrentPromptAudio() {
  if (currentPromptAudioBase64) {
    playSpokenAudio(currentPromptAudioBase64);
  } else {
    const text = document.getElementById('assistant-prompt-text').textContent;
    speakBrowserTTS(text);
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
// 11. Stalled Pension & DBT Recovery Triage (Inside Drawer)
// --------------------------------------------------------------------------
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

function loadParvatiTriageTest() {
  document.getElementById('triageIdentifierInput').value = "7193";
  runPensionTriage();
}

function loadRamuTriageTest() {
  document.getElementById('triageIdentifierInput').value = "3841";
  runPensionTriage();
}

function loadSakinaTriageTest() {
  document.getElementById('triageIdentifierInput').value = "6205";
  runPensionTriage();
}

function renderTriageView(data) {
  const view = document.getElementById('triageResultsView');
  view.style.display = 'block';

  const ben = data.beneficiary;
  const diag = data.diagnosis;

  document.getElementById('triageErrorCode').textContent = `त्रुटि कोड: ${diag.error_code} (${diag.disbursal_status})`;
  document.getElementById('triageBenDetails').textContent = `${ben.name} (${ben.age} वर्ष) • ${ben.village}`;
  document.getElementById('triageSchemeDetails').textContent = `योजना: ${ben.scheme} | रुकी राशि: ${ben.pending_recovery_amount}`;
  document.getElementById('triageActionText').textContent = diag.action_required;
  document.getElementById('triageTokenCode').textContent = data.ticket_token;

  currentTriageScriptText = diag.citizen_friendly_script;
  document.getElementById('triageDialectScript').textContent = `"${currentTriageScriptText}"`;

  currentTriageAudioBase64 = (data.audio && data.audio.audio_base64) ? data.audio.audio_base64 : null;
  playTriageVoice();
}

function playTriageVoice() {
  if (currentTriageAudioBase64) {
    playSpokenAudio(currentTriageAudioBase64);
  } else if (currentTriageScriptText) {
    speakBrowserTTS(currentTriageScriptText);
  }
}

// --------------------------------------------------------------------------
// 12. Offline Simulators (2G IVR & WhatsApp)
// --------------------------------------------------------------------------
function simulateIvrCall() {
  const screen = document.getElementById('ivrCaptionScreen');
  screen.innerHTML = "📞 <em>कॉल कनेक्ट हो रहा है (1800-180-SEVA)...</em>";

  setTimeout(() => {
    screen.innerHTML = "<strong>नमस्ते दीदी।</strong> मैं सेवा केंद्र वाणी सहायक हूँ। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?";
    playSpokenAudio(null, "नमस्ते दीदी। मैं सेवा केंद्र वाणी सहायक हूँ। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?");
  }, 1200);

  setTimeout(() => {
    screen.innerHTML = "<em>उपयोगकर्ता बोली: 'हम 48 साल के हैं, पति नहीं रहे।'</em>";
  }, 3500);

  setTimeout(() => {
    screen.innerHTML = "<strong>सत्यापन पूर्ण:</strong> दीदी, आप <strong>विधवा पेंशन योजना</strong> के लिए पात्र हैं। हर महीने <strong>₹1,000</strong> मिलेंगे। कागजों का SMS आपके फोन पर भेज दिया गया है।";
    playSpokenAudio(null, "दीदी, आप विधवा पेंशन योजना के लिए पात्र हैं। हर महीने ₹1,000 मिलेंगे। कागजों का SMS आपके फोन पर भेज दिया गया है।");
  }, 5500);
}

function simulateWhatsAppVoice() {
  const chatBody = document.getElementById('waChatBody');

  const userMsg = document.createElement('div');
  userMsg.className = 'wa-bubble user';
  userMsg.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span>▶️ 0:05</span>
      <span style="font-size: 10px; opacity: 0.8;"> ▂▃▅▆▇</span>
    </div>
    <div style="font-size: 9px; text-align: right; margin-top: 2px;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
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

    playSpokenAudio(null, "दीदी, आपका वॉइस नोट सुन लिया गया है। आप विधवा पेंशन और आवास योजना के लिए पात्र हैं।");
  }, 1400);
}

// --------------------------------------------------------------------------
// 13. Schemes Directory & Panchayat Desk Data Loaders
// --------------------------------------------------------------------------
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
