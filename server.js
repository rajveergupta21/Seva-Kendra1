/**
 * JanKalyan Voice Gateway - Universal Server (Seva Kendra)
 * Low-latency Streaming STT/TTS, WebSocket Gateway, Rate Limiting, & Metrics Telemetry
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import { getOrCreateSession, processDialogTurn, resetSession, QUESTIONS } from './services/dialog.js';
import { speechToText, textToSpeech, convertSpeechStream, createSttStreamingSession, getSttLanguageCode, getTtsLanguageCode, splitIntoSentences } from './services/sarvam.js';
import { matchSchemes } from './engine/eligibility.js';
import { diagnoseStoppage, BENEFICIARIES, listGrievances } from './engine/triage.js';
import { processDynamicTurn } from './services/dynamic_assistant.js';
import { ERROR_CODES, getErrorMessage } from './services/error_messages.js';
import { recordTurnMetrics, updatePlaybackStart, getMetricsSummary } from './services/metrics.js';
import { GREETINGS, CACHE_DIR, getOrSynthesizeCachedAudio, prewarmTtsCache, generateEarconWav } from './services/tts_cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Auto-load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (val && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

// 2. SECURITY: Fail-fast if SARVAM_API_KEY is missing. Never print key.
if (!process.env.SARVAM_API_KEY) {
  console.error("FATAL: SARVAM_API_KEY environment variable is missing.");
  console.error("Please configure SARVAM_API_KEY in your .env or system environment.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

// ---------------------------------------------------------------------------
// Rate Limiting & Upload Limit Helpers
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // 120 requests/min per IP
const ipRequestCounts = new Map();

function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let record = ipRequestCounts.get(ip);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, startTime: now };
    ipRequestCounts.set(ip, record);
    return true;
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  return true;
}

// Periodic cleanup of rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      ipRequestCounts.delete(ip);
    }
  }
}, 30000);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-id, x-language, x-speech-end'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
      body += chunk.toString();
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

function parseRawBody(req, limitBytes = 2 * 1024 * 1024) { // 2MB upload cap
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Helper: Calculate RMS volume of raw 16-bit PCM buffer to detect silence
function calculatePcmRms(buffer) {
  if (!buffer || buffer.length < 2) return 0;
  let sumSq = 0;
  const numSamples = Math.floor(buffer.length / 2);
  for (let i = 0; i < numSamples; i++) {
    const val = buffer.readInt16LE(i * 2) / 32768.0;
    sumSq += val * val;
  }
  return Math.sqrt(sumSq / numSamples);
}

// ---------------------------------------------------------------------------
// HTTP Request Dispatcher
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-session-id, x-language, x-speech-end'
    });
    res.end();
    return;
  }

  // Rate Limiting
  if (!checkRateLimit(req)) {
    return sendJson(res, 429, {
      error: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please wait a moment."
    });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    // 0. API: Health & Edge PoP Telemetry
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: "healthy",
        service: "JanSeva Voice / JanKalyan Edge Gateway (Seva Kendra)",
        edge_pop: "CCU-01 (Kolkata Regional Edge PoP)",
        protocol: "HTTP/1.1 + WebSocket Streaming",
        sarvam_configured: Boolean(process.env.SARVAM_API_KEY)
      });
    }

    // 0b. API: Latency & Turn Metrics
    if (pathname === '/api/metrics' && req.method === 'GET') {
      return sendJson(res, 200, getMetricsSummary());
    }

    if (pathname === '/api/metrics/playback' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.turnId && body.t_playback_start) {
        updatePlaybackStart(body.turnId, body.t_playback_start);
      }
      return sendJson(res, 200, { status: "recorded" });
    }

    // 0c. API: Serve Cached TTS Audio
    if (pathname.startsWith('/api/tts/cached/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const filename = path.basename(pathname);
      const filePath = path.join(CACHE_DIR, filename);

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*'
        });
        if (req.method === 'HEAD') {
          return res.end();
        }
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
    }

    // 0d. API: Instant Earcon Chime (local tone)
    if (pathname === '/api/tts/earcon' && (req.method === 'GET' || req.method === 'HEAD')) {
      const wav = generateEarconWav();
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': wav.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      });
      if (req.method === 'HEAD') {
        return res.end();
      }
      res.end(wav);
      return;
    }

    // 0e. API: Gram Panchayat Secretary Grievances Feed
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

    // 2. API: Initial Language Greeting (Zero-latency cached)
    if (pathname === '/api/chat/init' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || `session_${Date.now()}`;
      const lang = body.language || 'hi';
      const greeting = GREETINGS[lang] || GREETINGS.hi;

      // Check TTS Cache
      const cached = await getOrSynthesizeCachedAudio(greeting.text, lang);

      return sendJson(res, 200, {
        sessionId,
        language: lang,
        promptText: greeting.text,
        promptHint: greeting.hint,
        audioUrl: cached ? cached.url : null,
        audioBase64: null
      });
    }

    // 3. API: Dynamic Turn Text
    if (pathname === '/api/chat/turn' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || 'default_session';
      const userText = body.text || '';
      const language = body.language || 'hi';

      const turnResult = await processDynamicTurn(sessionId, userText, language);
      return sendJson(res, 200, turnResult);
    }

    // 4. API: Audio Turn (REST Fallback with Distinct Error Codes)
    if (pathname === '/api/chat/audio' && req.method === 'POST') {
      const t_speech_end = parseInt(req.headers['x-speech-end'] || Date.now(), 10);
      const sessionId = req.headers['x-session-id'] || 'voice_session';
      const language = req.headers['x-language'] || 'hi';

      let audioBuffer;
      try {
        audioBuffer = await parseRawBody(req, 2 * 1024 * 1024); // 2 MB upload cap
      } catch (err) {
        if (err.message === 'PAYLOAD_TOO_LARGE') {
          return sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE", message: "Audio file exceeds 2 MB limit." });
        }
        throw err;
      }

      // Check audio presence & silence (RMS)
      if (!audioBuffer || audioBuffer.length < 200) {
        const errObj = getErrorMessage(ERROR_CODES.MIC_SILENT, language);
        return sendJson(res, 200, {
          type: "ERROR",
          errorCode: ERROR_CODES.MIC_SILENT,
          replyText: errObj.screenMessage,
          spokenScript: errObj.spokenText
        });
      }

      // If PCM data (skip header), compute RMS
      const pcmPayload = audioBuffer.length > 44 ? audioBuffer.subarray(44) : audioBuffer;
      const rms = calculatePcmRms(pcmPayload);
      if (rms < 0.005) { // Below silence threshold
        const errObj = getErrorMessage(ERROR_CODES.MIC_SILENT, language);
        return sendJson(res, 200, {
          type: "ERROR",
          errorCode: ERROR_CODES.MIC_SILENT,
          replyText: errObj.screenMessage,
          spokenScript: errObj.spokenText
        });
      }

      // Transcribe via Sarvam STT
      const mimeType = req.headers['content-type'] || 'audio/wav';
      const sttLangCode = getSttLanguageCode(language);
      const stt = await speechToText(audioBuffer, mimeType, process.env.SARVAM_API_KEY, sttLangCode);
      const t_stt_final = Date.now();

      if (stt.is_fallback && stt.error) {
        // Server/API error: do NOT blame user
        const errObj = getErrorMessage(ERROR_CODES.STT_API_ERROR, language);
        return sendJson(res, 200, {
          type: "ERROR",
          errorCode: ERROR_CODES.STT_API_ERROR,
          replyText: errObj.screenMessage,
          spokenScript: errObj.spokenText
        });
      }

      const transcript = (stt.transcript || "").trim();
      if (!transcript) {
        // Audio had volume, but no recognizable words
        const errObj = getErrorMessage(ERROR_CODES.TRULY_EMPTY_SPEECH, language);
        return sendJson(res, 200, {
          type: "ERROR",
          errorCode: ERROR_CODES.TRULY_EMPTY_SPEECH,
          replyText: errObj.screenMessage,
          spokenScript: errObj.spokenText
        });
      }

      // Dynamic turn execution
      const turnResult = await processDynamicTurn(sessionId, transcript, language);
      const t_nlu_done = Date.now();
      turnResult.userTranscript = transcript;

      // Fast TTS Synthesis / Cache lookup
      const cached = await getOrSynthesizeCachedAudio(turnResult.replyText, language);
      const t_tts_first_byte = Date.now();

      if (cached) {
        turnResult.audioUrl = cached.url;
      }

      // Metrics instrumentation
      const turnMetrics = recordTurnMetrics({
        t_speech_end,
        t_stt_final,
        t_nlu_done,
        t_tts_first_byte
      });
      turnResult.metrics = turnMetrics;

      return sendJson(res, 200, turnResult);
    }

    // 5. API: Direct 1-Click Evaluation
    if (pathname === '/api/evaluate/direct' && req.method === 'POST') {
      const profile = await parseJsonBody(req);
      const result = matchSchemes(profile);
      const cached = await getOrSynthesizeCachedAudio(result.spokenScript, "hi");
      if (cached) result.audioUrl = cached.url;
      return sendJson(res, 200, result);
    }

    // 6. API: Entitlement Stoppage & Pension Recovery Triage
    if (pathname === '/api/triage/pension' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const query = body.query || "हमार पेंशन तीन महीना से ना आवता";
      const identifier = body.identifier || "";
      const language = body.language || "bhojpuri";
      const diagnosis = diagnoseStoppage(query, identifier, language);
      const cached = await getOrSynthesizeCachedAudio(diagnosis.diagnosis.citizen_friendly_script, language);
      if (cached) diagnosis.audioUrl = cached.url;
      return sendJson(res, 200, diagnosis);
    }

    // 7. Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  } catch (error) {
    console.error(`[Server Exception] ${req.method} ${pathname}:`, error);
    sendJson(res, 500, { error: "INTERNAL_SERVER_ERROR", message: error.message });
  }
});

// ---------------------------------------------------------------------------
// WebSocket Streaming Gateway (/ws/speech)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === '/ws/speech') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  let sessionId = `ws_${Date.now()}`;
  let language = 'hi';
  let pcmChunks = [];
  let isReceiving = false;
  let t_speech_end = null;
  let sttStreamSession = null;

  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        // Incoming raw 16kHz PCM frame from AudioWorklet
        if (isReceiving) {
          const buf = Buffer.from(data);
          pcmChunks.push(buf);
          if (sttStreamSession) {
            sttStreamSession.sendAudioPcmChunk(buf.toString('base64'));
          }
        }
        return;
      }

      const msg = JSON.parse(data.toString());

      // 1. Session Init
      if (msg.type === 'init') {
        sessionId = msg.sessionId || sessionId;
        language = msg.language || 'hi';
        pcmChunks = [];
        isReceiving = true;

        // Try initializing Sarvam Streaming STT session
        try {
          const sttLangCode = getSttLanguageCode(language);
          sttStreamSession = await createSttStreamingSession({
            languageCode: sttLangCode,
            onPartial: (partialText) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'partial_transcript', transcript: partialText }));
              }
            },
            onError: (err) => {
              console.warn('[Sarvam Streaming Warning, will use REST fallback]:', err.message);
            }
          });
        } catch (e) {
          console.warn('[Sarvam Streaming Connect Error, will fallback to REST]:', e.message);
        }

        ws.send(JSON.stringify({ type: 'ready', sessionId, language }));
        return;
      }

      // 2. End of Speech (EOS)
      if (msg.type === 'eos') {
        isReceiving = false;
        t_speech_end = msg.clientSpeechEndTimestamp || Date.now();

        const fullPcmBuffer = Buffer.concat(pcmChunks);
        const rms = calculatePcmRms(fullPcmBuffer);

        // Check for silence
        if (fullPcmBuffer.length < 3200 || rms < 0.005) {
          const errObj = getErrorMessage(ERROR_CODES.MIC_SILENT, language);
          ws.send(JSON.stringify({
            type: 'error',
            errorCode: ERROR_CODES.MIC_SILENT,
            screenMessage: errObj.screenMessage,
            spokenText: errObj.spokenText
          }));
          return;
        }

        // Get final transcript: flush streaming or REST fallback
        let transcript = "";
        if (sttStreamSession) {
          sttStreamSession.flush();
          transcript = sttStreamSession.getTranscript();
          sttStreamSession.close();
          sttStreamSession = null;
        }

        // Fallback to REST transcribe if streaming didn't produce transcript
        if (!transcript) {
          // Wrap PCM in WAV header
          const wavBuffer = wrapPcmInWav(fullPcmBuffer, 16000);
          const sttLang = getSttLanguageCode(language);
          const sttRes = await speechToText(wavBuffer, 'audio/wav', process.env.SARVAM_API_KEY, sttLang);
          if (!sttRes.is_fallback) {
            transcript = sttRes.transcript;
          }
        }

        const t_stt_final = Date.now();

        if (!transcript) {
          const errObj = getErrorMessage(ERROR_CODES.TRULY_EMPTY_SPEECH, language);
          ws.send(JSON.stringify({
            type: 'error',
            errorCode: ERROR_CODES.TRULY_EMPTY_SPEECH,
            screenMessage: errObj.screenMessage,
            spokenText: errObj.spokenText
          }));
          return;
        }

        // Send final transcript immediately to UI
        ws.send(JSON.stringify({ type: 'final_transcript', transcript }));

        // Dynamic Turn Evaluation
        const turnResult = await processDynamicTurn(sessionId, transcript, language);
        const t_nlu_done = Date.now();
        turnResult.userTranscript = transcript;

        // Fast Audio Delivery: Cache Hit or Sentence-by-Sentence Streaming
        const cached = await getOrSynthesizeCachedAudio(turnResult.replyText, language);
        const t_tts_first_byte = Date.now();

        const turnMetrics = recordTurnMetrics({
          t_speech_end,
          t_stt_final,
          t_nlu_done,
          t_tts_first_byte
        });

        turnResult.metrics = turnMetrics;
        turnResult.audioUrl = cached ? cached.url : null;

        // If not cached, split into sentences and send first sentence audio fast
        if (!cached) {
          const sentences = splitIntoSentences(turnResult.replyText);
          const firstSentence = sentences[0] || turnResult.replyText;
          const firstTts = await textToSpeech(firstSentence, language, "aarti_hi_customer");
          turnResult.firstSentenceAudioBase64 = firstTts.audio_base64;
        }

        ws.send(JSON.stringify({
          type: 'turn_result',
          result: turnResult
        }));

        pcmChunks = [];
        return;
      }
    } catch (err) {
      console.error('[WS Error]', err);
      if (ws.readyState === ws.OPEN) {
        const errObj = getErrorMessage(ERROR_CODES.STT_API_ERROR, language);
        ws.send(JSON.stringify({
          type: 'error',
          errorCode: ERROR_CODES.STT_API_ERROR,
          screenMessage: errObj.screenMessage,
          spokenText: errObj.spokenText
        }));
      }
    }
  });

  ws.on('close', () => {
    if (sttStreamSession) {
      sttStreamSession.close();
      sttStreamSession = null;
    }
    pcmChunks = [];
  });
});

// Helper: Wrap raw 16kHz PCM in standard 44-byte WAV header
function wrapPcmInWav(pcmBuffer, sampleRate = 16000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// ---------------------------------------------------------------------------
// Server Startup & Cache Pre-warming
// ---------------------------------------------------------------------------
server.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(` Seva Kendra Voice Gateway (High-Performance Audio) Active `);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` WebSocket Streaming: ws://localhost:${PORT}/ws/speech`);
  console.log(` Rate Limiting: ${RATE_LIMIT_MAX_REQUESTS} req/min | 2MB Audio Cap`);
  console.log(`=======================================================`);

  // Pre-warm fixed audio cache in background
  try {
    await prewarmTtsCache();
  } catch (err) {
    console.warn(`[TTS Cache Startup Note] Cache prewarm will continue on demand: ${err.message}`);
  }
});
