/**
 * Turn Latency Metrics & Edge Telemetry Tracker
 * Instruments every turn:
 * - t_speech_end
 * - t_stt_final
 * - t_nlu_done
 * - t_tts_first_byte
 * - t_playback_start
 *
 * Computes p50, p90, p95 latencies and serves /api/metrics.
 */

const MAX_TURNS = 200;
const turnHistory = [];

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function recordTurnMetrics(metrics) {
  const t_speech_end = metrics.t_speech_end || Date.now();
  const t_stt_final = metrics.t_stt_final || t_speech_end;
  const t_nlu_done = metrics.t_nlu_done || t_stt_final;
  const t_tts_first_byte = metrics.t_tts_first_byte || t_nlu_done;
  const t_playback_start = metrics.t_playback_start || null;

  const stt_ms = Math.max(0, t_stt_final - t_speech_end);
  const nlu_ms = Math.max(0, t_nlu_done - t_stt_final);
  const tts_first_byte_ms = Math.max(0, t_tts_first_byte - t_nlu_done);
  const e2e_first_audio_ms = Math.max(0, t_tts_first_byte - t_speech_end);
  const e2e_playback_ms = t_playback_start ? Math.max(0, t_playback_start - t_speech_end) : null;

  const entry = {
    turnId: metrics.turnId || `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    t_speech_end,
    t_stt_final,
    t_nlu_done,
    t_tts_first_byte,
    t_playback_start,
    stt_ms,
    nlu_ms,
    tts_first_byte_ms,
    e2e_first_audio_ms,
    e2e_playback_ms
  };

  turnHistory.push(entry);
  if (turnHistory.length > MAX_TURNS) {
    turnHistory.shift();
  }

  console.log(`⏱️ [Turn Metrics] E2E First Audio: ${e2e_first_audio_ms}ms | STT: ${stt_ms}ms | NLU: ${nlu_ms}ms | TTS 1st Byte: ${tts_first_byte_ms}ms`);
  return entry;
}

export function updatePlaybackStart(turnId, t_playback_start) {
  const entry = turnHistory.find(t => t.turnId === turnId);
  if (entry) {
    entry.t_playback_start = t_playback_start;
    entry.e2e_playback_ms = Math.max(0, t_playback_start - entry.t_speech_end);
  }
}

export function getMetricsSummary() {
  const totalTurns = turnHistory.length;
  if (totalTurns === 0) {
    return {
      status: "nominal",
      count: 0,
      targets: {
        p50_target_ms: 1500,
        p95_target_ms: 3000
      },
      e2e_first_audio: { p50: 0, p90: 0, p95: 0, min: 0, max: 0, avg: 0 },
      stt: { p50: 0, p90: 0, p95: 0, min: 0, max: 0, avg: 0 },
      nlu: { p50: 0, p90: 0, p95: 0, min: 0, max: 0, avg: 0 },
      tts_first_byte: { p50: 0, p90: 0, p95: 0, min: 0, max: 0, avg: 0 },
      recent_turns: []
    };
  }

  const e2eArr = turnHistory.map(t => t.e2e_first_audio_ms);
  const sttArr = turnHistory.map(t => t.stt_ms);
  const nluArr = turnHistory.map(t => t.nlu_ms);
  const ttsArr = turnHistory.map(t => t.tts_first_byte_ms);

  const calcStats = (arr) => ({
    p50: percentile(arr, 50),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  });

  return {
    status: "nominal",
    count: totalTurns,
    targets: {
      p50_target_ms: 1500,
      p95_target_ms: 3000,
      meets_p50: percentile(e2eArr, 50) <= 1500,
      meets_p95: percentile(e2eArr, 95) <= 3000
    },
    e2e_first_audio: calcStats(e2eArr),
    stt: calcStats(sttArr),
    nlu: calcStats(nluArr),
    tts_first_byte: calcStats(ttsArr),
    recent_turns: turnHistory.slice(-10).reverse()
  };
}
