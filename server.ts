import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { synthesize } from "./realtime.ts";
import { passageLimit } from "./speech.ts";

export default function threadReader(bb: BbPluginApi) {
  const settings = bb.settings.define({
    apiKey: { type: "string", label: "OpenAI API key", secret: true },
    model: {
      type: "select",
      label: "Realtime model",
      options: ["gpt-realtime-2.1-mini", "gpt-realtime-2.1"],
      default: "gpt-realtime-2.1-mini",
    },
    voice: {
      type: "select",
      label: "Voice",
      options: ["marin", "cedar", "coral", "ash", "sage", "verse"],
      default: "marin",
    },
    style: {
      type: "string",
      label: "Narration style",
      default: "Warm and conversational. Use natural pauses and place emphasis on the main thought.",
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

      if (!payload || typeof payload !== "object" || !("text" in payload) || typeof payload.text !== "string") {
        return context.text("Expected a text passage.", 400);
      }

      const text = payload.text;

      if (!text.trim() || text.length > passageLimit) {
        return context.text("Choose a shorter, nonempty passage.", 400);
      }

      const config = await settings.get();

      if (!config.apiKey) {
        return context.text("Add an OpenAI API key in Settings → Installed plugins → Thread Reader.", 409);
      }

      if (active >= 4) {
        return context.text("Thread Reader is busy. Try again shortly.", 429);
      }

      active++;

      try {
        const signal = AbortSignal.any([context.req.raw.signal, lifetime.signal]);
        const pcm = await synthesize(text, { ...config, apiKey: config.apiKey }, signal);

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
