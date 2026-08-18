from typing import Any

from flask import Flask, jsonify, request

from kaiwa.agent import AgentConfigurationError, AgentService
from kaiwa.tts import MAX_TTS_CHARS, TTSService


def create_app(
    agent_service: Any | None = None,
    tts_service: Any | None = None,
) -> Flask:
    """Create and configure the Kaiwa Flask application."""
    app = Flask(__name__)
    app.config["AGENT_SERVICE"] = agent_service
    app.config["TTS_SERVICE"] = tts_service

    @app.get("/")
    def index():
        return jsonify(message="Hello from Kaiwa!")

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.post("/api/chat")
    def chat():
        payload = request.get_json(silent=True)
        error = _validate_messages(payload)
        if error:
            return jsonify(error=error), 400

        try:
            service = app.config["AGENT_SERVICE"]
            if service is None:
                service = app.config["AGENT_SERVICE"] = AgentService()
            return jsonify(service.reply(payload["messages"]))
        except AgentConfigurationError as exc:
            return jsonify(error=str(exc)), 503
        except Exception:
            app.logger.exception("Chat generation failed")
            return jsonify(error="Chat generation failed. Please try again."), 502

    @app.post("/api/tts")
    def tts():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(error="Request body must be a JSON object."), 400
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            return jsonify(error="text must be a non-empty string."), 400
        if len(text) > MAX_TTS_CHARS:
            return jsonify(error=f"text cannot exceed {MAX_TTS_CHARS} characters."), 400

        try:
            service = app.config["TTS_SERVICE"]
            if service is None:
                service = app.config["TTS_SERVICE"] = TTSService()
            audio = service.synthesize(text.strip())
            return app.response_class(audio, mimetype="audio/wav")
        except Exception:
            app.logger.exception("Speech generation failed")
            return jsonify(error="Speech generation failed. Please try again."), 500

    return app


def _validate_messages(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return "Request body must be a JSON object."

    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages:
        return "messages must be a non-empty array."
    if len(messages) > 100:
        return "messages cannot contain more than 100 items."

    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            return f"messages[{index}] must be an object."
        if message.get("role") not in {"user", "assistant"}:
            return f"messages[{index}].role must be user or assistant."
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            return f"messages[{index}].content must be a non-empty string."
        if len(content) > 8_000:
            return f"messages[{index}].content is too long."

    if messages[-1]["role"] != "user":
        return "The last message must be from the user."
    return None


app = create_app()


def main() -> None:
    app.run(debug=True)
