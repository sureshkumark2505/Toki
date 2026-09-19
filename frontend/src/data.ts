import { PracticeMode, SessionFeedbackData, SavedPhrase, UserProfile } from './types';

export const TOKI_BRAND_LOGO = 'https://lh3.googleusercontent.com/aida/AEtjO1V1rTOla20RKuvqlDQUyCMUX1a2JYzHogxtpAsxo7ivImbOTVSuF9d9zXQhrjaeRFi4rIXR0RZRbuLo6ZDNHzagnyGCstBIcdiV7YiOzuyjjpNBCVWRekojDJ4_ExGmOV7MfsHZrxtH9dAs7odQrT-J4ASBFNiyLUjbKWZGALKDfFajw6jidvpbU8ZZdxHYZLzj_pJXlqi0wvoy35N11w-qZ0AkE_UYbD7MhK3d6IbL7ioqd8Dl2MxMQ6j1';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Learner',
  streakDays: 0,
  totalSessions: 0,
  nativeLanguage: 'English & Tamil',
  targetLevel: 'Intermediate (B1/B2)',
  speakingPace: 'Natural (~120 wpm)',
  dailyGoalMins: 10,
  xp: 0,
};

export const PRACTICE_MODES: PracticeMode[] = [
  {
    id: 'daily',
    title: 'Daily Practice',
    badge: 'Today',
    duration: '10 min',
    focus: 'Conversational fluency & phrasing',
    description: 'Personalized warm-up based on your speaking progress.',
    icon: 'calendar_today',
    iconBgColor: 'bg-[#1c2028]',
    accentColor: '#8ed5ff',
    promptTopic: 'your goals for this week and how you plan to achieve them',
  },
  {
    id: 'free',
    title: 'Free Speaking',
    duration: 'Open-ended',
    focus: 'Any topic on your mind',
    description: 'Speak naturally about your day, hobbies, or current thoughts.',
    icon: 'forum',
    iconBgColor: 'bg-[#1c2028]',
    accentColor: '#8ed5ff',
    promptTopic: 'whatever is on your mind today',
  },
  {
    id: 'scenarios',
    title: 'Real-life Scenarios',
    duration: '5–15 min',
    focus: 'Contextual roleplay',
    description: 'Workplace standup, client meetings, travel check-in, and café conversations.',
    icon: 'storefront',
    iconBgColor: 'bg-[#1c2028]',
    accentColor: '#bdc2ff',
    promptTopic: 'Client Project Scope & Timeline',
  },
  {
    id: 'interview',
    title: 'Interview Practice',
    duration: '15 min',
    focus: 'Behavioral & technical',
    description: 'Elevator pitch, STAR conflict questions, and project walkthroughs.',
    icon: 'psychology',
    iconBgColor: 'bg-[#1c2028]',
    accentColor: '#ffc176',
    promptTopic: 'HR Round: Introduction & Fit',
  },
  {
    id: 'debate',
    title: 'Debate & Opinions',
    duration: '12 min',
    focus: 'Persuasive reasoning',
    description: 'Friendly discussions defending your viewpoints and nuances.',
    icon: 'balance',
    iconBgColor: 'bg-[#1c2028]',
    accentColor: '#7bd0ff',
    promptTopic: 'whether remote work improves or strains team connection',
  },
];

export const DEFAULT_FEEDBACK: SessionFeedbackData = {
  sessionTitle: 'Voice Practice Session',
  durationMinutes: 0,
  wordsExchanged: 0,
  coachReflection:
    'Start a practice session to receive live feedback, speaking metrics, and tailored corrections.',
  strengths: [],
  improvement: {
    focusTitle: 'Spontaneous phrasing',
    category: 'Conversational flow',
    insteadOf: '...',
    wrongFragment: '',
    trySaying: 'Speak naturally and express your thoughts with ease.',
    correctFragment: '',
    audioPronunciationText: 'Speak naturally and express your thoughts with ease.',
  },
  microGoal: 'Complete your first practice session to generate personalized goals.',
  drillTopic: 'Daily Speaking Drill',
};

export const SAVED_PHRASES: SavedPhrase[] = [];

export const CASUAL_STARTERS = [
  { icon: '☕', text: 'What did you cook or eat recently?' },
  { icon: '🎬', text: 'Describe a movie or show you enjoyed' },
  { icon: '✈️', text: 'A memorable trip you have taken' },
  { icon: '🪴', text: 'How do you unwind after a busy day?' },
];
