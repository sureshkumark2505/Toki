from fastapi.testclient import TestClient
from app.main import app
def test_health():
    assert TestClient(app).get('/health').status_code == 200

def test_assessment_prompts_are_voice_focused():
    response = TestClient(app).post('/api/assessment/start')
    assert response.status_code == 200
    assert len(response.json()['prompts']) == 5
