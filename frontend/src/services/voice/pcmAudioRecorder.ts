/**
 * PCM Audio Recorder for Gemini Live
 * Captures microphone stream at 16,000 Hz 16-bit Mono PCM and streams chunks via callback.
 */

export interface AudioRecorderCallbacks {
  onAudioChunk: (base64PCM: string) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (err: any) => void;
}

export class PCMAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private isMuted = false;

  async start(callbacks: AudioRecorderCallbacks): Promise<void> {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      // 2048 buffer size gives ~128ms chunks at 16kHz
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate volume level for visual reactivity
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        callbacks.onVolumeChange?.(Math.min(1, rms * 5));

        // Convert Float32Array [-1.0, 1.0] to Int16Array PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        callbacks.onAudioChunk(base64);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (err: any) {
      callbacks.onError?.(err);
      throw err;
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  stop(): void {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
