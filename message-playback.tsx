import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ExperimentalMessageMetadataProps } from "@get-bb/plugin-sdk/app";
import { actionPhase, actionSnapshot, stop, subscribe } from "./playback.ts";

export function MessagePlayback({ message }: ExperimentalMessageMetadataProps) {
  const phase = useSyncExternalStore(subscribe, () => actionPhase(actionSnapshot(), message.threadId, message.id));
  const active = phase !== null;
  const fallback = useRef<HTMLSpanElement>(null);
  const control = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const slot = fallback.current;
    const row = slot?.closest("[data-timeline-row-id]");

    if (!active || !slot || !row) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "thread-reader-message-action";
    button.onclick = stop;
    control.current = button;

    const sync = () => {
      const speakers = row.querySelectorAll<HTMLButtonElement>('button:has([data-icon="thread-reader/speaker"])');
      const inline = Array.from(speakers).find((speaker) => speaker.getClientRects().length);

      if (inline && button.nextElementSibling !== inline) {
        const focused = document.activeElement === inline || document.activeElement === button;
        inline.before(button);

        if (focused) {
          button.focus({ preventScroll: true });
        }
      } else if (!inline && button.parentElement !== slot) {
        slot.append(button);
      }
    };

    const resize = new ResizeObserver(sync);
    const changes = new MutationObserver(sync);
    resize.observe(row);
    changes.observe(row, { childList: true, subtree: true });
    sync();

    return () => {
      resize.disconnect();
      changes.disconnect();
      const speaker = button.nextElementSibling;
      const focused = document.activeElement === button;
      button.remove();
      control.current = null;

      if (focused && speaker instanceof HTMLButtonElement) {
        speaker.focus({ preventScroll: true });
      }
    };
  }, [active]);

  useLayoutEffect(() => {
    const button = control.current;

    if (button && phase) {
      button.dataset.phase = phase;
      button.title = phase === "loading" ? "Cancel loading narration" : "Stop narration";
      button.ariaLabel = button.title;
    }
  }, [phase]);

  return active ? <span ref={fallback} /> : null;
}
