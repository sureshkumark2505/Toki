from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_translation_prompts():
    r = client.get("/api/translation/prompts")
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert "tamil_prompt" in data[0]

def test_onboarding_and_plan():
    user_res = client.post("/api/onboarding", json={
        "name": "Phase Test User",
        "native_language": "Tamil",
        "goal": "Workplace",
        "daily_minutes": 20
    })
    assert user_res.status_code == 200
    user_id = user_res.json()["user_id"]

    # Generate plan with custom minutes
    plan_res = client.post(f"/api/plan/generate?user_id={user_id}&minutes=15")
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert "tasks" in plan_data
    assert len(plan_data["tasks"]) > 0

    # Get today plan
    today_res = client.get(f"/api/plan/today/{user_id}")
    assert today_res.status_code == 200
    assert "tasks" in today_res.json()

def test_vocabulary_crud():
    user_res = client.post("/api/onboarding", json={
        "name": "Vocab Test User",
        "native_language": "Tamil",
        "goal": "Interview",
        "daily_minutes": 30
    })
    user_id = user_res.json()["user_id"]

    add_res = client.post("/api/vocabulary", json={
        "user_id": user_id,
        "word_or_phrase": "articulate",
        "meaning": "expressing oneself clearly",
        "example": "She gave an articulate speech.",
        "learner_usage": "I want to be more articulate."
    })
    assert add_res.status_code == 200
    vocab_id = add_res.json()["id"]

    list_res = client.get(f"/api/vocabulary/{user_id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(i["id"] == vocab_id for i in items)

def test_translation_evaluation():
    r = client.post("/api/translation/evaluate", json={
        "user_id": 1,
        "tamil_prompt": "நான் தினமும் காலையில் 7 மணிக்கு எழுந்து காபி குடிக்கிறேன்.",
        "learner_english": "I wake up at 7 AM everyday and drinking coffee.",
        "target_pattern": "Simple present tense"
    })
    assert r.status_code == 200
    data = r.json()
    assert "natural_english" in data
    assert "feedback" in data
    assert "accuracy_score" in data

def test_session_turns_and_end_report():
    user_res = client.post("/api/onboarding", json={
        "name": "Session Report User",
        "native_language": "Tamil",
        "goal": "Fluency",
        "daily_minutes": 20
    })
    user_id = user_res.json()["user_id"]

    sess_res = client.post("/api/sessions", json={
        "user_id": user_id,
        "kind": "guided",
        "objective": "Practice past tense storytelling"
    })
    assert sess_res.status_code == 200
    sess_id = sess_res.json()["session_id"]

    turn_res = client.post(f"/api/sessions/{sess_id}/turn", json={
        "transcript": "Yesterday I was go to Chennai and met my colleague."
    })
    assert turn_res.status_code == 200

    # End session and verify report
    end_res = client.post(f"/api/sessions/{sess_id}/end")
    assert end_res.status_code == 200
    report = end_res.json()
    assert "scores" in report
    assert "summary" in report
    assert "recommended_exercise" in report
    assert "key_corrections" in report

    # Test spaced repetition review endpoint
    due_res = client.get(f"/api/review/due/{user_id}")
    assert due_res.status_code == 200
    due_items = due_res.json()
    if due_items:
        mistake_id = due_items[0]["id"]
        ans_res = client.post("/api/review/answer", json={
            "mistake_id": mistake_id,
            "spoken_correction": "Yesterday I went to Chennai and met my colleague."
        })
        assert ans_res.status_code == 200
        ans_data = ans_res.json()
        assert "is_correct" in ans_data
        assert "mastery" in ans_data
