# Kaiwa

A Flask-based conversational voice agent, managed with
[uv](https://docs.astral.sh/uv/).

## Setup

```bash
uv sync
```

## Run

```bash
uv run flask --app kaiwa run --debug
```

Then open <http://127.0.0.1:5000>. A health check is available at
<http://127.0.0.1:5000/health>.
