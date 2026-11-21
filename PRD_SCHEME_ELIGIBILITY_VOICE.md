# PRODUCT REQUIREMENT DOCUMENT (PRD)

## Project Title: **JanKalyan Voice Gateway (Seva Bhandar Engine)**
### *Zero-Literacy, Voice-First Welfare Eligibility & Action Protocol for Bharat*
**Event:** Build for India 3 Hackathon (Public Good Track)  
**Target Category:** Voice AI / Digital Public Infrastructure (DPI)  
**Document Version:** 1.0.0 (Production & Hackathon Master Spec)  
**Status:** Ready for Engineering & Judging Evaluation  

---

## 1. Executive Summary

Every year, the Government of India and State Governments allocate over **₹4.5 Lakh Crore ($54B+)** across 450+ social protection and Direct Benefit Transfer (DBT) schemes. Yet, over **40% of eligible rural beneficiaries—predominantly marginalized women and daily-wage laborers—never claim a single rupee**.

The primary failure point is neither lack of willingness nor lack of government funds. It is an **information and accessibility barrier**:
1. Portals (e.g., MyScheme, UMANG, State DBT portals) are **online, visually dense, and primarily English or formal bureaucratic vernacular**.
2. Claiming requires navigations, CAPTCHAs, OTPs, and complex document uploads that intimidate people with limited literacy.
3. Unverified intermediaries (*dalals*, local middlemen) extract 20–40% cuts or misinform villagers, causing daily-wage losses (₹350–₹500/day) over futile visits to the Block Development Office (BDO).

**JanKalyan Voice Gateway** is an open-access, voice-first public good that removes every digital hurdle. A rural woman with zero reading skills answers **4 to 5 spoken questions** in her regional dialect over a standard phone call (IVR), WhatsApp voice note, or an ultra-light browser tab. In under **90 seconds**, she hears:
1. **The exact 2 or 3 high-impact schemes she qualifies for**,
2. **The exact 3 physical documents she must carry**, and
3. **The exact local desk or government officer to visit** (Panchayat Sahayak, ASHA, or CSC/VLE), paired with an automated SMS audio-checklist sent to her phone to hold the local administration accountable.

> **Crucial Architectural Non-Negotiable:**  
> This is **NOT a generic conversational AI chatbot with an Indian name**. LLMs hallucinate rules. A woman cannot afford to be told she qualifies for a pension when she does not. **Speech AI (Sarvam AI Saarika/Bulbul) is strictly used as the acoustic and slot-extraction interface; eligibility matching is executed by a 100% deterministic, audit-traceable rules engine.**

---

## 2. Problem Statement & The "Ground Reality" Persona

### 2.1 The Victim of the Current System (Not "Farmers", but Kamla Devi)

* **Name:** Kamla Devi  
* **Age:** 49 years old  
* **Location:** Village Chandauli, Uttar Pradesh  
* **Literacy:** Cannot read Devanagari or English text; recognizes numbers 1–10.  
* **Device & Connectivity:** Shared ₹6,000 sub-entry-level Android phone belonging to her son (often out of battery or data), or a 2G keypad phone. Frequent 2G/patchy 3G internet.  
* **Economic Reality:** Agricultural laborer earning ₹220/day during harvest. Husband passed away 2 years ago.  
* **Her Pain Today:**
  * She qualifies for the **Indira Gandhi National Widow Pension (IGNWPS)** (₹1,000/month) and **PM Awas Yojana (Gramin)**.
  * She spent ₹180 on shared auto fares to travel 18 km to the Block Development Office (BDO). She lost a full day’s wages (₹220).
  * A clerk turned her away because she didn't have her *Pati ka Mrityu Praman Patra* (Death Certificate) attested, and someone told her she needed a "computer receipt".
  * Total lost to date: ₹1,200 in wasted travel + ₹12,000/year in unclaimed pensions.

```
[Kamla's Current Reality]
  Wants Scheme -> Visits Block Office -> Lost ₹350 Wages + ₹80 Fare -> Rejected: "Wrong Form/Online Only" -> Trapped by Dalal (Demands ₹1000) -> Abandons Claim

[With JanKalyan Voice Gateway]
  Places Free Call / WhatsApp Voice Note -> Answers 5 Spoken Questions in Bhojpuri/Hindi -> Hears Qualified Schemes + 3 Exact Docs + Village Center -> Receives Audio/Text Checklist -> Hands Phone to Panchayat Secretary -> Claim Lodged
```

### 2.2 The 5 Structural Failure Modes We Solve
1. **The Literacy & Script Chasm:** 250M+ Indians cannot read text comfortably, but 100% understand spoken dialect.
2. **The "LLM Hallucination" Hazard:** Typical hackathon AI bots guess scheme criteria or recite outdated central guidelines. A welfare product must have legal-grade deterministic precision.
3. **The "Digital Identity Trap":** Requiring an App Store download, email signup, Google login, or UPI auth instantly discards the intended demographic.
4. **The Cognitive Overload Problem:** Existing portals dump 50+ schemes matching broad tags. Kamla Devi cannot process 50 schemes; she needs the **top 2 immediate, high-value programs**.
5. **The Missing Handover (Last-Mile Abyss):** Knowing you qualify is useless if you don't know who signs the paper in your Gram Panchayat.

---

## 3. Product Vision & Operating Principles

| Principle | Enforcement in JanKalyan Gateway |
| :--- | :--- |
| **Zero Text Prerequisite** | The entire interaction can be operated 100% through ear and mouth (Voice in, Voice out). |
| **No Apps, No Logins** | Zero downloads. Works over Standard Phone Call (IVR), WhatsApp Audio Message, or 1-tap browser mic. No email, no password, no OTP gate. |
| **Deterministic Truth** | Zero generative hallucination in eligibility scoring. Rules are hardcoded decision trees validated against government gazettes. |
| **Hyper-Concise Cognitive Load** | Max 5 questions asked. Maximum 2 to 3 schemes returned. Maximum 3 documents to gather. |
| **Actionable Downstream Handover** | Concludes with an immediate physical destination (e.g., "Panchayat Bhavan, Room 2") and sends a verifiable reference SMS. |

---

## 4. The 5-Question Voice Dialog Matrix (Slot Extraction)

To ensure the user is not exhausted, the conversation follows an **adaptive 5-vector state machine**. If a vector can be inferred, the system adapts.

```
                    ┌─────────────────────────┐
                    │ Call Inbound / Mic Tap  │
                    └────────────┬────────────┘
                                 │
                     [Q1: Age & Marital Status]
                                 │
                     [Q2: Land Ownership]
                                 │
                     [Q3: Household Income / Ration Card]
                                 │
                     [Q4: Family Composition & Children]
                                 │
                     [Q5: Geography (State & District)]
                                 │
                    ┌────────────▼────────────┐
                    │ Deterministic Engine    │
                    │ Rules Evaluation        │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          ▼                                             ▼
[Spoken Audio Response: Top Schemes]        [SMS / WhatsApp Action Slip]
- Scheme Names & Monthly ₹ Value             - Exact 3 Documents to carry
- 3 Exact Documents                          - Local Panchayat / CSC address
- Exact Officer to visit                     - Voice replay link / IVR token
```

### Conversational Script (Bilingual Example: Rural Hindi / Standard English)

* **Greeting & Question 1 (Age & Marital Status):**
  * *Bot (Voice):* "नमस्ते दीदी। मैं आपको सरकारी योजनाओं की सही जानकारी दूँगा। सबसे पहले बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेली हैं?"
  * *User Spoken Input:* "हम 48 साल के हैं, और हमारे पति दो साल पहले गुजर गए।"
  * *Extracted Slots:* `age: 48`, `gender: female`, `marital_status: widow`.

* **Question 2 (Landholding):**
  * *Bot (Voice):* "भगवान आपके परिवार को हिम्मत दे दीदी। क्या आपके या आपके परिवार के नाम पर कोई खेती की ज़मीन है? अगर हाँ, तो कितनी?"
  * *User Spoken Input:* "नहीं, हमारे पास कोई ज़मीन नहीं है, हम दूसरों के खेत में मजूरी करते हैं।"
  * *Extracted Slots:* `landholding_acres: 0.0`, `occupation: agricultural_laborer`.

* **Question 3 (Income & Ration Card Category):**
  * *Bot (Voice):* "समझ गया। आपके परिवार की साल भर की कुल कमाई कितनी हो जाती है? या आपके पास कौन से रंग का राशन कार्ड है—पीला, गुलाबी या सफेद?"
  * *User Spoken Input:* "महीने में तीन-चार हज़ार मुश्किल से बनता है, हमारे पास लाल-पीला वाला बीपीएल राशन कार्ड है।"
  * *Extracted Slots:* `annual_income_inr: 45000`, `bpl_status: true`, `ration_card_type: bpl_antyodaya`.

* **Question 4 (Children / Dependent Family):**
  * *Bot (Voice):* "घर में कितने बच्चे हैं दीदी? क्या कोई 18 साल से कम उम्र की बेटी या पढ़ने वाले बच्चे हैं?"
  * *User Spoken Input:* "दो बेटियां हैं, एक 15 साल की स्कूल जाती है।"
  * *Extracted Slots:* `dependents_count: 2`, `minor_daughters: 1`, `school_going_children: true`.

* **Question 5 (Location / State):**
  * *Bot (Voice):* "आखिरी सवाल, आप किस राज्य और जिले में रहती हैं?"
  * *User Spoken Input:* "हम उत्तर प्रदेश, चंदौली जिले से हैं।"
  * *Extracted Slots:* `state: Uttar Pradesh`, `district: Chandauli`.

---

## 5. Output Specification: The Actionable Triad

The system strictly avoids long policy lectures. It delivers the **Actionable Triad**:

### 5.1 Spoken Voice Output (Under 45 Seconds)
> *"दीदी, आपके लिए दो बड़ी सरकारी योजनाएँ हैं जिनका पैसा आपको तुरंत मिल सकता है:*
> 
> * **पहली:** **विधवा पेंशन योजना** — इसमें आपको हर महीने **₹1,000 सीधे आपके बैंक खाते में** मिलेंगे।
> * **दूसरी:** आपकी 15 साल की बेटी के लिए **कस्तूरबा कन्या वजीफा** — इसमें किताब और पढ़ाई के लिए **₹3,000 साल का** मिलेगा।
> 
> *इसके लिए आपको सिर्फ 3 कागज़ चाहिए:*
> 1. आपका **आधार कार्ड**,
> 2. आपके **पति का मृत्यु प्रमाण पत्र**, और
> 3. आपकी **बैंक पासबुक की फोटोकॉपी**।
> 
> *कहाँ जाना है:*
> कल सुबह 10 बजे अपने गाँव के **पंचायत भवन** में जाकर **पंचायत सहायक** से मिलिए, या पास के **जन सेवा केंद्र (CSC)** पर जाएं। हमने आपके फोन पर कागजों की सूची का मैसेज भेज दिया है।"*

### 5.2 SMS / WhatsApp Action Slip (Handover Artifact)
The beneficiary receives an instant zero-data text and an interactive WhatsApp audio message:

```text
[सेवा भंडार - आपकी योजना पर्ची]
दीदी, आप इन 2 योजनाओं के लिए पात्र हैं:
1. उ.प्र. विधवा पेंशन: ₹1,000 / महीना
2. किशोरी बालिका छात्रवृत्ति: ₹3,000 / वर्ष

ले जाने वाले 3 कागज़:
[ ] 1. आधार कार्ड
[ ] 2. पति का मृत्यु प्रमाण पत्र
[ ] 3. बैंक पासबुक

कहाँ जमा करें:
ग्राम पंचायत भवन (पंचायत सहायक) या नजदीकी CSC सेंटर।
हेल्पलाइन: 1800-XXX-XXXX
(इस SMS को पंचायत ऑपरेटर को दिखाएं)
```

---

## 6. System Architecture & Technical Specifications

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ACCESS CHANNELS                              │
  │  ┌──────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
  │  │ Phone Call (IVR)     │  │ WhatsApp Audio Bot  │  │ Ultra-light Web│ │
  │  │ 2G Keypad / Feature  │  │ Meta Cloud API      │  │ PWA (<200KB)   │ │
  │  └──────────┬───────────┘  └──────────┬──────────┘  └────────┬───────┘ │
  └─────────────┼─────────────────────────┼──────────────────────┼─────────┘
                │                         │                      │
                ▼                         ▼                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    COMMUNICATION GATEWAY & ORCHESTRATOR                │
  │              FastAPI / Node.js Microservice with Streaming I/O         │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
  ┌───────────────────────────────┐           ┌────────────────────────────┐
  │   SARVAM AI SPEECH ENGINE     │           │ DETERMINISTIC RULES ENGINE │
  │                               │           │ (Zero Hallucination Core)  │
  │ • Saarika v2 (Speech-to-Text) │           │                            │
  │   - Hindi, Bhojpuri, Marathi, │           │ • Curated Scheme Schema    │
  │     Tamil, Telugu, Bengali    │           │ • Boolean Constraint Check │
  │ • Bulbul v2 (Text-to-Speech)  │           │   (Age, Land, Income, BPL) │
  │   - Authentic Vernacular Tone │           │ • Priority Ranker          │
  │ • Slot-Filler Parser (LLM/NLU)│           │   (Max Cash Benefit First) │
  └───────────────────────────────┘           └──────────────┬─────────────┘
                                                             │
                                                             ▼
                                              ┌────────────────────────────┐
                                              │ ACTION GENERATOR           │
                                              │ • 3-Doc Extractor          │
                                              │ • Nearest Center Resolver  │
                                              │ • SMS/WhatsApp Dispatcher  │
                                              └────────────────────────────┘
```

### 6.1 Audio Processing Pipeline (Sarvam AI Integration)
1. **Audio Streaming Ingestion:** Audio chunks are captured at 16kHz mono via WebRTC, WhatsApp media webhooks, or Twilio/Exotel Telephony media stream.
2. **Speech-to-Text (STT):** Processed via **Sarvam AI `saarika:v2`**, fine-tuned on Indic dialects and noisy background environments (street noise, crying child, low-bitrate 2G AMR codec).
3. **Information Extraction (NLU Engine):**
   * Uses structured JSON output prompts with rigid schema enforcement (`pydantic` on backend).
   * Extracts target slots: `age`, `gender`, `marital_status`, `land_owned_acres`, `annual_income`, `category`, `disability`, `state`, `district`.
   * If a slot is ambiguous, the conversational state machine asks a hyper-targeted follow-up question.
4. **Deterministic Eligibility Evaluation:**
   * Pure Python / Rust decision tree without generative extrapolation.
   * Matches slot values against the **National & State Welfare Matrix** (e.g., `schemes_db.json`).
5. **Text-to-Speech (TTS):**
   * Response synthesized via **Sarvam AI `bulbul:v2`**.
   * Voice characteristics: Empathetic, respectful, clear, unhurried Indian female voice (e.g., `kavya` or `ananya` voice persona) at 0.95x speed for maximum rural clarity.

### 6.2 Latency Budget (Target: < 1.8 seconds round-trip)
* Network Ingestion: ~300ms
* Sarvam Saarika STT (Chunked): ~400ms
* Slot Extraction & Rules Evaluation: ~150ms
* Sarvam Bulbul TTS (First Audio Buffer Streamed): ~500ms
* Telephony Audio Playback Start: ~300ms
* **Total Perception Latency:** **~1.65 seconds** (conversational human-grade cadence).

---

## 7. Scheme Catalog & Core Eligibility Logic (Starter MVP)

The MVP is pre-loaded with high-impact central and state welfare programs directly applicable to rural women and vulnerable families:

```json
[
  {
    "scheme_id": "IGNWPS_CENTRAL_UP",
    "name": "Indira Gandhi National Widow Pension (उ.प्र. विधवा पेंशन)",
    "target_beneficiary": "Widowed women living below poverty line",
    "cash_benefit": "₹1,000 / month direct to bank account",
    "rules": {
      "gender": ["female"],
      "marital_status": ["widow"],
      "min_age": 18,
      "max_age": 120,
      "max_annual_income_inr": 200000,
      "bpl_or_ration": true
    },
    "documents_required": [
      "Aadhaar Card (आधार कार्ड)",
      "Husband's Death Certificate (पति का मृत्यु प्रमाण पत्र)",
      "Bank Account Passbook (बैंक पासबुक की कॉपी)"
    ],
    "where_to_go": "Panchayat Bhavan (Panchayat Sahayak) or Nearest CSC Center"
  },
  {
    "scheme_id": "PM_KISAN_SAMMAN",
    "name": "PM-Kisan Samman Nidhi (पीएम किसान सम्मान निधि)",
    "target_beneficiary": "Small and marginal farmer landholder families",
    "cash_benefit": "₹6,000 / year (in 3 installments of ₹2,000)",
    "rules": {
      "min_landholding_acres": 0.01,
      "max_landholding_acres": 5.0,
      "institutional_landholder": false,
      "tax_payer": false
    },
    "documents_required": [
      "Aadhaar Card (आधार कार्ड)",
      "Land Record / Khatauni Copy (खतौनी / जमीन के कागजात)",
      "Aadhaar-linked Bank Passbook (आधार से जुड़ा बैंक खाता)"
    ],
    "where_to_go": "Agriculture Department Lekhpal or CSC Center"
  },
  {
    "scheme_id": "PM_MATRU_VANDANA",
    "name": "Pradhan Mantri Matru Vandana Yojana (मातृ वंदना योजना)",
    "target_beneficiary": "Pregnant women & lactating mothers for first/second live child",
    "cash_benefit": "₹5,000 to ₹6,000 conditional cash incentive",
    "rules": {
      "gender": ["female"],
      "min_age": 19,
      "pregnant_or_infant_mother": true
    },
    "documents_required": [
      "Mother & Father Aadhaar Cards (माता-पिता का आधार)",
      "MCP Card / Poshan Tracker Entry (मातृ एवं शिशु सुरक्षा कार्ड)",
      "Mother's Bank Passbook (माता का बैंक खाता)"
    ],
    "where_to_go": "Village Anganwadi Worker (AWW) or ASHA Didi"
  },
  {
    "scheme_id": "PM_SVANIDHI",
    "name": "PM SVANidhi (पीएम स्वनिधि रेहड़ी-पटरी योजना)",
    "target_beneficiary": "Street vendors and informal micro-business workers",
    "cash_benefit": "₹10,000 initial collateral-free working capital loan at 7% subsidy",
    "rules": {
      "min_age": 18,
      "occupation": ["street_vendor", "daily_wage_artisan", "informal_laborer"]
    },
    "documents_required": [
      "Aadhaar Card",
      "Vending Certificate or Local Ward/Panchayat Recommendation Letter",
      "Bank Account"
    ],
    "where_to_go": "Municipal Ward Office or Common Service Center (CSC)"
  }
]
```

---

## 8. Business Model & Sustainability: Who Pays For It?

The prompt mandate is explicit:  
> *"Free for the user. Say who pays to keep it running: a government body, an NGO, CSR money or a panchayat."*

### 8.1 The Unit Economics (Cost Per Inquiry)
* **Telephony (Inbound IVR Toll-Free 1800):** ₹0.40 per minute × 1.5 minutes = **₹0.60**
* **Sarvam AI Saarika (Speech to Text):** ₹0.15 per query = **₹0.15**
* **Deterministic Compute & SMS Gateway:** ₹0.12 per SMS = **₹0.12**
* **Sarvam AI Bulbul (Text to Speech Audio Synthesis):** ₹0.20 per audio out = **₹0.20**
* **Total Cost per Verified Eligibility Resolution:** **₹1.07 (~$0.013 USD)**

### 8.2 The Payer Consortium (Sustainable Funding Model)

```
                 ┌────────────────────────────────────────────────────────┐
                 │                WHO PAYS TO KEEP IT FREE                │
                 └───────────────────────────┬────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┼─────────────────────────────────────┐
      ▼                                      ▼                                     ▼
[Pillar 1: CSR Mandates]           [Pillar 2: SRLM / Panchayati Raj]    [Pillar 3: Impact Philanthropy]
- Public & Private Sector Banks    - State Rural Livelihood Missions    - Bill & Melinda Gates Fdn
  (SBI, HDFC Parivartan, NABARD)     (UP-SRLM, NRLM Aajeevika)          - Rohini Nilekani Philanthropies
- Why: Drives DBT bank account     - Why: Saves 80% cost of physical    - Why: Proven high SROI
  activity & Jan Dhan transactions   "Jan Samasya Shivirs" (Grievance)    (Social Return on Investment)
```

1. **Banking & NBFC Corporate Social Responsibility (CSR):**
   * Under RBI Priority Sector Lending (PSL) and Financial Inclusion mandates, banks like **SBI, HDFC Bank, ICICI, and NABARD** spend hundreds of crores annually on financial literacy.
   * **The ROI for Banks:** Every woman who discovers her pension or PM-Kisan eligibility deposits that money into a **Pradhan Mantri Jan Dhan Yojana (PMJDY)** bank account. The sponsoring bank gains active CASA (Current Account Savings Account) balances and direct micro-insurance subscriptions (PMJJBY / PMSBY).
2. **State Rural Livelihoods Mission (SRLM / NRLM):**
   * Government departments currently spend ₹50–₹100 per person organizing physical *Jan Samadhan Shivirs* (district grievance camps) with poor attendance.
   * JanKalyan Gateway replaces physical chaos with a 24x7 toll-free automated line costing **₹1.07 per resolved citizen**.
3. **Panchayat / XV Finance Commission Tied Grants:**
   * Gram Panchayats receive direct untied funds under the 15th Finance Commission for digital governance and administrative support. Subscribing to an automated telephone query system costs less than ₹2,000/month per Gram Panchayat.

---

## 9. Non-Functional Requirements (NFRs)

* **Zero-Literacy Accessibility:**
  * Voice speed default: 0.92x to 0.95x with natural Indian pauses.
  * Audio is accompanied by recognizable non-verbal cues (familiar sitar/chime notes indicating "speak now" and "listening complete").
* **Offline & Slow Internet Resilience:**
  * Web PWA total payload < **200 KB** (no heavy client JS libraries).
  * Runs seamlessly on Edge / 2G / 3G connections.
  * Full IVR fallback (requires zero internet, works on ₹800 feature phones).
* **Privacy & Data Dignity:**
  * **No Aadhaar numbers stored in raw format**; no biometric credentials ever requested.
  * Stateless session processing: Once the SMS is dispatched, sensitive personal audio recordings are purged from temporary memory, retaining only anonymized analytical metrics (e.g., `district: Chandauli, scheme_matched: widow_pension`).
* **Accuracy Guarantee:**
  * False Positive Rate: < 1% (enforced by conservative deterministic thresholding).
  * False Negative Rate: < 2%.

---

## 10. Hackathon Implementation & Vibecoding Blueprint (36-Hour Plan)

To win the hackathon, we build a **working end-to-end interactive proof of concept**:

```
[Phase 1: Hours 0-10]  Backend & Deterministic Core
                       - FastAPI application setup
                       - JSON decision tree rules engine for 10 core schemes
                       - Slot-filler parser verifying input extraction

[Phase 2: Hours 10-22] Voice AI Integration (Sarvam AI API)
                       - Connect Sarvam Saarika (STT) for Hindi/vernacular streaming
                       - Connect Sarvam Bulbul (TTS) with natural pause markers
                       - Implement audio session state manager

[Phase 3: Hours 22-30] Frontend & Telephony Interface
                       - Ultra-light responsive PWA with single "बोलिए" (Speak) microphone button
                       - Twilio/Exotel Webhook handler for phone call demo
                       - SMS dispatch simulator (Twilio / Gupshup / Fast2SMS)

[Phase 4: Hours 30-36] Polish, Testing with Dialect Audio & Presentation Video
                       - Live test with elderly rural Hindi audio samples
                       - Crisp 2-minute pitch deck emphasizing the "Zero Dalal" impact
```

---

## 11. Judging Criteria & Hackathon Alignment Matrix

| Hackathon Evaluation Metric | How This PRD Wins |
| :--- | :--- |
| **Problem Selection & Empathy** | Not a generic "farmer app". Pinpointed directly at marginalized rural women who lose ₹400 in day's wages to get turned away from a government office. |
| **No Chatbot Tropes** | No gimmicky avatar or superficial chat interface. Pure infrastructural voice protocol solving actual downstream paperwork and office navigation. |
| **Accuracy & Trust** | Zero hallucination. Voice handles the natural language friction; deterministic code handles the legal rules of government schemes. |
| **Realistic Economics** | Grounded ₹1.07/call cost backed by bank CSR financial inclusion mandates and Panchayati Raj 15th Finance Commission grants. |
| **Technology Execution** | Deep integration with Sarvam AI's Indic models (Saarika + Bulbul) optimized for telephony bandwidth and colloquial dialect understanding. |

---
*End of PRD — Authored for Build for India 3 Hackathon Entry.*
