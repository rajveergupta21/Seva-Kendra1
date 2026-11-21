/**
 * Unit Test for Deterministic Eligibility Engine
 */

import { matchSchemes } from '../engine/eligibility.js';

console.log("=== Testing Deterministic Eligibility Engine ===");

// Persona 1: Kamla Devi (Widow, 49, landless, rural laborer, UP, income 45000)
const kamlaDevi = {
  age: 49,
  gender: 'female',
  marital_status: 'widow',
  landholding_acres: 0.0,
  annual_income_inr: 45000,
  is_tax_payer: false,
  has_minor_daughter: false,
  kutcha_house_or_homeless: true,
  state: 'Uttar Pradesh',
  district: 'Chandauli'
};

const resultKamla = matchSchemes(kamlaDevi);
console.log("\n[Test 1: Kamla Devi Profile]");
console.log("Matched Schemes Count:", resultKamla.matchedCount);
resultKamla.topSchemes.forEach(s => console.log(` - ${s.title_hi} (${s.id}): ₹${s.monthly_benefit_inr}/mo, annual ₹${s.annual_benefit_inr}`));
console.log("Primary Documents:", resultKamla.primaryDocuments);
console.log("Primary Office:", resultKamla.primaryOffice);

// Verify Kamla Devi matched Widow Pension and PM Awas
const matchedIds = resultKamla.topSchemes.map(s => s.id);
if (matchedIds.includes('IGNWPS_WIDOW')) {
  console.log(" PASS: Kamla Devi correctly qualified for Widow Pension (IGNWPS_WIDOW)");
} else {
  console.error(" FAIL: Expected Widow Pension for Kamla Devi");
  process.exit(1);
}

// Persona 2: Ramesh (Small Farmer, 42, married, 2.5 acres land, income 75000)
const rameshFarmer = {
  age: 42,
  gender: 'male',
  marital_status: 'married',
  landholding_acres: 2.5,
  annual_income_inr: 75000,
  is_tax_payer: false,
  state: 'Bihar',
  district: 'Samastipur'
};

const resultRamesh = matchSchemes(rameshFarmer);
console.log("\n[Test 2: Ramesh Small Farmer Profile]");
console.log("Matched Schemes Count:", resultRamesh.matchedCount);
resultRamesh.topSchemes.forEach(s => console.log(` - ${s.title_hi} (${s.id})`));

const rameshIds = resultRamesh.topSchemes.map(s => s.id);
if (rameshIds.includes('PM_KISAN')) {
  console.log(" PASS: Ramesh correctly qualified for PM-Kisan (PM_KISAN)");
} else {
  console.error(" FAIL: Expected PM-Kisan for Ramesh");
  process.exit(1);
}

console.log("\n ALL TESTS PASSED SUCCESSFULLY!");
