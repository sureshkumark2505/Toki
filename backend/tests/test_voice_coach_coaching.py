import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app, db
from app.database import SessionLocal
from app.models import User, Session, Turn, Mistake, LearningProfile, UserSettings
from app.coaching import (
    is_meaningful_turn,
    evaluate_session,
    next_streak,
    today_local,
    LiveTurnAssembler,
    build_live_system_prompt
)
from app.providers.ai import (
    UtteranceAnalysis,
    UtteranceMistake,
    SessionReportAIResult,
    ScoreBreakdown,
    CorrectionItem,
    VocabItemCaptured,
    ScenarioReportAIResult,
    InterviewAttemptAIResult,
    InterviewScoreBreakdown,
    CoachResult,
    RoleplayTurnAIResult
)

client = TestClient(app)

# ----------------- UNIT TESTS: COACHING UTILS -----------------

def test_is_meaningful_turn():
    assert is_meaningful_turn("") is False
    assert is_meaningful_turn("hi") is False
    assert is_meaningful_turn("hello bye thanks") is False
    assert is_meaningful_turn("ok yeah sure") is False
    assert is_meaningful_turn("uh um yes well") is False
    
    # 3 non-filler words -> False
    assert is_meaningful_turn("I like apples") is False
    
    # 4 non-filler words -> True
    assert is_meaningful_turn("I like red apples") is True
    assert is_meaningful_turn("Yesterday I went to market and bought vegetables.") is True
    assert is_meaningful_turn("Hi, I went to the store today.") is True


def test_evaluate_session():
    # Insufficient turns and words
    res1 = evaluate_session(["hi", "bye"], min_meaningful_turns=4, min_spoken_words=40)
    assert res1.qualifies is False
    assert res1.meaningful_turns == 0
    assert "didn't count" in res1.practice_message
    
    # Sufficient turns and words (> 40 words total, 4 meaningful turns)
    good_turns = [
        "Yesterday morning I went to the large supermarket in downtown to buy fresh groceries and supplies.",
        "The weather in Chennai was extremely hot and humid during the entire afternoon hours.",
        "I usually prefer working on software development and architecture in the quiet morning hours.",
        "Learning spoken English with daily deliberate practice definitely helps build great speaking confidence."
    ]
    res2 = evaluate_session(good_turns, min_meaningful_turns=4, min_spoken_words=40)
    assert res2.qualifies is True
    assert res2.meaningful_turns == 4
    assert res2.spoken_words >= 40
    assert res2.practice_message == ""


def test_next_streak():
    today = date(2026, 9, 21)
    yesterday = date(2026, 9, 20)
    three_days_ago = date(2026, 9, 18)

    # First session ever (no previous date)
    assert next_streak(0, None, today) == 1
    assert next_streak(0, "", today) == 1

    # Same day practice: preserves streak, ensures min 1
    assert next_streak(5, today.isoformat(), today) == 5
    assert next_streak(0, today.isoformat(), today) == 1  # edge case: old row with 0 streak

    # Yesterday practice: increments streak
    assert next_streak(1, yesterday.isoformat(), today) == 2
    assert next_streak(5, yesterday.isoformat(), today) == 6
    assert next_streak(0, yesterday.isoformat(), today) == 1

    # Gap > 1 day: resets to 1
    assert next_streak(10, three_days_ago.isoformat(), today) == 1


def test_live_turn_assembler():
    assembler = LiveTurnAssembler()

    # Streaming user chunks
    assembler.push_user_chunk("Yesterday I", is_interim=False)
    assembler.push_user_chunk("went to market", is_interim=False)
    assert assembler.get_accumulated_user_text() == "Yesterday I went to market"

    # Coach chunk arrives -> finalizes learner turn
    finalized = assembler.push_coach_chunk("That's great! ")
    assert finalized == "Yesterday I went to market"
    assert assembler.get_accumulated_user_text() == ""

    # Coach turn completes
    assembler.push_coach_chunk("What did you buy?")
    coach_turn = assembler.finalize_coach_turn()
    assert coach_turn == "That's great! What did you buy?"

    # Interruption clears coach chunks
    assembler.push_coach_chunk("I was about to say")
    assembler.handle_interruption()
    assert assembler.finalize_coach_turn() is None


def test_build_live_system_prompt():
    prompt = build_live_system_prompt(
        objective="Travel Booking",
        level="Intermediate",
        native_language="Tamil",
        explanation_language="Tamil",
        correction_style="Strict",
        recurring_mistakes=["I went to yesterday -> Yesterday I went"]
    )
    assert "Tamil" in prompt
    assert "Travel Booking" in prompt
    assert "Strict" in prompt
    assert "Try saying:" in prompt
    assert "Yesterday I went" in prompt


# ----------------- INTEGRATION TESTS: SESSIONS & STREAKS -----------------

@pytest.fixture
def test_user():
    with SessionLocal() as d:
        user = User(
            name="Test Coach Learner",
            native_language="Tamil",
            goal="Fluency",
            daily_minutes=15,
            xp=0,
            streak_days=0,
            last_practice_date="",
            badges=[]
        )
        d.add(user)
        d.commit()
        d.refresh(user)
        user_id = user.id
    return user_id


@patch("app.main.provider.coach")
def test_non_qualifying_session_does_not_award_streak(mock_coach, test_user):
    mock_coach.return_value = CoachResult(
        reply="Hello! What would you like to practice today?",
        correction=None,
        explanation=None,
        next_prompt="Tell me about your morning."
    )

    # Start session
    res = client.post("/api/sessions", json={"user_id": test_user, "objective": "Quick Chat"})
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    # Short filler turns
    client.post(f"/api/sessions/{session_id}/turn", json={"transcript": "hi"})
    client.post(f"/api/sessions/{session_id}/turn", json={"transcript": "bye"})

    # End session
    end_res = client.post(f"/api/sessions/{session_id}/end")
    assert end_res.status_code == 200
    data = end_res.json()
    assert data["streak_counted"] is False
    assert data["streak_days"] == 0
    assert data["xp_earned"] == 0
    assert "didn't count" in data["practice_message"]

    # Verify user row
    with SessionLocal() as d:
        user = d.get(User, test_user)
        assert user.streak_days == 0
        assert user.xp == 0


@patch("app.main.provider.coach")
@patch("app.main.provider.generate_session_report")
def test_qualifying_session_awards_streak_and_xp(mock_report, mock_coach, test_user):
    mock_coach.return_value = CoachResult(
        reply="That sounds like a wonderful plan! Tell me more.",
        correction=None,
        explanation=None,
        next_prompt="What did you do after that?"
    )
    mock_report.return_value = SessionReportAIResult(
        summary="Great job speaking clearly!",
        scores=ScoreBreakdown(fluency=85, grammar=82, vocabulary=80, clarity=88, confidence=85),
        strengths=["Clear full sentences", "Good vocabulary"],
        key_corrections=[],
        vocabulary_captured=[],
        recommended_exercise="Keep practicing daily."
    )

    # Start session
    res = client.post("/api/sessions", json={"user_id": test_user, "objective": "Daily Life Discussion"})
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    good_sentences = [
        "Yesterday morning I went to the central park and walked for five kilometers.",
        "After walking I had healthy breakfast with fresh seasonal fruits and hot black coffee.",
        "I then started my daily software development tasks for the cloud platform project.",
        "In the evening I met several of my close colleagues at the downtown public library."
    ]

    for sentence in good_sentences:
        client.post(f"/api/sessions/{session_id}/turn", json={"transcript": sentence})

    # End session
    end_res = client.post(f"/api/sessions/{session_id}/end")
    assert end_res.status_code == 200
    data = end_res.json()
    assert data["streak_counted"] is True
    assert data["streak_days"] == 1
    assert data["xp_earned"] >= 18  # 10 base + 2 * 4 turns = 18
    assert data["practice_message"] == ""

    # Verify user row updated
    with SessionLocal() as d:
        user = d.get(User, test_user)
        assert user.streak_days == 1
        assert user.xp >= 18
        assert user.last_practice_date == today_local().isoformat()

    # Second qualifying session on the same day should not double count streak
    res2 = client.post("/api/sessions", json={"user_id": test_user, "objective": "Evening Review"})
    session2_id = res2.json()["session_id"]
    for sentence in good_sentences:
        client.post(f"/api/sessions/{session2_id}/turn", json={"transcript": sentence})
    end_res2 = client.post(f"/api/sessions/{session2_id}/end")
    assert end_res2.status_code == 200
    data2 = end_res2.json()
    assert data2["streak_counted"] is True
    assert data2["streak_days"] == 1  # Stays 1, not 2


@patch("app.main.provider.roleplay_turn")
@patch("app.main.provider.generate_scenario_report")
def test_scenario_end_awards_streak_if_qualified(mock_scenario_report, mock_roleplay, test_user):
    mock_roleplay.return_value = RoleplayTurnAIResult(
        reply="Certainly! I will prepare that for you right away.",
        role_character="Barista",
        coaching_tip=None
    )
    mock_scenario_report.return_value = ScenarioReportAIResult(
        scenario_title="Coffee Shop Order",
        communication_score=85,
        scores=ScoreBreakdown(fluency=80, grammar=82, vocabulary=80, clarity=84, confidence=82),
        strengths=["Polite order"],
        improvements=["None"],
        summary="Great roleplay."
    )

    scenarios = client.get("/api/scenarios").json()
    scenario_id = scenarios[0]["id"] if scenarios else 1

    res = client.post(f"/api/scenarios/{scenario_id}/start", json={"user_id": test_user, "scenario_id": scenario_id})
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    good_sentences = [
        "Hello there, I would like to order a large warm cappuccino with organic oat milk.",
        "Could you also please add a warm blueberry muffin and heat it up slightly?",
        "I will gladly pay for the entire order using my contactless credit card right now.",
        "Thank you very much for the exceptional and fast customer service today."
    ]
    for s in good_sentences:
        client.post(f"/api/scenarios/{session_id}/turn", json={"transcript": s})

    end_res = client.post(f"/api/scenarios/{session_id}/end")
    assert end_res.status_code == 200

    with SessionLocal() as d:
        user = d.get(User, test_user)
        assert user.streak_days == 1
        assert user.xp > 0


@patch("app.main.provider.coach")
@patch("app.main.provider.evaluate_interview_session")
def test_interview_end_awards_streak_if_qualified(mock_interview_eval, mock_coach, test_user):
    mock_coach.return_value = CoachResult(
        reply="Thank you for sharing that experience. Can you tell me about a challenge you faced?",
        correction=None,
        explanation=None,
        next_prompt="How did you resolve it?"
    )
    mock_interview_eval.return_value = InterviewAttemptAIResult(
        interview_type="HR Round: Introduction & Fit",
        scores=InterviewScoreBreakdown(clarity=85, structure=82, conciseness=80, confidence=88, vocabulary=85, grammar=84),
        summary="Solid interview.",
        strengths=["Clear articulation"],
        improvements=["Keep STAR focus"]
    )

    res = client.post("/api/interview/start", json={"user_id": test_user, "interview_type": "HR Round: Introduction & Fit", "target_role": "Engineer"})
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    good_sentences = [
        "I have over five years of direct engineering experience designing high scale cloud microservices.",
        "In my previous leadership position I managed and mentored a team of six talented engineers.",
        "We successfully improved API system throughput and reduced latencies by over forty percent overall.",
        "I am looking forward to bringing my deep distributed systems expertise to your team."
    ]
    for s in good_sentences:
        client.post(f"/api/sessions/{session_id}/turn", json={"transcript": s})

    end_res = client.post(f"/api/interview/{session_id}/end")
    assert end_res.status_code == 200

    with SessionLocal() as d:
        user = d.get(User, test_user)
        assert user.streak_days == 1
        assert user.xp > 0
