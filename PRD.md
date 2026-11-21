# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# Project: JanSeva Voice (जनसेवा वाणी / জনসেবা বাণী)
### Event: Vibe Coders Hackathon Edition 3 · Calcutta AI Club (21 Nov 2026)
### Track: Build for India 3 (Public Good Challenge)

---

## 1. Problem Statement & Reality Check

### 1.1 The Anti-Pattern (What 95% of Hackathon Teams Build & Fail With)
In hackathons with rural themes, the typical submission is an English-centric or translated chatbot ("Kisan Dost" / "Gramin AI") that gives generic advice:
* *"You should grow wheat using drip irrigation."*
* *"Here is the eligibility criteria for PM-Kisan scheme."*

The hackathon guidelines explicitly state:
> *“Helping farmers” is not a problem. Say exactly who it is for and what goes wrong for them today. A chatbot with an Indian name will score low. Sarvam credits for Indian language voice are on your account.*

### 1.2 The Real Problem We Are Solving
In rural India, the primary crisis for low-income citizens is **not lack of information about new schemes**. It is **the sudden, unexplained stoppage of their existing lifeline welfare payments (Direct Benefit Transfer - DBT)**.

Every month, millions of poor citizens have their ₹1,000/month Old Age / Widow Pension (NSAP), ₹2,000 PM-Kisan installment, or MGNREGA wages abruptly withheld.
The reason is almost never intentional disqualification; it is almost always an administrative or technical synchronization failure:
1. **Dormant PMJDY Account**: The beneficiary had no withdrawals or deposits for 12 months; the bank freezes the account under RBI dormancy rules.
2. **NPCI Aadhaar Mapper Decoupling**: The Aadhaar Payment Bridge System (APBS) maps the citizen's Aadhaar to an inactive secondary account without notifying them.
3. **Annual Life Certificate (Jeevan Pramaan) Biometric Failure**: The elderly citizen’s thumbprints have worn smooth with age and hard labor, causing biometric authentication at the local bank kiosk to fail.
4. **Name Spelling Mismatch**: A discrepancy between the Ration Card ("Parbati Devi") and Aadhaar ("Parvati Devi") causes the automated clearinghouse to reject disbursal.

### 1.3 Who Suffers: The Target Persona
* **Name**: Parvati Devi (67 years old, illiterate widow).
* **Location**: Village Chandanpur, Block Maner, District Patna (Bihar).
* **Monthly Entitlement**: ₹1,000/month Indira Gandhi National Widow Pension Scheme (NSAP). This ₹1,000 buys her monthly medicines, food grains, and kerosene.
* **Device**: Her son’s 6-year-old **Redmi Go / Lava Z61 (1GB RAM, Android 8.1 Go Edition)** with a cracked screen and storage 95% full.
* **Connectivity**: Intermittent 4G signal 3.5 km from the nearest tower. During 8-hour daily power cuts, the cell tower drops to **2G EDGE (20–48 kbps, 1500ms latency, 20% packet loss)**.
* **Language**: Speaks rural Bhojpuri and colloquial Hindi. Cannot read text.
* **The Ordeal Today**:
  * Money stops arriving. She gets an English SMS she cannot read.
  * She spends ₹80 on an auto-rickshaw to travel 18 km to the Block Development Office (BDO).
  * Her daily-wage son accompanies her, losing his ₹400 daily wage. Total family loss: **₹480 (almost half her monthly pension)**.
  * At the block office, a CSC agent or clerk demands a ₹150 bribe to "check the computer" and simply says: *"Server down hai, agle hafte aana"* (The server is down, come next week).
  * 4 months pass with zero income.

---

## 2. Product Vision & Architecture

**JanSeva Voice** is an open-access, voice-first public utility that diagnoses the exact cause of a citizen's welfare payment stoppage and initiates administrative resolution without the citizen leaving their home, spending a single rupee, or reading a single word.

### 2.1 The 4 Non-Negotiable Tenets

```
+-----------------------------------------------------------------------------------+
|                              JANSEVA VOICE TENETS                                 |
+-----------------------------------------------------------------------------------+
| 1. ZERO TEXT ENTRY        | Citizen speaks in native dialect (Bhojpuri/Bengali/   |
|                           | Hindi); system replies in warm, paced dialect voice.  |
+---------------------------+-------------------------------------------------------+
| 2. ZERO APP SKILLS        | Accessible via 3 modes: Free PSTN Call, WhatsApp      |
|                           | Voice Note, or 1-tap browser link (<45KB PWA).        |
+---------------------------+-------------------------------------------------------+
| 3. ZERO CITIZEN COST      | 100% free for the user. Funded by CSR (Section 135)   |
|                           | and State Panchayati Raj e-Governance grants.         |
+---------------------------+-------------------------------------------------------+
| 4. ACTIONABLE REMEDIATION | Not a generic chatbot. Pinpoints exact bank/DBT error |
|                           | code and notifies the local Village Secretary/Postman.|
+-----------------------------------------------------------------------------------+
```

---

## 3. Detailed User Journey & Functional Flow

### Step 1: Ingress (Zero-Friction Access)
Parvati has three ways to connect:
* **Mode A: Toll-Free PSTN Call (1800-XXX-XXXX)**: Works on any phone, including a ₹800 2G keypad phone.
* **Mode B: WhatsApp Audio Note**: Parvati's son sends a 5-second voice note to the verified JanSeva WhatsApp Business number.
* **Mode C: Zero-Install PWA Link**: A tap on a shared link opens an ultra-lightweight web interface with a single giant microphone button.

### Step 2: Voice Input in Local Dialect
Parvati presses the microphone button and speaks naturally in Bhojpuri:
> *"Hamaar pension teen mahina se na aawata. Kono batabe nahi karat ba ki ka bhail."*
> *(My pension hasn't come for 3 months. Nobody is telling me what happened.)*

### Step 3: Dialect Speech Processing (Sarvam AI Saarika)
* The 8kbps Opus audio stream is transmitted to **Sarvam Saarika v2 ASR**.
* Audio passes through a client-side WebAssembly noise suppressor to eliminate background village sounds (tractor engines, livestock, wind).
* Saarika transcribes the speech accurately, preserving dialectal markers.

### Step 4: Deterministic Triage & Government API Query
* The JanSeva triage engine extracts the intent: `PENSION_DISBURSAL_FAILURE`.
* The engine queries the national **PFMS (Public Financial Management System)** and **NSAP** databases using the beneficiary’s phone number or voice-dictated Ration Card / Aadhaar last 4 digits.
* **Diagnosis Result**: The system receives error code `ERR_DBT_504`:
  * *Disbursal status: State Government released ₹1,000 on the 1st of every month.*
  * *Bounced transaction: Returning bank: State Bank of India (Maner Branch).*
  * *Reason: Account marked INOPERATIVE / DORMANT due to lack of transactions.*

### Step 5: Compassionate Dialect Voice Delivery (Sarvam AI Bulbul)
The engine constructs a personalized, jargon-free explanation and renders it via **Sarvam Bulbul v2 TTS** (warm, elderly female voice in Bhojpuri/Hindi, pace 0.9):
> *"Parvati Dadi, ghabraiye mat. Aapka pension raddi nahi hua hai. Sarkar ne har mahine paisa bheja tha, lekin aapka State Bank wala khata do saal se band pada tha, isliye bank ne paisa lauta diya.*
> *Aapko Block office jane ki koi zaroorat nahi hai. Kal subah apne gaon ke post office ya bank jakar sirf ₹10 jama kar dijiye. Khata dobara chalu ho jayega aur pichla ruka hua ₹3,000 agle hafte aapke khate me aa jayega."*

### Step 6: Official Remediation & Institutional Accountability
1. **SMS Confirmation**: An SMS in simple Hindi is dispatched with a case token (`JP-89421`).
2. **Panchayat Escalation**: A webhook alerts the **Gram Rozgar Sevak / Panchayat Sachiv** on their official WhatsApp:
   * *“Alert: Parvati Devi (Ward 4) pension bounced due to dormant account. Visit her household with micro-ATM/IPPB postman for fingerprint reactivation.”*

---

## 4. Technical Feature Specifications

### 4.1 Tri-Modal Interface Architecture
1. **PWA (Progressive Web App)**:
   * **Bundle Size**: Under 45 KB (HTML + CSS + JS combined, Brotli-compressed).
   * **Audio Ingest**: Client-side encoding via `libopus.wasm` downsampled to 8 kHz / 16 kHz mono at **8 kbps**.
   * **Networking**: HTTP/3 over QUIC (UDP port 443) for 0-RTT connection resumption and immunity to packet drop.
   * **Offline Capabilities**: Full Cache-First Service Worker; IndexedDB offline outbox with Background Sync API.
2. **WhatsApp Business API**:
   * Uses Meta’s store-and-forward architecture.
   * Ingests native `.ogg` Opus audio notes; replies with interactive audio notes and regional language confirmation cards.
3. **PSTN / Telephony (IVR)**:
   * Telephony gateway (SIP trunk / Asterisk) accepting 2G cellular voice.
   * G.711 / AMR-NB audio streaming to real-time speech pipeline.

### 4.2 Sarvam AI Speech & Audio Pipeline
* **Saarika v2 (STT)**: Real-time Indic speech-to-text supporting Hindi (`hi-IN`), Bengali (`bn-IN`), Odia (`or-IN`), Marathi (`mr-IN`), Telugu (`te-IN`), Tamil (`ta-IN`).
* **Bulbul v2 (TTS)**: Indic neural text-to-speech with natural cadence and dialect nuances, streaming audio back in chunked HTTP transfers to begin playback within 300ms.
* **Indic Reasoning Engine**: Guardrailed classification into 6 core welfare schemas (Pension, PM-Kisan, MGNREGA, Ration Card, Bank Account Dormancy, Grievance Escalation).

### 4.3 Government & Banking Integration Engine
* **PFMS Tracker**: Direct Benefit Transfer transaction ledger.
* **NSAP Portal**: Old Age, Widow, Disability pension disbursal records.
* **NPCI Aadhaar Mapper Simulator**: Verification of active bank linkage.
* **CPGRAMS / CM Helpline 181**: Automated grievance registration when administrative foul play is detected.

---

## 5. Financial Sustainability Model (Rule #1 Adherence)

### 5.1 Who Pays to Keep It Running?
JanSeva Voice is a **100% free public good** for the citizen. Funding is secured through:
1. **Corporate Social Responsibility (CSR) Mandates (Section 135, Companies Act 2013)**:
   * Public Sector Undertakings (PSUs) and financial institutions must allocate 2% of net profits to rural development and digital empowerment.
   * Target Anchors: **REC Foundation, PowerGrid, SBI Foundation, Tata Trusts, HDFC Parivartan**.
2. **Ministry of Panchayati Raj (RGSA Grants)**:
   * Rashtriya Gram Swaraj Abhiyan provides dedicated funds for Gram Panchayat digitization and citizen-centric service delivery.
3. **District Mineral Foundation (DMF) Trusts**:
   * Statutory trust funds in 600+ mining-impacted districts allocated for community welfare.

### 5.2 Unit Economics: Massive Value Multiplier

| Expense Item | Cost per 30-Second Citizen Inquiry |
| :--- | :--- |
| **Ingress Telephony / WhatsApp Webhook** | ₹0.040 |
| **Sarvam Saarika ASR (Voice-to-Text)** | ₹0.022 |
| **Cloud Edge & Serverless Compute** | ₹0.005 |
| **Sarvam Bulbul TTS (Text-to-Voice)** | ₹0.040 |
| **SMS Gateway Notification (CDAC/DLT)** | ₹0.035 |
| **Total Cost Per Resolved Query** | **₹0.142 (~14 Paise)** |

* **Citizen Economic Savings**: The citizen saves **₹480** (travel fare + lost daily wage).
* **ROI for Public Good**: Every **₹1 spent** by the government/CSR sponsor yields **₹3,380 in direct economic protection** for the rural poor.

---

## 6. Success Metrics & KPIs

| Metric | Target | Verification Method |
| :--- | :--- | :--- |
| **First-Audio-Playback Latency** | < 2.5s on 2G EDGE; < 800ms on 4G | Automated network throttle benchmarks |
| **Bundle Size (PWA)** | < 45 KB total transfer | Lighthouse / WebPageTest audit |
| **Dialect Recognition Accuracy (WER)** | < 12% Word Error Rate in Bhojpuri/Hindi | Sarvam Saarika evaluation dataset |
| **Query Resolution Rate** | > 88% resolved without office visit | Post-remediation verification callbacks |
| **Citizen Cost** | **₹0.00** | Zero billing, zero in-app purchases |

---
*Vibe Coders Hackathon Edition 3 · Calcutta AI Club · 21 November 2026*
