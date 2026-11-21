/**
 * JanSeva Live Debugger Test
 * Tests live Sarvam AI STT (saaras:v3) and TTS (bulbul:v3) with actual API key.
 */

import fs from 'fs';
import { textToSpeech, speechToText } from '../services/sarvam.js';
import { matchSchemes } from '../engine/eligibility.js';
import { diagnoseStoppage } from '../engine/triage.js';

// Auto-load .env
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/SARVAM_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

console.log("=======================================================");
console.log(" JANSEVA LIVE DEBUGGER TEST");
console.log(" API Key configured:", apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : "MISSING");
console.log("=======================================================\n");

async function runLiveDebugger() {
  let passed = 0;
  let failed = 0;

  // Test 1: Sarvam Bulbul v3 TTS Hindi
  try {
    console.log("[Test 1] Testing Sarvam Bulbul v3 TTS (Hindi)...");
    const ttsHi = await textToSpeech("नमस्ते, जनसेवा केंद्र में आपका स्वागत है।", "kavya", apiKey);
    if (ttsHi.audio_base64 && ttsHi.audio_base64.length > 1000) {
      console.log(`✓ PASSED: Bulbul v3 TTS generated ${ttsHi.audio_base64.length} chars of neural audio`);
      passed++;
    } else {
      console.error("❌ FAILED: Bulbul v3 did not return audio", ttsHi);
      failed++;
    }
  } catch (e) {
    console.error("❌ FAILED Test 1 Exception:", e.message);
    failed++;
  }

  // Test 2: Sarvam Bulbul v3 TTS Bengali
  try {
    console.log("\n[Test 2] Testing Sarvam Bulbul v3 TTS (Bengali)...");
    const ttsBn = await textToSpeech("নমস্কার, জনসেবা কেন্দ্রে আপনাকে স্বাগত।", "kavya", apiKey);
    if (ttsBn.audio_base64 && ttsBn.audio_base64.length > 1000) {
      console.log(`✓ PASSED: Bulbul v3 generated ${ttsBn.audio_base64.length} chars of Bengali neural audio`);
      passed++;
    } else {
      console.error("❌ FAILED: Bulbul v3 Bengali did not return audio", ttsBn);
      failed++;
    }
  } catch (e) {
    console.error("❌ FAILED Test 2 Exception:", e.message);
    failed++;
  }

  // Test 3: Sarvam Saaras v3 STT with clean WAV
  try {
    console.log("\n[Test 3] Testing Sarvam Saaras v3 STT...");
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

    const sttRes = await speechToText(buffer, "audio/wav", apiKey, "hi-IN");
    if (sttRes.is_fallback === false) {
      console.log("✓ PASSED: Saaras v3 STT successfully connected and processed audio:", sttRes);
      passed++;
    } else {
      console.error("❌ FAILED: Saaras v3 returned fallback", sttRes);
      failed++;
    }
  } catch (e) {
    console.error("❌ FAILED Test 3 Exception:", e.message);
    failed++;
  }

  // Test 4: Deterministic Scheme Matcher
  try {
    console.log("\n[Test 4] Testing Deterministic Scheme Matcher...");
    const res = matchSchemes({
      age: 49,
      gender: "female",
      marital_status: "widow",
      landholding_acres: 0.0,
      annual_income_inr: 40000,
      is_tax_payer: false,
      kutcha_house_or_homeless: true
    });
    if (res.matchedCount >= 2 && res.primaryDocuments.length === 3) {
      console.log(`✓ PASSED: Matched ${res.matchedCount} schemes and Actionable Triad generated`);
      passed++;
    } else {
      console.error("❌ FAILED: Match schemes unexpected output", res);
      failed++;
    }
  } catch (e) {
    console.error("❌ FAILED Test 4 Exception:", e.message);
    failed++;
  }

  // Test 5: Pension Stoppage Triage Engine
  try {
    console.log("\n[Test 5] Testing Pension Stoppage Triage (Parvati Devi)...");
    const diag = diagnoseStoppage("हमार पेंशन तीन महीना से ना आवता", "7193", "bhojpuri");
    if (diag.diagnosis.error_code === "ERR_504_BANK_DORMANT" && diag.ticket_token.startsWith("JP-7193")) {
      console.log(`✓ PASSED: Diagnosed ${diag.diagnosis.error_code} with token ${diag.ticket_token}`);
      passed++;
    } else {
      console.error("❌ FAILED: Triage diagnosis mismatch", diag);
      failed++;
    }
  } catch (e) {
    console.error("❌ FAILED Test 5 Exception:", e.message);
    failed++;
  }

  console.log("\n=======================================================");
  console.log(` DEBUGGER SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runLiveDebugger();
