/**
 * HTTP Integration Test Suite for Server Endpoints
 * Tests real HTTP requests against server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

// Helper to make HTTP request
function postJson(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET'
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function postAudio(port, path, audioBuffer, language = 'hi-IN', fallbackText = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length,
        'x-session-id': 'test_voice_session',
        'x-language': language,
        'x-fallback-transcript': encodeURIComponent(fallbackText)
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(audioBuffer);
    req.end();
  });
}

// Generate simple 16kHz PCM WAV
function createWav() {
  const sampleRate = 16000;
  const numSamples = sampleRate; // 1s
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  return buffer;
}

async function testHttpEndpoints() {
  const PORT = process.env.PORT || 3000;
  console.log(`Testing HTTP Endpoints on port ${PORT}...`);

  let passed = 0;
  let failed = 0;

  // 1. /api/health
  try {
    const health = await getJson(PORT, '/api/health');
    if (health.status === 200 && health.data.status === 'healthy') {
      console.log(`✓ [GET /api/health] Healthy (Sarvam Configured: ${health.data.sarvam_configured})`);
      passed++;
    } else {
      console.error(`❌ [GET /api/health] Failed:`, health);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [GET /api/health] Error:`, e.message);
    failed++;
  }

  // 2. /api/chat/init (Bhojpuri)
  try {
    const initRes = await postJson(PORT, '/api/chat/init', { language: 'bhojpuri' });
    if (initRes.status === 200 && initRes.data.promptText.includes('प्रणाम')) {
      console.log(`✓ [POST /api/chat/init (Bhojpuri)] Greeting returned: "${initRes.data.promptText.slice(0, 40)}..."`);
      passed++;
    } else {
      console.error(`❌ [POST /api/chat/init] Failed:`, initRes);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [POST /api/chat/init] Error:`, e.message);
    failed++;
  }

  // 3. /api/chat/turn (Free-form text)
  try {
    const turnRes = await postJson(PORT, '/api/chat/turn', {
      text: "हमार उम्र 48 साल बा, हमार पति नइखन, कवनो जमीन नइखे",
      language: "bhojpuri"
    });
    if (turnRes.status === 200 && turnRes.data.isCompleted && turnRes.data.type === 'SCHEMES_MATCHED') {
      console.log(`✓ [POST /api/chat/turn] Dynamic resolution succeeded: Matched ${turnRes.data.evaluationResult.matchedCount} schemes`);
      passed++;
    } else {
      console.error(`❌ [POST /api/chat/turn] Failed:`, turnRes);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [POST /api/chat/turn] Error:`, e.message);
    failed++;
  }

  // 4. /api/chat/audio (PCM WAV upload with fallback speech recognition)
  try {
    const wav = createWav();
    const audioRes = await postAudio(PORT, '/api/chat/audio', wav, 'hi-IN', 'हम 48 साल के हैं विधवा हैं कोई जमीन नहीं है');
    if (audioRes.status === 200 && audioRes.data.type === 'SCHEMES_MATCHED') {
      console.log(`✓ [POST /api/chat/audio] Audio endpoint processed successfully (Type: ${audioRes.data.type})`);
      passed++;
    } else {
      console.error(`❌ [POST /api/chat/audio] Failed:`, audioRes);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [POST /api/chat/audio] Error:`, e.message);
    failed++;
  }

  // 5. /api/triage/pension (Parvati Devi)
  try {
    const triageRes = await postJson(PORT, '/api/triage/pension', {
      query: "हमार पेंशन तीन महीना से ना आवता",
      identifier: "7193",
      language: "bhojpuri"
    });
    if (triageRes.status === 200 && triageRes.data.diagnosis.error_code === 'ERR_504_BANK_DORMANT') {
      console.log(`✓ [POST /api/triage/pension] Triage successfully diagnosed ${triageRes.data.diagnosis.error_code}`);
      passed++;
    } else {
      console.error(`❌ [POST /api/triage/pension] Failed:`, triageRes);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [POST /api/triage/pension] Error:`, e.message);
    failed++;
  }

  // 6. /api/schemes
  try {
    const schemesRes = await getJson(PORT, '/api/schemes');
    if (schemesRes.status === 200 && Array.isArray(schemesRes.data) && schemesRes.data.length >= 7) {
      console.log(`✓ [GET /api/schemes] Returned ${schemesRes.data.length} verified schemes`);
      passed++;
    } else {
      console.error(`❌ [GET /api/schemes] Failed:`, schemesRes);
      failed++;
    }
  } catch (e) {
    console.error(`❌ [GET /api/schemes] Error:`, e.message);
    failed++;
  }

  console.log(`\nHTTP TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testHttpEndpoints();
