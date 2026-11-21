# 🇮🇳 Seva Kendra
### *Zero-Literacy Voice Protocol for Indian Welfare Scheme Eligibility*
**Track:** Public Good / Voice AI for Bharat | **Event:** Build for India 3 Hackathon  
**Target:** 350M+ rural and low-income Indians with zero reading skills

---

## 🌟 The Core Problem We Solve

In India, **over 40% of eligible rural citizens—predominantly marginalized women and landless laborers—never claim their government welfare benefits**. 

Portals like UMANG, MyScheme, and state DBT websites are **online, visually dense, and primarily English or formal bureaucratic script**. A 49-year-old widowed farm laborer in Uttar Pradesh loses ₹350 in daily wages and ₹80 bus fare to reach the Block Development Office (BDO), only to be turned away by a clerk because she brought the wrong paper or couldn't fill out a computer form.

**JanKalyan Voice Gateway** is an open-access public good. The woman answers **4 to 5 spoken questions** in her regional dialect over a **standard phone call (IVR), WhatsApp voice note, or an ultra-light browser tab**. In under **90 seconds**, she hears:
1. **The exact 2 or 3 high-impact schemes she qualifies for**,
2. **The exact 3 physical documents she must carry**, and
3. **The exact desk or officer to visit** (Panchayat Sahayak, ASHA, or CSC/VLE), paired with an automated **SMS action slip** sent to her phone to hold the local administration accountable.

---

## ⚡ Key Hackathon Differentiators (Why This Wins)

| What Traditional Teams Build | What JanKalyan Voice Gateway Delivers |
| :--- | :--- |
| **Gimmicky Chatbot with Indian Name** | **Zero-text infrastructural voice protocol** (No chat UI needed; works via toll-free phone call, WhatsApp audio, or single-mic PWA). |
| **LLM Generates Scheme Rules (Hallucinations)** | **Separation of Concerns:** Sarvam AI (Saarika STT + Bulbul TTS) acts strictly as the acoustic voice interface; eligibility is evaluated by a **100% deterministic decision-tree rules engine**. |
| **Cognitive Overload (15+ Schemes Dumped)** | **The Actionable Triad:** Max 2 to 3 highest-yield schemes, **exact 3 physical documents** to carry, and the **exact desk/person** in the Gram Panchayat. |
| **Dead-End Experience** | **Downstream Handover:** Dispatches an instant DLT-compliant SMS action checklist that the citizen hands to the CSC operator: *"Apply this for me."* |
| **Unrealistic Business Model** | **Funded by Bank CSR & SRLM:** SBI/HDFC Priority Sector Financial Inclusion mandates (enrolling citizens into Direct Benefit Transfer activates Jan Dhan bank accounts) at **₹1.07 per query**. |

---

## 🏗️ System Architecture

```
[2G Keypad Feature Phone]     [WhatsApp Voice Note]     [Ultra-light Web PWA]
  (Zero Data / 1800 Call)       (Opus Audio Webhook)      (Web Audio / <85KB)
           │                             │                         │
           └─────────────────────────────┼─────────────────────────┘
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │       EDGE TRANSCODING & VAD NORMALIZER       │
                 │   (FFmpeg: G.711 / AMR / Opus ──> PCM 16kHz)  │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │     FASTAPI / NODE.JS ASYNCIO ORCHESTRATOR    │
                 │        • 5-Step Dialog State Machine          │
                 │        • Session Cache (Phone = ID)           │
                 └───────────────┬───────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────────┐
│    SARVAM AI INDIC PIPELINE     │   │     DETERMINISTIC RULES ENGINE      │
│ • Saarika v2 (Streaming STT)    │   │ • 100% Hallucination-Free Logic     │
│ • Dialect & Slot Extractor      ├──►│ • schemes_data.json Decision Trees  │
│ • Bulbul v2 (Vernacular TTS)    │   │ • Benefit Ranker & Doc Consolidator │
└─────────────────────────────────┘   └──────────────────┬──────────────────┘
                                                         │
                                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │          MULTI-CHANNEL EGRESS LAYER           │
                 │  1. Spoken Audio: Natural Hindi Voice         │
                 │  2. Actionable Triad: 3 Schemes + 3 Docs      │
                 │  3. DLT SMS Checklist for CSC Handover        │
                 └───────────────────────────────────────────────┘
```

---

## 🚀 Quickstart & Running the App

### Prerequisites
- Node.js (v18 or higher)
- Optional: `SARVAM_API_KEY` (if omitted, the system seamlessly uses intelligent Indic offline NLU and synthetic voice fallback).

### 1. Run Unit Tests (Deterministic Logic & Dialog State Machine)
```bash
# Test deterministic scheme matching rules
node tests/test_engine.js

# Test colloquial Hindi slot extraction & 5-question conversational state machine
node tests/test_dialog.js
```

### 2. Start the Server
```bash
# Optional: Set your Sarvam AI API Key
# export SARVAM_API_KEY="your_sarvam_key_here"  (Linux/Mac)
# $env:SARVAM_API_KEY="your_sarvam_key_here"    (Windows PowerShell)

npm start
```
The server will start at: **`http://localhost:3000`**

---

## 🎯 Testing Modes for Hackathon Judges

Open `http://localhost:3000` in any web browser to test:

1. **🎙️ Live Voice Mic (Web PWA):** Tap the big orange microphone button, speak in Hindi or Bhojpuri (or use the one-click simulated voice inputs), and hear Sarvam Bulbul speak the qualified schemes.
2. **📞 2G Feature Phone IVR Simulator:** Click the "2G फोन कॉल" tab to see how a woman with an old Nokia keypad phone dials an 1800 number and interacts via basic voice call without any internet.
3. **💬 WhatsApp Voice Note Simulator:** Click the "व्हाट्सऐप वॉइस नोट" tab to simulate sending a WhatsApp audio note and receiving a voice note + digital action card.
4. **⚡ 1-Click Judge Presets:** At the top of the interface, click on:
   - **⚠️ पार्वती देवी:** 67-year-old widow in Bihar whose pension abruptly stopped $\rightarrow$ Diagnoses **Bank Account Dormancy (Error 504)**, explains ₹10 postal deposit reactivation in Bhojpuri, and alerts the Gram Rozgar Sevak.
   - **👵 कमला देवी:** 49-year-old widow, landless laborer in UP $\rightarrow$ Qualifies for **PM Awas Yojana (₹1,20,000)** and **Widow Pension (₹1,000/mo)**.
   - **🌾 रमेश किसान:** 42-year-old small farmer, 2.5 acres in Bihar $\rightarrow$ Qualifies for **PM Kisan Samman Nidhi (₹6,000/yr)**.
   - **🤰 सुनीता देवी:** 23-year-old pregnant mother in MP $\rightarrow$ Qualifies for **PMMVY (₹6,000)** and **Kanya Sumangala (₹25,000)**.
   - **👴 मुन्ना लाल:** 63-year-old elderly artisan $\rightarrow$ Qualifies for **Old Age Pension (₹1,000/mo)** and **PM SVANidhi (₹10,000)**.
5. **📖 Deterministic Rule Inspector:** Expand the "सत्यापित योजना नियम सूची" drawer at the bottom to inspect the verified decision-tree logic guaranteeing zero hallucination.

---

## 📂 Repository Structure

```
seva bhandar/
├── PRD_SCHEME_ELIGIBILITY_VOICE.md    # Master Hackathon PRD
├── NETWORK_ARCHITECTURE.md            # Multi-device & low-bandwidth network topology
├── schemes_data.json                  # Verified government schemes dataset & decision criteria
├── server.js                          # Native HTTP server & multi-channel webhook handlers
├── package.json                       # Project manifest
├── engine/
│   └── eligibility.js                 # 100% deterministic decision-tree rules engine
├── services/
│   ├── sarvam.js                      # Sarvam AI (Saarika STT, Bulbul TTS, slot extraction)
│   └── dialog.js                      # 5-question adaptive conversational state machine
├── tests/
│   ├── test_engine.js                 # Unit test for deterministic matching
│   └── test_dialog.js                 # Unit test for 5-turn dialog & slot parser
└── public/
    ├── index.html                     # Zero-literacy PWA UI & judge simulation console
    ├── style.css                      # Accessible high-contrast UI, waveforms, mockups
    └── app.js                         # Web Audio recording, playback, and state controller
```

---
*Built with ❤️ for Bharat during Build for India 3.*
