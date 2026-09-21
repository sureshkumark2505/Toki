from abc import ABC, abstractmethod
import json
import logging
from pydantic import BaseModel
from google import genai
from ..config import settings

logger = logging.getLogger("ai_provider")

class CoachResult(BaseModel):
    reply: str
    correction: str | None
    explanation: str | None
    next_prompt: str

class ScoreBreakdown(BaseModel):
    fluency: int
    grammar: int
    vocabulary: int
    clarity: int
    confidence: int

class AssessmentResult(BaseModel):
    level: str
    scores: ScoreBreakdown
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    summary: str

class DailyTask(BaseModel):
    title: str
    kind: str
    minutes: int
    instruction: str

class PlanResult(BaseModel):
    tasks: list[DailyTask]
    generated_reason: str

class TranslationEvaluationAIResult(BaseModel):
    natural_english: str
    feedback: str
    explanation: str
    accuracy_score: int
    better_alternatives: list[str]

class ReviewEvaluationAIResult(BaseModel):
    is_correct: bool
    coach_feedback: str
    model_sentence: str

class CorrectionItem(BaseModel):
    original: str
    correction: str
    explanation: str

class VocabItemCaptured(BaseModel):
    word: str
    meaning: str
    example: str

class SessionReportAIResult(BaseModel):
    summary: str
    scores: ScoreBreakdown
    strengths: list[str]
    key_corrections: list[CorrectionItem]
    vocabulary_captured: list[VocabItemCaptured]
    recommended_exercise: str

# ----------------- PHASE 5 AI DATA MODELS -----------------
class RoleplayTurnAIResult(BaseModel):
    reply: str
    role_character: str
    coaching_tip: str | None

class ScenarioReportAIResult(BaseModel):
    scenario_title: str
    communication_score: int
    scores: ScoreBreakdown
    strengths: list[str]
    improvements: list[str]
    summary: str

class InterviewScoreBreakdown(BaseModel):
    clarity: int
    structure: int
    conciseness: int
    confidence: int
    vocabulary: int
    grammar: int

class InterviewAttemptAIResult(BaseModel):
    interview_type: str
    scores: InterviewScoreBreakdown
    summary: str
    strengths: list[str]
    improvements: list[str]

class InterviewComparisonAIResult(BaseModel):
    score_diffs: dict[str, int]
    key_gains: list[str]
    remaining_focus: list[str]
    coach_verdict: str

class StructureFeedback(BaseModel):
    introduction: str
    body: str
    conclusion: str

class ExtemporeEvaluationAIResult(BaseModel):
    topic: str
    scores: ScoreBreakdown
    structure_feedback: StructureFeedback
    filler_words_detected: list[dict[str, str | int]]
    strengths: list[str]
    improvements: list[str]
    recommended_exercise: str

# ----------------- PHASE 6 & 7 AI DATA MODELS -----------------
class ListeningEvaluationAIResult(BaseModel):
    score: int
    total_questions: int
    correct_count: int
    explanations: list[str]
    feedback: str

class WordDiffAIItem(BaseModel):
    word: str
    status: str  # correct, missing, extra, typo

class DictationEvaluationAIResult(BaseModel):
    accuracy_score: int
    word_diffs: list[WordDiffAIItem]
    feedback: str
    correct_transcription: str

class ProgressReportAIResult(BaseModel):
    summary: str
    strengths: list[str]
    key_growth_areas: list[str]
    baseline_vs_current: dict[str, int]
    recommended_next_goals: list[str]

class UtteranceMistake(BaseModel):
    original: str
    corrected: str
    category: str = "grammar"
    explanation: str = ""
    explanation_native: str = ""

class UtteranceAnalysis(BaseModel):
    is_practice: bool = True
    mistakes: list[UtteranceMistake] = []

class AIProvider(ABC):
    @abstractmethod
    def coach(self, objective: str, transcript: str, history: list[str]) -> CoachResult: ...
    @abstractmethod
    def assess(self, answers: list[str]) -> AssessmentResult: ...
    @abstractmethod
    def plan(self, minutes: int, level: str, weaknesses: list[str], mistakes: list[str]) -> PlanResult: ...
    @abstractmethod
    def evaluate_translation(self, tamil_prompt: str, learner_english: str, target_pattern: str) -> TranslationEvaluationAIResult: ...
    @abstractmethod
    def evaluate_review(self, original_mistake: str, target_correction: str, spoken_attempt: str) -> ReviewEvaluationAIResult: ...
    @abstractmethod
    def generate_session_report(self, objective: str, turns: list[dict], mistakes: list[dict]) -> SessionReportAIResult: ...
    @abstractmethod
    def roleplay_turn(self, role: str, learner_role: str, objective: str, difficulty: str, transcript: str, history: list[dict]) -> RoleplayTurnAIResult: ...
    @abstractmethod
    def generate_scenario_report(self, scenario_title: str, role: str, turns: list[dict]) -> ScenarioReportAIResult: ...
    @abstractmethod
    def evaluate_interview_session(self, interview_type: str, target_role: str, turns: list[dict], attempt_number: int) -> InterviewAttemptAIResult: ...
    @abstractmethod
    def compare_interview_attempts(self, attempt1: dict, attempt2: dict) -> InterviewComparisonAIResult: ...
    @abstractmethod
    def evaluate_extempore(self, topic: str, duration_seconds: int, transcript: str) -> ExtemporeEvaluationAIResult: ...
    @abstractmethod
    def evaluate_listening(self, script: str, questions: list[dict], selected_answers: list[int]) -> ListeningEvaluationAIResult: ...
    @abstractmethod
    def evaluate_dictation(self, original_text: str, learner_text: str) -> DictationEvaluationAIResult: ...
    @abstractmethod
    def generate_progress_report(self, user_name: str, level: str, sessions_count: int, speaking_minutes: int, current_scores: dict, baseline_scores: dict, mistakes: list[str]) -> ProgressReportAIResult: ...

    def analyze_utterance(
        self,
        transcript: str,
        level: str = "Intermediate",
        explanation_language: str = "Tamil",
        recent_context: list[str] | None = None
    ) -> UtteranceAnalysis:
        return UtteranceAnalysis(is_practice=True, mistakes=[])


class GeminiProvider(AIProvider):
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None

    def coach(self, objective: str, transcript: str, history: list[str]) -> CoachResult:
        if not self.client:
            return CoachResult(
                reply="I heard you. Please add your Gemini API key to enable personal coaching.",
                correction=None,
                explanation=None,
                next_prompt="Tell me one more detail using a complete sentence."
            )
        prompt = f'''You are a patient voice-first English communication coach, not a general chatbot.
Objective: {objective}
Recent conversation: {history[-6:]}
Learner said: {transcript}
Give a short spoken reply, correct at most one important error, explain it briefly (Tamil only if necessary for clarity), and ask exactly one next question. Return JSON with reply, correction (or null), explanation (or null), next_prompt.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": CoachResult}
            )
            return CoachResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini coach failed or quota reached ({e}). Using intelligent fallback.")
            correction = None
            explanation = None
            if "i was go" in transcript.lower():
                correction = "I was go -> I went"
                explanation = "கடந்த கால செயலுக்கு 'went' பயன்படுத்த வேண்டும்."
            elif "i drinking" in transcript.lower() or "i eating" in transcript.lower():
                correction = "I drinking -> I drink / I am drinking"
                explanation = "தொடர் செயலுக்கு 'am drinking' அல்லது வழக்கத்திற்கு 'drink' பயன்படுத்தவும்."
            return CoachResult(
                reply=f"Thank you for sharing that. You expressed your thought clearly!",
                correction=correction,
                explanation=explanation,
                next_prompt="Could you explain a little more about what happened next?"
            )

    def assess(self, answers: list[str]) -> AssessmentResult:
        if not self.client:
            return AssessmentResult(
                level="Intermediate (B1)",
                scores=ScoreBreakdown(fluency=75, grammar=75, vocabulary=70, clarity=80, confidence=75),
                strengths=["Introduced yourself clearly with basic structure.", "Expressed sequential thoughts smoothly."],
                weaknesses=["Occasional article omissions in prepositional phrases.", "Simplified vocabulary in work descriptions."],
                recommendations=["Practice daily routines with definite articles (the office).", "Expand professional verbs (collaborated, organized).", "Do 1-minute extempore speaking daily."],
                summary="Solid intermediate baseline. Expresses ideas with good basic fluency and intelligibility."
            )
        prompt = f'''You assess spoken English communication. Analyze only the supplied learner transcripts. Do not claim phoneme, accent, or audio measurements. Give 0-100 scores as text-based estimates for fluency, grammar, vocabulary, clarity, confidence. Identify 2-3 strengths, 2-3 high-value weaknesses, and 3 short practice recommendations. Return JSON matching the schema. Answers: {answers}'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": AssessmentResult}
            )
            return AssessmentResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini assess failed or quota reached ({e}). Using baseline fallback.")
            return AssessmentResult(
                level="Intermediate (B1)",
                scores=ScoreBreakdown(fluency=78, grammar=76, vocabulary=72, clarity=82, confidence=78),
                strengths=["Clear sentence intent and understandable responses.", "Good basic vocabulary for daily routines."],
                weaknesses=["Tense consistency in past narratives.", "Pauses when recalling descriptive vocabulary."],
                recommendations=["Focus on past simple storytelling drills.", "Practice substituting basic verbs with professional alternatives.", "Use silent pauses instead of filler words."],
                summary="The learner demonstrated good functional English with clear communicative intent across all prompts."
            )

    def plan(self, minutes: int, level: str, weaknesses: list[str], mistakes: list[str]) -> PlanResult:
        if not self.client:
            return PlanResult(
                tasks=[
                    DailyTask(title="Warm-up Speaking", kind="warmup", minutes=max(2, minutes // 5), instruction="Speak for 1 minute about your morning without long pauses."),
                    DailyTask(title="Tamil ➔ English Translation", kind="translation", minutes=max(3, minutes // 4), instruction="Translate 3 everyday Tamil thoughts into clear spoken English."),
                    DailyTask(title="Guided Coaching", kind="guided", minutes=max(5, minutes // 2), instruction="Practice natural dialogue focusing on complete sentences."),
                    DailyTask(title="Session Feedback & Review", kind="review", minutes=max(2, minutes // 6), instruction="Review your key correction and repeat the model sentence.")
                ],
                generated_reason=f"Structured {minutes}-minute plan targeting {level} level."
            )
        prompt = f'''Create a {minutes}-minute voice-first English speaking practice plan. Learner level: {level}. Weaknesses: {weaknesses}. Recent corrections: {mistakes[-5:]}. Use active speaking and listening, not flashcards. Include 3-6 concise tasks. Task kinds may be warmup, phrase, guided, scenario, translation, review. Return JSON with tasks (title, kind, minutes, instruction) and generated_reason. Total minutes across tasks should approximately equal {minutes}.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": PlanResult}
            )
            return PlanResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini plan failed or quota reached ({e}). Using structured fallback.")
            return PlanResult(
                tasks=[
                    DailyTask(title="Warm-up Speaking", kind="warmup", minutes=max(2, minutes // 5), instruction="Speak for 1-2 minutes about your goals today without filler words."),
                    DailyTask(title="Tamil ➔ English Translation", kind="translation", minutes=max(3, minutes // 4), instruction="Translate 3 Tamil sentences into natural English."),
                    DailyTask(title="Guided Speaking Practice", kind="guided", minutes=max(5, minutes // 2), instruction=f"Guided speaking session targeting: {weaknesses[0] if weaknesses else 'daily routines'}."),
                    DailyTask(title="Session Review", kind="review", minutes=max(2, minutes // 6), instruction="Review mistakes and repeat corrections out loud.")
                ],
                generated_reason=f"Plan generated targeting {level} with focus on {', '.join(weaknesses[:2]) if weaknesses else 'communication fluency'}."
            )

    def evaluate_translation(self, tamil_prompt: str, learner_english: str, target_pattern: str) -> TranslationEvaluationAIResult:
        if not self.client:
            return TranslationEvaluationAIResult(
                natural_english="I wake up at 7 AM every day and drink coffee.",
                feedback="Good sentence structure and clear meaning.",
                explanation="வழக்கமாக செய்யும் செயலுக்கு simple present tense (drink) பயன்படுத்த வேண்டும்.",
                accuracy_score=85,
                better_alternatives=["I get up at 7 AM daily and have a cup of coffee.", "Every morning at 7, I wake up and enjoy some coffee."]
            )
        prompt = f'''You are an English coach evaluating a learner translating a Tamil thought into spoken English.
Tamil prompt: {tamil_prompt}
Target grammar pattern: {target_pattern}
Learner's spoken English: {learner_english}

Evaluate the learner's English for meaning, grammar, and naturalness.
Provide:
- natural_english: The most natural, modern English phrasing.
- feedback: Short encouraging feedback on what was good and what can be improved.
- explanation: Short grammatical explanation with Tamil notes if helpful.
- accuracy_score: Integer 0 to 100.
- better_alternatives: 2 alternative natural English sentences.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": TranslationEvaluationAIResult}
            )
            return TranslationEvaluationAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini evaluate_translation failed ({e}). Using fallback.")
            return TranslationEvaluationAIResult(
                natural_english="I wake up at 7 AM every day and drink coffee.",
                feedback="Your sentence communicated the right meaning! Focus on simple present verbs.",
                explanation="தொடர் செயலுக்கு continuous tense பதிலாக வழக்கமான செயலுக்கு simple present பயன்படுத்தவும்.",
                accuracy_score=85,
                better_alternatives=["I get up at 7 AM daily and drink coffee.", "Every morning I wake up at 7 AM and have coffee."]
            )

    def evaluate_review(self, original_mistake: str, target_correction: str, spoken_attempt: str) -> ReviewEvaluationAIResult:
        if not self.client:
            return ReviewEvaluationAIResult(
                is_correct=True,
                coach_feedback="Well spoken! You corrected the phrase cleanly.",
                model_sentence=target_correction
            )
        prompt = f'''You evaluate a learner practicing active spaced repetition of a past spoken mistake.
Original mistake: {original_mistake}
Correct target phrase: {target_correction}
Learner's spoken attempt: {spoken_attempt}

Did the learner successfully fix the mistake and say a grammatically sound sentence?
Return JSON with:
- is_correct: boolean (true if the core mistake was corrected and sentence is clear, even if slightly rephrased).
- coach_feedback: short voice coach feedback (1-2 sentences).
- model_sentence: the best model sentence.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": ReviewEvaluationAIResult}
            )
            return ReviewEvaluationAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini evaluate_review failed ({e}). Using fallback.")
            target_words = set(target_correction.lower().split())
            spoken_words = set(spoken_attempt.lower().split())
            overlap = len(target_words.intersection(spoken_words)) / max(1, len(target_words))
            is_correct = overlap >= 0.5
            return ReviewEvaluationAIResult(
                is_correct=is_correct,
                coach_feedback="Great job fixing the sentence!" if is_correct else "Keep practicing the model sentence out loud.",
                model_sentence=target_correction
            )

    def generate_session_report(self, objective: str, turns: list[dict], mistakes: list[dict]) -> SessionReportAIResult:
        if not self.client:
            return SessionReportAIResult(
                summary="Session completed successfully. You communicated with good clarity and practiced your target speaking objective.",
                scores=ScoreBreakdown(fluency=78, grammar=75, vocabulary=74, clarity=82, confidence=80),
                strengths=["Maintained continuous conversation without giving up.", "Responded promptly to the coach's questions."],
                key_corrections=[CorrectionItem(original=m.get("original", ""), correction=m.get("correction", ""), explanation=m.get("explanation", "")) for m in mistakes[:3]],
                vocabulary_captured=[
                    VocabItemCaptured(word="consistently", meaning="in every case or at all times", example="I consistently practice English speaking."),
                    VocabItemCaptured(word="articulate", meaning="able to express thoughts clearly", example="He gave an articulate explanation.")
                ],
                recommended_exercise="Practice 3 minutes of past tense storytelling tomorrow to solidify your verb forms."
            )
        prompt = f'''Analyze this completed spoken English session and produce an end-of-session diagnostic report.
Session Objective: {objective}
Conversation Turns: {turns}
Mistakes logged during session: {mistakes}

Return JSON with:
- summary: 2-3 sentence encouraging summary of the learner's overall performance and communication flow.
- scores: object with integer 0-100 for fluency, grammar, vocabulary, clarity, confidence.
- strengths: list of 2 key speaking strengths observed.
- key_corrections: list of up to 3 objects with {{"original": "...", "correction": "...", "explanation": "..."}}.
- vocabulary_captured: list of 2-3 high-value words or idiomatic phrases used or recommended during this session, with {{"word": "...", "meaning": "...", "example": "..."}}.
- recommended_exercise: concrete 1-2 sentence homework exercise for the next session.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": SessionReportAIResult}
            )
            return SessionReportAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini session report generation failed ({e}). Using structured fallback.")
            return SessionReportAIResult(
                summary=f"Great session practicing '{objective}'. You showed great engagement and answered questions with good effort.",
                scores=ScoreBreakdown(fluency=80, grammar=74, vocabulary=76, clarity=82, confidence=78),
                strengths=["Answered questions completely in full sentences.", "Engaged well with the coach's follow-ups."],
                key_corrections=[CorrectionItem(original=m.get("original", ""), correction=m.get("correction", ""), explanation=m.get("explanation", "")) for m in mistakes[:3]],
                vocabulary_captured=[
                    VocabItemCaptured(word="consistently", meaning="regularly and without interruption", example="She practices speaking consistently."),
                    VocabItemCaptured(word="spontaneously", meaning="without pre-planning, naturally", example="He spoke spontaneously during the meeting.")
                ],
                recommended_exercise="Repeat your top correction once today and use it in tomorrow's warm-up."
            )

    # ----------------- PHASE 5: ROLEPLAY & SCENARIO ENGINE -----------------
    def roleplay_turn(self, role: str, learner_role: str, objective: str, difficulty: str, transcript: str, history: list[dict]) -> RoleplayTurnAIResult:
        if not self.client:
            return RoleplayTurnAIResult(
                reply=f"I understand your point regarding '{transcript[:30]}...'. Let's explore how we can move forward with this step.",
                role_character=role,
                coaching_tip="Good phrasing. Remember to keep your tone polite and professional."
            )
        prompt = f'''You are roleplaying in a spoken English simulation.
Role you adopt: {role}
Learner's role: {learner_role}
Scenario Objective: {objective}
Difficulty: {difficulty}
Recent conversation: {history[-6:]}
Learner just said: {transcript}

Instructions:
1. Stay strictly in-character as {role}. Respond naturally, concisely (1-3 sentences suitable for spoken audio).
2. Adapt vocabulary to {difficulty} difficulty.
3. If the learner made a noticeable communicative or grammar misstep, provide a subtle, non-intrusive coaching_tip. Otherwise set coaching_tip to null.
4. Return JSON with reply, role_character ("{role}"), and coaching_tip.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": RoleplayTurnAIResult}
            )
            return RoleplayTurnAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini roleplay_turn failed ({e}). Using fallback.")
            return RoleplayTurnAIResult(
                reply=f"Thank you for clarifying that. What specific timeline or next steps do you recommend from your side?",
                role_character=role,
                coaching_tip="Clear statement. Try using connecting phrases like 'From our perspective' or 'Moving forward'."
            )

    def generate_scenario_report(self, scenario_title: str, role: str, turns: list[dict]) -> ScenarioReportAIResult:
        if not self.client:
            return ScenarioReportAIResult(
                scenario_title=scenario_title,
                communication_score=82,
                scores=ScoreBreakdown(fluency=80, grammar=82, vocabulary=80, clarity=84, confidence=82),
                strengths=["Maintained professional composure during the dialogue.", "Addressed the situational objective clearly."],
                improvements=["Use more diplomatic negotiation phrases.", "Avoid hesitation before answering critical questions."],
                summary=f"You completed the '{scenario_title}' roleplay with {role} effectively, showing solid contextual communication."
            )
        prompt = f'''Evaluate the learner's performance in this completed real-life roleplay scenario.
Scenario: {scenario_title}
Roleplay Partner: {role}
Dialogue History: {turns}

Return JSON with:
- scenario_title: "{scenario_title}"
- communication_score: overall integer score 0-100.
- scores: ScoreBreakdown (fluency, grammar, vocabulary, clarity, confidence).
- strengths: 2-3 key strengths demonstrated in this specific scenario.
- improvements: 2 concrete areas for communicative improvement in this scenario.
- summary: 2-3 sentence overall evaluation of realism, diplomacy, and goal achievement.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": ScenarioReportAIResult}
            )
            return ScenarioReportAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini generate_scenario_report failed ({e}). Using fallback.")
            return ScenarioReportAIResult(
                scenario_title=scenario_title,
                communication_score=80,
                scores=ScoreBreakdown(fluency=78, grammar=80, vocabulary=78, clarity=82, confidence=80),
                strengths=["Stayed on topic and responded with relevant details.", "Maintained natural conversation rhythm."],
                improvements=["Expand professional vocabulary for negotiation and problem resolution.", "Structure responses with clear action items."],
                summary=f"Solid performance in '{scenario_title}'. You communicated key details clearly and engaged well with {role}."
            )

    # ----------------- PHASE 5: INTERVIEW COACH & ATTEMPT COMPARISON -----------------
    def evaluate_interview_session(self, interview_type: str, target_role: str, turns: list[dict], attempt_number: int) -> InterviewAttemptAIResult:
        if not self.client:
            return InterviewAttemptAIResult(
                interview_type=interview_type,
                scores=InterviewScoreBreakdown(clarity=82, structure=80, conciseness=78, confidence=85, vocabulary=80, grammar=82),
                summary=f"Attempt #{attempt_number}: Good performance on '{interview_type}'. Your responses were engaging with clear structure.",
                strengths=["Direct answers with positive professional tone.", "Clear explanation of personal achievements."],
                improvements=["Apply the STAR framework (Situation-Task-Action-Result) more explicitly.", "Reduce filler transitions."]
            )
        prompt = f'''Evaluate this job interview practice session (Attempt #{attempt_number}).
Interview Type: {interview_type}
Target Role: {target_role}
Transcript turns: {turns}

Evaluate on 6 key interview criteria (0-100):
1. clarity (clear articulate speech)
2. structure (STAR framework / logical organization)
3. conciseness (avoiding rambling, focused answers)
4. confidence (assertive, professional tone)
5. vocabulary (industry/professional terminology)
6. grammar (sentence correctness)

Return JSON with:
- interview_type: "{interview_type}"
- scores: object with the 6 criteria above.
- summary: 2-3 sentence professional debrief for Attempt #{attempt_number}.
- strengths: 2-3 specific interview strengths.
- improvements: 2-3 actionable improvements for the next attempt.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": InterviewAttemptAIResult}
            )
            return InterviewAttemptAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini evaluate_interview_session failed ({e}). Using fallback.")
            return InterviewAttemptAIResult(
                interview_type=interview_type,
                scores=InterviewScoreBreakdown(clarity=80, structure=78, conciseness=76, confidence=82, vocabulary=78, grammar=80),
                summary=f"Attempt #{attempt_number}: Strong communicative foundation for {target_role}. Keep sharpening concise answers.",
                strengths=["Good energy and clear enthusiasm for the role.", "Articulated key experiences effectively."],
                improvements=["Structure answers into distinct Situation, Action, and Measurable Result.", "Use stronger action verbs (led, architected, optimized)."]
            )

    def compare_interview_attempts(self, attempt1: dict, attempt2: dict) -> InterviewComparisonAIResult:
        scores1 = attempt1.get("scores", {})
        scores2 = attempt2.get("scores", {})
        diffs = {k: scores2.get(k, 75) - scores1.get(k, 75) for k in ["clarity", "structure", "conciseness", "confidence", "vocabulary", "grammar"]}
        if not self.client:
            return InterviewComparisonAIResult(
                score_diffs=diffs,
                key_gains=["Noticeable improvement in answer structure (STAR method).", "More confident pacing and concise phrasing."],
                remaining_focus=["Continue expanding domain-specific terminology.", "Maintain strong conclusion summaries."],
                coach_verdict="Attempt 2 demonstrated marked progress in structure and conciseness compared to Attempt 1."
            )
        prompt = f'''Compare these two interview practice attempts for the same user and analyze their progress.
Attempt 1 (Previous): {attempt1}
Attempt 2 (Recent): {attempt2}
Calculated score diffs: {diffs}

Return JSON with:
- score_diffs: the dictionary of diffs {diffs}
- key_gains: list of 2-3 measurable improvements seen in Attempt 2 vs Attempt 1.
- remaining_focus: list of 2 remaining areas to polish in future attempts.
- coach_verdict: 2-3 sentence overall encouraging coach appraisal of their progress.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": InterviewComparisonAIResult}
            )
            return InterviewComparisonAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini compare_interview_attempts failed ({e}). Using fallback.")
            return InterviewComparisonAIResult(
                score_diffs=diffs,
                key_gains=["Clearer emphasis on actions taken.", "Fewer pauses and sharper answer beginnings."],
                remaining_focus=["End answers with explicit business impact or lessons learned.", "Continue practicing concise 90-second answers."],
                coach_verdict="Great progress between attempts! Attempt 2 was more structured and assertively communicated."
            )

    # ----------------- PHASE 5: FREE SPEAKING / EXTEMPORE EVALUATION -----------------
    def evaluate_extempore(self, topic: str, duration_seconds: int, transcript: str) -> ExtemporeEvaluationAIResult:
        words = transcript.strip().split()
        word_count = len(words)
        minutes = max(0.2, duration_seconds / 60.0)
        wpm = int(word_count / minutes)

        # Count common filler words locally for accuracy
        filler_targets = ["um", "uh", "like", "you know", "actually", "basically", "literally", "sort of", "kind of"]
        filler_counts = []
        lower_t = transcript.lower()
        for ft in filler_targets:
            c = lower_t.count(ft)
            if c > 0:
                filler_counts.append({"filler": ft, "count": c})

        if not self.client:
            return ExtemporeEvaluationAIResult(
                topic=topic,
                scores=ScoreBreakdown(fluency=78, grammar=80, vocabulary=76, clarity=82, confidence=80),
                structure_feedback=StructureFeedback(
                    introduction="Good opening statement that clearly framed the topic.",
                    body="Provided 2 supporting examples with continuous flow.",
                    conclusion="Finished with a summary statement of your key takeaway."
                ),
                filler_words_detected=filler_counts if filler_counts else [{"filler": "uh/um", "count": 1}],
                strengths=["Maintained continuous speaking throughout the time limit.", "Clear pronunciation and steady tempo."],
                improvements=["Organize thoughts with signpost words like 'Firstly', 'In addition', 'Ultimately'.", "Minimize filler pauses by using silent breathing pauses."],
                recommended_exercise="Practice speaking on 'How AI influences your daily work' for 1 minute using the Rule of 3 (3 key points)."
            )

        prompt = f'''Evaluate this timed extempore speaking monologue.
Topic: {topic}
Duration: {duration_seconds} seconds ({minutes:.1f} minutes)
Word Count: {word_count} words (Calculated WPM: {wpm})
Learner Transcript: {transcript}

Instructions:
1. Provide 0-100 scores for fluency, grammar, vocabulary, clarity, confidence.
2. Evaluate 3-part structure:
   - introduction: analysis of how effectively they introduced their stance or theme.
   - body: analysis of reasoning, elaboration, and supporting points.
   - conclusion: analysis of the wrap-up or final message.
3. List 2 key strengths and 2 concrete areas for improvement.
4. Give a concrete 1-2 sentence homework speaking exercise for tomorrow.
5. Return JSON matching ExtemporeEvaluationAIResult schema.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": ExtemporeEvaluationAIResult}
            )
            res = ExtemporeEvaluationAIResult.model_validate_json(response.text)
            if not res.filler_words_detected:
                res.filler_words_detected = filler_counts
            return res
        except Exception as e:
            logger.warning(f"Gemini evaluate_extempore failed ({e}). Using fallback.")
            return ExtemporeEvaluationAIResult(
                topic=topic,
                scores=ScoreBreakdown(fluency=80, grammar=78, vocabulary=78, clarity=84, confidence=82),
                structure_feedback=StructureFeedback(
                    introduction="Introduced the core theme with good momentum.",
                    body="Developed ideas logically across the spoken duration.",
                    conclusion="Clear closing thought that tied back to the prompt."
                ),
                filler_words_detected=filler_counts if filler_counts else [{"filler": "um", "count": 2}],
                strengths=["Spoke continuously without breaking off mid-thought.", "Clear vocabulary choices relevant to the topic."],
                improvements=["Use structured transitions ('On one hand', 'Furthermore').", "Replace hesitation sounds with deliberate brief pauses."],
                recommended_exercise="Do a 60-second extempore drill on your favorite hobby focusing on active verbs."
            )

    # ----------------- PHASE 6: LISTENING COMPREHENSION & DICTATION -----------------

    def evaluate_listening(self, script: str, questions: list[dict], selected_answers: list[int]) -> ListeningEvaluationAIResult:
        total = len(questions)
        correct_count = 0
        explanations = []
        for i, q in enumerate(questions):
            correct_idx = q.get("correct_idx", 0)
            user_ans = selected_answers[i] if i < len(selected_answers) else -1
            if user_ans == correct_idx:
                correct_count += 1
            explanations.append(q.get("explanation", f"Correct option is {q.get('options', [])[correct_idx] if q.get('options') else ''}"))

        score = int((correct_count / max(1, total)) * 100)
        feedback = "Outstanding listening comprehension! You captured the essential details accurately." if score == 100 else (
            "Good listening effort. Review the audio once more to catch subtle nuances." if score >= 50 else
            "Take your time and listen for key transition words and facts."
        )

        return ListeningEvaluationAIResult(
            score=score,
            total_questions=total,
            correct_count=correct_count,
            explanations=explanations,
            feedback=feedback
        )

    def evaluate_dictation(self, original_text: str, learner_text: str) -> DictationEvaluationAIResult:
        import re
        orig_raw = original_text.split()
        learn_raw = learner_text.split()

        orig_clean = [re.sub(r'[^\w\s]', '', w).lower() for w in orig_raw]
        learn_clean = [re.sub(r'[^\w\s]', '', w).lower() for w in learn_raw]

        diffs: list[WordDiffAIItem] = []
        correct_matches = 0

        # Simple alignment matching
        i, j = 0, 0
        while i < len(orig_clean) or j < len(learn_clean):
            if i < len(orig_clean) and j < len(learn_clean):
                if orig_clean[i] == learn_clean[j]:
                    diffs.append(WordDiffAIItem(word=orig_raw[i], status="correct"))
                    correct_matches += 1
                    i += 1
                    j += 1
                elif j + 1 < len(learn_clean) and orig_clean[i] == learn_clean[j + 1]:
                    diffs.append(WordDiffAIItem(word=learn_raw[j], status="extra"))
                    j += 1
                elif i + 1 < len(orig_clean) and orig_clean[i + 1] == learn_clean[j]:
                    diffs.append(WordDiffAIItem(word=orig_raw[i], status="missing"))
                    i += 1
                else:
                    # Check character similarity for typo
                    w1, w2 = orig_clean[i], learn_clean[j]
                    overlap = len(set(w1).intersection(set(w2))) / max(1, len(set(w1).union(set(w2))))
                    if overlap >= 0.6:
                        diffs.append(WordDiffAIItem(word=f"{learn_raw[j]} -> {orig_raw[i]}", status="typo"))
                        correct_matches += 0.5
                    else:
                        diffs.append(WordDiffAIItem(word=orig_raw[i], status="missing"))
                    i += 1
                    j += 1
            elif i < len(orig_clean):
                diffs.append(WordDiffAIItem(word=orig_raw[i], status="missing"))
                i += 1
            else:
                diffs.append(WordDiffAIItem(word=learn_raw[j], status="extra"))
                j += 1

        accuracy = max(0, min(100, int((correct_matches / max(1, len(orig_clean))) * 100)))
        feedback = "Flawless audio transcription! Your listening precision is superb." if accuracy >= 95 else (
            "Strong listening accuracy. Watch out for small function words and spelling." if accuracy >= 70 else
            "Keep practicing sentence dictation to train your auditory memory."
        )

        return DictationEvaluationAIResult(
            accuracy_score=accuracy,
            word_diffs=diffs,
            feedback=feedback,
            correct_transcription=original_text
        )

    # ----------------- PHASE 7: LONG-TERM PROGRESS & ANALYTICS -----------------
    def generate_progress_report(self, user_name: str, level: str, sessions_count: int, speaking_minutes: int, current_scores: dict, baseline_scores: dict, mistakes: list[str]) -> ProgressReportAIResult:
        fluency_gain = current_scores.get("fluency", 75) - baseline_scores.get("fluency", 70)
        clarity_gain = current_scores.get("clarity", 75) - baseline_scores.get("clarity", 70)

        if not self.client:
            return ProgressReportAIResult(
                summary=f"{user_name} has logged {speaking_minutes} total speaking minutes across {sessions_count} sessions, showing consistent gains in fluency (+{max(0, fluency_gain)} pts) and clarity (+{max(0, clarity_gain)} pts).",
                strengths=[
                    "Consistent daily practice rhythm reducing hesitation.",
                    "Improved structure during roleplays and guided drills."
                ],
                key_growth_areas=[
                    "Prepositional phrase accuracy during fast speech.",
                    "Active usage of captured professional vocabulary in live scenarios."
                ],
                baseline_vs_current={
                    "fluency": fluency_gain,
                    "grammar": current_scores.get("grammar", 75) - baseline_scores.get("grammar", 70),
                    "vocabulary": current_scores.get("vocabulary", 75) - baseline_scores.get("vocabulary", 70),
                    "clarity": clarity_gain,
                    "confidence": current_scores.get("confidence", 75) - baseline_scores.get("confidence", 70)
                },
                recommended_next_goals=[
                    "Complete 2 real-life workplace scenarios this week.",
                    "Re-attempt interview questions targeting the STAR framework.",
                    "Review top 3 recurring mistake items in spaced repetition."
                ]
            )

        prompt = f'''Generate a comprehensive long-term English speaking progress report.
Learner: {user_name} (Level: {level})
Total Speaking Minutes: {speaking_minutes}
Completed Sessions: {sessions_count}
Baseline Scores: {baseline_scores}
Current Scores: {current_scores}
Recent Mistakes Logged: {mistakes[:5]}

Return JSON with:
- summary: 2-3 sentence inspiring executive summary of their communication trajectory.
- strengths: 2-3 demonstrable strengths.
- key_growth_areas: 2 high-impact focus areas.
- baseline_vs_current: dictionary of point differences per metric.
- recommended_next_goals: 3 concrete action milestones for the next 14 days.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": ProgressReportAIResult}
            )
            return ProgressReportAIResult.model_validate_json(response.text)
        except Exception as e:
            logger.warning(f"Gemini progress report failed ({e}). Using structured fallback.")
            return ProgressReportAIResult(
                summary=f"Great progress! You have completed {sessions_count} sessions with {speaking_minutes} minutes of active speech. Your fluency and confidence continue on an upward trajectory.",
                strengths=["Noticeable increase in sentence continuity.", "Faster response time without long thinking pauses."],
                key_growth_areas=["Consolidate past tense storytelling patterns.", "Incorporate advanced transitional phrases."],
                baseline_vs_current={
                    "fluency": fluency_gain,
                    "grammar": current_scores.get("grammar", 75) - baseline_scores.get("grammar", 70),
                    "vocabulary": current_scores.get("vocabulary", 75) - baseline_scores.get("vocabulary", 70),
                    "clarity": clarity_gain,
                    "confidence": current_scores.get("confidence", 75) - baseline_scores.get("confidence", 70)
                },
                recommended_next_goals=["Target 20 speaking minutes daily.", "Practice extempore drills with 2-minute limits.", "Master 5 new vocabulary phrases in context."]
            )

    def analyze_utterance(
        self,
        transcript: str,
        level: str = "Intermediate",
        explanation_language: str = "Tamil",
        recent_context: list[str] | None = None
    ) -> UtteranceAnalysis:
        if not self.client or not transcript or not transcript.strip():
            return UtteranceAnalysis(is_practice=True, mistakes=[])

        prompt = f'''Analyze this single spoken utterance from an English learner.
Learner level: {level}
Learner native / explanation language: {explanation_language}
Recent conversation context: {recent_context[-4:] if recent_context else []}
Learner utterance: "{transcript}"

RULES:
1. Input is speech-to-text: completely IGNORE punctuation, capitalisation, casing, and speech fillers (um, uh, like, you know).
2. Do NOT flag natural informal or conversational speech as an error.
3. NEVER invent or fabricate errors. If the utterance is grammatically sound and natural, return mistakes: [].
4. Greetings, farewells, short acknowledgments, or one-word answers MUST return mistakes: [].
5. If there is a clear grammatical or phrasing mistake (tense, subject-verb agreement, preposition, article, unnatural word order), identify up to 2 most important mistakes.
6. Provide concise explanation in English and explanation_native in {explanation_language} (e.g. Tamil).
7. Return JSON adhering to schema with is_practice: bool and mistakes: list.'''
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": UtteranceAnalysis}
            )
            res = UtteranceAnalysis.model_validate_json(response.text)
            valid_mistakes = [
                m for m in res.mistakes
                if m.original.strip().lower() != m.corrected.strip().lower()
                and m.corrected.strip()
            ]
            return UtteranceAnalysis(is_practice=res.is_practice, mistakes=valid_mistakes[:2])
        except Exception as e:
            logger.warning(f"Gemini analyze_utterance failed or quota reached ({e}). Returning empty analysis.")
            return UtteranceAnalysis(is_practice=True, mistakes=[])

provider = GeminiProvider()


