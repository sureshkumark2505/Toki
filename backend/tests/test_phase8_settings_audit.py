import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Session, Turn, Mistake, Vocabulary

client = TestClient(app)

@pytest.fixture
def test_user():
    db = SessionLocal()
    user = User(name="Audit User", native_language="Tamil", goal="Professional Fluency", daily_minutes=25, xp=120, streak_days=2)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()
    return user_id

def test_user_settings_get_and_update(test_user):
    # 1. Get default settings
    res = client.get(f"/api/settings/{test_user}")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == test_user
    assert data["coach_voice"] == "Natural US (Standard)"
    assert data["speech_pace"] == 1.0
    assert data["audio_retention_days"] == 7
    assert data["explanation_language"] == "Tamil"

    # 2. Update settings
    update_payload = {
        "coach_voice": "Professional British (Oliver)",
        "speech_pace": 0.85,
        "correction_style": "Detailed & Grammatical",
        "explanation_language": "English",
        "audio_retention_days": 0,
        "sound_effects_enabled": False
    }
    res_up = client.put(f"/api/settings/{test_user}", json=update_payload)
    assert res_up.status_code == 200
    data_up = res_up.json()
    assert data_up["coach_voice"] == "Professional British (Oliver)"
    assert data_up["speech_pace"] == 0.85
    assert data_up["audio_retention_days"] == 0
    assert data_up["sound_effects_enabled"] is False

def test_user_data_export(test_user):
    # Seed some session data for test_user
    db = SessionLocal()
    sess = Session(user_id=test_user, kind="guided", objective="Audit Session Practice")
    db.add(sess)
    db.commit()
    db.refresh(sess)
    db.add(Turn(session_id=sess.id, speaker="learner", transcript="I am testing the export system."))
    db.add(Mistake(user_id=test_user, category="grammar", original="I goes there", correction="I go there", explanation="Use base verb with I"))
    db.add(Vocabulary(user_id=test_user, word_or_phrase="pragmatic", meaning="dealing with things sensibly", example="A pragmatic approach"))
    db.commit()
    db.close()

    res = client.get(f"/api/user/export/{test_user}")
    assert res.status_code == 200
    export_data = res.json()
    assert export_data["user"]["id"] == test_user
    assert export_data["sessions_count"] >= 1
    assert export_data["mistakes_count"] >= 1
    assert export_data["vocabulary_count"] >= 1
    assert "exported_at" in export_data

def test_user_data_reset(test_user):
    # Seed data
    db = SessionLocal()
    sess = Session(user_id=test_user, kind="guided", objective="To be wiped")
    db.add(sess)
    db.commit()
    db.refresh(sess)
    db.add(Turn(session_id=sess.id, speaker="learner", transcript="Wipe me"))
    db.add(Mistake(user_id=test_user, category="grammar", original="bad grammar", correction="good grammar", explanation="test"))
    db.commit()
    db.close()

    # Call delete
    res = client.delete(f"/api/user/data/{test_user}")
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Verify sessions and mistakes are cleaned
    db = SessionLocal()
    assert db.query(Session).filter_by(user_id=test_user).count() == 0
    assert db.query(Mistake).filter_by(user_id=test_user).count() == 0
    user = db.get(User, test_user)
    assert user.xp == 100
    assert user.streak_days == 1
    db.close()

def test_system_metrics_endpoint():
    res = client.get("/api/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.8.0"
    assert data["total_users"] >= 1
    assert "Gemini" in data["ai_provider"]
