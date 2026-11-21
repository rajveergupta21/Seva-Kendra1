/**
 * JanSeva Kendra (सेवा केंद्र) - Universal Client Application
 * Modeled on UMANG (web.umang.gov.in) & Ministry of Agriculture (agriwelfare.gov.in)
 * Zero-Literacy Voice Controller, Pension Stoppage Triage & Panchayat Grievance Desk
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

// Initialize Application on Page Load
window.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  await loadSchemesCatalog();
  await loadPanchayatGrievances();
});

// --------------------------------------------------------------------------
// Navigation & Tab Switching (UMANG Navbar Style)
// --------------------------------------------------------------------------
function switchMainTab(tabId) {
  document.querySelectorAll('.module-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const targetPanel = document.getElementById(tabId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Highlight corresponding nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('onclick')?.includes(tabId)) {
      link.classList.add('active');
    }
  });

  // Smooth scroll to panel
  window.scrollTo({ top: document.querySelector('.main-wrapper').offsetTop - 60, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// Accessibility Helpers (AgriWelfare Portal Style)
// --------------------------------------------------------------------------
function adjustFontSize(delta) {
  if (delta === 0) currentFontSizeLevel = 0;
  else currentFontSizeLevel += delta;

  if (currentFontSizeLevel > 2) currentFontSizeLevel = 2;
  if (currentFontSizeLevel < -1) currentFontSizeLevel = -1;

  const baseSize = 15;
  document.body.style.fontSize = `${baseSize + currentFontSizeLevel * 1.5}px`;
}

function toggleHighContrast() {
  document.body.classList.toggle('high-contrast-mode');
  if (document.body.classList.contains('high-contrast-mode')) {
    document.body.style.filter = "contrast(1.25) saturate(1.1)";
  } else {
    document.body.style.filter = "none";
  }
}

function changeLanguage(lang) {
  if (lang === 'bhojpuri') {
    document.getElementById('mic-status-text').textContent = "माइक दबाके आपन भोजपुरी में बोलीं";
    document.getElementById('assistant-prompt-hint').textContent = '💡 बोलीं: "हम 48 साल के बानी, हमार पति नइखन"';
  } else if (lang === 'bn') {
    document.getElementById('mic-status-text').textContent = "মাইক চেপে আপনার বাংলায় কথা বলুন";
    document.getElementById('assistant-prompt-hint').textContent = '💡 বলুন: "আমার বয়স ৪৮ বছর, স্বামী নেই"';
  } else {
    document.getElementById('mic-status-text').textContent = "बटन दबाकर अपनी मातृभाषा में बोलें (हिन्दी / भोजपुरी)";
    document.getElementById('assistant-prompt-hint').textContent = '💡 बोलें: "हम 48 साल के हैं, हमारे पति नहीं रहे"';
  }
}

// --------------------------------------------------------------------------
// Hero Central Voice Search & Tag Clicks
// --------------------------------------------------------------------------
function triggerHeroVoiceSearch() {
  const btn = document.getElementById('heroVoiceSearchBtn');
  const text = document.getElementById('heroMicBtnText');

  if (!btn.classList.contains('listening')) {
    btn.classList.add('listening');
    text.textContent = "सुन रहे हैं...";

    // If Web Speech API is supported, listen directly
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.start();

      recognition.onresult = (event) => {
        const query = event.results[0][0].transcript;
        document.getElementById('heroSearchInput').value = query;
        processHeroSearch(query);
      };

      recognition.onend = () => {
        btn.classList.remove('listening');
        text.textContent = "माइक से बोलें";
      };

      recognition.onerror = () => {
        btn.classList.remove('listening');
        text.textContent = "माइक से बोलें";
        // Fallback demo
        processHeroSearch("हमार पेंशन 3 महीना से ना आवता");
      };
    } else {
      setTimeout(() => {
        btn.classList.remove('listening');
        text.textContent = "माइक से बोलें";
        processHeroSearch("हमार पेंशन 3 महीना से ना आवता");
      }, 1500);
    }
  } else {
    btn.classList.remove('listening');
    text.textContent = "माइक से बोलें";
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
// Module 1: Voice Scheme Eligibility (5-Turn State Machine)
// --------------------------------------------------------------------------
async function initSession() {
  currentSessionId = `session_${Date.now()}`;
  currentStepIndex = 0;
  updateStepper(0);
  const resultsCard = document.getElementById('results-card');
  if (resultsCard) resultsCard.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/chat/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId })
    });
    const data = await res.json();
    setPrompt(data.promptText, data.promptHint, data.audioBase64);
  } catch (err) {
    console.warn("Init fallback:", err);
  }
}

function updateStepper(step) {
  currentStepIndex = step;
  for (let i = 0; i < 5; i++) {
    const node = document.getElementById(`step-${i}`);
    if (!node) continue;
    node.className = 'step-node';
    if (i < step) node.classList.add('completed');
    else if (i === step) node.classList.add('active');
  }
}

function setPrompt(text, hint, audioBase64) {
  const textEl = document.getElementById('assistant-prompt-text');
  const hintEl = document.getElementById('assistant-prompt-hint');
  if (textEl) textEl.textContent = text;
  if (hintEl) hintEl.textContent = hint ? `💡 बोलें: "${hint}"` : '';

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

// Mic Recording Handlers
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await sendAudioToServer(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;

    document.getElementById('mic-btn').classList.add('recording');
    document.getElementById('mic-label').textContent = "रोकने के लिए दबाएं";
    document.getElementById('mic-status-text').textContent = "सुन रहे हैं... बोलते रहें";
    setWaveformActive(true);
  } catch (err) {
    console.warn("Mic fallback:", err);
    sendSpokenText();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  document.getElementById('mic-btn').classList.remove('recording');
  document.getElementById('mic-label').textContent = "बोलने के लिए दबाएं";
  document.getElementById('mic-status-text').textContent = "जांच की जा रही है...";
  setWaveformActive(false);
}

function setWaveformActive(active) {
  document.querySelectorAll('.wave-bar').forEach(b => {
    if (active) b.classList.add('active');
    else b.classList.remove('active');
  });
}

async function sendAudioToServer(audioBlob) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm',
        'x-session-id': currentSessionId
      },
      body: audioBlob
    });
    const result = await res.json();
    handleTurnResponse(result);
  } catch (err) {
    console.error("Audio error", err);
  }
}

async function sendSpokenText() {
  const input = document.getElementById('manual-speech-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${API_BASE}/api/chat/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        text: text
      })
    });
    const result = await res.json();
    handleTurnResponse(result);
  } catch (err) {
    console.error("Turn error", err);
  }
}

function handleTurnResponse(result) {
  const profile = result.session ? result.session.profile : {};
  if (profile.age) document.getElementById('slot-age').textContent = `${profile.age} वर्ष`;
  if (profile.marital_status) document.getElementById('slot-marital').textContent = profile.marital_status;
  if (profile.landholding_acres !== undefined && profile.landholding_acres !== null) {
    document.getElementById('slot-land').textContent = profile.landholding_acres === 0 ? "भूमिहीन" : `${profile.landholding_acres} एकड़`;
  }
  if (profile.annual_income_inr) {
    document.getElementById('slot-income').textContent = `₹${profile.annual_income_inr.toLocaleString('en-IN')}`;
  }
  if (profile.state) {
    document.getElementById('slot-location').textContent = `${profile.state} ${profile.district || ''}`;
  }

  if (result.isCompleted) {
    updateStepper(5);
    renderEvaluationResults(result.evaluationResult, result.audioBase64);
  } else {
    updateStepper(result.currentStep);
    setPrompt(result.nextPromptText, result.promptHint, result.audioBase64);
  }
}

function renderEvaluationResults(evaluation, audioBase64) {
  const card = document.getElementById('results-card');
  card.style.display = 'block';

  document.getElementById('badge-count').textContent = `${evaluation.matchedCount} योजनाएं स्वीकृत`;
  document.getElementById('badge-count').style.background = '#e8f5e9';
  document.getElementById('spoken-audio-transcript').textContent = evaluation.spokenScript;

  // Render Schemes
  const schemesList = document.getElementById('schemes-list');
  schemesList.innerHTML = evaluation.matchedSchemes.map(s => `
    <div class="scheme-item">
      <div class="scheme-name">✓ ${s.title_hi}</div>
      <div class="scheme-benefit">लाभ: ${s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr.toLocaleString('en-IN')}/माह` : `₹${s.annual_benefit_inr.toLocaleString('en-IN')} अनुदान`}</div>
    </div>
  `).join('');

  // Render 3 Documents
  const docsList = document.getElementById('docs-list');
  docsList.innerHTML = evaluation.primaryDocuments.map((doc, idx) => `
    <li><strong>[ ] ${idx + 1}.</strong> ${doc}</li>
  `).join('');

  // Render Destination Office
  document.getElementById('office-destination').textContent = evaluation.primaryOffice;

  // Render SMS
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

// 1-Click Judge Presets
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
    document.getElementById('slot-marital').textContent = profile.marital_status || 'लागू';
    document.getElementById('slot-land').textContent = profile.landholding_acres === 0 ? "भूमिहीन" : `${profile.landholding_acres} एकड़`;
    document.getElementById('slot-income').textContent = `₹${profile.annual_income_inr.toLocaleString('en-IN')}`;
    document.getElementById('slot-location').textContent = `${profile.state} ${profile.district || ''}`;

    updateStepper(4);
    renderEvaluationResults(result, result.ttsAudioBase64);
  } catch (err) {
    console.error("Preset evaluation error", err);
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
        language: "bhojpuri"
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
// Module 3: Offline Telephony & WhatsApp Simulators
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
// Module 4: Government Schemes Directory (UMANG Service Grid)
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
    const filtered = allLoadedSchemes.filter(s => s.category === cat);
    renderSchemesCards(filtered);
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
    document.getElementById('manual-speech-input').value = `हम ${target.title_hi} के लिए आवेदन करना चाहते हैं।`;
  }
}

// --------------------------------------------------------------------------
// Module 5: Gram Panchayat Secretary Desk
// --------------------------------------------------------------------------
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
// Audio & Voice Synthesis Helpers
// --------------------------------------------------------------------------
function playBase64Audio(base64) {
  try {
    const audio = new Audio("data:audio/wav;base64," + base64);
    audio.play();
  } catch (err) {
    console.warn("Audio play error", err);
  }
}

function speakBrowserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  utter.rate = 0.90; // Paced cadence for rural comprehension
  window.speechSynthesis.speak(utter);
}
