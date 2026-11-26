import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

type Point = { x: number; y: number };

let position: Point | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function usePlayerPosition() {
  return useSyncExternalStore(subscribe, () => position);
}

function place(point: Point | null) {
  position = point;

  for (const listener of listeners) {
    listener();
  }
}

function focusHandle() {
  requestAnimationFrame(() => {
    const handles = document.querySelectorAll<HTMLButtonElement>(".thread-reader-handle");

    for (const handle of Array.from(handles)) {
      if (handle.getClientRects().length) {
        handle.focus({ preventScroll: true });
        break;
      }
    }
  });
}

export function MoveHandle({ children, placed }: { children: ReactNode; placed: boolean }) {
  const gesture = useRef<AbortController | null>(null);
  const action = placed ? "Return player to dock" : "Center player";

  useEffect(() => () => gesture.current?.abort(), []);

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    const button = event.currentTarget;
    const panel = button.closest("aside")!;
    const bounds = panel.getBoundingClientRect();
    const { pointerId, clientX, clientY } = event;
    const root = document.documentElement;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let moved = false;

    gesture.current?.abort();
    gesture.current = controller;
    button.setPointerCapture(pointerId);

    function end(next: globalThis.PointerEvent) {
      if (next.pointerId === pointerId) {
        controller.abort();

        if (moved && next.type === "pointerup") {
          focusHandle();
        }
      }
    }

    window.addEventListener(
      "pointermove",
      (next) => {
        if (next.pointerId !== pointerId) {
          return;
        }

        const dx = next.clientX - clientX;
        const dy = next.clientY - clientY;

        if (!moved) {
          if (Math.hypot(dx, dy) < 4) {
            return;
          }

          root.setPointerCapture(pointerId);
          moved = true;
        }

        place({ x: bounds.x + dx, y: bounds.y + dy });
      },
      options,
    );
    window.addEventListener("pointerup", end, options);
    window.addEventListener("pointercancel", end, options);
    window.addEventListener("blur", () => controller.abort(), options);
    controller.signal.addEventListener(
      "abort",
      () => {
        if (root.hasPointerCapture(pointerId)) {
          root.releasePointerCapture(pointerId);
        }
      },
      { once: true },
    );
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.closest("aside")!.getBoundingClientRect();
    const step = event.shiftKey ? 64 : 16;
    let { x, y } = rect;

    switch (event.key) {
      case "ArrowLeft":
        x -= step;
        break;
      case "ArrowRight":
        x += step;
        break;
      case "ArrowUp":
        y -= step;
        break;
      case "ArrowDown":
        y += step;
        break;
      case "Home":
        event.preventDefault();
        place(null);
        focusHandle();

        return;
      default:
        return;
    }

    event.preventDefault();
    place({ x, y });
    focusHandle();
  }

  return (
    <div className="thread-reader-title">
      <span className="thread-reader-grip" aria-hidden="true" />
      {children}
      <button
        type="button"
        className="thread-reader-handle thread-reader-control"
        aria-label={`Move player. ${action}`}
        title={`Drag to move · Click to ${action.toLowerCase()} · Arrow keys to move · Home to dock`}
        onPointerDown={start}
        onKeyDown={keyDown}
        onClick={(event) => {
          const rect = event.currentTarget.closest("aside")!.getBoundingClientRect();
          const center = { x: (window.innerWidth - rect.width) / 2, y: (window.innerHeight - rect.height) / 2 };
          place(placed ? null : center);
          focusHandle();
        }}
      />
    </div>
  );
}
