/**
 * Dynamic Assistant & Conversational Engine Tests
 */

import { extractIntentAndProfile, processDynamicTurn } from '../services/dynamic_assistant.js';

console.log("=== Testing Dynamic Conversational Engine ===");

// 1. Spoken Slot Extraction
const s1 = await extractIntentAndProfile("हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है।", {}, [], "hi");
console.log("Extracted 1:", s1.extracted_fields);
if (s1.extracted_fields.age === 48 && s1.extracted_fields.marital_status === "widow") {
  console.log(" PASS: Extracted Age 48, Widow");
} else {
  console.error(" FAIL on Utterance 1", s1);
  process.exit(1);
}

// 2. Whole word state matching (prevent 'support' -> UP)
const s2 = await extractIntentAndProfile("I live in support group in Delhi", {}, [], "en");
console.log("Extracted 2 State:", s2.extracted_fields.state);
if (s2.extracted_fields.state === "Delhi") {
  console.log(" PASS: Correctly matched Delhi and avoided matching UP inside 'support'");
} else {
  console.error(" FAIL: Expected Delhi, got", s2.extracted_fields.state);
  process.exit(1);
}

// 3. Dynamic Turn execution
async function runTest() {
  const turn = await processDynamicTurn("test_session_dialog", "हम उत्तर प्रदेश से हैं, उम्र 42 साल है, विधवा हैं और बीपीएल कार्ड है", "hi", false);
  console.log("Turn Flow:", turn.flow);
  if (turn.flow === "results" && turn.screen_data.schemes.some(s => s.id === "central_ignwps")) {
    console.log(" PASS: Dynamic turn resolved to results matching IGNWPS");
  } else {
    console.error(" FAIL on Dynamic Turn", turn);
    process.exit(1);
  }
}

await runTest();
console.log("\n ALL DIALOG & ASSISTANT TESTS PASSED!\n");
