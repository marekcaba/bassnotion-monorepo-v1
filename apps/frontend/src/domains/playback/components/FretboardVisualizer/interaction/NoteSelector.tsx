'use client';

import React from 'react';
import * as THREE from 'three';
import type { ExerciseNote } from '../types/fretboard.js';

interface NoteSelectorProps {
  selectedNoteId: string | null;
  notes: ExerciseNote[];
  onSelectionChange: (noteId: string | null) => void;
  isEditMode: boolean;
}

export function NoteSelector({
  selectedNoteId,
  notes,
  onSelectionChange: _onSelectionChange,
  isEditMode,
}: NoteSelectorProps) {
  // Find the selected note
  const selectedNote = selectedNoteId
    ? notes.find((note) => note.id === selectedNoteId)
    : null;

  if (!isEditMode || !selectedNote) return null;

  // Calculate position for the selected note
  // This is a simplified position calculation - in a real implementation,
  // this would use the same positioning logic as the main NoteRenderer
  const position = new THREE.Vector3(
    selectedNote.fret * 1.8 - 21.6, // Approximate fret positioning
    0.2, // Slightly above fretboard
    (selectedNote.string - 2.5) * 0.6, // String positioning
  );

  return (
    <group name="note-selector">
      {/* Selection highlight */}
      <mesh position={position}>
        <ringGeometry args={[4, 6, 8]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Selection pulse animation */}
      <mesh position={position}>
        <ringGeometry args={[3, 5, 8]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
