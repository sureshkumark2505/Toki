from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_listening_exercises_and_evaluation():
    # List listening exercises
    r = client.get("/api/listening/exercises")
    assert r.status_code == 200
    exercises = r.json()
    assert len(exercises) >= 4
    ex = exercises[0]
    assert "audio_script" in ex
    assert "questions" in ex
    assert len(ex["questions"]) > 0

    # User onboard
    user_res = client.post("/api/onboarding", json={
        "name": "Listening Learner",
        "native_language": "Tamil",
        "goal": "Workplace",
        "daily_minutes": 20
    })
    user_id = user_res.json()["user_id"]

    # Evaluate listening answers (e.g. all correct)
    correct_answers = [q["correct_idx"] for q in ex["questions"]]
    eval_res = client.post("/api/listening/evaluate", json={
        "user_id": user_id,
        "exercise_id": ex["id"],
        "selected_answers": correct_answers
    })
    assert eval_res.status_code == 200
    data = eval_res.json()
    assert data["score"] == 100
    assert data["correct_count"] == len(correct_answers)
    assert data["xp_earned"] > 0
    assert "feedback" in data

def test_dictation_prompts_and_word_diffs():
    # Fetch dictation prompts
    r = client.get("/api/dictation/prompts")
    assert r.status_code == 200
    prompts = r.json()
    assert len(prompts) >= 4
    prompt = prompts[0]
    assert "dictation_sentence" in prompt

    # Evaluate exact match dictation
    eval_res = client.post("/api/dictation/evaluate", json={
        "user_id": 1,
        "exercise_id": prompt["id"],
        "original_text": prompt["dictation_sentence"],
        "learner_input": prompt["dictation_sentence"]
    })
    assert eval_res.status_code == 200
    res_data = eval_res.json()
    assert res_data["accuracy_score"] == 100
    assert len(res_data["word_diffs"]) > 0
    assert all(w["status"] == "correct" for w in res_data["word_diffs"])

    # Evaluate partial match with missing/extra words
    partial_res = client.post("/api/dictation/evaluate", json={
        "user_id": 1,
        "exercise_id": prompt["id"],
        "original_text": "Our engineering team will focus on API reliability.",
        "learner_input": "Our team will focus on reliability."
    })
    assert partial_res.status_code == 200
    partial_data = partial_res.json()
    assert 0 < partial_data["accuracy_score"] < 100
    statuses = [w["status"] for w in partial_data["word_diffs"]]
    assert "missing" in statuses or "correct" in statuses

def test_progress_dashboard_and_gamification():
    user_res = client.post("/api/onboarding", json={
        "name": "Progress Champion",
        "native_language": "Tamil",
        "goal": "Fluency",
        "daily_minutes": 25
    })
    user_id = user_res.json()["user_id"]

    # Check progress dashboard
    prog_res = client.get(f"/api/progress/{user_id}")
    assert prog_res.status_code == 200
    prog_data = prog_res.json()
    assert "overall_score" in prog_data
    assert "current_scores" in prog_data
    assert "baseline_scores" in prog_data
    assert "badges" in prog_data
    assert "streak_days" in prog_data
    assert prog_data["xp"] >= 100
    assert len(prog_data["badges"]) >= 1

def test_weekly_trends_and_monthly_report():
    user_res = client.post("/api/onboarding", json={
        "name": "Analytics User",
        "native_language": "Tamil",
        "goal": "Interview",
        "daily_minutes": 30
    })
    user_id = user_res.json()["user_id"]

    # Check 7-day trend
    trend_res = client.get(f"/api/progress/weekly/{user_id}")
    assert trend_res.status_code == 200
    trend_data = trend_res.json()
    assert "daily_trends" in trend_data
    assert len(trend_data["daily_trends"]) == 7
    assert "coach_weekly_summary" in trend_data

    # Check comparative progress report
    rep_res = client.get(f"/api/progress/report/{user_id}")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert "summary" in rep_data
    assert "strengths" in rep_data
    assert "baseline_vs_current" in rep_data
    assert "recommended_next_goals" in rep_data
