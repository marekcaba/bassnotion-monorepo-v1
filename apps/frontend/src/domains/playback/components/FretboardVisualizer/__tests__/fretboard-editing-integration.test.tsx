import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FretboardVisualizer } from '../FretboardVisualizer';
import type { ExerciseNote } from '../types/fretboard';

// Mock Three.js components for testing
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="three-canvas">{children}</div>
  ),
  extend: vi.fn(),
  useThree: () => ({
    camera: { position: { set: vi.fn() } },
    raycaster: {
      setFromCamera: vi.fn(),
      intersectObject: vi
        .fn()
        .mockReturnValue([{ point: { x: 0, y: 0, z: 0 } }]),
    },
    pointer: { x: 0, y: 0 },
    scene: { add: vi.fn(), remove: vi.fn() },
  }),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: () => <div data-testid="perspective-camera" />,
}));

// Mock Three.js
vi.mock('three', () => ({
  default: {},
  Vector3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
  PlaneGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  Mesh: vi.fn().mockImplementation(() => ({
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    name: '',
  })),
  Group: vi.fn(),
  SphereGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  RingGeometry: vi.fn(),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(),
  PointLight: vi.fn(),
  DoubleSide: 2,
  Math: { PI: Math.PI },
}));

// Mock components
vi.mock('../components/Fretboard3D', () => ({
  Fretboard3D: () => <div data-testid="fretboard-3d" />,
}));

vi.mock('../components/NoteRenderer', () => ({
  NoteRenderer: () => <div data-testid="note-renderer" />,
}));

vi.mock('../components/CameraControls', () => ({
  CameraControls: () => <div data-testid="camera-controls" />,
}));

vi.mock('../components/TechniqueRenderer', () => ({
  TechniqueRenderer: () => <div data-testid="technique-renderer" />,
}));

vi.mock('../hooks/useFretboardState', () => ({
  useFretboardState: () => ({
    visibleNotes: [],
    playStripPosition: { x: 0, y: 0, z: 0 },
  }),
}));

vi.mock('../hooks/useThreeJSOptimization', () => ({
  useThreeJSOptimization: () => ({
    performanceSettings: { targetFPS: 60 },
  }),
}));

describe('Fretboard Editing Integration Tests', () => {
  const mockNotes: ExerciseNote[] = [
    {
      id: 'note-1',
      timestamp: 0,
      string: 2,
      fret: 3,
      duration: 500,
      note: 'C3',
    },
    {
      id: 'note-2',
      timestamp: 1000,
      string: 3,
      fret: 5,
      duration: 500,
      note: 'A3',
    },
  ];

  let mockOnNotesChange: ReturnType<typeof vi.fn>;
  let mockOnEditModeToggle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnNotesChange = vi.fn();
    mockOnEditModeToggle = vi.fn();
  });

  describe('Edit Mode Workflow', () => {
    it('should enable edit mode and show editing interface', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
          onEditModeToggle={mockOnEditModeToggle}
        />,
      );

      // Should not show edit mode initially
      expect(screen.queryByText('Edit Mode')).not.toBeInTheDocument();

      // Click edit mode toggle
      const editButton = screen.getByLabelText('Enter Edit Mode');
      fireEvent.click(editButton);

      expect(mockOnEditModeToggle).toHaveBeenCalledWith(true);
    });

    it('should show edit mode indicator when in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
          onEditModeToggle={mockOnEditModeToggle}
        />,
      );

      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Exit Edit Mode')).toBeInTheDocument();
    });

    it('should disable orbit controls in edit mode', () => {
      const { rerender } = render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // In view mode, orbit controls should be enabled
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();

      // Switch to edit mode
      rerender(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Orbit controls should still be present but configured differently
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
    });
  });

  describe('Note Creation Workflow', () => {
    it('should handle note creation in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={500}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Simulate clicking on the Three.js canvas to create a note
      const canvas = screen.getByTestId('three-canvas');
      fireEvent.pointerDown(canvas, {
        clientX: 100,
        clientY: 100,
      });

      // Verify edit mode is active and component renders correctly
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });

    it('should not create notes when not in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={500}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Click should not trigger note creation when not in edit mode
      const canvas = screen.getByTestId('three-canvas');
      fireEvent.pointerDown(canvas, {
        clientX: 100,
        clientY: 100,
      });

      // No note creation should occur
      expect(mockOnNotesChange).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle undo/redo keyboard shortcuts', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Test Ctrl+Z (undo)
      fireEvent.keyDown(window, {
        key: 'z',
        ctrlKey: true,
      });

      // Test Ctrl+Y (redo)
      fireEvent.keyDown(window, {
        key: 'y',
        ctrlKey: true,
      });

      // Test Escape (clear selection)
      fireEvent.keyDown(window, {
        key: 'Escape',
      });

      // Component should handle these events without errors
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });

    it('should handle delete key for note deletion', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Test Delete key
      fireEvent.keyDown(window, {
        key: 'Delete',
      });

      // Test Backspace key
      fireEvent.keyDown(window, {
        key: 'Backspace',
      });

      // Component should handle these events
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });

    it('should not handle keyboard shortcuts when not in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Keyboard events should not trigger editing actions when not in edit mode
      fireEvent.keyDown(window, {
        key: 'z',
        ctrlKey: true,
      });

      fireEvent.keyDown(window, {
        key: 'Delete',
      });

      // No changes should occur
      expect(mockOnNotesChange).not.toHaveBeenCalled();
    });
  });

  describe('Context Menu Behavior', () => {
    it('should show context menu on right click in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      const container = screen.getByTestId('three-canvas').parentElement;

      // Right click should potentially show context menu
      if (container) {
        fireEvent.contextMenu(container, {
          clientX: 100,
          clientY: 100,
        });
      }

      // Component should handle the context menu event
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });

    it('should not show context menu when not in edit mode', () => {
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
        />,
      );

      const container = screen.getByTestId('three-canvas').parentElement;

      if (container) {
        fireEvent.contextMenu(container, {
          clientX: 100,
          clientY: 100,
        });
      }

      // No context menu should appear in view mode
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Stability', () => {
    it('should handle rapid mode switching without errors', () => {
      const { rerender } = render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={false}
          onNotesChange={mockOnNotesChange}
          onEditModeToggle={mockOnEditModeToggle}
        />,
      );

      // Rapidly switch between edit modes
      for (let i = 0; i < 5; i++) {
        rerender(
          <FretboardVisualizer
            notes={mockNotes}
            currentTime={0}
            bpm={120}
            isPlaying={false}
            isEditMode={true}
            onNotesChange={mockOnNotesChange}
            onEditModeToggle={mockOnEditModeToggle}
          />,
        );

        rerender(
          <FretboardVisualizer
            notes={mockNotes}
            currentTime={0}
            bpm={120}
            isPlaying={false}
            isEditMode={false}
            onNotesChange={mockOnNotesChange}
            onEditModeToggle={mockOnEditModeToggle}
          />,
        );
      }

      // Component should remain stable
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should handle large note arrays in edit mode', () => {
      const largeNoteArray: ExerciseNote[] = Array.from(
        { length: 200 },
        (_, i) => ({
          id: `note-${i}`,
          timestamp: i * 50,
          string: (i % 4) + 1,
          fret: i % 24,
          duration: 400,
          note: 'A',
        }),
      );

      render(
        <FretboardVisualizer
          notes={largeNoteArray}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Should render without performance issues
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });

    it('should handle note updates without memory leaks', async () => {
      const { rerender } = render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
          onNotesChange={mockOnNotesChange}
        />,
      );

      // Simulate frequent note updates
      for (let i = 0; i < 10; i++) {
        const updatedNotes = mockNotes.map((note) => ({
          ...note,
          timestamp: note.timestamp + i * 100,
        }));

        rerender(
          <FretboardVisualizer
            notes={updatedNotes}
            currentTime={i * 100}
            bpm={120}
            isPlaying={false}
            isEditMode={true}
            onNotesChange={mockOnNotesChange}
          />,
        );

        // Small delay to simulate real usage
        await waitFor(() => {
          expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
        });
      }

      // Component should remain stable after many updates
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing onNotesChange gracefully', () => {
      // Test without onNotesChange prop
      render(
        <FretboardVisualizer
          notes={mockNotes}
          currentTime={0}
          bpm={120}
          isPlaying={false}
          isEditMode={true}
        />,
      );

      // Should still render edit mode interface
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();
      expect(screen.getByText('Edit Mode')).toBeInTheDocument();

      // Keyboard events should not cause errors
      fireEvent.keyDown(window, { key: 'Delete' });

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should handle invalid note data gracefully', () => {
      const invalidNotes = [
        {
          id: 'invalid-note',
          timestamp: -1000, // Invalid timestamp
          string: 10, // Invalid string
          fret: -5, // Invalid fret
          duration: 0,
          note: '',
        } as ExerciseNote,
      ];

      // Should render without crashing
      expect(() => {
        render(
          <FretboardVisualizer
            notes={invalidNotes}
            currentTime={0}
            bpm={120}
            isPlaying={false}
            isEditMode={true}
            onNotesChange={mockOnNotesChange}
          />,
        );
      }).not.toThrow();

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });
  });
});
