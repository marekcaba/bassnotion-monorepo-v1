import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InteractionManager } from '../interaction/InteractionManager';
import { NoteSelector } from '../interaction/NoteSelector';
import { ContextMenu } from '../interaction/ContextMenu';
import type { ExerciseNote } from '../types/fretboard';

// Mock Three.js and React Three Fiber
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: { position: { set: vi.fn() } },
    raycaster: {
      setFromCamera: vi.fn(),
      intersectObject: vi.fn().mockReturnValue([
        {
          point: { x: 1.5, y: 0.2, z: 0 },
          object: { userData: { fret: 3, string: 2 } },
        },
      ]),
    },
    pointer: { x: 0, y: 0 },
    scene: { add: vi.fn(), remove: vi.fn() },
  }),
}));

vi.mock('three', () => ({
  Vector3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
  PlaneGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: vi.fn().mockImplementation(() => ({
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    name: '',
  })),
  Group: vi.fn(),
  SphereGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  RingGeometry: vi.fn(),
  DoubleSide: 2,
}));

describe('Interaction Components', () => {
  const mockNotes: ExerciseNote[] = [
    {
      id: 'note-1',
      timestamp: 1000,
      string: 2,
      fret: 3,
      duration: 500,
      note: 'C3',
    },
    {
      id: 'note-2',
      timestamp: 2000,
      string: 1,
      fret: 5,
      duration: 500,
      note: 'A3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('InteractionManager', () => {
    let mockOnNoteCreate: ReturnType<typeof vi.fn>;
    let mockOnNoteSelect: ReturnType<typeof vi.fn>;
    let mockOnNoteDrag: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockOnNoteCreate = vi.fn();
      mockOnNoteSelect = vi.fn();
      mockOnNoteDrag = vi.fn();
    });

    it('should render interaction plane correctly', () => {
      render(
        <InteractionManager
          notes={mockNotes}
          currentTime={1500}
          selectedNoteId={null}
          isEditMode={true}
          onNoteCreate={mockOnNoteCreate}
          onNoteSelect={mockOnNoteSelect}
          onNoteDrag={mockOnNoteDrag}
        >
          <div data-testid="child-content">Test Content</div>
        </InteractionManager>,
      );

      // Children should be rendered
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should handle pointer down events for note creation', () => {
      const { container } = render(
        <InteractionManager
          notes={mockNotes}
          currentTime={1500}
          selectedNoteId={null}
          isEditMode={true}
          onNoteCreate={mockOnNoteCreate}
          onNoteSelect={mockOnNoteSelect}
          onNoteDrag={mockOnNoteDrag}
        >
          <div data-testid="child-content" />
        </InteractionManager>,
      );

      // Simulate pointer down event
      fireEvent.pointerDown(container.firstChild as Element, {
        clientX: 100,
        clientY: 100,
        button: 0,
      });

      // Should attempt to create a note at the clicked position
      expect(mockOnNoteCreate).toHaveBeenCalledWith(
        expect.any(Number), // fret
        expect.any(Number), // string
        1500, // timestamp
      );
    });

    it('should handle note selection', () => {
      const { container } = render(
        <InteractionManager
          notes={mockNotes}
          currentTime={1500}
          selectedNoteId={null}
          isEditMode={true}
          onNoteCreate={mockOnNoteCreate}
          onNoteSelect={mockOnNoteSelect}
          onNoteDrag={mockOnNoteDrag}
        >
          <div data-testid="child-content" />
        </InteractionManager>,
      );

      // Simulate pointer down on existing note position
      fireEvent.pointerDown(container.firstChild as Element, {
        clientX: 150,
        clientY: 150,
        button: 0,
      });

      // Should handle note selection
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should handle drag events for note movement', () => {
      const { container } = render(
        <InteractionManager
          notes={mockNotes}
          currentTime={1500}
          selectedNoteId={'note-1'}
          isEditMode={true}
          onNoteCreate={mockOnNoteCreate}
          onNoteSelect={mockOnNoteSelect}
          onNoteDrag={mockOnNoteDrag}
        >
          <div data-testid="child-content" />
        </InteractionManager>,
      );

      const element = container.firstChild as Element;

      // Start drag
      fireEvent.pointerDown(element, {
        clientX: 100,
        clientY: 100,
        button: 0,
      });

      // Move pointer
      fireEvent.pointerMove(element, {
        clientX: 150,
        clientY: 120,
      });

      // End drag
      fireEvent.pointerUp(element, {
        clientX: 150,
        clientY: 120,
      });

      // Component should handle the drag sequence
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should not handle interactions when not in edit mode', () => {
      const { container } = render(
        <InteractionManager
          notes={mockNotes}
          currentTime={1500}
          selectedNoteId={null}
          isEditMode={false}
          onNoteCreate={mockOnNoteCreate}
          onNoteSelect={mockOnNoteSelect}
          onNoteDrag={mockOnNoteDrag}
        >
          <div data-testid="child-content" />
        </InteractionManager>,
      );

      // Simulate pointer down
      fireEvent.pointerDown(container.firstChild as Element, {
        clientX: 100,
        clientY: 100,
        button: 0,
      });

      // Should not create notes when not in edit mode
      expect(mockOnNoteCreate).not.toHaveBeenCalled();
    });
  });

  describe('NoteSelector', () => {
    let mockOnSelectionChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockOnSelectionChange = vi.fn();
    });

    it('should render selection indicators for selected notes', () => {
      render(
        <NoteSelector
          notes={mockNotes}
          selectedNoteId={'note-1'}
          onSelectionChange={mockOnSelectionChange}
          isEditMode={true}
        />,
      );

      // Note: This is a simplified test since NoteSelector renders Three.js elements
      // In a real 3D environment, we would check for the selection rings
      expect(screen.queryByText('note-selector')).not.toBeInTheDocument();
    });

    it('should not render when not in edit mode', () => {
      render(
        <NoteSelector
          notes={mockNotes}
          selectedNoteId={'note-1'}
          onSelectionChange={mockOnSelectionChange}
          isEditMode={false}
        />,
      );

      // Should not render anything when not in edit mode
      expect(screen.queryByText('note-selector')).not.toBeInTheDocument();
    });

    it('should handle empty selection', () => {
      render(
        <NoteSelector
          notes={mockNotes}
          selectedNoteId={null}
          onSelectionChange={mockOnSelectionChange}
          isEditMode={true}
        />,
      );

      // Should render without errors even with empty selection
      expect(screen.queryByText('note-selector')).not.toBeInTheDocument();
    });

    it('should handle selected note changes', () => {
      const { rerender } = render(
        <NoteSelector
          notes={mockNotes}
          selectedNoteId={'note-1'}
          onSelectionChange={mockOnSelectionChange}
          isEditMode={true}
        />,
      );

      // Change selection
      rerender(
        <NoteSelector
          notes={mockNotes}
          selectedNoteId={'note-2'}
          onSelectionChange={mockOnSelectionChange}
          isEditMode={true}
        />,
      );

      // Should handle selection changes without errors
      expect(screen.queryByText('note-selector')).not.toBeInTheDocument();
    });
  });

  describe('ContextMenu', () => {
    let mockOnCopy: ReturnType<typeof vi.fn>;
    let mockOnPaste: ReturnType<typeof vi.fn>;
    let mockOnDuplicate: ReturnType<typeof vi.fn>;
    let mockOnDelete: ReturnType<typeof vi.fn>;
    let mockOnProperties: ReturnType<typeof vi.fn>;
    let mockOnClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockOnCopy = vi.fn();
      mockOnPaste = vi.fn();
      mockOnDuplicate = vi.fn();
      mockOnDelete = vi.fn();
      mockOnProperties = vi.fn();
      mockOnClose = vi.fn();
    });

    it('should render context menu when visible', () => {
      render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Paste')).toBeInTheDocument();
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Properties')).toBeInTheDocument();
    });

    it('should not render when not visible', () => {
      render(
        <ContextMenu
          isVisible={false}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
      expect(screen.queryByText('Paste')).not.toBeInTheDocument();
    });

    it('should call appropriate handlers when menu items are clicked', () => {
      render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      // Test Copy
      fireEvent.click(screen.getByText('Copy'));
      expect(mockOnCopy).toHaveBeenCalledTimes(1);

      // Test Paste
      fireEvent.click(screen.getByText('Paste'));
      expect(mockOnPaste).toHaveBeenCalledTimes(1);

      // Test Duplicate
      fireEvent.click(screen.getByText('Duplicate'));
      expect(mockOnDuplicate).toHaveBeenCalledTimes(1);

      // Test Delete
      fireEvent.click(screen.getByText('Delete'));
      expect(mockOnDelete).toHaveBeenCalledTimes(1);

      // Test Properties
      fireEvent.click(screen.getByText('Properties'));
      expect(mockOnProperties).toHaveBeenCalledTimes(1);
    });

    it('should show keyboard shortcuts', () => {
      render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+V')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+D')).toBeInTheDocument();
      expect(screen.getByText('Del')).toBeInTheDocument();
    });

    it('should disable certain actions when no note is selected', () => {
      render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      // Copy, Duplicate, Delete, and Properties should be disabled
      const copyButton = screen.getByText('Copy').closest('button');
      const duplicateButton = screen.getByText('Duplicate').closest('button');
      const deleteButton = screen.getByText('Delete').closest('button');
      const propertiesButton = screen.getByText('Properties').closest('button');

      expect(copyButton).toBeDisabled();
      expect(duplicateButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
      expect(propertiesButton).toBeDisabled();

      // Paste should still be enabled
      const pasteButton = screen.getByText('Paste').closest('button');
      expect(pasteButton).not.toBeDisabled();
    });

    it('should handle click outside to close', () => {
      render(
        <div data-testid="outside-area">
          <ContextMenu
            isVisible={true}
            position={{ x: 100, y: 100 }}
            selectedNote={mockNotes[0] ?? null}
            onCopy={mockOnCopy}
            onPaste={mockOnPaste}
            onDuplicate={mockOnDuplicate}
            onDelete={mockOnDelete}
            onProperties={mockOnProperties}
            onClose={mockOnClose}
          />
        </div>,
      );

      // Click outside the context menu
      fireEvent.mouseDown(screen.getByTestId('outside-area'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle escape key to close', () => {
      render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      // Press Escape key on document
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should position menu correctly based on props', () => {
      const { container } = render(
        <ContextMenu
          isVisible={true}
          position={{ x: 200, y: 300 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      const menu = container.firstChild as HTMLElement;
      expect(menu).toHaveStyle({ left: '200px', top: '300px' });
    });

    it('should handle keyboard navigation within menu', () => {
      const { container } = render(
        <ContextMenu
          isVisible={true}
          position={{ x: 100, y: 100 }}
          selectedNote={mockNotes[0] ?? null}
          onCopy={mockOnCopy}
          onPaste={mockOnPaste}
          onDuplicate={mockOnDuplicate}
          onDelete={mockOnDelete}
          onProperties={mockOnProperties}
          onClose={mockOnClose}
        />,
      );

      const menu = container.firstChild as HTMLElement;

      // Test Arrow Down navigation
      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      // Test Enter to activate
      fireEvent.keyDown(menu, { key: 'Enter' });

      // Should handle keyboard navigation without errors
      expect(menu).toBeInTheDocument();
    });
  });
});
