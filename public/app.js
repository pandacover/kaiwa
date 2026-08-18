const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messagesElement = document.querySelector("#messages");
const appStatus = document.querySelector("#app-status");

const history = [];
const objectUrls = new Set();
let sending = false;
let activeAudio = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || sending) return;

  appendMessage("user", content);
  history.push({ role: "user", content });
  input.value = "";
  resizeInput();
  setSending(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const result = await readJson(response);
    if (!response.ok) throw new Error(result.error || "Kaiwa could not reply.");

    const message = appendMessage("assistant", result.text, true);
    history.push({ role: "assistant", content: result.text });
    setSending(false);
    prepareAudio(message.audioControl, result.speech_text);
  } catch (error) {
    appendMessage("assistant", error.message || "Something went wrong.", false, true);
    setSending(false, "Reply failed — you can try again.");
  }
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

window.addEventListener("beforeunload", () => {
  for (const url of objectUrls) URL.revokeObjectURL(url);
});

function appendMessage(role, text, withAudio = false, isError = false) {
  const article = document.createElement("article");
  article.className = `message ${role}-message${isError ? " error-message" : ""}`;

  const body = document.createElement("p");
  body.textContent = text;
  article.append(body);

  let audioControl = null;
  if (withAudio) {
    article.classList.add("voice-message", "voice-loading");

    const button = document.createElement("button");
    button.className = "audio-button";
    button.type = "button";
    button.innerHTML = `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path class="audio-icon-play" d="m7.25 5.5 7.5 4.5-7.5 4.5z"></path>
        <g class="audio-icon-pause">
          <path d="M7.25 5.5v9"></path>
          <path d="M12.75 5.5v9"></path>
        </g>
        <path class="audio-icon-retry" d="M15.25 7.25V3.8m0 0H11.8m3.45 0A6.25 6.25 0 1 0 16 11"></path>
        <path class="audio-icon-loading" d="M10 3.75a6.25 6.25 0 0 1 6.25 6.25"></path>
      </svg>
      <span class="sr-only">Preparing voice</span>
    `;
    const statusOverlay = document.createElement("span");
    statusOverlay.className = "voice-status-overlay";
    statusOverlay.textContent = "warming up voice";
    statusOverlay.setAttribute("aria-hidden", "true");
    article.append(button, statusOverlay);
    audioControl = {
      article,
      button,
      audio: null,
      loading: false,
      played: false,
      speechText: "",
    };
    setAudioButtonState(audioControl, "loading", "Preparing voice");
    button.addEventListener("click", () => toggleAudio(audioControl));
  }

  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return { article, audioControl };
}

async function prepareAudio(control, speechText) {
  control.speechText = speechText;
  control.loading = true;
  setAudioButtonState(control, "loading", "Warming up voice");

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: speechText }),
    });
    if (!response.ok) {
      const result = await readJson(response);
      throw new Error(result.error || "Voice generation failed.");
    }

    const url = URL.createObjectURL(await response.blob());
    objectUrls.add(url);
    control.audio = new Audio(url);
    control.audio.addEventListener("play", () => {
      setAudioButtonState(control, "pause", "Pause voice");
    });
    control.audio.addEventListener("pause", () => {
      control.played = control.audio.currentTime > 0;
      setAudioButtonState(control, "play", "Play voice");
    });
    control.audio.addEventListener("ended", () => {
      control.played = true;
      setAudioButtonState(control, "play", "Play voice");
      if (activeAudio === control.audio) activeAudio = null;
    });
    setAudioButtonState(control, "play", "Play voice");
  } catch (error) {
    setAudioButtonState(
      control,
      "retry",
      "Retry voice",
      error.message || "Voice generation failed",
    );
  } finally {
    control.loading = false;
  }
}

function toggleAudio(control) {
  if (control.loading) return;
  if (!control.audio) {
    prepareAudio(control, control.speechText);
    return;
  }

  if (control.audio.paused) {
    if (activeAudio && activeAudio !== control.audio) activeAudio.pause();
    activeAudio = control.audio;
    control.audio.play().catch(() => {
      setAudioButtonState(control, "retry", "Retry playback");
    });
  } else {
    control.audio.pause();
  }
}

function setSending(value, status) {
  sending = value;
  sendButton.disabled = value;
  sendButton.dataset.loading = String(value);
  sendButton.setAttribute("aria-label", value ? "Sending message" : "Send message");
  sendButton.querySelector(".sr-only").textContent = value ? "Sending message" : "Send message";
  appStatus.textContent = status || (value ? "Kaiwa is thinking…" : "Ready");
  if (!value) input.focus();
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
}

function setAudioButtonState(control, state, label, title = label) {
  let voiceState = "error";
  if (state === "loading") voiceState = "loading";
  if (state === "pause") voiceState = "playing";
  if (state === "play") voiceState = control.played ? "played" : "ready";

  control.article.classList.remove(
    "voice-loading",
    "voice-ready",
    "voice-playing",
    "voice-played",
    "voice-error",
  );
  control.article.classList.add(`voice-${voiceState}`);
  control.button.dataset.state = state;
  control.button.disabled = state === "loading";
  control.button.setAttribute("aria-label", label);
  control.button.title = title;
  control.button.querySelector(".sr-only").textContent = label;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
