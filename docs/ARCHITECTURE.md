# Gemini-first architecture

`Next.js client -> FastAPI -> provider interfaces -> Gemini` is the V1 request path. The browser never receives `GEMINI_API_KEY`. Browser SpeechRecognition is used only as a local MVP transcription convenience; production audio can be routed through a server-side `SpeechToTextProvider` implementation. Likewise, `TextToSpeechProvider` and `PronunciationProvider` are intentionally separate so a specialist pronunciation service can be added without changing coach logic.

## Data model

The live schema implements users, sessions, turns, and mistake memory. Planned migrations add `learning_profiles`, `vocabulary`, `skills`, `skill_progress`, `lessons`, `daily_plans`, `assessment_reports`, and `progress_snapshots`, matching the supplied product specification. Switch `DATABASE_URL` to PostgreSQL before deployment; SQLAlchemy keeps the application layer portable.

## API contract

| Endpoint | Purpose |
| --- | --- |
| `POST /api/onboarding` | Creates a local learner profile. |
| `POST /api/sessions` | Starts guided/free/scenario/interview practice. |
| `POST /api/sessions/{id}/turn` | Saves learner text and returns typed Gemini coaching feedback. |
| `POST /api/sessions/{id}/end` | Closes the session and returns the most useful stored corrections. |
| `GET /api/mistakes/{user_id}` | Returns mistake-memory records for future review. |
| `GET /health` | Readiness and Gemini-configuration status, without exposing secrets. |

## Delivery sequence

1. Replace local profile creation with OAuth/passwordless auth and authorization checks.
2. Add assessment prompts and `assessment_reports`.
3. Build task generation and a spaced-review scheduler for mistake/vocabulary records.
4. Add scenario, listening/dictation, and interview modules using the same session engine.
5. Add database migrations, signed audio storage and configurable retention before storing raw recordings.
6. Add specialist speech assessment before reporting phoneme, stress, or accent scores.
