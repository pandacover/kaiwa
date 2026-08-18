from flask import Flask, jsonify


def create_app() -> Flask:
    """Create and configure the Kaiwa Flask application."""
    app = Flask(__name__)

    @app.get("/")
    def index():
        return jsonify(message="Hello from Kaiwa!")

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    return app


app = create_app()


def main() -> None:
    app.run(debug=True)
