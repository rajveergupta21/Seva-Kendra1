/**
 * Native LLM Adapter for Seva Kendra / JanKalyan Voice Gateway
 * Powered by Google AI Studio (Gemini REST API) with optional Groq and Sarvam fallbacks.
 * Uses native Node.js fetch() with zero external dependencies.
 */

import './env_loader.js';

/**
 * Cleanly extracts and parses JSON from LLM text output
 */
export function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let text = String(rawText).trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    // Attempt to locate first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        console.error("[LLM extractJsonFromText] Failed inner parse:", innerErr.message);
      }
    }
    console.error("[LLM extractJsonFromText] Failed to parse JSON:", text.slice(0, 100));
    return null;
  }
}

/**
 * Calls Google AI Studio native REST API
 * CRITICAL: Uses x-goog-api-key header and native Gemini format
 */
async function callGemini({ apiKey, model, systemPrompt, messages, jsonMode, temperature }) {
  let targetModel = model || process.env.LLM_MODEL || "gemini-2.5-flash";

  // Build Gemini contents array
  const contents = [];
  for (const m of messages) {
    const role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
    contents.push({
      role,
      parts: [{ text: m.content || m.text || '' }]
    });
  }

  // Ensure at least one user content part
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: typeof temperature === 'number' ? temperature : (jsonMode ? 0.1 : 0.3),
      responseMimeType: jsonMode ? 'application/json' : 'text/plain'
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    payload.system_instruction = {
      parts: [{ text: systemPrompt.trim() }]
    };
  }

  // Helper to make request to a specific model
  async function executeRequest(modelName) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini API Error] HTTP ${res.status} on model ${modelName}:`, errText);
      const err = new Error(`Gemini API Error ${res.status}: ${errText}`);
      err.status = res.status;
      err.errText = errText;
      throw err;
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return rawText;
  }

  try {
    const rawText = await executeRequest(targetModel);
    if (jsonMode) {
      return extractJsonFromText(rawText);
    }
    return rawText;
  } catch (err) {
    // If the configured model is sunset/unavailable (404), seamlessly fallback to available flash model
    if (err.status === 404 && (targetModel.includes('2.5') || targetModel.includes('flash'))) {
      const fallbackModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];
      for (const fallback of fallbackModels) {
        if (fallback === targetModel) continue;
        try {
          console.warn(`[Gemini Adapter] Model ${targetModel} unavailable (404), falling back to ${fallback}`);
          const rawText = await executeRequest(fallback);
          if (jsonMode) return extractJsonFromText(rawText);
          return rawText;
        } catch (subErr) {
          console.warn(`[Gemini Adapter] Fallback ${fallback} failed: ${subErr.message}`);
        }
      }
    }
    throw err;
  }
}

/**
 * Calls Groq API (OpenAI-compatible)
 */
async function callGroq({ apiKey, model, systemPrompt, messages, jsonMode, temperature }) {
  const targetModel = model || "llama-3.3-70b-versatile";
  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    formattedMessages.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content || m.text || ''
    });
  }

  const payload = {
    model: targetModel,
    messages: formattedMessages,
    temperature: typeof temperature === 'number' ? temperature : 0.2
  };
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Groq API Error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '';
  return jsonMode ? extractJsonFromText(rawText) : rawText;
}

/**
 * Calls Sarvam Chat API
 */
async function callSarvamChat({ apiKey, systemPrompt, messages, jsonMode, temperature }) {
  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    formattedMessages.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content || m.text || ''
    });
  }

  const res = await fetch('https://api.sarvam.ai/v2/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey
    },
    body: JSON.stringify({
      model: 'sarvam-m',
      messages: formattedMessages,
      temperature: typeof temperature === 'number' ? temperature : 0.2
    })
  });

  if (!res.ok) {
    throw new Error(`Sarvam Chat API Error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '';
  return jsonMode ? extractJsonFromText(rawText) : rawText;
}

/**
 * Primary Unified Entrypoint for LLM calls
 */
export async function callLlm({ systemPrompt = "", messages = [], jsonMode = false, temperature = 0.2 }) {
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();
  const apiKey = process.env.LLM_API_KEY || (provider === "sarvam" ? process.env.SARVAM_API_KEY : null);
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error(`FATAL: LLM API Key is missing for provider '${provider}'. Please set LLM_API_KEY in .env.`);
  }

  if (provider === 'gemini') {
    return await callGemini({ apiKey, model, systemPrompt, messages, jsonMode, temperature });
  } else if (provider === 'groq') {
    return await callGroq({ apiKey, model, systemPrompt, messages, jsonMode, temperature });
  } else if (provider === 'sarvam') {
    return await callSarvamChat({ apiKey, systemPrompt, messages, jsonMode, temperature });
  } else {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
}
