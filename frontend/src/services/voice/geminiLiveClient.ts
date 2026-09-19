/**
 * Gemini Live Client
 * Manages real-time bidirectional WebSocket connection to FastAPI backend.
 * Uses Gemini Live input & output audio transcription as authoritative source.
 * Coordinates PCMAudioRecorder (mic input) and PCMAudioPlayer (streamed 24kHz audio).
 */

import { VoiceState } from '../../types';
import { PCMAudioRecorder } from './pcmAudioRecorder';
import { PCMAudioPlayer } from './pcmAudioPlayer';

export interface GeminiLiveCallbacks {
  onTokiTranscript?: (chunk: string) => void;
  onUserTranscript?: (text: string, isInterim?: boolean) => void;
  onTurnComplete?: () => void;
  onStateChange?: (state: VoiceState) => void;
  onInterrupted?: () => void;
  onMicLevel?: (level: number) => void;
  onError?: (error: string) => void;
  onConnected?: (info: { model: string; voice: string }) => void;
  onClosed?: () => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private recorder: PCMAudioRecorder;
  private player: PCMAudioPlayer;
  private state: VoiceState = 'idle';
  private callbacks: GeminiLiveCallbacks = {};
  private sessionId: number | null = null;
  private isMuted = false;
  private isConnected = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private receivedGeminiInputTranscription = false;

  constructor(callbacks: GeminiLiveCallbacks = {}) {
    this.callbacks = callbacks;
    this.recorder = new PCMAudioRecorder();
    this.player = new PCMAudioPlayer({
      onPlaybackStart: () => {
        this.setState('speaking');
      },
      onPlaybackEnd: () => {
        if (!this.isMuted) {
          this.setState('listening');
        }
      },
    });
  }

  setCallbacks(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks;
  }

  private setState(newState: VoiceState) {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  getState(): VoiceState {
    return this.state;
  }

  async connect(sessionId: number): Promise<void> {
    this.sessionId = sessionId;
    this.disconnect();
    this.receivedGeminiInputTranscription = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')
      : `${protocol}//${window.location.hostname}:8000`;

    const wsUrl = `${backendHost}/api/ws/live/${sessionId}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.setState('thinking');
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'connected') {
              this.callbacks.onConnected?.(msg);
              this.startMicRecording();
              resolve();
            } else if (msg.type === 'audio') {
              this.player.queueAudioChunk(msg.data);
            } else if (msg.type === 'transcript') {
              if (msg.speaker === 'toki') {
                this.callbacks.onTokiTranscript?.(msg.text);
              } else if (msg.speaker === 'user') {
                this.receivedGeminiInputTranscription = true;
                this.callbacks.onUserTranscript?.(msg.text, msg.is_interim);
              }
            } else if (msg.type === 'interrupted') {
              this.player.stop();
              this.callbacks.onInterrupted?.();
              if (!this.isMuted) {
                this.setState('listening');
              }
            } else if (msg.type === 'turn_complete') {
              this.callbacks.onTurnComplete?.();
              if (!this.player.getIsPlaying() && !this.isMuted) {
                this.setState('listening');
              }
            } else if (msg.type === 'error') {
              this.callbacks.onError?.(msg.message || 'Gemini Live error');
            }
          } catch (e: any) {
            console.warn('Error parsing Live WS message:', e);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
          this.setState('error');
          this.callbacks.onError?.('Failed to connect to Live session');
          reject(err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.stopMicRecording();
          this.player.stop();
          this.setState('paused');
          this.callbacks.onClosed?.();
        };
      } catch (err) {
        this.setState('error');
        reject(err);
      }
    });
  }

  private async startMicRecording() {
    try {
      await this.recorder.start({
        onAudioChunk: (base64PCM) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isMuted) {
            this.ws.send(JSON.stringify({ type: 'audio', data: base64PCM }));
          }
        },
        onVolumeChange: (vol) => {
          this.callbacks.onMicLevel?.(vol);

          if (this.isMuted) return;

          // Instant Barge-In detection: if user speaks while Toki is playing, interrupt immediately
          if (vol > 0.25 && this.player.getIsPlaying()) {
            this.player.stop();
            this.setState('user_speaking');
            return;
          }

          // Visual Voice State Transitions based on acoustic activity
          if (vol > 0.08) {
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
            if (!this.player.getIsPlaying() && this.state !== 'user_speaking') {
              this.setState('user_speaking');
            }
          } else if (this.state === 'user_speaking' && !this.silenceTimer) {
            // User paused speaking: wait 700ms before switching to thinking/listening
            this.silenceTimer = setTimeout(() => {
              this.silenceTimer = null;
              if (this.state === 'user_speaking') {
                this.setState('thinking');
              }
            }, 700);
          }
        },
        onError: (err) => {
          console.warn('Mic recorder error:', err);
          this.setState('error');
        },
      });

      if (!this.isMuted) {
        this.setState('listening');
      }
    } catch (err) {
      console.warn('Could not start microphone:', err);
      this.setState('error');
    }
  }

  private stopMicRecording() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.recorder.stop();
  }

  sendText(text: string): void {
    if (!text.trim()) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.player.stop();
      this.setState('thinking');
      this.ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
    }
  }

  /**
   * EXPLICIT FALLBACK STT HANDLER:
   * Only called if client-side fallback STT is explicitly active and Gemini Live input transcription is unavailable.
   */
  sendFallbackUserTranscript(text: string): void {
    if (!text.trim() || this.receivedGeminiInputTranscription) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'user_transcript', text: text.trim() }));
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.recorder.setMuted(muted);
    if (muted) {
      this.player.stop();
      this.setState('paused');
    } else {
      this.setState('listening');
    }
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  disconnect(): void {
    this.stopMicRecording();
    this.player.stop();
    this.player.close();

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'end_session' }));
        } catch {}
      }
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.setState('idle');
  }
}
