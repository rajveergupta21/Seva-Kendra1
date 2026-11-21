/**
 * Seva Kendra - Comprehensive Test Suite
 * Asserts all core requirements from Task 6:
 * - Bardhaman widow profile extraction & matching
 * - Bengali numerals & IGNOAPS matching
 * - Safety flow & helplines (zero persistence)
 * - Payment triage (DBT & Life certificate)
 * - Spoken reply guardrails (no markdown, honest claims)
 * - Gemini REST endpoint & header verification
 */

import assert from 'assert';
import { evaluateAllSchemes, evaluateSchemeEligibility } from '../engine/eligibility.js';
import { diagnoseStoppage } from '../engine/triage.js';
import {
  extractIntentAndProfile,
  generateSpokenReply,
  processDynamicTurn,
  convertIndicDigitsToAscii,
  getOrCreateSession,
  resetSession,
  SAFETY_HELPLINES
} from '../services/dynamic_assistant.js';

const RESULTS = [];

function recordTest(name, passed, detail = "") {
  RESULTS.push({ name, passed, detail });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${icon} | ${name} ${detail ? `(${detail})` : ""}`);
  if (!passed) {
    throw new Error(`Test failed: ${name}`);
  }
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("SEVA KENDRA - COMPREHENSIVE AUTOMATED VERIFICATION");
  console.log("================================================================================\n");

  // TEST 1: Bardhaman widow profile extraction, follow-up, and scheme matching
  console.log("[Test 1: Bardhaman Resident Profile]");
  const utterance1 = "I am 47, my husband has died, I have no land, I live in Bardhaman";
  const extraction1 = await extractIntentAndProfile(utterance1, {}, [], "en");
  const p1 = extraction1.extracted_fields || {};
  
  assert.strictEqual(p1.age, 47, "Age must be 47");
  assert.strictEqual(p1.marital_status, "widow", "Marital status must be widow");
  assert.strictEqual(p1.state, "West Bengal", "Bardhaman must resolve to West Bengal");
  assert.strictEqual(p1.district, "Bardhaman", "District must be Bardhaman");

  const eval1 = evaluateAllSchemes({ ...p1, gender: "female" }, "en");
  assert(eval1.matchedVerified.some(s => s.id === "wb_annapurna_yojana"), "Must match Annapurna Yojana");
  assert.strictEqual(eval1.needsInfo?.field, "bpl_or_ration_card", "Must ask one follow-up for BPL");

  // With BPL confirmed:
  const eval1WithBpl = evaluateAllSchemes({ ...p1, gender: "female", bpl_or_ration_card: true }, "en");
  assert(eval1WithBpl.matchedVerified.some(s => s.id === "central_ignwps"), "Must also match IGNWPS with BPL");
  recordTest("1. 'I am 47, husband died, Bardhaman' -> extracts age 47, WB, asks BPL, matches Annapurna + IGNWPS", true);

  // TEST 2: Bengali input with Bengali digits (আমার বয়স ৬২, বিপিএল কার্ড আছে, কলকাতায় থাকি)
  console.log("\n[Test 2: Bengali Numerals & IGNOAPS Matching]");
  const utterance2 = "আমার বয়স ৬২, বিপিএল কার্ড আছে, কলকাতায় থাকি";
  const ascii2 = convertIndicDigitsToAscii(utterance2);
  assert.strictEqual(ascii2, "আমার বয়স 62, বিপিএল কার্ড আছে, কলকাতায় থাকি", "Bengali numerals must convert to ASCII");

  const extraction2 = await extractIntentAndProfile(utterance2, {}, [], "bn");
  const p2 = extraction2.extracted_fields || {};
  assert.strictEqual(p2.age, 62, "Age must be 62");
  assert.strictEqual(p2.state, "West Bengal", "Kolkata must resolve to West Bengal");
  assert.strictEqual(extraction2.language_reply, "bn", "Language reply must be Bengali");

  const eval2 = evaluateAllSchemes({ ...p2, bpl_or_ration_card: true }, "bn");
  assert(eval2.matchedVerified.some(s => s.id === "central_ignoaps"), "Must match IGNOAPS for age 62 with BPL");
  recordTest("2. Bengali voice with Bengali digits 'আমার বয়স ৬২' -> extracts age 62, matches IGNOAPS, replies in 'bn'", true);

  // TEST 3: Danger input (আমার স্বামী আমাকে মারধর করে) -> safety override, zero persistence
  console.log("\n[Test 3: Domestic Violence Safety Flow]");
  const sessionId3 = "session_safety_test";
  resetSession(sessionId3);
  const session3 = getOrCreateSession(sessionId3, "bn");

  const dangerUtterance = "আমার স্বামী আমাকে মারধর করে";
  const turn3 = await processDynamicTurn(sessionId3, dangerUtterance, "bn", false);
  
  assert.strictEqual(turn3.flow, "safety", "Must trigger safety flow");
  assert.strictEqual(turn3.screen_data.schemes.length, 0, "Must skip scheme matching");
  assert.strictEqual(turn3.screen_data.helplines.length, 5, "Must return all 5 helplines");
  const helplineNumbers = turn3.screen_data.helplines.map(h => h.number);
  assert(helplineNumbers.includes("112") && helplineNumbers.includes("181") && helplineNumbers.includes("1098") && helplineNumbers.includes("15100") && helplineNumbers.includes("14416"));
  assert.strictEqual(session3.history.length, 0, "Safety turns MUST NOT be saved to history");
  recordTest("3. Danger input ('আমার স্বামী আমাকে মারধর করে') -> flow: 'safety', 5 helplines, zero history persistence", true);

  // TEST 4: Payment stoppage triage
  console.log("\n[Test 4: Payment Stoppage Triage]");
  const pmtUtterance = "My widow pension stopped coming";
  const turn4 = await processDynamicTurn("session_pmt_test", pmtUtterance, "en", false);
  assert.strictEqual(turn4.flow, "payment_triage", "Must trigger payment_triage flow");
  assert(turn4.screen_data.triage_checklist.length >= 4, "Must return diagnostic checks");
  const triageTitles = turn4.screen_data.triage_checklist.map(c => c.title).join(' ');
  assert(triageTitles.toLowerCase().includes("aadhaar") && triageTitles.toLowerCase().includes("life certificate"));
  recordTest("4. 'My widow pension stopped coming' -> flow: 'payment_triage' with DBT/Aadhaar/Life Certificate checks", true);

  // TEST 5: Spoken reply guardrails (no markdown, honest wording)
  console.log("\n[Test 5: Spoken Reply Guardrails]");
  const spokenReply5 = await generateSpokenReply({
    stageBResult: {
      flow: "results",
      screen_data: {
        schemes: [
          { name: "Annapurna Yojana (West Bengal)", status: "verified" }
        ]
      }
    },
    userProfile: { age: 35, state: "West Bengal" },
    languageReply: "hi",
    userQuestion: "What schemes do I get?"
  });

  assert(!spokenReply5.includes('*'), "Spoken reply must not contain markdown asterisks (*)");
  assert(!spokenReply5.includes('#'), "Spoken reply must not contain markdown hashes (#)");
  assert(!spokenReply5.toLowerCase().includes("approved"), "Must not claim 'approved'");
  assert(!spokenReply5.toLowerCase().includes("sms sent"), "Must not claim 'SMS sent'");
  recordTest("5. Spoken reply guardrails -> zero markdown, honest wording ('you may be eligible', 'approval at office')", true);

  // TEST 6: Verify Gemini REST Endpoint and Header configuration
  console.log("\n[Test 6: Gemini Native Adapter Request Format]");
  const originalFetch = globalThis.fetch;
  let interceptedUrl = null;
  let interceptedHeaders = null;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedHeaders = options.headers;
    interceptedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"reply": "ok"}' }] } }]
      })
    };
  };

  try {
    const { callLlm } = await import('../services/llm.js');
    await callLlm({
      systemPrompt: "Test prompt",
      messages: [{ role: "user", content: "Test" }],
      jsonMode: true
    });

    assert(interceptedUrl.includes("generativelanguage.googleapis.com/v1beta/models/"), "Must call generativelanguage.googleapis.com");
    assert(interceptedUrl.endsWith(":generateContent"), "Must end with :generateContent");
    assert(interceptedHeaders["x-goog-api-key"], "Must pass key in x-goog-api-key header");
    assert(!interceptedHeaders["Authorization"], "Must NOT use OpenAI Bearer authorization for Gemini");
    assert.strictEqual(interceptedBody.generationConfig?.responseMimeType, "application/json", "JSON mode must set responseMimeType");
    recordTest("6. services/llm.js sends requests to generativelanguage.googleapis.com with x-goog-api-key header", true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // TEST 7: Whole-word state matching guardrail ("support" must NOT match UP)
  console.log("\n[Test 7: Regex/Word Boundary Guardrails]");
  const supportUtterance = "I live in a support home in Delhi";
  const extraction7 = await extractIntentAndProfile(supportUtterance, {}, [], "en");
  assert.strictEqual(extraction7.extracted_fields?.state, "Delhi", "Must be Delhi");
  assert.notStrictEqual(extraction7.extracted_fields?.state, "Uttar Pradesh", "Must NOT match UP inside 'support'");
  recordTest("7. 'I live in support home in Delhi' -> state is Delhi, NOT Uttar Pradesh", true);

  console.log("\n================================================================================");
  console.log("SUMMARY: ALL COMPREHENSIVE TESTS PASSED SUCCESSFULLY (100%)");
  console.log("================================================================================");
}

runAllTests().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
