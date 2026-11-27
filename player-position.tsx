import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export type PlayerPosition = { x: number; y: number };

type Drag = {
  pointerId: number;
  start: PlayerPosition;
  origin: PlayerPosition;
  moved: boolean;
};

export function MoveHandle({
  children,
  onMove,
}: {
  children: ReactNode;
  onMove: (position: PlayerPosition | null) => void;
}) {
  const drag = useRef<Drag | null>(null);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) {
      return;
    }

    const handle = event.currentTarget;
    const { x, y } = handle.closest("aside")!.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x, y },
      moved: false,
    };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - gesture.start.x;
    const dy = event.clientY - gesture.start.y;

    if (!gesture.moved && Math.hypot(dx, dy) < 4) {
      return;
    }

    gesture.moved = true;
    onMove({ x: gesture.origin.x + dx, y: gesture.origin.y + dy });
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
    }
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
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
        onMove(null);

        return;
      default:
        return;
    }

    event.preventDefault();
    onMove({ x, y });
  }

  return (
    <div
      className="thread-reader-handle"
      role="group"
      tabIndex={0}
      aria-label="Move player"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
      title="Drag or use arrow keys to move. Press Home to return to the top right."
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={keyDown}
    >
      {children}
    </div>
  );
}
