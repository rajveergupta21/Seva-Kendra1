/**
 * JanKalyan Voice Gateway - Frontend Application
 * Zero-Literacy Voice Controller & Judge Simulation Console
 */

const API_BASE = window.location.origin;
let currentSessionId = `session_${Date.now()}`;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentPromptAudioBase64 = null;
let currentSpokenAudioBase64 = null;
let currentStepIndex = 0;

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

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  loadSchemesCatalog();
});

// Switch Channel Tabs
function switchChannel(channel) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.channel-panel').forEach(p => p.classList.remove('active'));

  document.getElementById(`tab-${channel}`).classList.add('active');
  document.getElementById(`panel-${channel}`).classList.add('active');
}

// Reset and Initialize Session
async function initSession() {
  currentSessionId = `session_${Date.now()}`;
  currentStepIndex = 0;
  updateStepper(0);
  document.getElementById('results-card').style.display = 'none';

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
  document.getElementById('assistant-prompt-text').textContent = text;
  document.getElementById('assistant-prompt-hint').textContent = hint ? `💡 बोलें: "${hint}"` : '';
  currentPromptAudioBase64 = audioBase64;
  if (audioBase64) {
    playBase64Audio(audioBase64);
  } else {
    speakBrowserTTS(text);
  }
}

// Voice Recording Handlers
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

    // UI Updates
    document.getElementById('mic-btn').classList.add('recording');
    document.getElementById('mic-label').textContent = "सुन रहा हूँ...";
    document.getElementById('mic-status-text').textContent = "आप बोल रहे हैं... रोकने के लिए दोबारा दबाएं";
    document.getElementById('waveform').classList.add('active');

  } catch (err) {
    console.error("Microphone access failed", err);
    alert("माइक्रोफोन शुरू नहीं हो सका। कृपया टेक्स्ट बॉक्स का उपयोग करें।");
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    isRecording = false;

    // UI Updates
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('mic-label').textContent = "बोलने के लिए दबाएं";
    document.getElementById('mic-status-text').textContent = "आवाज़ जांची जा रही है (Sarvam Saarika)...";
    document.getElementById('waveform').classList.remove('active');
  }
}

// Send Audio Blob to Server
async function sendAudioToServer(audioBlob) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/audio`, {
      method: 'POST',
      headers: {
        'x-session-id': currentSessionId,
        'content-type': 'audio/webm'
      },
      body: audioBlob
    });

    const data = await res.json();
    handleTurnResponse(data);
  } catch (err) {
    console.error("Audio upload error", err);
  }
}

// Send Manual Text Input
async function sendSpokenText() {
  const input = document.getElementById('manual-speech-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${API_BASE}/api/chat/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId, text })
    });
    const data = await res.json();
    handleTurnResponse(data);
    input.value = "";
  } catch (err) {
    console.error("Text send error", err);
  }
}

// Process Dialog Turn Output
function handleTurnResponse(data) {
  const session = data.session || {};
  const profile = session.profile || {};

  // Update Slots Display
  if (profile.age) document.getElementById('slot-age').textContent = `${profile.age} वर्ष`;
  if (profile.marital_status) {
    const statusMap = { widow: 'विधवा', married: 'विवाहित', single: 'अविवाहित' };
    document.getElementById('slot-marital').textContent = statusMap[profile.marital_status] || profile.marital_status;
  }
  if (typeof profile.landholding_acres === 'number') {
    document.getElementById('slot-land').textContent = profile.landholding_acres === 0 ? "भूमिहीन (0 एकड़)" : `${profile.landholding_acres} एकड़`;
  }
  if (profile.annual_income_inr) {
    document.getElementById('slot-income').textContent = `₹${profile.annual_income_inr.toLocaleString('en-IN')}`;
  }
  if (profile.state) {
    document.getElementById('slot-location').textContent = `${profile.state} ${profile.district || ''}`;
  }

  // Update Stepper
  updateStepper(session.currentStep || currentStepIndex + 1);

  if (data.isCompleted) {
    renderEvaluationResults(data.evaluationResult, data.ttsAudioBase64);
  } else {
    setPrompt(data.nextPromptText, data.nextPromptHint, data.ttsAudioBase64);
  }
}

// Render Results: The Actionable Triad
function renderEvaluationResults(result, audioBase64) {
  if (!result) return;

  const card = document.getElementById('results-card');
  card.style.display = 'block';

  document.getElementById('badge-count').textContent = `${result.topSchemes.length} योजनाएं स्वीकृत`;
  document.getElementById('spoken-audio-transcript').textContent = result.spokenScript;
  currentSpokenAudioBase64 = audioBase64 || result.ttsAudioBase64;

  // 1. Schemes List
  const schemesList = document.getElementById('schemes-list');
  schemesList.innerHTML = "";
  result.topSchemes.forEach(s => {
    const div = document.createElement('div');
    div.className = 'scheme-item';
    const benefitStr = s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr} / महीना` : `₹${s.annual_benefit_inr} सहायता`;
    div.innerHTML = `
      <div class="scheme-name">${s.title_hi}</div>
      <div class="scheme-benefit">लाभ: ${benefitStr}</div>
      <small style="color:#64748b;">${s.spoken_summary_hi}</small>
    `;
    schemesList.appendChild(div);
  });

  // 2. Documents
  const docsList = document.getElementById('docs-list');
  docsList.innerHTML = "";
  result.primaryDocuments.forEach(doc => {
    const li = document.createElement('li');
    li.textContent = doc;
    docsList.appendChild(li);
  });

  // 3. Office
  document.getElementById('office-destination').textContent = result.primaryOffice;

  // 4. SMS Slip
  document.getElementById('sms-text-content').textContent = result.smsChecklist;

  // Play audio
  if (currentSpokenAudioBase64) {
    playBase64Audio(currentSpokenAudioBase64);
  } else {
    speakBrowserTTS(result.spokenScript);
  }

  // Scroll down smoothly
  card.scrollIntoView({ behavior: 'smooth' });
}

// Audio Playback Helpers
function playBase64Audio(base64) {
  try {
    const audio = new Audio("data:audio/wav;base64," + base64);
    audio.play();
  } catch (e) {
    console.error("Audio playback error", e);
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

function replaySpokenAudio() {
  if (currentSpokenAudioBase64) {
    playBase64Audio(currentSpokenAudioBase64);
  } else {
    const text = document.getElementById('spoken-audio-transcript').textContent;
    speakBrowserTTS(text);
  }
}

function speakBrowserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// 1-Click Judge Presets
async function loadPreset(presetKey) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const profile = PRESETS[presetKey];
  if (!profile) return;

  try {
    const res = await fetch(`${API_BASE}/api/evaluate/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const result = await res.json();

    // Populate UI
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

// 1-Click Entitlement Stoppage & Pension Triage Preset
async function loadTriagePreset(key) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  try {
    const res = await fetch(`${API_BASE}/api/triage/pension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "हमार पेंशन तीन महीना से ना आवता, का बात बा?",
        identifier: "7193",
        language: "bhojpuri"
      })
    });
    const data = await res.json();
    const ben = data.beneficiary;
    const diag = data.diagnosis;

    // Update slots display
    document.getElementById('slot-age').textContent = `${ben.age} वर्ष`;
    document.getElementById('slot-marital').textContent = "विधवा (Widow)";
    document.getElementById('slot-land').textContent = "भूमिहीन (Landless)";
    document.getElementById('slot-income').textContent = "रुकी पेंशन: ₹3,000";
    document.getElementById('slot-location').textContent = ben.village;

    // Show custom results for pension stoppage
    const resultsCard = document.getElementById('results-card');
    resultsCard.style.display = 'block';

    document.getElementById('badge-count').textContent = `⚠️ समाधान मिला (टोकन: ${data.ticket_token})`;
    document.getElementById('badge-count').style.background = '#e65100';

    document.getElementById('spoken-audio-transcript').textContent = diag.citizen_friendly_script;

    const schemesList = document.getElementById('schemes-list');
    schemesList.innerHTML = `
      <div class="scheme-item" style="border-left: 4px solid #10b981; padding-left: 10px;">
        <div style="font-weight: 700; color: #10b981; font-size: 15px;">✓ पेंशन रद्द नहीं हुई है (पैसा सुरक्षित है)</div>
        <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;"><strong>योजना:</strong> ${ben.scheme} (${ben.monthly_entitlement}/माह)</div>
        <div style="font-size: 13px; color: #f59e0b; margin-top: 2px;"><strong>कारण:</strong> खाता निष्क्रिय (Error: ${diag.error_code})</div>
      </div>
    `;

    const docsList = document.getElementById('docs-list');
    docsList.innerHTML = `
      <li>✓ <strong>1. आधार कार्ड (Aadhaar Card)</strong></li>
      <li>✓ <strong>2. बैंक पासबुक (SBI A/C **6021)</strong></li>
      <li>✓ <strong>3. ₹10 नकद (खाता दोबारा सक्रिय करने हेतु)</strong></li>
    `;

    document.getElementById('office-destination').innerHTML = `
      गाँव का डाकघर (IPPB) या बैंक शाखा<br>
      <small style="color: #38bdf8;">📌 ${diag.panchayat_escalation}</small>
    `;

    document.getElementById('sms-text-content').textContent = `[सेवा भंडार - पेंशन समाधान पर्ची]
पार्वती दादी, आपकी पेंशन बंद नहीं हुई है।
बैंक खाता 1 साल से बंद होने से ₹3000 रुका है।
कल डाकघर/बैंक में ₹10 जमा करें। खाता चालू हो जाएगा।
टोकन: ${data.ticket_token}
मुखिया/पंचायत सचिव को अलर्ट भेजा गया है।`;

    currentSpokenAudioBase64 = data.audio ? data.audio.audio_base64 : null;
    if (currentSpokenAudioBase64) {
      playBase64Audio(currentSpokenAudioBase64);
    } else {
      speakBrowserTTS(diag.citizen_friendly_script);
    }

    resultsCard.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error("Triage preset error", err);
  }
}

// Telephony Call Simulation
function simulateIvrCall() {
  switchChannel('telephony');
  const captions = document.getElementById('ivr-live-captions');
  captions.innerHTML = "📞 <em>कॉल कनेक्ट हो रहा है (1800-180-SEVA)...</em>";

  setTimeout(() => {
    captions.innerHTML = "<strong>नमस्ते दीदी।</strong> मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?";
    speakBrowserTTS("नमस्ते दीदी। मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। आपकी उम्र क्या है और क्या आप शादीशुदा हैं?");
  }, 1200);

  setTimeout(() => {
    captions.innerHTML = "<em>उपयोगकर्ता बोली: 'हम 48 साल के हैं, पति नहीं रहे।'</em>";
  }, 3500);

  setTimeout(() => {
    captions.innerHTML = "<strong>सत्यापन पूर्ण:</strong> दीदी, आप <strong>विधवा पेंशन योजना</strong> के लिए पात्र हैं। हर महीने <strong>₹1,000</strong> मिलेंगे। कागजों का SMS आपके फोन पर भेजा गया है।";
    speakBrowserTTS("दीदी, आप विधवा पेंशन योजना के लिए पात्र हैं। हर महीने ₹1,000 मिलेंगे। कागजों का SMS आपके फोन पर भेजा गया है।");
  }, 5500);
}

// WhatsApp Audio Simulation
function simulateWhatsAppVoice() {
  switchChannel('whatsapp');
  const chatWindow = document.getElementById('wa-chat-window');

  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'wa-msg user';
  userMsg.innerHTML = `
    <div class="wa-audio-pill">
      <span>▶️ 0:06</span>
      <div class="wa-wave"> ▂▃▅▆▇</div>
    </div>
    <small class="wa-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
  `;
  chatWindow.appendChild(userMsg);

  // Response after 1.5s
  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'wa-msg bot';
    botMsg.innerHTML = `
      <div class="wa-audio-pill">
        <span>▶️ 0:28</span>
        <div class="wa-wave"> ▂▃▅▆▇</div>
      </div>
      <p><strong>सेवा भंडार योजना पर्ची:</strong></p>
      <p>✓ उ.प्र. विधवा पेंशन: ₹1,000/माह<br>✓ पीएम आवास: ₹1,20,000</p>
      <small style="color:#0284c7;">3 कागज़ ले जाएं: आधार, मृत्यु प्रमाण पत्र, पासबुक।</small>
      <small class="wa-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
    `;
    chatWindow.appendChild(botMsg);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    speakBrowserTTS("दीदी, आपका वॉइस नोट सुन लिया गया है। आप विधवा पेंशन और आवास योजना के लिए पात्र हैं।");
  }, 1500);
}

// Reset Interview
function resetInterview() {
  initSession();
  document.getElementById('slot-age').textContent = "--";
  document.getElementById('slot-marital').textContent = "--";
  document.getElementById('slot-land').textContent = "--";
  document.getElementById('slot-income').textContent = "--";
  document.getElementById('slot-location').textContent = "--";
  document.getElementById('results-card').style.display = 'none';
}

// Toggle Scheme Catalog
function toggleCatalog() {
  const body = document.getElementById('catalog-body');
  const icon = document.getElementById('catalog-toggle-icon');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.textContent = "▲ छिपाएं";
  } else {
    body.style.display = 'none';
    icon.textContent = "▼ देखें";
  }
}

// Load Schemes Catalog
async function loadSchemesCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/schemes`);
    const schemes = await res.json();
    const container = document.getElementById('schemes-table-container');

    let html = `<table class="catalog-table">
      <thead>
        <tr>
          <th>योजना का नाम</th>
          <th>वर्ग</th>
          <th>सरकारी लाभ</th>
          <th>आवश्यक कागज़</th>
          <th>कहाँ जमा करें</th>
        </tr>
      </thead>
      <tbody>`;

    schemes.forEach(s => {
      const benefit = s.monthly_benefit_inr > 0 ? `₹${s.monthly_benefit_inr} / माह` : `₹${s.annual_benefit_inr}`;
      html += `<tr>
        <td><strong>${s.title_hi}</strong><br><small style="color:#64748b;">${s.id}</small></td>
        <td>${s.category || 'कल्याण'}</td>
        <td style="color:#15803d; font-weight:700;">${benefit}</td>
        <td>${(s.documents_hi || []).join('<br>')}</td>
        <td>${s.where_to_submit_hi || 'पंचायत भवन'}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    console.error("Failed to load catalog", err);
  }
}
