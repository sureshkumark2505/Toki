from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime

class Onboard(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    native_language: str = "Tamil"
    goal: str = "Communication"
    daily_minutes: int = Field(default=20, ge=10, le=45)

class UserProfileResponse(BaseModel):
    id: int
    name: str
    native_language: str
    goal: str
    daily_minutes: int
    xp: int
    streak_days: int
    target_level: str
    created_at: str | None = None

class UserProfileUpdate(BaseModel):
    name: str | None = None
    native_language: str | None = None
    goal: str | None = None
    daily_minutes: int | None = None
    target_level: str | None = None

class SessionHistoryItem(BaseModel):
    id: int
    kind: str
    objective: str
    started_at: str
    ended_at: str | None = None
    duration_minutes: int
    turn_count: int
    fluency_score: int
    grammar_score: int
    summary: str
    strengths: list[str] = Field(default_factory=list)

class StartSession(BaseModel):
    user_id: int
    kind: Literal["guided", "free_speaking", "scenario", "interview"] = "guided"
    objective: str = Field(default="Speak naturally about your day", max_length=240)

class CoachTurn(BaseModel):
    transcript: str = Field(min_length=1, max_length=4000)

class CoachReply(BaseModel):
    reply: str
    correction: str | None = None
    explanation: str | None = None
    next_prompt: str

class AssessmentAnswer(BaseModel):
    prompt_id: int = Field(ge=0, le=4)
    transcript: str = Field(min_length=3, max_length=4000)

class AssessmentComplete(BaseModel):
    user_id: int
    answers: list[AssessmentAnswer] = Field(min_length=3, max_length=5)

class AssessmentResult(BaseModel):
    level: str
    scores: dict[str, int]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    summary: str

class DailyTask(BaseModel):
    title: str
    kind: str
    minutes: int = Field(ge=1, le=20)
    instruction: str

class PlanResult(BaseModel):
    tasks: list[DailyTask]
    generated_reason: str

class TranslationPrompt(BaseModel):
    id: int
    tamil_prompt: str
    english_reference: str
    target_pattern: str

class TranslationEvaluationRequest(BaseModel):
    user_id: int
    tamil_prompt: str
    learner_english: str
    target_pattern: str = ""

class TranslationEvaluationResult(BaseModel):
    natural_english: str
    feedback: str
    explanation: str
    accuracy_score: int
    better_alternatives: list[str]

class VocabularyItem(BaseModel):
    id: int
    word_or_phrase: str
    meaning: str
    example: str
    learner_usage: str = ""
    mastery: int
    next_review: datetime

class VocabularyCreate(BaseModel):
    user_id: int
    word_or_phrase: str
    meaning: str
    example: str
    learner_usage: str = ""

class ReviewItem(BaseModel):
    id: int
    category: str
    original: str
    correction: str
    explanation: str
    mastery: int
    frequency: int

class ReviewAnswer(BaseModel):
    mistake_id: int
    spoken_correction: str

class ReviewResult(BaseModel):
    is_correct: bool
    mastery: int
    next_review_days: int
    coach_feedback: str
    model_sentence: str

class SessionReportResponse(BaseModel):
    session_id: int
    summary: str
    turn_count: int
    scores: dict[str, int]
    strengths: list[str]
    key_corrections: list[dict[str, str]]
    vocabulary_captured: list[dict[str, str]]
    recommended_exercise: str
    streak_counted: bool = False
    streak_days: int = 0
    xp_earned: int = 0
    practice_message: str = ""

# ----------------- PHASE 5: SCENARIOS & ROLEPLAY -----------------
class ScenarioItem(BaseModel):
    id: int
    title: str
    category: str
    level: str
    role: str
    learner_role: str
    objective: str
    description: str
    initial_prompt: str
    difficulty: str

class StartScenarioRequest(BaseModel):
    user_id: int
    scenario_id: int

class StartScenarioResponse(BaseModel):
    session_id: int
    scenario: ScenarioItem
    opening: str

class ScenarioTurnResponse(BaseModel):
    reply: str
    role_character: str
    coaching_tip: str | None = None

class ScenarioReportResponse(BaseModel):
    session_id: int
    scenario_title: str
    communication_score: int
    scores: dict[str, int]
    strengths: list[str]
    improvements: list[str]
    summary: str

# ----------------- PHASE 5: INTERVIEW COACH -----------------
class StartInterviewRequest(BaseModel):
    user_id: int
    interview_type: str = "HR Round: Introduction & Fit"
    target_role: str = "Software Professional"

class StartInterviewResponse(BaseModel):
    session_id: int
    attempt_number: int
    interview_type: str
    opening: str

class InterviewAttemptItem(BaseModel):
    id: int
    attempt_number: int
    interview_type: str
    scores: dict[str, int]
    summary: str
    strengths: list[str]
    improvements: list[str]
    created_at: datetime

class EndInterviewResponse(BaseModel):
    attempt_id: int
    attempt_number: int
    interview_type: str
    scores: dict[str, int]
    summary: str
    strengths: list[str]
    improvements: list[str]

class InterviewComparisonRequest(BaseModel):
    user_id: int
    attempt_id_1: int
    attempt_id_2: int

class InterviewComparisonResponse(BaseModel):
    attempt_1: InterviewAttemptItem
    attempt_2: InterviewAttemptItem
    score_diffs: dict[str, int]
    key_gains: list[str]
    remaining_focus: list[str]
    coach_verdict: str

# ----------------- PHASE 5: FREE SPEAKING / EXTEMPORE -----------------
class ExtemporeTopicItem(BaseModel):
    id: int
    category: str
    topic: str
    guidance_questions: list[str]

class ExtemporeEvaluationRequest(BaseModel):
    user_id: int
    topic: str
    duration_seconds: int
    transcript: str

class ExtemporeEvaluationResponse(BaseModel):
    topic: str
    duration_seconds: int
    word_count: int
    estimated_wpm: int
    scores: dict[str, int]
    structure_feedback: dict[str, str]  # introduction, body, conclusion
    filler_words_detected: list[dict[str, str | int]]
    strengths: list[str]
    improvements: list[str]
    recommended_exercise: str

# ----------------- PHASE 6: LISTENING & DICTATION -----------------
class ListeningQuestionItem(BaseModel):
    question: str
    options: list[str]
    correct_idx: int
    explanation: str

class ListeningExerciseItem(BaseModel):
    id: int
    title: str
    category: str
    level: str
    audio_script: str
    questions: list[ListeningQuestionItem]
    dictation_sentence: str
    difficulty: str

class ListeningEvaluationRequest(BaseModel):
    user_id: int
    exercise_id: int
    selected_answers: list[int]

class ListeningEvaluationResponse(BaseModel):
    exercise_id: int
    score: int
    total_questions: int
    correct_count: int
    explanations: list[str]
    feedback: str
    xp_earned: int

class DictationPromptItem(BaseModel):
    id: int
    title: str
    category: str
    level: str
    dictation_sentence: str

class WordDiffItem(BaseModel):
    word: str
    status: str  # correct, missing, extra, typo

class DictationEvaluationRequest(BaseModel):
    user_id: int
    exercise_id: int = 0
    original_text: str
    learner_input: str

class DictationEvaluationResponse(BaseModel):
    accuracy_score: int
    word_diffs: list[WordDiffItem]
    feedback: str
    correct_transcription: str
    xp_earned: int

# ----------------- PHASE 7: PROGRESS & GAMIFICATION -----------------
class MetricTrendItem(BaseModel):
    date: str
    fluency: int
    grammar: int
    vocab: int
    clarity: int
    listening: int
    confidence: int
    overall_score: int

class ProgressDashboardResponse(BaseModel):
    overall_score: int
    level: str
    current_scores: dict[str, int]
    baseline_scores: dict[str, int]
    score_changes: dict[str, int]
    total_speaking_minutes: int
    sessions_completed: int
    streak_days: int
    xp: int
    badges: list[dict[str, str]]
    recurring_mistakes_count: int
    words_mastered_count: int

class WeeklyTrendResponse(BaseModel):
    user_id: int
    daily_trends: list[MetricTrendItem]
    total_minutes_week: int
    consistency_rate: int
    coach_weekly_summary: str

class ProgressReportResponse(BaseModel):
    user_id: int
    period: str
    summary: str
    strengths: list[str]
    key_growth_areas: list[str]
    baseline_vs_current: dict[str, int]
    recommended_next_goals: list[str]

# ----------------- PHASE 8: SETTINGS, PRIVACY & OBSERVABILITY -----------------
class UserSettingsResponse(BaseModel):
    user_id: int
    coach_voice: str
    speech_pace: float
    correction_style: str
    explanation_language: str
    audio_retention_days: int
    sound_effects_enabled: bool
    updated_at: datetime | None = None

class UserSettingsUpdate(BaseModel):
    coach_voice: str | None = None
    speech_pace: float | None = None
    correction_style: str | None = None
    explanation_language: str | None = None
    audio_retention_days: int | None = None
    sound_effects_enabled: bool | None = None

class UserDataExportResponse(BaseModel):
    user: dict
    settings: dict
    learning_profile: dict | None
    sessions_count: int
    sessions: list[dict]
    mistakes_count: int
    mistakes: list[dict]
    vocabulary_count: int
    vocabulary: list[dict]
    dictation_attempts_count: int
    exported_at: str

class SystemMetricsResponse(BaseModel):
    status: str
    version: str
    total_users: int
    total_sessions: int
    total_turns: int
    total_mistakes_logged: int
    total_vocab_words: int
    ai_provider: str
    audio_retention_policy: str


