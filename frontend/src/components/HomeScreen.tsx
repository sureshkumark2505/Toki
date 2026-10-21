import React, { useState, useEffect } from 'react';
import { TokiOrb } from './TokiOrb';
import { CASUAL_STARTERS } from '../data';
import { UserProfile, BackendSessionHistoryItem } from '../types';
import { tokiApi } from '../services/api';

interface HomeScreenProps {
  profile: UserProfile;
  dailyFocusTopic?: string;
  onStartSession: (topic?: string) => void;
  onOpenFeedback: (sessionId?: number | string) => void;
  onViewJournal: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  dailyFocusTopic = 'Conversational fluency & pacing',
  onStartSession,
  onOpenFeedback,
  onViewJournal,
}) => {
  const [recentSessions, setRecentSessions] = useState<BackendSessionHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- Feature: Daily Grammar Challenge ---
  const [dailyChallenge, setDailyChallenge] = useState<{
    title: string;
    pattern: string;
    example: string;
    tip: string;
  } | null>(null);

  // --- Feature: Earned Badges ---
  const [earnedBadges, setEarnedBadges] = useState<Array<{ id: string; name: string; icon: string; description: string }>>([]);

  const primaryTopic = dailyFocusTopic || 'Daily Speaking Warm-up';

  const getTimeGreeting = (name: string) => {
    const hour = new Date().getHours();
    const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${prefix}, ${name || 'Learner'} 👋`;
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const history = await tokiApi.getSessionHistory(profile.id || 1, 4);
        if (mounted) {
          setRecentSessions(history || []);
        }
      } catch (err) {
        console.warn('Could not load recent session history:', err);
      } finally {
        if (mounted) setLoadingHistory(false);
      }

      // Fetch daily grammar challenge
      try {
        const BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${BASE}/api/challenge/today/${profile.id || 1}`);
        if (res.ok) {
          const ch = await res.json();
          if (mounted) setDailyChallenge(ch);
        }
      } catch (e) { /* silent */ }

      // Fetch earned badges
      try {
        const BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
        const userRes = await fetch(`${BASE}/api/user/${profile.id || 1}/badges`);
        if (userRes.ok) {
          const badgeData = await userRes.json();
          if (mounted) setEarnedBadges((badgeData || []).slice(0, 5));
        }
      } catch (e) { /* silent */ }
    }

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [profile.id]);

  return (
    <div className="flex flex-col w-full px-5 pb-28 pt-2 space-y-6 max-w-md mx-auto">
      {/* Greeting & Streak Section */}
      <div className="flex flex-col space-y-1.5 mt-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181c24] text-[#8ed5ff] text-[11px] font-medium border border-[#3e484f]/25 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping" />
            AI Coach Ready
          </span>
          <div className="flex items-center gap-1 text-[#bdc8d1] text-[12px] font-medium">
            <span
              className="material-symbols-outlined text-[17px] text-[#ffc176]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_fire_department
            </span>
            <span className="text-[#dfe2ee] font-semibold">{profile.streakDays}</span> day streak
          </div>
        </div>

        <h1 className="text-[26px] font-bold text-[#dfe2ee] tracking-tight pt-1 leading-snug font-['Plus_Jakarta_Sans']">
          {getTimeGreeting(profile.name)}
        </h1>
        <p className="text-[14px] text-[#bdc8d1] font-normal leading-relaxed">
          {profile.totalSessions > 0
            ? 'Ready to continue building your speaking confidence today?'
            : 'Start speaking with Toki to practice natural English with zero judgement.'}
        </p>

        {/* Earned Badges Row */}
        {earnedBadges.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-1">
            {earnedBadges.map((badge) => (
              <span
                key={badge.id}
                title={badge.description}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#262a33] border border-[#3e484f]/30 text-[11px] text-[#dfe2ee]"
              >
                <span>{badge.icon}</span>
                <span className="font-medium">{badge.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary Focal Hero Card with Ambient Orb Resonance */}
      <div
        id="hero-session-card"
        className="relative w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/30 p-5 overflow-hidden shadow-xl group transition-all duration-300 hover:border-[#8ed5ff]/40"
      >
        {/* Ambient Radial Glows */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#38bdf8]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-60 h-60 rounded-full bg-[#2f3aa3]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col space-y-4">
          {/* Focus Tag & Duration Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#262a33] text-[#dfe2ee] text-[12px] font-medium border border-[#3e484f]/40">
              <span>🎯</span>
              <span>
                Today&apos;s focus: <strong className="text-[#8ed5ff] font-semibold">{primaryTopic}</strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c2028] text-[#bdc8d1] text-[12px] font-medium">
              <span>⚡</span>
              <span>{profile.dailyGoalMins || 10} min target</span>
            </span>
          </div>

          {/* Atmospheric Central Orb Anchor */}
          <div className="flex flex-col items-center justify-center py-3">
            <TokiOrb
              size="md"
              state="speaking"
              centerIcon="mic"
              onClick={() => onStartSession(primaryTopic)}
            />
            <p className="text-[12px] text-[#bdc8d1] mt-3 tracking-wide text-center">
              Tap the voice core or start below
            </p>
          </div>

          {/* Action Primary Button */}
          <button
            id="start-speaking-main-btn"
            type="button"
            onClick={() => onStartSession(primaryTopic)}
            className="w-full h-14 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#8ed5ff] to-[#7bd0ff] text-[#00354a] font-['Plus_Jakarta_Sans'] text-[16px] font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-[#38bdf8]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
            <span>Start Speaking</span>
          </button>
        </div>
      </div>

      {/* Daily Coach Insight */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold font-['Plus_Jakarta_Sans']">
            Coach Insight
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#ffc176]">
            auto_awesome
          </span>
        </div>
        <div className="w-full rounded-2xl bg-[#1c2028] border border-[#3e484f]/25 p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f1a02b]/20 flex-shrink-0 flex items-center justify-center mt-0.5 text-[#ffc176]">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                psychology
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#dfe2ee] leading-relaxed">
                {profile.streakDays > 0
                  ? `Great streak of ${profile.streakDays} days! Consistency strengthens automatic grammatical patterns and speech rhythm.`
                  : 'Speaking confidence grows each time you express your thoughts aloud without pausing to translate. Begin anytime!'}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[12px] text-[#bdc8d1]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ffc176]" />
                <span>Level: {profile.targetLevel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Grammar Challenge */}
      {dailyChallenge && (
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold">
              Daily Challenge
            </span>
            <span className="material-symbols-outlined text-[16px] text-[#bdc2ff]">emoji_events</span>
          </div>
          <div className="w-full rounded-2xl bg-[#1c2028] border border-[#bdc2ff]/20 p-4 relative overflow-hidden shadow-sm">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-[#bdc2ff]/10 blur-2xl pointer-events-none" />
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-[#bdc2ff]/15 flex-shrink-0 flex items-center justify-center mt-0.5">
                <span className="material-symbols-outlined text-[#bdc2ff] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  school
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[14px] font-bold text-[#dfe2ee]">{dailyChallenge.title}</span>
                  <span className="text-[10px] text-[#bdc2ff] bg-[#bdc2ff]/10 border border-[#bdc2ff]/20 px-2 py-0.5 rounded-full font-medium">Today</span>
                </div>
                <p className="text-[12px] text-[#87929a] mb-2 font-mono bg-[#0f131c]/50 rounded-lg px-2 py-1 border border-[#3e484f]/30">
                  Pattern: {dailyChallenge.pattern}
                </p>
                <p className="text-[13px] text-[#bdc8d1] leading-relaxed italic">
                  &ldquo;{dailyChallenge.example}&rdquo;
                </p>
                <p className="text-[11px] text-[#ffc176] mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">lightbulb</span>
                  {dailyChallenge.tip}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onStartSession(`Daily Challenge: ${dailyChallenge.title}`)}
              className="w-full mt-3 h-9 rounded-full bg-[#bdc2ff]/15 border border-[#bdc2ff]/30 text-[#bdc2ff] text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#bdc2ff]/25 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">play_circle</span>
              Practice this pattern now
            </button>
          </div>
        </div>
      )}

      {/* Recent Practice Section */}
      <div className="flex flex-col space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold">
            Recent Practice
          </span>
          {recentSessions.length > 0 && (
            <button
              type="button"
              onClick={onViewJournal}
              className="text-[12px] text-[#8ed5ff] hover:underline font-medium cursor-pointer"
            >
              View all
            </button>
          )}
        </div>

        {recentSessions.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                id={`recent-session-${session.id}`}
                onClick={() => onOpenFeedback(session.id)}
                className="w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/20 p-4 flex items-center justify-between transition-colors hover:bg-[#1c2028] hover:border-[#8ed5ff]/30 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#262a33] flex-shrink-0 flex items-center justify-center text-[#8ed5ff]">
                    <span className="material-symbols-outlined text-[20px]">
                      {session.kind === 'interview'
                        ? 'psychology'
                        : session.kind === 'scenario'
                        ? 'storefront'
                        : 'chat_bubble'}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold text-[#dfe2ee] truncate">
                      {session.objective}
                    </span>
                    <div className="flex items-center gap-2 text-[#bdc8d1] text-[12px] mt-0.5">
                      <span>{formatRelativeTime(session.started_at)}</span>
                      <span>·</span>
                      <span>{session.duration_minutes || 1} min</span>
                      {session.turn_count > 0 && (
                        <>
                          <span>·</span>
                          <span>{session.turn_count} turns</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#8ed5ff]/15 text-[#8ed5ff] text-[11px] font-semibold">
                    {session.fluency_score || 75}%
                  </span>
                  <span className="text-[11px] text-[#bdc8d1] mt-1">Fluency</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#262a33] flex items-center justify-center text-[#8ed5ff] mb-1">
              <span className="material-symbols-outlined text-[24px]">history_edu</span>
            </div>
            <p className="text-[14px] font-medium text-[#dfe2ee]">No practice sessions yet</p>
            <p className="text-[12px] text-[#bdc8d1] max-w-xs leading-relaxed">
              Complete your first speaking warm-up above to view turn-by-turn analysis and fluency scores.
            </p>
          </div>
        )}
      </div>

      {/* Warm Conversational Prompt Chips */}
      <div className="flex flex-col space-y-2 pt-1">
        <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider px-1 font-semibold">
          Or pick a casual starter
        </span>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {CASUAL_STARTERS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onStartSession(item.text)}
              className="whitespace-nowrap px-4 py-2.5 rounded-full bg-[#1c2028] border border-[#3e484f]/30 text-[#dfe2ee] text-[13px] hover:bg-[#262a33] hover:border-[#8ed5ff]/40 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-sm"
            >
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
