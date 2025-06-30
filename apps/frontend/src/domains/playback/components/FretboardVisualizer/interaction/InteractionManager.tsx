'use client';

import React, { useRef, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExerciseNote } from '../types/fretboard.js';

interface InteractionManagerProps {
  notes: ExerciseNote[];
  onNoteSelect: (noteId: string | null) => void;
  onNoteCreate: (fret: number, string: number, time: number) => void;
  onNoteDrag: (
    noteId: string,
    newFret: number,
    newString: number,
    newTime: number,
  ) => void;
  selectedNoteId: string | null;
  isEditMode: boolean;
  currentTime: number;
  children: React.ReactNode;
}

// Fretboard dimensions matching the actual 3D model
const FRETBOARD_CONFIG = {
  stringCount: 4,
  fretCount: 24,
  stringSpacing: 0.6, // Three.js units
  fretSpacing: 1.8, // Three.js units base
  fretboardLength: 43.2, // Total length in Three.js units
  fretboardWidth: 2.4, // Width in Three.js units
};

export function InteractionManager({
  notes,
  onNoteSelect,
  onNoteCreate,
  onNoteDrag,
  selectedNoteId,
  isEditMode,
  currentTime,
  children,
}: InteractionManagerProps) {
  const { camera, raycaster, pointer, scene } = useThree();
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    noteId: string;
    startFret: number;
    startString: number;
    startTime: number;
  } | null>(null);

  // Create invisible interaction plane for click detection
  const interactionPlane = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(
      FRETBOARD_CONFIG.fretboardLength,
      FRETBOARD_CONFIG.fretboardWidth,
    );
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2; // Horizontal plane
    plane.position.set(0, 0.1, 0); // Slightly above fretboard
    plane.name = 'interaction-plane';
    return plane;
  }, []);

  // Add interaction plane to scene
  React.useEffect(() => {
    scene.add(interactionPlane);
    return () => {
      scene.remove(interactionPlane);
    };
  }, [scene, interactionPlane]);

  // Convert world position to fret/string coordinates
  const worldToFretboard = useCallback(
    (worldPos: THREE.Vector3): { fret: number; string: number } => {
      // Convert world coordinates to fretboard coordinates
      const x = worldPos.x + FRETBOARD_CONFIG.fretboardLength / 2;
      const z = worldPos.z + FRETBOARD_CONFIG.fretboardWidth / 2;

      // Calculate fret (x-axis)
      const fretPosition = x / FRETBOARD_CONFIG.fretSpacing;
      const fret = Math.max(
        0,
        Math.min(FRETBOARD_CONFIG.fretCount, Math.round(fretPosition)),
      );

      // Calculate string (z-axis)
      const stringPosition = z / FRETBOARD_CONFIG.stringSpacing;
      const string = Math.max(
        1,
        Math.min(FRETBOARD_CONFIG.stringCount, Math.round(stringPosition + 1)),
      );

      return { fret, string };
    },
    [],
  );

  // Find note at world position
  const findNoteAtPosition = useCallback(
    (worldPos: THREE.Vector3, tolerance = 0.5): ExerciseNote | null => {
      const { fret, string } = worldToFretboard(worldPos);

      return (
        notes.find((note) => {
          const fretDiff = Math.abs(note.fret - fret);
          const stringDiff = Math.abs(note.string - string);
          return fretDiff <= tolerance && stringDiff <= tolerance;
        }) || null
      );
    },
    [notes, worldToFretboard],
  );

  // Handle pointer down events
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!isEditMode) return;

      event.stopPropagation();

      // Update raycaster
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(interactionPlane);

      if (intersects.length === 0) return;

      const intersection = intersects[0];
      if (!intersection?.point) return;

      const worldPos = intersection.point;
      const noteAtPosition = findNoteAtPosition(worldPos);

      if (noteAtPosition) {
        // Select existing note and prepare for dragging
        onNoteSelect(noteAtPosition.id);
        isDraggingRef.current = true;
        dragStartRef.current = {
          noteId: noteAtPosition.id,
          startFret: noteAtPosition.fret,
          startString: noteAtPosition.string,
          startTime: noteAtPosition.timestamp,
        };
      } else {
        // Create new note at clicked position
        const { fret, string } = worldToFretboard(worldPos);
        onNoteCreate(fret, string, currentTime);
        onNoteSelect(null); // Clear selection after creation
      }
    },
    [
      isEditMode,
      raycaster,
      pointer,
      camera,
      interactionPlane,
      findNoteAtPosition,
      worldToFretboard,
      onNoteSelect,
      onNoteCreate,
      currentTime,
    ],
  );

  // Handle pointer move events (dragging)
  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isEditMode || !isDraggingRef.current || !dragStartRef.current)
        return;

      event.stopPropagation();

      // Update raycaster
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(interactionPlane);

      if (intersects.length === 0) return;

      const intersection = intersects[0];
      if (!intersection?.point) return;

      const worldPos = intersection.point;
      const { fret, string } = worldToFretboard(worldPos);

      // Calculate time offset based on horizontal movement
      // This is a simple implementation - could be enhanced with more sophisticated timing
      const dragStart = dragStartRef.current;
      const timeOffset = (fret - dragStart.startFret) * 100; // 100ms per fret
      const newTime = Math.max(0, dragStart.startTime + timeOffset);

      onNoteDrag(dragStart.noteId, fret, string, newTime);
    },
    [
      isEditMode,
      raycaster,
      pointer,
      camera,
      interactionPlane,
      worldToFretboard,
      onNoteDrag,
    ],
  );

  // Handle pointer up events
  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!isEditMode) return;

      event.stopPropagation();
      isDraggingRef.current = false;
      dragStartRef.current = null;
    },
    [isEditMode],
  );

  // Handle keyboard events for note deletion
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditMode || !selectedNoteId) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        // Note deletion will be handled by parent component
        // We just clear the selection here
        onNoteSelect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedNoteId, onNoteSelect]);

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {children}
    </group>
  );
}
