/**
 * Pre-generated TTS Audio Cache Manager
 * Pre-generates and caches audio on disk for all fixed strings:
 * - Language Greetings
 * - Standard Dialog Questions
 * - Empathetic Error Messages
 * - Subtle Instant Earcon / Acknowledgment Chime
 *
 * Serves with immutable cache headers for zero latency.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { textToSpeech } from './sarvam.js';
import { ERROR_CODES, ERROR_MESSAGES } from './error_messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'tts');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export const GREETINGS = {
  hi: {
    text: "नमस्ते, सेवा केंद्र में आपका स्वागत है। बताइए, आप किस योजना के बारे में जानना चाहते हैं, या अपनी उम्र और स्थिति बताइए?",
    hint: '💡 बोलें: "हम 48 साल के हैं, हमारे पति नहीं रहे और कोई जमीन नहीं है"'
  },
  bhojpuri: {
    text: "प्रणाम, सेवा केंद्र में राउर स्वागत बा। बताईं, राउर कवनो योजना के बारे में जाने के बा, या उमिर केतना बा?",
    hint: '💡 बोलीं: "हम 48 साल के बानी, हमार पति नइखन, जमीन नइखे"'
  },
  bn: {
    text: "নমস্কার, সেবা কেন্দ্রে আপনাকে স্বাগত। বলুন, আপনার বয়স কত বা কোন প্রকল্প সম্পর্কে জানতে চান?",
    hint: '💡 বলুন: "আমার বয়স ৪৮ বছর, স্বামী নেই, কোনো জমি নেই"'
  },
  maithili: {
    text: "प्रणाम, सेवा केंद्र में अहाँक स्वागत अछि। कहू, अहाँक उमर कते अछि, आ कोनो योजनाक बारे में जनबाक अछि?",
    hint: '💡 कहू: "हमर उमर 48 साल अछि, पति नहि छथि"'
  },
  en: {
    text: "Welcome to Seva Kendra. Please tell me your age, or which government scheme you would like to know about?",
    hint: '💡 Say: "I am 48 years old, widow, landless"'
  }
};

/**
 * Creates a clean 16kHz WAV earcon chime buffer (instant acknowledgment)
 * Avoids network call and plays in <10ms
 */
export function generateEarconWav() {
  const sampleRate = 16000;
  const durationSec = 0.25; // 250ms gentle chime
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Generate dual sine chord (523.25 Hz - C5, 659.25 Hz - E5) with smooth envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 12); // Exponential decay
    const val = 0.3 * Math.sin(2 * Math.PI * 523.25 * t) + 0.3 * Math.sin(2 * Math.PI * 659.25 * t);
    const sample = Math.max(-1, Math.min(1, val * env));
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

/**
 * Generates cache key for text + language
 */
export function getCacheKey(text, lang) {
  return crypto.createHash('sha256').update(`${lang}:${text}`).digest('hex').slice(0, 24);
}

/**
 * Gets cached audio path or synthesizes and saves to disk
 */
export async function getOrSynthesizeCachedAudio(text, lang = "hi") {
  if (!text) return null;
  const key = getCacheKey(text, lang);
  const filePath = path.join(CACHE_DIR, `${key}.wav`);

  if (fs.existsSync(filePath)) {
    return {
      filePath,
      url: `/api/tts/cached/${key}.wav`,
      hit: true
    };
  }

  // Synthesize via Sarvam TTS
  try {
    const tts = await textToSpeech(text, lang, "aarti_hi_customer");
    if (tts && tts.audio_base64) {
      const audioBuffer = Buffer.from(tts.audio_base64, 'base64');
      fs.writeFileSync(filePath, audioBuffer);
      return {
        filePath,
        url: `/api/tts/cached/${key}.wav`,
        hit: false
      };
    }
  } catch (err) {
    console.error(`[TTS Cache Synthesis Error] ${err.message}`);
  }

  return null;
}

/**
 * Pre-warms the cache at server startup for all fixed strings
 */
export async function prewarmTtsCache() {
  console.log("⚡ [TTS Cache] Pre-warming fixed string audio cache...");

  // 1. Save earcon chime
  const earconPath = path.join(CACHE_DIR, 'earcon_ack.wav');
  if (!fs.existsSync(earconPath)) {
    fs.writeFileSync(earconPath, generateEarconWav());
  }

  // 2. Pre-generate greetings
  const languages = ['hi', 'bhojpuri', 'bn', 'maithili', 'en'];
  for (const lang of languages) {
    const greeting = GREETINGS[lang];
    if (greeting) {
      const key = getCacheKey(greeting.text, lang);
      const target = path.join(CACHE_DIR, `${key}.wav`);
      if (!fs.existsSync(target) && process.env.SARVAM_API_KEY) {
        try {
          await getOrSynthesizeCachedAudio(greeting.text, lang);
          console.log(`✓ [TTS Cache] Pre-cached greeting for ${lang}`);
        } catch (e) {
          console.warn(`⚠️ [TTS Cache] Greeting cache skipped for ${lang}: ${e.message}`);
        }
      }
    }
  }

  // 3. Pre-generate error spoken messages
  for (const [code, entry] of Object.entries(ERROR_MESSAGES)) {
    for (const lang of languages) {
      const msg = entry[lang]?.spoken;
      if (msg) {
        const key = getCacheKey(msg, lang);
        const target = path.join(CACHE_DIR, `${key}.wav`);
        if (!fs.existsSync(target) && process.env.SARVAM_API_KEY) {
          try {
            await getOrSynthesizeCachedAudio(msg, lang);
          } catch (e) {}
        }
      }
    }
  }

  console.log("✓ [TTS Cache] Pre-warming complete.");
}

export { CACHE_DIR };
