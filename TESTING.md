# Seva Kendra (सेवा केंद्र) — Mobile Device Testing Guide

This guide details testing procedures for real mobile devices (**Android Chrome** and **iPhone Safari**) for low-latency, hands-free conversational operation.

---

## 1. Quick Setup for Real Device Testing

### Option A: Local WiFi LAN IP (Fastest)
1. Ensure your phone and development computer are on the same Wi-Fi network.
2. Find your computer's local IP address (e.g. `192.168.1.15`):
   ```bash
   ipconfig getifaddr en0
   ```
3. Open on mobile Chrome or Safari:
   ```
   http://192.168.1.15:3000
   ```
   *(Note: For Web Audio worklets and mic access over HTTP on non-localhost, enable Chrome flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with `http://192.168.1.15:3000`, or use ngrok below).*

### Option B: HTTPS Tunnel with ngrok / Cloudflare Tunnel (Recommended for iPhone Safari)
iOS Safari requires HTTPS for `getUserMedia` outside of `localhost`.
```bash
npx ngrok http 3000
```
Open the generated `https://xxxx.ngrok-free.app` on your phone.

---

## 2. Audio Architecture Key Behaviors

1. **Autoplay & AudioContext Unlock**:
   - iOS Safari and Android Chrome block unprompted audio autoplay.
   - On the very first tap anywhere on the screen or language selection modal, `audioCtx.resume()` and a silent microscopic buffer are played on the persistent `<audio id="masterAudio">` element. All subsequent assistant replies play through this unlocked output without user clicks.
2. **AudioWorklet 16kHz PCM Stream**:
   - Audio is resampled in the background AudioWorklet thread from device native sample rates (44.1kHz or 48kHz) down to 16kHz mono.
3. **Hands-Free Conversation Mode**:
   - Tap the microphone once. When the assistant finishes speaking a question or result, listening resumes automatically.
4. **Instant Earcon**:
   - When the user stops speaking (detected by VAD), a gentle chime sounds in <50ms to acknowledge receipt while speech synthesis prepares the reply.
5. **Real-time Latency Debug Overlay**:
   - Add `?debug=1` to the URL: `http://localhost:3000?debug=1`.
   - Displays real-time breakdown: STT duration, NLU execution, TTS first-byte TTFB, and end-to-end latency.

---

## 3. Mobile Verification Checklist

Test each of the following real-world edge cases:

| Test Case | Scenario / Steps | Expected Behavior | Android Chrome | iPhone Safari |
|---|---|---|---|---|
| **1. Permission Denied** | Tap mic button and press **"Block" / "Don't Allow"** on browser permission prompt. | Distinct error code `MIC_PERMISSION_DENIED` is displayed: *"माइक की अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में जाकर माइक की अनुमति दें।"* System does **not** crash or falsely accuse the user of speaking unclearly. | [ ] PASS | [ ] PASS |
| **2. Airplane Mode / Offline** | Turn on **Airplane Mode** (disable WiFi and cellular data) and tap mic. | Instant error `NETWORK_OFFLINE`: *"इंटरनेट कनेक्शन बंद है। कृपया अपना मोबाइल डेटा या वाई-फाई चेक करें।"* | [ ] PASS | [ ] PASS |
| **3. Noisy Room / Ambient Noise** | Test in a room with background TV, fan noise, or conversation. | VAD energy gate (`VAD_SPEECH_RMS_THRESHOLD = 0.012`) ignores constant low-amplitude fan hum. Only spoken voice triggers speech state. | [ ] PASS | [ ] PASS |
| **4. Long Pause / Silence** | Tap mic button and stay completely silent for 5 seconds. | Real-time silence tracker detects RMS < 0.005. Displays `MIC_SILENT`: *"माइक से कोई आवाज़ नहीं आई। कृपया माइक के पास आकर थोड़ा तेज़ बोलें।"* | [ ] PASS | [ ] PASS |
| **5. Very Short "हाँ" / "ना"** | Tap mic and say a crisp, single syllable: *"हाँ"* (Yes) or *"ना"* (No). | 16kHz PCM capture buffers and transcribes the single syllable cleanly without truncating the leading or trailing phoneme. | [ ] PASS | [ ] PASS |
| **6. Talking Over the Assistant (Barge-In)** | While the assistant is actively playing a spoken reply, start speaking loudly into the phone mic. | Assistant playback cuts off immediately (`stopAllAudio()`) and switching to capture citizen speech. | [ ] PASS | [ ] PASS |
| **7. Screen Lock / Background Recovery** | Lock phone screen for 10 seconds, unlock, and speak. | AudioContext cleanly recovers; WebSocket reconnects on demand. | [ ] PASS | [ ] PASS |

---

## 4. Telemetry Verification

Check the live server latency summary at:
```bash
curl http://localhost:3000/api/metrics
```
Expected response schema:
```json
{
  "status": "nominal",
  "count": 10,
  "targets": {
    "p50_target_ms": 1500,
    "p95_target_ms": 3000,
    "meets_p50": true,
    "meets_p95": true
  },
  "e2e_first_audio": {
    "p50": 620,
    "p90": 1150,
    "p95": 1420
  }
}
```
