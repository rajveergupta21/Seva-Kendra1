/**
 * JanSeva Kendra (सेवा केंद्र) - Universal Client Application
 * Modeled on UMANG (web.umang.gov.in) & Ministry of Agriculture (agriwelfare.gov.in)
 * Zero-Literacy Voice Controller, Real-time Speech-to-Text & Sarvam AI Integration
 */

const API_BASE = window.location.origin;
let currentSessionId = `session_${Date.now()}`;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentPromptAudioBase64 = null;
let currentSpokenAudioBase64 = null;
let currentTriageAudioBase64 = null;
let currentTriageScriptText = "";
let currentStepIndex = 0;
let currentCategoryFilter = 'all';
let allLoadedSchemes = [];
let currentFontSizeLevel = 0;

// Language & Speech State
let currentLanguage = 'hi';
let speechRecognitionInstance = null;
let isSpeechRecognizing = false;
let latestInterimTranscript = "";

// Dialect greetings for welcome audio
const LANGUAGE_CONFIG = {
  hi: {
    name: "हिन्दी",
    sttCode: "hi-IN",
    welcomeText: "नमस्ते, जनसेवा केंद्र में आपका स्वागत है। बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेली हैं?",
    hintText: '💡 बोलें: "हम 48 साल के हैं, हमारे पति नहीं रहे"',
    statusListening: "🎙️ सुन रहे हैं... कृपया बोलिए",
    statusProcessing: "जांच की जा रही है..."
  },
  bhojpuri: {
    name: "भोजपुरी",
    sttCode: "hi-IN",
    welcomeText: "प्रणाम, जनसेवा केंद्र में राउर स्वागत बा। बताईं, राउर उमिर केतना बा, आ रउआ शादीशुदा बानी, विधवा बानी, या अकेले बानी?",
    hintText: '💡 बोलीं: "हम 48 साल के बानी, हमार पति नइखन"',
    statusListening: "🎙️ सुनत बानी... बोलीं",
    statusProcessing: "जांच हो रहल बा..."
  },
  bn: {
    name: "বাংলা",
    sttCode: "bn-IN",
    welcomeText: "নমস্কার, জনসেবা কেন্দ্রে আপনাকে স্বাগত। বলুন, আপনার বয়স কত এবং আপনি বিবাহিত, বিধবা না একা থাকেন?",
    hintText: '💡 বলুন: "আমার বয়স ৪৮ বছর, স্বামী নেই"',
    statusListening: "🎙️ শুনছি... বলুন",
    statusProcessing: "যাচাই করা হচ্ছে..."
  },
  maithili: {
    name: "मैथिली",
    sttCode: "hi-IN",
    welcomeText: "प्रणाम, जनसेवा केंद्र में अहाँक स्वागत अछि। कहू, अहाँक उमर कते अछि, आ अहाँ विवाहित छी, विधवा छी, या अकेली छी?",
    hintText: '💡 कहू: "हमर उमर 48 साल अछि, पति नहि छथि"',
    statusListening: "🎙️ सुनैत छी... कहू",
    statusProcessing: "जांच भ रहल अछि..."
  },
  en: {
    name: "English",
    sttCode: "en-IN",
    welcomeText: "Welcome to JanSeva Kendra. To begin, please tell me your age, and whether you are married, widowed, or single?",
    hintText: '💡 Say: "I am 48 years old and a widow"',
    statusListening: "🎙️ Listening... please speak",
    statusProcessing: "Processing your request..."
  }
};

// Preset profiles for instant judge evaluation
const PRESETS = {
  kamla: {
    name: "कमला देवी (उत्तर प्रदेश)",
    age: 49,
    gender: "female",
    marital_status: "widow",
    landholding_acres: 0.0,
    annual_income_inr: 45000,
    is_tax_payer: false,
    pregnant_or_lactating: false,
    has_minor_daughter: false,
    kutcha_house_or_homeless: true,
    is_informal_worker_or_vendor: false,
    state: "Uttar Pradesh",
    district: "Chandauli"
  },
  ramesh: {
    name: "रमेश कुमार (बिहार)",
    age: 42,
    gender: "male",
    marital_status: "married",
    landholding_acres: 2.5,
    annual_income_inr: 75000,
    is_tax_payer: false,
    pregnant_or_lactating: false,
    has_minor_daughter: false,
    kutcha_house_or_homeless: false,
    is_informal_worker_or_vendor: false,
    state: "Bihar",
    district: "Samastipur"
  },
  sunita: {
    name: "सुनीता देवी (मध्य प्रदेश)",
    age: 23,
    gender: "female",
    marital_status: "married",
    landholding_acres: 0.0,
    annual_income_inr: 35000,
    is_tax_payer: false,
    pregnant_or_lactating: true,
    has_minor_daughter: true,
    kutcha_house_or_homeless: true,
    is_informal_worker_or_vendor: false,
    state: "Madhya Pradesh",
    district: "Rewa"
  },
  elderly: {
    name: "मुन्ना लाल (उत्तर प्रदेश)",
    age: 63,
    gender: "male",
    marital_status: "married",
    landholding_acres: 0.0,
    annual_income_inr: 30000,
    is_tax_payer: false,
    pregnant_or_lactating: false,
    has_minor_daughter: false,
    kutcha_house_or_homeless: true,
    is_informal_worker_or_vendor: true,
    state: "Uttar Pradesh",
    district: "Varanasi"
  }
};

// --------------------------------------------------------------------------
// Application Initialization
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  initSpeechRecognition();
  await loadSchemesCatalog();
  await loadPanchayatGrievances();

  // Check if language was selected this session
  const storedLang = localStorage.getItem('janseva_lang');
  const sessionConfirmed = sessionStorage.getItem('janseva_lang_confirmed');

  if (!sessionConfirmed) {
    openLanguageModal();
  } else {
    currentLanguage = storedLang || 'hi';
    const selector = document.getElementById('globalLangSelector');
    if (selector) selector.value = currentLanguage;
    await initSession();
  }
});

// --------------------------------------------------------------------------
// Language Selection Modal (First-Interaction Step)
// --------------------------------------------------------------------------
function openLanguageModal() {
  const overlay = document.getElementById('langModalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function closeLanguageModal() {
  const overlay = document.getElementById('langModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function selectInitialLanguage(langCode) {
  currentLanguage = langCode || 'hi';
  localStorage.setItem('janseva_lang', currentLanguage);
  sessionStorage.setItem('janseva_lang_confirmed', 'true');

  const selector = document.getElementById('globalLangSelector');
  if (selector) selector.value = currentLanguage;

  closeLanguageModal();

  // Re-initialize session with chosen language
  await initSession();
}

// --------------------------------------------------------------------------
// Navigation & Tab Switching
// --------------------------------------------------------------------------
function switchMainTab(tabId) {
  document.querySelectorAll('.module-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const targetPanel = document.getElementById(tabId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('onclick')?.includes(tabId)) {
      link.classList.add('active');
    }
  });

  const mainWrapper = document.querySelector('.main-wrapper');
  if (mainWrapper) {
    window.scrollTo({ top: mainWrapper.offsetTop - 60, behavior: 'smooth' });
  }
}

// --------------------------------------------------------------------------
// Accessibility Helpers
// --------------------------------------------------------------------------
function adjustFontSize(delta) {
  if (delta === 0) currentFontSizeLevel = 0;
  else currentFontSizeLevel += delta;

  if (currentFontSizeLevel > 2) currentFontSizeLevel = 2;
  if (currentFontSizeLevel < -1) currentFontSizeLevel = -1;

  document.body.style.fontSize = `${15 + currentFontSizeLevel * 1.5}px`;
}

function toggleHighContrast() {
  document.body.classList.toggle('high-contrast-mode');
  document.body.style.filter = document.body.classList.contains('high-contrast-mode')
    ? "contrast(1.3) saturate(1.1)"
    : "none";
}

// --------------------------------------------------------------------------
// Web Audio PCM Capture & 16kHz WAV Encoding (Zero-Hallucination Audio Engine)
// --------------------------------------------------------------------------
let audioCtx = null;
let mediaStreamSource = null;
let scriptProcessorNode = null;
let rawMicStream = null;
let pcmBuffers = [];
let isAudioCapturing = false;

function writeWavString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeWavString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16)

  // data sub-chunk
  writeWavString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
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
// Speech Recognition & Live Visualizer
// --------------------------------------------------------------------------
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API not supported; using direct AudioContext / Sarvam STT.");
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = true;
  speechRecognitionInstance.interimResults = true;
  speechRecognitionInstance.maxAlternatives = 1;

  speechRecognitionInstance.onstart = () => {
    isSpeechRecognizing = true;
    showLiveSpeechBox(true);
    updateLiveSpeechStatus("🎙️ आवाज़ सुनी जा रही है... बोलते रहें (Listening...)");
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
    console.warn("Web Speech notice:", event.error);
    // Don't kill audio capture; AudioContext captures genuine 16kHz WAV concurrently
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

function updateLiveSpeechStatus(statusMsg) {
  const statusEl = document.getElementById('liveSpeechStatusText');
  if (statusEl) statusEl.textContent = statusMsg;
}

function setMicButtonState(recording) {
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const micStatus = document.getElementById('mic-status-text');
  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;

  if (recording) {
    if (micBtn) micBtn.classList.add('recording');
    if (micLabel) micLabel.textContent = "रोकने के लिए दबाएं (Stop)";
    if (micStatus) micStatus.textContent = cfg.statusListening;
    setWaveformActive(true);
  } else {
    if (micBtn) micBtn.classList.remove('recording');
    if (micLabel) micLabel.textContent = "बोलने के लिए दबाएं (Speak)";
    if (micStatus) micStatus.textContent = cfg.statusProcessing;
    setWaveformActive(false);
  }
}

// --------------------------------------------------------------------------
// Microphone Toggle & Recording Lifecycle
// --------------------------------------------------------------------------
async function toggleRecording() {
  if (isRecording || isAudioCapturing) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  latestInterimTranscript = "";
  pcmBuffers = [];
  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;

  showLiveSpeechBox(true);
  setMicButtonState(true);
  updateLiveSpeechStatus("🎙️ माइक सक्रिय है... कृपया बोलें");

  // 1. Start parallel Web Speech API for real-time visual captioning
  if (speechRecognitionInstance) {
    try {
      speechRecognitionInstance.lang = cfg.sttCode;
      speechRecognitionInstance.start();
    } catch (e) {
      console.warn("SpeechRecognition start notice:", e.message);
    }
  }

  // 2. Start Web Audio API PCM capture (produces genuine 16kHz WAV for Sarvam STT)
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
    console.warn("Web Audio API getUserMedia failed/blocked:", err);
    isRecording = Boolean(speechRecognitionInstance && isSpeechRecognizing);
    if (!isRecording) {
      setMicButtonState(false);
      updateLiveSpeechStatus("⚠️ माइक की अनुमति नहीं मिली। कृपया नीचे बॉक्स में लिखकर या विकल्प चुनकर भेजें।");
    }
  }
}

async function stopRecording() {
  setMicButtonState(false);
  const wasCapturing = isRecording || isAudioCapturing;
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

  // If we collected PCM samples, encode genuine 16kHz mono WAV Blob
  if (pcmBuffers.length > 0) {
    updateLiveSpeechStatus("आवाज़ की जांच हो रही है (Sarvam Saaras v3)...");
    const downsampledSamples = downsampleBuffer(pcmBuffers, sampleRate, 16000);
    const wavBlob = encodeWav(downsampledSamples, 16000);
    await sendAudioToServer(wavBlob);
  } else if (latestInterimTranscript && latestInterimTranscript.trim().length > 1) {
    sendSpokenText(latestInterimTranscript.trim());
  } else if (wasCapturing) {
    updateLiveSpeechStatus("आवाज़ नहीं सुनाई दी। कृपया दोबारा बोलें या नीचे दिए गए विकल्प चुनें।");
  }
}

function setWaveformActive(active) {
  document.querySelectorAll('.wave-bar').forEach(b => {
    if (active) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function setQuickInput(text) {
  const input = document.getElementById('manual-speech-input');
  if (input) input.value = text;
  sendSpokenText(text);
}

async function sendSpokenText(forcedText = null) {
  const input = document.getElementById('manual-speech-input');
  const text = (forcedText || (input ? input.value : "")).trim();
  if (!text) return;

  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;
  showLiveSpeechBox(true);
  updateLiveSpeechStatus(`जांच चल रही है: "${text}"...`);
  const transcriptEl = document.getElementById('liveSpeechTranscript');
  if (transcriptEl) transcriptEl.textContent = `"${text}"`;

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

async function sendAudioToServer(audioBlob) {
  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;
  updateLiveSpeechStatus("ऑडियो सार्वम एआई (saaras:v3) को भेजा जा रहा है...");

  try {
    const res = await fetch(`${API_BASE}/api/chat/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-session-id': currentSessionId,
        'x-language': cfg.sttCode,
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

function updateDynamicStage(stage) {
  for (let s = 1; s <= 3; s++) {
    const node = document.getElementById(`step-stage-${s}`);
    if (!node) continue;
    node.className = 'step-node';
    if (s < stage) node.classList.add('completed');
    else if (s === stage) node.classList.add('active');
  }
}

function handleTurnResponse(result) {
  if (result.type === 'NO_SPEECH_DETECTED') {
    updateLiveSpeechStatus(result.replyText);
    speakBrowserTTS(result.replyText);
    return;
  }

  // 1. Update verified slots
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

  // 2. Show user's recognized words
  if (result.userTranscript) {
    const liveText = document.getElementById('liveSpeechTranscript');
    if (liveText) liveText.textContent = `"${result.userTranscript}"`;
    const manualInput = document.getElementById('manual-speech-input');
    if (manualInput) manualInput.value = result.userTranscript;
    updateLiveSpeechStatus(`✓ पहचाना गया: "${result.userTranscript}"`);
  }

  // 3. Branch by dynamic result type
  if (result.type === 'TRIAGE_RESOLVED') {
    updateDynamicStage(3);
    switchMainTab('tab-stoppage-triage');
    renderTriageView(result.triageData);
  } else if (result.type === 'SCHEMES_MATCHED' || result.isCompleted) {
    updateDynamicStage(3);
    renderEvaluationResults(result.evaluationResult, result.audioBase64);
  } else {
    // Follow-up question
    updateDynamicStage(2);
    setPrompt(result.replyText || result.nextPromptText, result.promptHint, result.audioBase64);
  }
}

function renderEvaluationResults(evaluation, audioBase64) {
  const card = document.getElementById('results-card');
  card.style.display = 'block';

  document.getElementById('badge-count').textContent = `${evaluation.matchedCount} योजनाएं स्वीकृत`;
  document.getElementById('badge-count').style.background = '#e8f5e9';
  document.getElementById('spoken-audio-transcript').textContent = evaluation.spokenScript;

  // Schemes List
  const schemesList = document.getElementById('schemes-list');
  schemesList.innerHTML = evaluation.matchedSchemes.map(s => `
    <div class="scheme-item">
      <div class="scheme-name">✓ ${s.title_hi}</div>
      <div class="scheme-benefit">लाभ: ${s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr.toLocaleString('en-IN')}/माह` : `₹${s.annual_benefit_inr.toLocaleString('en-IN')} वार्षिक अनुदान`}</div>
    </div>
  `).join('');

  // 3 Physical Documents
  const docsList = document.getElementById('docs-list');
  docsList.innerHTML = evaluation.primaryDocuments.map((doc, idx) => `
    <li><strong>[ ] ${idx + 1}.</strong> ${doc}</li>
  `).join('');

  // Office Destination
  document.getElementById('office-destination').textContent = evaluation.primaryOffice;

  // SMS Action Slip
  document.getElementById('sms-text-content').textContent = evaluation.smsChecklist;

  currentSpokenAudioBase64 = audioBase64;
  if (audioBase64) {
    playBase64Audio(audioBase64);
  } else {
    speakBrowserTTS(evaluation.spokenScript);
  }

  card.scrollIntoView({ behavior: 'smooth' });
}

function replaySpokenAudio() {
  if (currentSpokenAudioBase64) {
    playBase64Audio(currentSpokenAudioBase64);
  } else {
    const text = document.getElementById('spoken-audio-transcript').textContent;
    speakBrowserTTS(text);
  }
}

// --------------------------------------------------------------------------
// Session & Stepper Control
// --------------------------------------------------------------------------
async function initSession() {
  currentSessionId = `session_${Date.now()}`;
  updateDynamicStage(1);
  const resultsCard = document.getElementById('results-card');
  if (resultsCard) resultsCard.style.display = 'none';

  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;

  try {
    const res = await fetch(`${API_BASE}/api/chat/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId, language: currentLanguage })
    });
    const data = await res.json();
    setPrompt(data.promptText || cfg.welcomeText, data.promptHint || cfg.hintText, data.audioBase64);
  } catch (err) {
    console.warn("Init fallback:", err);
    setPrompt(cfg.welcomeText, cfg.hintText, null);
  }
}

function setPrompt(text, hint, audioBase64) {
  const textEl = document.getElementById('assistant-prompt-text');
  const hintEl = document.getElementById('assistant-prompt-hint');
  if (textEl) textEl.textContent = text;
  if (hintEl) hintEl.textContent = hint;

  currentPromptAudioBase64 = audioBase64;
  if (audioBase64) {
    playBase64Audio(audioBase64);
  } else {
    speakBrowserTTS(text);
  }
}

function replayCurrentPromptAudio() {
  if (currentPromptAudioBase64) {
    playBase64Audio(currentPromptAudioBase64);
  } else {
    const text = document.getElementById('assistant-prompt-text').textContent;
    speakBrowserTTS(text);
  }
}

function resetInterview() {
  initSession();
  document.getElementById('slot-age').textContent = "--";
  document.getElementById('slot-marital').textContent = "--";
  document.getElementById('slot-land').textContent = "--";
  document.getElementById('slot-income').textContent = "--";
  document.getElementById('slot-location').textContent = "--";
  document.getElementById('results-card').style.display = 'none';
  showLiveSpeechBox(false);
}

// --------------------------------------------------------------------------
// Hero Central Voice Search
// --------------------------------------------------------------------------
function triggerHeroVoiceSearch() {
  const btn = document.getElementById('heroVoiceSearchBtn');
  const text = document.getElementById('heroMicBtnText');
  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;

  if (speechRecognitionInstance) {
    speechRecognitionInstance.lang = cfg.sttCode;
    speechRecognitionInstance.onresult = (event) => {
      const query = event.results[0][0].transcript;
      document.getElementById('heroSearchInput').value = query;
      processHeroSearch(query);
    };
    speechRecognitionInstance.start();
    btn.classList.add('listening');
    text.textContent = "सुन रहे हैं...";

    speechRecognitionInstance.onend = () => {
      btn.classList.remove('listening');
      text.textContent = "माइक से बोलें";
    };
  } else {
    processHeroSearch("हमार पेंशन 3 महीना से ना आवता");
  }
}

function quickSearchTag(tagText) {
  document.getElementById('heroSearchInput').value = tagText;
  processHeroSearch(tagText);
}

function processHeroSearch(query) {
  const lower = query.toLowerCase();
  if (lower.includes('रुकी') || lower.includes('पेंशन नहीं') || lower.includes('ना आवता') || lower.includes('stoppage')) {
    switchMainTab('tab-stoppage-triage');
    document.getElementById('triageIdentifierInput').value = "7193";
    runPensionTriage();
  } else {
    switchMainTab('tab-schemes-directory');
    document.getElementById('catalogSearchField').value = query;
    filterSchemesCards(query);
  }
}

// --------------------------------------------------------------------------
// Module 2: Stalled Pension & DBT Recovery Triage
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
  view.style.display = 'grid';

  const ben = data.beneficiary;
  const diag = data.diagnosis;

  document.getElementById('triageErrorCode').textContent = `त्रुटि कोड: ${diag.error_code} (${diag.disbursal_status})`;
  document.getElementById('triageBenDetails').textContent = `${ben.name} (${ben.age} वर्ष) • ${ben.village}`;
  document.getElementById('triageSchemeDetails').textContent = `योजना: ${ben.scheme} | रुकी राशि: ${ben.pending_recovery_amount}`;
  document.getElementById('triageActionText').textContent = diag.action_required;
  document.getElementById('triageTokenCode').textContent = data.ticket_token;
  document.getElementById('triageEscalationText').textContent = diag.panchayat_escalation;

  currentTriageScriptText = diag.citizen_friendly_script;
  document.getElementById('triageDialectScript').textContent = `"${currentTriageScriptText}"`;

  currentTriageAudioBase64 = (data.audio && data.audio.audio_base64) ? data.audio.audio_base64 : null;
  playTriageVoice();

  view.scrollIntoView({ behavior: 'smooth' });
}

function playTriageVoice() {
  if (currentTriageAudioBase64) {
    playBase64Audio(currentTriageAudioBase64);
  } else if (currentTriageScriptText) {
    speakBrowserTTS(currentTriageScriptText);
  }
}

// --------------------------------------------------------------------------
// 1-Click Judge Presets
// --------------------------------------------------------------------------
async function loadPreset(presetKey) {
  document.querySelectorAll('.preset-pill-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  const profile = PRESETS[presetKey];
  if (!profile) return;

  try {
    const res = await fetch(`${API_BASE}/api/evaluate/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const result = await res.json();

    document.getElementById('slot-age').textContent = `${profile.age} वर्ष`;
    document.getElementById('slot-marital').textContent = profile.marital_status === 'widow' ? 'विधवा' : (profile.marital_status === 'married' ? 'विवाहित' : 'लागू');
    document.getElementById('slot-land').textContent = profile.landholding_acres === 0 ? "भूमिहीन" : `${profile.landholding_acres} एकड़`;
    document.getElementById('slot-income').textContent = `₹${profile.annual_income_inr.toLocaleString('en-IN')}`;
    document.getElementById('slot-location').textContent = `${profile.state} ${profile.district || ''}`;

    updateDynamicStage(3);
    renderEvaluationResults(result, result.ttsAudioBase64);
  } catch (err) {
    console.error("Preset evaluation error", err);
  }
}

// --------------------------------------------------------------------------
// Offline Simulators (2G IVR & WhatsApp)
// --------------------------------------------------------------------------
function simulateIvrCall() {
  const screen = document.getElementById('ivrCaptionScreen');
  screen.innerHTML = "📞 <em>कॉल कनेक्ट हो रहा है (1800-180-SEVA)...</em>";

  setTimeout(() => {
    screen.innerHTML = "<strong>नमस्ते दीदी।</strong> मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?";
    speakBrowserTTS("नमस्ते दीदी। मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?");
  }, 1200);

  setTimeout(() => {
    screen.innerHTML = "<em>उपयोगकर्ता बोली: 'हम 48 साल के हैं, पति नहीं रहे।'</em>";
  }, 3500);

  setTimeout(() => {
    screen.innerHTML = "<strong>सत्यापन पूर्ण:</strong> दीदी, आप <strong>विधवा पेंशन योजना</strong> के लिए पात्र हैं। हर महीने <strong>₹1,000</strong> मिलेंगे। कागजों का SMS आपके फोन पर भेजा गया है।";
    speakBrowserTTS("दीदी, आप विधवा पेंशन योजना के लिए पात्र हैं। हर महीने ₹1,000 मिलेंगे। कागजों का SMS आपके फोन पर भेजा गया है।");
  }, 5500);
}

function simulateWhatsAppVoice() {
  const chatBody = document.getElementById('waChatBody');

  const userMsg = document.createElement('div');
  userMsg.className = 'wa-bubble user';
  userMsg.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span>▶️ 0:06</span>
      <span style="font-size: 9px; opacity: 0.8;"> ▂▃▅▆▇</span>
    </div>
    <div style="font-size: 9px; text-align: right; margin-top: 2px;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
  `;
  chatBody.appendChild(userMsg);

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'wa-bubble bot';
    botMsg.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span>▶️ 0:28</span>
        <span style="font-size: 9px; opacity: 0.8;"> ▂▃▅▆▇</span>
      </div>
      <div style="margin-top: 4px; font-size: 11px; line-height: 1.4;">
        <strong>सेवा केंद्र योजना पर्ची:</strong><br>
        ✓ उ.प्र. विधवा पेंशन: ₹1,000/माह<br>
        ✓ पीएम आवास: ₹1,20,000<br>
        <small style="color: #7dd3fc;">3 कागज़ ले जाएं: आधार, मृत्यु प्रमाण पत्र, पासबुक।</small>
      </div>
      <div style="font-size: 9px; text-align: right; margin-top: 2px;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    chatBody.appendChild(botMsg);
    chatBody.scrollTop = chatBody.scrollHeight;

    speakBrowserTTS("दीदी, आपका वॉइस नोट सुन लिया गया है। आप विधवा पेंशन और आवास योजना के लिए पात्र हैं।");
  }, 1400);
}

// --------------------------------------------------------------------------
// Schemes Catalog & Panchayat Desk
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
    <div class="scheme-card-item">
      <div>
        <div class="scheme-ministry-tag">🏛️ ${s.category || 'भारत सरकार कल्याण'}</div>
        <div class="scheme-card-title">${s.title_hi}</div>
        <div class="scheme-card-benefit">
          💰 ${s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr.toLocaleString('en-IN')}/माह` : `₹${s.annual_benefit_inr.toLocaleString('en-IN')} वार्षिक अनुदान`}
        </div>
        <div class="scheme-card-docs">
          <strong>ज़रूरी कागज़:</strong><br>
          ${s.documents_hi ? s.documents_hi.slice(0, 3).map(d => `• ${d}`).join('<br>') : 'आधार कार्ड, बैंक पासबुक'}
        </div>
      </div>
      <button class="scheme-apply-btn" onclick="startVoiceApply('${s.id}')">
        🎙️ बोलकर आवेदन करें
      </button>
    </div>
  `).join('');
}

function filterCategory(cat, btn) {
  currentCategoryFilter = cat;
  document.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (cat === 'all') {
    renderSchemesCards(allLoadedSchemes);
  } else {
    renderSchemesCards(allLoadedSchemes.filter(s => s.category === cat));
  }
}

function filterSchemesCards(query) {
  if (!query) {
    filterCategory(currentCategoryFilter);
    return;
  }
  const lower = query.toLowerCase();
  const matched = allLoadedSchemes.filter(s => 
    s.title_hi.toLowerCase().includes(lower) || 
    (s.title_en && s.title_en.toLowerCase().includes(lower)) ||
    (s.category && s.category.toLowerCase().includes(lower))
  );
  renderSchemesCards(matched);
}

function startVoiceApply(schemeId) {
  switchMainTab('tab-voice-eligibility');
  const target = allLoadedSchemes.find(s => s.id === schemeId);
  if (target) {
    setQuickInput(`हम ${target.title_hi} के लिए आवेदन करना चाहते हैं।`);
  }
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
        <td><strong>${g.id}</strong></td>
        <td><strong>${g.citizen}</strong><br><small style="color:#64748b;">${g.phone}</small></td>
        <td>${g.village}</td>
        <td><span style="color:var(--gov-navy); font-weight:700;">${g.scheme}</span></td>
        <td><strong style="color:#dc2626;">${g.amount_blocked}</strong></td>
        <td>${g.issue}</td>
        <td>${g.remediation}</td>
        <td><span class="status-tag alert-sent">${g.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Grievance load error", err);
  }
}

// --------------------------------------------------------------------------
// Audio Playback
// --------------------------------------------------------------------------
function playBase64Audio(base64) {
  try {
    const audio = new Audio("data:audio/wav;base64," + base64);
    audio.play().catch(err => {
      console.warn("Audio autoplay blocked by browser policy, user interaction required:", err);
    });
  } catch (err) {
    console.warn("Audio play error", err);
  }
}

function speakBrowserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const cfg = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.hi;
  utter.lang = cfg.sttCode;
  utter.rate = 0.90;
  window.speechSynthesis.speak(utter);
}
