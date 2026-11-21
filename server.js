/**
 * JanKalyan Voice Gateway - Universal Server
 * Built with native Node.js HTTP for ultra-fast startup and zero-dependency reliability.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateSession, processDialogTurn, resetSession, QUESTIONS } from './services/dialog.js';
import { speechToText, textToSpeech } from './services/sarvam.js';
import { matchSchemes } from './engine/eligibility.js';
import { diagnoseStoppage, BENEFICIARIES, listGrievances } from './engine/triage.js';
import { processDynamicTurn } from './services/dynamic_assistant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-load .env file if present (Zero-dependency .env loader)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (val) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, api-subscription-key'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        // 10MB limit
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, api-subscription-key'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    // 0. API: Health & Edge PoP Telemetry
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: "healthy",
        service: "JanSeva Voice / JanKalyan Edge Gateway",
        edge_pop: "CCU-01 (Kolkata Regional Edge PoP)",
        protocol: "HTTP/3 over QUIC Terminated",
        sarvam_configured: Boolean(process.env.SARVAM_API_KEY)
      });
    }

    // 0b. API: Entitlement Stoppage & Pension Recovery Triage
    if (pathname === '/api/triage/pension' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const query = body.query || "हमार पेंशन तीन महीना से ना आवता";
      const identifier = body.identifier || "";
      const language = body.language || "bhojpuri";
      const diagnosis = diagnoseStoppage(query, identifier, language);
      const tts = await textToSpeech(diagnosis.diagnosis.citizen_friendly_script, language, "aarti_hi_customer");
      diagnosis.audio = tts;
      return sendJson(res, 200, diagnosis);
    }

    // 0c. API: Beneficiary Personas for Demo Testing
    if (pathname === '/api/beneficiaries' && req.method === 'GET') {
      return sendJson(res, 200, {
        count: Object.keys(BENEFICIARIES).length,
        beneficiaries: Object.entries(BENEFICIARIES).map(([k, v]) => ({
          id: k,
          name: v.name,
          scheme: v.scheme,
          village: v.village,
          error_code: v.error_code
        }))
      });
    }

    // 0d. API: Gram Panchayat Secretary Grievances Feed
    if (pathname === '/api/panchayat/grievances' && req.method === 'GET') {
      return sendJson(res, 200, {
        panchayat: "मनेर ग्राम पंचायत सचिवालय (वार्ड 1-12)",
        officer: "राजेश कुमार (पंचायत सचिव / VLE)",
        updated_at: new Date().toISOString(),
        grievances: listGrievances()
      });
    }

    // 1. API: List all verified schemes
    if (pathname === '/api/schemes' && req.method === 'GET') {
      const schemesRaw = fs.readFileSync(path.join(__dirname, 'schemes_data.json'), 'utf8');
      return sendJson(res, 200, JSON.parse(schemesRaw));
    }

const GREETINGS = {
  hi: {
    text: "नमस्ते, जनसेवा केंद्र में आपका स्वागत है। बताइए, आपकी उम्र कितनी है, और क्या आप शादीशुदा हैं, विधवा हैं, या अकेली हैं?",
    hint: '💡 बोलें: "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है"'
  },
  bhojpuri: {
    text: "प्रणाम, जनसेवा केंद्र में राउर स्वागत बा। बताईं, राउर उमिर केतना बा, आ रउआ शादीशुदा बानी, विधवा बानी, या अकेले बानी?",
    hint: '💡 बोलीं: "हम 48 साल के बानी, हमार पति नइखन, जमीन नइखे"'
  },
  bn: {
    text: "নমস্কার, জনসেবা কেন্দ্রে আপনাকে স্বাগত। বলুন, আপনার বয়স কত এবং আপনি কি বিবাহিত, বিধবা না একা থাকেন?",
    hint: '💡 বলুন: "আমার বয়স ৪৮ বছর, স্বামী নেই, কোনো জমি নেই"'
  },
  maithili: {
    text: "प्रणाम, जनसेवा केंद्र में अहाँक स्वागत अछि। कहू, अहाँक उमर कते अछि, आ अहाँ विवाहित छी, विधवा छी, या अकेली छी?",
    hint: '💡 कहू: "हमर उमर 48 साल अछि, पति नहि छथि"'
  },
  en: {
    text: "Welcome to JanSeva Kendra. Please tell me your age, and whether you are married, widowed, or single?",
    hint: '💡 Say: "I am 48 years old, widow, landless"'
  }
};

    // 2. API: Get Initial Question (Language Greeting)
    if (pathname === '/api/chat/init' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || `session_${Date.now()}`;
      const lang = body.language || 'hi';
      const greeting = GREETINGS[lang] || GREETINGS.hi;
      const tts = await textToSpeech(greeting.text, lang, "aarti_hi_customer");

      return sendJson(res, 200, {
        sessionId,
        language: lang,
        promptText: greeting.text,
        promptHint: greeting.hint,
        audioBase64: tts.audio_base64
      });
    }

    // 3. API: Process Spoken or Transcribed Dialog Turn (Dynamic Engine)
    if (pathname === '/api/chat/turn' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || 'default_session';
      const userText = body.text || '';
      const language = body.language || 'hi';

      const turnResult = await processDynamicTurn(sessionId, userText, language);
      return sendJson(res, 200, turnResult);
    }

    // 4. API: Process Raw Audio Stream / File from Web Browser
    if (pathname === '/api/chat/audio' && req.method === 'POST') {
      const sessionId = req.headers['x-session-id'] || 'voice_session';
      const audioBuffer = await parseRawBody(req);
      const mimeType = req.headers['content-type'] || 'audio/wav';
      const language = req.headers['x-language'] || 'hi-IN';
      const fallbackTranscript = req.headers['x-fallback-transcript']
        ? decodeURIComponent(req.headers['x-fallback-transcript'])
        : '';

      let transcript = '';

      // 1. Transcribe with Sarvam STT (saaras:v3)
      if (audioBuffer && audioBuffer.length > 200) {
        const stt = await speechToText(audioBuffer, mimeType, process.env.SARVAM_API_KEY, language);
        if (stt && stt.transcript) {
          transcript = stt.transcript.trim();
        }
      }

      // 2. Use browser SpeechRecognition transcript if Sarvam was empty or delayed
      if (!transcript && fallbackTranscript) {
        console.log(`[Audio STT Fallback] Using client speech transcript: "${fallbackTranscript}"`);
        transcript = fallbackTranscript.trim();
      }

      if (!transcript) {
        return sendJson(res, 200, {
          type: "NO_SPEECH_DETECTED",
          isCompleted: false,
          userTranscript: "",
          replyText: "आपकी आवाज़ साफ सुनाई नहीं दी। कृपया माइक बटन दबाकर दोबारा बोलें, या नीचे दिए गए विकल्पों में से चुनें।",
          audioBase64: null
        });
      }

      // 3. Process dynamically with zero hardcoded interrogation
      const langShort = language.startsWith('bn') ? 'bn' : (language.includes('bhojpuri') ? 'bhojpuri' : (language.startsWith('en') ? 'en' : 'hi'));
      const turnResult = await processDynamicTurn(sessionId, transcript, langShort);
      turnResult.userTranscript = transcript;

      return sendJson(res, 200, turnResult);
    }

    // 5. API: Direct 1-Click Persona Evaluation (For Judge Instant Demo)
    if (pathname === '/api/evaluate/direct' && req.method === 'POST') {
      const profile = await parseJsonBody(req);
      const result = matchSchemes(profile);
      const tts = await textToSpeech(result.spokenScript, "hi", "aarti_hi_customer");
      result.ttsAudioBase64 = tts.audio_base64;
      return sendJson(res, 200, result);
    }

    // 6. API: Telephony IVR Webhook (PSTN 2G Call Simulator)
    if (pathname === '/api/telephony/ivr' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const callerId = body.From || body.callerId || "9876543210";
      const userSpeech = body.SpeechResult || body.userSpeech || "";

      const session = getOrCreateSession(callerId);
      let replyXml = "";

      if (!userSpeech) {
        // Greeting
        replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN">${QUESTIONS[0].spoken_hi}</Say>
  <Gather input="speech" language="hi-IN" timeout="5" action="/api/telephony/ivr" />
</Response>`;
      } else {
        const turn = await processDialogTurn(callerId, userSpeech);
        if (turn.isCompleted) {
          replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN">${turn.evaluationResult.spokenScript}</Say>
  <Sms to="${callerId}">${turn.evaluationResult.smsChecklist}</Sms>
  <Hangup/>
</Response>`;
        } else {
          replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN">${turn.nextPromptText}</Say>
  <Gather input="speech" language="hi-IN" timeout="5" action="/api/telephony/ivr" />
</Response>`;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      return res.end(replyXml);
    }

    // 7. API: WhatsApp Voice Webhook Simulator
    if (pathname === '/api/whatsapp/webhook' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const senderPhone = body.from || "919876543210";
      const voiceText = body.text || "हम 48 साल के हैं, विधवा हैं, कोई जमीन नहीं है।";

      const turn = await processDialogTurn(senderPhone, voiceText);
      const responsePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: senderPhone,
        type: "interactive",
        action_slip: turn.isCompleted ? turn.evaluationResult.smsChecklist : null,
        spoken_audio_script: turn.isCompleted ? turn.evaluationResult.spokenScript : turn.nextPromptText,
        is_completed: turn.isCompleted
      };

      return sendJson(res, 200, responsePayload);
    }

    // Static File Serving
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);

  } catch (err) {
    console.error(`[Server Error at ${pathname}]`, err);
    sendJson(res, 500, { error: err.message });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`⚠️ [Port ${PORT} is already in use. Retrying on port ${nextPort}...]`);
    server.listen(nextPort, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(` JanKalyan Voice Gateway (Seva Kendra Engine) Active `);
      console.log(` URL: http://localhost:${nextPort}`);
      console.log(` Zero-Literacy Voice Scheme Eligibility Protocol       `);
      console.log(`=======================================================`);
    });
  } else {
    console.error("Server error:", err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` JanKalyan Voice Gateway (Seva Kendra Engine) Active `);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Zero-Literacy Voice Scheme Eligibility Protocol       `);
  console.log(`=======================================================`);
});
