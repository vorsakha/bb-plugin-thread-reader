import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { synthesizeKokoro } from "./kokoro.ts";
import { synthesize } from "./realtime.ts";
import { defaultKokoroVoice, defaultModel, defaultVoice, passageLimit, sampleText } from "./speech.ts";

export default function threadReader(bb: BbPluginApi) {
  const settings = bb.settings.define({
    provider: {
      type: "select",
      label: "Narration provider",
      options: ["openai", "kokoro"],
      experimental_optionLabels: { openai: "OpenAI Realtime", kokoro: "Local Kokoro 82M" },
      default: "openai",
    },
    kokoroVoice: {
      type: "string",
      label: "Kokoro voice",
      default: defaultKokoroVoice,
    },
    apiKey: { type: "string", label: "OpenAI API key", secret: true },
    model: {
      type: "string",
      label: "Realtime model",
      default: defaultModel,
    },
    voice: {
      type: "string",
      label: "OpenAI voice",
      default: defaultVoice,
    },
    style: {
      type: "string",
      label: "Narration style",
      experimental_multiline: true,
      default: "Warm and conversational. Use natural pauses and place emphasis on the main thought.",
    },
    showPlayer: {
      type: "boolean",
      label: "Show playback window",
      default: true,
    },
    closeWhenFinished: {
      type: "boolean",
      label: "Close window when finished",
      default: false,
    },
  });

  const lifetime = new AbortController();
  bb.onDispose(() => lifetime.abort());
  let active = 0;

  bb.http.route(
    "POST",
    "/read",
    async (context) => {
      const reader = context.req.raw.body?.getReader();

      if (!reader) {
        return context.text("Choose text to read.", 400);
      }

      const frames: Uint8Array[] = [];
      let size = 0;

      try {
        while (true) {
          const part = await reader.read();

          if (part.done) {
            break;
          }

          size += part.value.length;

          if (size > passageLimit * 6 + 64) {
            return context.text("Passage is too long.", 413);
          }

          frames.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      let payload: unknown;

      try {
        payload = JSON.parse(Buffer.concat(frames).toString("utf8"));
      } catch {
        return context.text("Expected a JSON passage.", 400);
      }

      if (!payload || typeof payload !== "object") {
        return context.text("Expected a text passage.", 400);
      }

      let voice: string | undefined;
      let text: string;

      if ("previewVoice" in payload) {
        if (typeof payload.previewVoice !== "string" || !payload.previewVoice.trim()) {
          return context.text("Enter a voice name to preview.", 400);
        }

        voice = payload.previewVoice.trim();
        text = sampleText;
      } else if ("text" in payload && typeof payload.text === "string") {
        text = payload.text;
      } else {
        return context.text("Expected a text passage.", 400);
      }

      if (!text.trim() || text.length > passageLimit) {
        return context.text("Choose a shorter, nonempty passage.", 400);
      }

      const config = await settings.get();

      if (active >= 4) {
        return context.text("Thread Reader is busy. Try again shortly.", 429);
      }

      active++;

      try {
        const signal = AbortSignal.any([context.req.raw.signal, lifetime.signal]);
        let pcm: Buffer;

        if (config.provider === "kokoro") {
          pcm = await synthesizeKokoro(text, voice ?? (config.kokoroVoice.trim() || defaultKokoroVoice), signal);
        } else {
          if (!config.apiKey) {
            return context.text("Add an OpenAI API key or select Local Kokoro 82M in Thread Reader settings.", 409);
          }

          pcm = await synthesize(
            text,
            {
              model: config.model.trim() || defaultModel,
              voice: voice ?? (config.voice.trim() || defaultVoice),
              style: config.style,
              apiKey: config.apiKey,
            },
            signal,
          );
        }

        return new Response(new Uint8Array(pcm), {
          headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
        });
      } catch (cause) {
        return context.text(cause instanceof Error ? cause.message : "Narration failed.", 502);
      } finally {
        active--;
      }
    },
    { auth: "local" },
  );
}
