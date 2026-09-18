"use client";
import { useEffect, useRef, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Reply = {
  reply: string;
  correction?: string | null;
  explanation?: string | null;
  next_prompt: string;
};

type Assessment = {
  level: string;
  scores: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
};

type Task = {
  title: string;
  kind: string;
  minutes: number;
  instruction: string;
};

type TranslationPrompt = {
  id: number;
  tamil_prompt: string;
  english_reference: string;
  target_pattern: string;
};

type TranslationResult = {
  natural_english: string;
  feedback: string;
  explanation: string;
  accuracy_score: number;
  better_alternatives: string[];
};

type ReviewItem = {
  id: number;
  category: string;
  original: string;
  correction: string;
  explanation: string;
  mastery: number;
  frequency: number;
};

type ReviewResult = {
  is_correct: boolean;
  mastery: number;
  next_review_days: number;
  coach_feedback: string;
  model_sentence: string;
};

type VocabItem = {
  id: number;
  word_or_phrase: string;
  meaning: string;
  example: string;
  learner_usage?: string;
  mastery: number;
};

type SessionReport = {
  session_id: number;
  summary: string;
  turn_count: number;
  scores: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
  };
  strengths: string[];
  key_corrections: { original: string; correction: string; explanation: string }[];
  vocabulary_captured: { word: string; meaning: string; example: string }[];
  recommended_exercise: string;
};

// Phase 5 Types
type ScenarioItem = {
  id: number;
  title: string;
  category: string;
  level: string;
  role: string;
  learner_role: string;
  objective: string;
  description: string;
  initial_prompt: string;
  difficulty: string;
};

type ScenarioTurn = {
  speaker: "learner" | "role";
  text: string;
  roleName?: string;
  coachingTip?: string | null;
};

type ScenarioReport = {
  session_id: number;
  scenario_title: string;
  communication_score: number;
  scores: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
  };
  strengths: string[];
  improvements: string[];
  summary: string;
};

type InterviewAttempt = {
  id: number;
  attempt_number: number;
  interview_type: string;
  scores: {
    clarity: number;
    structure: number;
    conciseness: number;
    confidence: number;
    vocabulary: number;
    grammar: number;
  };
  summary: string;
  strengths: string[];
  improvements: string[];
  created_at: string;
};

type InterviewComparison = {
  attempt_1: InterviewAttempt;
  attempt_2: InterviewAttempt;
  score_diffs: Record<string, number>;
  key_gains: string[];
  remaining_focus: string[];
  coach_verdict: string;
};

type ExtemporeTopic = {
  id: number;
  category: string;
  topic: string;
  guidance_questions: string[];
};

type ExtemporeResult = {
  topic: string;
  duration_seconds: number;
  word_count: number;
  estimated_wpm: number;
  scores: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
  };
  structure_feedback: {
    introduction: string;
    body: string;
    conclusion: string;
  };
  filler_words_detected: { filler: string; count: number }[];
  strengths: string[];
  improvements: string[];
  recommended_exercise: string;
};

// Phase 6 & 7 Types
type ListeningQuestion = {
  question: string;
  options: string[];
  correct_idx: number;
  explanation: string;
};

type ListeningExercise = {
  id: number;
  title: string;
  category: string;
  level: string;
  audio_script: string;
  questions: ListeningQuestion[];
  dictation_sentence: string;
  difficulty: string;
};

type ListeningEvaluation = {
  exercise_id: number;
  score: number;
  total_questions: number;
  correct_count: number;
  explanations: string[];
  feedback: string;
  xp_earned: number;
};

type WordDiff = {
  word: string;
  status: "correct" | "missing" | "extra" | "typo";
};

type DictationEvaluation = {
  accuracy_score: number;
  word_diffs: WordDiff[];
  feedback: string;
  correct_transcription: string;
  xp_earned: number;
};

type ProgressDashboardData = {
  overall_score: number;
  level: string;
  current_scores: Record<string, number>;
  baseline_scores: Record<string, number>;
  score_changes: Record<string, number>;
  total_speaking_minutes: number;
  sessions_completed: number;
  streak_days: number;
  xp: number;
  badges: { name: string; icon: string; desc: string }[];
  recurring_mistakes_count: number;
  words_mastered_count: number;
};

type WeeklyTrendData = {
  user_id: number;
  daily_trends: {
    date: string;
    fluency: number;
    grammar: number;
    vocab: number;
    clarity: number;
    listening: number;
    confidence: number;
    overall_score: number;
  }[];
  total_minutes_week: number;
  consistency_rate: number;
  coach_weekly_summary: string;
};

type ProgressReportData = {
  user_id: number;
  period: string;
  summary: string;
  strengths: string[];
  key_growth_areas: string[];
  baseline_vs_current: Record<string, number>;
  recommended_next_goals: string[];
};

type UserSettings = {
  user_id?: number;
  coach_voice: string;
  speech_pace: number;
  correction_style: string;
  explanation_language: string;
  audio_retention_days: number;
  sound_effects_enabled: boolean;
};

export default function Home() {
  const [name, setName] = useState("");
  const [user, setUser] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "home" | "coach" | "scenarios" | "interview" | "extempore" | "listening" | "translation" | "review" | "vocabulary" | "progress" | "report" | "settings"
  >("home");
  const [view, setView] = useState<"welcome" | "assessment" | "app">("welcome");

  // User Stats
  const [userXP, setUserXP] = useState(150);
  const [userStreak, setUserStreak] = useState(1);

  // Phase 8: Settings & Privacy State
  const [settings, setSettings] = useState<UserSettings>({
    coach_voice: "Natural US (Standard)",
    speech_pace: 1.0,
    correction_style: "Balanced & Encouraging",
    explanation_language: "Tamil",
    audio_retention_days: 7,
    sound_effects_enabled: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [exportingData, setExportingData] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  // Assessment State
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  // Daily Plan State
  const [planMinutes, setPlanMinutes] = useState(20);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [planReason, setPlanReason] = useState("");

  // Live Coaching State
  const [session, setSession] = useState<number | null>(null);
  const [sessionObjective, setSessionObjective] = useState("Daily speaking practice");
  const [turnCount, setTurnCount] = useState(0);
  const [reply, setReply] = useState<Reply | null>(null);
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);

  // Phase 5: Scenarios State
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [scenarioCategory, setScenarioCategory] = useState<string>("All");
  const [activeScenario, setActiveScenario] = useState<ScenarioItem | null>(null);
  const [scenarioSessionId, setScenarioSessionId] = useState<number | null>(null);
  const [scenarioTurns, setScenarioTurns] = useState<ScenarioTurn[]>([]);
  const [scenarioReport, setScenarioReport] = useState<ScenarioReport | null>(null);
  const [scenarioTurnLoading, setScenarioTurnLoading] = useState(false);

  // Phase 5: Interview Coach State
  const interviewOptions = [
    { title: "HR Round: Introduction & Fit", desc: "Elevator pitch, background, and cultural fit" },
    { title: "Behavioral: Team Conflict (STAR)", desc: "Situation, Task, Action, and Result structured response" },
    { title: "Technical: Complex Project", desc: "Architectural overview, tradeoffs, and impact metrics" },
    { title: "HR: Salary & Compensation", desc: "Diplomatic package negotiation and market value positioning" }
  ];
  const [selectedInterviewType, setSelectedInterviewType] = useState(interviewOptions[0].title);
  const [targetRole, setTargetRole] = useState("Software Professional");
  const [interviewSessionId, setInterviewSessionId] = useState<number | null>(null);
  const [interviewAttemptNumber, setInterviewAttemptNumber] = useState(1);
  const [interviewTurns, setInterviewTurns] = useState<{ speaker: string; text: string }[]>([]);
  const [interviewAttempts, setInterviewAttempts] = useState<InterviewAttempt[]>([]);
  const [interviewEndReport, setInterviewEndReport] = useState<InterviewAttempt | null>(null);
  const [compareId1, setCompareId1] = useState<number | null>(null);
  const [compareId2, setCompareId2] = useState<number | null>(null);
  const [comparisonResult, setComparisonResult] = useState<InterviewComparison | null>(null);
  const [comparing, setComparing] = useState(false);

  // Phase 5: Extempore State
  const [extemporeTopics, setExtemporeTopics] = useState<ExtemporeTopic[]>([]);
  const [topicIdx, setTopicIdx] = useState(0);
  const [extemporeDuration, setExtemporeDuration] = useState(60);
  const [timerRemaining, setTimerRemaining] = useState(60);
  const [isExtemporeActive, setIsExtemporeActive] = useState(false);
  const [extemporeResult, setExtemporeResult] = useState<ExtemporeResult | null>(null);
  const [evaluatingExtempore, setEvaluatingExtempore] = useState(false);
  const timerRef = useRef<any>(null);

  // Phase 6: Listening & Dictation State
  const [listeningExercises, setListeningExercises] = useState<ListeningExercise[]>([]);
  const [listeningIdx, setListeningIdx] = useState(0);
  const [listeningMode, setListeningMode] = useState<"comprehension" | "dictation">("comprehension");
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, number>>({});
  const [listeningResult, setListeningResult] = useState<ListeningEvaluation | null>(null);
  const [evaluatingListening, setEvaluatingListening] = useState(false);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationResult, setDictationResult] = useState<DictationEvaluation | null>(null);
  const [evaluatingDictation, setEvaluatingDictation] = useState(false);

  // Phase 7: Progress & Analytics State
  const [progressData, setProgressData] = useState<ProgressDashboardData | null>(null);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrendData | null>(null);
  const [progressReport, setProgressReport] = useState<ProgressReportData | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Tamil -> English Translation State
  const [translationPrompts, setTranslationPrompts] = useState<TranslationPrompt[]>([]);
  const [transIdx, setTransIdx] = useState(0);
  const [transResult, setTransResult] = useState<TranslationResult | null>(null);
  const [evaluatingTrans, setEvaluatingTrans] = useState(false);

  // Spaced Repetition Review State
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

  // Vocabulary Bank State
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);

  // Speech & Input State
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.lang = "en-IN";
    r.interimResults = true;
    r.onresult = (e: any) => setText(Array.from(e.results).map((x: any) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      setError("Microphone access was unavailable. You can type your answer instead.");
    };
    rec.current = r;
  }, []);

  const speak = (message: string, rate = 0.95) => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(message);
      u.rate = rate;
      speechSynthesis.speak(u);
    }
  };

  const mic = () => {
    if (!rec.current) {
      setError("Speech recognition is unsupported in this browser. Type your answer.");
      return;
    }
    if (listening) {
      rec.current.stop();
      setListening(false);
    } else {
      setError("");
      rec.current.start();
      setListening(true);
    }
  };

  // 1. Onboarding
  async function onboard() {
    try {
      const r = await fetch(api + "/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, native_language: "Tamil", goal: "Communication", daily_minutes: planMinutes })
      });
      const j = await r.json();
      setUser(j.user_id);
      const a = await fetch(api + "/api/assessment/start");
      const data = await a.json();
      setPrompts(data.prompts || []);
      setView("assessment");
    } catch (err) {
      setError("Unable to connect to coach backend. Ensure server is running.");
    }
  }

  // 2. Assessment Steps
  function saveAnswer() {
    if (!text.trim()) return;
    const next = [...answers, text];
    setAnswers(next);
    setText("");
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    completeAssessment(next);
  }

  async function completeAssessment(finalAnswers: string[]) {
    if (!user) return;
    setError("Analyzing your speech and creating personalized profile…");
    try {
      const r = await fetch(api + "/api/assessment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          answers: finalAnswers.map((transcript, prompt_id) => ({ prompt_id, transcript }))
        })
      });
      const result = await r.json();
      setAssessment(result);
      await loadPlan(user, planMinutes);
      await loadScenarios();
      await loadExtemporeTopics();
      await loadListeningExercises();
      await loadInterviewAttempts(user);
      await loadTranslationPrompts();
      await loadReviews(user);
      await loadVocabulary(user);
      await loadProgress(user);
      setError("");
      setView("app");
      setActiveTab("home");
    } catch (e) {
      setError("Assessment calculation error. Please try again.");
    }
  }

  // 3. Plan Generation
  async function loadPlan(userId: number, minutes: number) {
    try {
      const p = await fetch(`${api}/api/plan/generate?user_id=${userId}&minutes=${minutes}`, { method: "POST" });
      const plan = await p.json();
      setTasks(plan.tasks || []);
      setPlanReason(plan.generated_reason || "");
    } catch (e) {
      console.error(e);
    }
  }

  // 4. Guided Session Controls
  async function beginSession(objectiveText?: string) {
    if (!user) return;
    const obj = objectiveText || tasks.find((t) => t.kind === "guided")?.instruction || "Describe your typical day clearly using complete sentences.";
    setSessionObjective(obj);
    try {
      const r = await fetch(api + "/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, kind: "guided", objective: obj })
      });
      const j = await r.json();
      setSession(j.session_id);
      setTurnCount(0);
      setReply({ reply: j.opening, next_prompt: "What do you do first in the morning?" });
      speak(j.opening);
      setActiveTab("coach");
    } catch (e) {
      setError("Could not start session.");
    }
  }

  async function sendTurn() {
    if (!text.trim() || !session) return;
    setError("");
    const sentText = text;
    setText("");
    try {
      const r = await fetch(`${api}/api/sessions/${session}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: sentText })
      });
      if (!r.ok) {
        setError("Coach unavailable. Please retry.");
        return;
      }
      const j = await r.json();
      setReply(j);
      setTurnCount((prev) => prev + 1);
      speak(j.reply);
      setUserXP((prev) => prev + 15);
      if (user) loadReviews(user);
    } catch (e) {
      setError("Failed to send answer.");
    }
  }

  async function endSession() {
    if (!session) return;
    try {
      const r = await fetch(`${api}/api/sessions/${session}/end`, { method: "POST" });
      const rep = await r.json();
      setSessionReport(rep);
      setActiveTab("report");
      setUserXP((prev) => prev + 50);
      if (user) {
        loadVocabulary(user);
        loadReviews(user);
        loadProgress(user);
      }
    } catch (e) {
      setError("Could not generate session report.");
    }
  }

  // 5. Phase 5: Scenarios
  async function loadScenarios(cat?: string) {
    try {
      const url = cat && cat !== "All" ? `${api}/api/scenarios?category=${encodeURIComponent(cat)}` : `${api}/api/scenarios`;
      const r = await fetch(url);
      const data = await r.json();
      setScenarios(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function startScenario(scenario: ScenarioItem) {
    if (!user) return;
    setError("");
    setActiveScenario(scenario);
    setScenarioReport(null);
    setText("");
    try {
      const r = await fetch(`${api}/api/scenarios/${scenario.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, scenario_id: scenario.id })
      });
      const data = await r.json();
      setScenarioSessionId(data.session_id);
      setScenarioTurns([{ speaker: "role", text: data.opening, roleName: scenario.role }]);
      speak(data.opening);
    } catch (e) {
      setError("Could not start roleplay scenario.");
    }
  }

  async function sendScenarioTurn() {
    if (!text.trim() || !scenarioSessionId || !activeScenario) return;
    setError("");
    setScenarioTurnLoading(true);
    const spoken = text;
    setText("");
    setScenarioTurns((prev) => [...prev, { speaker: "learner", text: spoken }]);
    try {
      const r = await fetch(`${api}/api/scenarios/${scenarioSessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: spoken })
      });
      const data = await r.json();
      setScenarioTurns((prev) => [
        ...prev,
        { speaker: "role", text: data.reply, roleName: data.role_character || activeScenario.role, coachingTip: data.coaching_tip }
      ]);
      speak(data.reply);
      setUserXP((prev) => prev + 20);
    } catch (e) {
      setError("Roleplay response failed.");
    } finally {
      setScenarioTurnLoading(false);
    }
  }

  async function endScenario() {
    if (!scenarioSessionId) return;
    try {
      const r = await fetch(`${api}/api/scenarios/${scenarioSessionId}/end`, { method: "POST" });
      const rep = await r.json();
      setScenarioReport(rep);
      setUserXP((prev) => prev + 60);
      if (user) loadProgress(user);
    } catch (e) {
      setError("Failed to complete scenario scorecard.");
    }
  }

  // 6. Phase 5: Interview Coach
  async function loadInterviewAttempts(userId: number) {
    try {
      const r = await fetch(`${api}/api/interview/attempts/${userId}`);
      const data = await r.json();
      setInterviewAttempts(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function startInterview() {
    if (!user) return;
    setError("");
    setInterviewEndReport(null);
    setComparisonResult(null);
    setText("");
    try {
      const r = await fetch(`${api}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, interview_type: selectedInterviewType, target_role: targetRole })
      });
      const data = await r.json();
      setInterviewSessionId(data.session_id);
      setInterviewAttemptNumber(data.attempt_number);
      setInterviewTurns([{ speaker: "interviewer", text: data.opening }]);
      speak(data.opening);
    } catch (e) {
      setError("Failed to start interview practice.");
    }
  }

  async function sendInterviewTurn() {
    if (!text.trim() || !interviewSessionId) return;
    setError("");
    const spoken = text;
    setText("");
    setInterviewTurns((prev) => [...prev, { speaker: "candidate", text: spoken }]);
    try {
      const r = await fetch(`${api}/api/sessions/${interviewSessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: spoken })
      });
      const data = await r.json();
      setInterviewTurns((prev) => [...prev, { speaker: "interviewer", text: data.reply }]);
      speak(data.reply);
      setUserXP((prev) => prev + 25);
    } catch (e) {
      setError("Interview reply failed.");
    }
  }

  async function endInterview() {
    if (!interviewSessionId) return;
    try {
      const r = await fetch(`${api}/api/interview/${interviewSessionId}/end?target_role=${encodeURIComponent(targetRole)}`, {
        method: "POST"
      });
      const data = await r.json();
      setInterviewEndReport(data);
      setUserXP((prev) => prev + 75);
      if (user) {
        loadInterviewAttempts(user);
        loadProgress(user);
      }
    } catch (e) {
      setError("Failed to generate interview report.");
    }
  }

  async function runInterviewComparison() {
    if (!user || !compareId1 || !compareId2) return;
    setComparing(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/interview/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, attempt_id_1: compareId1, attempt_id_2: compareId2 })
      });
      const data = await r.json();
      setComparisonResult(data);
    } catch (e) {
      setError("Comparison failed. Select two valid attempts.");
    } finally {
      setComparing(false);
    }
  }

  // 7. Phase 5: Extempore
  async function loadExtemporeTopics() {
    try {
      const r = await fetch(`${api}/api/extempore/topics`);
      const data = await r.json();
      setExtemporeTopics(data);
    } catch (e) {
      console.error(e);
    }
  }

  function startExtemporeTimer() {
    if (isExtemporeActive) return;
    setIsExtemporeActive(true);
    setTimerRemaining(extemporeDuration);
    setExtemporeResult(null);
    setText("");

    if (rec.current) {
      try {
        rec.current.start();
        setListening(true);
      } catch (e) {}
    }

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsExtemporeActive(false);
          if (rec.current) {
            try {
              rec.current.stop();
              setListening(false);
            } catch (e) {}
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopExtemporeTimer() {
    clearInterval(timerRef.current);
    setIsExtemporeActive(false);
    if (rec.current) {
      try {
        rec.current.stop();
        setListening(false);
      } catch (e) {}
    }
  }

  async function evaluateExtempore() {
    if (!text.trim() || !user || !extemporeTopics[topicIdx]) return;
    setEvaluatingExtempore(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/extempore/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          topic: extemporeTopics[topicIdx].topic,
          duration_seconds: extemporeDuration - timerRemaining || extemporeDuration,
          transcript: text
        })
      });
      const data = await r.json();
      setExtemporeResult(data);
      setUserXP((prev) => prev + 40);
      if (user) loadProgress(user);
    } catch (e) {
      setError("Extempore evaluation failed.");
    } finally {
      setEvaluatingExtempore(false);
    }
  }

  // 8. PHASE 6: LISTENING & DICTATION
  async function loadListeningExercises() {
    try {
      const r = await fetch(`${api}/api/listening/exercises`);
      const data = await r.json();
      setListeningExercises(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function submitListeningQuiz() {
    if (!user || !listeningExercises[listeningIdx]) return;
    const current = listeningExercises[listeningIdx];
    const answersList = current.questions.map((_, i) => selectedQuizAnswers[i] ?? -1);
    setEvaluatingListening(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/listening/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          exercise_id: current.id,
          selected_answers: answersList
        })
      });
      const data = await r.json();
      setListeningResult(data);
      setUserXP((prev) => prev + (data.xp_earned || 30));
      if (user) loadProgress(user);
    } catch (e) {
      setError("Listening quiz evaluation failed.");
    } finally {
      setEvaluatingListening(false);
    }
  }

  async function submitDictation() {
    if (!user || !dictationInput.trim() || !listeningExercises[listeningIdx]) return;
    const current = listeningExercises[listeningIdx];
    setEvaluatingDictation(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/dictation/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          exercise_id: current.id,
          original_text: current.dictation_sentence,
          learner_input: dictationInput
        })
      });
      const data = await r.json();
      setDictationResult(data);
      setUserXP((prev) => prev + (data.xp_earned || 25));
      if (user) loadProgress(user);
    } catch (e) {
      setError("Dictation evaluation failed.");
    } finally {
      setEvaluatingDictation(false);
    }
  }

  // 9. PHASE 7: PROGRESS & ANALYTICS
  async function loadProgress(userId: number) {
    setLoadingProgress(true);
    try {
      const [pRes, wRes, rRes] = await Promise.all([
        fetch(`${api}/api/progress/${userId}`),
        fetch(`${api}/api/progress/weekly/${userId}`),
        fetch(`${api}/api/progress/report/${userId}`)
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        setProgressData(pData);
        setUserXP(pData.xp);
        setUserStreak(pData.streak_days);
      }
      if (wRes.ok) {
        setWeeklyTrends(await wRes.json());
      }
      if (rRes.ok) {
        setProgressReport(await rRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProgress(false);
    }
  }

  // 10. Tamil -> English Drills
  async function loadTranslationPrompts() {
    try {
      const r = await fetch(api + "/api/translation/prompts");
      const data = await r.json();
      setTranslationPrompts(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function evaluateTranslation() {
    if (!text.trim() || !user || !translationPrompts[transIdx]) return;
    setEvaluatingTrans(true);
    setError("");
    try {
      const p = translationPrompts[transIdx];
      const r = await fetch(api + "/api/translation/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          tamil_prompt: p.tamil_prompt,
          learner_english: text,
          target_pattern: p.target_pattern
        })
      });
      const data = await r.json();
      setTransResult(data);
      speak(data.natural_english);
      setUserXP((prev) => prev + 20);
    } catch (e) {
      setError("Translation evaluation failed.");
    } finally {
      setEvaluatingTrans(false);
    }
  }

  // 11. Spaced Repetition Review
  async function loadReviews(userId: number) {
    try {
      const r = await fetch(`${api}/api/review/due/${userId}`);
      const data = await r.json();
      setDueReviews(data);
      setReviewIdx(0);
      setReviewResult(null);
    } catch (e) {
      console.error(e);
    }
  }

  async function answerReview() {
    if (!text.trim() || !dueReviews[reviewIdx]) return;
    const current = dueReviews[reviewIdx];
    try {
      const r = await fetch(`${api}/api/review/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistake_id: current.id, spoken_correction: text })
      });
      const data = await r.json();
      setReviewResult(data);
      setText("");
      speak(data.coach_feedback);
      setUserXP((prev) => prev + 25);
    } catch (e) {
      setError("Failed to record review answer.");
    }
  }

  // 12. Vocabulary Bank
  async function loadVocabulary(userId: number) {
    try {
      const r = await fetch(`${api}/api/vocabulary/${userId}`);
      const data = await r.json();
      setVocabList(data);
    } catch (e) {
      console.error(e);
    }
  }

  // 13. Phase 8: Settings, Data Export & Privacy Handlers
  async function loadSettings(userId: number) {
    try {
      const r = await fetch(`${api}/api/settings/${userId}`);
      if (r.ok) {
        const data = await r.json();
        setSettings({
          coach_voice: data.coach_voice || "Natural US (Standard)",
          speech_pace: data.speech_pace ?? 1.0,
          correction_style: data.correction_style || "Balanced & Encouraging",
          explanation_language: data.explanation_language || "Tamil",
          audio_retention_days: data.audio_retention_days ?? 7,
          sound_effects_enabled: data.sound_effects_enabled ?? true
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function saveSettings() {
    if (!user) return;
    setSavingSettings(true);
    setSettingsSuccess("");
    setError("");
    try {
      const r = await fetch(`${api}/api/settings/${user}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (r.ok) {
        setSettingsSuccess("✅ Coach settings and voice preferences updated successfully!");
        setTimeout(() => setSettingsSuccess(""), 4000);
      } else {
        setError("Failed to save settings.");
      }
    } catch (e) {
      setError("Unable to save settings to backend.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function exportUserData() {
    if (!user) return;
    setExportingData(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/user/export/${user}`);
      if (r.ok) {
        const data = await r.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `english_coach_learner_export_${user}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError("Failed to export data.");
      }
    } catch (e) {
      setError("Data export failed.");
    } finally {
      setExportingData(false);
    }
  }

  async function resetUserData() {
    if (!user) return;
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete your practice session history, mistake logs, dictation attempts, and progress records. Are you sure?"
    );
    if (!confirmed) return;
    setResettingData(true);
    setError("");
    try {
      const r = await fetch(`${api}/api/user/data/${user}`, { method: "DELETE" });
      if (r.ok) {
        alert("Your practice data and history have been completely reset.");
        setUserXP(100);
        setUserStreak(1);
        setTasks([]);
        setSession(null);
        setSessionReport(null);
        loadProgress(user);
        loadReviews(user);
        loadVocabulary(user);
        setActiveTab("home");
      } else {
        setError("Failed to reset learner data.");
      }
    } catch (e) {
      setError("Reset request failed.");
    } finally {
      setResettingData(false);
    }
  }

  // RENDER: Welcome Screen
  if (view === "welcome") {
    return (
      <main>
        <section className="hero">
          <p className="eyebrow">VOICE-FIRST ENGLISH COACH</p>
          <h1>Speak with more clarity. Every day.</h1>
          <p className="lead">A focused space for natural conversation, real-time corrections, and confidence — not random chatting.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What should your coach call you?" />
          <div className="plan-selector">
            <span className="label">Target daily practice duration:</span>
            <div className="duration-pills">
              {[10, 15, 20, 30, 45].map((m) => (
                <button key={m} type="button" className={planMinutes === m ? "pill active" : "pill"} onClick={() => setPlanMinutes(m)}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <button className="primary-btn" disabled={!name.trim()} onClick={onboard}>
            Start My Speaking Assessment →
          </button>
          <p className="hint">Tamil explanations and guidance are ready whenever you get stuck.</p>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  // RENDER: Assessment Flow
  if (view === "assessment") {
    return (
      <main>
        <section className="hero assessment">
          <p className="eyebrow">BASELINE DIAGNOSTIC · STEP {step + 1} OF 3</p>
          <h1>Speak naturally aloud.</h1>
          <p className="lead">{prompts[step] || "Introduce yourself and tell me your goals."}</p>
          <div className="answer-box">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Click 'Speak' and answer aloud, or review your transcript here…" />
            <div className="btn-group">
              <button className={listening ? "recording" : "mic"} onClick={mic}>
                {listening ? "■ Stop Listening" : "● Speak Answer"}
              </button>
              <button className="primary-btn" disabled={!text.trim()} onClick={saveAnswer}>
                {step === 2 ? "Generate Speaking Profile →" : "Next Question →"}
              </button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <p className="privacy">🔒 Text-based communication assessment. Raw voice recordings are not retained.</p>
        </section>
      </main>
    );
  }

  // RENDER: Main Application
  return (
    <div className="app-layout">
      <nav className="top-nav">
        <div className="brand-section">
          <div className="brand">
            <span className="dot"></span>
            <b>Speak Better</b>
            <span className="badge">{progressData?.level || assessment?.level || "B1 Intermediate"}</span>
          </div>
          <div className="user-stats-banner">
            <span className="stat-badge flame">🔥 {userStreak} Day Streak</span>
            <span className="stat-badge xp">⚡ {userXP} XP</span>
          </div>
        </div>

        <div className="nav-tabs">
          <button className={activeTab === "home" ? "tab active" : "tab"} onClick={() => setActiveTab("home")}>
            📋 Today's Plan
          </button>
          <button className={activeTab === "coach" ? "tab active" : "tab"} onClick={() => { if (!session) beginSession(); else setActiveTab("coach"); }}>
            🎙️ Voice Coach {session && <span className="indicator">Live</span>}
          </button>
          <button className={activeTab === "scenarios" ? "tab active" : "tab"} onClick={() => { setActiveTab("scenarios"); loadScenarios(); }}>
            🎭 Scenarios
          </button>
          <button className={activeTab === "interview" ? "tab active" : "tab"} onClick={() => { setActiveTab("interview"); if (user) loadInterviewAttempts(user); }}>
            💼 Interview Coach
          </button>
          <button className={activeTab === "extempore" ? "tab active" : "tab"} onClick={() => { setActiveTab("extempore"); loadExtemporeTopics(); }}>
            ⏱️ Free Speaking
          </button>
          <button className={activeTab === "listening" ? "tab active" : "tab"} onClick={() => { setActiveTab("listening"); loadListeningExercises(); }}>
            🎧 Listening & Dictation
          </button>
          <button className={activeTab === "translation" ? "tab active" : "tab"} onClick={() => { setActiveTab("translation"); loadTranslationPrompts(); }}>
            🔄 Tamil ➔ English
          </button>
          <button className={activeTab === "review" ? "tab active" : "tab"} onClick={() => { setActiveTab("review"); if (user) loadReviews(user); }}>
            🧠 Spaced Review ({dueReviews.length})
          </button>
          <button className={activeTab === "vocabulary" ? "tab active" : "tab"} onClick={() => { setActiveTab("vocabulary"); if (user) loadVocabulary(user); }}>
            📚 Vocab Bank ({vocabList.length})
          </button>
          <button className={activeTab === "progress" ? "tab active" : "tab"} onClick={() => { setActiveTab("progress"); if (user) loadProgress(user); }}>
            📈 Progress & Analytics
          </button>
          <button className={activeTab === "settings" ? "tab active" : "tab"} onClick={() => { setActiveTab("settings"); if (user) loadSettings(user); }}>
            ⚙️ Settings & Privacy
          </button>
        </div>
      </nav>

      <main className="content-container">
        {/* TAB 1: TODAY'S PLAN */}
        {activeTab === "home" && (
          <section className="hero dashboard">
            <p className="eyebrow">YOUR PERSONALIZED SPEAKING PLAN</p>
            <h1>Welcome back, {name}!</h1>
            {assessment && (
              <>
                <p className="lead">{assessment.summary}</p>
                <div className="scores">
                  {Object.entries(assessment.scores).map(([label, value]) => (
                    <div key={label} className="score-card">
                      <b>{value}</b>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="focus-box">
                  <b>🎯 Targeted Focus Weaknesses:</b>
                  <p>{assessment.weaknesses.join(" • ")}</p>
                </div>
              </>
            )}

            <div className="section-title-row">
              <h2>Today’s Step-by-Step Practice Schedule</h2>
              <div className="duration-pills mini">
                {[10, 20, 30, 45].map((m) => (
                  <button key={m} className={planMinutes === m ? "pill active" : "pill"} onClick={() => { setPlanMinutes(m); if (user) loadPlan(user, m); }}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {planReason && <p className="plan-reason">💡 {planReason}</p>}

            <div className="tasks">
              {tasks.map((task, i) => (
                <article key={i} className="task-card">
                  <div className="task-header">
                    <span className="task-number">Task 0{i + 1}</span>
                    <span className="task-duration">⏱️ {task.minutes} min</span>
                  </div>
                  <h3>{task.title}</h3>
                  <p>{task.instruction}</p>
                  <button
                    className="task-action-btn"
                    onClick={() => {
                      if (task.kind === "scenario") {
                        setActiveTab("scenarios");
                        loadScenarios();
                      } else if (task.kind === "interview") {
                        setActiveTab("interview");
                        if (user) loadInterviewAttempts(user);
                      } else if (task.kind === "extempore" || task.kind === "warmup") {
                        setActiveTab("extempore");
                        loadExtemporeTopics();
                      } else if (task.kind === "listening" || task.kind === "dictation") {
                        setActiveTab("listening");
                        loadListeningExercises();
                      } else if (task.kind === "translation") {
                        setActiveTab("translation");
                      } else if (task.kind === "review") {
                        setActiveTab("review");
                      } else {
                        beginSession(task.instruction);
                      }
                    }}
                  >
                    Start This Task →
                  </button>
                </article>
              ))}
            </div>
            <button className="primary-btn wide" onClick={() => beginSession()}>
              🎙️ Launch Full Voice Practice Session
            </button>
          </section>
        )}

        {/* TAB 2: LIVE VOICE COACH ARENA */}
        {activeTab === "coach" && (
          <section className="coach-arena">
            <div className="arena-header">
              <div>
                <p className="eyebrow">ACTIVE COACHING SESSION · TURN #{turnCount + 1}</p>
                <h2>{sessionObjective}</h2>
              </div>
              <button className="secondary-btn" onClick={endSession}>
                Complete & End Session 🏁
              </button>
            </div>

            <div className="dialogue-bubble coach-bubble">
              <div className="avatar">AI</div>
              <div className="bubble-content">
                <p className="coach-reply">{reply?.reply || "Let's begin your practice session!"}</p>
                <p className="coach-prompt">👉 {reply?.next_prompt || "Speak your answer clearly."}</p>
                {reply?.reply && (
                  <button className="audio-replay" onClick={() => speak(reply.reply)}>
                    🔊 Listen Again
                  </button>
                )}
              </div>
            </div>

            {reply?.correction && (
              <aside className="correction-card">
                <div className="correction-badge">💡 High-Value Correction</div>
                <p className="correction-text">
                  Try saying: <b>“{reply.correction}”</b>
                </p>
                {reply.explanation && <small className="explanation-text">{reply.explanation}</small>}
              </aside>
            )}

            <div className="answer-panel">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Click 'Speak' and answer aloud in complete sentences…"
              />
              <div className="controls-row">
                <button className={listening ? "recording" : "mic"} onClick={mic}>
                  {listening ? "■ Stop Listening" : "● Speak Your Answer"}
                </button>
                <button className="primary-btn" disabled={!text.trim()} onClick={sendTurn}>
                  Send Answer →
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 3: REAL-LIFE SCENARIOS */}
        {activeTab === "scenarios" && (
          <section className="hero scenario-section">
            <p className="eyebrow">REAL-LIFE SCENARIOS & ROLEPLAY</p>
            <h1>Practice Realistic Situations</h1>
            <p className="lead">Roleplay with realistic AI personas in workplace, travel, daily life, and customer service scenarios.</p>

            {!activeScenario ? (
              <>
                <div className="category-pills">
                  {["All", "Workplace", "Job Interview", "Travel & Hospitality", "Daily Life", "Customer Service"].map((cat) => (
                    <button
                      key={cat}
                      className={scenarioCategory === cat ? "pill active" : "pill"}
                      onClick={() => {
                        setScenarioCategory(cat);
                        loadScenarios(cat);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="scenarios-grid">
                  {scenarios.map((s) => (
                    <div key={s.id} className="scenario-card">
                      <div className="scenario-header">
                        <span className="category-tag">{s.category}</span>
                        <span className={`diff-tag ${s.difficulty.toLowerCase()}`}>{s.difficulty}</span>
                      </div>
                      <h3>{s.title}</h3>
                      <p className="scenario-desc">{s.description}</p>
                      <div className="role-meta">
                        <span><b>AI Role:</b> {s.role}</span>
                        <span><b>Your Role:</b> {s.learner_role}</span>
                      </div>
                      <button className="primary-btn start-scenario-btn" onClick={() => startScenario(s)}>
                        🎭 Enter Roleplay →
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="scenario-active-arena">
                <div className="arena-top-bar">
                  <div>
                    <span className="category-tag">{activeScenario.category}</span>
                    <h2>{activeScenario.title}</h2>
                    <p className="role-reminder">
                      🎭 You are <b>{activeScenario.learner_role}</b> speaking with <b>{activeScenario.role}</b>
                    </p>
                  </div>
                  <button className="secondary-btn" onClick={() => { setActiveScenario(null); loadScenarios(scenarioCategory); }}>
                    ← Change Scenario
                  </button>
                </div>

                {!scenarioReport ? (
                  <>
                    <div className="dialogue-stream">
                      {scenarioTurns.map((turn, i) => (
                        <div key={i} className={`turn-bubble ${turn.speaker}`}>
                          <div className="turn-author">
                            {turn.speaker === "role" ? `🎭 ${turn.roleName || activeScenario.role}` : `👤 You (${activeScenario.learner_role})`}
                          </div>
                          <p className="turn-text">{turn.text}</p>
                          {turn.speaker === "role" && (
                            <button className="audio-replay mini" onClick={() => speak(turn.text)}>
                              🔊 Listen
                            </button>
                          )}
                          {turn.coachingTip && (
                            <div className="in-turn-tip">
                              💡 <b>Coach Whisper:</b> {turn.coachingTip}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="scenario-input-area">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Respond aloud in-character as ${activeScenario.learner_role}…`}
                      />
                      <div className="btn-group">
                        <button className={listening ? "recording" : "mic"} onClick={mic}>
                          {listening ? "■ Stop" : "● Speak In-Character"}
                        </button>
                        <button className="primary-btn" disabled={!text.trim() || scenarioTurnLoading} onClick={sendScenarioTurn}>
                          {scenarioTurnLoading ? "Responding…" : "Send Dialogue →"}
                        </button>
                        <button className="secondary-btn" onClick={endScenario}>
                          Finish & Grade Roleplay 🏁
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="scenario-report-card">
                    <div className="report-badge-row">
                      <span className="score-pill large">Communication Score: {scenarioReport.communication_score}/100</span>
                      <h3>Roleplay Debrief</h3>
                    </div>
                    <p className="lead">{scenarioReport.summary}</p>
                    <div className="scores">
                      {Object.entries(scenarioReport.scores).map(([label, value]) => (
                        <div key={label} className="score-card">
                          <b>{value}</b>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="strengths-box">
                      <b>🌟 Demonstrated Strengths:</b>
                      <ul>
                        {scenarioReport.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="improvements-box">
                      <b>💡 Communicative Polish Areas:</b>
                      <ul>
                        {scenarioReport.improvements.map((imp, i) => (
                          <li key={i}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                    <button className="primary-btn wide" onClick={() => { setActiveScenario(null); loadScenarios(scenarioCategory); }}>
                      ← Back to All Scenarios
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 4: INTERVIEW COACH */}
        {activeTab === "interview" && (
          <section className="hero interview-section">
            <p className="eyebrow">INTERVIEW & WORKPLACE COACH</p>
            <h1>Master Spoken Job Interviews</h1>
            <p className="lead">Practice structured interview responses, train the STAR method, and compare Attempt 1 vs Attempt 2 side-by-side.</p>

            <div className="interview-mode-selector">
              <div className="role-input-row">
                <label><b>Target Job Title / Field:</b></label>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Senior Software Engineer / Product Manager" />
              </div>

              <div className="interview-types-grid">
                {interviewOptions.map((opt) => (
                  <div
                    key={opt.title}
                    className={selectedInterviewType === opt.title ? "interview-card selected" : "interview-card"}
                    onClick={() => setSelectedInterviewType(opt.title)}
                  >
                    <h4>{opt.title}</h4>
                    <p>{opt.desc}</p>
                  </div>
                ))}
              </div>

              {!interviewSessionId && (
                <button className="primary-btn wide" onClick={startInterview}>
                  💼 Start New Interview Attempt →
                </button>
              )}
            </div>

            {interviewSessionId && !interviewEndReport && (
              <div className="live-interview-box">
                <div className="interview-header-row">
                  <div>
                    <span className="attempt-pill">Attempt #{interviewAttemptNumber}</span>
                    <h3>{selectedInterviewType}</h3>
                  </div>
                  <button className="secondary-btn" onClick={endInterview}>
                    Finish & Evaluate Attempt 🏁
                  </button>
                </div>

                <div className="dialogue-stream">
                  {interviewTurns.map((turn, i) => (
                    <div key={i} className={`turn-bubble ${turn.speaker === "interviewer" ? "role" : "learner"}`}>
                      <div className="turn-author">
                        {turn.speaker === "interviewer" ? "👔 Hiring Interviewer" : `👤 You (${targetRole})`}
                      </div>
                      <p className="turn-text">{turn.text}</p>
                      {turn.speaker === "interviewer" && (
                        <button className="audio-replay mini" onClick={() => speak(turn.text)}>
                          🔊 Listen
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="interview-input-box">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Deliver your structured interview answer aloud…" />
                  <div className="btn-group">
                    <button className={listening ? "recording" : "mic"} onClick={mic}>
                      {listening ? "■ Stop" : "● Speak Answer"}
                    </button>
                    <button className="primary-btn" disabled={!text.trim()} onClick={sendInterviewTurn}>
                      Submit Spoken Answer →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {interviewEndReport && (
              <div className="eval-result-card">
                <div className="eval-header">
                  <span className="score-pill">Attempt #{interviewEndReport.attempt_number} Evaluated</span>
                  <h3>{interviewEndReport.interview_type}</h3>
                </div>
                <p className="lead">{interviewEndReport.summary}</p>
                <div className="scores">
                  {Object.entries(interviewEndReport.scores).map(([label, val]) => (
                    <div key={label} className="score-card">
                      <b>{val}</b>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="strengths-box">
                  <b>🌟 Strengths Observed:</b>
                  <ul>
                    {interviewEndReport.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="improvements-box">
                  <b>💡 Actionable Improvements for Next Attempt:</b>
                  <ul>
                    {interviewEndReport.improvements.map((imp, i) => (
                      <li key={i}>{imp}</li>
                    ))}
                  </ul>
                </div>
                <button
                  className="primary-btn wide"
                  onClick={() => {
                    setInterviewSessionId(null);
                    setInterviewEndReport(null);
                    if (user) loadInterviewAttempts(user);
                  }}
                >
                  ← Return to Interview Hub
                </button>
              </div>
            )}

            {interviewAttempts.length >= 2 && (
              <div className="comparison-section">
                <hr className="divider" />
                <h2>📊 Compare Attempts (Attempt 1 vs Attempt 2)</h2>
                <p className="lead">Select two past attempts to view side-by-side metric gains and qualitative progress.</p>

                <div className="attempt-pickers">
                  <div className="picker-col">
                    <label><b>Select Baseline Attempt:</b></label>
                    <select value={compareId1 || ""} onChange={(e) => setCompareId1(Number(e.target.value))}>
                      <option value="">-- Choose Attempt --</option>
                      {interviewAttempts.map((a) => (
                        <option key={a.id} value={a.id}>
                          Attempt #{a.attempt_number} — {a.interview_type} ({new Date(a.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="picker-col">
                    <label><b>Select Comparison Attempt:</b></label>
                    <select value={compareId2 || ""} onChange={(e) => setCompareId2(Number(e.target.value))}>
                      <option value="">-- Choose Attempt --</option>
                      {interviewAttempts.map((a) => (
                        <option key={a.id} value={a.id}>
                          Attempt #{a.attempt_number} — {a.interview_type} ({new Date(a.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="primary-btn compare-btn"
                    disabled={!compareId1 || !compareId2 || compareId1 === compareId2 || comparing}
                    onClick={runInterviewComparison}
                  >
                    {comparing ? "Comparing…" : "Compare Attempts →"}
                  </button>
                </div>

                {comparisonResult && (
                  <div className="comparison-result-card">
                    <h3>🏆 Comparative Progress Analysis</h3>
                    <p className="coach-verdict"><b>Coach Verdict:</b> {comparisonResult.coach_verdict}</p>

                    <div className="comparison-table-wrapper">
                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th>Attempt #{comparisonResult.attempt_1.attempt_number}</th>
                            <th>Attempt #{comparisonResult.attempt_2.attempt_number}</th>
                            <th>Gain / Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(comparisonResult.score_diffs).map(([metric, diff]) => (
                            <tr key={metric}>
                              <td className="metric-name">{metric.toUpperCase()}</td>
                              <td>{comparisonResult.attempt_1.scores[metric as keyof typeof comparisonResult.attempt_1.scores] || 75}</td>
                              <td>{comparisonResult.attempt_2.scores[metric as keyof typeof comparisonResult.attempt_2.scores] || 75}</td>
                              <td className={diff >= 0 ? "gain-positive" : "gain-negative"}>
                                {diff >= 0 ? `+${diff}` : diff} pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="gains-box">
                      <b>🚀 Key Measurable Gains:</b>
                      <ul>
                        {comparisonResult.key_gains.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="remaining-box">
                      <b>🎯 Ongoing Polish Focus:</b>
                      <ul>
                        {comparisonResult.remaining_focus.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 5: FREE SPEAKING / EXTEMPORE */}
        {activeTab === "extempore" && (
          <section className="hero extempore-section">
            <p className="eyebrow">FREE SPEAKING & EXTEMPORE</p>
            <h1>Timed Spoken Monologue</h1>
            <p className="lead">Speak continuously on a randomized topic without long pauses. Analyze structure, filler words, and speaking tempo.</p>

            {extemporeTopics.length > 0 && (
              <div className="extempore-hub">
                <div className="topic-card">
                  <div className="topic-top">
                    <span className="topic-cat">{extemporeTopics[topicIdx].category}</span>
                    <button
                      className="shuffle-btn"
                      onClick={() => {
                        setTopicIdx((prev) => (prev + 1) % extemporeTopics.length);
                        setExtemporeResult(null);
                        setText("");
                      }}
                    >
                      🎲 Next Random Topic
                    </button>
                  </div>
                  <h2>“{extemporeTopics[topicIdx].topic}”</h2>
                  <div className="guidance-box">
                    <b>💡 Ideas to cover during your monologue:</b>
                    <ul>
                      {extemporeTopics[topicIdx].guidance_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="timer-controls-card">
                  <div className="duration-selector">
                    <span>Monologue Duration:</span>
                    <div className="duration-pills mini">
                      {[30, 60, 120, 180].map((sec) => (
                        <button
                          key={sec}
                          className={extemporeDuration === sec ? "pill active" : "pill"}
                          disabled={isExtemporeActive}
                          onClick={() => {
                            setExtemporeDuration(sec);
                            setTimerRemaining(sec);
                          }}
                        >
                          {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="timer-display">
                    <div className={`countdown-circle ${isExtemporeActive ? "pulsing" : ""}`}>
                      <span className="time-digits">
                        {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, "0")}
                      </span>
                      <span className="time-label">{isExtemporeActive ? "SPEAKING LIVE" : "READY"}</span>
                    </div>
                  </div>

                  <div className="timer-btn-row">
                    {!isExtemporeActive ? (
                      <button className="primary-btn large" onClick={startExtemporeTimer}>
                        ▶️ Start Speaking Timer ({extemporeDuration}s)
                      </button>
                    ) : (
                      <button className="recording large" onClick={stopExtemporeTimer}>
                        ⏹️ Stop & Review
                      </button>
                    )}
                  </div>
                </div>

                <div className="extempore-transcript-area">
                  <label><b>Your Spoken Monologue Transcript:</b></label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Your spoken words will appear here in real-time as you speak…" />
                  <div className="btn-group">
                    <button
                      className="primary-btn"
                      disabled={!text.trim() || evaluatingExtempore || isExtemporeActive}
                      onClick={evaluateExtempore}
                    >
                      {evaluatingExtempore ? "Analyzing Speech…" : "Analyze My Extempore Speech →"}
                    </button>
                  </div>
                </div>

                {extemporeResult && (
                  <div className="extempore-eval-card">
                    <div className="extempore-stats-row">
                      <div className="stat-pill">
                        <b>{extemporeResult.word_count}</b>
                        <span>Words Spoken</span>
                      </div>
                      <div className="stat-pill">
                        <b>{extemporeResult.estimated_wpm}</b>
                        <span>Pace (WPM)</span>
                      </div>
                      <div className="stat-pill">
                        <b>{extemporeResult.duration_seconds}s</b>
                        <span>Duration</span>
                      </div>
                    </div>

                    <div className="scores">
                      {Object.entries(extemporeResult.scores).map(([label, val]) => (
                        <div key={label} className="score-card">
                          <b>{val}</b>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="structure-feedback-box">
                      <h3>📐 3-Part Monologue Structure Analysis</h3>
                      <div className="struct-row">
                        <span className="struct-label">Introduction:</span>
                        <p>{extemporeResult.structure_feedback.introduction}</p>
                      </div>
                      <div className="struct-row">
                        <span className="struct-label">Body & Reasoning:</span>
                        <p>{extemporeResult.structure_feedback.body}</p>
                      </div>
                      <div className="struct-row">
                        <span className="struct-label">Conclusion:</span>
                        <p>{extemporeResult.structure_feedback.conclusion}</p>
                      </div>
                    </div>

                    {extemporeResult.filler_words_detected?.length > 0 && (
                      <div className="fillers-box">
                        <b>⚠️ Filler Words Detected:</b>
                        <div className="filler-tags">
                          {extemporeResult.filler_words_detected.map((f, i) => (
                            <span key={i} className="filler-chip">
                              “{f.filler}”: {f.count} time(s)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="strengths-box">
                      <b>🌟 Strengths:</b>
                      <ul>
                        {extemporeResult.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="homework-box">
                      <b>🎯 Recommended Next Drill:</b>
                      <p>{extemporeResult.recommended_exercise}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 6: LISTENING & DICTATION PRACTICE (PHASE 6) */}
        {activeTab === "listening" && (
          <section className="hero listening-section">
            <p className="eyebrow">LISTENING & DICTATION LAB</p>
            <h1>Train Your Ear & Auditory Memory</h1>
            <p className="lead">Listen to spoken dialogues, answer comprehension questions, or practice exact sentence dictation.</p>

            {/* Sub-mode Toggle */}
            <div className="listening-mode-toggle">
              <button
                className={listeningMode === "comprehension" ? "mode-tab active" : "mode-tab"}
                onClick={() => setListeningMode("comprehension")}
              >
                🎧 Passage Comprehension
              </button>
              <button
                className={listeningMode === "dictation" ? "mode-tab active" : "mode-tab"}
                onClick={() => setListeningMode("dictation")}
              >
                ✍️ Sentence Dictation Mode
              </button>
            </div>

            {listeningExercises.length > 0 && (
              <div className="exercise-container">
                {/* Exercise Selector Pills */}
                <div className="exercise-pills">
                  {listeningExercises.map((ex, i) => (
                    <button
                      key={ex.id}
                      className={listeningIdx === i ? "pill active" : "pill"}
                      onClick={() => {
                        setListeningIdx(i);
                        setSelectedQuizAnswers({});
                        setListeningResult(null);
                        setDictationResult(null);
                        setDictationInput("");
                      }}
                    >
                      {ex.title}
                    </button>
                  ))}
                </div>

                <div className="exercise-card">
                  <div className="card-top-row">
                    <span className="category-tag">{listeningExercises[listeningIdx].category}</span>
                    <span className={`diff-tag ${listeningExercises[listeningIdx].difficulty.toLowerCase()}`}>
                      {listeningExercises[listeningIdx].difficulty}
                    </span>
                  </div>
                  <h2>{listeningExercises[listeningIdx].title}</h2>

                  {/* Audio Player Controls */}
                  <div className="audio-player-box">
                    <div className="player-inner">
                      <button
                        className="play-audio-btn"
                        onClick={() => {
                          const textToPlay =
                            listeningMode === "comprehension"
                              ? listeningExercises[listeningIdx].audio_script
                              : listeningExercises[listeningIdx].dictation_sentence;
                          speak(textToPlay, 0.95);
                        }}
                      >
                        🔊 {listeningMode === "comprehension" ? "Play Spoken Audio Passage" : "Play Dictation Sentence"}
                      </button>
                      <button
                        className="slow-audio-btn"
                        onClick={() => {
                          const textToPlay =
                            listeningMode === "comprehension"
                              ? listeningExercises[listeningIdx].audio_script
                              : listeningExercises[listeningIdx].dictation_sentence;
                          speak(textToPlay, 0.75);
                        }}
                      >
                        🐢 Slower Pace
                      </button>
                    </div>
                    <small>Audio is synthesized directly on your device. Click to listen as many times as you need.</small>
                  </div>

                  {/* MODE 1: COMPREHENSION QUIZ */}
                  {listeningMode === "comprehension" && (
                    <div className="comprehension-quiz-area">
                      <h3>Comprehension Questions:</h3>
                      {listeningExercises[listeningIdx].questions.map((q, qIdx) => (
                        <div key={qIdx} className="quiz-question-block">
                          <p className="question-title"><b>{qIdx + 1}. {q.question}</b></p>
                          <div className="options-list">
                            {q.options.map((opt, oIdx) => (
                              <label
                                key={oIdx}
                                className={`option-label ${selectedQuizAnswers[qIdx] === oIdx ? "selected" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={`question_${qIdx}`}
                                  checked={selectedQuizAnswers[qIdx] === oIdx}
                                  onChange={() =>
                                    setSelectedQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                                  }
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      {!listeningResult ? (
                        <button
                          className="primary-btn wide"
                          disabled={evaluatingListening}
                          onClick={submitListeningQuiz}
                        >
                          {evaluatingListening ? "Checking Answers…" : "Submit Comprehension Answers →"}
                        </button>
                      ) : (
                        <div className="quiz-result-box">
                          <div className="result-header">
                            <span className="score-pill large">Score: {listeningResult.score}%</span>
                            <b>{listeningResult.feedback}</b>
                          </div>
                          <div className="explanations-list">
                            <h4>Answer Explanations:</h4>
                            {listeningResult.explanations.map((exp, i) => (
                              <p key={i} className="exp-item">💡 <b>Q{i + 1}:</b> {exp}</p>
                            ))}
                          </div>
                          <div className="xp-reward-badge">⚡ +{listeningResult.xp_earned} XP Earned!</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE 2: SENTENCE DICTATION */}
                  {listeningMode === "dictation" && (
                    <div className="dictation-area">
                      <h3>Type Exactly What You Heard:</h3>
                      <p className="dictation-hint">Listen carefully to the audio sentence above, then type it word-for-word below.</p>
                      <textarea
                        value={dictationInput}
                        onChange={(e) => setDictationInput(e.target.value)}
                        placeholder="Type the spoken sentence here…"
                      />
                      <div className="btn-group">
                        <button
                          className="primary-btn"
                          disabled={!dictationInput.trim() || evaluatingDictation}
                          onClick={submitDictation}
                        >
                          {evaluatingDictation ? "Evaluating Transcription…" : "Check My Transcription →"}
                        </button>
                      </div>

                      {dictationResult && (
                        <div className="dictation-eval-result">
                          <div className="eval-header">
                            <span className="score-pill large">Accuracy: {dictationResult.accuracy_score}%</span>
                            <b>{dictationResult.feedback}</b>
                          </div>

                          <div className="word-diff-container">
                            <h4>Word-by-Word Analysis:</h4>
                            <div className="diff-chips">
                              {dictationResult.word_diffs.map((d, i) => (
                                <span key={i} className={`diff-chip ${d.status}`}>
                                  {d.word}
                                  <small className="status-label">{d.status}</small>
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="correct-model-box">
                            <b>✨ Exact Target Sentence:</b>
                            <p>“{dictationResult.correct_transcription}”</p>
                          </div>
                          <div className="xp-reward-badge">⚡ +{dictationResult.xp_earned} XP Earned!</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 7: TAMIL ➔ ENGLISH DRILLS */}
        {activeTab === "translation" && (
          <section className="hero translation-section">
            <p className="eyebrow">TAMIL ➔ ENGLISH SPEAKING DRILLS</p>
            <h1>Translate Your Thought into Natural English</h1>
            <p className="lead">Reduce mental translation delay by speaking the English phrase immediately.</p>

            {translationPrompts.length > 0 ? (
              <div className="drill-container">
                <div className="prompt-card">
                  <span className="drill-badge">Drill {transIdx + 1} of {translationPrompts.length}</span>
                  <h2 className="tamil-text">{translationPrompts[transIdx].tamil_prompt}</h2>
                  <p className="pattern-tag">Grammar Focus: {translationPrompts[transIdx].target_pattern}</p>
                </div>

                <div className="translation-input-box">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Speak your English translation out loud…" />
                  <div className="btn-group">
                    <button className={listening ? "recording" : "mic"} onClick={mic}>
                      {listening ? "■ Stop" : "● Speak Translation"}
                    </button>
                    <button className="primary-btn" disabled={!text.trim() || evaluatingTrans} onClick={evaluateTranslation}>
                      {evaluatingTrans ? "Evaluating…" : "Check My Translation →"}
                    </button>
                  </div>
                </div>

                {transResult && (
                  <div className="eval-result-card">
                    <div className="eval-header">
                      <span className="score-pill">Accuracy: {transResult.accuracy_score}/100</span>
                      <b>{transResult.feedback}</b>
                    </div>
                    <div className="natural-box">
                      <span>✨ Natural English:</span>
                      <p className="natural-phrase">“{transResult.natural_english}”</p>
                      <button className="audio-replay" onClick={() => speak(transResult.natural_english)}>
                        🔊 Listen & Repeat
                      </button>
                    </div>
                    {transResult.explanation && <p className="eval-explanation">📌 {transResult.explanation}</p>}
                    {transResult.better_alternatives?.length > 0 && (
                      <div className="alternatives-box">
                        <b>Alternative Phrasings:</b>
                        <ul>
                          {transResult.better_alternatives.map((alt, i) => (
                            <li key={i}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      className="secondary-btn"
                      onClick={() => {
                        setTransResult(null);
                        setText("");
                        setTransIdx((prev) => (prev + 1) % translationPrompts.length);
                      }}
                    >
                      Next Translation Drill →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>Loading curated translation drills…</p>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 8: MISTAKE MEMORY & SPACED REVIEW */}
        {activeTab === "review" && (
          <section className="hero review-section">
            <p className="eyebrow">SPACED REPETITION ENGINE (DAY 1 · 2 · 4 · 7 · 14 · 30)</p>
            <h1>Active Mistake Recall</h1>
            <p className="lead">Re-speak past mistakes correctly to build permanent speech habits and level up mastery.</p>

            {dueReviews.length > 0 ? (
              <div className="review-container">
                <div className="review-card">
                  <div className="card-top">
                    <span className="review-badge">Mistake #{reviewIdx + 1}</span>
                    <span className="mastery-badge">Mastery: {dueReviews[reviewIdx].mastery}%</span>
                  </div>
                  <p className="mistake-label">Previous Spoken Error:</p>
                  <p className="original-mistake">“{dueReviews[reviewIdx].original}”</p>
                  <p className="target-hint">Target Correction: {dueReviews[reviewIdx].correction}</p>
                  <p className="explanation-hint">{dueReviews[reviewIdx].explanation}</p>
                </div>

                <div className="review-input-box">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Speak the corrected sentence cleanly aloud…" />
                  <div className="btn-group">
                    <button className={listening ? "recording" : "mic"} onClick={mic}>
                      {listening ? "■ Stop" : "● Speak Correction"}
                    </button>
                    <button className="primary-btn" disabled={!text.trim()} onClick={answerReview}>
                      Submit Spoken Correction →
                    </button>
                  </div>
                </div>

                {reviewResult && (
                  <div className={reviewResult.is_correct ? "result-card success" : "result-card retry"}>
                    <h3>{reviewResult.is_correct ? "✅ Great Job! Mastery Increased!" : "🔄 Keep Practicing"}</h3>
                    <p>{reviewResult.coach_feedback}</p>
                    <p className="model-quote">Model Phrase: <b>“{reviewResult.model_sentence}”</b></p>
                    <p className="next-review-text">Next review in: {reviewResult.next_review_days} day(s)</p>
                    <button
                      className="secondary-btn"
                      onClick={() => {
                        setReviewResult(null);
                        setText("");
                        setReviewIdx((prev) => (prev + 1) % dueReviews.length);
                      }}
                    >
                      Next Due Mistake →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <h3>🎉 All caught up!</h3>
                <p>No mistakes are currently due for spaced review. Complete more speaking turns to log new memory records.</p>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 9: VOCABULARY BANK */}
        {activeTab === "vocabulary" && (
          <section className="hero vocab-section">
            <p className="eyebrow">VOCABULARY & PHRASES IN CONTEXT</p>
            <h1>Your Personal Word Bank</h1>
            <p className="lead">High-value words and idioms captured automatically from your speaking sessions.</p>

            <div className="vocab-grid">
              {vocabList.length > 0 ? (
                vocabList.map((v) => (
                  <div key={v.id} className="vocab-card">
                    <div className="vocab-top">
                      <h3>{v.word_or_phrase}</h3>
                      <button className="audio-icon-btn" onClick={() => speak(v.word_or_phrase)}>🔊</button>
                    </div>
                    <p className="vocab-meaning"><b>Meaning:</b> {v.meaning}</p>
                    <p className="vocab-example"><b>Example:</b> “{v.example}”</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No vocabulary recorded yet. Words used during your voice sessions will automatically appear here.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 10: PROGRESS DASHBOARD & ANALYTICS (PHASE 7) */}
        {activeTab === "progress" && (
          <section className="hero progress-analytics-section">
            <p className="eyebrow">LONG-TERM PROGRESS & ANALYTICS</p>
            <h1>Your Speaking Trajectory</h1>
            <p className="lead">Track your communication growth metrics, streak milestones, achievement badges, and weekly trends.</p>

            {loadingProgress ? (
              <p>Loading your progress analytics…</p>
            ) : progressData ? (
              <div className="analytics-dashboard">
                {/* Hero Overall Score Card */}
                <div className="overall-score-banner">
                  <div className="score-dial">
                    <span className="dial-number">{progressData.overall_score}</span>
                    <span className="dial-max">/ 100</span>
                  </div>
                  <div className="banner-details">
                    <span className="level-badge">{progressData.level}</span>
                    <h2>Overall Communication Score</h2>
                    <p>Based on your live voice turns, roleplays, dictations, and baseline diagnostic assessments.</p>
                  </div>
                </div>

                {/* Key Stat Counters */}
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <b>⏱️ {progressData.total_speaking_minutes} min</b>
                    <span>Speaking Practice</span>
                  </div>
                  <div className="kpi-card">
                    <b>🎯 {progressData.sessions_completed}</b>
                    <span>Sessions Completed</span>
                  </div>
                  <div className="kpi-card">
                    <b>🔥 {progressData.streak_days} days</b>
                    <span>Current Streak</span>
                  </div>
                  <div className="kpi-card">
                    <b>⚡ {progressData.xp} XP</b>
                    <span>Total Experience</span>
                  </div>
                </div>

                {/* Core 6 Skill Meters with Gain vs Baseline */}
                <div className="skill-meters-box">
                  <h3>📊 Core Communication Breakdown (vs Baseline)</h3>
                  <div className="meters-grid">
                    {Object.entries(progressData.current_scores).map(([metric, score]) => {
                      const change = progressData.score_changes[metric] || 0;
                      return (
                        <div key={metric} className="meter-card">
                          <div className="meter-header">
                            <span className="metric-title">{metric.toUpperCase()}</span>
                            <span className="metric-score">{score}/100</span>
                          </div>
                          <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${score}%` }}></div>
                          </div>
                          <div className="meter-footer">
                            <span>Baseline: {progressData.baseline_scores[metric] || 70}</span>
                            <span className={change >= 0 ? "gain-positive" : "gain-negative"}>
                              {change >= 0 ? `+${change}` : change} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 7-Day Performance Trend */}
                {weeklyTrends && (
                  <div className="weekly-trend-box">
                    <h3>📈 7-Day Performance Trajectory</h3>
                    <p className="trend-summary">💡 {weeklyTrends.coach_weekly_summary}</p>
                    <div className="trend-bars-wrapper">
                      {weeklyTrends.daily_trends.map((t, i) => (
                        <div key={i} className="day-trend-col">
                          <div className="bar-wrapper">
                            <div className="trend-bar-fill" style={{ height: `${(t.overall_score / 100) * 120}px` }}>
                              <span className="bar-val">{t.overall_score}</span>
                            </div>
                          </div>
                          <span className="day-label">{new Date(t.date).toLocaleDateString("en-US", { weekday: "short" })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestone & Gamification Badges */}
                <div className="badges-section">
                  <h3>🏆 Achievement Milestones & Badges</h3>
                  <div className="badges-grid">
                    {progressData.badges.map((b, i) => (
                      <div key={i} className="badge-card unlocked">
                        <div className="badge-icon">{b.icon}</div>
                        <h4>{b.name}</h4>
                        <p>{b.desc}</p>
                        <span className="unlocked-tag">✅ Unlocked</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Executive Progress Report */}
                {progressReport && (
                  <div className="progress-report-card">
                    <div className="report-top">
                      <span className="period-badge">{progressReport.period}</span>
                      <h3>Executive Coach Appraisal</h3>
                    </div>
                    <p className="lead">{progressReport.summary}</p>

                    <div className="strengths-box">
                      <b>🌟 Demonstrable Strengths:</b>
                      <ul>
                        {progressReport.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="improvements-box">
                      <b>🎯 High-Impact Growth Focus:</b>
                      <ul>
                        {progressReport.key_growth_areas.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="homework-box">
                      <b>🚀 14-Day Next Goal Milestones:</b>
                      <ul>
                        {progressReport.recommended_next_goals.map((goal, i) => (
                          <li key={i}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p>No progress snapshot available. Complete your initial speaking assessment to activate analytics.</p>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* TAB 11: SESSION REPORT */}
        {activeTab === "report" && sessionReport && (
          <section className="hero report-section">
            <p className="eyebrow">SESSION COMPLETION DIAGNOSTIC</p>
            <h1>Session Summary & Performance</h1>
            <p className="lead">{sessionReport.summary}</p>

            <div className="scores">
              {Object.entries(sessionReport.scores).map(([label, value]) => (
                <div key={label} className="score-card">
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="report-block">
              <h3>🌟 Observed Strengths</h3>
              <ul>
                {sessionReport.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="report-block">
              <h3>💡 Key Corrections Analyzed</h3>
              <div className="corrections-list">
                {sessionReport.key_corrections.map((c, i) => (
                  <div key={i} className="report-correction-item">
                    <p><b>Original:</b> “{c.original}”</p>
                    <p className="green-text"><b>Try Saying:</b> “{c.correction}”</p>
                    {c.explanation && <small>{c.explanation}</small>}
                  </div>
                ))}
              </div>
            </div>

            {sessionReport.vocabulary_captured?.length > 0 && (
              <div className="report-block">
                <h3>📚 New Vocabulary Extracted</h3>
                <div className="vocab-chips">
                  {sessionReport.vocabulary_captured.map((v, i) => (
                    <div key={i} className="chip">
                      <b>{v.word}</b>: {v.meaning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="homework-box">
              <b>📝 Recommended Homework for Tomorrow:</b>
              <p>{sessionReport.recommended_exercise}</p>
            </div>

            <button className="primary-btn wide" onClick={() => setActiveTab("home")}>
              ← Return to Today's Dashboard
            </button>
          </section>
        )}

        {/* TAB 12: SETTINGS & PRIVACY (PHASE 8) */}
        {activeTab === "settings" && (
          <section className="hero settings-section">
            <p className="eyebrow">COACH PREFERENCES & PRIVACY CONTROLS</p>
            <h1>Personalize Your Experience</h1>
            <p className="lead">Configure coach voice characteristics, speech tempo, explanation languages, and data retention policies.</p>

            <div className="settings-grid">
              {/* Voice & Personality Card */}
              <div className="settings-card">
                <h3>🎙️ AI Voice & Speaking Style</h3>
                <p className="card-sub">Choose how your AI coach speaks to you during guided drills and roleplays.</p>

                <div className="setting-field">
                  <label><b>Coach Voice & Accent:</b></label>
                  <select
                    value={settings.coach_voice}
                    onChange={(e) => setSettings((prev) => ({ ...prev, coach_voice: e.target.value }))}
                  >
                    <option value="Natural US (Standard)">🇺🇸 Natural US (Standard) - Balanced & Articulate</option>
                    <option value="Natural US Female">🇺🇸 Natural US Female - Warm & Encouraging</option>
                    <option value="Professional British (Oliver)">🇬🇧 Professional British (Oliver) - Formal & Polished</option>
                    <option value="Australian Clear (Jack)">🇦🇺 Australian Clear (Jack) - Friendly & Conversational</option>
                  </select>
                </div>

                <div className="setting-field">
                  <label><b>Coach Speech Tempo / Pace:</b></label>
                  <div className="duration-pills mini">
                    {[
                      { label: "0.75x Slow", val: 0.75 },
                      { label: "1.0x Normal", val: 1.0 },
                      { label: "1.25x Brisk", val: 1.25 }
                    ].map((p) => (
                      <button
                        key={p.label}
                        className={settings.speech_pace === p.val ? "pill active" : "pill"}
                        onClick={() => setSettings((prev) => ({ ...prev, speech_pace: p.val }))}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-field">
                  <label><b>Test Current Voice Settings:</b></label>
                  <button
                    className="secondary-btn"
                    onClick={() => speak("Hello! I am your AI English coach. Let's practice speaking with confidence today.", settings.speech_pace)}
                  >
                    🔊 Test Voice Output
                  </button>
                </div>
              </div>

              {/* Language & Feedback Card */}
              <div className="settings-card">
                <h3>🌐 Guidance & Feedback Style</h3>
                <p className="card-sub">Control clarification languages and how strictly the AI critiques your speech.</p>

                <div className="setting-field">
                  <label><b>Support / Explanation Language:</b></label>
                  <select
                    value={settings.explanation_language}
                    onChange={(e) => setSettings((prev) => ({ ...prev, explanation_language: e.target.value }))}
                  >
                    <option value="Tamil">தமிழ் (Tamil) - Recommended for bilingual explanations</option>
                    <option value="Hindi">हिंदी (Hindi)</option>
                    <option value="Telugu">తెలుగు (Telugu)</option>
                    <option value="English">English Only (Immersion Mode)</option>
                  </select>
                </div>

                <div className="setting-field">
                  <label><b>Correction Style & Rigor:</b></label>
                  <select
                    value={settings.correction_style}
                    onChange={(e) => setSettings((prev) => ({ ...prev, correction_style: e.target.value }))}
                  >
                    <option value="Balanced & Encouraging">Balanced & Encouraging (Prioritizes flow & key errors)</option>
                    <option value="Detailed & Grammatical">Detailed & Grammatical (In-depth syntax explanations)</option>
                    <option value="Direct & Strict">Direct & Strict (Flags every slight inaccuracy)</option>
                  </select>
                </div>
              </div>

              {/* Privacy & Audio Retention Card */}
              <div className="settings-card">
                <h3>🔒 Privacy & Audio Retention</h3>
                <p className="card-sub">All voice synthesis runs locally in your browser. Configure server-side retention of logs.</p>

                <div className="setting-field">
                  <label><b>Audio & Practice Retention:</b></label>
                  <select
                    value={settings.audio_retention_days}
                    onChange={(e) => setSettings((prev) => ({ ...prev, audio_retention_days: Number(e.target.value) }))}
                  >
                    <option value={0}>0 Days (Immediate Discard / Zero Retention)</option>
                    <option value={7}>7 Days (Recommended for weekly trend analysis)</option>
                    <option value={30}>30 Days (Extended monthly analytics)</option>
                  </select>
                </div>

                <div className="privacy-badge-box">
                  <p>🛡️ <b>Privacy Guarantee:</b> Your voice is processed securely for coaching. We never sell learner data or share speech transcripts with third-party advertisers.</p>
                </div>
              </div>

              {/* Data Portability & Danger Zone */}
              <div className="settings-card danger-card">
                <h3>📦 Data Portability & Management</h3>
                <p className="card-sub">Export your entire learning history or clear your personal practice records.</p>

                <div className="action-row">
                  <button className="secondary-btn" disabled={exportingData} onClick={exportUserData}>
                    {exportingData ? "Exporting…" : "📥 Export My Learning Data (.json)"}
                  </button>
                  <button className="danger-btn" disabled={resettingData} onClick={resetUserData}>
                    {resettingData ? "Resetting…" : "🗑️ Reset My Learning Data"}
                  </button>
                </div>
              </div>
            </div>

            {settingsSuccess && <p className="success-banner">{settingsSuccess}</p>}
            {error && <p className="error">{error}</p>}

            <div className="settings-footer-btn-row">
              <button className="primary-btn large" disabled={savingSettings} onClick={saveSettings}>
                {savingSettings ? "Saving Settings…" : "💾 Save Settings & Preferences"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
