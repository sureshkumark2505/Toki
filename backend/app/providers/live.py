import asyncio
import base64
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from google import genai
from google.genai import types
from ..config import settings

logger = logging.getLogger("gemini_live")

LIVE_MODEL_NAME = "gemini-2.5-flash-native-audio-latest"

class GeminiLiveBridge:
    def __init__(self, objective: str = "English conversation practice", voice_name: str = "Puck"):
        self.objective = objective
        self.voice_name = voice_name
        self.client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
        self.session: Optional[genai.live.AsyncSession] = None
        self._ctx = None

    async def connect(self):
        if not self.client:
            raise ValueError("GEMINI_API_KEY is not configured in backend.")

        system_prompt = (
            f"You are Toki, a friendly, encouraging, and natural voice-first English speaking coach. "
            f"Current practice topic/objective: '{self.objective}'. "
            f"Guidelines for spoken dialogue: "
            f"1. Respond directly and naturally as in a real spoken conversation. "
            f"2. Keep each spoken response concise (usually 1 to 2 sentences) so the learner has ample space to speak. "
            f"3. Ask warm follow-up questions to keep the conversation flowing smoothly. "
            f"4. Speak clearly with natural English cadence and intonation. "
            f"5. Start by greeting the learner and inviting them to speak about '{self.objective}'."
        )

        cfg = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice_name)
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=system_prompt)]
            ),
        )

        self._ctx = self.client.aio.live.connect(model=LIVE_MODEL_NAME, config=cfg)
        self.session = await self._ctx.__aenter__()
        logger.info(f"Connected to Gemini Live session with model {LIVE_MODEL_NAME}")

    async def send_audio_chunk(self, pcm_bytes: bytes):
        if not self.session:
            return
        await self.session.send(
            input=types.LiveClientRealtimeInput(
                media_chunks=[types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")]
            )
        )

    async def send_text(self, text: str):
        if not self.session:
            return
        await self.session.send(input=text, end_of_turn=True)

    async def receive_events(self) -> AsyncGenerator[Dict[str, Any], None]:
        if not self.session:
            return
        try:
            async for response in self.session.receive():
                sc = response.server_content
                if sc:
                    if sc.interrupted:
                        yield {"type": "interrupted"}

                    if sc.model_turn:
                        for part in sc.model_turn.parts:
                            if part.text:
                                yield {
                                    "type": "transcript",
                                    "speaker": "toki",
                                    "text": part.text,
                                }
                            if part.inline_data:
                                # Send base64 encoded 24kHz PCM audio chunk
                                b64_audio = base64.b64encode(part.inline_data.data).decode("utf-8")
                                yield {
                                    "type": "audio",
                                    "data": b64_audio,
                                    "mime_type": part.inline_data.mime_type,
                                }

                    if sc.turn_complete:
                        yield {"type": "turn_complete"}
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"Error receiving from Gemini Live session: {e}")
            yield {"type": "error", "message": str(e)}

    async def close(self):
        if self._ctx:
            try:
                await self._ctx.__aexit__(None, None, None)
            except Exception as e:
                logger.debug(f"Error closing Gemini Live context: {e}")
            self.session = None
            self._ctx = None
