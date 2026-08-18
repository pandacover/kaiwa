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
    const button = document.createElement("button");
    button.className = "audio-button";
    button.type = "button";
    button.textContent = "Preparing voice…";
    button.disabled = true;
    article.append(button);
    audioControl = { button, audio: null, loading: false, speechText: "" };
    button.addEventListener("click", () => toggleAudio(audioControl));
  }

  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return { article, audioControl };
}

async function prepareAudio(control, speechText) {
  control.speechText = speechText;
  control.loading = true;
  control.button.disabled = true;
  control.button.textContent = "Warming up voice…";

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
      control.button.textContent = "Pause voice";
    });
    control.audio.addEventListener("pause", () => {
      control.button.textContent = "Play voice";
    });
    control.audio.addEventListener("ended", () => {
      control.button.textContent = "Play voice";
      if (activeAudio === control.audio) activeAudio = null;
    });
    control.button.textContent = "Play voice";
    control.button.disabled = false;
  } catch (error) {
    control.button.textContent = "Retry voice";
    control.button.title = error.message || "Voice generation failed";
    control.button.disabled = false;
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
      control.button.textContent = "Retry playback";
    });
  } else {
    control.audio.pause();
  }
}

function setSending(value, status) {
  sending = value;
  sendButton.disabled = value;
  sendButton.textContent = value ? "Sending…" : "Send";
  appStatus.textContent = status || (value ? "Kaiwa is thinking…" : "Ready");
  if (!value) input.focus();
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
