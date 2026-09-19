import { STTProvider, WebSpeechSTTProvider, STTEventCallbacks } from './STTProvider';
import { TTSProvider, WebSpeechTTSProvider, TTSOptions, TTSEventCallbacks } from './TTSProvider';

export type VoiceState = 'listening' | 'thinking' | 'speaking' | 'paused';

export class VoiceService {
  private stt: STTProvider;
  private tts: TTSProvider;
  private currentState: VoiceState = 'paused';
  private onStateChange?: (state: VoiceState) => void;

  constructor(sttProvider?: STTProvider, ttsProvider?: TTSProvider) {
    this.stt = sttProvider || new WebSpeechSTTProvider();
    this.tts = ttsProvider || new WebSpeechTTSProvider();
  }

  setStateCallback(cb: (state: VoiceState) => void) {
    this.onStateChange = cb;
  }

  private setState(state: VoiceState) {
    this.currentState = state;
    this.onStateChange?.(state);
  }

  getState(): VoiceState {
    return this.currentState;
  }

  startListening(callbacks: STTEventCallbacks, lang = 'en-US'): void {
    if (this.tts.isSpeaking()) {
      this.tts.stop();
    }

    this.setState('listening');
    this.stt.startListening(
      {
        ...callbacks,
        onStart: () => {
          this.setState('listening');
          callbacks.onStart?.();
        },
        onError: (err) => {
          callbacks.onError?.(err);
        },
        onEnd: () => {
          callbacks.onEnd?.();
        },
      },
      lang
    );
  }

  stopListening(): void {
    this.stt.stopListening();
    if (this.currentState === 'listening') {
      this.setState('paused');
    }
  }

  speak(
    text: string,
    options: TTSOptions = {},
    callbacks: TTSEventCallbacks = {}
  ): void {
    // Pause STT during speaking to avoid feedback echo
    this.stt.stopListening();
    this.setState('speaking');

    this.tts.speak(text, options, {
      ...callbacks,
      onStart: () => {
        this.setState('speaking');
        callbacks.onStart?.();
      },
      onEnd: () => {
        callbacks.onEnd?.();
      },
      onError: (err) => {
        callbacks.onError?.(err);
      },
    });
  }

  stopAll(): void {
    this.stt.stopListening();
    this.tts.stop();
    this.setState('paused');
  }

  isSTTSupported(): boolean {
    return this.stt.isSupported();
  }

  setThinkingState(): void {
    this.stt.stopListening();
    this.setState('thinking');
  }
}

export const defaultVoiceService = new VoiceService();
