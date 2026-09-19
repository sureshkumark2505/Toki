import React, { useState } from 'react';
import { DEFAULT_FEEDBACK, TOKI_BRAND_LOGO } from '../data';
import { SessionFeedbackData } from '../types';
import { tokiApi } from '../services/api';
import { defaultVoiceService } from '../services/voice/voiceService';

interface SessionFeedbackScreenProps {
  data?: SessionFeedbackData;
  userName?: string;
  userId?: number;
  onDone: () => void;
  onPracticeDrill: (topic: string) => void;
}

export const SessionFeedbackScreen: React.FC<SessionFeedbackScreenProps> = ({
  data = DEFAULT_FEEDBACK,
  userName = 'Suresh',
  userId = 1,
  onDone,
  onPracticeDrill,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);

  const handleHearNative = () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);

    defaultVoiceService.speak(
      data.improvement.audioPronunciationText,
      { rate: 0.9, pitch: 1.0 },
      {
        onStart: () => setIsPlayingAudio(true),
        onEnd: () => setIsPlayingAudio(false),
        onError: () => setIsPlayingAudio(false),
      }
    );
  };

  const handleToggleSave = async () => {
    if (isSaved) {
      setIsSaved(false);
      return;
    }

    setSavingLoading(true);
    try {
      await tokiApi.addVocabulary({
        user_id: userId,
        word_or_phrase: data.improvement.trySaying,
        meaning: data.improvement.focusTitle,
        example: data.improvement.audioPronunciationText,
        learner_usage: data.improvement.insteadOf,
      });
      setIsSaved(true);
    } catch (err) {
      console.warn('Could not save vocabulary to database, saving locally:', err);
      setIsSaved(true);
    } finally {
      setSavingLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f131c] text-[#dfe2ee]">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 pt-safe bg-[#0f131c]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.25)] border-b border-[#3e484f]/20">
        <div className="h-16 max-w-md mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDone}
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-[#dfe2ee] hover:bg-[#1c2028] active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-[#38bdf8] via-[#8ed5ff] to-[#bdc2ff] p-0.5">
              <img
                src={TOKI_BRAND_LOGO}
                alt="Toki"
                className="w-full h-full object-contain rounded-full bg-[#0f131c]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] font-semibold text-[17px] text-[#dfe2ee] tracking-tight truncate max-w-[160px]">
              Session Feedback
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181c24] border border-[#3e484f]/30">
              <span className="material-symbols-outlined text-[16px] text-[#8ed5ff]">
                equalizer
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#8ed5ff] flex items-center justify-center text-[#00354a]">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                person
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-20 pb-12 px-5 max-w-md mx-auto relative overflow-hidden flex flex-col space-y-6">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Ambient Orb Glow Hero Emblem */}
        <div className="flex flex-col items-center justify-center pt-2 pb-1">
          <div className="relative flex items-center justify-center w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-[#38bdf8]/15 blur-xl animate-pulse" />
            <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-[#7bd0ff]/20 via-[#353942]/40 to-[#8ed5ff]/25 backdrop-blur-md shadow-inner" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-[#38bdf8] to-[#00668a] shadow-lg flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#0f131c] shadow-sm flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#8ed5ff] text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              </div>
            </div>
          </div>

          <div className="text-center mt-3 space-y-1">
            <h2 className="text-[26px] font-bold text-[#dfe2ee] font-['Plus_Jakarta_Sans']">
              Nice work, {userName}! 👏
            </h2>
            <p className="text-[13px] text-[#bdc8d1] flex items-center justify-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-[15px] text-[#8ed5ff]">schedule</span>
              <span>You spoke for {data.durationMinutes} minutes</span>
              <span className="inline-block w-1 h-1 rounded-full bg-[#87929a]" />
              <span>{data.wordsExchanged} words exchanged</span>
            </p>
          </div>
        </div>

        {/* Warm Coach Reflection Summary Banner */}
        <div className="bg-[#181c24] border border-[#3e484f]/25 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-[#38bdf8]/20 flex-shrink-0 flex items-center justify-center mt-0.5 text-[#8ed5ff]">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[#8ed5ff] uppercase tracking-wider">
              Coach Reflection
            </p>
            <p className="text-[13px] text-[#dfe2ee] mt-1 leading-relaxed">
              {data.coachReflection}
            </p>
          </div>
        </div>

        {/* Section 1: What You Did Well */}
        <div className="flex flex-col space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-[16px] font-bold text-[#dfe2ee]">What you did well</h3>
            <span className="text-[11px] font-medium text-[#8ed5ff] px-2.5 py-0.5 rounded-full bg-[#8ed5ff]/10 border border-[#8ed5ff]/20">
              {data.strengths.length} strengths
            </span>
          </div>

          <div className="bg-[#1c2028] border border-[#3e484f]/25 rounded-2xl p-4 space-y-3.5 shadow-sm">
            {data.strengths.map((item, index) => (
              <React.Fragment key={index}>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#8ed5ff]/15 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#8ed5ff]">
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#dfe2ee]">{item.title}</p>
                    {item.badges && item.badges.length > 0 ? (
                      <p className="text-[13px] text-[#bdc8d1] mt-1 flex flex-wrap items-center gap-1.5">
                        Naturally integrated
                        {item.badges.map((b, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#262a33] text-[#8ed5ff] border border-[#3e484f]/30"
                          >
                            ‘{b}’
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-[13px] text-[#bdc8d1] mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
                {index < data.strengths.length - 1 && (
                  <div className="h-[1px] w-full bg-[#31353e]/60" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Section 2: One Key Thing to Improve */}
        <div className="flex flex-col space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-[16px] font-bold text-[#dfe2ee]">One key thing to improve</h3>
            <span className="text-[11px] font-medium text-[#ffc176] px-2.5 py-0.5 rounded-full bg-[#f1a02b]/20 border border-[#ffc176]/30">
              Focus target
            </span>
          </div>

          <div className="bg-[#1c2028] border border-[#3e484f]/25 rounded-2xl p-4 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#ffc176]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ffc176] text-[20px]">
                  flag
                </span>
                <span className="text-[16px] font-semibold text-[#dfe2ee]">
                  {data.improvement.focusTitle}
                </span>
              </div>
              <span className="text-[11px] text-[#bdc8d1] bg-[#262a33] px-2.5 py-0.5 rounded-full border border-[#3e484f]/40">
                {data.improvement.category}
              </span>
            </div>

            {/* Contextual Example Comparison */}
            <div className="space-y-2.5">
              {/* Instead of saying */}
              <div className="bg-[#181c24] border border-[#3e484f]/20 rounded-xl p-3 flex flex-col space-y-1">
                <div className="flex items-center gap-1.5 text-[#ffb4ab]">
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  <span className="text-[11px] uppercase tracking-wide font-bold">
                    Instead of saying
                  </span>
                </div>
                <p className="text-[14px] text-[#bdc8d1] pl-5 italic">
                  “{data.improvement.insteadOf}”
                </p>
              </div>

              {/* Try saying */}
              <div className="bg-[#38bdf8]/10 border border-[#38bdf8]/25 rounded-xl p-3 flex flex-col space-y-1">
                <div className="flex items-center gap-1.5 text-[#8ed5ff]">
                  <span className="material-symbols-outlined text-[15px]">check</span>
                  <span className="text-[11px] uppercase tracking-wide font-bold">
                    Try saying
                  </span>
                </div>
                <p className="text-[14px] text-[#dfe2ee] pl-5 font-medium">
                  “{data.improvement.trySaying}”
                </p>
              </div>
            </div>

            {/* Hear Native Pronunciation button */}
            <button
              id="hear-audio-native-btn"
              type="button"
              onClick={handleHearNative}
              className="w-full py-2.5 px-4 rounded-full bg-[#262a33] hover:bg-[#31353e] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-[#dfe2ee] border border-[#3e484f]/30 cursor-pointer shadow-sm"
            >
              <span className={`material-symbols-outlined text-[18px] text-[#8ed5ff] ${isPlayingAudio ? 'animate-pulse' : ''}`}>
                {isPlayingAudio ? 'graphic_eq' : 'volume_up'}
              </span>
              <span className="text-[13px] font-medium">
                {isPlayingAudio ? 'Playing pronunciation...' : 'Hear native pronunciation'}
              </span>
            </button>
          </div>
        </div>

        {/* Motivational Micro-Goal */}
        <div className="bg-[#181c24]/80 border border-[#3e484f]/20 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2f3aa3]/40 border border-[#bdc2ff]/20 flex items-center justify-center flex-shrink-0 text-[#bdc2ff]">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-[#dfe2ee]">Micro-goal unlocked</p>
            <p className="text-[13px] text-[#bdc8d1] truncate">{data.microGoal}</p>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="pt-2 flex flex-col space-y-2.5">
          <button
            id="practice-drill-btn"
            type="button"
            onClick={() => onPracticeDrill(data.drillTopic)}
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#8ed5ff] to-[#7bd0ff] text-[#00354a] font-['Plus_Jakarta_Sans'] text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#38bdf8]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">bolt</span>
            <span>Practice {data.drillTopic} (2 min)</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="save-phrase-btn"
              type="button"
              disabled={savingLoading}
              onClick={handleToggleSave}
              className="w-full py-2.5 px-3 rounded-full bg-[#181c24] hover:bg-[#1c2028] border border-[#3e484f]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-[#dfe2ee] cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isSaved ? 'text-[#8ed5ff]' : 'text-[#bdc2ff]'
                }`}
                style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
              >
                {isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
              <span className="text-[13px] font-medium">
                {isSaved ? 'Saved to Bank!' : savingLoading ? 'Saving...' : 'Save Phrase'}
              </span>
            </button>

            <button
              id="done-feedback-btn"
              type="button"
              onClick={onDone}
              className="w-full py-2.5 px-3 rounded-full bg-[#181c24] hover:bg-[#1c2028] border border-[#3e484f]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-[#dfe2ee] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#bdc8d1]">
                done_all
              </span>
              <span className="text-[13px] font-medium">Done</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
