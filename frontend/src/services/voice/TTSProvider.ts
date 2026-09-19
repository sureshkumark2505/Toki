/**
 * TTS (Text-to-Speech) Provider Interface & Browser Implementation.
 * Abstracted to allow easy plug-in replacement with Gemini Audio / ElevenLabs / Cloud TTS.
 */

export interface TTSEventCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (charIndex: number, charLength?: number) => void;
}

export interface TTSOptions {
  rate?: number; // 0.5 to 2.0 (default 1.0)
  pitch?: number; // 0.5 to 1.5 (default 1.0)
  accent?: 'uk' | 'us' | 'au' | string;
  lang?: string;
  voiceName?: string;
}

export interface TTSProvider {
  speak(text: string, options?: TTSOptions, callbacks?: TTSEventCallbacks): void;
  stop(): void;
  isSpeaking(): boolean;
  getAvailableVoices(): Promise<SpeechSynthesisVoice[]>;
}

// Browser Web Speech API SpeechSynthesis Implementation
export class WebSpeechTTSProvider implements TTSProvider {
  private active = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (this.voices.length > 0) return this.voices;
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve([]);
        return;
      }
      const loaded = window.speechSynthesis.getVoices();
      if (loaded.length > 0) {
        this.voices = loaded;
        resolve(loaded);
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices();
          resolve(this.voices);
        };
        setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
      }
    });
  }

  private pickVoice(accent?: string, voiceName?: string): SpeechSynthesisVoice | null {
    const voices = this.loadVoices();
    if (!voices.length) return null;

    if (voiceName) {
      const match = voices.find((v) => v.name.toLowerCase().includes(voiceName.toLowerCase()));
      if (match) return match;
    }

    const normAccent = (accent || '').toLowerCase();
    if (normAccent.includes('uk') || normAccent.includes('british') || normAccent === 'en-gb') {
      const gbVoice = voices.find(
        (v) =>
          v.lang === 'en-GB' &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Oliver') || v.name.includes('George') || v.name.includes('Hazel'))
      ) || voices.find((v) => v.lang === 'en-GB');
      if (gbVoice) return gbVoice;
    } else if (normAccent.includes('au') || normAccent.includes('australian') || normAccent === 'en-au') {
      const auVoice = voices.find((v) => v.lang === 'en-AU') || voices.find((v) => v.lang.startsWith('en-AU'));
      if (auVoice) return auVoice;
    } else if (normAccent.includes('us') || normAccent.includes('american') || normAccent === 'en-us') {
      const usVoice = voices.find(
        (v) =>
          v.lang === 'en-US' &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Ava') || v.name.includes('Jenny') || v.name.includes('Guy'))
      ) || voices.find((v) => v.lang === 'en-US');
      if (usVoice) return usVoice;
    }

    // Default to any pleasant natural English voice
    return (
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null
    );
  }

  speak(text: string, options: TTSOptions = {}, callbacks: TTSEventCallbacks = {}): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks.onError?.('SpeechSynthesis is not supported');
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = options.pitch ?? 1.0;

    const voice = this.pickVoice(options.accent, options.voiceName);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else if (options.lang) {
      utterance.lang = options.lang;
    }

    utterance.onstart = () => {
      this.active = true;
      callbacks.onStart?.();
    };

    utterance.onend = () => {
      this.active = false;
      this.currentUtterance = null;
      callbacks.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.active = false;
      this.currentUtterance = null;
      callbacks.onError?.(e);
    };

    utterance.onboundary = (e) => {
      callbacks.onBoundary?.(e.charIndex, e.charLength);
    };

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.active = false;
    this.currentUtterance = null;
  }

  isSpeaking(): boolean {
    return this.active;
  }
}
