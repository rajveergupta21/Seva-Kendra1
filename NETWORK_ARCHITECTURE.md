# NETWORK ARCHITECTURE SPECIFICATION
## Project: **JanKalyan Voice Gateway (Seva Bhandar Engine)**
### *Universal Device Ingress & Resilient Telephony Architecture for Bharat*
**Version:** 1.0.0 | **Hackathon Master Architecture Doc**  
**Target:** 100% Device Coverage (2G Keypad Phones, WhatsApp Voice, Ultra-light Web PWA)

---

## 1. Executive Summary & Design Tenets

The core requirement of the problem statement is uncompromising:
> **"It must work on every device: cheap Android phones, slow internet, over WhatsApp, or a direct phone call. Free for the user. No app skills needed."**

In rural and peri-urban India, "every device" does not mean modern smartphones on 5G. It represents **three radically diverse network tiers**:
1. **Tier 1 (The 2G/Voice-Only Layer - ~350M users):** Basic feature/keypad phones (Nokia 105, itel, Lava, JioPhone) with **no data connection, no browser, and no app store**.
2. **Tier 2 (The Asynchronous WhatsApp Layer - ~500M users):** Sub-₹7,000 low-RAM smartphones using shared 2G/3G or intermittent 4G, capable of sending and receiving WhatsApp voice notes.
3. **Tier 3 (The Low-Bandwidth Web Layer):** Lightweight Android browsers (Chrome Go, JioPages) over high-latency (300ms–1500ms) edge connectivity.

To serve all three without duplicating business logic, the JanKalyan Voice Gateway is built on a **Universal Decoupled Ingress Architecture**:
* **Input-Agnostic Edge Adapters** normalize inbound audio from Telephony (PSTN), WhatsApp Media, or WebRTC into a unified 16kHz PCM stream.
* **A Centralized Orchestration Core** interacts with Sarvam AI for Indic voice processing and evaluates deterministic eligibility rules.
* **Multi-Modal Egress** returns both spoken vernacular audio and actionable physical-world artifacts (SMS checklist, WhatsApp Action Cards).

---

## 2. End-to-End System Network Topology

```
═════════════════════════════════════════════════════════════════════════════════════════════
                                   DEVICE & ACCESS LAYER
═════════════════════════════════════════════════════════════════════════════════════════════
  [Tier 1: 2G Keypad Phone]      [Tier 2: Sub-₹6,000 Android]     [Tier 3: Mobile Browser]
      (Zero Data / PSTN)             (WhatsApp Voice Note)             (2G/3G Web PWA)
              │                                │                              │
       Cellular / GSM                   Cellular Data / Wi-Fi           Cellular Data
        G.711 / AMR                      OGG Opus (~16kbps)             WSS / HTTP (<100KB)
              │                                │                              │
══════════════╪════════════════════════════════╪══════════════════════════════╪═════════════
              │                  INGRESS & EDGE GATEWAYS                      │
══════════════╪════════════════════════════════╪══════════════════════════════╪═════════════
              ▼                                ▼                              ▼
   ┌─────────────────────┐          ┌─────────────────────┐        ┌─────────────────────┐
   │ Telco SIP/PSTN      │          │ Meta Cloud API      │        │ Cloudflare Edge CDN │
   │ Gateway (Exotel/    │          │ Webhook Endpoint    │        │ (TLS 1.3 Termination│
   │ Airtel IQ / Twilio) │          │ (Payload Decryption)│        │ & Asset Caching)    │
   └──────────┬──────────┘          └──────────┬──────────┘        └──────────┬──────────┘
              │ RTP Media                      │ Media Download               │ WebSocket
              │ Stream (8kHz)                  │ (OGG Audio)                  │ Audio Stream
              ▼                                ▼                              ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │                           EDGE MEDIA TRANSCODING LAYER                              │
   │           • FFmpeg Streaming Transcoder (AMR-NB / OGG-Opus  ──>  PCM 16kHz)        │
   │           • WebRTC / WebSocket Ingress Normalizer                                   │
   │           • Voice Activity Detector (VAD) & Jitter Buffer                            │
   └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │ Normalized Audio Chunks
                                              ▼
═════════════════════════════════════════════════════════════════════════════════════════════
                                 CORE APPLICATION CLUSTER
═════════════════════════════════════════════════════════════════════════════════════════════
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │               FASTAPI / ASYNCIO ORCHESTRATOR & STATE CONTROLLER                     │
   │                                                                                     │
   │   ┌────────────────────────┐  Session State Cache   ┌───────────────────────────┐   │
   │   │ Call / Message Session │ ◄────────────────────► │ Redis Cluster (In-Memory) │   │
   │   │ Finite State Machine   │   (TTL: 15 mins)       │ Phone Number = Session ID │   │
   │   └───────────┬────────────┘                        └───────────────────────────┘   │
   └───────────────┼───────────────────────────────────────────────────┬─────────────────┘
                   │                                                   │
                   ▼                                                   ▼
   ┌───────────────────────────────┐                  ┌──────────────────────────────────┐
   │    SARVAM AI INDIC PIPELINE   │                  │   DETERMINISTIC RULES ENGINE     │
   │                               │                  │       (Zero Hallucination)       │
   │ • Saarika v2 (STT API)        │                  │                                  │
   │   (Streaming Indic Speech)    │ ── Slot Values ─►│ • In-Memory Decision Trees       │
   │ • Slot Extraction Agent       │   (JSON Schema)  │ • Scheme Eligibility Evaluator   │
   │ • Bulbul v2 (TTS API)         │                  │ • Benefit & Document Resolver    │
   │   (Natural Vernacular Audio)  │ ◄─ Action Output ┤ • District Center Locator        │
   └───────────────────────────────┘                  └──────────────────────────────────┘
                   │
                   ▼ Audio Buffer (WAV / MP3)
═════════════════════════════════════════════════════════════════════════════════════════════
                                 MULTI-CHANNEL EGRESS LAYER
═════════════════════════════════════════════════════════════════════════════════════════════
       ┌───────────────────────────┬───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│ PSTN Audio   │            │ WhatsApp     │            │ SMS Gateway  │
│ Stream Out   │            │ Audio Message│            │ (DLT-Approved│
│ (Twilio/Exo) │            │ + Action Card│            │ Fast2SMS/Gup)│
└──────────────┘            └──────────────┘            └──────────────┘
```

---

## 3. Deep Dive: The 3 Ingress Channels (Device-Specific Specifications)

### 3.1 Channel A: PSTN / Feature Phone Ingress (The 2G Lifeline)
For the ~350 million citizens without smartphones or internet packages.

* **Carrier Protocol:** SIP Trunking / E1/PRI PRI over PSTN.
* **Audio Format:** G.711 A-law / $\mu$-law or AMR-NB (8,000 Hz, 8-bit mono, ~12.2 kbps).
* **Telephony Provider:** Exotel / Airtel IQ / Twilio India.
* **Network Handshake:**
  1. Beneficiary dials a **Toll-Free 1800-Number** (Zero cost to caller).
  2. Telco provider opens an outbound bidirectional **WebSocket media stream** (`wss://api.jankalyan.org/telephony/stream`).
  3. Edge Transcoder upsamples 8kHz G.711 to 16kHz Linear PCM with high-frequency harmonic restoration.
  4. Server-Side **VAD (Voice Activity Detection)** detects when user stops speaking (silence threshold: 750ms).
  5. Response audio generated by Sarvam Bulbul is downsampled to 8kHz and streamed back into the call loop in real-time.
* **Network Resilience:**
  * If call drops mid-way due to cellular tower congestion, Redis retains the session keyed by the caller's Caller ID (CLI / phone number).
  * If redialed within 30 minutes, the voice prompt resumes: *"दीदी, हम आपके दूसरे सवाल पर थे..."* (No lost progress).

### 3.2 Channel B: WhatsApp Voice Note Webhook (The Everyday Smart Layer)
For users with cheap Android phones where typing is difficult, but sending a voice note is second nature.

* **Transport Protocol:** HTTPS Webhook over Meta Cloud API.
* **Audio Format:** OGG container encoded with **Opus codec** (variable bitrate ~16–24 kbps).
* **Data Payload:** Typically 20 KB to 60 KB per 10-second voice note. Works seamlessly even on throttled 64 kbps 2G connections.
* **Network Flow:**
  1. User sends an audio message to the verified JanKalyan WhatsApp number.
  2. Meta Webhook triggers an incoming payload with media URL.
  3. Worker fetches media buffer securely via Meta Bearer Token into memory.
  4. FFmpeg decodes Opus to 16kHz PCM and delivers to the Sarvam AI pipeline.
  5. The response is dual-dispatched:
     - **Voice Note Response (OGG/Opus):** Synthesized via Sarvam Bulbul for listening.
     - **Visual Action Card (WhatsApp Template):** Clean list of 3 documents and local office location so she can visually show it at the center.

### 3.3 Channel C: Ultra-Light Web PWA (<100 KB Total Size)
For frontline workers (ASHA didis, Anganwadi helpers) or users opening a web link on low-end Android browsers (Chrome Go, JioPages).

* **Bundle Budget:** **< 85 KB gzipped total load** (Zero React/Angular/Vue; written in vanilla JS or Preact).
* **Network Protocol:** HTTP/2 over TLS 1.3 with Cloudflare Edge CDN.
* **Audio Transport:** Chunked WebSockets over WSS (`wss://api.jankalyan.org/ws/audio`).
* **Client-Side Audio Capture:**
  * Uses browser `MediaRecorder` API with fallback to `AudioContext` script processor.
  * Captures at `audio/webm;codecs=opus` at 16 kbps or raw PCM.
  * Audio is sliced into 500ms streaming chunks and pushed through the WebSocket.
* **Offline First Strategy:**
  * Service Worker caches the interface shell.
  * If connectivity drops while speaking, chunks are queued in `IndexedDB` and flushed immediately upon network reconnection.

---

## 4. Audio Codec & Bandwidth Optimization Matrix

| Ingress Channel | Source Codec | Sample Rate | Bandwidth Consumption | Target Latency Budget | Resiliency Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PSTN / 2G Call** | G.711 / AMR-NB | 8,000 Hz | **64 kbps / 12.2 kbps** | < 1,600 ms | Adaptive jitter buffer (60ms), Telco-level Packet Loss Concealment (PLC) |
| **WhatsApp Audio** | OGG Opus | 16,000–48,000 Hz | **~16 kbps** | < 2,200 ms (Async) | Meta edge retry mechanism, store-and-forward |
| **Web PWA** | WebM Opus / PCM | 16,000 Hz | **~16–24 kbps** | < 1,400 ms | Dynamic bitrate degradation (drops to 12 kbps if packet loss > 15%) |

---

## 5. Network Latency & Response Budget Breakdown

A 5-second silence ruins a phone call in rural India; the caller will think the line is dead and hang up. The end-to-end roundtrip latency must be kept **under 1.8 seconds**.

```
  [User stops speaking]
          │
          │ (0 ms)
          ▼
   1. Silence Detection (VAD)               ──► 400 ms (Threshold window)
          │
          ▼
   2. Transcoding & Network Transit         ──► 120 ms
          │
          ▼
   3. Sarvam AI Saarika STT (Indic)         ──► 380 ms (Streaming chunk finalization)
          │
          ▼
   4. Slot Extraction & Deterministic Match ──►  80 ms (Fast in-memory Python lookup)
          │
          ▼
   5. Sarvam AI Bulbul TTS (First Chunk)    ──► 450 ms (Time-to-First-Audio-Byte)
          │
          ▼
   6. Jitter Buffer & Telco Egress Playback ──► 150 ms
          │
          ▼
  [Audio plays in user's ear]               ──► Total: ~1,580 ms (~1.58 sec)
```

> **UX Optimization for Perceived Latency:**  
> If the network experiences unexpected latency (> 1,200 ms), the Gateway instantly plays an ultra-short natural acoustic filler (e.g., *"हाँ दीदी..."* or a subtle affirmative chime of 200ms) pre-cached on the edge, keeping the line alive while Sarvam finishes synthesizing the full payload.

---

## 6. Zero-Data & Downstream Egress: The Physical Handover

Knowing eligibility is worthless if the paper trail fails. The network architecture concludes with **Downstream Delivery**:

```
                       ┌────────────────────────────────┐
                       │  Eligibility Evaluation Done   │
                       └───────────────┬────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ High-Priority SMS      │             │ WhatsApp Action Card  │
        │ Gateway (DLT Approved)│             │ (Rich Media Audio)    │
        └───────────┬───────────┘             └───────────┬───────────┘
                    │                                     │
                    ▼                                     ▼
       ┌────────────────────────┐             ┌───────────────────────┐
       │ 2G Keypad / Feature    │             │ Smartphone with Data  │
       │ Plain text checklist   │             │ Spoken voice memo +   │
       │ Works with NO internet │             │ Digital application   │
       │ & zero airtime balance │             │ reference slip        │
       └────────────────────────┘             └───────────────────────┘
```

* **Telecom DLT Compliance:** SMS headers are pre-registered with TRAI (Telecom Regulatory Authority of India) under the **Public Welfare / Service Implicit** category, guaranteeing delivery in < 5 seconds even to numbers on the National Do Not Disturb (DND) registry.
* **Handover Utility:** The text is structured as a checklist so the citizen can physically walk into the Gram Panchayat or CSC center, hand the phone to the operator, and say: *"Check this SMS and apply for me."*

---

## 7. Infrastructure Footprint & Deployment Topology

For the hackathon and pilot scale (up to 5,000 daily calls), the entire architecture is engineered to run on a lean, cost-efficient infrastructure footprint:

* **Edge / Ingress:** Cloudflare Free/Pro Tier (Global CDN, SSL termination, DDoS protection).
* **Compute Cluster:** 1x AMD EPYC 4-Core, 8GB RAM Cloud VPS (DigitalOcean / Hetzner / AWS Mumbai `t4g.xlarge`) running Docker Compose.
  * Container 1: `gateway-orchestrator` (FastAPI / Uvicorn, Python 3.11).
  * Container 2: `transcoder-service` (Node.js + FFmpeg C-bindings).
  * Container 3: `session-cache` (Redis 7 Alpine).
* **External APIs:**
  * **Voice AI:** Sarvam AI API endpoints (`api.sarvam.ai`).
  * **Telephony:** Exotel / Twilio Webhook bridges.
  * **SMS:** Fast2SMS / Gupshup Transactional Route.
* **Total Operating Infrastructure Cost (excl. call minutes):** **< $25 / month**.

---

## 8. Summary: Why This Wins the "Every Device" Mandate

1. **True Universal Reach:** Works on a ₹700 second-hand Nokia keypad phone just as effectively as on a ₹15,000 smartphone.
2. **Bandwidth Insensitivity:** Operational over 2G GSM cellular voice bands (which cover 99% of rural India) and lightweight 16 kbps compressed audio.
3. **Zero App Barrier:** No APK to download, no Google Play account, no Apple ID, no storage space consumed on low-end 16GB ROM phones.
4. **Deterministic Security:** All state transitions and eligibility determinations are locked in a hardened backend rules engine; voice channels act purely as the auditory bridge to human dignity.
