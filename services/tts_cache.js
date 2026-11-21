/**
 * Pre-generated TTS Audio Cache Manager
 * Pre-generates and caches audio in memory & on disk for all fixed strings:
 * - Language Greetings
 * - Standard Dynamic Assistant Questions
 * - Empathetic Error Messages
 * - Safety & Crisis Messages
 * - Subtle Instant Earcon / Acknowledgment Chime
 *
 * Serves from memory with immutable cache headers for zero latency.
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

// In-memory audio buffer cache for ultra-low latency serving
export const MEMORY_AUDIO_CACHE = new Map();

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

export const FIXED_QUESTIONS = [
  { lang: "hi", text: "आपकी बात नोट कर ली गई है। बताइए, आप किस राज्य और जिले में रहते हैं?" },
  { lang: "hi", text: "आपका राज्य नोट कर लिया गया है। कृपया बताइए, आपकी उम्र कितने साल है?" },
  { lang: "hi", text: "आपकी उम्र नोट कर ली गई है। आप महिला हैं या पुरुष?" },
  { lang: "hi", text: "कृपया बताइए, क्या आप शादीशुदा हैं, विधवा हैं, या अकेले रहते हैं?" },
  { lang: "bn", text: "আপনার কথা বুঝতে পেরেছি। বলুন, আপনি কোন রাজ্যে এবং জেলায় থাকেন?" },
  { lang: "bn", text: "আপনার রাজ্য নোট করা হয়েছে। অনুগ্রহ করে বলুন, আপনার বয়স কত বছর?" },
  { lang: "bn", text: "আপনার বয়স নোট করেছি। আপনি মহিলা নাকি পুরুষ?" },
  { lang: "bn", text: "অনুগ্রহ করে বলুন, আপনি বিবাহিত, বিধবা, নাকি একা থাকেন?" }
];

export const SAFETY_MESSAGES = [
  { lang: "hi", text: "घबराइए मत, आप सुरक्षित जगह पर जाएं और तुरंत 112 या महिला हेल्पलाइन 181 पर कॉल करें।" },
  { lang: "hi", text: "यह तुम्हारी गलती नहीं है, किसी भरोसेमंद बड़े को बताओ और 1098 पर फोन करो।" },
  { lang: "bn", text: "ভয় পাবেন না, নিরাপদ স্থানে থাকুন এবং অবিলম্বে ১১২ অথবা ১৮১ নম্বরে কল করুন। স্ক্রিনে যোগাযোগের নম্বর দেওয়া হয়েছে।" },
  { lang: "bn", text: "এটা তোমার দোষ নয়। কোনো বিশ্বাসযোগ্য বড় মানুষকে বলো এবং ১০৯৮ নম্বরে ফোন করো।" }
];

export function generateEarconWav() {
  const sampleRate = 16000;
  const durationSec = 0.25;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 12);
    const val = 0.3 * Math.sin(2 * Math.PI * 523.25 * t) + 0.3 * Math.sin(2 * Math.PI * 659.25 * t);
    const sample = Math.max(-1, Math.min(1, val * env));
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

export function getCacheKey(text, lang) {
  return crypto.createHash('sha256').update(`${lang}:${text}`).digest('hex').slice(0, 24);
}

export async function getOrSynthesizeCachedAudio(text, lang = "hi") {
  if (!text) return null;
  const key = getCacheKey(text, lang);
  const filePath = path.join(CACHE_DIR, `${key}.wav`);

  // 1. Check in-memory cache
  if (MEMORY_AUDIO_CACHE.has(key)) {
    return {
      filePath,
      buffer: MEMORY_AUDIO_CACHE.get(key),
      url: `/api/tts/cached/${key}.wav`,
      hit: true
    };
  }

  // 2. Check disk cache
  if (fs.existsSync(filePath)) {
    try {
      const buf = fs.readFileSync(filePath);
      MEMORY_AUDIO_CACHE.set(key, buf);
      return {
        filePath,
        buffer: buf,
        url: `/api/tts/cached/${key}.wav`,
        hit: true
      };
    } catch (e) {}
  }

  // 3. Synthesize via Sarvam TTS
  try {
    const tts = await textToSpeech(text, lang, "aarti_hi_customer");
    if (tts && tts.audio_base64) {
      const audioBuffer = Buffer.from(tts.audio_base64, 'base64');
      fs.writeFileSync(filePath, audioBuffer);
      MEMORY_AUDIO_CACHE.set(key, audioBuffer);
      return {
        filePath,
        buffer: audioBuffer,
        url: `/api/tts/cached/${key}.wav`,
        hit: false
      };
    }
  } catch (err) {
    console.error(`[TTS Cache Synthesis Error] ${err.message}`);
  }

  return null;
}

export async function prewarmTtsCache() {
  console.log("⚡ [TTS Cache] Pre-warming fixed string audio cache into memory...");

  // 1. Earcon chime
  const earconPath = path.join(CACHE_DIR, 'earcon_ack.wav');
  const earconBuf = generateEarconWav();
  fs.writeFileSync(earconPath, earconBuf);
  MEMORY_AUDIO_CACHE.set('earcon_ack', earconBuf);

  // 2. Greetings
  const languages = ['hi', 'bhojpuri', 'bn', 'maithili', 'en'];
  for (const lang of languages) {
    const greeting = GREETINGS[lang];
    if (greeting && process.env.SARVAM_API_KEY) {
      try {
        await getOrSynthesizeCachedAudio(greeting.text, lang);
      } catch (e) {}
    }
  }

  // 3. Standard Questions
  for (const q of FIXED_QUESTIONS) {
    if (process.env.SARVAM_API_KEY) {
      try {
        await getOrSynthesizeCachedAudio(q.text, q.lang);
      } catch (e) {}
    }
  }

  // 4. Safety Messages
  for (const s of SAFETY_MESSAGES) {
    if (process.env.SARVAM_API_KEY) {
      try {
        await getOrSynthesizeCachedAudio(s.text, s.lang);
      } catch (e) {}
    }
  }

  // 5. Error messages
  for (const [code, entry] of Object.entries(ERROR_MESSAGES)) {
    for (const lang of languages) {
      const msg = entry[lang]?.spoken;
      if (msg && process.env.SARVAM_API_KEY) {
        try {
          await getOrSynthesizeCachedAudio(msg, lang);
        } catch (e) {}
      }
    }
  }

  console.log(`✓ [TTS Cache] Pre-warming complete. (${MEMORY_AUDIO_CACHE.size} audio clips ready in memory)`);
}

export { CACHE_DIR };
