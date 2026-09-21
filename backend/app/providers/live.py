import asyncio
import base64
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from google import genai
from google.genai import types
from ..config import settings
from ..coaching import build_live_system_prompt

logger = logging.getLogger("gemini_live")

class GeminiLiveBridge:
    def __init__(
        self,
        objective: str = "English conversation practice",
        voice_name: str = "Puck",
        level: str = "Developing",
        native_language: str = "Tamil",
        explanation_language: str = "Tamil",
        correction_style: str = "Balanced",
        recurring_mistakes: list[str] | None = None,
    ):
        self.objective = objective
        self.voice_name = voice_name
        self.level = level
        self.native_language = native_language
        self.explanation_language = explanation_language
        self.correction_style = correction_style
        self.recurring_mistakes = recurring_mistakes or []
        self.client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
        self.session: Optional[genai.live.AsyncSession] = None
        self._ctx = None

    async def connect(self):
        if not self.client:
            raise ValueError("GEMINI_API_KEY is not configured in backend.")

        system_prompt = build_live_system_prompt(
            objective=self.objective,
            level=self.level,
            native_language=self.native_language,
            explanation_language=self.explanation_language,
            correction_style=self.correction_style,
            recurring_mistakes=self.recurring_mistakes,
        )

        model_name = settings.gemini_live_model or "gemini-2.5-flash-native-audio-latest"

        cfg = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice_name)
                )
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=system_prompt)]
            ),
        )

        try:
            self._ctx = self.client.aio.live.connect(model=model_name, config=cfg)
            self.session = await self._ctx.__aenter__()
            logger.info(f"Connected to Gemini Live session with model {model_name} (Voice: {self.voice_name})")
        except Exception as e:
            logger.exception(
                "Failed to connect to Gemini Live. model=%s type=%s repr=%r",
                model_name,
                type(e).__name__,
                e,
            )
            raise

    async def send_audio_chunk(self, pcm_bytes: bytes):
        """Streams 16kHz 16-bit Mono PCM audio to Gemini Live."""
        if not self.session:
            return
        await self.session.send_realtime_input(
            audio=types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")
        )

    async def send_text(self, text: str):
        """Sends quiet-mode text turn to Gemini Live."""
        if not self.session:
            return
        await self.session.send_client_content(
            turns=[types.Content(parts=[types.Part.from_text(text=text)])],
            turn_complete=True
        )

    async def receive_events(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Receives streamed events from Gemini Live session."""
        if not self.session:
            return
        try:
            # session.receive() ends after EVERY turn_complete, so keep re-entering it
            # for the lifetime of the connection.
            while True:
                got_message = False
                async for response in self.session.receive():
                    got_message = True
                    sc = response.server_content
                    if sc:
                        if sc.interrupted:
                            yield {"type": "interrupted"}

                        if sc.input_transcription and sc.input_transcription.text:
                            yield {
                                "type": "transcript",
                                "speaker": "user",
                                "text": sc.input_transcription.text,
                                "finished": getattr(sc.input_transcription, "finished", True),
                            }

                        if sc.interim_input_transcription and sc.interim_input_transcription.text:
                            yield {
                                "type": "transcript",
                                "speaker": "user",
                                "text": sc.interim_input_transcription.text,
                                "is_interim": True,
                            }

                        if sc.output_transcription and sc.output_transcription.text:
                            yield {
                                "type": "transcript",
                                "speaker": "toki",
                                "text": sc.output_transcription.text,
                            }

                        if sc.model_turn:
                            for part in sc.model_turn.parts:
                                if getattr(part, "thought", False):
                                    continue
                                if part.inline_data:
                                    b64_audio = base64.b64encode(part.inline_data.data).decode("utf-8")
                                    yield {
                                        "type": "audio",
                                        "data": b64_audio,
                                        "mime_type": part.inline_data.mime_type,
                                    }

                        if sc.turn_complete:
                            yield {"type": "turn_complete"}

                if not got_message:
                    break  # socket really closed; avoid a busy loop
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception(
                "Error receiving from Gemini Live session. type=%s repr=%r",
                type(e).__name__,
                e,
            )
            yield {"type": "error", "message": f"{type(e).__name__}: {str(e)}"}

    async def close(self):
        if self._ctx:
            try:
                await self._ctx.__aexit__(None, None, None)
            except Exception as e:
                logger.debug(f"Error closing Gemini Live context: {e}")
            self.session = None
            self._ctx = None
