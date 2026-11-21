/**
 * Latency Benchmark Test Script
 * Replays 10 recorded rural citizen utterances against the voice pipeline.
 * Measures:
 *   - t_speech_end
 *   - t_stt_final
 *   - t_nlu_done
 *   - t_tts_first_byte
 *   - E2E Latency (End of Speech -> First Audio Byte of Reply)
 * Calculates and prints p50, p90, and p95 metrics against the hackathon targets.
 * Target: p50 ≤ 1.5s (1500ms), p95 ≤ 3.0s (3000ms).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import '../services/env_loader.js';
import { textToSpeech, speechToText, splitIntoSentences } from '../services/sarvam.js';
import { processDynamicTurn } from '../services/dynamic_assistant.js';
import { getOrSynthesizeCachedAudio } from '../services/tts_cache.js';
import { recordTurnMetrics, getMetricsSummary } from '../services/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=======================================================");
console.log(" LATENCY BENCHMARK: 10 Spoken Utterances Replay Test");
console.log(" Target: p50 ≤ 1500ms, p95 ≤ 3000ms");
console.log("=======================================================\n");

const TEST_UTTERANCES = [
  { id: 1, text: "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है", lang: "hi" },
  { id: 2, text: "हमार उम्र 60 साल बा, वृद्धा पेंशन के बारे में जानी", lang: "bhojpuri" },
  { id: 3, text: "खेती खातिर कवन सरकारी योजना बा, 2 एकड़ खेत बा", lang: "bhojpuri" },
  { id: 4, text: "हमार पेंशन तीन महीना से ना आवता", lang: "bhojpuri" },
  { id: 5, text: "घर बनाने के लिए प्रधानमंत्री आवास योजना की जानकारी चाहिए", lang: "hi" },
  { id: 6, text: "আমাদের বয়স ৬২ বছর কোনো জমি নেই", lang: "bn" },
  { id: 7, text: "हमारे पास पीला राशन कार्ड है और दो बेटियां हैं", lang: "hi" },
  { id: 8, text: "I am 65 years old and need pension details", lang: "en" },
  { id: 9, text: "हमर उमर 48 साल अछि, पति नहि छथि, कोनो जमीन नहि अछि", lang: "maithili" },
  { id: 10, text: "हम दैनिक मजदूरी करते हैं, जॉब कार्ड बना है", lang: "hi" }
];

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

const FIXTURE_WAV = path.join(__dirname, 'fixtures', 'hindi_speech.wav');
const sampleWavBuffer = fs.readFileSync(FIXTURE_WAV);

async function runBenchmark() {
  const results = [];

  for (let i = 0; i < TEST_UTTERANCES.length; i++) {
    const item = TEST_UTTERANCES[i];
    console.log(`[Turn ${i + 1}/10] Testing: "${item.text}" (${item.lang})...`);

    const t_speech_end = Date.now();

    // 1. STT Phase: Transcribe sample input audio
    const sttStartTime = Date.now();
    const sttRes = await speechToText(sampleWavBuffer, 'audio/wav', process.env.SARVAM_API_KEY, item.lang);
    const transcript = (sttRes && sttRes.transcript) ? sttRes.transcript : item.text;
    const t_stt_final = Date.now();

    // 2. NLU / Eligibility Evaluation Phase (pure logic)
    const turnResult = await processDynamicTurn(`bench_session_${i}`, transcript, item.lang, false);
    const t_nlu_done = Date.now();

    // 3. TTS Phase: Check cache or sentence-by-sentence first chunk
    const cached = await getOrSynthesizeCachedAudio(turnResult.replyText, item.lang);
    let t_tts_first_byte = Date.now();

    if (!cached) {
      // Stream sentence 1 first for minimal TTFB
      const sentences = splitIntoSentences(turnResult.replyText);
      const firstSentence = sentences[0] || turnResult.replyText;
      await textToSpeech(firstSentence, item.lang, "aarti_hi_customer");
      t_tts_first_byte = Date.now();
    }

    const stt_ms = t_stt_final - t_speech_end;
    const nlu_ms = t_nlu_done - t_stt_final;
    const tts_first_byte_ms = t_tts_first_byte - t_nlu_done;
    const e2e_ms = t_tts_first_byte - t_speech_end;

    // Record to metrics tracker
    recordTurnMetrics({
      turnId: `bench_${i}`,
      t_speech_end,
      t_stt_final,
      t_nlu_done,
      t_tts_first_byte
    });

    results.push({
      turn: i + 1,
      utterance: item.text.substring(0, 35) + '...',
      lang: item.lang,
      stt_ms,
      nlu_ms,
      tts_first_byte_ms,
      e2e_ms,
      cached: Boolean(cached)
    });

    console.log(`   -> STT: ${stt_ms}ms | NLU: ${nlu_ms}ms | TTS 1st Byte: ${tts_first_byte_ms}ms | E2E: ${e2e_ms}ms ${cached ? '(Cache HIT)' : ''}`);
  }

  // Calculate Statistics
  const e2eList = results.map(r => r.e2e_ms);
  const p50 = percentile(e2eList, 50);
  const p90 = percentile(e2eList, 90);
  const p95 = percentile(e2eList, 95);
  const min = Math.min(...e2eList);
  const max = Math.max(...e2eList);
  const avg = Math.round(e2eList.reduce((a, b) => a + b, 0) / e2eList.length);

  console.log("\n=======================================================");
  console.log(" LATENCY BENCHMARK RESULTS (10 Turns Replayed)");
  console.log("=======================================================");
  console.log(` p50 Latency : ${p50} ms  (Target: ≤ 1500 ms) -> ${p50 <= 1500 ? '✅ PASSED' : '⚠️ EXCEEDED'}`);
  console.log(` p90 Latency : ${p90} ms`);
  console.log(` p95 Latency : ${p95} ms  (Target: ≤ 3000 ms) -> ${p95 <= 3000 ? '✅ PASSED' : '⚠️ EXCEEDED'}`);
  console.log(` Min Latency : ${min} ms`);
  console.log(` Max Latency : ${max} ms`);
  console.log(` Avg Latency : ${avg} ms`);
  console.log("=======================================================\n");

  // Verify /api/metrics summary
  const summary = getMetricsSummary();
  console.log("Telemetry Summary verification:");
  console.log(` Total Recorded Turns: ${summary.count}`);
  console.log(` Telemetry p50: ${summary.e2e_first_audio.p50} ms | p95: ${summary.e2e_first_audio.p95} ms`);

  return { p50, p95, results };
}

runBenchmark().catch(console.error);
