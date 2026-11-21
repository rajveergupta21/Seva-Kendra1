/**
 * Unit Test for Deterministic Eligibility Engine
 */

import { evaluateAllSchemes, evaluateSchemeEligibility } from '../engine/eligibility.js';

console.log("=== Testing Deterministic Eligibility Engine ===");

// Test 1: Kamla Devi (UP widow, 49, BPL) -> IGNWPS
const kamlaDevi = {
  age: 49,
  gender: 'female',
  marital_status: 'widow',
  bpl_or_ration_card: true,
  state: 'Uttar Pradesh'
};

const resultKamla = evaluateAllSchemes(kamlaDevi);
console.log("\n[Test 1: Kamla Devi Profile]");
console.log("Matched Schemes Count:", resultKamla.matchedVerified.length);
const matchedIds = resultKamla.matchedVerified.map(s => s.id);
if (matchedIds.includes('central_ignwps')) {
  console.log(" PASS: Kamla Devi correctly qualified for Widow Pension (central_ignwps)");
} else {
  console.error(" FAIL: Expected Widow Pension for Kamla Devi, got:", matchedIds);
  process.exit(1);
}

// Test 2: Ananya (WB woman, 35, married) -> WB Annapurna
const ananya = {
  age: 35,
  gender: 'female',
  marital_status: 'married',
  state: 'West Bengal'
};

const resultAnanya = evaluateAllSchemes(ananya);
console.log("\n[Test 2: Ananya Profile]");
const ananyaIds = resultAnanya.matchedVerified.map(s => s.id);
if (ananyaIds.includes('wb_annapurna_yojana')) {
  console.log(" PASS: Ananya correctly qualified for Annapurna Yojana (wb_annapurna_yojana)");
} else {
  console.error(" FAIL: Expected Annapurna Yojana for Ananya, got:", ananyaIds);
  process.exit(1);
}

// Test 3: Unverified scheme
const unverifiedScheme = { id: "unverified_maternity_nutrition", status: "unverified" };
const evalUnv = evaluateSchemeEligibility(unverifiedScheme, kamlaDevi);
if (evalUnv.status === "unverified") {
  console.log(" PASS: unverified_maternity_nutrition correctly marked unverified");
} else {
  console.error(" FAIL: Expected unverified status");
  process.exit(1);
}

console.log("\n ALL ELIGIBILITY TESTS PASSED SUCCESSFULLY!");
