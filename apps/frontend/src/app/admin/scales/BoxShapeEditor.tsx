'use client';

/**
 * BoxShapeEditor — the visual, DRAGGABLE fret-window editor for ONE box position.
 *
 * A box is a fret WINDOW relative to the root's fret on the lowest string:
 * [startFretOffset, startFretOffset + span]. Here we render a 2D fret strip (fret 0 = the
 * root fret) and let the admin DRAG:
 *   • the box body  → moves startFretOffset (slides the whole window left/right),
 *   • the right edge → changes span (widens/narrows the window).
 * Dragging updates the numeric values live (two-way bound — the parent also lets you type
 * the numbers, which moves the box). A 2D strip (not the 3D fretboard) makes the drag
 * hit-testing exact; the 3D ScaleFretboardWindow sits alongside as the "how it looks"
 * preview.
 */

import React from 'react';

export interface BoxShape {
  startFretOffset: number;
  span: number;
}

// The strip shows this fret range, RELATIVE to the root fret (0 = root on lowest string).
const MIN_FRET = -3;
const MAX_FRET = 16;
const FRETS = Array.from(
  { length: MAX_FRET - MIN_FRET + 1 },
  (_, i) => MIN_FRET + i,
);
const FRET_W = 28; // px per fret cell

export function BoxShapeEditor({
  value,
  onChange,
}: {
  value: BoxShape;
  onChange: (next: BoxShape) => void;
}) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startOffset: number;
    startSpan: number;
  } | null>(null);

  // Pixel position of a fret value within the strip (left edge of its cell).
  const fretToX = (fret: number) => (fret - MIN_FRET) * FRET_W;

  const onPointerMove = React.useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dxFrets = Math.round((e.clientX - d.startX) / FRET_W);
      if (d.mode === 'move') {
        const nextOffset = clamp(
          d.startOffset + dxFrets,
          MIN_FRET,
          MAX_FRET - 1,
        );
        onChange({ startFretOffset: nextOffset, span: d.startSpan });
      } else {
        const nextSpan = clamp(d.startSpan + dxFrets, 1, 8);
        onChange({ startFretOffset: d.startOffset, span: nextSpan });
      }
    },
    [onChange],
  );

  const endDrag = React.useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove]);

  const startDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = {
      mode,
      startX: e.clientX,
      startOffset: value.startFretOffset,
      startSpan: value.span,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  React.useEffect(() => endDrag, [endDrag]);

  const boxLeft = fretToX(value.startFretOffset);
  const boxWidth = value.span * FRET_W;

  return (
    <div
      ref={stripRef}
      style={{
        position: 'relative',
        width: FRETS.length * FRET_W,
        height: 56,
        userSelect: 'none',
      }}
      className="rounded-md bg-gray-100"
    >
      {/* Fret gridlines + labels */}
      {FRETS.map((fret) => (
        <div
          key={fret}
          style={{ position: 'absolute', left: fretToX(fret), width: FRET_W }}
          className="h-full"
        >
          <div
            className={`h-full border-l ${fret === 0 ? 'border-orange-400' : 'border-gray-200'}`}
          />
          <div className="absolute bottom-0 left-0 w-full text-center text-[9px] text-gray-400">
            {fret === 0 ? 'root' : fret}
          </div>
        </div>
      ))}

      {/* The draggable box window */}
      <div
        onPointerDown={startDrag('move')}
        style={{
          position: 'absolute',
          top: 6,
          left: boxLeft,
          width: boxWidth,
          height: 36,
        }}
        className="cursor-grab rounded bg-emerald-400/40 ring-2 ring-emerald-500 active:cursor-grabbing"
        title="Drag to move the box"
      >
        {/* Right resize handle */}
        <div
          onPointerDown={startDrag('resize')}
          style={{
            position: 'absolute',
            right: -4,
            top: 0,
            width: 10,
            height: '100%',
          }}
          className="cursor-ew-resize rounded-r bg-emerald-600"
          title="Drag to change the span"
        />
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
