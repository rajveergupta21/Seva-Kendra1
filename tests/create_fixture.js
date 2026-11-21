/**
 * Generates Hindi speech WAV fixture for Playwright fake mic testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { textToSpeech } from '../services/sarvam.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

const wavPath = path.join(FIXTURES_DIR, 'hindi_speech.wav');

async function createFixture() {
  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
    console.log("✓ Fixture already exists at:", wavPath);
    return wavPath;
  }

  console.log("Synthesizing Hindi speech for Playwright fake mic fixture...");
  const tts = await textToSpeech("हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है", "hi", "aarti_hi_customer");
  if (tts && tts.audio_base64) {
    fs.writeFileSync(wavPath, Buffer.from(tts.audio_base64, 'base64'));
    console.log("✓ Fixture created successfully:", wavPath, `(${fs.statSync(wavPath).size} bytes)`);
  } else {
    // Synthetic fallback tone WAV if network unavailable
    const sampleRate = 16000;
    const numSamples = sampleRate * 3;
    const buf = Buffer.alloc(44 + numSamples * 2);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + numSamples * 2, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(numSamples * 2, 40);
    for (let i = 0; i < numSamples; i++) {
      const val = Math.sin(2 * Math.PI * 300 * (i / sampleRate));
      buf.writeInt16LE(Math.floor(val * 16000), 44 + i * 2);
    }
    fs.writeFileSync(wavPath, buf);
    console.log("✓ Fallback audio fixture created:", wavPath);
  }
  return wavPath;
}

createFixture().catch(console.error);
