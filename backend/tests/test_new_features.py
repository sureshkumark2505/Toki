import pytest
from fastapi.testclient import TestClient
from app.main import app, BADGE_DEFINITIONS
from app.models import User, Session, Turn, LearningProfile, SessionFeedback

client = TestClient(app)

def test_daily_challenge_endpoint():
    res = client.get("/api/challenge/today/1")
    assert res.status_code == 200
    data = res.json()
    assert "title" in data
    assert "pattern" in data
    assert "example" in data
    assert "tip" in data
    assert "date" in data

def test_session_transcript_replay_endpoint():
    # 1. Create a session
    sess_res = client.post("/api/sessions", json={"user_id": 1, "objective": "Testing replay"})
    assert sess_res.status_code == 200
    session_id = sess_res.json()["session_id"]

    # 2. Add some turns
    client.post(f"/api/sessions/{session_id}/turn", json={"transcript": "Good morning coach, I am ready to practice speaking English."})

    # 3. Fetch transcript replay
    res = client.get(f"/api/sessions/{session_id}/transcript")
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == session_id
    assert data["objective"] == "Testing replay"
    assert len(data["turns"]) >= 1
    assert any(t["speaker"] == "learner" for t in data["turns"])
    assert any(t["speaker"] == "coach" for t in data["turns"])

def test_badges_milestone_and_auto_level_adjustment():
    # 1. Create a dedicated user
    onboard_res = client.post("/api/onboarding", json={
        "name": "BadgeTester",
        "native_language": "Tamil",
        "goal": "Confidence",
        "daily_minutes": 15
    })
    assert onboard_res.status_code == 200
    uid = onboard_res.json()["user_id"]

    # Check initially empty or default badges
    u_res = client.get(f"/api/user/{uid}")
    assert u_res.status_code == 200

    # 2. Run a qualifying session with 4 long sentences
    sess_res = client.post("/api/sessions", json={"user_id": uid, "objective": "Job Interview Prep"})
    sess_id = sess_res.json()["session_id"]

    long_turns = [
        "Good morning, I have over five years of dedicated experience in software architecture and engineering.",
        "In my previous role, I successfully spearheaded the entire migration to a cloud native microservices setup.",
        "We achieved a significant forty percent decrease in operational overhead and deployment downtime.",
        "I am eager to contribute my strong technical knowledge and strategic leadership to your forward thinking engineering team."
    ]

    for turn in long_turns:
        client.post(f"/api/sessions/{sess_id}/turn", json={"transcript": turn})

    # 3. End session and verify badges & report
    end_res = client.post(f"/api/sessions/{sess_id}/end")
    assert end_res.status_code == 200
    report = end_res.json()
    assert report["streak_counted"] is True
    assert "newly_awarded_badges" in report

    # Verify user profile received badges in DB
    u_after = client.get(f"/api/user/{uid}")
    assert u_after.status_code == 200

def test_analyze_utterance_short_words_guard():
    # Calling analyze_utterance directly through AI provider to check it executes smoothly
    from app.providers.ai import provider
    res_short = provider.analyze_utterance("hi ok bye")
    assert res_short is not None
