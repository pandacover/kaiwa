"""Chatterbox Nano loading and WAV generation."""

from __future__ import annotations

import io
import threading
import wave
from typing import Any

MAX_TTS_CHARS = 600

_model: Any | None = None
_model_lock = threading.Lock()
_generation_lock = threading.Lock()


def load_nano_model() -> Any:
    """Load one shared CPU model, downloading weights only when absent."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from chatterbox.tts_turbo import ChatterboxTurboTTS

                _model = ChatterboxTurboTTS.from_pretrained(device="cpu", nano=True)
    return _model


class TTSService:
    """Serialize inference against the shared Chatterbox model."""

    def __init__(self, model_loader=load_nano_model) -> None:
        self.model_loader = model_loader

    def synthesize(self, text: str) -> bytes:
        with _generation_lock:
            model = self.model_loader()
            samples = model.generate(text)
        return _encode_wav(samples, model.sr)


def _encode_wav(samples: Any, sample_rate: int) -> bytes:
    mono = samples.squeeze().detach().cpu().float().clamp(-1, 1).numpy()
    pcm = (mono * 32767).astype("<i2").tobytes()

    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm)
    return output.getvalue()
