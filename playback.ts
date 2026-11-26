import { passages } from "./speech.ts";

export type ReaderState = {
  label: string;
  status: "Loading" | "Reading" | "Error";
  detail?: string;
};

let state: ReaderState | null = null;
let current: AbortController | undefined;
const listeners = new Set<() => void>();

export function snapshot() {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(value: ReaderState | null) {
  state = value;
  for (const listener of listeners) {
    listener();
  }
}

export function stop() {
  current?.abort();
  current = undefined;
  publish(null);
}

async function getAudio(text: string, context: AudioContext, signal: AbortSignal) {
  const response = await fetch("/api/v1/plugins/thread-reader/http/read", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new TextEncoder().encode(text),
    signal
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.startsWith("<") ? "BB could not reach Thread Reader." : detail.slice(0, 240));
  }
  const pcm = new DataView(await response.arrayBuffer());
  signal.throwIfAborted();
  if (!pcm.byteLength || pcm.byteLength % 2) {
    throw new Error("Received incomplete audio.");
  }
  const buffer = context.createBuffer(1, pcm.byteLength / 2, 24000);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = pcm.getInt16(i * 2, true) / 32768;
  }
  return buffer;
}

function play(context: AudioContext, buffer: AudioBuffer, signal: AbortSignal) {
  signal.throwIfAborted();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      source.stop();
      reject(signal.reason);
    };
    signal.addEventListener("abort", cancel, { once: true });
    source.onended = () => {
      signal.removeEventListener("abort", cancel);
      source.disconnect();
      resolve();
    };
    source.start();
  });
}

export async function read(label: string, load: (signal: AbortSignal) => Promise<string[]>) {
  stop();
  const controller = new AbortController();
  const { signal } = controller;
  current = controller;
  publish({ label, status: "Loading" });
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    const activeContext = context;
    signal.addEventListener("abort", () => {
      if (activeContext.state !== "closed") {
        void activeContext.close().catch(() => {});
      }
    }, { once: true });
    await context.resume();
    signal.throwIfAborted();
    const messages = await load(signal);
    const queue = messages.flatMap(passages);
    if (!queue.length) {
      throw new Error("There is no text to read.");
    }
    signal.throwIfAborted();
    let buffer = await getAudio(queue[0], context, signal);
    for (let i = 0; i < queue.length; i++) {
      publish({ label, status: "Reading" });
      const playing = play(context, buffer, signal);
      const next = queue[i + 1];
      if (!next) {
        await playing;
        break;
      }
      const [, following] = await Promise.all([playing, getAudio(next, context, signal)]);
      buffer = following;
    }
    if (current === controller) {
      stop();
    }
  } catch (error) {
    if (!signal.aborted) {
      controller.abort();
      publish({ label, status: "Error", detail: error instanceof Error ? error.message : "Could not read aloud." });
    }
  } finally {
    if (context && context.state !== "closed") {
      await context.close();
    }
  }
}
