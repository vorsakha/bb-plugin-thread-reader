import "./player.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { definePluginApp, useSettings, type useSdk } from "@get-bb/plugin-sdk/app";
import {
  holdForSeek,
  playbackSpeed,
  previewLabel,
  read,
  setCloseWhenFinished,
  setPlaybackSpeed,
  seek,
  snapshot,
  speeds,
  stop,
  subscribe,
  togglePlayback,
  type Transport,
} from "./playback.ts";
import { mountVoicePreview } from "./voice-preview.ts";

async function threadMessages(sdk: ReturnType<typeof useSdk>, threadId: string, signal: AbortSignal) {
  const messages = new Map<number, string>();
  type Cursor = { anchorId: string; anchorSeq: number };
  const fetchPage = (cursor?: Cursor) =>
    sdk.threads.timeline({
      threadId,
      signal,
      includeNestedRows: "true",
      deferContent: "false",
      beforeAnchorId: cursor?.anchorId,
      beforeAnchorSeq: cursor?.anchorSeq.toString(),
    });

  let page = await fetchPage();

  while (true) {
    const visit = (rows: typeof page.rows) => {
      for (const row of rows) {
        if (row.kind === "turn" && row.children) {
          visit(row.children);
        } else if (row.kind === "conversation" && (row.role === "assistant" || row.initiator === "user")) {
          messages.set(row.messageSeq, row.text);
        }
      }
    };

    visit(page.rows);
    const cursor = page.timelinePage.olderCursor;

    if (!cursor) {
      break;
    }

    page = await fetchPage(cursor);
  }

  return [...messages.entries()].sort(([a], [b]) => a - b).map(([, text]) => text);
}

function clock(seconds: number) {
  const whole = Math.floor(seconds);

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function Timeline({ player }: { player: Transport }) {
  const releaseHold = useRef<ReturnType<typeof holdForSeek>>(undefined);
  const [preview, setPreview] = useState<number | null>(null);
  const position = preview ?? player.position;
  const index = Math.min(Math.floor(position), Math.max(0, player.count - 1));
  const fraction = position - index;
  const passage = `Passage ${index + 1} of ${player.count}`;
  const percent = `${Math.round(fraction * 100)}%`;
  const single = player.count === 1;
  const elapsed = clock(fraction * player.duration);
  const time = player.duration ? `${elapsed} / ${clock(player.duration)}` : percent;
  const valueText = single ? time : `${passage}, ${percent}`;

  const fill = `${player.count ? (position / player.count) * 100 : 0}%`;
  const track = `linear-gradient(to right, var(--primary) ${fill}, var(--border) ${fill})`;
  const section = `${100 / (player.count || 1)}%`;
  const marks = `repeating-linear-gradient(to right, transparent 0 calc(${section} - 2px), var(--popover) calc(${section} - 2px) ${section})`;

  function finishDrag(position?: number) {
    releaseHold.current?.(position);
    releaseHold.current = undefined;
    setPreview(null);
  }

  return (
    <div className="mt-0.5 grid grid-cols-[minmax(0,1fr)_minmax(5.75rem,max-content)] items-center gap-2 text-[12px] tabular-nums">
      <input
        type="range"
        aria-label="Narration timeline"
        aria-valuetext={player.count ? valueText : "Loading narration"}
        min={0}
        max={player.count || 1}
        step={0.01}
        value={position}
        disabled={!player.count}
        className="thread-reader-timeline"
        style={{ backgroundImage: player.count > 1 && player.count <= 12 ? `${marks}, ${track}` : track }}
        onKeyDown={(event) => {
          let delta: number;
          const step = player.duration ? Math.min(0.1, 5 / player.duration) : 0.1;

          switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown":
              delta = -step;
              break;
            case "ArrowRight":
            case "ArrowUp":
              delta = step;
              break;
            case "PageDown":
              delta = -1;
              break;
            case "PageUp":
              delta = 1;
              break;
            default:
              return;
          }

          event.preventDefault();
          seek(Math.max(0, Math.min(player.count, position + delta)));
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) {
            return;
          }

          releaseHold.current = holdForSeek();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onChange={(event) => {
          const value = event.currentTarget.valueAsNumber;

          if (releaseHold.current) {
            setPreview(value);
          } else {
            seek(value);
          }
        }}
        onPointerUp={(event) => {
          if (event.isPrimary && event.button === 0) {
            finishDrag(event.currentTarget.valueAsNumber);
          }
        }}
        onLostPointerCapture={(event) => {
          if (event.isPrimary) {
            finishDrag();
          }
        }}
      />
      {player.count > 0 && (
        <span className="whitespace-nowrap text-right text-muted-foreground" title={single ? undefined : passage}>
          {single ? time : `${index + 1} / ${player.count}`}
        </span>
      )}
    </div>
  );
}

function Player() {
  const player = useSyncExternalStore(subscribe, snapshot);
  const speed = useSyncExternalStore(subscribe, playbackSpeed);
  const closeWhenFinished = useSettings().values?.closeWhenFinished === true;

  useEffect(() => {
    setCloseWhenFinished(closeWhenFinished);
  }, [closeWhenFinished]);

  useEffect(() => {
    window.addEventListener("pagehide", stop);

    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);

  if (!player || player.label === previewLabel) {
    return null;
  }

  const panel =
    "fixed top-12 right-4 z-50 box-border max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover px-3 py-1.5 text-popover-foreground shadow-lg";
  const button = "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent";

  if (player.status === "Error") {
    return (
      <aside aria-label="Thread Reader" className={panel}>
        <div className="flex items-center gap-3 text-sm">
          <div role="status" className="max-w-64">
            <strong>Couldn’t read aloud</strong>
            <div className="text-xs">{player.detail}</div>
          </div>
          <button type="button" onClick={stop} className="rounded-md border border-border px-2 py-1 hover:bg-accent">
            Dismiss
          </button>
        </div>
      </aside>
    );
  }

  const action = player.paused ? "Play" : "Pause";

  return (
    <aside aria-label="Thread Reader" className={panel + " w-[18.5rem]"}>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={action} title={action} onClick={togglePlayback} className={button}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d={player.paused ? "M4 2.5v11l9-5.5z" : "M3 2.5h3.5v11H3zM9.5 2.5H13v11H9.5z"} />
          </svg>
        </button>
        <button type="button" aria-label="Stop" title="Stop" onClick={stop} className={button}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
          </svg>
        </button>
        <strong role="status" className="min-w-0 flex-1 truncate text-[13px]">
          {player.status} · {player.label}
        </strong>
        <select
          aria-label="Playback speed"
          title="Playback speed"
          value={speed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          className="h-8 shrink-0 cursor-pointer rounded-md bg-popover px-1 text-[12px] tabular-nums hover:bg-accent"
        >
          {speeds.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </div>
      <Timeline player={player} />
    </aside>
  );
}

export default definePluginApp((app) => {
  app.slots.settingsSection({
    id: "documentation",
    component: () => (
      <a
        href="https://developers.openai.com/api/docs/guides/realtime-conversations"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground underline hover:text-foreground"
      >
        OpenAI Realtime documentation
      </a>
    ),
  });

  app.contentScripts.register({ id: "voice-preview", mount: mountVoicePreview });

  app.slots.messageAction({
    id: "read-message",
    title: "Read aloud",
    icon: "thread-reader/speaker",
    run: ({ message, selectedText }) => {
      const selected = selectedText?.trim();

      return read(selected ? "Selection" : "Message", async () => [selected || message.text]);
    },
  });

  app.slots.experimental_threadAction({
    id: "read-thread",
    title: "Read thread aloud",
    group: "thread-reader",
    icon: "thread-reader/speaker",
    item: ({ thread, sdk }) => ({
      label: "Read thread aloud",
      icon: "thread-reader/speaker",
      run: () => read("Thread", (signal) => threadMessages(sdk, thread.id, signal)),
    }),
  });

  app.slots.experimental_appOverlay({ id: "reader", component: Player });
});
