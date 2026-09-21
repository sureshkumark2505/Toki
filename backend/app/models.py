from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    native_language: Mapped[str] = mapped_column(String(40), default="Tamil")
    goal: Mapped[str] = mapped_column(String(80), default="Communication")
    daily_minutes: Mapped[int] = mapped_column(Integer, default=20)
    xp: Mapped[int] = mapped_column(Integer, default=100)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_practice_date: Mapped[str] = mapped_column(String(10), default="")
    badges: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(40), default="guided")
    objective: Mapped[str] = mapped_column(String(240))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class Turn(Base):
    __tablename__ = "turns"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    speaker: Mapped[str] = mapped_column(String(20))
    transcript: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Mistake(Base):
    __tablename__ = "mistakes"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(60), default="grammar")
    pattern: Mapped[str] = mapped_column(String(120), default="general")
    original: Mapped[str] = mapped_column(Text)
    correction: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    mastery: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    next_review: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Vocabulary(Base):
    __tablename__ = "vocabulary"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    word_or_phrase: Mapped[str] = mapped_column(String(120))
    meaning: Mapped[str] = mapped_column(Text)
    example: Mapped[str] = mapped_column(Text)
    learner_usage: Mapped[str] = mapped_column(Text, default="")
    mastery: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    next_review: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SessionFeedback(Base):
    __tablename__ = "session_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    summary: Mapped[str] = mapped_column(Text)
    fluency_score: Mapped[int] = mapped_column(Integer, default=75)
    grammar_score: Mapped[int] = mapped_column(Integer, default=75)
    vocab_score: Mapped[int] = mapped_column(Integer, default=75)
    clarity_score: Mapped[int] = mapped_column(Integer, default=75)
    confidence_score: Mapped[int] = mapped_column(Integer, default=75)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    key_corrections: Mapped[list] = mapped_column(JSON, default=list)
    vocabulary_captured: Mapped[list] = mapped_column(JSON, default=list)
    recommended_exercise: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class LearningProfile(Base):
    __tablename__ = "learning_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    level: Mapped[str] = mapped_column(String(30), default="Developing")
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    baseline_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AssessmentReport(Base):
    __tablename__ = "assessment_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    answers: Mapped[list] = mapped_column(JSON, default=list)
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DailyPlan(Base):
    __tablename__ = "daily_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String(10), index=True)
    tasks: Mapped[list] = mapped_column(JSON, default=list)
    generated_reason: Mapped[str] = mapped_column(Text)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))  # Workplace, Travel & Hospitality, Daily Life, Customer Service
    level: Mapped[str] = mapped_column(String(30), default="Intermediate")
    role: Mapped[str] = mapped_column(String(80))  # AI role (e.g., Client, Receptionist)
    learner_role: Mapped[str] = mapped_column(String(80))  # User role (e.g., Project Lead, Hotel Guest)
    objective: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    initial_prompt: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(30), default="Medium")  # Easy, Medium, Hard

class InterviewAttempt(Base):
    __tablename__ = "interview_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    interview_type: Mapped[str] = mapped_column(String(80))  # HR Behavioral, Technical, Salary Negotiation, Self-Intro
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    scores: Mapped[dict] = mapped_column(JSON, default=dict)  # clarity, structure, conciseness, confidence, vocabulary, grammar
    summary: Mapped[str] = mapped_column(Text)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ----------------- PHASE 6: LISTENING & DICTATION -----------------
class ListeningExercise(Base):
    __tablename__ = "listening_exercises"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))  # Business, Daily Life, Tech, Travel
    level: Mapped[str] = mapped_column(String(30), default="Intermediate")
    audio_script: Mapped[str] = mapped_column(Text)  # Spoken by TTS
    questions: Mapped[list] = mapped_column(JSON, default=list)  # list of {question, options, correct_idx, explanation}
    dictation_sentence: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(30), default="Medium")

class DictationAttempt(Base):
    __tablename__ = "dictation_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    exercise_id: Mapped[int] = mapped_column(Integer, default=0)
    original_text: Mapped[str] = mapped_column(Text)
    learner_input: Mapped[str] = mapped_column(Text)
    accuracy_score: Mapped[int] = mapped_column(Integer, default=0)
    feedback: Mapped[str] = mapped_column(Text, default="")
    word_diffs: Mapped[list] = mapped_column(JSON, default=list)  # list of {word, status: correct|missing|extra|typo}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ----------------- PHASE 7: PROGRESS SNAPSHOTS -----------------
class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String(10), index=True)
    fluency: Mapped[int] = mapped_column(Integer, default=75)
    grammar: Mapped[int] = mapped_column(Integer, default=75)
    vocab: Mapped[int] = mapped_column(Integer, default=75)
    clarity: Mapped[int] = mapped_column(Integer, default=75)
    listening: Mapped[int] = mapped_column(Integer, default=75)
    confidence: Mapped[int] = mapped_column(Integer, default=75)
    overall_score: Mapped[int] = mapped_column(Integer, default=75)
    speaking_minutes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ----------------- PHASE 8: USER SETTINGS & PRIVACY -----------------
class UserSettings(Base):
    __tablename__ = "user_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    coach_voice: Mapped[str] = mapped_column(String(60), default="Natural US (Standard)")
    speech_pace: Mapped[float] = mapped_column(Float, default=1.0)
    correction_style: Mapped[str] = mapped_column(String(60), default="Balanced & Encouraging")
    explanation_language: Mapped[str] = mapped_column(String(40), default="Tamil")
    audio_retention_days: Mapped[int] = mapped_column(Integer, default=7)
    sound_effects_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


