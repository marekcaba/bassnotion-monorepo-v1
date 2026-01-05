'use client';

import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Fretboard3D } from './components/Fretboard3D';
import type { ExerciseNote } from './types/fretboard';

export interface FretboardVisualizerProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
  onCameraReset?: () => void;
  onSettingsClick?: () => void;
  isEditMode?: boolean;
  onNotesChange?: (notes: ExerciseNote[]) => void;
  onEditModeToggle?: (isEditMode: boolean) => void;
}

/**
 * Compares notes arrays for equality to prevent unnecessary re-renders.
 * Uses reference equality first, then shallow comparison of note properties.
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
      prevNote.fret === nextNote.fret &&
      prevNote.string === nextNote.string &&
      prevNote.duration === nextNote.duration
    );
  });
}

/**
 * Custom comparison function for FretboardVisualizer props.
 * Returns true if props are equal (skip re-render), false otherwise.
 *
 * Three.js Canvas re-renders are expensive, so we carefully compare:
 * - Primitive props directly
 * - Notes array with shallow comparison
 * - Callbacks by reference (assuming parent memoizes them)
 */
function areFretboardVisualizerPropsEqual(
  prevProps: FretboardVisualizerProps,
  nextProps: FretboardVisualizerProps,
): boolean {
  // Compare primitive props
  if (
    prevProps.currentTime !== nextProps.currentTime ||
    prevProps.bpm !== nextProps.bpm ||
    prevProps.isPlaying !== nextProps.isPlaying ||
    prevProps.isEditMode !== nextProps.isEditMode
  ) {
    return false;
  }

  // Compare callback references (parent should memoize these)
  if (
    prevProps.onCameraReset !== nextProps.onCameraReset ||
    prevProps.onSettingsClick !== nextProps.onSettingsClick ||
    prevProps.onNotesChange !== nextProps.onNotesChange ||
    prevProps.onEditModeToggle !== nextProps.onEditModeToggle
  ) {
    return false;
  }

  // Compare notes array
  return areNotesEqual(prevProps.notes, nextProps.notes);
}

function FretboardVisualizerComponent({
  notes,
  currentTime,
  bpm,
  isPlaying,
  onCameraReset,
  onSettingsClick,
  isEditMode = false,
  onNotesChange,
  onEditModeToggle,
}: FretboardVisualizerProps) {
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleEditModeToggle = useCallback(() => {
    onEditModeToggle?.(!isEditMode);
  }, [isEditMode, onEditModeToggle]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) {
        e.preventDefault();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
      }
    },
    [isEditMode],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isEditMode) return;

      if (e.key === 'Escape') {
        setSelectedNote(null);
        setContextMenuPosition(null);
      } else if (e.key === 'Delete' && selectedNote !== null) {
        // Handle delete
        const updatedNotes = notes.filter((_, index) => index !== selectedNote);
        onNotesChange?.(updatedNotes);
        setSelectedNote(null);
      }
    },
    [isEditMode, selectedNote, notes, onNotesChange],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenuPosition(null);
    if (contextMenuPosition) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenuPosition]);

  return (
    <div
      className="w-full h-full relative bg-slate-900"
      onContextMenu={handleContextMenu}
    >
      {/* Simple Three.js Canvas with tilted fretboard */}
      <Canvas
        camera={{ position: [0, 5, 8], fov: 60 }}
        className="w-full h-full"
      >
        <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={60} />
        {/* OrbitControls with edit mode handling */}
        <OrbitControls
          enabled={!isEditMode}
          enablePan={!isEditMode}
          enableRotate={!isEditMode}
          enableZoom={!isEditMode}
        />
        <Fretboard3D
          visible={true}
          strings={4}
          notes={notes}
          isEditMode={isEditMode}
          selectedNote={selectedNote}
          onNoteSelect={setSelectedNote}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Edit Mode Toggle */}
        {onEditModeToggle && (
          <button
            onClick={handleEditModeToggle}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
            aria-label={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
          >
            {isEditMode ? 'Exit Edit Mode' : 'Edit'}
          </button>
        )}

        {/* Settings Button */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
            aria-label="Fretboard Settings"
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-amber-500/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
            Edit Mode
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenuPosition && isEditMode && (
        <div
          className="absolute bg-slate-800 rounded-lg shadow-lg p-2 z-20"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-slate-700 rounded"
            onClick={() => {
              // Handle add note
              const newNote: ExerciseNote = {
                time: currentTime,
                fret: 0,
                string: 0,
                duration: 1,
              };
              onNotesChange?.([...notes, newNote]);
              setContextMenuPosition(null);
            }}
          >
            Add Note
          </button>
          {selectedNote !== null && (
            <button
              className="block w-full text-left px-4 py-2 hover:bg-slate-700 rounded"
              onClick={() => {
                // Handle delete
                const updatedNotes = notes.filter(
                  (_, index) => index !== selectedNote,
                );
                onNotesChange?.(updatedNotes);
                setSelectedNote(null);
                setContextMenuPosition(null);
              }}
            >
              Delete Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * FretboardVisualizer - Memoized Three.js fretboard visualization component.
 *
 * This component renders an expensive Three.js Canvas, so it uses React.memo
 * with a custom comparison function to prevent unnecessary re-renders.
 *
 * Performance optimization notes:
 * - Three.js Canvas re-renders are costly (full WebGL context updates)
 * - Parent components should memoize callback props with useCallback
 * - Notes array is compared by value to allow parent state updates
 */
export const FretboardVisualizer = memo(
  FretboardVisualizerComponent,
  areFretboardVisualizerPropsEqual,
);
