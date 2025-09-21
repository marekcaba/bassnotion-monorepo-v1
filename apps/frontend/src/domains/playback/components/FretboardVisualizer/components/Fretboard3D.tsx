'use client';

import React, { useCallback } from 'react';
import type { ExerciseNote } from '../types/fretboard';

interface Fretboard3DProps {
  visible?: boolean;
  strings?: number;
  notes?: ExerciseNote[];
  isEditMode?: boolean;
  selectedNote?: number | null;
  onNoteSelect?: (index: number | null) => void;
}

export function Fretboard3D({
  visible = true,
  strings = 4,
  notes = [],
  isEditMode = false,
  selectedNote = null,
  onNoteSelect,
}: Fretboard3DProps) {
  if (!visible) return null;

  const frets = 13; // 0-12 frets
  const stringSpacing = 1.0; // Space between strings
  const fretSpacing = 1.5; // Space between frets

  // Generate dots for each string and fret
  const dots = [];
  for (let stringIndex = 0; stringIndex < strings; stringIndex++) {
    for (let fretIndex = 0; fretIndex < frets; fretIndex++) {
      // Calculate position
      const x = fretIndex * fretSpacing - ((frets - 1) * fretSpacing) / 2;
      const z = (stringIndex - (strings - 1) / 2) * stringSpacing;

      // Perspective scaling - bottom strings bigger, top strings smaller
      const scale = 1 - stringIndex * 0.1;
      const dotSize = 0.25 * scale;

      // Zero fret = square, other frets = circle
      const isZeroFret = fretIndex === 0;

      dots.push(
        <mesh
          key={`dot-${stringIndex}-${fretIndex}`}
          position={[x, 0, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {isZeroFret ? (
            <planeGeometry args={[dotSize * 1.5, dotSize * 1.5]} />
          ) : (
            <circleGeometry args={[dotSize, 16]} />
          )}
          <meshBasicMaterial color="#cccccc" />
        </mesh>,
      );
    }
  }

  // Handle click on fretboard (for note selection in edit mode)
  const handleFretboardClick = useCallback(
    (event: any) => {
      if (!isEditMode) return;

      // Find if clicked on a note
      const clickedNoteIndex = notes.findIndex((note, index) => {
        // Simple proximity check (this would be more sophisticated in real implementation)
        return false; // Placeholder
      });

      if (clickedNoteIndex >= 0) {
        onNoteSelect?.(clickedNoteIndex);
      } else {
        onNoteSelect?.(null);
      }
    },
    [isEditMode, notes, onNoteSelect],
  );

  return (
    <>
      {/* Tilted group for perspective */}
      <group
        rotation={[-0.2, 0, 0]}
        position={[0, 0, 0]}
        data-testid="fretboard-3d"
      >
        {dots}

        {/* Render notes */}
        {notes.map((note, index) => {
          const x = note.fret * fretSpacing - ((frets - 1) * fretSpacing) / 2;
          const z = (note.string - (strings - 1) / 2) * stringSpacing;
          const isSelected = selectedNote === index;

          return (
            <mesh
              key={`note-${index}`}
              position={[x, 0.2, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                if (isEditMode) {
                  onNoteSelect?.(index);
                }
              }}
            >
              <circleGeometry args={[0.4, 16]} />
              <meshBasicMaterial
                color={isSelected ? '#ff6b6b' : '#4ecdc4'}
                opacity={0.8}
                transparent
              />
            </mesh>
          );
        })}
      </group>

      {/* Bright lighting */}
      <ambientLight intensity={1.2} />
    </>
  );
}
