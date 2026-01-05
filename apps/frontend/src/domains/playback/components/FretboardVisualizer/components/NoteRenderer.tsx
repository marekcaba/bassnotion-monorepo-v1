'use client';

import React, { memo, useMemo } from 'react';
import * as THREE from 'three';
import { ExerciseNote } from '../types/fretboard';
import {
  calculateNoteDisplayPosition,
  getNoteState,
} from '../utils/notePositioning';
import {
  getStringColor,
  createNoteMaterial,
  calculateNoteOpacity,
} from '../utils/colorScheme';

interface NoteRendererProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  visible?: boolean;
}

/**
 * Compares notes arrays for equality.
 * Checks both array length and individual note properties.
 */
function areNotesEqual(
  prevNotes: ExerciseNote[],
  nextNotes: ExerciseNote[],
): boolean {
  if (prevNotes === nextNotes) return true;
  if (prevNotes.length !== nextNotes.length) return false;

  return prevNotes.every((prevNote, index) => {
    const nextNote = nextNotes[index];
    return (
      prevNote.id === nextNote.id &&
      prevNote.timestamp === nextNote.timestamp &&
      prevNote.string === nextNote.string &&
      prevNote.fret === nextNote.fret
    );
  });
}

/**
 * Custom comparison for NoteRenderer props.
 * This component creates Three.js materials and geometries for each visible note,
 * so avoiding unnecessary re-renders is important for performance.
 */
function areNoteRendererPropsEqual(
  prevProps: NoteRendererProps,
  nextProps: NoteRendererProps,
): boolean {
  // Compare primitive props
  if (
    prevProps.currentTime !== nextProps.currentTime ||
    prevProps.bpm !== nextProps.bpm ||
    prevProps.visible !== nextProps.visible
  ) {
    return false;
  }

  // Compare notes array
  return areNotesEqual(prevProps.notes, nextProps.notes);
}

interface RenderedNote {
  note: ExerciseNote;
  position: THREE.Vector3;
  material: THREE.MeshStandardMaterial;
  scale: number;
}

function NoteRendererComponent({
  notes,
  currentTime,
  bpm,
  visible = true,
}: NoteRendererProps) {
  // Calculate visible notes with their positions and materials
  const renderedNotes = useMemo(() => {
    const visibleNotes: RenderedNote[] = [];

    notes.forEach((note) => {
      const position = calculateNoteDisplayPosition(note, currentTime, bpm);
      if (!position) return; // Note is not visible

      const noteState = getNoteState(note, currentTime);
      if (noteState === 'hidden') return;

      // Determine color based on state and string
      let color: string;
      let opacity = 1.0;

      switch (noteState) {
        case 'current':
          color = '#FF0000'; // Red for current note
          break;
        case 'upcoming': {
          color = getStringColor(note.string);
          // Calculate opacity for upcoming notes (gradual fade)
          const upcomingIndex =
            notes
              .filter((n) => n.timestamp > currentTime)
              .sort((a, b) => a.timestamp - b.timestamp)
              .indexOf(note) + 1;
          opacity = calculateNoteOpacity(upcomingIndex);
          break;
        }
        case 'played':
          color = '#808080'; // Gray for played notes
          opacity = 0.3;
          break;
        default:
          color = getStringColor(note.string);
      }

      const material = createNoteMaterial(color, opacity);

      visibleNotes.push({
        note,
        position,
        material,
        scale: 1.0, // Base scale, could be adjusted based on distance
      });
    });

    return visibleNotes;
  }, [notes, currentTime, bpm]);

  if (!visible || renderedNotes.length === 0) return null;

  // This component is properly used within a Canvas context from react-three-fiber
  // The JSX elements below will work correctly
  return (
    <group name="note-renderer">
      {renderedNotes.map(({ note, position, material, scale }) => (
        <group key={note.id} position={position}>
          <mesh material={material} scale={scale}>
            <sphereGeometry args={[3, 16, 16]} />
          </mesh>
          {/* Note label */}
          <mesh position={[0, 8, 0]}>
            <planeGeometry args={[12, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * NoteRenderer - Memoized Three.js note visualization component.
 *
 * Renders spheres and labels for each visible note based on current playback time.
 * Creates new Three.js materials for each note, making re-renders expensive.
 *
 * Performance optimization:
 * - Uses React.memo with custom comparison
 * - Internal useMemo for rendered notes calculation
 * - Only re-renders when notes, currentTime, bpm, or visible actually change
 */
export const NoteRenderer = memo(
  NoteRendererComponent,
  areNoteRendererPropsEqual,
);
