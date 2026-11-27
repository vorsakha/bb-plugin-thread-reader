import { playSample, previewLabel, snapshot, stopSample, subscribe } from "./playback.ts";
import { defaultKokoroVoice, defaultVoice } from "./speech.ts";

export function mountNarrationSettings(local: boolean) {
  const label = local ? "Kokoro voice" : "OpenAI voice";
  const fallback = local ? defaultKokoroVoice : defaultVoice;
  const detail = document.querySelector<HTMLElement>('[data-testid="plugin-detail-thread-reader"]');

  if (!detail) {
    return;
  }

  detail.dataset.threadReaderProvider = local ? "kokoro" : "openai";

  const playbackHeading = document.createElement("h3");
  playbackHeading.className = "thread-reader-playback-heading";
  playbackHeading.textContent = "Playback";

  const hint = document.createElement("p");
  hint.className = "text-xs text-muted-foreground";
  hint.textContent = local ? "Speech stays on your BB server." : "Text is sent to your OpenAI project for narration.";

  const guide = document.createElement("a");
  guide.className = "text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground";
  guide.textContent = local ? "Browse Kokoro voices" : "OpenAI Realtime guide";
  guide.href = local
    ? "https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md"
    : "https://developers.openai.com/api/docs/guides/realtime-conversations";
  guide.target = "_blank";
  guide.rel = "noopener noreferrer";

  let field: HTMLInputElement | null = null;
  let voice = "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "thread-reader-preview-button";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.5");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  icon.append(path);
  const caption = document.createElement("span");
  button.append(icon, caption);

  const feedback = document.createElement("span");
  feedback.className = "thread-reader-preview-feedback";
  feedback.setAttribute("role", "status");

  function render() {
    if (!field) {
      return;
    }

    const state = snapshot();
    const preview = state?.label === previewLabel ? state : null;
    const playing = preview !== null && preview.status !== "Error";
    const label = playing ? "Stop voice preview" : `Preview ${voice} voice`;
    const action = playing ? "Stop" : "Preview";

    if (caption.textContent !== action) {
      caption.textContent = action;
    }

    button.title = label;
    button.setAttribute("aria-label", label);
    button.disabled = !voice;
    path.setAttribute("fill", playing ? "currentColor" : "none");
    path.setAttribute("d", playing ? "M6 6h12v12H6z" : "M3 9h4l5-4v14l-5-4H3zM16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12");
    const message = preview?.status === "Error" ? preview.detail : "";

    if (feedback.textContent !== message) {
      feedback.textContent = message;
    }
  }

  button.onclick = () => {
    const state = snapshot();

    if (state?.label === previewLabel && state.status !== "Error") {
      stopSample();
    } else if (voice) {
      void playSample(voice);
    }
  };

  function syncVoice() {
    const value = field?.value.trim() || fallback;

    if (value !== voice) {
      stopSample();
      voice = value;
      render();
    }
  }

  function syncFields() {
    const providerLabel = detail?.querySelector('[data-settings-anchor="Narration provider"] p');
    const playbackRow = detail?.querySelector('[data-settings-anchor="Show playback window"]');
    const voiceRow = detail?.querySelector(`[data-settings-anchor="${label}"]`);
    const voiceLabel = voiceRow?.querySelector("p");
    const next = voiceRow?.querySelector("input") ?? null;

    if (providerLabel && providerLabel.nextElementSibling !== hint) {
      providerLabel.after(hint);
    }

    if (voiceLabel && voiceLabel.nextElementSibling !== guide) {
      voiceLabel.after(guide);
    }

    if (playbackRow && playbackRow.firstElementChild !== playbackHeading) {
      playbackRow.prepend(playbackHeading);
    }

    if (next !== field) {
      field?.removeEventListener("input", syncVoice);
      stopSample();
      button.remove();
      feedback.remove();
      field = next;
      field?.addEventListener("input", syncVoice);
      voice = "";
    }

    if (field) {
      syncVoice();

      if (field.nextElementSibling !== button) {
        field.after(button, feedback);
      }
    }
  }

  const observer = new MutationObserver(syncFields);
  observer.observe(detail, { childList: true, subtree: true, attributes: true, attributeFilter: ["value"] });
  const unsubscribe = subscribe(render);
  syncFields();

  return () => {
    observer.disconnect();
    delete detail.dataset.threadReaderProvider;
    hint.remove();
    guide.remove();
    playbackHeading.remove();
    unsubscribe();
    field?.removeEventListener("input", syncVoice);
    stopSample();
    button.remove();
    feedback.remove();
  };
}
