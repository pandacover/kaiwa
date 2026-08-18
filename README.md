# Kaiwa

Kaiwa is a small voice-chat v0: DeepSeek generates short conversational replies
through OpenRouter and LangChain, then Chatterbox Nano turns each reply into WAV
audio. A Cloudflare Worker serves the static chat UI and forwards API requests to
one Python Container.

## Architecture

- Cloudflare Static Assets serves `public/` without waking the Container.
- The Worker forwards `/api/*` and `/health` to the named `singleton` Container.
- Flask exposes `/api/chat`, `/api/tts`, and `/health`.
- The browser owns conversation history. The server stores no chats or audio.
- Chatterbox Nano runs on CPU behind a process-wide generation lock.

## Prerequisites

- Python 3.11 and [uv](https://docs.astral.sh/uv/)
- Node.js 22 or newer
- [Docker](https://docs.docker.com/get-docker/) running locally
- a Cloudflare account on the
  [Workers Paid plan](https://developers.cloudflare.com/containers/pricing/)
  with Containers access
- an [OpenRouter](https://openrouter.ai/) API key

[Cloudflare Containers require Docker](https://developers.cloudflare.com/containers/get-started/)
during `wrangler deploy`. The Workers Paid plan starts at USD $5/month;
Container CPU, memory, and disk usage are billed separately after the included
usage.

## Local development

Install dependencies:

```bash
uv sync
npm install
```

Create the ignored local secret file:

```bash
cp .dev.vars.example .dev.vars
```

Replace the placeholder value in `.dev.vars`, confirm Docker is running, then
start the Worker and Container:

```bash
npm run dev
```

Open the URL printed by Wrangler, normally <http://localhost:8787>. The first
Container start and first voice response are slower because Python and the Nano
model must warm up.

For quick Flask-only work, run:

```bash
uv run flask --app kaiwa run --debug
```

The Flask-only command does not serve `public/`; use Wrangler to exercise the
complete application.

## Checks

The focused backend suite mocks OpenRouter and Chatterbox inference:

```bash
uv run pytest -q
node --check public/app.js
npm run types
npx tsc --noEmit
```

With Docker running, validate the complete Worker/Container build without
deploying:

```bash
npm run check
```

## Deploy to Cloudflare

Authenticate once and set the production secret:

```bash
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
```

Keep Docker running, then deploy:

```bash
npm run deploy
```

Wrangler builds the linux/amd64 image, uploads the Worker and static assets, and
rolls out the Container. The Docker build downloads the public Chatterbox Nano
checkpoint into `HF_HOME`, so a later Container start loads weights from the
image instead of downloading them to ephemeral disk.

The first deployment can take several minutes to provision. When it finishes,
smoke-test the URL Wrangler prints:

```bash
curl --fail https://YOUR_WORKER.workers.dev/health
```

Then open the site and verify this flow:

1. Send a message.
2. Confirm the DeepSeek text response appears.
3. Wait for its control to change from “Warming up voice…” to “Play voice”.
4. Play the response, send a follow-up, and confirm each reply has its own audio.
5. Leave the app idle for more than 30 minutes, then send another message and
   confirm it recovers after a new cold start.

## Cold starts

The single Container sleeps after 30 minutes without activity. Static assets
remain available while it sleeps. The next API request starts the Container;
the first TTS request also loads Nano from the baked checkpoint into memory.
The UI exposes this as a warming-up state and keeps response text usable if TTS
fails.

## v0 limitations

- one `standard-3` Container instance and serialized speech generation
- no authentication, rate limiting, analytics, or production SLA
- no microphone input, streaming tokens/audio, or voice selection
- no persisted conversations or audio files; refresh clears the chat
- English-focused Chatterbox Nano output
- API errors are intentionally concise; inspect Cloudflare logs for diagnostics
