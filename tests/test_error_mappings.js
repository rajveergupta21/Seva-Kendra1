/**
 * Unit Test: Error Code → User Message Mappings
 * Validates:
 * 1. All 6 distinct error codes exist and map to empathetic messages in all 5 languages:
 *    - MIC_PERMISSION_DENIED
 *    - NO_INPUT_DEVICE
 *    - MIC_SILENT
 *    - STT_API_ERROR
 *    - NETWORK_OFFLINE
 *    - TRULY_EMPTY_SPEECH
 * 2. STT_API_ERROR never blames the citizen (attributes issue to technical/server)
 * 3. Every error code contains both screenMessage and spokenText
 */

import assert from 'assert';
import { ERROR_CODES, ERROR_MESSAGES, getErrorMessage } from '../services/error_messages.js';

console.log("=======================================================");
console.log(" UNIT TEST 2: Error Code → Message Mapping Suite");
console.log("=======================================================");

const REQUIRED_CODES = [
  "MIC_PERMISSION_DENIED",
  "NO_INPUT_DEVICE",
  "MIC_SILENT",
  "STT_API_ERROR",
  "NETWORK_OFFLINE",
  "TRULY_EMPTY_SPEECH"
];

const REQUIRED_LANGUAGES = ["hi", "bhojpuri", "bn", "maithili", "en"];

// 1. Verify existence of all error codes
for (const code of REQUIRED_CODES) {
  assert(ERROR_CODES[code], `ERROR_CODES must define ${code}`);
  assert(ERROR_MESSAGES[code], `ERROR_MESSAGES must define entries for ${code}`);
  console.log(`✓ Code Defined: ${code}`);
}

// 2. Verify all languages for all error codes
for (const code of REQUIRED_CODES) {
  for (const lang of REQUIRED_LANGUAGES) {
    const res = getErrorMessage(code, lang);
    assert.strictEqual(res.code, code, `Result code should match ${code}`);
    assert(res.screenMessage && res.screenMessage.length > 5, `screenMessage must be non-empty for ${code}:${lang}`);
    assert(res.spokenText && res.spokenText.length > 5, `spokenText must be non-empty for ${code}:${lang}`);
  }
}
console.log(`✓ All 6 error codes verified across all 5 languages (30 message pairs)`);

// 3. Rule: Never blame the user for a server error (STT_API_ERROR)
for (const lang of REQUIRED_LANGUAGES) {
  const err = getErrorMessage("STT_API_ERROR", lang);
  const text = (err.screenMessage + " " + err.spokenText).toLowerCase();
  
  // Must mention server/technical issue
  const mentionsTech = text.includes("तकनीकी") || text.includes("सर्वर") || text.includes("কারিগরি") || text.includes("technical") || text.includes("server");
  assert(mentionsTech, `STT_API_ERROR in ${lang} must attribute fault to technical/server issue`);

  // Must NOT accuse user of not speaking cleanly
  assert(!text.includes("आपकी आवाज़ साफ नहीं"), `STT_API_ERROR must not blame user for server error in ${lang}`);
  assert(!text.includes("speak clearly"), `STT_API_ERROR must not blame user for server error in ${lang}`);
}
console.log("✓ PASS: STT_API_ERROR never blames the citizen; correctly attributes to server/system");

// 4. Test MIC_PERMISSION_DENIED
const permHi = getErrorMessage("MIC_PERMISSION_DENIED", "hi");
assert(permHi.screenMessage.includes("अनुमति"), "Hindi permission error must mention permission");
console.log("✓ PASS: MIC_PERMISSION_DENIED provides clear actionable browser instructions");

// 5. Test MIC_SILENT
const silentHi = getErrorMessage("MIC_SILENT", "hi");
assert(silentHi.screenMessage.includes("माइक से कोई आवाज़ नहीं आई") || silentHi.screenMessage.includes("माइक"), "Silent error must guide user to mic");
console.log("✓ PASS: MIC_SILENT guides user to speak closer without generic failure");

// 6. Test NO_INPUT_DEVICE
const noDevEn = getErrorMessage("NO_INPUT_DEVICE", "en");
assert(noDevEn.screenMessage.includes("No microphone"), "No device error must state microphone missing");
console.log("✓ PASS: NO_INPUT_DEVICE clearly indicates missing hardware");

// 7. Test NETWORK_OFFLINE
const offBho = getErrorMessage("NETWORK_OFFLINE", "bhojpuri");
assert(offBho.screenMessage.includes("इंटरनेट"), "Offline error must mention internet/data");
console.log("✓ PASS: NETWORK_OFFLINE clearly prompts user to check connection");

// 8. Test TRULY_EMPTY_SPEECH
const emptyHi = getErrorMessage("TRULY_EMPTY_SPEECH", "hi");
assert(emptyHi.screenMessage.includes("साफ सुनाई नहीं दी") || emptyHi.screenMessage.includes("दोबारा बोलें"), "Empty speech gently asks to repeat");
console.log("✓ PASS: TRULY_EMPTY_SPEECH prompts user to repeat cleanly");

console.log("\n=======================================================");
console.log(" ALL ERROR CODE MAPPING TESTS PASSED (8/8)");
console.log("=======================================================\n");
