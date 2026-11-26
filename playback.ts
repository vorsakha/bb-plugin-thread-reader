import { passages, sampleText } from "./speech.ts";

export const previewLabel = "Voice preview";

export type Transport = {
  label: string;
  status: "Loading" | "Reading" | "Paused" | "Finished";
  paused: boolean;
  count: number;
  position: number;
  duration: number;
};

type ReaderState = Transport | { label: string; status: "Error"; detail: string };

let state: ReaderState | null = null;
let current: Reading | undefined;

export const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];
const speedKey = "thread-reader.playback-speed";
let speed = savedSpeed();

function savedSpeed() {
  try {
    const value = Number(localStorage.getItem(speedKey));

    return speeds.includes(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function playbackSpeed() {
  return speed;
}

export function setPlaybackSpeed(value: number) {
  if (!speeds.includes(value)) {
    return;
  }

  speed = value;

  if (current) {
    current.audio.defaultPlaybackRate = value;
    current.audio.playbackRate = value;
  }

  publish(state);

  try {
    localStorage.setItem(speedKey, String(value));
  } catch {
    return;
  }
}

const listeners = new Set<() => void>();

export function snapshot() {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function publish(value: ReaderState | null) {
  state = value;

  for (const listener of listeners) {
    listener();
  }
}

export function stop() {
  current?.dispose();
  current = undefined;
  publish(null);
}

async function getAudio(text: string, signal: AbortSignal, previewVoice?: string) {
  const response = await fetch("/api/v1/plugins/thread-reader/http/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(previewVoice ? { previewVoice } : { text }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(detail.startsWith("<") ? "BB could not reach Thread Reader." : detail.slice(0, 240));
  }

  const pcm = await response.arrayBuffer();
  signal.throwIfAborted();

  if (!pcm.byteLength || pcm.byteLength % 2) {
    throw new Error("Received incomplete audio.");
  }

  return waveAudio(pcm);
}

function waveAudio(pcm: ArrayBuffer) {
  const header = new ArrayBuffer(44);
  const bytes = new Uint8Array(header);
  const fields = new DataView(header);
  const ascii = new TextEncoder();

  bytes.set(ascii.encode("RIFF"), 0);
  fields.setUint32(4, 36 + pcm.byteLength, true);
  bytes.set(ascii.encode("WAVEfmt "), 8);
  fields.setUint32(16, 16, true);
  fields.setUint16(20, 1, true);
  fields.setUint16(22, 1, true);
  fields.setUint32(24, 24000, true);
  fields.setUint32(28, 48000, true);
  fields.setUint16(32, 2, true);
  fields.setUint16(34, 16, true);
  bytes.set(ascii.encode("data"), 36);
  fields.setUint32(40, pcm.byteLength, true);

  return new Blob([header, pcm], { type: "audio/wav" });
}

type AudioRequest = { controller: AbortController; audio: Promise<Blob> };

class Reading {
  readonly audio = new Audio();
  readonly lifetime = new AbortController();
  private requests = new Map<number, AudioRequest>();
  private queue: string[] = [];
  private index = 0;
  private fraction = 0;
  private paused = false;
  private ready = false;
  private url = "";
  private playAttempt = 0;
  private complete?: () => void;

  constructor(
    private readonly label: string,
    private readonly previewVoice?: string,
  ) {}

  private get finished() {
    return this.paused && this.index === this.queue.length - 1 && this.fraction === 1;
  }

  private update() {
    const duration = this.ready ? this.audio.duration : 0;
    let status: Transport["status"] = this.ready ? "Reading" : "Loading";

    if (this.finished) {
      status = "Finished";
    } else if (this.paused) {
      status = "Paused";
    }

    publish({
      label: this.label,
      status,
      paused: this.paused,
      count: this.queue.length,
      position: this.index + (duration ? this.audio.currentTime / duration : this.fraction),
      duration,
    });
  }

  private clearSource() {
    this.ready = false;
    this.playAttempt++;
    this.audio.onloadedmetadata = null;
    this.audio.ontimeupdate = null;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    URL.revokeObjectURL(this.url);
    this.url = "";
  }

  dispose() {
    this.complete?.();
    this.lifetime.abort();

    for (const request of this.requests.values()) {
      request.controller.abort();
    }

    this.requests.clear();
    this.clearSource();
  }

  private fail(error: unknown) {
    if (current === this) {
      stop();
      publish({
        label: this.label,
        status: "Error",
        detail: error instanceof Error ? error.message : "Could not read aloud.",
      });
    }
  }

  async start(load: (signal: AbortSignal) => Promise<string[]>) {
    const { signal } = this.lifetime;
    this.audio.preservesPitch = true;
    this.audio.defaultPlaybackRate = this.previewVoice ? 1 : speed;
    this.update();

    try {
      this.url = URL.createObjectURL(waveAudio(new ArrayBuffer(480)));
      this.audio.src = this.url;
      await this.audio.play();
      signal.throwIfAborted();
      this.queue = (await load(signal)).flatMap(passages);
      signal.throwIfAborted();

      if (!this.queue.length) {
        throw new Error("There is no text to read.");
      }

      await new Promise<void>((resolve) => {
        this.complete = resolve;
        void this.open(0, 0);
      });
    } catch (error) {
      this.fail(error);
    }
  }

  private request(index: number) {
    const cached = this.requests.get(index);

    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const audio = getAudio(this.queue[index], controller.signal, this.previewVoice).catch((error: unknown) => {
      if (this.requests.get(index)?.controller === controller) {
        this.requests.delete(index);
      }

      throw error;
    });
    const request = { controller, audio };
    this.requests.set(index, request);

    return request;
  }

  private play() {
    const attempt = ++this.playAttempt;
    this.audio.play().catch((error: unknown) => {
      if (attempt === this.playAttempt) {
        this.fail(error);
      }
    });
  }

  holdForSeek() {
    const resume = !this.paused;

    if (resume) {
      this.toggle();
    }

    return (position?: number) => {
      if (current !== this) {
        return;
      }

      if (position !== undefined) {
        this.seek(position);
      }

      if (resume && this.paused && !this.finished) {
        this.toggle();
      }
    };
  }

  toggle() {
    if (this.finished) {
      this.paused = false;
      void this.open(0, 0);

      return;
    }

    this.paused = !this.paused;

    if (this.ready) {
      if (this.paused) {
        this.playAttempt++;
        this.audio.pause();
      } else {
        this.play();
      }
    }

    this.update();
  }

  seek(position: number) {
    if (!this.queue.length) {
      return;
    }

    position = Math.min(position, this.queue.length);

    const index = Math.min(Math.floor(position), this.queue.length - 1);
    const fraction = position - index;

    if (position === this.queue.length) {
      this.paused = true;

      if (index !== this.index || !this.ready) {
        this.clearSource();
      } else {
        this.playAttempt++;
        this.audio.pause();
        this.audio.currentTime = this.audio.duration;
      }

      this.index = index;
      this.fraction = 1;
      this.complete?.();
      this.update();

      return;
    }

    if (index !== this.index || (this.finished && !this.ready)) {
      void this.open(index, fraction);

      return;
    }

    this.fraction = fraction;

    if (this.ready) {
      this.audio.currentTime = this.audio.duration * fraction;
    }

    this.update();
  }

  private async open(index: number, fraction: number) {
    this.clearSource();
    this.index = index;
    this.fraction = fraction;
    this.update();

    for (const [key, request] of this.requests) {
      if (key < index - 1 || key > index + 1) {
        request.controller.abort();
        this.requests.delete(key);
      }
    }

    const request = this.request(index);
    const visit = this.playAttempt;

    try {
      const blob = await request.audio;

      if (this.playAttempt !== visit) {
        return;
      }

      this.url = URL.createObjectURL(blob);
      this.audio.src = this.url;
      this.audio.playbackRate = this.audio.defaultPlaybackRate;
      this.audio.onloadedmetadata = () => {
        this.ready = true;
        this.audio.currentTime = this.audio.duration * this.fraction;

        if (!this.paused) {
          this.play();
        }

        this.update();
      };

      this.audio.ontimeupdate = () => {
        if (this.ready) {
          this.update();
        }
      };

      this.audio.onended = () => {
        if (this.previewVoice) {
          stop();

          return;
        }

        if (this.paused && this.fraction === 1) {
          return;
        }

        if (index + 1 < this.queue.length) {
          void this.open(index + 1, 0);
        } else {
          this.paused = true;
          this.fraction = 1;
          this.complete?.();
          this.update();
        }
      };

      this.audio.onerror = () => this.fail(new Error("Could not play this passage."));

      if (index + 1 < this.queue.length) {
        void this.request(index + 1).audio.catch(() => {});
      }
    } catch (error) {
      if (this.playAttempt === visit) {
        this.fail(error);
      }
    }
  }
}

export function togglePlayback() {
  current?.toggle();
}

export function holdForSeek() {
  return current?.holdForSeek();
}

export function seek(position: number) {
  current?.seek(position);
}

export function read(label: string, load: (signal: AbortSignal) => Promise<string[]>) {
  stop();
  current = new Reading(label);

  return current.start(load);
}

export function playSample(voice: string) {
  stop();
  current = new Reading(previewLabel, voice);

  return current.start(async () => [sampleText]);
}

export function stopSample() {
  if (state?.label === previewLabel) {
    stop();
  }
}
