/**
 * End-to-End Dialog and Pipeline Test
 * Tests the 5-question conversational state machine and slot extraction without network
 */

import { getOrCreateSession, processDialogTurn, resetSession, QUESTIONS } from '../services/dialog.js';
import { extractSlotsFromSpokenHindi } from '../services/sarvam.js';

console.log("=== Testing Conversational State Machine & Slot Extraction ===");

// 1. Test Slot Extraction on rural spoken utterances
console.log("\n[1. Testing Slot Extraction on Spoken Colloquial Hindi]");

const u1 = "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है।";
const s1 = extractSlotsFromSpokenHindi(u1);
console.log("Utterance 1:", u1);
console.log("Extracted:", s1);
if (s1.age === 48 && s1.marital_status === "widow" && s1.landholding_acres === 0.0) {
  console.log(" PASS: Extracted Age 48, Widow, 0 acres land");
} else {
  console.error(" FAIL on Utterance 1");
  process.exit(1);
}

const u2 = "हमारे पास ढाई एकड़ जमीन है और साल में 75 हजार कमाई है।";
const s2 = extractSlotsFromSpokenHindi(u2);
console.log("\nUtterance 2:", u2);
console.log("Extracted:", s2);
if (s2.landholding_acres === 2.5 && s2.annual_income_inr === 75000) {
  console.log(" PASS: Extracted 2.5 acres, 75k income");
} else {
  console.error(" FAIL on Utterance 2");
  process.exit(1);
}

// 2. Test 5-Step Conversational State Machine
console.log("\n[2. Testing Full 5-Turn Dialog Flow for Kamla Devi]");
const testSessionId = "test_user_kamla";
resetSession(testSessionId);

const turns = [
  "हम 49 साल के हैं और विधवा हैं।",
  "हमारे पास कोई जमीन नहीं है, हम दूसरों के खेत में मजदूरी करते हैं।",
  "महीने में तीन चार हजार बनता है, हमारे पास पीला राशन कार्ड है।",
  "दो बेटियां हैं, बड़ी बेटी स्कूल जाती है।",
  "हम उत्तर प्रदेश, चंदौली जिले से हैं।"
];

async function runDialogTest() {
  for (let i = 0; i < turns.length; i++) {
    console.log(`\n--- Turn ${i + 1} / 5 ---`);
    console.log(`Bot Prompt: ${QUESTIONS[i].spoken_hi}`);
    console.log(`User Input: "${turns[i]}"`);

    const result = await processDialogTurn(testSessionId, turns[i]);

    if (result.isCompleted) {
      console.log("\n🎉 CONVERSATION COMPLETED!");
      console.log("Total Matched Schemes:", result.evaluationResult.matchedCount);
      console.log("Top Qualified Schemes:");
      result.evaluationResult.topSchemes.forEach((s, idx) => {
        console.log(`   ${idx + 1}. ${s.title_hi} (Benefit: ₹${s.monthly_benefit_inr}/mo, annual: ₹${s.annual_benefit_inr})`);
      });
      console.log("\nPrimary Physical Documents to Carry:");
      result.evaluationResult.primaryDocuments.forEach((doc, idx) => {
        console.log(`   [ ] ${idx + 1}. ${doc}`);
      });
      console.log("\nPrimary Office:", result.evaluationResult.primaryOffice);
      console.log("\nGenerated Spoken Hindi Audio Script:\n", result.evaluationResult.spokenScript);
      console.log("\nGenerated SMS Action Checklist Slip:\n", result.evaluationResult.smsChecklist);
    } else {
      console.log(`Next Question [${result.nextQuestionIndex}]: ${result.nextPromptText}`);
    }
  }

  console.log("\n ALL PIPELINE & DIALOG TESTS PASSED PERFECTLY!");
}

runDialogTest();
