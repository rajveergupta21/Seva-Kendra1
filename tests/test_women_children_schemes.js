/**
 * Test Suite for Women & Children Scheme Directory
 */
import assert from 'assert';
import { evaluateAllSchemes } from '../engine/eligibility.js';
import { diagnoseStoppage } from '../engine/triage.js';
import { SAFETY_HELPLINES } from '../services/dynamic_assistant.js';

console.log("=== Testing 11 Women & Children Schemes Directory ===");

// 1. Sukanya Samriddhi Yojana (SSY)
const ssyRes = evaluateAllSchemes({ gender: 'female', age: 7, state: 'West Bengal' });
assert(ssyRes.matchedVerified.some(s => s.id === 'central_ssy'), 'Must match SSY for girl child <= 10');
console.log("✓ PASS: [Scheme 1] Sukanya Samriddhi Yojana (SSY)");

// 2. Anganwadi Services (ICDS) - unverified
const anganwadiRes = evaluateAllSchemes({ has_children: true });
assert(anganwadiRes.unverifiedSchemes.some(s => s.id === 'icds_anganwadi'), 'Must include ICDS as unverified');
console.log("✓ PASS: [Scheme 2] Anganwadi Services (ICDS) — Ask at office");

// 3. Kanyashree Prakalpa (K1 & K2)
const kanyashreeRes = evaluateAllSchemes({ gender: 'female', age: 16, marital_status: 'single', state: 'West Bengal' });
assert(kanyashreeRes.matchedVerified.some(s => s.id === 'wb_kanyashree'), 'Must match Kanyashree');
console.log("✓ PASS: [Scheme 3] Kanyashree Prakalpa (K1 & K2)");

// 4. Rupashree Prakalpa
const rupashreeRes = evaluateAllSchemes({ gender: 'female', age: 21, marital_status: 'single', state: 'West Bengal' });
assert(rupashreeRes.matchedVerified.some(s => s.id === 'wb_rupashree'), 'Must match Rupashree');
console.log("✓ PASS: [Scheme 4] Rupashree Prakalpa");

// 5. PG Indira Gandhi Scholarship
const ugcRes = evaluateAllSchemes({ gender: 'female', age: 23, marital_status: 'single' });
assert(ugcRes.matchedVerified.some(s => s.id === 'central_ugc_single_girl'), 'Must match UGC Single Girl Child');
console.log("✓ PASS: [Scheme 5] PG Indira Gandhi Scholarship for Single Girl Child");

// 6. PMMVY 2.0
const pmmvyRes = evaluateAllSchemes({ gender: 'female', age: 24, pregnant_or_lactating: true });
assert(pmmvyRes.matchedVerified.some(s => s.id === 'central_pmmvy'), 'Must match PMMVY 2.0');
console.log("✓ PASS: [Scheme 6] Pradhan Mantri Matru Vandana Yojana (PMMVY 2.0)");

// 7. Annapurna Yojana (West Bengal)
const annapurnaRes = evaluateAllSchemes({ gender: 'female', age: 34, state: 'West Bengal' });
assert(annapurnaRes.matchedVerified.some(s => s.id === 'wb_annapurna_yojana'), 'Must match Annapurna Yojana');
console.log("✓ PASS: [Scheme 7] Annapurna Yojana (West Bengal)");

// 8. Indira Gandhi National Widow Pension (IGNWPS)
const ignwpsRes = evaluateAllSchemes({ gender: 'female', age: 52, marital_status: 'widow', bpl_or_ration_card: true, state: 'Uttar Pradesh' });
assert(ignwpsRes.matchedVerified.some(s => s.id === 'central_ignwps'), 'Must match IGNWPS');
console.log("✓ PASS: [Scheme 8] Indira Gandhi National Widow Pension Scheme (IGNWPS)");

// 9. West Bengal Widow Pension Scheme
const wbWidowRes = evaluateAllSchemes({ gender: 'female', age: 38, marital_status: 'widow', state: 'West Bengal' });
assert(wbWidowRes.matchedVerified.some(s => s.id === 'wb_widow_pension'), 'Must match WB Widow Pension');
console.log("✓ PASS: [Scheme 9] West Bengal Widow Pension Scheme");

// 10. Indira Gandhi National Old Age Pension (IGNOAPS)
const ignoapsRes = evaluateAllSchemes({ age: 67, bpl_or_ration_card: true, state: 'Bihar' });
assert(ignoapsRes.matchedVerified.some(s => s.id === 'central_ignoaps'), 'Must match IGNOAPS');
console.log("✓ PASS: [Scheme 10] Indira Gandhi National Old Age Pension Scheme (IGNOAPS)");

// 11. West Bengal Old Age Pension Scheme
const wbOldAgeRes = evaluateAllSchemes({ age: 64, state: 'West Bengal' });
assert(wbOldAgeRes.matchedVerified.some(s => s.id === 'wb_old_age_pension'), 'Must match WB Old Age Pension');
console.log("✓ PASS: [Scheme 11] West Bengal Old Age Pension Scheme");

// 12. Safety Helplines
assert.strictEqual(SAFETY_HELPLINES.length, 5, 'Must have 5 emergency helplines');
const numbers = SAFETY_HELPLINES.map(h => h.number);
assert(numbers.includes('112') && numbers.includes('181') && numbers.includes('1098') && numbers.includes('15100') && numbers.includes('14416'));
console.log("✓ PASS: [Section 8] Emergency Helplines (112, 181, 1098, 15100, 14416)");

// 13. Payment-stopped Troubleshooting Checklist
const triage = diagnoseStoppage("pension stopped", {}, "en");
assert.strictEqual(triage.checklist.length, 5, 'Must return 5 diagnostic steps');
console.log("✓ PASS: [Section 9] Payment-Stopped Troubleshooting Checklist (5 items)");

console.log("\n ALL 11 SCHEMES & DIRECTORY SECTIONS VERIFIED 100%!");
