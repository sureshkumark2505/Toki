import React, { useState, useEffect } from 'react';
import { SavedPhrase, WeeklyDayActivity } from '../types';
import { tokiApi, BackendVocabItem, BackendProgressDashboard } from '../services/api';
import { defaultVoiceService } from '../services/voice/voiceService';

interface ProgressScreenProps {
  userId?: number;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ userId = 1 }) => {
  const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
  const [dashboard, setDashboard] = useState<BackendProgressDashboard | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<WeeklyDayActivity[]>([]);

  // --- Feature: Session Transcript Replay ---
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<any | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState<'progress' | 'transcripts'>('progress');

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [vocabItems, progressData, weeklyData] = await Promise.allSettled([
          tokiApi.getVocabulary(userId),
          tokiApi.getProgress(userId),
          tokiApi.getWeeklyTrend(userId),
        ]);

        const sessionsRes = await tokiApi.getSessionHistory(userId, 8).catch(() => []);
        if (mounted) setRecentSessions(sessionsRes || []);

        if (mounted && vocabItems.status === 'fulfilled' && vocabItems.value) {
          const mapped: SavedPhrase[] = vocabItems.value.map((v: BackendVocabItem) => ({
            id: `v-${v.id}`,
            text: v.word_or_phrase,
            category: v.meaning || 'Saved Phrase',
            status: v.mastery >= 75 ? 'Mastered' : 'In practice',
            statusColor: v.mastery >= 75 ? '#8ed5ff' : '#ffc176',
          }));
          setPhrases(mapped);
        }

        if (mounted && progressData.status === 'fulfilled' && progressData.value) {
          setDashboard(progressData.value);
        }

        // Compute dynamic weekly rhythm
        const activeDates = new Set<string>();
        if (weeklyData.status === 'fulfilled' && weeklyData.value?.daily_trends) {
          weeklyData.value.daily_trends.forEach((t: any) => {
            if (t.overall_score > 0 || t.fluency > 0) {
              activeDates.add(t.date);
            }
          });
        }

        const now = new Date();
        const currentDay = now.getDay();
        const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(now);
        monday.setDate(now.getDate() + distanceToMon);

        const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const calculatedWeek: WeeklyDayActivity[] = [];

        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const isoDate = d.toISOString().split('T')[0];
          const isToday = d.toDateString() === now.toDateString();
          const hasActivity = activeDates.has(isoDate);

          calculatedWeek.push({
            dayLabel: dayLabels[i],
            fullDate: isoDate,
            isToday,
            hasActivity,
            minutes: hasActivity ? 10 : 0,
          });
        }

        if (mounted) {
          setWeekDays(calculatedWeek);
        }
      } catch (err) {
        console.warn('Could not load progress data from API:', err);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleViewTranscript = async (sessionId: number | string) => {
    setLoadingTranscript(true);
    try {
      const data = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/sessions/${sessionId}/transcript`);
      const json = await data.json();
      setSelectedTranscript(json);
    } catch (e) {
      console.warn('Could not load transcript', e);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handlePlayAudio = (phrase: SavedPhrase) => {
    if (playingId === phrase.id) {
      defaultVoiceService.stopAll();
      setPlayingId(null);
      return;
    }

    setPlayingId(phrase.id);
    defaultVoiceService.speak(
      phrase.text,
      { rate: 0.9, pitch: 1.0 },
      {
        onStart: () => setPlayingId(phrase.id),
        onEnd: () => setPlayingId(null),
        onError: () => setPlayingId(null),
      }
    );
  };

  const streakCount = dashboard?.streak_days ?? 0;
  const speakingMins = dashboard?.speaking_minutes ?? 0;
  const fluencyScore = dashboard?.fluency_score ?? 75;
  const grammarScore = dashboard?.grammar_score ?? 72;
  const vocabScore = dashboard?.vocabulary_score ?? 78;

  return (
    <div className="flex flex-col w-full px-5 pb-28 pt-2 gap-5 max-w-md mx-auto">
      {/* Ambient Header Emblem */}
      <div className="relative w-full flex items-center justify-center pt-2 pb-1 overflow-visible">
        <div className="absolute w-48 h-48 rounded-full bg-[#38bdf8]/10 blur-3xl pointer-events-none -top-4" />
        <div className="relative flex flex-col items-center text-center max-w-xs">
          <div className="relative flex items-center justify-center w-20 h-20 mb-2.5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#2f3aa3]/40 via-[#38bdf8]/20 to-[#8ed5ff]/30 blur-md animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-[#262a33] border border-[#3e484f]/40 flex items-center justify-center shadow-lg">
              <div className="w-9 h-9 rounded-full bg-[#38bdf8] flex items-center justify-center shadow-inner">
                <div className="w-4 h-4 rounded-full bg-[#0f131c]" />
              </div>
            </div>
          </div>
          <h2 className="text-[26px] font-bold text-[#dfe2ee] tracking-tight font-['Plus_Jakarta_Sans']">
            Progress &amp; Consistency
          </h2>
          <p className="text-[14px] text-[#bdc8d1] mt-1">
            {speakingMins > 0
              ? `${speakingMins} minutes spoken. Your confidence is building naturally.`
              : 'Start your practice journey to unlock weekly rhythm and fluency tracking.'}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-[#181c24] border border-[#3e484f]/25 rounded-2xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-[#8ed5ff] text-[#00354a] shadow-sm'
              : 'text-[#bdc8d1] hover:text-[#dfe2ee]'
          }`}
        >
          Progress
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transcripts')}
          className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${
            activeTab === 'transcripts'
              ? 'bg-[#8ed5ff] text-[#00354a] shadow-sm'
              : 'text-[#bdc8d1] hover:text-[#dfe2ee]'
          }`}
        >
          Transcripts
        </button>
      </div>

      {activeTab === 'progress' && (<>

      {/* Weekly Rhythm Section */}
      <section className="flex flex-col bg-[#1c2028] border border-[#3e484f]/25 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#8ed5ff] text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              spa
            </span>
            <span className="text-[16px] font-semibold text-[#dfe2ee]">Weekly Rhythm</span>
          </div>
          <span className="text-[12px] font-medium text-[#8ed5ff] bg-[#8ed5ff]/10 border border-[#8ed5ff]/20 px-2.5 py-1 rounded-full">
            {streakCount} {streakCount === 1 ? 'day' : 'days'} active
          </span>
        </div>

        {/* Day Indicators */}
        <div className="grid grid-cols-7 gap-2 pt-1">
          {weekDays.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <span
                className={`text-[11px] font-medium ${
                  day.isToday ? 'text-[#8ed5ff] font-bold' : 'text-[#bdc8d1]'
                }`}
              >
                {day.dayLabel}
              </span>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  day.isToday
                    ? 'bg-[#8ed5ff] text-[#00354a] shadow-sm ring-2 ring-[#8ed5ff]/40'
                    : day.hasActivity
                    ? 'bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-[#8ed5ff]'
                    : 'bg-[#262a33] text-[#87929a]'
                }`}
              >
                {day.hasActivity ? (
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : day.isToday ? (
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    graphic_eq
                  </span>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3e484f]" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-[#3e484f]/20 flex items-center justify-between text-[#bdc8d1]">
          <span className="text-[13px]">
            {streakCount > 0 ? 'Calm momentum maintained' : 'Ready for today’s session'}
          </span>
          <span className="text-[11px] text-[#bdc2ff] font-medium">{speakingMins} total spoken mins</span>
        </div>
      </section>

      {/* Core Fluency Dynamics */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[16px] font-semibold text-[#dfe2ee]">Core Fluency</span>
          <span className="text-[12px] text-[#bdc8d1]">Based on voice sessions</span>
        </div>

        <div className="flex flex-col bg-[#1c2028] border border-[#3e484f]/25 rounded-2xl p-5 gap-4 shadow-sm">
          {/* Speaking Flow */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8ed5ff] text-[18px]">
                  record_voice_over
                </span>
                <span className="text-[15px] font-semibold text-[#dfe2ee]">Speaking Flow</span>
              </div>
              <span className="text-[14px] font-bold text-[#8ed5ff]">{fluencyScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#262a33] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#38bdf8] to-[#8ed5ff] rounded-full" style={{ width: `${fluencyScore}%` }} />
            </div>
          </div>

          {/* Grammar Instinct */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ffc176] text-[18px]">
                  auto_fix_high
                </span>
                <span className="text-[15px] font-semibold text-[#dfe2ee]">Grammar Ease</span>
              </div>
              <span className="text-[14px] font-bold text-[#ffc176]">{grammarScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#262a33] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#f1a02b] to-[#ffc176] rounded-full" style={{ width: `${grammarScore}%` }} />
            </div>
          </div>

          {/* Vocabulary Active */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#bdc2ff] text-[18px]">
                  menu_book
                </span>
                <span className="text-[15px] font-semibold text-[#dfe2ee]">Vocabulary Range</span>
              </div>
              <span className="text-[14px] font-bold text-[#bdc2ff]">{vocabScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#262a33] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#7bd0ff] to-[#bdc2ff] rounded-full" style={{ width: `${vocabScore}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Saved Phrases & Vocabulary Bank */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[#dfe2ee]">Saved Phrases &amp; Bank</span>
            <span className="text-[11px] font-semibold text-[#8ed5ff] bg-[#8ed5ff]/10 border border-[#8ed5ff]/20 px-2 py-0.5 rounded-full">
              {phrases.length}
            </span>
          </div>
          {phrases.length > 0 && <span className="text-[12px] text-[#bdc8d1]">Tap to hear audio</span>}
        </div>

        {phrases.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {phrases.map((phrase) => {
              const isPlaying = playingId === phrase.id;
              return (
                <div
                  key={phrase.id}
                  onClick={() => handlePlayAudio(phrase)}
                  className={`w-full rounded-2xl bg-[#181c24] border p-4 flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.99] ${
                    isPlaying ? 'border-[#8ed5ff] bg-[#1c2028]' : 'border-[#3e484f]/25 hover:border-[#8ed5ff]/40 hover:bg-[#1c2028]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      aria-label={`Play audio for ${phrase.text}`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isPlaying
                          ? 'bg-[#8ed5ff] text-[#00354a]'
                          : 'bg-[#262a33] text-[#8ed5ff] group-hover:bg-[#8ed5ff] group-hover:text-[#00354a]'
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {isPlaying ? 'graphic_eq' : 'volume_up'}
                      </span>
                    </button>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-semibold text-[#dfe2ee] leading-snug">
                        &ldquo;{phrase.text}&rdquo;
                      </span>
                      <span className="text-[12px] text-[#bdc8d1] mt-0.5">{phrase.category}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#3e484f]/30"
                      style={{ color: phrase.statusColor || '#8ed5ff', backgroundColor: '#262a33' }}
                    >
                      {phrase.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#262a33] flex items-center justify-center text-[#8ed5ff] mb-1">
              <span className="material-symbols-outlined text-[24px]">bookmark_border</span>
            </div>
            <p className="text-[14px] font-medium text-[#dfe2ee]">Vocabulary Bank is empty</p>
            <p className="text-[12px] text-[#bdc8d1] max-w-xs leading-relaxed">
              When Toki highlights a natural phrase during practice feedback, tap &ldquo;Save Phrase&rdquo; to add it to your personal bank with audio pronunciations.
            </p>
          </div>
        )}
      </section>
      </>)}

      {activeTab === 'transcripts' && (
        <section className="flex flex-col gap-3">
          {selectedTranscript ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTranscript(null)}
                  className="w-9 h-9 rounded-full bg-[#262a33] flex items-center justify-center text-[#bdc8d1] hover:text-[#dfe2ee] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-[#dfe2ee] truncate">{selectedTranscript.objective}</span>
                  <span className="text-[11px] text-[#87929a]">{selectedTranscript.turns?.length || 0} turns</span>
                </div>
              </div>
              <div className="flex flex-col bg-[#181c24] border border-[#3e484f]/25 rounded-2xl p-4 gap-3 max-h-[60vh] overflow-y-auto scrollbar-none">
                {(selectedTranscript.turns || []).map((turn: any, idx: number) => (
                  <div key={idx} className={`flex flex-col gap-0.5 ${turn.speaker === 'learner' ? 'items-end' : 'items-start'}`}>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${turn.speaker === 'learner' ? 'text-[#38bdf8]' : 'text-[#8ed5ff]'}`}>
                      {turn.speaker === 'learner' ? 'You' : 'Toki'}
                    </span>
                    <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                      turn.speaker === 'learner'
                        ? 'bg-[#38bdf8]/15 border border-[#38bdf8]/20 text-[#dfe2ee]'
                        : 'bg-[#262a33] border border-[#3e484f]/30 text-[#bdc8d1]'
                    }`}>
                      {turn.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[16px] font-semibold text-[#dfe2ee]">Session Transcripts</span>
                <span className="text-[12px] text-[#87929a]">Tap to replay</span>
              </div>
              {recentSessions.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {recentSessions.map((session: any) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleViewTranscript(session.id)}
                      className="w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/20 p-4 flex items-center justify-between hover:border-[#8ed5ff]/30 hover:bg-[#1c2028] cursor-pointer active:scale-[0.99] transition-all text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#262a33] flex-shrink-0 flex items-center justify-center text-[#8ed5ff]">
                          <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[14px] font-semibold text-[#dfe2ee] truncate">{session.objective}</span>
                          <span className="text-[12px] text-[#87929a]">{session.turn_count || '?'} turns · {session.duration_minutes || 1} min</span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-[#87929a] flex-shrink-0">chevron_right</span>
                    </button>
                  ))}
                </div>
              ) : loadingTranscript ? (
                <div className="text-center py-8 text-[#87929a] text-[13px]">Loading sessions...</div>
              ) : (
                <div className="w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/20 p-6 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[#87929a] text-[32px]">history_edu</span>
                  <p className="text-[14px] text-[#dfe2ee]">No sessions yet</p>
                  <p className="text-[12px] text-[#87929a]">Complete a practice session to see your conversation transcripts here.</p>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};
