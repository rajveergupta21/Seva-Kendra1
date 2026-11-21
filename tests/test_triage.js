import { diagnoseStoppage } from '../engine/triage.js';

console.log("=== Testing Entitlement Stoppage & Pension Recovery Engine ===");

// Test 1: Parvati Devi (Bhojpuri Widow Pension Stoppage - Dormant Account)
const t1 = diagnoseStoppage("हमार पेंशन तीन महीना से ना आवता", "7193", "bhojpuri");
console.log("\n[Test 1: Parvati Devi - Bank Dormancy Error 504]");
console.log("Token:", t1.ticket_token);
console.log("Beneficiary:", t1.beneficiary.name);
console.log("Error Code:", t1.diagnosis.error_code);
console.log("Action Required:", t1.diagnosis.action_required);
if (t1.diagnosis.error_code === "ERR_504_BANK_DORMANT" && t1.ticket_token.includes("7193")) {
  console.log(" PASS: Parvati Devi correctly diagnosed with ERR_504_BANK_DORMANT");
} else {
  console.error("❌ FAIL on Test 1");
  process.exit(1);
}

// Test 2: Ramu Manjhi (MGNREGA Wage Held - Aadhaar Decoupled)
const t2 = diagnoseStoppage("मनरेगा की मजदूरी बीस दिन से नहीं आई है", "3841", "hindi");
console.log("\n[Test 2: Ramu Manjhi - NPCI Decoupled Error 302]");
console.log("Token:", t2.ticket_token);
console.log("Beneficiary:", t2.beneficiary.name);
console.log("Error Code:", t2.diagnosis.error_code);
if (t2.diagnosis.error_code === "ERR_302_NPCI_MAPPER_DECOUPLED") {
  console.log(" PASS: Ramu Manjhi correctly diagnosed with ERR_302_NPCI_MAPPER_DECOUPLED");
} else {
  console.error("❌ FAIL on Test 2");
  process.exit(1);
}

// Test 3: Sakina Bibi (Bengali NSAP Pension Paused - Life Certificate Expired)
const t3 = diagnoseStoppage("আমার বিধবা ভাতা তিন মাস ধরে বন্ধ আছে", "6205", "bengali");
console.log("\n[Test 3: Sakina Bibi - Life Certificate Expired Error 401]");
console.log("Token:", t3.ticket_token);
console.log("Beneficiary:", t3.beneficiary.name);
console.log("Error Code:", t3.diagnosis.error_code);
if (t3.diagnosis.error_code === "ERR_401_LIFE_CERTIFICATE_EXPIRED") {
  console.log(" PASS: Sakina Bibi correctly diagnosed with ERR_401_LIFE_CERTIFICATE_EXPIRED");
} else {
  console.error("❌ FAIL on Test 3");
  process.exit(1);
}

console.log("\n ALL ENTITLEMENT TRIAGE TESTS PASSED SUCCESSFULLY!\n");
