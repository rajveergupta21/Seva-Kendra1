/**
 * Sarvam AI Official SDK Service Integration
 * Uses the official 'sarvamai@1.1.21' npm package.
 * Text-to-Speech: bulbul:v4-flash (speaker: aarti_hi_customer, 24kHz)
 * Speech-to-Text: saaras:v3 (REST & WebSocket Streaming)
 */

import { SarvamAIClient } from 'sarvamai';
import './env_loader.js';

if (!process.env.SARVAM_API_KEY) {
  console.error("FATAL: SARVAM_API_KEY environment variable is missing. Set it in .env or environment.");
  process.exit(1);
}

let cachedClient = null;

/**
 * Validates and retrieves the singleton SarvamAIClient instance.
 * Fails fast if SARVAM_API_KEY is missing. Never prints key to logs.
 */
export function getSarvamClient(customKey) {
  const apiKey = customKey || process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.error("FATAL: SARVAM_API_KEY environment variable is missing.");
    process.exit(1);
  }

  if (!cachedClient || (customKey && cachedClient._options?.apiSubscriptionKey !== customKey)) {
    cachedClient = new SarvamAIClient({
      apiSubscriptionKey: apiKey
    });
  }
  return cachedClient;
}

/**
 * Maps incoming dialect/language strings to official Sarvam BCP-47 language_code for STT
 * Exact SDK options: 'hi-IN', 'bn-IN', 'en-IN', 'mai-IN', 'unknown'
 */
export function getSttLanguageCode(lang = "hi") {
  if (!lang) return "unknown";
  const lower = String(lang).toLowerCase().trim();

  if (lower === "bn" || lower === "bn-in" || lower.includes("bengali") || lower.includes("bangla")) {
    return "bn-IN";
  }
  if (lower === "en" || lower === "en-in" || lower.includes("english")) {
    return "en-IN";
  }
  if (lower === "mai" || lower === "mai-in" || lower.includes("maithili")) {
    return "mai-IN";
  }
  if (lower === "hi" || lower === "hi-in" || lower.includes("hindi")) {
    return "hi-IN";
  }
  if (lower.includes("bhojpuri")) {
    // Sarvam STT supports Hindi dialect model for Bhojpuri, or 'unknown' for auto-detect
    return "hi-IN";
  }
  if (lower === "unknown") {
    return "unknown";
  }

  // Uncertain language -> auto-detect
  return "unknown";
}

/**
 * Maps language to Sarvam TTS target_language_code
 */
export function getTtsLanguageCode(lang = "hi") {
  if (!lang) return "hi-IN";
  const lower = String(lang).toLowerCase().trim();
  if (lower === "bn" || lower === "bn-in" || lower.includes("bengali")) return "bn-IN";
  if (lower === "en" || lower === "en-in" || lower.includes("english")) return "en-IN";
  // Hindi, Bhojpuri, Maithili are synthesized via hi-IN speaker
  return "hi-IN";
}

/**
 * Splits text into natural spoken sentences for streaming TTS
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  // Match Indic Danda (।), period, question mark, exclamation, or newline
  const rawParts = text.split(/(?<=[।\.\?!;:\n])\s+/);
  const sentences = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      // Keep individual sentences under 450 chars for Bulbul v4 limit
      if (trimmed.length > 450) {
        const sub = trimmed.match(/.{1,400}(?:\s+|$)/g) || [trimmed];
        sentences.push(...sub.map(s => s.trim()).filter(Boolean));
      } else {
        sentences.push(trimmed);
      }
    }
  }
  return sentences.length > 0 ? sentences : [text.trim()];
}

/**
 * REST Text-to-Speech using Sarvam AI Bulbul v4-flash
 */
export async function textToSpeech(text, arg2 = "hi", arg3 = "aarti_hi_customer", arg4 = undefined) {
  let language = "hi";
  let speaker = "aarti_hi_customer";
  let apiKey = process.env.SARVAM_API_KEY;

  if (typeof arg2 === 'string' && (arg2.startsWith('sk_') || arg2.length > 30)) {
    apiKey = arg2;
  } else if (typeof arg3 === 'string' && (arg3.startsWith('sk_') || arg3.length > 30)) {
    apiKey = arg3;
    language = arg2 || "hi";
  } else {
    if (arg2) language = arg2;
    if (arg3 && !arg3.startsWith('sk_')) speaker = arg3;
    if (arg4) apiKey = arg4;
  }

  if (speaker === "kavya" || !speaker) {
    speaker = "aarti_hi_customer";
  }

  try {
    const client = getSarvamClient(apiKey);
    let cleanText = (text || "").trim();

    if (cleanText.length > 480) {
      const cut = cleanText.slice(0, 480);
      const lastPunct = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
      cleanText = lastPunct > 150 ? cut.slice(0, lastPunct + 1) : cut.slice(0, 475) + "...";
    }

    const targetLangCode = getTtsLanguageCode(language);

    const res = await client.textToSpeech.convert({
      text: cleanText,
      target_language_code: targetLangCode,
      speaker: speaker || "aarti_hi_customer",
      model: "bulbul:v4-flash",
      pace: 1,
      speech_sample_rate: 24000
    });

    const audioBase64 = res.audios && res.audios[0] ? res.audios[0] : null;

    return {
      audio_base64: audioBase64,
      is_fallback: false,
      text: cleanText,
      language_code: targetLangCode,
      model: "bulbul:v4-flash"
    };
  } catch (error) {
    console.error("[Sarvam SDK TTS Error]", error.statusCode || error.message);
    return {
      audio_base64: null,
      error: error.message,
      is_fallback: true,
      text
    };
  }
}

/**
 * Streaming TTS: Returns a BinaryResponse stream using client.textToSpeech.convertStream
 */
export async function convertSpeechStream(text, language = "hi", speaker = "aarti_hi_customer", apiKey = process.env.SARVAM_API_KEY) {
  const client = getSarvamClient(apiKey);
  const targetLangCode = getTtsLanguageCode(language);

  return await client.textToSpeech.convertStream({
    text: text,
    target_language_code: targetLangCode,
    speaker: speaker || "aarti_hi_customer",
    model: "bulbul:v4-flash",
    pace: 1,
    speech_sample_rate: 24000
  });
}

/**
 * REST Speech-to-Text using Sarvam AI Saaras v3
 * NOTE: The SDK field is `language_code` (NOT `languageCode`).
 */
export async function speechToText(audioBuffer, mimeType = "audio/wav", apiKey = process.env.SARVAM_API_KEY, language_code = "hi-IN") {
  try {
    const client = getSarvamClient(apiKey);
    const targetLangCode = getSttLanguageCode(language_code);
    const blob = new Blob([audioBuffer], { type: mimeType });

    // EXACT SDK FIELD: language_code
    const res = await client.speechToText.transcribe({
      file: blob,
      model: "saaras:v3",
      language_code: targetLangCode
    });

    return {
      transcript: res.transcript ? res.transcript.trim() : "",
      language_code: res.language_code || targetLangCode,
      is_fallback: false,
      raw: res
    };
  } catch (error) {
    const httpStatus = error.statusCode || error.status || 500;
    console.error(`[Sarvam SDK STT Error] HTTP ${httpStatus}: ${error.message}`);
    return {
      transcript: "",
      error: error.message,
      statusCode: httpStatus,
      is_fallback: true
    };
  }
}

/**
 * Realtime Streaming Speech-to-Text Session over Sarvam WebSocket
 */
export async function createSttStreamingSession({
  languageCode = "hi-IN",
  apiKey = process.env.SARVAM_API_KEY,
  onPartial = () => {},
  onFinal = () => {},
  onError = () => {}
}) {
  const client = getSarvamClient(apiKey);
  const targetLangCode = getSttLanguageCode(languageCode);

  try {
    const socket = await client.speechToTextStreaming.connect({
      "language-code": targetLangCode,
      model: "saaras:v3",
      input_audio_codec: "wav",
      sample_rate: "16000"
    });

    await socket.waitForOpen();

    let fullTranscript = "";

    socket.on("message", (msg) => {
      if (msg.type === "data" && msg.data) {
        const text = (msg.data.transcript || "").trim();
        if (text) {
          fullTranscript = text;
          onPartial(text);
        }
      } else if (msg.type === "error") {
        console.error("[Sarvam Streaming STT Socket Error Message]", msg.data);
        onError(new Error(msg.data?.message || "Streaming STT error"));
      }
    });

    socket.on("error", (err) => {
      console.error("[Sarvam Streaming STT Socket Error]", err.message);
      onError(err);
    });

    return {
      sendAudioPcmChunk(pcmBase64) {
        if (socket.readyState === 1) { // OPEN
          socket.transcribe({
            audio: pcmBase64,
            sample_rate: 16000,
            encoding: "audio/wav"
          });
        }
      },
      flush() {
        if (socket.readyState === 1) {
          socket.flush();
        }
      },
      close() {
        try {
          socket.close();
        } catch (e) {}
      },
      getTranscript() {
        return fullTranscript;
      }
    };
  } catch (err) {
    console.error("[Sarvam Streaming STT Connection Error]", err.message);
    throw err;
  }
}


