/**
 * JanSeva Kendra - Comprehensive System & Model Debugger
 * Tests all models, APIs, dynamic conversation, STT, and TTS end-to-end.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { speechToText, textToSpeech } from '../services/sarvam.js';
import { processDynamicTurn } from '../services/dynamic_assistant.js';
import { diagnoseStoppage } from '../engine/triage.js';
import { matchSchemes } from '../engine/eligibility.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env
const envPath = path.join(__dirname, '..', '.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('SARVAM_API_KEY=')) {
      apiKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}
process.env.SARVAM_API_KEY = apiKey;

console.log("=======================================================");
console.log(" JANSEVA SYSTEM & MODEL DEBUGGER SUITE");
console.log(` SARVAM_API_KEY configured: ${apiKey ? apiKey.slice(0, 8) + '...' : 'NONE'}`);
console.log("=======================================================\n");

// Helper: Generate a real 16kHz mono PCM WAV Buffer
function createSyntheticPcmWav(durationSeconds = 1, sampleRate = 16000) {
  const numSamples = sampleRate * durationSeconds;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // Mono
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Generate a gentle 440Hz sine wave tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3; // Amplitude 0.3
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Live Sarvam Bulbul v3 TTS
  try {
    console.log("[Test 1] Testing Sarvam Bulbul v3 TTS (Hindi)...");
    const tts = await textToSpeech("नमस्ते, जनसेवा केंद्र में आपका स्वागत है।", "kavya", apiKey);
    if (tts && tts.audio_base64 && tts.audio_base64.length > 500) {
      console.log(`✓ Test 1 PASSED: Bulbul v3 returned ${tts.audio_base64.length} chars of neural audio`);
      passed++;
    } else {
      console.error("❌ Test 1 FAILED: Bulbul v3 TTS returned empty audio", tts);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 1 FAILED Exception:", e.message);
    failed++;
  }

  // Test 2: Live Sarvam Saaras v3 STT with PCM WAV
  try {
    console.log("\n[Test 2] Testing Sarvam Saaras v3 STT with 16kHz PCM WAV...");
    const wavBuffer = createSyntheticPcmWav(1, 16000);
    const stt = await speechToText(wavBuffer, "audio/wav", apiKey, "hi-IN");
    if (stt && stt.is_fallback === false) {
      console.log(`✓ Test 2 PASSED: Saaras v3 STT successfully connected and returned 200 (transcript: "${stt.transcript}")`);
      passed++;
    } else {
      console.error("❌ Test 2 FAILED: Saaras v3 STT returned fallback", stt);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 2 FAILED Exception:", e.message);
    failed++;
  }

  // Test 3: Dynamic Assistant - Single Turn Scheme Qualification
  try {
    console.log("\n[Test 3] Testing Dynamic Assistant (Single Turn Scheme Discovery)...");
    const utterance = "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है।";
    const result = await processDynamicTurn("test_session_1", utterance, "hi");
    if (result.type === "SCHEMES_MATCHED" && result.isCompleted && result.evaluationResult.matchedCount >= 1) {
      console.log(`✓ Test 3 PASSED: Matched ${result.evaluationResult.matchedCount} schemes in 1 turn (Type: ${result.type})`);
      if (result.audioBase64) {
        console.log(`  Audio synthesized: ${result.audioBase64.length} chars`);
      }
      passed++;
    } else {
      console.error("❌ Test 3 FAILED: Unexpected response", result);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 3 FAILED Exception:", e.message);
    failed++;
  }

  // Test 4: Dynamic Assistant - Pension Stoppage Triage (Zero Questions)
  try {
    console.log("\n[Test 4] Testing Dynamic Assistant (Pension Stoppage Grievance)...");
    const utterance = "हमार पेंशन तीन महीना से ना आवता";
    const result = await processDynamicTurn("test_session_2", utterance, "bhojpuri");
    if (result.type === "TRIAGE_RESOLVED" && result.isCompleted && result.triageData.diagnosis.error_code) {
      console.log(`✓ Test 4 PASSED: Instant Triage diagnosed ${result.triageData.diagnosis.error_code} without interrogating the citizen`);
      console.log(`  Citizen explanation: "${result.replyText.slice(0, 60)}..."`);
      passed++;
    } else {
      console.error("❌ Test 4 FAILED: Unexpected response", result);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 4 FAILED Exception:", e.message);
    failed++;
  }

  // Test 5: Dynamic Assistant - Conversational Follow-up (No robotic quiz)
  try {
    console.log("\n[Test 5] Testing Dynamic Assistant (Natural Follow-up)...");
    const utterance = "नमस्ते, हमार नाम रमेश है";
    const result = await processDynamicTurn("test_session_3", utterance, "hi");
    if (result.type === "FOLLOW_UP_QUESTION" && !result.isCompleted && result.replyText.includes("उम्र")) {
      console.log(`✓ Test 5 PASSED: Assistant asked natural follow-up question: "${result.replyText}"`);
      passed++;
    } else {
      console.error("❌ Test 5 FAILED: Unexpected response", result);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 5 FAILED Exception:", e.message);
    failed++;
  }

  // Test 6: Deterministic Eligibility Engine (Actionable Triad)
  try {
    console.log("\n[Test 6] Testing Actionable Triad Generation...");
    const profile = {
      age: 49,
      gender: "female",
      marital_status: "widow",
      landholding_acres: 0.0,
      annual_income_inr: 45000,
      is_tax_payer: false,
      kutcha_house_or_homeless: true
    };
    const evalResult = matchSchemes(profile);
    if (evalResult.matchedCount >= 2 && evalResult.primaryDocuments.length === 3 && evalResult.smsChecklist.length > 50) {
      console.log(`✓ Test 6 PASSED: Generated 3 primary documents: ${evalResult.primaryDocuments.join(', ')}`);
      console.log(`  Office Destination: ${evalResult.primaryOffice}`);
      passed++;
    } else {
      console.error("❌ Test 6 FAILED:", evalResult);
      failed++;
    }
  } catch (e) {
    console.error("❌ Test 6 FAILED Exception:", e.message);
    failed++;
  }

  console.log("\n=======================================================");
  console.log(` TOTAL: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runTests();
