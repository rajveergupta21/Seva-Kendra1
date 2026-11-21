/**
 * AudioWorkletProcessor for Seva Kendra / JanKalyan Voice Gateway
 * Runs off the main UI thread.
 * Downsamples audio from device sampleRate (44.1k/48k) to 16 kHz Mono.
 * Computes RMS for Voice Activity Detection (VAD).
 * Emits 16-bit PCM frames every ~100 ms (1600 samples).
 */

class PcmResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkDurationMs = 100;
    this.targetChunkSize = (this.targetSampleRate * this.chunkDurationMs) / 1000; // 1600 samples

    this.resampleRatio = currentFrame ? sampleRate / this.targetSampleRate : 48000 / 16000;
    this.inputBuffer = [];
    this.accumulated16kSamples = new Float32Array(this.targetChunkSize);
    this.accumulatedCount = 0;

    // Resampling state
    this.resamplePhase = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const inRate = sampleRate; // Global in AudioWorkletGlobalScope
    const ratio = inRate / this.targetSampleRate;

    // 1. Resample block to 16kHz using linear interpolation
    let inIdx = this.resamplePhase;
    while (inIdx < channelData.length) {
      const idxFloor = Math.floor(inIdx);
      const frac = inIdx - idxFloor;
      const s0 = channelData[idxFloor];
      const s1 = idxFloor + 1 < channelData.length ? channelData[idxFloor + 1] : s0;
      const interpolated = s0 + frac * (s1 - s0);

      this.accumulated16kSamples[this.accumulatedCount++] = interpolated;

      // When we hit 1600 samples (100ms)
      if (this.accumulatedCount >= this.targetChunkSize) {
        this.emitPcmChunk();
      }

      inIdx += ratio;
    }

    // Keep residual phase for smooth block boundary
    this.resamplePhase = inIdx - channelData.length;
    return true;
  }

  emitPcmChunk() {
    let sumSq = 0;
    const int16Array = new Int16Array(this.targetChunkSize);

    for (let i = 0; i < this.targetChunkSize; i++) {
      const s = Math.max(-1, Math.min(1, this.accumulated16kSamples[i]));
      sumSq += s * s;
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const rms = Math.sqrt(sumSq / this.targetChunkSize);
    const isSpeech = rms > 0.012; // Speech threshold

    // Send zero-copy transfer of ArrayBuffer to main thread
    this.port.postMessage({
      pcm: int16Array.buffer,
      rms: rms,
      isSpeech: isSpeech,
      sampleRate: this.targetSampleRate
    }, [int16Array.buffer]);

    this.accumulatedCount = 0;
  }
}

registerProcessor('pcm-resampler-processor', PcmResamplerProcessor);
