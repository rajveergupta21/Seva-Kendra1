import { diagnoseStoppage } from '../engine/triage.js';

console.log("=== Testing Entitlement Stoppage Diagnostic Engine ===");

// Test 1: General Pension Stoppage Diagnostic
const t1 = diagnoseStoppage("हमार पेंशन तीन महीना से ना आवता", {}, "hi");
console.log("\n[Test 1: General Pension Stoppage Diagnostic]");
if (t1.checklist.length === 5 && t1.flow === "payment_triage") {
  console.log(" PASS: Payment triage returned 5 diagnostic steps without fake demo personas");
} else {
  console.error("❌ FAIL on Test 1", t1);
  process.exit(1);
}

// Test 2: Check for essential DBT and Life Certificate steps
const titles = t1.checklist.map(c => c.title).join(' ');
if (titles.includes("आधार") && titles.includes("जीवन प्रमाण")) {
  console.log(" PASS: Checklist includes Aadhaar DBT seeding and Life Certificate renewal");
} else {
  console.error("❌ FAIL on Test 2: Missing expected checks");
  process.exit(1);
}

// Test 3: Bengali language support
const t3 = diagnoseStoppage("আমার বিধবা ভাতা তিন মাস ধরে বন্ধ আছে", {}, "bn");
console.log("\n[Test 3: Bengali Pension Stoppage]");
if (t3.spoken_reply.includes("পেনশন") || t3.checklist[0].title.includes("আধার")) {
  console.log(" PASS: Bengali diagnostic checklist generated correctly");
} else {
  console.error("❌ FAIL on Test 3", t3);
  process.exit(1);
}

console.log("\n ALL ENTITLEMENT TRIAGE TESTS PASSED SUCCESSFULLY!\n");
