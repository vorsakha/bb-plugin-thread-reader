import { playSample, previewLabel, snapshot, stopSample, subscribe } from "./playback.ts";
import { defaultVoice } from "./speech.ts";

export function mountVoicePreview() {
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
  button.append(icon);

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
    const value = field?.value.trim() || defaultVoice;

    if (value !== voice) {
      stopSample();
      voice = value;
      render();
    }
  }

  function syncFields() {
    const detail = location.pathname.startsWith("/settings/")
      ? document.querySelector('[data-testid="plugin-detail-thread-reader"]')
      : null;
    const next = detail?.querySelector<HTMLInputElement>('input[aria-label="Voice"]') ?? null;

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
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value"] });
  const unsubscribe = subscribe(render);
  syncFields();

  return () => {
    observer.disconnect();
    unsubscribe();
    field?.removeEventListener("input", syncVoice);
    stopSample();
    button.remove();
    feedback.remove();
  };
}
