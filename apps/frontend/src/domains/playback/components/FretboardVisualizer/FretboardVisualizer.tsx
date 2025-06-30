'use client';

import React, { useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, extend } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Fretboard3D } from './components/Fretboard3D';
import { NoteRenderer } from './components/NoteRenderer';
import { CameraControls } from './components/CameraControls';
import { TechniqueRenderer } from './components/TechniqueRenderer';
import { InteractionManager } from './interaction/InteractionManager';
import { NoteSelector } from './interaction/NoteSelector';
import { ContextMenu } from './interaction/ContextMenu';
import { useFretboardState } from './hooks/useFretboardState';
import { useThreeJSOptimization } from './hooks/useThreeJSOptimization';
import { NoteEditor } from './editing/NoteEditor';
import {
  EditHistory,
  CreateNoteCommand,
  DeleteNoteCommand,
  MoveNoteCommand,
} from './editing/EditHistory';
import { noteEditSync } from '../../../widgets/services/NoteEditSync';
import type { ExerciseNote } from './types/fretboard';

// Register Three.js elements for JSX usage - this should make them available to all child components
extend(THREE as any);

// Ensure all Three.js geometry and material elements are registered
extend({
  // Geometries
  sphereGeometry: THREE.SphereGeometry,
  planeGeometry: THREE.PlaneGeometry,
  boxGeometry: THREE.BoxGeometry,
  // Materials
  meshBasicMaterial: THREE.MeshBasicMaterial,
  meshStandardMaterial: THREE.MeshStandardMaterial,
  // Lights
  ambientLight: THREE.AmbientLight,
  directionalLight: THREE.DirectionalLight,
  pointLight: THREE.PointLight,
  // Objects
  group: THREE.Group,
  mesh: THREE.Mesh,
});

export interface FretboardVisualizerProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
  onCameraReset?: () => void;
  onSettingsClick?: () => void;
  // New editing props
  isEditMode?: boolean;
  onNotesChange?: (notes: ExerciseNote[]) => void;
  onEditModeToggle?: (isEditMode: boolean) => void;
}

// 3D Scene Component - contains all Three.js elements
function FretboardScene({
  notes,
  currentTime,
  bpm,
  isPlaying,
  onCameraReset,
  isEditMode = false,
  selectedNoteId,
  onNoteSelect,
  onNoteCreate,
  onNoteDrag,
}: Omit<
  FretboardVisualizerProps,
  'onSettingsClick' | 'onNotesChange' | 'onEditModeToggle'
> & {
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string | null) => void;
  onNoteCreate: (fret: number, string: number, time: number) => void;
  onNoteDrag: (
    noteId: string,
    newFret: number,
    newString: number,
    newTime: number,
  ) => void;
}) {
  const { visibleNotes, playStripPosition: _playStripPosition } =
    useFretboardState({
      notes,
      currentTime,
      bpm,
      isPlaying,
    });

  const { performanceSettings: _performanceSettings } =
    useThreeJSOptimization();

  return (
    <InteractionManager
      notes={notes}
      onNoteSelect={onNoteSelect}
      onNoteCreate={onNoteCreate}
      onNoteDrag={onNoteDrag}
      selectedNoteId={selectedNoteId}
      isEditMode={isEditMode}
      currentTime={currentTime}
    >
      {/* Camera Setup */}
      <PerspectiveCamera
        makeDefault
        position={[0, 8, 12]}
        fov={50}
        near={0.1}
        far={1000}
      />

      {/* 3D Fretboard (includes its own lighting) */}
      <Fretboard3D visible={true} />

      {/* Note Visualization */}
      <NoteRenderer
        notes={visibleNotes}
        currentTime={currentTime}
        bpm={bpm}
        visible={true}
      />

      {/* Technique Visualization */}
      <TechniqueRenderer
        notes={visibleNotes}
        currentTime={currentTime}
        visible={true}
      />

      {/* Note Selection Highlight */}
      <NoteSelector
        selectedNoteId={selectedNoteId}
        notes={notes}
        onSelectionChange={onNoteSelect}
        isEditMode={isEditMode}
      />

      {/* Camera Controls */}
      <CameraControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        onCameraChange={onCameraReset}
      />

      {/* OrbitControls for mouse/touch interaction - disabled in edit mode to prevent conflicts */}
      <OrbitControls
        enablePan={!isEditMode}
        enableZoom={!isEditMode}
        enableRotate={!isEditMode}
        maxPolarAngle={Math.PI / 2}
        minDistance={5}
        maxDistance={30}
      />
    </InteractionManager>
  );
}

export function FretboardVisualizer({
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
  // Editing state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    selectedNote: ExerciseNote | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    selectedNote: null,
  });

  // Initialize editing tools
  const noteEditor = useMemo(() => new NoteEditor(), []);
  const editHistory = useMemo(() => new EditHistory(), []);

  // Note editing handlers
  const handleNoteCreate = useCallback(
    (fret: number, string: number, time: number) => {
      if (!onNotesChange) return;

      const result = noteEditor.createNote(fret, string, time);
      if (!result.success || !result.note) {
        console.error('Failed to create note:', result.error);
        return;
      }

      const newNotes = [...notes, result.note];
      const command = new CreateNoteCommand(
        result.note,
        (note) => {
          onNotesChange([...notes, note]);
          noteEditSync.emitNoteCreated(note);
        },
        (noteId) => {
          const filtered = newNotes.filter((n) => n.id !== noteId);
          onNotesChange(filtered);
          noteEditSync.emitNoteDeleted(noteId);
        },
      );

      editHistory.executeCommand(command);
    },
    [notes, onNotesChange, noteEditor, editHistory],
  );

  const handleNoteDrag = useCallback(
    (noteId: string, newFret: number, newString: number, newTime: number) => {
      if (!onNotesChange) return;

      const originalNote = notes.find((n) => n.id === noteId);
      if (!originalNote) return;

      const result = noteEditor.moveNote(
        originalNote,
        newFret,
        newString,
        newTime,
      );
      if (!result.success || !result.note) {
        console.error('Failed to move note:', result.error);
        return;
      }

      const command = new MoveNoteCommand(
        noteId,
        originalNote,
        result.note,
        (id, note) => {
          const updated = notes.map((n) => (n.id === id ? note : n));
          onNotesChange(updated);
          noteEditSync.emitNoteUpdated(note);
        },
      );

      editHistory.executeCommand(command);
    },
    [notes, onNotesChange, noteEditor, editHistory],
  );

  const handleNoteDelete = useCallback(
    (noteId: string) => {
      if (!onNotesChange) return;

      const noteToDelete = notes.find((n) => n.id === noteId);
      if (!noteToDelete) return;

      const command = new DeleteNoteCommand(
        noteToDelete,
        (note) => {
          onNotesChange([...notes, note]);
          noteEditSync.emitNoteCreated(note);
        },
        (id) => {
          const filtered = notes.filter((n) => n.id !== id);
          onNotesChange(filtered);
          noteEditSync.emitNoteDeleted(id);
        },
      );

      editHistory.executeCommand(command);
      setSelectedNoteId(null);
    },
    [notes, onNotesChange, editHistory],
  );

  // Context menu handlers
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!isEditMode || !selectedNoteId) return;

      event.preventDefault();
      const selectedNote = notes.find((n) => n.id === selectedNoteId);

      setContextMenu({
        isVisible: true,
        position: { x: event.clientX, y: event.clientY },
        selectedNote: selectedNote || null,
      });
    },
    [isEditMode, selectedNoteId, notes],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditMode) return;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        editHistory.undo();
      } else if (
        isCtrlOrCmd &&
        (event.key === 'y' || (event.key === 'z' && event.shiftKey))
      ) {
        event.preventDefault();
        editHistory.redo();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedNoteId
      ) {
        event.preventDefault();
        handleNoteDelete(selectedNoteId);
      } else if (event.key === 'Escape') {
        setSelectedNoteId(null);
        closeContextMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEditMode,
    selectedNoteId,
    editHistory,
    handleNoteDelete,
    closeContextMenu,
  ]);

  return (
    <div className="w-full h-full relative" onContextMenu={handleContextMenu}>
      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]} // Device pixel ratio for retina displays
        className="w-full h-full"
      >
        <FretboardScene
          notes={notes}
          currentTime={currentTime}
          bpm={bpm}
          isPlaying={isPlaying}
          onCameraReset={onCameraReset}
          isEditMode={isEditMode}
          selectedNoteId={selectedNoteId}
          onNoteSelect={setSelectedNoteId}
          onNoteCreate={handleNoteCreate}
          onNoteDrag={handleNoteDrag}
        />
      </Canvas>

      {/* UI Overlay (outside Canvas) */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Edit Mode Toggle */}
        {onEditModeToggle && (
          <button
            onClick={() => onEditModeToggle(!isEditMode)}
            className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
              isEditMode
                ? 'bg-blue-600/80 hover:bg-blue-500/80 text-white'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-white'
            }`}
            aria-label={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
          >
            {isEditMode ? '✏️' : '👁️'}
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
          <div className="bg-blue-600/80 text-white px-3 py-1 rounded-lg backdrop-blur-sm text-sm">
            Edit Mode
          </div>
        </div>
      )}

      {/* Context Menu */}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        selectedNote={contextMenu.selectedNote}
        onClose={closeContextMenu}
        onCopy={() => {
          // TODO: Implement copy functionality
          console.log('Copy note');
        }}
        onPaste={() => {
          // TODO: Implement paste functionality
          console.log('Paste note');
        }}
        onDelete={() => {
          if (selectedNoteId) {
            handleNoteDelete(selectedNoteId);
          }
        }}
        onDuplicate={() => {
          // TODO: Implement duplicate functionality
          console.log('Duplicate note');
        }}
        onProperties={() => {
          // TODO: Implement properties panel
          console.log('Show properties');
        }}
      />

      {/* Performance Indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded backdrop-blur-sm">
          3D Fretboard Visualizer {isEditMode ? '(Edit Mode)' : '(View Mode)'}
        </div>
      )}
    </div>
  );
}
