/**
 * STT (Speech-to-Text) Provider Interface & Browser Implementation.
 * Abstracted to allow easy plug-in replacement with Gemini Live / WebSocket / native audio STT.
 */

export interface STTEventCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface STTProvider {
  startListening(callbacks: STTEventCallbacks, lang?: string): void;
  stopListening(): void;
  isListening(): boolean;
  isSupported(): boolean;
}

// Browser Web Speech API Implementation
export class WebSpeechSTTProvider implements STTProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private active = false;
  private callbacks: STTEventCallbacks | null = null;
  private language = 'en-US';
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldKeepListening = false;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript.trim() && this.callbacks?.onResult) {
          this.callbacks.onResult(finalTranscript.trim(), true);
        } else if (interimTranscript.trim() && this.callbacks?.onResult) {
          this.callbacks.onResult(interimTranscript.trim(), false);
        }
      };

      this.recognition.onspeechstart = () => {
        this.callbacks?.onSpeechStart?.();
      };

      this.recognition.onspeechend = () => {
        this.callbacks?.onSpeechEnd?.();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        this.callbacks?.onError?.(event.error || 'Speech recognition error');
      };

      this.recognition.onstart = () => {
        this.active = true;
        this.callbacks?.onStart?.();
      };

      this.recognition.onend = () => {
        this.active = false;
        this.callbacks?.onEnd?.();

        if (this.shouldKeepListening) {
          this.restartTimeout = setTimeout(() => {
            if (this.shouldKeepListening && !this.active && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                // Ignore start if already active
              }
            }
          }, 300);
        }
      };
    }
  }

  startListening(callbacks: STTEventCallbacks, lang = 'en-US'): void {
    this.callbacks = callbacks;
    this.language = lang;
    this.shouldKeepListening = true;

    if (!this.recognition) {
      this.initRecognition();
    }

    if (this.recognition) {
      this.recognition.lang = this.language;
      try {
        this.recognition.start();
        this.active = true;
      } catch {
        // Recognition might already be running
      }
    } else {
      callbacks.onError?.('SpeechRecognition is not supported in this browser.');
    }
  }

  stopListening(): void {
    this.shouldKeepListening = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition && this.active) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.active = false;
    }
  }

  isListening(): boolean {
    return this.active;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}
