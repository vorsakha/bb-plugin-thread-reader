import "./player.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { definePluginApp, useBbContext, useSettings, type useSdk } from "@get-bb/plugin-sdk/app";
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
import { MoveHandle, usePlayerPosition } from "./player-position.tsx";
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

  let widestReadout = `${player.count} / ${player.count}`;

  if (single && player.duration) {
    const total = clock(player.duration);
    widestReadout = `${total} / ${total}`;
  } else if (player.count < 2) {
    widestReadout = "100%";
  }

  const fill = `${player.count ? (position / player.count) * 100 : 0}%`;
  const track = `linear-gradient(to right, var(--primary) ${fill}, var(--thread-reader-remaining) ${fill})`;
  const section = `${100 / (player.count || 1)}%`;
  const marks = `repeating-linear-gradient(to right, transparent 0 calc(${section} - 2px), var(--popover) calc(${section} - 2px) ${section})`;

  function finishDrag(position?: number) {
    releaseHold.current?.(position);
    releaseHold.current = undefined;
    setPreview(null);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px] tabular-nums">
      <input
        type="range"
        aria-label="Narration timeline"
        aria-valuetext={player.count ? valueText : "Loading narration"}
        min={0}
        max={player.count || 1}
        step={0.01}
        value={position}
        disabled={!player.count}
        title={player.count ? valueText : undefined}
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
      <span
        className="grid whitespace-nowrap text-right text-muted-foreground"
        title={player.count > 1 ? passage : undefined}
      >
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {widestReadout}
        </span>
        {player.count > 0 && (
          <span className="col-start-1 row-start-1">{single ? time : `${index + 1} / ${player.count}`}</span>
        )}
      </span>
    </div>
  );
}

function Overlay() {
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

  return <Player floating />;
}

function ThreadPlayer({ threadId }: { threadId: string }) {
  const active = useBbContext();

  return active.threadId === threadId ? <Player /> : null;
}

function Player({ floating = false }: { floating?: boolean }) {
  const player = useSyncExternalStore(subscribe, snapshot);
  const speed = useSyncExternalStore(subscribe, playbackSpeed);
  const position = usePlayerPosition();

  if (!player || player.label === previewLabel) {
    return null;
  }

  const panel = floating ? "thread-reader-panel thread-reader-floating" : "thread-reader-panel thread-reader-docked";

  const moved = floating && position;
  const style = moved
    ? {
        transform: `translate(clamp(0px, ${moved.x}px, 100dvw - 100%), clamp(0px, ${moved.y}px, 100dvh - 100%))`,
      }
    : undefined;
  const panelProps = { className: panel, "data-moved": moved ? true : undefined, style, "aria-label": "Thread Reader" };

  if (player.status === "Error") {
    return (
      <aside {...panelProps}>
        <div className="flex items-center gap-3 text-sm">
          <MoveHandle placed={position !== null}>
            <div role="status" className="min-w-0 break-words">
              <strong>Couldn’t read aloud</strong>
              <div className="text-xs">{player.detail}</div>
            </div>
          </MoveHandle>
          <button
            type="button"
            onClick={stop}
            className="thread-reader-control rounded-md border border-border px-2 py-1 hover:bg-accent"
          >
            Dismiss
          </button>
        </div>
      </aside>
    );
  }

  const finished = player.status === "Finished";
  const loading = player.status === "Loading";
  let action = player.paused ? "Play" : "Pause";

  if (finished) {
    action = "Replay";
  }

  return (
    <aside {...panelProps}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={action}
          title={action}
          onClick={togglePlayback}
          className="thread-reader-control thread-reader-primary"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {finished ? (
              <path
                d="M3.5 5.5a5 5 0 1 1-.4 4.3M3.5 2v3.8h3.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path d={player.paused ? "M4 2.5v11l9-5.5z" : "M3 2.5h3.5v11H3zM9.5 2.5H13v11H9.5z"} />
            )}
          </svg>
        </button>
        <MoveHandle placed={position !== null}>
          <span role="status" className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px]">
            <span className="font-medium">{player.label}</span>
            {loading ? (
              <>
                <span className="thread-reader-spinner" aria-hidden="true" />
                <span className="sr-only">Loading</span>
              </>
            ) : (
              <span className="truncate text-[12px] text-muted-foreground">
                <span aria-hidden="true">· </span>
                {player.status}
              </span>
            )}
          </span>
        </MoveHandle>
        <select
          aria-label="Playback speed"
          title="Playback speed"
          value={speed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          className="thread-reader-control thread-reader-speed h-8 rounded-md bg-popover px-1 text-[12px] tabular-nums hover:bg-accent"
        >
          {speeds.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Stop"
          title="Stop and close"
          onClick={stop}
          className="thread-reader-control thread-reader-stop"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
          </svg>
        </button>
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

  app.slots.experimental_threadHeaderRow({ id: "reader", component: ThreadPlayer });
  app.slots.experimental_appOverlay({ id: "reader", component: Overlay });
});
