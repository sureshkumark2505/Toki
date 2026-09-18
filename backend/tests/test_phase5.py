from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_scenarios_listing_and_filtering():
    # Test listing all scenarios
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    scenarios = r.json()
    assert len(scenarios) >= 10
    
    # Test category filtering
    workplace_r = client.get("/api/scenarios?category=Workplace")
    assert workplace_r.status_code == 200
    workplace_scenarios = workplace_r.json()
    assert len(workplace_scenarios) > 0
    assert all("Workplace" in s["category"] for s in workplace_scenarios)

def test_scenario_roleplay_lifecycle():
    # Create test user
    user_res = client.post("/api/onboarding", json={
        "name": "Scenario Tester",
        "native_language": "Tamil",
        "goal": "Workplace",
        "daily_minutes": 20
    })
    assert user_res.status_code == 200
    user_id = user_res.json()["user_id"]

    # Start scenario
    start_res = client.post("/api/scenarios/1/start", json={
        "user_id": user_id,
        "scenario_id": 1
    })
    assert start_res.status_code == 200
    data = start_res.json()
    session_id = data["session_id"]
    assert "opening" in data
    assert "scenario" in data
    assert data["scenario"]["id"] == 1

    # Take a roleplay turn
    turn_res = client.post(f"/api/scenarios/{session_id}/turn", json={
        "transcript": "Hi Sarah, our team is currently completing the authentication module and we are on track for testing tomorrow."
    })
    assert turn_res.status_code == 200
    turn_data = turn_res.json()
    assert "reply" in turn_data
    assert "role_character" in turn_data

    # End scenario and get report
    end_res = client.post(f"/api/scenarios/{session_id}/end")
    assert end_res.status_code == 200
    rep_data = end_res.json()
    assert "communication_score" in rep_data
    assert "strengths" in rep_data
    assert "improvements" in rep_data
    assert "summary" in rep_data

def test_interview_attempts_and_comparison():
    # Create test user
    user_res = client.post("/api/onboarding", json={
        "name": "Interview Candidate",
        "native_language": "Tamil",
        "goal": "Interview",
        "daily_minutes": 30
    })
    user_id = user_res.json()["user_id"]

    # Attempt 1: Start and end
    start1 = client.post("/api/interview/start", json={
        "user_id": user_id,
        "interview_type": "HR Round: Introduction & Fit",
        "target_role": "Senior Developer"
    })
    assert start1.status_code == 200
    assert start1.json()["attempt_number"] == 1
    session_1 = start1.json()["session_id"]

    turn1 = client.post(f"/api/sessions/{session_1}/turn", json={
        "transcript": "I am a software engineer with 4 years experience in Python and full stack development."
    })
    assert turn1.status_code == 200

    end1 = client.post(f"/api/interview/{session_1}/end?target_role=Senior Developer")
    assert end1.status_code == 200
    attempt1_id = end1.json()["attempt_id"]
    assert end1.json()["attempt_number"] == 1
    assert "scores" in end1.json()

    # Attempt 2: Start and end (should be attempt #2)
    start2 = client.post("/api/interview/start", json={
        "user_id": user_id,
        "interview_type": "HR Round: Introduction & Fit",
        "target_role": "Senior Developer"
    })
    assert start2.status_code == 200
    assert start2.json()["attempt_number"] == 2
    session_2 = start2.json()["session_id"]

    turn2 = client.post(f"/api/sessions/{session_2}/turn", json={
        "transcript": "Hello, I am a senior developer who architected high-scale microservices, improving throughput by 40%."
    })
    assert turn2.status_code == 200

    end2 = client.post(f"/api/interview/{session_2}/end?target_role=Senior Developer")
    assert end2.status_code == 200
    attempt2_id = end2.json()["attempt_id"]
    assert end2.json()["attempt_number"] == 2

    # Fetch attempts list
    attempts_list = client.get(f"/api/interview/attempts/{user_id}")
    assert attempts_list.status_code == 200
    assert len(attempts_list.json()) >= 2

    # Compare Attempt 1 vs Attempt 2
    comp_res = client.post("/api/interview/compare", json={
        "user_id": user_id,
        "attempt_id_1": attempt1_id,
        "attempt_id_2": attempt2_id
    })
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert "score_diffs" in comp_data
    assert "key_gains" in comp_data
    assert "coach_verdict" in comp_data
    assert comp_data["attempt_1"]["attempt_number"] == 1
    assert comp_data["attempt_2"]["attempt_number"] == 2

def test_extempore_topics_and_evaluation():
    # Topics
    topics_res = client.get("/api/extempore/topics")
    assert topics_res.status_code == 200
    topics = topics_res.json()
    assert len(topics) >= 5
    assert "topic" in topics[0]
    assert "guidance_questions" in topics[0]

    # Evaluate extempore monologue
    eval_res = client.post("/api/extempore/evaluate", json={
        "user_id": 1,
        "topic": "Describe your dream job and what makes it meaningful to you.",
        "duration_seconds": 60,
        "transcript": "My dream job is to lead innovative engineering teams. Um, I really love solving complex system architecture problems. You know, when a team collaborates well, we can build impactful solutions."
    })
    assert eval_res.status_code == 200
    data = eval_res.json()
    assert data["word_count"] > 10
    assert data["estimated_wpm"] > 0
    assert "scores" in data
    assert "structure_feedback" in data
    assert "introduction" in data["structure_feedback"]
    assert "filler_words_detected" in data
    assert "recommended_exercise" in data
