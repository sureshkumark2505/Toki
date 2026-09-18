# Speak Better - AI English Speaking Coach

Voice-first personal English communication coach using a Next.js interface, FastAPI API, SQLite locally (PostgreSQL-ready through `DATABASE_URL`), and Google Gemini as a backend-only provider.

## Run locally

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
2. Start the API: `cd backend; python -m pip install -r requirements.txt; uvicorn app.main:app --reload`.
3. Start the web app: `cd frontend; npm install; npm run dev`.
4. Visit `http://localhost:3000`.

Or run `docker compose up --build` from this folder.

## Included now

- Low-friction onboarding and daily speaking plan
- Browser microphone recognition with typed fallback and clear permission errors
- Guided voice session, Gemini coaching, speech playback, stored turn history
- One high-value correction at a time, persisted mistake memory, and end-session review
- Clean provider abstraction (`AIProvider` / `GeminiProvider`); no secret is shipped to the browser
- Phase 2 baseline assessment with text-based score estimates, saved learner profile, and tailored recommendations
- Phase 3 adaptive daily plan generation based on assessment weaknesses and recent corrections

## Next modules

The schema and session types are ready for assessment, free speaking, roleplay/interviews, vocabulary reviews, listening/dictation, spaced repetition, and progress snapshots. Add a dedicated STT/TTS/pronunciation provider before claiming phoneme-level pronunciation scores.
