/**
 * Unit Test: Proving `language_code` SDK Field & Multi-Language Mapping
 * Validates:
 * 1. Sarvam SDK accepts `language_code` (and NOT `languageCode`)
 * 2. Hindi maps to `hi-IN`
 * 3. Bengali maps to `bn-IN`
 * 4. English maps to `en-IN`
 * 5. Maithili maps to `mai-IN`
 * 6. Uncertain/Unrecognized maps to `unknown` for auto-detect
 * 7. Mock intercept proves exact argument structure passed to SDK client
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSttLanguageCode, speechToText } from '../services/sarvam.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=======================================================");
console.log(" UNIT TEST 1: Sarvam STT language_code & SDK Conformance");
console.log("=======================================================");

// 1. Static Verification of Sarvam AI SDK TypeScript Types
const dtsPath = path.join(__dirname, '..', 'node_modules', 'sarvamai', 'dist', 'esm', 'api', 'resources', 'speechToText', 'client', 'requests', 'SpeechToTextTranscriptionRequest.d.mts');
assert(fs.existsSync(dtsPath), `SDK type declaration file must exist at ${dtsPath}`);
const dtsContent = fs.readFileSync(dtsPath, 'utf8');

assert(dtsContent.includes('language_code?:'), "SDK declaration must contain 'language_code?:' field");
assert(!dtsContent.includes('languageCode?:'), "SDK declaration must NOT contain 'languageCode?:' field");
assert(dtsContent.includes('mai-IN'), "SDK must support Maithili ('mai-IN')");
assert(dtsContent.includes('unknown'), "SDK must support 'unknown' for auto-detect");
console.log("✓ PASS: Verified SDK typing in node_modules/sarvamai explicitly specifies `language_code?:`");

// 2. Test getSttLanguageCode mapping
assert.strictEqual(getSttLanguageCode('hi'), 'hi-IN');
assert.strictEqual(getSttLanguageCode('hi-IN'), 'hi-IN');
assert.strictEqual(getSttLanguageCode('hindi'), 'hi-IN');
assert.strictEqual(getSttLanguageCode('bhojpuri'), 'hi-IN');
console.log("✓ PASS: Hindi & Bhojpuri map to 'hi-IN'");

assert.strictEqual(getSttLanguageCode('bn'), 'bn-IN');
assert.strictEqual(getSttLanguageCode('bn-IN'), 'bn-IN');
assert.strictEqual(getSttLanguageCode('bengali'), 'bn-IN');
console.log("✓ PASS: Bengali maps to 'bn-IN'");

assert.strictEqual(getSttLanguageCode('en'), 'en-IN');
assert.strictEqual(getSttLanguageCode('en-IN'), 'en-IN');
assert.strictEqual(getSttLanguageCode('english'), 'en-IN');
console.log("✓ PASS: English maps to 'en-IN'");

assert.strictEqual(getSttLanguageCode('maithili'), 'mai-IN');
assert.strictEqual(getSttLanguageCode('mai'), 'mai-IN');
assert.strictEqual(getSttLanguageCode('mai-IN'), 'mai-IN');
console.log("✓ PASS: Maithili maps to 'mai-IN'");

assert.strictEqual(getSttLanguageCode(''), 'unknown');
assert.strictEqual(getSttLanguageCode(null), 'unknown');
assert.strictEqual(getSttLanguageCode('unknown'), 'unknown');
assert.strictEqual(getSttLanguageCode('xyz-dialect'), 'unknown');
console.log("✓ PASS: Uncertain language maps to 'unknown' (Sarvam auto-detect)");

// 3. Spying on speechToText to verify SDK invocation parameters
async function testSdkInvocationParameters() {
  const dummyPcmWav = Buffer.alloc(1000);

  // We test using an intercepted call or live call
  let capturedArgs = null;
  const originalEnvKey = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = process.env.SARVAM_API_KEY || "mock_key";

  // Import sarvam client to inspect
  const { getSarvamClient } = await import('../services/sarvam.js');
  const client = getSarvamClient();
  const originalTranscribe = client.speechToText.transcribe;

  client.speechToText.transcribe = async function (req) {
    capturedArgs = req;
    return { transcript: "नमस्ते", language_code: req.language_code };
  };

  try {
    // Test Hindi
    await speechToText(dummyPcmWav, 'audio/wav', undefined, 'hi');
    assert(capturedArgs !== null, "transcribe must be invoked");
    assert.strictEqual(capturedArgs.language_code, 'hi-IN');
    assert.strictEqual(capturedArgs.languageCode, undefined, "Must NOT pass languageCode");
    console.log("✓ PASS: speechToText passed `{ language_code: 'hi-IN' }` to SDK client");

    // Test Maithili
    await speechToText(dummyPcmWav, 'audio/wav', undefined, 'maithili');
    assert.strictEqual(capturedArgs.language_code, 'mai-IN');
    assert.strictEqual(capturedArgs.languageCode, undefined);
    console.log("✓ PASS: speechToText passed `{ language_code: 'mai-IN' }` to SDK client");

    // Test Auto-detect for uncertain language
    await speechToText(dummyPcmWav, 'audio/wav', undefined, 'unknown');
    assert.strictEqual(capturedArgs.language_code, 'unknown');
    console.log("✓ PASS: speechToText passed `{ language_code: 'unknown' }` for auto-detect");
  } finally {
    client.speechToText.transcribe = originalTranscribe;
    process.env.SARVAM_API_KEY = originalEnvKey;
  }
}

await testSdkInvocationParameters();

console.log("\n=======================================================");
console.log(" ALL LANGUAGE_CODE UNIT TESTS PASSED (7/7)");
console.log("=======================================================\n");
