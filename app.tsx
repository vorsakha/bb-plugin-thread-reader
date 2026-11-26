import { useEffect, useSyncExternalStore } from "react";
import { definePluginApp, type useSdk } from "@get-bb/plugin-sdk/app";
import { read, snapshot, stop, subscribe } from "./playback.ts";

async function threadMessages(sdk: ReturnType<typeof useSdk>, threadId: string, signal: AbortSignal) {
  const messages = new Map<number, string>();
  type Cursor = { anchorId: string; anchorSeq: number };
  const fetchPage = (cursor?: Cursor) => sdk.threads.timeline({
    threadId,
    signal,
    includeNestedRows: "true",
    deferContent: "false",
    beforeAnchorId: cursor?.anchorId,
    beforeAnchorSeq: cursor?.anchorSeq.toString()
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

function Player() {
  const player = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);
  if (!player) {
    return null;
  }
  const failed = player.status === "Error";
  return <aside aria-label="Thread Reader" className="fixed bottom-4 right-4 z-50 box-border flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
    <div role="status" className="min-w-0 text-sm">
      <strong>{failed ? "Couldn’t read aloud" : player.status + " · " + player.label}</strong>
      {player.progress && <div className="text-xs opacity-85">{player.progress}</div>}
      {player.detail && <div className="max-w-64 text-xs">{player.detail}</div>}
    </div>
    <button type="button" onClick={stop} className="rounded-md border border-border px-2 py-1 text-sm hover:bg-accent">{failed ? "Dismiss" : "Stop"}</button>
  </aside>;
}

export default definePluginApp(app => {
  app.slots.messageAction({
    id: "read-message", title: "Read aloud", icon: "Volume2",
    run: ({ message, selectedText }) => {
      const selected = selectedText?.trim();
      return read(selected ? "Selection" : "Message", async () => [selected || message.text]);
    }
  });
  app.slots.experimental_threadAction({
    id: "read-thread", title: "Read thread aloud", group: "thread-reader", icon: "Volume2",
    item: ({ thread, sdk }) => ({
      label: "Read thread aloud", icon: "Volume2",
      run: () => read("Thread", signal => threadMessages(sdk, thread.id, signal))
    })
  });
  app.slots.experimental_appOverlay({ id: "reader", component: Player });
});
