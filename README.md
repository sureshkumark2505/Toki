# Toki — AI English Voice Coach 🎙️✨

**Toki** is a production-ready, voice-first personal English communication coach. Powered by Google Gemini's Multimodal Live API, Toki delivers natural full-duplex spoken conversations, instant user barge-in support, real-time micro-corrections, and structured daily fluency journeys.

---

## 🚀 Key Highlights & Architecture

- **Sub-Second Voice Streaming**: Real-time bidirectional voice exchange powered by Gemini Live WebSockets with 16kHz PCM recording and 24kHz native audio playback.
- **Natural Conversational Interruption (Barge-In)**: Speak at any moment to interrupt Toki naturally—just like conversing with a human native coach.
- **Zero Mock Data — 100% Database-Driven**:
  - Live progression tracking (streaks, total spoken minutes, turn counts).
  - Dynamic weekly calendar rhythm matching real practice days.
  - Persistent recent session history and detailed AI session reports.
  - Vocabulary bank with pronunciation audio and spaced-repetition mastery.
- **Production Database Architecture**: Seamlessly runs on local **SQLite** for rapid development and **Supabase (PostgreSQL)** for scalable production deployments.
- **Comprehensive Privacy & Controls**: User profile customization (target level, native language, speaking pace, voice accents), one-click JSON data export, and full account reset.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Web Audio API (PCM 16/24kHz streaming), Lucide & Material Symbols |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy, WebSockets, `psycopg2-binary`, Pydantic v2 |
| **AI Engine** | Google Gemini Multimodal Live API (`gemini-2.0-flash-exp` / `gemini-2.5-flash`), Google GenAI SDK |
| **Database** | SQLite (Default Dev) / Supabase PostgreSQL (Production) |

---

## 📦 Project Structure

```
Toki/
├── backend/
│   ├── app/
│   │   ├── config.py             # App configuration, database URI normalization, Gemini keys
│   │   ├── database.py           # SQLAlchemy engine, connection pooling, table lifecycle
│   │   ├── models.py             # 14 DB models (Users, Sessions, Turns, Feedback, Vocab, etc.)
│   │   ├── schemas.py            # Pydantic schemas for validation and API contracts
│   │   ├── services.py           # Business logic: progress calculations, daily plans, AI feedback
│   │   ├── gemini_live.py        # Gemini Live bi-directional WebSocket client
│   │   └── main.py               # FastAPI REST & WebSocket endpoints
│   ├── tests/                    # Pytest test suite (19 test cases)
│   ├── requirements.txt          # Python dependencies (FastAPI, SQLAlchemy, psycopg2, google-genai)
│   └── supabase_schema.sql       # Standalone PostgreSQL DDL schema & seed data for Supabase
├── frontend/
│   ├── src/
│   │   ├── components/           # UI Components (HomeScreen, ActiveSessionScreen, TokiOrb, etc.)
│   │   ├── services/
│   │   │   ├── api.ts            # Typed REST client with FastAPI backend
│   │   │   └── voice/            # Web Audio PCM recorder, PCM player, Gemini Live WebSocket client
│   │   ├── types.ts              # Global TypeScript interfaces
│   │   ├── App.tsx               # Main application controller and navigation shell
│   │   └── main.tsx              # React entry point
│   ├── package.json              # Node dependencies
│   └── vite.config.ts            # Vite build & development server configuration
├── .env.example                  # Environment variable reference
└── README.md                     # Project documentation
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Google Gemini API Key** ([Get your key here](https://aistudio.google.com/app/apikey))

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Populate `.env` with your settings:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=models/gemini-2.0-flash-exp
DATABASE_URL=sqlite:///./app.db
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

### 3. Start Backend Server
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at `http://localhost:8000/docs`.

### 4. Start Frontend Application
```bash
cd frontend
npm install
npm run dev
```
Open your browser and navigate to `http://localhost:5173` (or `http://localhost:3000`).

---

## 🗄️ Supabase (PostgreSQL) Database Setup

Toki is built with full support for Supabase PostgreSQL databases with SSL connection pooling and automatic dialect normalization.

### Option A: Automatic Table Creation
1. Create a new project in [Supabase](https://supabase.com).
2. Go to **Project Settings > Database > Connection String > URI**.
3. Set your `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```
4. Start the backend (`uvicorn app.main:app`). SQLAlchemy will automatically initialize all 14 tables and initial seeds on startup.

### Option B: Supabase SQL Editor (Instant DDL)
1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Click on **SQL Editor** in the left sidebar.
3. Paste the contents of [`backend/supabase_schema.sql`](backend/supabase_schema.sql) and click **Run**.
4. All tables, foreign keys with `CASCADE` rules, performance indexes, and initial scenario seeds will be created instantly.

---

## 🧪 Testing & Verification

### Run Backend Tests (Pytest)
```bash
cd backend
python -m pytest
```
Runs 19 integration and unit tests covering health checks, session creation, turn processing, AI feedback summaries, profile settings, and data exports.

### Run Frontend Build & TypeScript Check
```bash
cd frontend
npm run build
```
Ensures 100% type safety and bundles production assets.

---

## 🔒 Privacy & Safety
- **No API keys in the browser**: All AI processing, prompts, and Gemini tokens are managed securely through the backend.
- **Full Data Ownership**: Learners can export their entire learning history as JSON or permanently wipe their account data at any time from the Profile tab.

---

## 📄 License
This project is licensed under the MIT License.
