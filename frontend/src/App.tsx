import React, { useState, useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { PracticeModesScreen } from './components/PracticeModesScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ActiveSessionScreen } from './components/ActiveSessionScreen';
import { SessionFeedbackScreen } from './components/SessionFeedbackScreen';
import { DEFAULT_PROFILE, DEFAULT_FEEDBACK } from './data';
import { NavTab, PracticeMode, SessionFeedbackData, UserProfile } from './types';
import { tokiApi } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [userId] = useState<number>(1);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyFocus, setDailyFocus] = useState<string>('Past tense & conversational fluency');
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>(undefined);
  const [sessionTopic, setSessionTopic] = useState<string>('Daily Warm-up: Past Tense');
  const [sessionOpening, setSessionOpening] = useState<string | undefined>(undefined);
  const [isFeedbackActive, setIsFeedbackActive] = useState<boolean>(false);
  const [feedbackData, setFeedbackData] = useState<SessionFeedbackData>(DEFAULT_FEEDBACK);

  // Load initial user profile and today's plan on mount
  useEffect(() => {
    async function initUserContext() {
      try {
        const [profileRes, planRes] = await Promise.allSettled([
          tokiApi.getUserProfile(userId),
          tokiApi.getTodayPlan(userId),
        ]);

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const p = profileRes.value;
          setProfile((prev) => ({
            ...prev,
            name: p.name || prev.name,
            nativeLanguage: p.native_language || prev.nativeLanguage,
            targetLevel: p.target_level || prev.targetLevel,
            dailyGoalMins: p.daily_goal_mins || prev.dailyGoalMins,
            speakingPace: p.speaking_pace || prev.speakingPace,
            streakDays: p.streak_days ?? prev.streakDays,
            totalSessions: p.total_sessions ?? prev.totalSessions,
            totalMinutes: p.total_minutes ?? prev.totalMinutes,
            overallFluencyScore: p.overall_fluency_score ?? prev.overallFluencyScore,
          }));
        }

        if (planRes.status === 'fulfilled' && planRes.value) {
          const task = planRes.value.tasks?.[0];
          if (task?.title) {
            setDailyFocus(task.title);
          }
        }
      } catch (err) {
        console.warn('Initial context load failed, continuing with current state:', err);
      }
    }

    initUserContext();
  }, [userId]);

  // Start voice practice session (connecting with backend)
  const handleStartSession = async (topic?: string) => {
    const chosenTopic = topic || 'Daily Warm-up: Past Tense';
    setSessionTopic(chosenTopic);
    setIsFeedbackActive(false);

    try {
      const sessionData = await tokiApi.startSession(userId, chosenTopic);
      setCurrentSessionId(sessionData.session_id);
      setSessionOpening(sessionData.opening);
    } catch (err) {
      console.warn('Backend start session failed, falling back to local mode:', err);
      setCurrentSessionId(undefined);
      setSessionOpening(`Welcome to our session on ${chosenTopic}. Whenever you are ready, please start speaking!`);
    }

    setIsSessionActive(true);
  };

  // End voice practice session and transition to feedback
  const handleEndSession = (feedback: SessionFeedbackData) => {
    setIsSessionActive(false);
    setFeedbackData(feedback);
    setIsFeedbackActive(true);
  };

  // Select practice mode
  const handleSelectMode = (mode: PracticeMode) => {
    handleStartSession(`${mode.title}: ${mode.focus}`);
  };

  // Open feedback modal directly from recent practice history
  const handleOpenFeedback = async (sessionId?: string) => {
    if (sessionId) {
      const numId = parseInt(sessionId, 10);
      if (!isNaN(numId)) {
        try {
          const report = await tokiApi.getSessionFeedback(numId);
          if (report) {
            setFeedbackData(tokiApi.formatReportToFeedbackData ? tokiApi.formatReportToFeedbackData(report) : DEFAULT_FEEDBACK);
            setIsFeedbackActive(true);
            return;
          }
        } catch (err) {
          console.warn('Could not fetch server session feedback, using default fallback:', err);
        }
      }
    }
    setFeedbackData(DEFAULT_FEEDBACK);
    setIsFeedbackActive(true);
  };

  // Start targeted 2-min drill from feedback screen
  const handlePracticeDrill = (topic: string) => {
    setIsFeedbackActive(false);
    handleStartSession(`Targeted Drill: ${topic}`);
  };

  const getSubTitle = () => {
    switch (currentTab) {
      case 'home':
        return 'Home';
      case 'practice':
        return 'Practice';
      case 'progress':
        return 'Progress';
      case 'profile':
        return 'Profile';
    }
  };

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Active Fullscreen Voice Practice Session Screen (Clean Minimal 55/40 layout) */}
      {isSessionActive && (
        <ActiveSessionScreen
          sessionId={currentSessionId}
          initialTopic={sessionTopic}
          initialOpening={sessionOpening}
          userId={userId}
          onEndSession={handleEndSession}
          onMinimize={() => setIsSessionActive(false)}
        />
      )}

      {/* Session Feedback Screen */}
      {isFeedbackActive && !isSessionActive && (
        <SessionFeedbackScreen
          data={feedbackData}
          userName={profile.name}
          userId={userId}
          onDone={() => {
            setIsFeedbackActive(false);
            setCurrentTab('progress');
          }}
          onPracticeDrill={handlePracticeDrill}
        />
      )}

      {/* Standard App Shell */}
      {!isSessionActive && !isFeedbackActive && (
        <>
          <TopHeader
            subTitle={getSubTitle()}
            onProfileClick={() => setCurrentTab('profile')}
            onMicStatusClick={() => handleStartSession('Quick Voice Check')}
            activeMic={isSessionActive}
          />

          <main className="flex-1 w-full pt-16">
            {currentTab === 'home' && (
              <HomeScreen
                profile={profile}
                dailyFocusTopic={dailyFocus}
                onStartSession={handleStartSession}
                onOpenFeedback={handleOpenFeedback}
                onViewJournal={() => setCurrentTab('progress')}
              />
            )}

            {currentTab === 'practice' && (
              <PracticeModesScreen onSelectMode={handleSelectMode} />
            )}

            {currentTab === 'progress' && <ProgressScreen userId={userId} />}

            {currentTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                userId={userId}
                onUpdateProfile={(updated) => setProfile((p) => ({ ...p, ...updated }))}
                onStartSession={handleStartSession}
              />
            )}
          </main>

          <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
        </>
      )}
    </div>
  );
}
