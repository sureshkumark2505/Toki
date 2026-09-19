/**
 * PCM Audio Player for Gemini Live
 * Plays streaming 24,000 Hz 16-bit Mono PCM audio chunks seamlessly.
 * Supports instantaneous cancellation/interruption on barge-in.
 */

export interface AudioPlayerCallbacks {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onAudioLevel?: (level: number) => void;
}

export class PCMAudioPlayer {
  private audioContext: AudioContext | null = null;
  private scheduledTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private endTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: AudioPlayerCallbacks = {};

  constructor(callbacks: AudioPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: AudioPlayerCallbacks) {
    this.callbacks = callbacks;
  }

  private initAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Queue and play a base64-encoded 24kHz 16-bit Mono PCM chunk
   */
  queueAudioChunk(base64PCM: string): void {
    const ctx = this.initAudioContext();

    // Decode base64 to Int16Array
    const binary = atob(base64PCM);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);

    if (int16Array.length === 0) return;

    // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    if (this.scheduledTime < currentTime) {
      this.scheduledTime = currentTime;
    }

    source.start(this.scheduledTime);
    this.activeSources.push(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.callbacks.onPlaybackStart?.();
    }

    const duration = audioBuffer.duration;
    this.scheduledTime += duration;

    // Reset end timer
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
    }

    const delayToEndMs = Math.max(0, (this.scheduledTime - ctx.currentTime) * 1000) + 50;
    this.endTimeout = setTimeout(() => {
      this.isPlaying = false;
      this.activeSources = [];
      this.callbacks.onPlaybackEnd?.();
    }, delayToEndMs);
  }

  /**
   * Instantly stops playback and clears all scheduled audio chunks (Barge-in / interruption)
   */
  stop(): void {
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }

    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];

    if (this.audioContext) {
      this.scheduledTime = this.audioContext.currentTime;
    } else {
      this.scheduledTime = 0;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      this.callbacks.onPlaybackEnd?.();
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  close(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
