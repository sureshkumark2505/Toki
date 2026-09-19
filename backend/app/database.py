from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings

is_sqlite = settings.database_url.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    from . import models
    Base.metadata.create_all(bind=engine)
    # Lightweight SQLite column schema migration
    if is_sqlite:
        with engine.connect() as conn:
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                user_cols = {c["name"] for c in inspector.get_columns("users")}
                user_cols_to_add = [
                    ("xp", "INTEGER DEFAULT 100"),
                    ("streak_days", "INTEGER DEFAULT 1"),
                    ("last_practice_date", "VARCHAR(10) DEFAULT ''"),
                    ("badges", "TEXT DEFAULT '[]'"),
                ]
                for col_name, col_def in user_cols_to_add:
                    if col_name not in user_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))

            if "mistakes" in inspector.get_table_names():
                existing_cols = {c["name"] for c in inspector.get_columns("mistakes")}
                cols_to_add = [
                    ("pattern", "VARCHAR(120) DEFAULT 'general'"),
                    ("mastery", "INTEGER DEFAULT 0"),
                    ("interval_days", "INTEGER DEFAULT 1"),
                    ("review_count", "INTEGER DEFAULT 0"),
                    ("last_seen", "DATETIME NULL"),
                ]
                for col_name, col_def in cols_to_add:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE mistakes ADD COLUMN {col_name} {col_def}"))
                conn.commit()

    # Seed initial user if users table is empty
    with SessionLocal() as db_sess:
        if db_sess.query(models.User).count() == 0:
            default_user = models.User(
                name="Learner",
                native_language="English & Tamil",
                goal="Daily Fluency & Spoken Confidence",
                daily_minutes=10,
                xp=0,
                streak_days=0,
                last_practice_date="",
                badges=[]
            )
            db_sess.add(default_user)
            db_sess.commit()
            db_sess.refresh(default_user)

            # Create initial user settings and learning profile
            db_sess.add(models.UserSettings(
                user_id=default_user.id,
                coach_voice="Calm British (Neutral UK)",
                speech_pace=1.0,
                correction_style="Gentle & Encouraging",
                explanation_language="English & Tamil",
                audio_retention_days=7,
                sound_effects_enabled=True
            ))
            db_sess.add(models.LearningProfile(
                user_id=default_user.id,
                level="Intermediate (B1/B2)",
                strengths=["Eagerness to speak", "Good vocabulary comprehension"],
                weaknesses=["Past tense consistency", "Spontaneous phrasing"],
                baseline_scores={
                    "fluency": 75,
                    "grammar": 72,
                    "vocabulary": 78,
                    "clarity": 75,
                    "listening": 80,
                    "confidence": 70
                }
            ))
            db_sess.commit()

        # Seed initial scenarios if scenarios table is empty
        if db_sess.query(models.Scenario).count() == 0:
            seed_scenarios = [
                models.Scenario(
                    title="Client Project Scope & Timeline",
                    category="Workplace",
                    level="Intermediate",
                    role="Sarah (US Client Project Director)",
                    learner_role="Lead Software Developer / Project Manager",
                    objective="Discuss sprint deliverables, clarify requirements, and manage deadline expectations politely.",
                    description="You are meeting with Sarah, an enterprise client in New York. She is asking for an update on feature delivery and wondering if the deadline can be moved up.",
                    initial_prompt="Hi there! Thanks for jumping on this call. We reviewed the demo you sent over, but we really need the authentication module done by Friday. Can you walk me through where your team is at right now?",
                    difficulty="Medium"
                ),
                models.Scenario(
                    title="Daily Standup: Progress & Technical Blocker",
                    category="Workplace",
                    level="Beginner",
                    role="David (Scrum Master)",
                    learner_role="Software Engineer",
                    objective="Clearly state yesterday's progress, today's focus, and articulate a technical blocker.",
                    description="You are in your morning 15-minute engineering standup. Speak concisely and describe what you worked on and where you are waiting on the database team.",
                    initial_prompt="Morning team! Let's go around. You're up next — what did you wrap up yesterday, what's on your plate today, and do you have any blockers?",
                    difficulty="Easy"
                ),
                models.Scenario(
                    title="Disagreeing Politely on Architecture",
                    category="Workplace",
                    level="Advanced",
                    role="Alex (Senior Architect)",
                    learner_role="Backend Engineer",
                    objective="Politely challenge an architecture proposal using professional phrasing and clear justification.",
                    description="Alex wants to rewrite the database layer before the launch. Explain why this poses a high risk to the schedule and propose a safer phased alternative.",
                    initial_prompt="I think we should pause feature development and refactor our entire database schema this week. It will make things cleaner long-term. What do you think?",
                    difficulty="Hard"
                ),
                models.Scenario(
                    title="HR Round: Introduction & Fit",
                    category="Job Interview",
                    level="Intermediate",
                    role="Priya (HR Talent Lead)",
                    learner_role="Job Candidate",
                    objective="Deliver a structured 90-second elevator pitch covering background, key achievements, and role alignment.",
                    description="You are interviewing for a role at a fast-growing global tech firm. Introduce yourself with confidence and highlight your relevant experience.",
                    initial_prompt="Welcome! We're excited to learn more about you today. To kick things off, could you walk me through your background and what motivated you to apply for this role?",
                    difficulty="Medium"
                ),
                models.Scenario(
                    title="Behavioral: Resolving Team Conflict (STAR)",
                    category="Job Interview",
                    level="Advanced",
                    role="Michael (Hiring Manager)",
                    learner_role="Senior Candidate",
                    objective="Use the Situation-Task-Action-Result (STAR) structure to describe resolving a workplace disagreement.",
                    description="The hiring manager wants to assess your emotional intelligence and communication skills under pressure.",
                    initial_prompt="Tell me about a time when you strongly disagreed with a team member or stakeholder on a project decision. How did you handle it and what was the outcome?",
                    difficulty="Hard"
                ),
                models.Scenario(
                    title="Technical: Explaining a Complex Project",
                    category="Job Interview",
                    level="Intermediate",
                    role="Daniel (Technical Lead)",
                    learner_role="Software Engineer Candidate",
                    objective="Explain a complex technical project clearly, avoiding unnecessary jargon while demonstrating deep competence.",
                    description="Explain your most impactful project: architecture, trade-offs, and measurable results.",
                    initial_prompt="Can you tell me about the most technically challenging project you've worked on recently? What was the problem and how did you solve it?",
                    difficulty="Medium"
                ),
                models.Scenario(
                    title="HR: Salary & Compensation Discussion",
                    category="Job Interview",
                    level="Advanced",
                    role="Karen (Recruiter)",
                    learner_role="Candidate with Job Offer",
                    objective="Negotiate salary professionally, citing market value and your qualifications without sounding aggressive.",
                    description="The recruiter has offered a base package slightly lower than your target. Advocate for yourself diplomatically.",
                    initial_prompt="We'd love to extend an offer with a base salary of $85,000 plus benefits. How does that sound to you based on your expectations?",
                    difficulty="Hard"
                ),
                models.Scenario(
                    title="Airport Immigration Interview",
                    category="Travel & Hospitality",
                    level="Beginner",
                    role="Officer Roberts (Border Control Officer)",
                    learner_role="International Traveler",
                    objective="Answer border control questions calmly and accurately regarding purpose of visit, accommodation, and stay duration.",
                    description="You have just landed at London Heathrow. Answer the immigration officer's questions clearly with complete sentences.",
                    initial_prompt="Good day. Passport and landing card, please. What is the purpose of your visit to the UK, and how long are you planning to stay?",
                    difficulty="Easy"
                ),
                models.Scenario(
                    title="Hotel Check-in & AC Malfunction",
                    category="Travel & Hospitality",
                    level="Intermediate",
                    role="Marco (Hotel Front Desk Manager)",
                    learner_role="Hotel Guest",
                    objective="Politely report a malfunctioning air conditioner and request a room change or immediate maintenance.",
                    description="You checked into room 402, but the air conditioning is blowing hot air. Explain the issue courteously at the front desk.",
                    initial_prompt="Good evening, sir. Welcome to the Grand Central Hotel. How can I assist you tonight?",
                    difficulty="Medium"
                ),
                models.Scenario(
                    title="Restaurant Order & Allergy Clarification",
                    category="Daily Life",
                    level="Beginner",
                    role="Elena (Restaurant Server)",
                    learner_role="Diner",
                    objective="Ask about menu ingredients, specify dietary preferences, and place an order politely.",
                    description="You are having dinner at a bistro. Ask about vegetarian options and specify that you have a nut allergy.",
                    initial_prompt="Hello! Welcome to The Olive Bistro. Can I get you started with some drinks, or are you ready to look at our dinner specials?",
                    difficulty="Easy"
                ),
                models.Scenario(
                    title="Store Customer Service: Defective Return",
                    category="Customer Service",
                    level="Intermediate",
                    role="Chris (Retail Store Representative)",
                    learner_role="Customer",
                    objective="Explain why the purchased product is defective, present the receipt, and request a replacement or refund.",
                    description="You bought wireless headphones three days ago and the left earbud stopped working. Explain the problem clearly.",
                    initial_prompt="Hi there, welcome to TechWorld Returns & Exchanges. How can I help you today?",
                    difficulty="Medium"
                ),
                models.Scenario(
                    title="Doctor's Clinic: Describing Symptoms",
                    category="Daily Life",
                    level="Intermediate",
                    role="Dr. Bennett (Physician)",
                    learner_role="Patient",
                    objective="Clearly describe physical symptoms, onset timeline, severity, and previous medications.",
                    description="You are visiting a clinic for a persistent cough and fever. Describe how you feel accurately.",
                    initial_prompt="Good morning. Please have a seat. What seems to be the trouble that brought you in today?",
                    difficulty="Medium"
                )
            ]
            db_sess.add_all(seed_scenarios)
            db_sess.commit()

        if db_sess.query(models.ListeningExercise).count() == 0:
            seed_listening = [
                models.ListeningExercise(
                    title="Quarterly Strategy & Product Roadmap",
                    category="Business",
                    level="Intermediate",
                    audio_script="Good morning everyone. Today we are reviewing our Q3 performance and discussing our upcoming product launch. Over the past three months, user engagement increased by 25%, primarily driven by our mobile application redesign. However, our customer retention in enterprise accounts remains lower than expected. Next quarter, our engineering team will focus on API reliability, single sign-on integration, and performance optimization to ensure enterprise satisfaction.",
                    questions=[
                        {
                            "question": "What was the main driver of the 25% increase in user engagement?",
                            "options": ["Mobile application redesign", "Discounted enterprise pricing", "Marketing campaign", "Hiring new engineers"],
                            "correct_idx": 0,
                            "explanation": "The speaker explicitly stated that engagement grew by 25% due to the mobile application redesign."
                        },
                        {
                            "question": "What is the primary focus for the engineering team next quarter?",
                            "options": ["Building social media features", "API reliability, SSO integration, and performance", "Lowering subscription fees", "Expanding the sales team"],
                            "correct_idx": 1,
                            "explanation": "The speaker highlighted API reliability, single sign-on (SSO), and performance optimization."
                        }
                    ],
                    dictation_sentence="Our engineering team will focus on API reliability and performance optimization.",
                    difficulty="Medium"
                ),
                models.ListeningExercise(
                    title="Weekend Travel Plans & Mountain Hiking",
                    category="Daily Life",
                    level="Beginner",
                    audio_script="I am really looking forward to this weekend. A few friends and I are planning a hiking trip to the Western Ghats. We plan to wake up at 5 AM on Saturday to beat the traffic and reach the base camp by noon. We packed light raincoats, trekking shoes, and plenty of water because the weather forecast predicts light afternoon showers. Hopefully, we will reach the sunset peak in time.",
                    questions=[
                        {
                            "question": "Why is the group waking up at 5 AM on Saturday?",
                            "options": ["To catch a morning train", "To beat the traffic and reach base camp by noon", "To attend a breakfast event", "To buy hiking gear"],
                            "correct_idx": 1,
                            "explanation": "They plan to leave early at 5 AM to beat the traffic and arrive by noon."
                        },
                        {
                            "question": "What did they pack because of the weather forecast?",
                            "options": ["Winter jackets", "Umbrellas and heavy boots", "Light raincoats and plenty of water", "Cooking supplies"],
                            "correct_idx": 2,
                            "explanation": "The weather forecast predicted afternoon showers, so they packed light raincoats and water."
                        }
                    ],
                    dictation_sentence="We packed light raincoats because the forecast predicts afternoon showers.",
                    difficulty="Easy"
                ),
                models.ListeningExercise(
                    title="The Evolution of Cloud Architecture",
                    category="Technology",
                    level="Advanced",
                    audio_script="Modern software architecture has shifted dramatically from monolithic backends toward distributed microservices and serverless functions. By breaking large applications into smaller independent components, engineering teams can deploy updates faster and isolate system failures. However, this architectural pattern introduces new challenges, including distributed tracing, data consistency across multiple databases, and higher operational complexity. Organizations must weigh these trade-offs before migrating.",
                    questions=[
                        {
                            "question": "What is one major advantage of microservices mentioned in the audio?",
                            "options": ["Zero cloud hosting cost", "Faster updates and isolated system failures", "Simpler debugging with single databases", "No need for monitoring tools"],
                            "correct_idx": 1,
                            "explanation": "The speaker explained that microservices enable faster deployments and localized failure containment."
                        },
                        {
                            "question": "What challenge does distributed architecture introduce?",
                            "options": ["Lack of programming languages", "Distributed tracing and operational complexity", "Decreased network speed only", "Inability to use cloud servers"],
                            "correct_idx": 1,
                            "explanation": "Distributed tracing, cross-database data consistency, and operational complexity were cited."
                        }
                    ],
                    dictation_sentence="Distributed microservices allow engineering teams to deploy updates faster and isolate failures.",
                    difficulty="Hard"
                ),
                models.ListeningExercise(
                    title="Airport Transit & Flight Connection",
                    category="Travel",
                    level="Beginner",
                    audio_script="Attention passengers on Flight 412 to Singapore. Due to heavy congestion at the departure runway, our boarding gate has been moved from Gate 14 to Gate 28B. Passengers with connecting flights in Singapore should visit the transfer desk upon arrival for their updated boarding passes. We apologize for the inconvenience and appreciate your patience.",
                    questions=[
                        {
                            "question": "Where has the boarding gate been moved to?",
                            "options": ["Gate 14", "Gate 28B", "Terminal 3", "Transfer Desk"],
                            "correct_idx": 1,
                            "explanation": "The announcement states the new departure gate is Gate 28B."
                        },
                        {
                            "question": "What should connecting passengers do upon arrival in Singapore?",
                            "options": ["Collect their checked luggage", "Visit the transfer desk for updated boarding passes", "Exit the airport terminal", "Wait at Gate 14"],
                            "correct_idx": 1,
                            "explanation": "Connecting passengers must visit the transfer desk for their updated boarding passes."
                        }
                    ],
                    dictation_sentence="Our boarding gate has been moved from Gate 14 to Gate 28B.",
                    difficulty="Easy"
                )
            ]
            db_sess.add_all(seed_listening)
            db_sess.commit()


