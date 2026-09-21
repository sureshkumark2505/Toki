import React, { useState, useEffect, useRef, useTransition } from 'react';
import { TokiOrb } from './TokiOrb';
import { VoiceState, TranscriptItem, SessionFeedbackData } from '../types';
import { GeminiLiveClient, LiveCorrection } from '../services/voice/geminiLiveClient';
import { tokiApi, BackendSessionReport } from '../services/api';
import { defaultVoiceService } from '../services/voice/voiceService';

interface ActiveSessionScreenProps {
  sessionId?: number;
  initialTopic?: string;
  initialOpening?: string;
  userId?: number;
  onEndSession: (feedback: SessionFeedbackData) => void;
  onMinimize: () => void;
}

export const ActiveSessionScreen: React.FC<ActiveSessionScreenProps> = ({
  sessionId,
  initialTopic,
  onEndSession,
  onMinimize,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('thinking');
  const [seconds, setSeconds] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentTokiSpeech, setCurrentTokiSpeech] = useState('');
  const [currentUserSpeech, setCurrentUserSpeech] = useState('');
  const [showKeyboardDrawer, setShowKeyboardDrawer] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveCorrections, setLiveCorrections] = useState<LiveCorrection[]>([]);
  const [isPlayingCorrection, setIsPlayingCorrection] = useState(false);
  const [, startTransition] = useTransition();

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const wordsExchangedRef = useRef<number>(0);
  const isEndingRef = useRef<boolean>(false);
  const currentTokiSpeechRef = useRef<string>('');

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format mm:ss
  const formatTime = (totalSecs: number) => {
    const m = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // State label mapping
  const getStateMessage = () => {
    if (isMicMuted) return { text: 'Session paused • Tap mic to resume', color: 'text-[#87929a]' };
    switch (voiceState) {
      case 'listening':
        return { text: 'Listening to you...', color: 'text-[#8ed5ff]' };
      case 'user_speaking':
        return { text: 'Listening... speaking', color: 'text-[#38bdf8]' };
      case 'thinking':
        return { text: 'Toki is reflecting...', color: 'text-[#ffc176]' };
      case 'speaking':
        return { text: 'Toki is speaking...', color: 'text-[#38bdf8]' };
      case 'paused':
        return { text: 'Paused', color: 'text-[#87929a]' };
      case 'error':
        return { text: 'Connection issue • Reconnecting', color: 'text-[#ffb4ab]' };
      case 'idle':
      default:
        return { text: 'Ready', color: 'text-[#87929a]' };
    }
  };

  // Initialize Gemini Live WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const liveClient = new GeminiLiveClient({
      onConnected: () => {
        setIsLiveConnected(true);
        setVoiceState('listening');
      },
      onStateChange: (newState) => {
        setVoiceState(newState);
      },
      onTokiTranscript: (chunk) => {
        currentTokiSpeechRef.current += chunk;
        setCurrentTokiSpeech(currentTokiSpeechRef.current);
      },
      onTurnComplete: () => {
        const fullSpeech = currentTokiSpeechRef.current.trim();
        if (fullSpeech) {
          wordsExchangedRef.current += fullSpeech.split(/\s+/).length;
          setTranscripts((prev) => [
            ...prev,
            {
              id: `toki-${Date.now()}`,
              speaker: 'toki',
              text: fullSpeech,
              timestamp: formatTime(seconds),
            },
          ]);
          currentTokiSpeechRef.current = '';
          setCurrentTokiSpeech('');
        }
      },
      onUserTranscript: (userText, isInterim) => {
        if (!userText.trim()) return;

        if (isInterim) {
          setCurrentUserSpeech(userText.trim());
        } else {
          setCurrentUserSpeech('');
          wordsExchangedRef.current += userText.trim().split(/\s+/).length;
          setTranscripts((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              speaker: 'user',
              text: userText.trim(),
              timestamp: formatTime(seconds),
            },
          ]);
        }
      },
      onInterrupted: () => {
        // Instant Barge-In
        const interruptedPart = currentTokiSpeechRef.current.trim();
        if (interruptedPart) {
          setTranscripts((prev) => [
            ...prev,
            {
              id: `toki-interrupted-${Date.now()}`,
              speaker: 'toki',
              text: interruptedPart + '...',
              timestamp: formatTime(seconds),
            },
          ]);
        }
        currentTokiSpeechRef.current = '';
        setCurrentTokiSpeech('');
      },
      onCorrection: (corr) => {
        setLiveCorrections((prev) => [...prev.slice(-3), corr]);
      },
      onError: (err) => {
        console.warn('Gemini Live error:', err);
      },
    });

    liveClientRef.current = liveClient;

    // Defer connect one tick so React StrictMode's throwaway mount never opens a socket.
    const connectTimer = setTimeout(() => {
      liveClient.connect(sessionId).catch((err) => {
        console.warn('Failed to connect to Live session:', err);
      });
    }, 0);

    return () => {
      clearTimeout(connectTimer);
      liveClient.disconnect();
    };
  }, [sessionId]);

  // Auto-scroll transcript smoothly
  useEffect(() => {
    if (transcriptScrollRef.current) {
      startTransition(() => {
        transcriptScrollRef.current?.scrollTo({
          top: transcriptScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [transcripts, currentTokiSpeech, currentUserSpeech, liveCorrections]);

  // Toggle mic button
  const handleToggleMic = () => {
    if (!liveClientRef.current) return;
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    liveClientRef.current.setMuted(nextMuted);
  };

  const handleHearCorrection = (text: string) => {
    if (!text || isPlayingCorrection) return;
    setIsPlayingCorrection(true);
    defaultVoiceService.speak(
      text,
      { rate: 0.9, pitch: 1.0 },
      {
        onStart: () => setIsPlayingCorrection(true),
        onEnd: () => setIsPlayingCorrection(false),
        onError: () => setIsPlayingCorrection(false),
      }
    );
  };

  // End voice practice session and transition to feedback report
  const handleEndSessionClick = async () => {
    isEndingRef.current = true;
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
    }

    const durationMins = Math.max(1, Math.round(seconds / 60));
    const totalWords = Math.max(wordsExchangedRef.current, transcripts.length * 6);

    try {
      if (sessionId) {
        // Request comprehensive AI analysis report from FastAPI backend
        const report: BackendSessionReport = await tokiApi.endSession(sessionId);

        const primaryCorrection = report.key_corrections?.[0];
        let improvementObj;

        if (report.streak_counted === false && report.practice_message) {
          improvementObj = {
            focusTitle: 'Daily Streak Goal',
            category: 'Speaking Practice',
            insteadOf: 'Short interaction',
            wrongFragment: 'Short',
            trySaying: report.practice_message,
            correctFragment: 'Practice more',
            audioPronunciationText: report.practice_message,
          };
        } else if (primaryCorrection) {
          improvementObj = {
            focusTitle: primaryCorrection.explanation ? primaryCorrection.explanation.slice(0, 45) : 'Refined natural phrasing',
            category: 'Conversational nuance',
            insteadOf: primaryCorrection.original,
            wrongFragment: primaryCorrection.original.split(' ')[0] || primaryCorrection.original,
            trySaying: primaryCorrection.correction,
            correctFragment: primaryCorrection.correction.split(' ')[0] || primaryCorrection.correction,
            audioPronunciationText: primaryCorrection.correction,
          };
        } else {
          improvementObj = {
            focusTitle: 'Conversational Fluency',
            category: 'Flow & Precision',
            insteadOf: report.practice_message || 'Keep expressing ideas in complete spoken thoughts.',
            wrongFragment: 'Clear',
            trySaying: 'Continue elaborating your thoughts with compound expressions.',
            correctFragment: 'Continue elaborating',
            audioPronunciationText: 'Continue elaborating your thoughts with compound expressions.',
          };
        }

        const feedbackData: SessionFeedbackData = {
          sessionTitle: initialTopic || 'Spoken English Practice',
          durationMinutes: durationMins,
          wordsExchanged: totalWords,
          coachReflection:
            report.practice_message ||
            report.summary ||
            'Great natural speaking flow throughout the session. You expressed your ideas clearly and maintained steady conversational pacing!',
          strengths: (report.strengths && report.strengths.length > 0
            ? report.strengths
            : ['Natural conversational rhythm', 'Clear articulation', 'Confident response formulation']
          ).map((s) => ({
            title: s,
            description: 'Maintained smooth and effortless delivery.',
          })),
          improvement: improvementObj,
          microGoal: report.recommended_exercise || 'Practice target phrasing to strengthen spontaneous cadence.',
          drillTopic: initialTopic || 'Daily Speaking Drill',
        };

        onEndSession(feedbackData);
        return;
      }
    } catch (err) {
      console.warn('End session report error, using synthesized feedback:', err);
    }

    // Fallback feedback synthesis if offline
    const userUtterances = transcripts.filter((t) => t.speaker === 'user').map((t) => t.text);
    const sampleUserSentence = userUtterances.length > 0 ? userUtterances[userUtterances.length - 1] : '';

    const fallbackFeedback: SessionFeedbackData = {
      sessionTitle: initialTopic || 'Voice Practice Session',
      durationMinutes: durationMins,
      wordsExchanged: totalWords,
      coachReflection: transcripts.length > 0
        ? 'Wonderful live conversation! You spoke naturally with little hesitation and engaged thoughtfully.'
        : 'Your conversation was saved, but there was not enough transcript data to generate detailed feedback.',
      strengths: [
        {
          title: 'Fluent real-time flow',
          description: 'Spontaneous responses with natural conversational speed',
        },
        {
          title: 'Active interaction',
          description: 'Quickly adapted to follow-up questions and dialogue',
        },
      ],
      improvement: {
        focusTitle: 'Natural expression flow',
        category: 'Conversational nuance',
        insteadOf: sampleUserSentence || 'Practice greeting and introducing yourself.',
        wrongFragment: sampleUserSentence ? sampleUserSentence.split(' ')[0] : 'Practice',
        trySaying: sampleUserSentence ? 'I enjoyed discussing this topic today.' : 'I enjoyed discussing this topic today.',
        correctFragment: 'I enjoyed',
        audioPronunciationText: 'I enjoyed discussing this topic today.',
      },
      microGoal: 'Practice spontaneous sentence expansion in everyday conversation.',
      drillTopic: initialTopic || 'Spontaneous Fluency',
    };

    onEndSession(fallbackFeedback);
  };

  // Keyboard text submit (Quiet mode)
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !liveClientRef.current) return;
    const txt = textInput.trim();
    setTextInput('');
    setShowKeyboardDrawer(false);

    setTranscripts((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        speaker: 'user',
        text: txt,
        timestamp: formatTime(seconds),
      },
    ]);

    liveClientRef.current.sendText(txt);
  };

  const stateMsg = getStateMessage();

  return (
    <div className="fixed inset-0 z-50 bg-[#0f131c] text-[#dfe2ee] flex flex-col pt-safe pb-safe overflow-hidden select-none">
      <div className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-5 pb-6">
        {/* Minimal Session Navigation Bar */}
        <header className="flex items-center justify-between py-2 w-full z-20 shrink-0">
          <button
            id="close-session-btn"
            type="button"
            aria-label="Minimize session"
            onClick={onMinimize}
            className="w-10 h-10 rounded-full bg-[#181c24] border border-[#3e484f]/25 flex items-center justify-center text-[#bdc8d1] active:scale-95 transition-transform hover:text-[#dfe2ee] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-2 bg-[#181c24]/90 border border-[#3e484f]/30 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38bdf8] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8ed5ff]" />
            </span>
            <span className="text-[12px] text-[#dfe2ee] font-semibold tracking-wide">
              {isLiveConnected ? 'Live with Toki' : 'Connecting...'}
            </span>
            <span className="text-[#87929a] text-[10px]">•</span>
            <span className="text-[12px] text-[#bdc8d1] font-mono" id="sessionTimer">
              {formatTime(seconds)}
            </span>
          </div>

          <div className="w-10 h-10 rounded-full bg-[#181c24] border border-[#3e484f]/25 flex items-center justify-center text-[#8ed5ff]">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </div>
        </header>

        {/* TOP 55–60%: Toki Orb & Voice Living Presence */}
        <section className="flex-[3] flex flex-col items-center justify-center relative overflow-hidden py-2">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-[#38bdf8]/10 blur-3xl animate-pulse" />
          </div>

          {/* Living Toki Voice Core Orb */}
          <div className="relative z-10 my-auto flex flex-col items-center">
            <TokiOrb
              size="hero"
              state={voiceState === 'user_speaking' ? 'listening' : voiceState === 'error' ? 'paused' : voiceState}
              interactive={true}
              onClick={() => {
                if (voiceState === 'speaking' && liveClientRef.current) {
                  // Tap to interrupt
                  liveClientRef.current.setMuted(false);
                }
              }}
            />

            {/* Calm Dynamic State Label */}
            <div className="mt-3 flex items-center gap-2 h-7">
              {(voiceState === 'listening' || voiceState === 'user_speaking') && (
                <span className="flex items-center gap-1 px-1">
                  <span className={`w-0.5 rounded-full animate-bounce ${voiceState === 'user_speaking' ? 'h-4 bg-[#38bdf8]' : 'h-3 bg-[#8ed5ff]'}`} style={{ animationDelay: '0.1s' }} />
                  <span className={`w-0.5 rounded-full animate-bounce ${voiceState === 'user_speaking' ? 'h-6 bg-[#8ed5ff]' : 'h-5 bg-[#38bdf8]'}`} style={{ animationDelay: '0.25s' }} />
                  <span className={`w-0.5 rounded-full animate-bounce ${voiceState === 'user_speaking' ? 'h-3 bg-[#38bdf8]' : 'h-2 bg-[#8ed5ff]'}`} style={{ animationDelay: '0.4s' }} />
                  <span className={`w-0.5 rounded-full animate-bounce ${voiceState === 'user_speaking' ? 'h-5 bg-[#8ed5ff]' : 'h-4 bg-[#38bdf8]'}`} style={{ animationDelay: '0.2s' }} />
                </span>
              )}
              <span className={`text-[13px] font-medium tracking-wide transition-colors ${stateMsg.color}`}>
                {stateMsg.text}
              </span>
            </div>
          </div>
        </section>

        {/* Real-time Live Correction Card */}
        {liveCorrections.length > 0 && (() => {
          const latest = liveCorrections[liveCorrections.length - 1];
          return (
            <div className="mb-2 bg-[#1c2028] border border-[#ffb4ab]/30 rounded-2xl p-3 shadow-lg flex flex-col gap-2 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between border-b border-[#3e484f]/20 pb-1.5">
                <div className="flex items-center gap-1.5 text-[#ffb4ab]">
                  <span className="material-symbols-outlined text-[16px]">spellcheck</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                    Instant Coach Feedback
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleHearCorrection(latest.corrected)}
                  className="flex items-center gap-1 text-[11px] text-[#8ed5ff] bg-[#262a33] hover:bg-[#31353e] px-2 py-0.5 rounded-full border border-[#3e484f]/30 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isPlayingCorrection ? 'graphic_eq' : 'volume_up'}
                  </span>
                  <span>{isPlayingCorrection ? 'Playing...' : 'Hear target'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-[12px]">
                <div className="flex items-start gap-1.5 text-[#ffb4ab]">
                  <span className="font-semibold text-[#87929a] min-w-[65px]">You said:</span>
                  <span className="italic opacity-90">“{latest.original}”</span>
                </div>
                <div className="flex items-start gap-1.5 text-[#8ed5ff]">
                  <span className="font-semibold text-[#38bdf8] min-w-[65px]">Try saying:</span>
                  <span className="font-medium text-[#dfe2ee]">“{latest.corrected}”</span>
                </div>
                {(latest.explanation || latest.explanation_native) && (
                  <div className="flex items-start gap-1.5 text-[#bdc8d1] bg-[#141820]/70 rounded-xl px-2 py-1 mt-0.5 border border-[#3e484f]/20">
                    <span className="font-semibold text-[#ffc176] min-w-[40px]">Why:</span>
                    <div className="flex flex-col">
                      {latest.explanation && <span>{latest.explanation}</span>}
                      {latest.explanation_native && (
                        <span className="text-[#8ed5ff] text-[11px] mt-0.5 font-medium">
                          {latest.explanation_native}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* BOTTOM 40–45%: Clean Live Transcription Stream with Auto-scroll */}
        <section className="flex-[2] min-h-[140px] max-h-[220px] w-full bg-[#181c24]/90 border border-[#3e484f]/25 backdrop-blur-xl rounded-2xl p-4 shadow-md flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#3e484f]/20 pb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#8ed5ff] text-[16px]">
                graphic_eq
              </span>
              <span className="text-[11px] font-bold text-[#bdc8d1] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                Live Read-Along Stream
              </span>
            </div>
            <span className="text-[11px] text-[#87929a]">Barge-in enabled</span>
          </div>

          {/* Conversational Stream */}
          <div
            ref={transcriptScrollRef}
            id="transcriptScroll"
            className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 select-text scrollbar-none"
          >
            {transcripts.map((t) => {
              const isToki = t.speaker === 'toki';
              return (
                <p
                  key={t.id}
                  className="text-[13px] text-[#87929a] leading-relaxed pl-1 transition-opacity duration-300"
                >
                  <span className="text-[11px] font-semibold text-[#68737c] mr-1.5 uppercase">
                    {isToki ? 'Toki:' : 'You:'}
                  </span>
                  &ldquo;{t.text}&rdquo;
                </p>
              );
            })}

            {/* Currently spoken live user speech (interim) */}
            {currentUserSpeech && (
              <div className="rounded-xl p-2.5 bg-[#141820] border border-[#38bdf8]/30">
                <span className="text-[11px] font-semibold text-[#38bdf8] block mb-0.5 uppercase tracking-wide">
                  You (Speaking):
                </span>
                <p className="text-[14px] text-[#bdc8d1] leading-snug italic">
                  &ldquo;{currentUserSpeech}...&rdquo;
                </p>
              </div>
            )}

            {/* Currently streaming Toki sentence (prominent read-along) */}
            {currentTokiSpeech && (
              <div className="rounded-xl p-3 bg-[#1c2028] border border-[#8ed5ff]/30 shadow-inner">
                <span className="text-[11px] font-semibold text-[#8ed5ff] block mb-1 uppercase tracking-wide">
                  Toki (Speaking):
                </span>
                <p className="text-[15px] text-[#dfe2ee] leading-snug font-medium">
                  &ldquo;{currentTokiSpeech}&rdquo;
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Bottom Ergonomic Floating Control Dock */}
        <footer className="mt-4 w-full flex items-center justify-around px-4 py-1 z-30 shrink-0">
          {/* Secondary Action: Keyboard Text Fallback (Quiet Mode) */}
          <button
            id="open-keyboard-fallback-btn"
            type="button"
            aria-label="Type message"
            onClick={() => setShowKeyboardDrawer(!showKeyboardDrawer)}
            className="w-13 h-13 p-3.5 rounded-full bg-[#1c2028] border border-[#3e484f]/30 text-[#bdc8d1] hover:text-[#dfe2ee] active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">keyboard</span>
          </button>

          {/* Main Dynamic Voice Hub Mic Button */}
          <div className="relative flex items-center justify-center">
            {!isMicMuted && (voiceState === 'listening' || voiceState === 'user_speaking') && (
              <div
                className="absolute -inset-2 rounded-full bg-[#38bdf8]/25 animate-ping pointer-events-none"
                id="micPulseRing"
              />
            )}
            <button
              id="main-mic-toggle-btn"
              type="button"
              aria-label="Toggle voice capture"
              onClick={handleToggleMic}
              className={`relative w-18 h-18 rounded-full font-bold shadow-lg flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                isMicMuted
                  ? 'bg-[#262a33] text-[#bdc8d1] border border-[#3e484f]'
                  : 'bg-gradient-to-tr from-[#8ed5ff] via-[#38bdf8] to-[#bdc2ff] text-[#00354a] shadow-[#38bdf8]/30'
              }`}
            >
              <span
                className="material-symbols-outlined text-[32px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isMicMuted ? 'mic_off' : 'mic'}
              </span>
            </button>
          </div>

          {/* Secondary Action: End Session Button */}
          <button
            id="end-session-btn"
            type="button"
            aria-label="End conversation"
            onClick={handleEndSessionClick}
            className="w-13 h-13 p-3.5 rounded-full bg-[#93000a]/40 border border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#93000a]/60 active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">call_end</span>
          </button>
        </footer>

        {/* Quiet Mode Keyboard Input Drawer */}
        {showKeyboardDrawer && (
          <div className="absolute bottom-24 left-5 right-5 z-40 bg-[#181c24] border border-[#3e484f]/40 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3e484f]/30">
              <span className="text-[12px] text-[#bdc8d1] font-medium">Type to Toki (Quiet mode)</span>
              <button
                type="button"
                onClick={() => setShowKeyboardDrawer(false)}
                className="text-[#bdc8d1] hover:text-[#dfe2ee]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSendText} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your response..."
                className="flex-1 bg-[#0f131c] border border-[#3e484f]/40 rounded-xl px-3 py-2 text-[14px] text-[#dfe2ee] focus:outline-none focus:border-[#8ed5ff]"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#8ed5ff] text-[#00354a] rounded-xl font-semibold text-[13px] hover:bg-[#c4e7ff] active:scale-95 cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
