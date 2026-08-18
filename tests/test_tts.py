import io
import wave
from types import SimpleNamespace

import numpy as np

from kaiwa import create_app, tts as tts_module
from kaiwa.tts import MAX_TTS_CHARS, TTSService


class FakeTensor:
    def __init__(self, values):
        self.values = np.asarray(values, dtype=np.float32)

    def squeeze(self):
        return self

    def detach(self):
        return self

    def cpu(self):
        return self

    def float(self):
        return self

    def clamp(self, low, high):
        self.values = np.clip(self.values, low, high)
        return self

    def numpy(self):
        return self.values


def test_tts_service_returns_wav_and_reuses_model(monkeypatch):
    calls = []
    model = SimpleNamespace(
        sr=24_000,
        generate=lambda text: calls.append(text) or FakeTensor([0.0, 0.5, -0.5]),
    )
    monkeypatch.setattr(tts_module, "_model", model)
    service = TTSService()

    audio = service.synthesize("Hello [laugh]")
    service.synthesize("Again")

    with wave.open(io.BytesIO(audio), "rb") as wav_file:
        assert wav_file.getframerate() == 24_000
        assert wav_file.getnframes() == 3
    assert calls == ["Hello [laugh]", "Again"]
    assert tts_module.load_nano_model() is model


def test_tts_route_returns_audio_and_enforces_limit():
    service = SimpleNamespace(synthesize=lambda text: b"RIFF-audio")
    client = create_app(tts_service=service).test_client()

    response = client.post("/api/tts", json={"text": "Hello [chuckle]"})
    too_long = client.post("/api/tts", json={"text": "x" * (MAX_TTS_CHARS + 1)})

    assert response.status_code == 200
    assert response.mimetype == "audio/wav"
    assert response.data == b"RIFF-audio"
    assert too_long.status_code == 400
