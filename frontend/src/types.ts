export type NavTab = 'home' | 'practice' | 'progress' | 'profile';

export type VoiceState = 'listening' | 'thinking' | 'speaking' | 'paused';

export interface PracticeMode {
  id: string;
  title: string;
  badge?: string;
  duration: string;
  focus: string;
  description: string;
  icon: string;
  iconBgColor?: string;
  accentColor?: string;
  promptTopic?: string;
}

export interface TranscriptItem {
  id: string;
  speaker: 'user' | 'toki';
  text: string;
  highlightedWord?: string;
  coachTip?: string;
  timestamp?: string;
}

export interface SessionFeedbackData {
  sessionId?: number;
  sessionTitle: string;
  durationMinutes: number;
  wordsExchanged: number;
  coachReflection: string;
  strengths: Array<{
    title: string;
    description: string;
    badges?: string[];
  }>;
  improvement: {
    focusTitle: string;
    category: string;
    insteadOf: string;
    wrongFragment: string;
    trySaying: string;
    correctFragment: string;
    audioPronunciationText: string;
  };
  microGoal: string;
  drillTopic: string;
}

export interface SavedPhrase {
  id: string;
  text: string;
  category: string;
  status: string;
  statusColor?: string;
}

export interface UserProfile {
  id?: number;
  name: string;
  streakDays: number;
  totalSessions: number;
  totalMinutes?: number;
  overallFluencyScore?: number;
  nativeLanguage: string;
  targetLevel: string;
  speakingPace: string;
  dailyGoalMins: number;
  goal?: string;
  xp?: number;
  voiceAccent?: string;
  feedbackStyle?: string;
}

export interface BackendSessionHistoryItem {
  id: number;
  kind: string;
  objective: string;
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number;
  turn_count: number;
  fluency_score: number;
  grammar_score: number;
  summary: string;
  strengths: string[];
}

export interface WeeklyDayActivity {
  dayLabel: string;
  fullDate: string;
  isToday: boolean;
  hasActivity: boolean;
  minutes: number;
}
