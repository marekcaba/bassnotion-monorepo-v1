import React from 'react';
import type { StringCount } from '../../types/fretboardTypes';

interface VerticalLinesProps {
  stringCount: StringCount;
  frets: number[];
  segmentFunctions: {
    getVerticalSegments: (
      fret: number,
    ) => Array<{ start: number; height: number }>;
  };
}

export const VerticalLines: React.FC<VerticalLinesProps> = ({
  stringCount,
  frets,
  segmentFunctions,
}) => {
  const gridHeight = stringCount * 42;

  return (
    <>
      {/* Open string vertical line - same as other lines */}
      <div
        className="absolute"
        style={{
          left: 13,
          top: 21,
          width: 1,
          height: gridHeight - 21,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 1,
        }}
      />

      {/* Fret lines */}
      {frets.map((fret) => {
        const segments = segmentFunctions.getVerticalSegments(fret);
        const x = 46 + (fret - 1) * 38 + 13;
        const isFretMarker = [3, 5, 7, 9, 12].includes(fret);

        return (
          <React.Fragment key={`vertical-${fret}`}>
            {/* Base vertical line for the fret - all same opacity */}
            <div
              className="absolute"
              style={{
                left: x,
                top: 21,
                width: 1,
                height: gridHeight - 21,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                zIndex: 1,
              }}
            />

            {/* Highlighted segments - green when connected */}
            {segments.map((segment, segmentIndex) => (
              <div
                key={`segment-${fret}-${segmentIndex}`}
                className="absolute"
                style={{
                  left: x - 2,
                  top: segment.start,
                  width: 4,
                  height: segment.height,
                  backgroundColor: 'rgba(34, 197, 94, 1)',
                  zIndex: 15,
                }}
              />
            ))}
          </React.Fragment>
        );
      })}

      {/* Fret markers */}
      {frets.map((fret) => {
        const isFretMarker = [3, 5, 7, 9, 12].includes(fret);
        if (!isFretMarker) return null;

        const x = 46 + (fret - 1) * 38 + 13;
        const markerY = 21 + (gridHeight - 21) / 2; // Center between strings

        return (
          <div
            key={`marker-${fret}`}
            className="absolute rounded-full"
            style={{
              left: x - 2,
              top: markerY - 2,
              width: 4,
              height: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              zIndex: 1,
            }}
          />
        );
      })}
    </>
  );
};
