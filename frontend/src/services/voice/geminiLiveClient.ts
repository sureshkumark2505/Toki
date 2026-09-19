/**
 * Gemini Live Client
 * Manages real-time bidirectional WebSocket connection to FastAPI backend.
 * Coordinates PCMAudioRecorder (mic input) and PCMAudioPlayer (streamed 24kHz audio).
 */

import { PCMAudioRecorder } from './pcmAudioRecorder';
import { PCMAudioPlayer } from './pcmAudioPlayer';

export type LiveVoiceState = 'listening' | 'thinking' | 'speaking' | 'paused';

export interface GeminiLiveCallbacks {
  onTokiTranscript?: (chunk: string) => void;
  onUserTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onStateChange?: (state: LiveVoiceState) => void;
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
  private state: LiveVoiceState = 'paused';
  private callbacks: GeminiLiveCallbacks = {};
  private sessionId: number | null = null;
  private isMuted = false;
  private isConnected = false;

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

  private setState(newState: LiveVoiceState) {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  getState(): LiveVoiceState {
    return this.state;
  }

  async connect(sessionId: number): Promise<void> {
    this.sessionId = sessionId;
    this.disconnect();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use host or configured backend URL
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
              } else {
                this.callbacks.onUserTranscript?.(msg.text);
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
          // Client-side instant barge-in detection: if user speaks loudly while Toki is playing audio, cut Toki's audio
          if (vol > 0.35 && this.player.getIsPlaying()) {
            this.player.stop();
            this.setState('listening');
          }
        },
        onError: (err) => {
          console.warn('Mic recorder error:', err);
        },
      });

      if (!this.isMuted) {
        this.setState('listening');
      }
    } catch (err) {
      console.warn('Could not start microphone:', err);
    }
  }

  private stopMicRecording() {
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
    this.setState('paused');
  }
}
