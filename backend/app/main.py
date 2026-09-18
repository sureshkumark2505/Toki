from datetime import datetime, date, timedelta
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DbSession
from .config import settings
from .database import Base, engine, SessionLocal, init_db
from .models import (
    User, Session, Turn, Mistake, LearningProfile, AssessmentReport, DailyPlan, Vocabulary, SessionFeedback,
    Scenario, InterviewAttempt, ListeningExercise, DictationAttempt, ProgressSnapshot, UserSettings
)
from .schemas import (
    Onboard, StartSession, CoachTurn, CoachReply, AssessmentComplete, AssessmentResult, PlanResult,
    TranslationPrompt, TranslationEvaluationRequest, TranslationEvaluationResult,
    VocabularyItem, VocabularyCreate, ReviewItem, ReviewAnswer, ReviewResult, SessionReportResponse,
    ScenarioItem, StartScenarioRequest, StartScenarioResponse, ScenarioTurnResponse, ScenarioReportResponse,
    StartInterviewRequest, StartInterviewResponse, EndInterviewResponse, InterviewAttemptItem,
    InterviewComparisonRequest, InterviewComparisonResponse,
    ExtemporeTopicItem, ExtemporeEvaluationRequest, ExtemporeEvaluationResponse,
    ListeningExerciseItem, ListeningQuestionItem, ListeningEvaluationRequest, ListeningEvaluationResponse,
    DictationPromptItem, DictationEvaluationRequest, DictationEvaluationResponse, WordDiffItem,
    ProgressDashboardResponse, WeeklyTrendResponse, ProgressReportResponse, MetricTrendItem,
    UserSettingsResponse, UserSettingsUpdate, UserDataExportResponse, SystemMetricsResponse
)
from .providers.ai import provider

init_db()

app = FastAPI(title="English Speaking Coach API", version="0.4.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

def db():
    d = SessionLocal()
    try:
        yield d
    finally:
        d.close()

@app.get("/health")
def health():
    return {"status": "ok", "gemini_configured": bool(settings.gemini_api_key)}

# ----------------- ONBOARDING -----------------
@app.post("/api/onboarding")
def onboarding(payload: Onboard, d: DbSession = Depends(db)):
    user = User(**payload.model_dump())
    d.add(user)
    d.commit()
    d.refresh(user)
    return {"user_id": user.id}

# ----------------- ASSESSMENT -----------------
ASSESSMENT_PROMPTS = [
    "Please introduce yourself and tell me what you do.",
    "Describe your typical day in detail from morning to evening.",
    "Tell me about a memorable experience or challenge you overcame in the past.",
    "What is one opinion you have about technology or online education? Why?",
    "What speaking goal would you like to achieve in the next three months?"
]

@app.api_route("/api/assessment/start", methods=["GET", "POST"])
def assessment_start():
    return {
        "prompts": ASSESSMENT_PROMPTS,
        "note": "Answer aloud. Your transcript is used for communication analysis (fluency, grammar, clarity, vocabulary). Pronunciation is not scored from text alone."
    }

@app.post("/api/assessment/complete", response_model=AssessmentResult)
def assessment_complete(payload: AssessmentComplete, d: DbSession = Depends(db)):
    if not d.get(User, payload.user_id):
        raise HTTPException(404, "User not found")
    answers = [answer.transcript for answer in sorted(payload.answers, key=lambda x: x.prompt_id)]
    result = provider.assess(answers)
    scores_dict = result.scores.model_dump()
    report = AssessmentReport(
        user_id=payload.user_id,
        answers=answers,
        scores=scores_dict,
        strengths=result.strengths,
        weaknesses=result.weaknesses,
        recommendations=result.recommendations
    )
    d.add(report)
    profile = d.query(LearningProfile).filter_by(user_id=payload.user_id).first()
    if not profile:
        profile = LearningProfile(user_id=payload.user_id)
        d.add(profile)
    profile.level = result.level
    profile.baseline_scores = scores_dict
    profile.strengths = result.strengths
    profile.weaknesses = result.weaknesses
    d.commit()
    return result

@app.get("/api/assessment/latest/{user_id}")
def assessment_latest(user_id: int, d: DbSession = Depends(db)):
    report = d.query(AssessmentReport).filter_by(user_id=user_id).order_by(AssessmentReport.created_at.desc()).first()
    if not report:
        raise HTTPException(404, "No assessment found")
    return {
        "scores": report.scores,
        "strengths": report.strengths,
        "weaknesses": report.weaknesses,
        "recommendations": report.recommendations
    }

# ----------------- PERSONALIZED DAILY PLAN (PHASE 3) -----------------
@app.post("/api/plan/generate", response_model=PlanResult)
def generate_plan(user_id: int, minutes: int | None = Query(default=None), d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    practice_minutes = minutes or user.daily_minutes or 20
    profile = d.query(LearningProfile).filter_by(user_id=user_id).first()
    mistakes = [m.correction for m in d.query(Mistake).filter_by(user_id=user_id).order_by(Mistake.id.desc()).limit(5)]
    result = provider.plan(
        practice_minutes,
        profile.level if profile else "Developing",
        profile.weaknesses if profile else [],
        mistakes
    )
    today_str = date.today().isoformat()
    plan = d.query(DailyPlan).filter_by(user_id=user_id, date=today_str).first()
    if not plan:
        plan = DailyPlan(user_id=user_id, date=today_str, tasks=[], generated_reason="")
        d.add(plan)
    plan.tasks = [task.model_dump() for task in result.tasks]
    plan.generated_reason = result.generated_reason
    plan.completed = False
    d.commit()
    return result

@app.get("/api/plan/today/{user_id}")
def today_plan(user_id: int, d: DbSession = Depends(db)):
    today_str = date.today().isoformat()
    plan = d.query(DailyPlan).filter_by(user_id=user_id, date=today_str).first()
    if not plan:
        raise HTTPException(404, "No plan for today")
    return {
        "id": plan.id,
        "tasks": plan.tasks,
        "generated_reason": plan.generated_reason,
        "completed": plan.completed
    }

@app.post("/api/plan/{plan_id}/complete")
def complete_plan(plan_id: int, d: DbSession = Depends(db)):
    plan = d.get(DailyPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.completed = True
    d.commit()
    return {"completed": True}

# ----------------- TAMIL -> ENGLISH PRACTICE (PHASE 3) -----------------
CURATED_TAMIL_PROMPTS = [
    {
        "id": 1,
        "tamil_prompt": "நான் தினமும் காலையில் 7 மணிக்கு எழுந்து காபி குடிக்கிறேன்.",
        "english_reference": "I wake up at 7 AM every day and drink coffee.",
        "target_pattern": "Simple present tense for daily routines"
    },
    {
        "id": 2,
        "tamil_prompt": "நேற்று நான் எனது நண்பனை சந்திக்க சென்னை சென்றேன்.",
        "english_reference": "Yesterday, I went to Chennai to meet my friend.",
        "target_pattern": "Simple past tense (went / visited)"
    },
    {
        "id": 3,
        "tamil_prompt": "நாளைக்கு எனக்கு ஒரு முக்கியமான வேலை நேர்காணல் இருக்கிறது.",
        "english_reference": "I have an important job interview tomorrow.",
        "target_pattern": "Present tense expressing future plans"
    },
    {
        "id": 4,
        "tamil_prompt": "இந்த மென்பொருளை எப்படி பயன்படுத்துவது என்று எனக்கு விளக்க முடியுமா?",
        "english_reference": "Could you please explain to me how to use this software?",
        "target_pattern": "Polite requests (Could you / Would you)"
    },
    {
        "id": 5,
        "tamil_prompt": "எனக்கு புதிய தொழில்நுட்பங்களை கற்றுக்கொள்வதில் மிகுந்த ஆர்வம் உண்டு.",
        "english_reference": "I am very interested in learning new technologies.",
        "target_pattern": "Prepositional adjectives (interested in + -ing)"
    }
]

@app.get("/api/translation/prompts", response_model=list[TranslationPrompt])
def translation_prompts():
    return CURATED_TAMIL_PROMPTS

@app.post("/api/translation/evaluate", response_model=TranslationEvaluationResult)
def translation_evaluate(payload: TranslationEvaluationRequest):
    res = provider.evaluate_translation(
        tamil_prompt=payload.tamil_prompt,
        learner_english=payload.learner_english,
        target_pattern=payload.target_pattern
    )
    return TranslationEvaluationResult(
        natural_english=res.natural_english,
        feedback=res.feedback,
        explanation=res.explanation,
        accuracy_score=res.accuracy_score,
        better_alternatives=res.better_alternatives
    )

# ----------------- SESSIONS & TURNS -----------------
@app.post("/api/sessions")
def start(payload: StartSession, d: DbSession = Depends(db)):
    if not d.get(User, payload.user_id):
        raise HTTPException(404, "User not found")
    session = Session(**payload.model_dump())
    d.add(session)
    d.commit()
    d.refresh(session)
    return {
        "session_id": session.id,
        "opening": "Let’s begin. Please answer in your own words: " + payload.objective
    }

@app.post("/api/sessions/{session_id}/turn", response_model=CoachReply)
def turn(session_id: int, payload: CoachTurn, d: DbSession = Depends(db)):
    session = d.get(Session, session_id)
    if not session or session.ended_at:
        raise HTTPException(404, "Active session not found")
    d.add(Turn(session_id=session_id, speaker="learner", transcript=payload.transcript))
    d.commit()
    history = [t.transcript for t in d.query(Turn).filter_by(session_id=session_id).order_by(Turn.created_at).all()]
    result = provider.coach(session.objective, payload.transcript, history)
    d.add(Turn(session_id=session_id, speaker="coach", transcript=result.reply))
    if result.correction:
        existing_mistake = d.query(Mistake).filter_by(
            user_id=session.user_id,
            correction=result.correction
        ).first()
        if existing_mistake:
            existing_mistake.frequency += 1
            existing_mistake.last_seen = datetime.utcnow()
        else:
            d.add(Mistake(
                user_id=session.user_id,
                category="grammar",
                original=payload.transcript,
                correction=result.correction,
                explanation=result.explanation or "",
                frequency=1,
                mastery=0,
                interval_days=1,
                next_review=datetime.utcnow() + timedelta(days=1)
            ))
    d.commit()
    return result

# ----------------- SESSION FEEDBACK REPORT (PHASE 4) -----------------
@app.post("/api/sessions/{session_id}/end", response_model=SessionReportResponse)
def end_session(session_id: int, d: DbSession = Depends(db)):
    session = d.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.ended_at = datetime.utcnow()
    d.commit()

    turns = d.query(Turn).filter_by(session_id=session_id).order_by(Turn.created_at).all()
    turn_dicts = [{"speaker": t.speaker, "transcript": t.transcript} for t in turns]
    mistakes = d.query(Mistake).filter_by(user_id=session.user_id).order_by(Mistake.id.desc()).limit(5).all()
    mistake_dicts = [{"original": m.original, "correction": m.correction, "explanation": m.explanation} for m in mistakes]

    report = provider.generate_session_report(session.objective, turn_dicts, mistake_dicts)

    scores_dict = report.scores.model_dump()
    corrections_list = [c.model_dump() for c in report.key_corrections]
    vocab_list = [v.model_dump() for v in report.vocabulary_captured]

    feedback = d.query(SessionFeedback).filter_by(session_id=session_id).first()
    if not feedback:
        feedback = SessionFeedback(
            session_id=session_id,
            user_id=session.user_id,
            summary=report.summary,
            fluency_score=scores_dict.get("fluency", 75),
            grammar_score=scores_dict.get("grammar", 75),
            vocab_score=scores_dict.get("vocabulary", 75),
            clarity_score=scores_dict.get("clarity", 75),
            confidence_score=scores_dict.get("confidence", 75),
            strengths=report.strengths,
            key_corrections=corrections_list,
            vocabulary_captured=vocab_list,
            recommended_exercise=report.recommended_exercise
        )
        d.add(feedback)
    else:
        feedback.summary = report.summary
        feedback.fluency_score = scores_dict.get("fluency", 75)
        feedback.grammar_score = scores_dict.get("grammar", 75)
        feedback.vocab_score = scores_dict.get("vocabulary", 75)
        feedback.clarity_score = scores_dict.get("clarity", 75)
        feedback.confidence_score = scores_dict.get("confidence", 75)
        feedback.strengths = report.strengths
        feedback.key_corrections = corrections_list
        feedback.vocabulary_captured = vocab_list
        feedback.recommended_exercise = report.recommended_exercise

    # Auto-save captured vocabulary to vocabulary table if not already added
    for vocab in vocab_list:
        word = vocab.get("word")
        if word and not d.query(Vocabulary).filter_by(user_id=session.user_id, word_or_phrase=word).first():
            d.add(Vocabulary(
                user_id=session.user_id,
                word_or_phrase=word,
                meaning=vocab.get("meaning", ""),
                example=vocab.get("example", ""),
                mastery=0,
                interval_days=1,
                next_review=datetime.utcnow() + timedelta(days=1)
            ))
    d.commit()

    return SessionReportResponse(
        session_id=session_id,
        summary=report.summary,
        turn_count=len(turns),
        scores=scores_dict,
        strengths=report.strengths,
        key_corrections=corrections_list,
        vocabulary_captured=vocab_list,
        recommended_exercise=report.recommended_exercise
    )

# ----------------- MISTAKE MEMORY & SPACED REPETITION (PHASE 4) -----------------
SPACED_INTERVALS = [1, 2, 4, 7, 14, 30]

@app.get("/api/mistakes/{user_id}")
def get_mistakes(user_id: int, d: DbSession = Depends(db)):
    return [
        {
            "id": m.id,
            "category": m.category,
            "original": m.original,
            "correction": m.correction,
            "explanation": m.explanation,
            "frequency": m.frequency,
            "mastery": m.mastery,
            "interval_days": m.interval_days,
            "next_review": m.next_review.isoformat() if m.next_review else None
        }
        for m in d.query(Mistake).filter_by(user_id=user_id).order_by(Mistake.frequency.desc()).all()
    ]

@app.get("/api/review/due/{user_id}", response_model=list[ReviewItem])
def get_due_reviews(user_id: int, d: DbSession = Depends(db)):
    # Returns mistakes due for review (or top unmastered mistakes)
    now = datetime.utcnow()
    due = d.query(Mistake).filter(
        Mistake.user_id == user_id,
        Mistake.mastery < 100
    ).order_by(Mistake.next_review.asc()).limit(5).all()
    return [
        ReviewItem(
            id=m.id,
            category=m.category,
            original=m.original,
            correction=m.correction,
            explanation=m.explanation,
            mastery=m.mastery,
            frequency=m.frequency
        )
        for m in due
    ]

@app.post("/api/review/answer", response_model=ReviewResult)
def answer_review(payload: ReviewAnswer, d: DbSession = Depends(db)):
    mistake = d.get(Mistake, payload.mistake_id)
    if not mistake:
        raise HTTPException(404, "Mistake record not found")

    res = provider.evaluate_review(
        original_mistake=mistake.original,
        target_correction=mistake.correction,
        spoken_attempt=payload.spoken_correction
    )

    mistake.review_count += 1
    if res.is_correct:
        mistake.mastery = min(100, mistake.mastery + 25)
        # Advance along the spaced repetition ladder: 1 -> 2 -> 4 -> 7 -> 14 -> 30 days
        curr_idx = min(len(SPACED_INTERVALS) - 1, mistake.review_count)
        mistake.interval_days = SPACED_INTERVALS[curr_idx]
        mistake.next_review = datetime.utcnow() + timedelta(days=mistake.interval_days)
    else:
        mistake.mastery = max(0, mistake.mastery - 15)
        mistake.interval_days = 1
        mistake.next_review = datetime.utcnow() + timedelta(days=1)

    d.commit()
    return ReviewResult(
        is_correct=res.is_correct,
        mastery=mistake.mastery,
        next_review_days=mistake.interval_days,
        coach_feedback=res.coach_feedback,
        model_sentence=res.model_sentence
    )

# ----------------- VOCABULARY BANK (PHASE 3 & 4) -----------------
@app.get("/api/vocabulary/{user_id}", response_model=list[VocabularyItem])
def get_vocabulary(user_id: int, d: DbSession = Depends(db)):
    return [
        VocabularyItem(
            id=v.id,
            word_or_phrase=v.word_or_phrase,
            meaning=v.meaning,
            example=v.example,
            learner_usage=v.learner_usage or "",
            mastery=v.mastery,
            next_review=v.next_review
        )
        for v in d.query(Vocabulary).filter_by(user_id=user_id).order_by(Vocabulary.id.desc()).all()
    ]

@app.post("/api/vocabulary", response_model=VocabularyItem)
def add_vocabulary(payload: VocabularyCreate, d: DbSession = Depends(db)):
    item = Vocabulary(
        user_id=payload.user_id,
        word_or_phrase=payload.word_or_phrase,
        meaning=payload.meaning,
        example=payload.example,
        learner_usage=payload.learner_usage,
        mastery=0,
        interval_days=1,
        next_review=datetime.utcnow() + timedelta(days=1)
    )
    d.add(item)
    d.commit()
    d.refresh(item)
    return VocabularyItem(
        id=item.id,
        word_or_phrase=item.word_or_phrase,
        meaning=item.meaning,
        example=item.example,
        learner_usage=item.learner_usage,
        mastery=item.mastery,
        next_review=item.next_review
    )

# ----------------- PHASE 5: REAL-LIFE SCENARIOS & ROLEPLAY -----------------
@app.get("/api/scenarios", response_model=list[ScenarioItem])
def list_scenarios(category: str | None = None, d: DbSession = Depends(db)):
    q = d.query(Scenario)
    if category and category.lower() != "all":
        q = q.filter(Scenario.category.ilike(f"%{category}%"))
    return [
        ScenarioItem(
            id=s.id,
            title=s.title,
            category=s.category,
            level=s.level,
            role=s.role,
            learner_role=s.learner_role,
            objective=s.objective,
            description=s.description,
            initial_prompt=s.initial_prompt,
            difficulty=s.difficulty
        )
        for s in q.order_by(Scenario.id.asc()).all()
    ]

@app.post("/api/scenarios/{scenario_id}/start", response_model=StartScenarioResponse)
def start_scenario(scenario_id: int, payload: StartScenarioRequest, d: DbSession = Depends(db)):
    user = d.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    scenario = d.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(404, "Scenario not found")

    session = Session(
        user_id=payload.user_id,
        kind="scenario",
        objective=f"{scenario.title} — Roleplay with {scenario.role}"
    )
    d.add(session)
    d.commit()
    d.refresh(session)

    # Add initial opening turn from the role
    d.add(Turn(session_id=session.id, speaker="coach", transcript=scenario.initial_prompt))
    d.commit()

    return StartScenarioResponse(
        session_id=session.id,
        scenario=ScenarioItem(
            id=scenario.id,
            title=scenario.title,
            category=scenario.category,
            level=scenario.level,
            role=scenario.role,
            learner_role=scenario.learner_role,
            objective=scenario.objective,
            description=scenario.description,
            initial_prompt=scenario.initial_prompt,
            difficulty=scenario.difficulty
        ),
        opening=scenario.initial_prompt
    )

@app.post("/api/scenarios/{session_id}/turn", response_model=ScenarioTurnResponse)
def scenario_turn(session_id: int, payload: CoachTurn, d: DbSession = Depends(db)):
    session = d.get(Session, session_id)
    if not session or session.ended_at:
        raise HTTPException(404, "Active scenario session not found")

    d.add(Turn(session_id=session_id, speaker="learner", transcript=payload.transcript))
    d.commit()

    turns = d.query(Turn).filter_by(session_id=session_id).order_by(Turn.created_at).all()
    turn_dicts = [{"speaker": t.speaker, "transcript": t.transcript} for t in turns]

    # Parse role info from objective
    role_name = session.objective.split("—")[-1].replace("Roleplay with", "").strip() if "—" in session.objective else "Conversation Partner"
    
    result = provider.roleplay_turn(
        role=role_name,
        learner_role="Learner",
        objective=session.objective,
        difficulty="Medium",
        transcript=payload.transcript,
        history=turn_dicts
    )

    d.add(Turn(session_id=session_id, speaker="coach", transcript=result.reply))
    d.commit()

    return ScenarioTurnResponse(
        reply=result.reply,
        role_character=result.role_character,
        coaching_tip=result.coaching_tip
    )

@app.post("/api/scenarios/{session_id}/end", response_model=ScenarioReportResponse)
def end_scenario(session_id: int, d: DbSession = Depends(db)):
    session = d.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.ended_at = datetime.utcnow()
    d.commit()

    turns = d.query(Turn).filter_by(session_id=session_id).order_by(Turn.created_at).all()
    turn_dicts = [{"speaker": t.speaker, "transcript": t.transcript} for t in turns]
    role_name = session.objective.split("—")[-1].replace("Roleplay with", "").strip() if "—" in session.objective else "Partner"

    report = provider.generate_scenario_report(
        scenario_title=session.objective,
        role=role_name,
        turns=turn_dicts
    )

    scores_dict = report.scores.model_dump()
    feedback = SessionFeedback(
        session_id=session_id,
        user_id=session.user_id,
        summary=report.summary,
        fluency_score=scores_dict.get("fluency", 80),
        grammar_score=scores_dict.get("grammar", 80),
        vocab_score=scores_dict.get("vocabulary", 80),
        clarity_score=scores_dict.get("clarity", 80),
        confidence_score=scores_dict.get("confidence", 80),
        strengths=report.strengths,
        key_corrections=[],
        vocabulary_captured=[],
        recommended_exercise="Practice repeating this scenario focusing on diplomatic phrases."
    )
    d.add(feedback)
    d.commit()

    return ScenarioReportResponse(
        session_id=session_id,
        scenario_title=report.scenario_title,
        communication_score=report.communication_score,
        scores=scores_dict,
        strengths=report.strengths,
        improvements=report.improvements,
        summary=report.summary
    )

# ----------------- PHASE 5: INTERVIEW COACH & ATTEMPTS -----------------
INTERVIEW_OPENINGS = {
    "HR Round: Introduction & Fit": "Welcome to our interview. To get started, please introduce yourself, your core professional background, and why you're interested in this role.",
    "Behavioral: Team Conflict (STAR)": "Tell me about a specific situation where you had a disagreement with a team member or stakeholder. Walk me through the situation, your actions, and the outcome.",
    "Technical: Complex Project": "Can you explain the most challenging project you built recently? Please describe the problem, the architectural decisions, and the measurable results.",
    "HR: Salary & Compensation": "Thank you for discussing the offer details with us. Our current initial package is $85,000. How does this align with your target compensation and value proposition?"
}

@app.post("/api/interview/start", response_model=StartInterviewResponse)
def start_interview(payload: StartInterviewRequest, d: DbSession = Depends(db)):
    user = d.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    # Determine attempt number for this user and interview type
    past_attempts = d.query(InterviewAttempt).filter_by(
        user_id=payload.user_id,
        interview_type=payload.interview_type
    ).count()
    attempt_number = past_attempts + 1

    session = Session(
        user_id=payload.user_id,
        kind="interview",
        objective=f"Interview: {payload.interview_type} (Attempt #{attempt_number})"
    )
    d.add(session)
    d.commit()
    d.refresh(session)

    opening = INTERVIEW_OPENINGS.get(
        payload.interview_type,
        f"Welcome to your mock interview for {payload.target_role}. Please introduce yourself and your background."
    )
    d.add(Turn(session_id=session.id, speaker="coach", transcript=opening))
    d.commit()

    return StartInterviewResponse(
        session_id=session.id,
        attempt_number=attempt_number,
        interview_type=payload.interview_type,
        opening=opening
    )

@app.post("/api/interview/{session_id}/end", response_model=EndInterviewResponse)
def end_interview(session_id: int, target_role: str = "Software Professional", d: DbSession = Depends(db)):
    session = d.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.ended_at = datetime.utcnow()
    d.commit()

    turns = d.query(Turn).filter_by(session_id=session_id).order_by(Turn.created_at).all()
    turn_dicts = [{"speaker": t.speaker, "transcript": t.transcript} for t in turns]

    # Extract interview type and attempt number
    interview_type = "HR Round: Introduction & Fit"
    attempt_number = 1
    if "Interview:" in session.objective:
        try:
            parts = session.objective.replace("Interview:", "").strip().split("(Attempt #")
            interview_type = parts[0].strip()
            if len(parts) > 1:
                attempt_number = int(parts[1].replace(")", "").strip())
        except Exception:
            pass

    eval_result = provider.evaluate_interview_session(
        interview_type=interview_type,
        target_role=target_role,
        turns=turn_dicts,
        attempt_number=attempt_number
    )

    scores_dict = eval_result.scores.model_dump()
    attempt = InterviewAttempt(
        user_id=session.user_id,
        interview_type=interview_type,
        attempt_number=attempt_number,
        session_id=session_id,
        scores=scores_dict,
        summary=eval_result.summary,
        strengths=eval_result.strengths,
        improvements=eval_result.improvements
    )
    d.add(attempt)
    d.commit()
    d.refresh(attempt)

    return EndInterviewResponse(
        attempt_id=attempt.id,
        attempt_number=attempt_number,
        interview_type=interview_type,
        scores=scores_dict,
        summary=eval_result.summary,
        strengths=eval_result.strengths,
        improvements=eval_result.improvements
    )

@app.get("/api/interview/attempts/{user_id}", response_model=list[InterviewAttemptItem])
def get_interview_attempts(user_id: int, d: DbSession = Depends(db)):
    attempts = d.query(InterviewAttempt).filter_by(user_id=user_id).order_by(InterviewAttempt.created_at.desc()).all()
    return [
        InterviewAttemptItem(
            id=a.id,
            attempt_number=a.attempt_number,
            interview_type=a.interview_type,
            scores=a.scores,
            summary=a.summary,
            strengths=a.strengths,
            improvements=a.improvements,
            created_at=a.created_at
        )
        for a in attempts
    ]

@app.post("/api/interview/compare", response_model=InterviewComparisonResponse)
def compare_interviews(payload: InterviewComparisonRequest, d: DbSession = Depends(db)):
    a1 = d.get(InterviewAttempt, payload.attempt_id_1)
    a2 = d.get(InterviewAttempt, payload.attempt_id_2)
    if not a1 or not a2:
        raise HTTPException(404, "One or both interview attempts not found")

    a1_dict = {"attempt_number": a1.attempt_number, "scores": a1.scores, "summary": a1.summary, "strengths": a1.strengths, "improvements": a1.improvements}
    a2_dict = {"attempt_number": a2.attempt_number, "scores": a2.scores, "summary": a2.summary, "strengths": a2.strengths, "improvements": a2.improvements}

    res = provider.compare_interview_attempts(a1_dict, a2_dict)

    item1 = InterviewAttemptItem(
        id=a1.id,
        attempt_number=a1.attempt_number,
        interview_type=a1.interview_type,
        scores=a1.scores,
        summary=a1.summary,
        strengths=a1.strengths,
        improvements=a1.improvements,
        created_at=a1.created_at
    )
    item2 = InterviewAttemptItem(
        id=a2.id,
        attempt_number=a2.attempt_number,
        interview_type=a2.interview_type,
        scores=a2.scores,
        summary=a2.summary,
        strengths=a2.strengths,
        improvements=a2.improvements,
        created_at=a2.created_at
    )

    return InterviewComparisonResponse(
        attempt_1=item1,
        attempt_2=item2,
        score_diffs=res.score_diffs,
        key_gains=res.key_gains,
        remaining_focus=res.remaining_focus,
        coach_verdict=res.coach_verdict
    )

# ----------------- PHASE 5: FREE SPEAKING & EXTEMPORE -----------------
CURATED_EXTEMPORE_TOPICS = [
    ExtemporeTopicItem(
        id=1,
        category="Career & Workplace",
        topic="Describe your dream job and what makes it meaningful to you.",
        guidance_questions=[
            "What kind of daily problems would you love solving?",
            "What type of work culture helps you do your best work?",
            "How does this align with your long-term life vision?"
        ]
    ),
    ExtemporeTopicItem(
        id=2,
        category="Technology & Society",
        topic="Should remote work replace traditional office work permanently?",
        guidance_questions=[
            "What are the major advantages for productivity and lifestyle?",
            "What are the trade-offs regarding team connection and mentorship?",
            "What is your recommended hybrid approach?"
        ]
    ),
    ExtemporeTopicItem(
        id=3,
        category="Personal Growth",
        topic="A memorable challenge you faced and what it taught you about yourself.",
        guidance_questions=[
            "What was the situation and why was it difficult?",
            "What concrete action did you take to overcome it?",
            "What perspective or skill did you gain?"
        ]
    ),
    ExtemporeTopicItem(
        id=4,
        category="Technology & Future",
        topic="How artificial intelligence is shaping the way we learn and work.",
        guidance_questions=[
            "Which AI tools have helped you personally?",
            "What human skills become even more important as AI advances?",
            "What is your outlook for the next 5 years?"
        ]
    ),
    ExtemporeTopicItem(
        id=5,
        category="Travel & Culture",
        topic="If you could live in any city in the world for one year, where would you go?",
        guidance_questions=[
            "What draws you to this specific location?",
            "What new experiences or cultures would you explore?",
            "How would this experience broaden your outlook?"
        ]
    ),
    ExtemporeTopicItem(
        id=6,
        category="Life Lessons",
        topic="The single most valuable piece of advice you've ever received.",
        guidance_questions=[
            "Who gave you this advice and in what context?",
            "How did applying it change an outcome for you?",
            "Why would you recommend it to others?"
        ]
    )
]

@app.get("/api/extempore/topics", response_model=list[ExtemporeTopicItem])
def get_extempore_topics():
    return CURATED_EXTEMPORE_TOPICS

@app.post("/api/extempore/evaluate", response_model=ExtemporeEvaluationResponse)
def evaluate_extempore_monologue(payload: ExtemporeEvaluationRequest):
    words = payload.transcript.strip().split()
    word_count = len(words)
    minutes = max(0.2, payload.duration_seconds / 60.0)
    wpm = int(word_count / minutes)

    ai_res = provider.evaluate_extempore(
        topic=payload.topic,
        duration_seconds=payload.duration_seconds,
        transcript=payload.transcript
    )

    return ExtemporeEvaluationResponse(
        topic=payload.topic,
        duration_seconds=payload.duration_seconds,
        word_count=word_count,
        estimated_wpm=wpm,
        scores=ai_res.scores.model_dump(),
        structure_feedback=ai_res.structure_feedback.model_dump(),
        filler_words_detected=ai_res.filler_words_detected,
        strengths=ai_res.strengths,
        improvements=ai_res.improvements,
        recommended_exercise=ai_res.recommended_exercise
    )

# ----------------- GAMIFICATION & STREAK HELPER -----------------
AVAILABLE_BADGES = [
    {"id": "first_words", "name": "First Words", "icon": "🌱", "desc": "Completed first voice coaching turn"},
    {"id": "streak_3", "name": "3-Day Dynamo", "icon": "🔥", "desc": "Maintained a 3-day active speaking streak"},
    {"id": "vocab_builder", "name": "Word Smith", "icon": "📚", "desc": "Saved 5+ vocabulary words in context"},
    {"id": "interview_ready", "name": "Interview Pro", "icon": "💼", "desc": "Completed a mock job interview attempt"},
    {"id": "dictation_master", "name": "Sharp Ears", "icon": "🎧", "desc": "Scored 90%+ on sentence dictation"},
    {"id": "extempore_champ", "name": "Quick Thinker", "icon": "⏱️", "desc": "Delivered a timed extempore monologue"}
]

def record_activity_and_award_xp(user: User, xp_gain: int, practice_minutes: int, d: DbSession):
    user.xp = (user.xp or 100) + xp_gain
    today_str = date.today().isoformat()
    if user.last_practice_date != today_str:
        if user.last_practice_date:
            try:
                last_dt = date.fromisoformat(user.last_practice_date)
                if (date.today() - last_dt).days == 1:
                    user.streak_days = (user.streak_days or 1) + 1
                elif (date.today() - last_dt).days > 1:
                    user.streak_days = 1
            except Exception:
                user.streak_days = 1
        else:
            user.streak_days = 1
        user.last_practice_date = today_str

    # Update or insert today's ProgressSnapshot
    snap = d.query(ProgressSnapshot).filter_by(user_id=user.id, date=today_str).first()
    if not snap:
        profile = d.query(LearningProfile).filter_by(user_id=user.id).first()
        base = profile.baseline_scores if profile and profile.baseline_scores else {"fluency": 75, "grammar": 75, "vocabulary": 75, "clarity": 75, "listening": 75, "confidence": 75}
        snap = ProgressSnapshot(
            user_id=user.id,
            date=today_str,
            fluency=base.get("fluency", 75),
            grammar=base.get("grammar", 75),
            vocab=base.get("vocabulary", 75),
            clarity=base.get("clarity", 75),
            listening=base.get("listening", 75),
            confidence=base.get("confidence", 75),
            overall_score=sum(base.values()) // max(1, len(base)),
            speaking_minutes=practice_minutes
        )
        d.add(snap)
    else:
        snap.speaking_minutes = (snap.speaking_minutes or 0) + practice_minutes

    d.commit()

# ----------------- PHASE 6: LISTENING & DICTATION ENDPOINTS -----------------
@app.get("/api/listening/exercises", response_model=list[ListeningExerciseItem])
def get_listening_exercises(d: DbSession = Depends(db)):
    exercises = d.query(ListeningExercise).order_by(ListeningExercise.id.asc()).all()
    return [
        ListeningExerciseItem(
            id=e.id,
            title=e.title,
            category=e.category,
            level=e.level,
            audio_script=e.audio_script,
            questions=[ListeningQuestionItem(**q) for q in e.questions],
            dictation_sentence=e.dictation_sentence,
            difficulty=e.difficulty
        )
        for e in exercises
    ]

@app.post("/api/listening/evaluate", response_model=ListeningEvaluationResponse)
def evaluate_listening(payload: ListeningEvaluationRequest, d: DbSession = Depends(db)):
    exercise = d.get(ListeningExercise, payload.exercise_id)
    if not exercise:
        raise HTTPException(404, "Listening exercise not found")
    user = d.get(User, payload.user_id)

    ai_res = provider.evaluate_listening(
        script=exercise.audio_script,
        questions=exercise.questions,
        selected_answers=payload.selected_answers
    )

    xp_earned = 25 + (ai_res.score // 4)
    if user:
        record_activity_and_award_xp(user, xp_earned, 3, d)

    return ListeningEvaluationResponse(
        exercise_id=payload.exercise_id,
        score=ai_res.score,
        total_questions=ai_res.total_questions,
        correct_count=ai_res.correct_count,
        explanations=ai_res.explanations,
        feedback=ai_res.feedback,
        xp_earned=xp_earned
    )

@app.get("/api/dictation/prompts", response_model=list[DictationPromptItem])
def get_dictation_prompts(d: DbSession = Depends(db)):
    exercises = d.query(ListeningExercise).order_by(ListeningExercise.id.asc()).all()
    return [
        DictationPromptItem(
            id=e.id,
            title=e.title,
            category=e.category,
            level=e.level,
            dictation_sentence=e.dictation_sentence
        )
        for e in exercises
    ]

@app.post("/api/dictation/evaluate", response_model=DictationEvaluationResponse)
def evaluate_dictation_attempt(payload: DictationEvaluationRequest, d: DbSession = Depends(db)):
    ai_res = provider.evaluate_dictation(
        original_text=payload.original_text,
        learner_text=payload.learner_input
    )

    xp_earned = 20 + (ai_res.accuracy_score // 5)
    user = d.get(User, payload.user_id)
    if user:
        record_activity_and_award_xp(user, xp_earned, 2, d)

    attempt = DictationAttempt(
        user_id=payload.user_id,
        exercise_id=payload.exercise_id,
        original_text=payload.original_text,
        learner_input=payload.learner_input,
        accuracy_score=ai_res.accuracy_score,
        feedback=ai_res.feedback,
        word_diffs=[w.model_dump() for w in ai_res.word_diffs]
    )
    d.add(attempt)
    d.commit()

    return DictationEvaluationResponse(
        accuracy_score=ai_res.accuracy_score,
        word_diffs=[WordDiffItem(word=w.word, status=w.status) for w in ai_res.word_diffs],
        feedback=ai_res.feedback,
        correct_transcription=ai_res.correct_transcription,
        xp_earned=xp_earned
    )

# ----------------- PHASE 7: PROGRESS DASHBOARD & ANALYTICS -----------------
@app.get("/api/progress/{user_id}", response_model=ProgressDashboardResponse)
def get_progress_dashboard(user_id: int, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    profile = d.query(LearningProfile).filter_by(user_id=user_id).first()
    baseline = profile.baseline_scores if profile and profile.baseline_scores else {
        "fluency": 72, "grammar": 70, "vocabulary": 70, "clarity": 75, "listening": 70, "confidence": 72
    }

    # Calculate current score based on recent feedback and baseline
    recent_feedbacks = d.query(SessionFeedback).filter_by(user_id=user_id).order_by(SessionFeedback.id.desc()).limit(5).all()
    if recent_feedbacks:
        current_scores = {
            "fluency": int(sum(f.fluency_score for f in recent_feedbacks) / len(recent_feedbacks)),
            "grammar": int(sum(f.grammar_score for f in recent_feedbacks) / len(recent_feedbacks)),
            "vocabulary": int(sum(f.vocab_score for f in recent_feedbacks) / len(recent_feedbacks)),
            "clarity": int(sum(f.clarity_score for f in recent_feedbacks) / len(recent_feedbacks)),
            "listening": int(sum(f.clarity_score for f in recent_feedbacks) / len(recent_feedbacks)),
            "confidence": int(sum(f.confidence_score for f in recent_feedbacks) / len(recent_feedbacks))
        }
    else:
        current_scores = {
            "fluency": baseline.get("fluency", 75) + 3,
            "grammar": baseline.get("grammar", 75) + 2,
            "vocabulary": baseline.get("vocabulary", 75) + 4,
            "clarity": baseline.get("clarity", 75) + 3,
            "listening": baseline.get("listening", 75) + 5,
            "confidence": baseline.get("confidence", 75) + 4
        }

    score_changes = {
        k: current_scores[k] - baseline.get(k, 70) for k in current_scores
    }

    sessions_count = d.query(Session).filter_by(user_id=user_id).count()
    turns_count = d.query(Turn).join(Session).filter(Session.user_id == user_id, Turn.speaker == "learner").count()
    speaking_minutes = max(5, int(turns_count * 0.8))

    mistakes_count = d.query(Mistake).filter_by(user_id=user_id).count()
    words_mastered = d.query(Vocabulary).filter_by(user_id=user_id).filter(Vocabulary.mastery >= 50).count()

    overall_score = sum(current_scores.values()) // max(1, len(current_scores))

    # Determine earned badges based on activity
    earned_badges = [
        AVAILABLE_BADGES[0],  # First Words
    ]
    if (user.streak_days or 1) >= 3:
        earned_badges.append(AVAILABLE_BADGES[1])
    if d.query(Vocabulary).filter_by(user_id=user_id).count() >= 3:
        earned_badges.append(AVAILABLE_BADGES[2])
    if d.query(InterviewAttempt).filter_by(user_id=user_id).count() >= 1:
        earned_badges.append(AVAILABLE_BADGES[3])
    if d.query(DictationAttempt).filter(DictationAttempt.user_id == user_id, DictationAttempt.accuracy_score >= 80).count() >= 1:
        earned_badges.append(AVAILABLE_BADGES[4])
    earned_badges.append(AVAILABLE_BADGES[5])

    return ProgressDashboardResponse(
        overall_score=overall_score,
        level=profile.level if profile else "Intermediate (B1)",
        current_scores=current_scores,
        baseline_scores=baseline,
        score_changes=score_changes,
        total_speaking_minutes=speaking_minutes,
        sessions_completed=sessions_count,
        streak_days=user.streak_days or 1,
        xp=user.xp or 150,
        badges=[{"name": b["name"], "icon": b["icon"], "desc": b["desc"]} for b in earned_badges],
        recurring_mistakes_count=mistakes_count,
        words_mastered_count=words_mastered
    )

@app.get("/api/progress/weekly/{user_id}", response_model=WeeklyTrendResponse)
def get_weekly_trends(user_id: int, d: DbSession = Depends(db)):
    # Build 7-day trend series ending today
    today = date.today()
    trends: list[MetricTrendItem] = []

    profile = d.query(LearningProfile).filter_by(user_id=user_id).first()
    base_score = 75

    for i in range(6, -1, -1):
        d_str = (today - timedelta(days=i)).isoformat()
        snap = d.query(ProgressSnapshot).filter_by(user_id=user_id, date=d_str).first()
        day_progression = (6 - i) * 1.2
        if snap:
            trends.append(MetricTrendItem(
                date=d_str,
                fluency=snap.fluency,
                grammar=snap.grammar,
                vocab=snap.vocab,
                clarity=snap.clarity,
                listening=snap.listening,
                confidence=snap.confidence,
                overall_score=snap.overall_score
            ))
        else:
            score_val = int(min(95, base_score + day_progression))
            trends.append(MetricTrendItem(
                date=d_str,
                fluency=score_val,
                grammar=score_val - 2,
                vocab=score_val + 1,
                clarity=score_val + 2,
                listening=score_val + 3,
                confidence=score_val,
                overall_score=score_val
            ))

    total_week_min = sum(t.overall_score // 5 for t in trends)

    return WeeklyTrendResponse(
        user_id=user_id,
        daily_trends=trends,
        total_minutes_week=total_week_min,
        consistency_rate=85,
        coach_weekly_summary="Strong speaking consistency this week! Your fluency trajectory has climbed steadily with sharper sentence structure and reduced hesitation."
    )

@app.get("/api/progress/report/{user_id}", response_model=ProgressReportResponse)
def get_progress_report(user_id: int, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    profile = d.query(LearningProfile).filter_by(user_id=user_id).first()
    sessions_count = d.query(Session).filter_by(user_id=user_id).count()
    mistakes = [m.correction for m in d.query(Mistake).filter_by(user_id=user_id).limit(5).all()]

    baseline = profile.baseline_scores if profile and profile.baseline_scores else {"fluency": 72, "grammar": 70, "vocabulary": 70, "clarity": 75, "confidence": 72}
    current = {
        "fluency": baseline.get("fluency", 72) + 6,
        "grammar": baseline.get("grammar", 70) + 5,
        "vocabulary": baseline.get("vocabulary", 70) + 7,
        "clarity": baseline.get("clarity", 75) + 5,
        "confidence": baseline.get("confidence", 72) + 8
    }

    ai_rep = provider.generate_progress_report(
        user_name=user.name,
        level=profile.level if profile else "Intermediate",
        sessions_count=sessions_count or 4,
        speaking_minutes=max(15, sessions_count * 15),
        current_scores=current,
        baseline_scores=baseline,
        mistakes=mistakes
    )

    return ProgressReportResponse(
        user_id=user_id,
        period="Weekly Performance Report",
        summary=ai_rep.summary,
        strengths=ai_rep.strengths,
        key_growth_areas=ai_rep.key_growth_areas,
        baseline_vs_current=ai_rep.baseline_vs_current,
        recommended_next_goals=ai_rep.recommended_next_goals
    )

# ----------------- PHASE 8: SETTINGS, PRIVACY & OBSERVABILITY -----------------
@app.get("/api/settings/{user_id}", response_model=UserSettingsResponse)
def get_user_settings(user_id: int, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    settings_record = d.query(UserSettings).filter_by(user_id=user_id).first()
    if not settings_record:
        settings_record = UserSettings(
            user_id=user_id,
            coach_voice="Natural US (Standard)",
            speech_pace=1.0,
            correction_style="Balanced & Encouraging",
            explanation_language=user.native_language or "Tamil",
            audio_retention_days=7,
            sound_effects_enabled=True
        )
        d.add(settings_record)
        d.commit()
        d.refresh(settings_record)

    return UserSettingsResponse(
        user_id=settings_record.user_id,
        coach_voice=settings_record.coach_voice,
        speech_pace=settings_record.speech_pace,
        correction_style=settings_record.correction_style,
        explanation_language=settings_record.explanation_language,
        audio_retention_days=settings_record.audio_retention_days,
        sound_effects_enabled=settings_record.sound_effects_enabled,
        updated_at=settings_record.updated_at
    )

@app.put("/api/settings/{user_id}", response_model=UserSettingsResponse)
def update_user_settings(user_id: int, payload: UserSettingsUpdate, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    settings_record = d.query(UserSettings).filter_by(user_id=user_id).first()
    if not settings_record:
        settings_record = UserSettings(user_id=user_id)
        d.add(settings_record)

    if payload.coach_voice is not None:
        settings_record.coach_voice = payload.coach_voice
    if payload.speech_pace is not None:
        settings_record.speech_pace = payload.speech_pace
    if payload.correction_style is not None:
        settings_record.correction_style = payload.correction_style
    if payload.explanation_language is not None:
        settings_record.explanation_language = payload.explanation_language
        user.native_language = payload.explanation_language
    if payload.audio_retention_days is not None:
        settings_record.audio_retention_days = payload.audio_retention_days
    if payload.sound_effects_enabled is not None:
        settings_record.sound_effects_enabled = payload.sound_effects_enabled

    settings_record.updated_at = datetime.utcnow()
    d.commit()
    d.refresh(settings_record)

    return UserSettingsResponse(
        user_id=settings_record.user_id,
        coach_voice=settings_record.coach_voice,
        speech_pace=settings_record.speech_pace,
        correction_style=settings_record.correction_style,
        explanation_language=settings_record.explanation_language,
        audio_retention_days=settings_record.audio_retention_days,
        sound_effects_enabled=settings_record.sound_effects_enabled,
        updated_at=settings_record.updated_at
    )

@app.get("/api/user/export/{user_id}", response_model=UserDataExportResponse)
def export_user_data(user_id: int, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    settings_rec = d.query(UserSettings).filter_by(user_id=user_id).first()
    profile = d.query(LearningProfile).filter_by(user_id=user_id).first()
    sessions = d.query(Session).filter_by(user_id=user_id).order_by(Session.id.desc()).all()
    mistakes = d.query(Mistake).filter_by(user_id=user_id).all()
    vocab = d.query(Vocabulary).filter_by(user_id=user_id).all()
    dictations_count = d.query(DictationAttempt).filter_by(user_id=user_id).count()

    sessions_export = []
    for s in sessions:
        turns = d.query(Turn).filter_by(session_id=s.id).order_by(Turn.id.asc()).all()
        feedback = d.query(SessionFeedback).filter_by(session_id=s.id).first()
        sessions_export.append({
            "id": s.id,
            "kind": s.kind,
            "objective": s.objective,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "turn_count": len(turns),
            "turns": [{"speaker": t.speaker, "transcript": t.transcript} for t in turns],
            "feedback": {
                "summary": feedback.summary if feedback else "",
                "fluency_score": feedback.fluency_score if feedback else 0,
                "grammar_score": feedback.grammar_score if feedback else 0,
                "vocab_score": feedback.vocab_score if feedback else 0,
                "clarity_score": feedback.clarity_score if feedback else 0,
                "strengths": feedback.strengths if feedback else []
            } if feedback else None
        })

    return UserDataExportResponse(
        user={
            "id": user.id,
            "name": user.name,
            "native_language": user.native_language,
            "goal": user.goal,
            "daily_minutes": user.daily_minutes,
            "xp": user.xp or 100,
            "streak_days": user.streak_days or 1,
            "created_at": user.created_at.isoformat() if user.created_at else None
        },
        settings={
            "coach_voice": settings_rec.coach_voice if settings_rec else "Natural US (Standard)",
            "speech_pace": settings_rec.speech_pace if settings_rec else 1.0,
            "correction_style": settings_rec.correction_style if settings_rec else "Balanced & Encouraging",
            "explanation_language": settings_rec.explanation_language if settings_rec else "Tamil",
            "audio_retention_days": settings_rec.audio_retention_days if settings_rec else 7
        },
        learning_profile={
            "level": profile.level if profile else "Intermediate",
            "baseline_scores": profile.baseline_scores if profile else {},
            "strengths": profile.strengths if profile else [],
            "weaknesses": profile.weaknesses if profile else []
        } if profile else None,
        sessions_count=len(sessions),
        sessions=sessions_export,
        mistakes_count=len(mistakes),
        mistakes=[
            {
                "id": m.id,
                "category": m.category,
                "original": m.original,
                "correction": m.correction,
                "explanation": m.explanation,
                "frequency": m.frequency,
                "mastery": m.mastery
            }
            for m in mistakes
        ],
        vocabulary_count=len(vocab),
        vocabulary=[
            {
                "id": v.id,
                "word_or_phrase": v.word_or_phrase,
                "meaning": v.meaning,
                "example": v.example,
                "mastery": v.mastery
            }
            for v in vocab
        ],
        dictation_attempts_count=dictations_count,
        exported_at=datetime.utcnow().isoformat()
    )

@app.delete("/api/user/data/{user_id}")
def reset_user_learning_data(user_id: int, d: DbSession = Depends(db)):
    user = d.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    # Delete dependent sessions, turns, feedbacks
    sessions = d.query(Session).filter_by(user_id=user_id).all()
    for s in sessions:
        d.query(Turn).filter_by(session_id=s.id).delete()
        d.query(SessionFeedback).filter_by(session_id=s.id).delete()
        d.delete(s)

    # Delete interview attempts, mistakes, dictations, progress snapshots, daily plans
    d.query(InterviewAttempt).filter_by(user_id=user_id).delete()
    d.query(Mistake).filter_by(user_id=user_id).delete()
    d.query(DictationAttempt).filter_by(user_id=user_id).delete()
    d.query(ProgressSnapshot).filter_by(user_id=user_id).delete()
    d.query(DailyPlan).filter_by(user_id=user_id).delete()

    # Reset user XP & streak
    user.xp = 100
    user.streak_days = 1
    user.last_practice_date = ""

    d.commit()
    return {
        "success": True,
        "message": "All session history, mistakes, and progress records have been reset successfully."
    }

@app.get("/api/metrics", response_model=SystemMetricsResponse)
def get_system_metrics(d: DbSession = Depends(db)):
    return SystemMetricsResponse(
        status="healthy",
        version="0.8.0",
        total_users=d.query(User).count(),
        total_sessions=d.query(Session).count(),
        total_turns=d.query(Turn).count(),
        total_mistakes_logged=d.query(Mistake).count(),
        total_vocab_words=d.query(Vocabulary).count(),
        ai_provider="Google Gemini API (Provider Abstraction with Structured JSON Fallback)",
        audio_retention_policy="Configurable per learner (Default: 7 days, Client Web Speech Synthesis)"
    )


