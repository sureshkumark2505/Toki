-- ====================================================================
-- TOKI ENGLISH SPEAKING COACH - SUPABASE (POSTGRESQL) SCHEMA
-- Run this SQL in the Supabase SQL Editor to initialize all tables & seeds.
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL DEFAULT 'Learner',
    native_language VARCHAR(40) NOT NULL DEFAULT 'English & Tamil',
    goal VARCHAR(80) NOT NULL DEFAULT 'Daily Fluency & Spoken Confidence',
    daily_minutes INTEGER NOT NULL DEFAULT 10,
    xp INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_practice_date VARCHAR(10) NOT NULL DEFAULT '',
    badges JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. USER SETTINGS & PREFERENCES
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_voice VARCHAR(60) NOT NULL DEFAULT 'Calm British (Neutral UK)',
    speech_pace FLOAT NOT NULL DEFAULT 1.0,
    correction_style VARCHAR(60) NOT NULL DEFAULT 'Gentle & Encouraging',
    explanation_language VARCHAR(40) NOT NULL DEFAULT 'English & Tamil',
    audio_retention_days INTEGER NOT NULL DEFAULT 7,
    sound_effects_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. LEARNING PROFILES & BASELINES
CREATE TABLE IF NOT EXISTS learning_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level VARCHAR(30) NOT NULL DEFAULT 'Intermediate (B1/B2)',
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    baseline_scores JSONB NOT NULL DEFAULT '{"fluency": 75, "grammar": 72, "vocabulary": 78, "clarity": 75, "listening": 80, "confidence": 70}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(40) NOT NULL DEFAULT 'guided',
    objective VARCHAR(240) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- 5. TURNS (DIALOGUE STREAM)
CREATE TABLE IF NOT EXISTS turns (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,
    transcript TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);

-- 6. SESSION FEEDBACK REPORTS
CREATE TABLE IF NOT EXISTS session_feedback (
    id SERIAL PRIMARY KEY,
    session_id INTEGER UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    fluency_score INTEGER NOT NULL DEFAULT 75,
    grammar_score INTEGER NOT NULL DEFAULT 75,
    vocab_score INTEGER NOT NULL DEFAULT 75,
    clarity_score INTEGER NOT NULL DEFAULT 75,
    confidence_score INTEGER NOT NULL DEFAULT 75,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
    vocabulary_captured JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_exercise TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON session_feedback(user_id);

-- 7. MISTAKE MEMORY & SPACED REPETITION
CREATE TABLE IF NOT EXISTS mistakes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(60) NOT NULL DEFAULT 'grammar',
    pattern VARCHAR(120) NOT NULL DEFAULT 'general',
    original TEXT NOT NULL,
    correction TEXT NOT NULL,
    explanation TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    mastery INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 1,
    review_count INTEGER NOT NULL DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_next_review ON mistakes(next_review);

-- 8. VOCABULARY BANK
CREATE TABLE IF NOT EXISTS vocabulary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_or_phrase VARCHAR(120) NOT NULL,
    meaning TEXT NOT NULL,
    example TEXT NOT NULL,
    learner_usage TEXT NOT NULL DEFAULT '',
    mastery INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 1,
    review_count INTEGER NOT NULL DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);

-- 9. DAILY PLANS
CREATE TABLE IF NOT EXISTS daily_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_reason TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, date);

-- 10. ASSESSMENT REPORTS
CREATE TABLE IF NOT EXISTS assessment_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_user_id ON assessment_reports(user_id);

-- 11. PROGRESS SNAPSHOTS (DAILY AGGREGATES)
CREATE TABLE IF NOT EXISTS progress_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    fluency INTEGER NOT NULL DEFAULT 75,
    grammar INTEGER NOT NULL DEFAULT 75,
    vocab INTEGER NOT NULL DEFAULT 75,
    clarity INTEGER NOT NULL DEFAULT 75,
    listening INTEGER NOT NULL DEFAULT 75,
    confidence INTEGER NOT NULL DEFAULT 75,
    overall_score INTEGER NOT NULL DEFAULT 75,
    speaking_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON progress_snapshots(user_id, date);

-- 12. SCENARIOS (ROLEPLAY CATALOGUE)
CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    level VARCHAR(30) NOT NULL DEFAULT 'Intermediate',
    role VARCHAR(80) NOT NULL,
    learner_role VARCHAR(80) NOT NULL,
    objective VARCHAR(240) NOT NULL,
    description TEXT NOT NULL,
    initial_prompt TEXT NOT NULL,
    difficulty VARCHAR(30) NOT NULL DEFAULT 'Medium'
);

-- 13. INTERVIEW ATTEMPTS
CREATE TABLE IF NOT EXISTS interview_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interview_type VARCHAR(80) NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT NOT NULL,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 14. LISTENING EXERCISES & DICTATION
CREATE TABLE IF NOT EXISTS listening_exercises (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    level VARCHAR(30) NOT NULL DEFAULT 'Intermediate',
    audio_script TEXT NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    dictation_sentence TEXT NOT NULL,
    difficulty VARCHAR(30) NOT NULL DEFAULT 'Medium'
);

CREATE TABLE IF NOT EXISTS dictation_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL DEFAULT 0,
    original_text TEXT NOT NULL,
    learner_input TEXT NOT NULL,
    accuracy_score INTEGER NOT NULL DEFAULT 0,
    feedback TEXT NOT NULL DEFAULT '',
    word_diffs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- INITIAL SEED DATA FOR SCENARIOS
-- ====================================================================
INSERT INTO scenarios (title, category, level, role, learner_role, objective, description, initial_prompt, difficulty)
VALUES
(
    'Client Project Scope & Timeline',
    'Workplace',
    'Intermediate',
    'Sarah (US Client Project Director)',
    'Lead Software Developer / Project Manager',
    'Discuss sprint deliverables, clarify requirements, and manage deadline expectations politely.',
    'You are meeting with Sarah, an enterprise client in New York. She is asking for an update on feature delivery and wondering if the deadline can be moved up.',
    'Hi there! Thanks for jumping on this call. We reviewed the demo you sent over, but we really need the authentication module done by Friday. Can you walk me through where your team is at right now?',
    'Medium'
),
(
    'Daily Standup: Progress & Technical Blocker',
    'Workplace',
    'Beginner',
    'David (Scrum Master)',
    'Software Engineer',
    'Clearly state yesterday''s progress, today''s focus, and articulate a technical blocker.',
    'You are in your morning 15-minute engineering standup. Speak concisely and describe what you worked on and where you are waiting on the database team.',
    'Morning team! Let''s go around. You''re up next — what did you wrap up yesterday, what''s on your plate today, and do you have any blockers?',
    'Easy'
),
(
    'Disagreeing Politely on Architecture',
    'Workplace',
    'Advanced',
    'Alex (Senior Architect)',
    'Backend Engineer',
    'Politely challenge an architecture proposal using professional phrasing and clear justification.',
    'Alex wants to rewrite the database layer before the launch. Explain why this poses a high risk to the schedule and propose a safer phased alternative.',
    'I think we should pause feature development and refactor our entire database schema this week. It will make things cleaner long-term. What do you think?',
    'Hard'
),
(
    'HR Round: Introduction & Fit',
    'Job Interview',
    'Intermediate',
    'Priya (HR Talent Lead)',
    'Job Candidate',
    'Deliver a structured 90-second elevator pitch covering background, key achievements, and role alignment.',
    'You are interviewing for a role at a fast-growing global tech firm. Introduce yourself with confidence and highlight your relevant experience.',
    'Welcome! We''re excited to learn more about you today. To kick things off, could you walk me through your background and what motivated you to apply for this role?',
    'Medium'
),
(
    'Behavioral: Resolving Team Conflict (STAR)',
    'Job Interview',
    'Advanced',
    'Michael (Hiring Manager)',
    'Senior Candidate',
    'Use the Situation-Task-Action-Result (STAR) structure to describe resolving a workplace disagreement.',
    'The hiring manager wants to assess your emotional intelligence and communication skills under pressure.',
    'Tell me about a time when you strongly disagreed with a team member or stakeholder on a project decision. How did you handle it and what was the outcome?',
    'Hard'
),
(
    'Airport Immigration Interview',
    'Travel & Hospitality',
    'Beginner',
    'Officer Roberts (Border Control Officer)',
    'International Traveler',
    'Answer border control questions calmly and accurately regarding purpose of visit, accommodation, and stay duration.',
    'You have just landed at London Heathrow. Answer the immigration officer''s questions clearly with complete sentences.',
    'Good day. Passport and landing card, please. What is the purpose of your visit to the UK, and how long are you planning to stay?',
    'Easy'
),
(
    'Hotel Check-in & AC Malfunction',
    'Travel & Hospitality',
    'Intermediate',
    'Marco (Hotel Front Desk Manager)',
    'Hotel Guest',
    'Politely report a malfunctioning air conditioner and request a room change or immediate maintenance.',
    'You checked into room 402, but the air conditioning is blowing hot air. Explain the issue courteously at the front desk.',
    'Good evening, sir. Welcome to the Grand Central Hotel. How can I assist you tonight?',
    'Medium'
),
(
    'Restaurant Order & Allergy Clarification',
    'Daily Life',
    'Beginner',
    'Elena (Restaurant Server)',
    'Diner',
    'Ask about menu ingredients, specify dietary preferences, and place an order politely.',
    'You are having dinner at a bistro. Ask about vegetarian options and specify that you have a nut allergy.',
    'Hello! Welcome to The Olive Bistro. Can I get you started with some drinks, or are you ready to look at our dinner specials?',
    'Easy'
)
ON CONFLICT DO NOTHING;
