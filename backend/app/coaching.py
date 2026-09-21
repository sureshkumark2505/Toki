from dataclasses import dataclass
from datetime import datetime, date, timedelta
import re
import zoneinfo
from .config import settings

FILLER_WORDS = {
    "hi", "hello", "hey", "bye", "goodbye", "ok", "okay", "k", "yes", "yeah", "yep", "ya",
    "no", "nope", "nah", "thanks", "thank", "you", "see", "later", "good", "great", "fine",
    "alright", "welcome", "sure", "uh", "um", "ah", "er", "hmm", "well", "oh"
}

def is_meaningful_turn(text: str) -> bool:
    """
    Returns True if the transcript contains at least 4 non-filler words.
    Filler words include greetings, farewells, short acknowledgments, and hesitation sounds.
    """
    if not text:
        return False
    words = re.findall(r"[a-zA-Z']+", text.lower())
    non_filler_words = [w for w in words if w not in FILLER_WORDS]
    return len(non_filler_words) >= 4

@dataclass
class SessionEvaluationResult:
    qualifies: bool
    meaningful_turns: int
    spoken_words: int
    practice_message: str

def evaluate_session(
    learner_turns: list[str],
    min_meaningful_turns: int | None = None,
    min_spoken_words: int | None = None
) -> SessionEvaluationResult:
    """
    Evaluates learner turns across a session.
    Qualifies if >= min_meaningful_turns AND >= min_spoken_words.
    Otherwise returns a friendly practice message.
    """
    min_turns = min_meaningful_turns if min_meaningful_turns is not None else getattr(settings, "streak_min_meaningful_turns", 4)
    min_words = min_spoken_words if min_spoken_words is not None else getattr(settings, "streak_min_spoken_words", 40)

    meaningful_count = 0
    total_words = 0

    for turn in learner_turns:
        turn_str = turn.strip() if isinstance(turn, str) else ""
        if not turn_str:
            continue
        words = turn_str.split()
        total_words += len(words)
        if is_meaningful_turn(turn_str):
            meaningful_count += 1

    qualifies = (meaningful_count >= min_turns) and (total_words >= min_words)

    if qualifies:
        message = ""
    else:
        needed_turns = max(0, min_turns - meaningful_count)
        needed_words = max(0, min_words - total_words)
        reasons = []
        if needed_turns > 0:
            reasons.append(f"speak {needed_turns} more complete sentence{'s' if needed_turns > 1 else ''}")
        if needed_words > 0:
            reasons.append(f"reach {min_words} spoken words ({needed_words} more needed)")
        reason_str = " and ".join(reasons)
        message = f"This session didn't count toward your streak. Next time, {reason_str} to earn your daily streak & XP!"

    return SessionEvaluationResult(
        qualifies=qualifies,
        meaningful_turns=meaningful_count,
        spoken_words=total_words,
        practice_message=message
    )

def next_streak(current: int, last_practice_iso: str | None, today: date) -> int:
    """
    Computes new streak days given current streak, last practice ISO date string, and today's date.
    - Same day: max(current, 1) (preserves streak; ensures qualifying practice is at least 1)
    - Yesterday: (current or 0) + 1
    - Gap > 1 day, empty, or invalid: resets to 1
    """
    today_iso = today.isoformat()
    if not last_practice_iso or not str(last_practice_iso).strip():
        return 1

    clean_iso = str(last_practice_iso).strip()
    if clean_iso == today_iso:
        return max(current, 1)

    try:
        last_dt = date.fromisoformat(clean_iso)
        diff = (today - last_dt).days
        if diff == 1:
            return (current or 0) + 1
        elif diff > 1:
            return 1
        else:
            return max(current, 1)
    except Exception:
        return 1

def today_local() -> date:
    """
    Returns today's date in settings.app_timezone (default Asia/Kolkata), falling back to UTC.
    """
    tz_name = getattr(settings, "app_timezone", "Asia/Kolkata") or "Asia/Kolkata"
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
        return datetime.now(tz).date()
    except Exception:
        return datetime.utcnow().date()

class LiveTurnAssembler:
    """
    Buffers user and coach transcript fragments for real-time live voice sessions.
    - Buffers user transcript chunks until the coach's first response chunk arrives,
      turn_complete occurs, or the session ends.
    - Emits a single coherent whole-turn string per user turn.
    - Buffers coach chunks and clears them on barge-in / interruption.
    """
    def __init__(self):
        self._user_chunks: list[str] = []
        self._coach_chunks: list[str] = []
        self._last_finalized_user: str = ""

    def push_user_chunk(self, chunk: str, is_interim: bool = False) -> str:
        """
        Pushes a user transcript fragment. Returns current accumulated user text.
        """
        text = chunk.strip()
        if not text:
            return self.get_accumulated_user_text()

        if is_interim:
            self._user_chunks = [text]
        else:
            if not self._user_chunks:
                self._user_chunks = [text]
            else:
                curr = self.get_accumulated_user_text()
                if text.startswith(curr):
                    self._user_chunks = [text]
                elif curr.startswith(text):
                    pass
                else:
                    self._user_chunks.append(text)
        return self.get_accumulated_user_text()

    def get_accumulated_user_text(self) -> str:
        if not self._user_chunks:
            return ""
        if len(self._user_chunks) == 1:
            return self._user_chunks[0].strip()
        combined = " ".join(c.strip() for c in self._user_chunks if c.strip())
        return re.sub(r"\s+", " ", combined).strip()

    def finalize_user_turn(self) -> str | None:
        """
        Finalizes and clears the pending user turn.
        Returns the finalized text if non-empty and new.
        """
        full_text = self.get_accumulated_user_text()
        self._user_chunks.clear()
        if full_text and full_text != self._last_finalized_user:
            self._last_finalized_user = full_text
            return full_text
        return None

    def push_coach_chunk(self, chunk: str) -> str | None:
        """
        Buffers a coach chunk. If a user turn was pending, finalizes and returns it.
        """
        user_turn = self.finalize_user_turn()
        if chunk:
            self._coach_chunks.append(chunk)
        return user_turn

    def handle_interruption(self) -> None:
        """
        Barge-in / interruption: clears pending coach response chunks.
        """
        self._coach_chunks.clear()

    def finalize_coach_turn(self) -> str | None:
        """
        Turn complete: assembles coach response chunks into a single coach turn.
        """
        if not self._coach_chunks:
            return None
        full_coach = "".join(self._coach_chunks).strip()
        self._coach_chunks.clear()
        return full_coach if full_coach else None

def build_live_system_prompt(
    objective: str = "English conversation practice",
    level: str = "Developing",
    native_language: str = "Tamil",
    explanation_language: str = "Tamil",
    correction_style: str = "Balanced",
    recurring_mistakes: list[str] | None = None
) -> str:
    """
    Constructs the voice coach system prompt for Gemini Live.
    Includes explicit correction loop, native language explanations, style modulation,
    and DB recurring mistake targets.
    """
    mistakes_str = ""
    if recurring_mistakes:
        valid_m = [m.strip() for m in recurring_mistakes if m and m.strip()]
        if valid_m:
            mistakes_str = "\n".join(f"- {m}" for m in valid_m[:3])
    if not mistakes_str:
        mistakes_str = "None logged yet."

    style_clean = str(correction_style).strip()
    if "gentle" in style_clean.lower():
        style_name = "Gentle"
    elif "strict" in style_clean.lower():
        style_name = "Strict"
    else:
        style_name = "Balanced"

    return (
        f"You are Toki, a warm but serious spoken-English coach. Learner level: {level}; first language: "
        f"{native_language}. Topic: '{objective}'. Make the learner speak MORE and BETTER: coach first, "
        f"chat partner second.\n"
        f"CONVERSATION: open with a short greeting and one easy, specific question about the topic. Each turn: "
        f"1-2 short sentences then exactly ONE question, preferring how/why/tell-me-about over yes/no. If the "
        f"answer is very short, ask for a full sentence or a reason. Match speed and vocabulary to their level.\n"
        f"CORRECTION LOOP (most important): after every learner turn, silently check for a real error (tense, "
        f"subject-verb agreement, articles, prepositions, word order, wrong word, unnatural phrasing). Pick the "
        f"ONE most important error. If there is one: (a) react to their meaning in a few words, (b) say \"Try "
        f"saying:\" and give the full corrected sentence clearly and slightly slowly, (c) explain the rule in "
        f"ONE short sentence in {explanation_language}, then return to English (never hold a whole "
        f"conversation in {explanation_language}; if it's English, explain simply in English), (d) ask them to "
        f"repeat the corrected sentence and WAIT. After they repeat it, praise briefly and continue. If wrong "
        f"again, model it once more, then move on. If the turn is only a greeting/farewell/one-word answer or "
        f"has no real error: don't invent a mistake, don't praise it as a good sentence, reply naturally and "
        f"steer to the topic. If a word seems mispronounced or unclear, say the word you think they meant, have "
        f"them repeat it, continue. Never correct punctuation/capitalisation/fillers (input is speech-to-text).\n"
        f"STYLE by correction_style: \"Gentle\" = recast the corrected sentence naturally inside your reply, "
        f"drill only if the same mistake repeats; \"Balanced\" = full loop for important errors, ignore small "
        f"slips; \"Strict\" = full loop for every clear error, one at a time.\n"
        f"Active correction style: {style_name}.\n"
        f"RECURRING MISTAKES (top 3 from DB): steer the chat so they get a natural chance to use these "
        f"correctly; praise when they do:\n{mistakes_str}\n"
        f"WRAP-UP: on goodbye, give one sentence of specific encouragement plus the single most useful thing "
        f"to remember, then say goodbye."
    )
