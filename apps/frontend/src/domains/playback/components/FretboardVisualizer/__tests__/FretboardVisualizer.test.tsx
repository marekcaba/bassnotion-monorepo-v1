import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FretboardVisualizer } from '../FretboardVisualizer';
import { ExerciseNote } from '../types/fretboard';

// Mock Three.js and React Three Fiber
vi.mock('three', () => ({
  default: {},
  Vector3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setFromPoints: vi.fn(),
    translate: vi.fn(),
  })),
  SphereGeometry: vi.fn(),
  PlaneGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  CylinderGeometry: vi.fn(),
  ShapeGeometry: vi.fn(),
  Shape: vi.fn().mockImplementation(() => ({
    moveTo: vi.fn(),
    lineTo: vi.fn(),
  })),
  QuadraticBezierCurve3: vi.fn().mockImplementation(() => ({
    getPoints: vi.fn().mockReturnValue([]),
  })),
  MeshStandardMaterial: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  LineBasicMaterial: vi.fn(),
  Color: vi.fn(),
  Line: vi.fn(),
  Group: vi.fn(),
  Mesh: vi.fn(),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(),
  PointLight: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="three-canvas">{children}</div>
  ),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: () => <div data-testid="perspective-camera" />,
}));

// Mock child components
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

describe('FretboardVisualizer', () => {
  const mockNotes: ExerciseNote[] = [
    {
      id: 'note-1',
      timestamp: 0,
      string: 1,
      fret: 0,
      duration: 500,
      note: 'E',
    },
    {
      id: 'note-2',
      timestamp: 1000,
      string: 2,
      fret: 2,
      duration: 500,
      note: 'B',
    },
    {
      id: 'note-3',
      timestamp: 2000,
      string: 3,
      fret: 0,
      duration: 500,
      note: 'D',
      technique: 'hammer_on',
    },
  ];

  const defaultProps = {
    notes: mockNotes,
    currentTime: 0,
    bpm: 120,
    isPlaying: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the main container', () => {
      render(<FretboardVisualizer {...defaultProps} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should render all core 3D components', () => {
      render(<FretboardVisualizer {...defaultProps} />);

      expect(screen.getByTestId('fretboard-3d')).toBeInTheDocument();
      expect(screen.getByTestId('note-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('technique-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('camera-controls')).toBeInTheDocument();
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
      expect(screen.getByTestId('perspective-camera')).toBeInTheDocument();
    });

    it('should render performance indicator in development', () => {
      vi.stubGlobal('process', { env: { NODE_ENV: 'development' } });

      render(<FretboardVisualizer {...defaultProps} />);

      expect(screen.getByText('3D Fretboard Visualizer')).toBeInTheDocument();

      vi.unstubAllGlobals();
    });

    it('should not render performance indicator in production', () => {
      vi.stubGlobal('process', { env: { NODE_ENV: 'production' } });

      render(<FretboardVisualizer {...defaultProps} />);

      expect(
        screen.queryByText('3D Fretboard Visualizer'),
      ).not.toBeInTheDocument();

      vi.unstubAllGlobals();
    });
  });

  describe('Settings Integration', () => {
    it('should render settings button when onSettingsClick is provided', () => {
      const mockOnSettingsClick = vi.fn();

      render(
        <FretboardVisualizer
          {...defaultProps}
          onSettingsClick={mockOnSettingsClick}
        />,
      );

      const settingsButton = screen.getByLabelText('Fretboard Settings');
      expect(settingsButton).toBeInTheDocument();
    });

    it('should not render settings button when onSettingsClick is not provided', () => {
      render(<FretboardVisualizer {...defaultProps} />);

      expect(
        screen.queryByLabelText('Fretboard Settings'),
      ).not.toBeInTheDocument();
    });

    it('should call onSettingsClick when settings button is clicked', () => {
      const mockOnSettingsClick = vi.fn();

      render(
        <FretboardVisualizer
          {...defaultProps}
          onSettingsClick={mockOnSettingsClick}
        />,
      );

      const settingsButton = screen.getByLabelText('Fretboard Settings');
      settingsButton.click();

      expect(mockOnSettingsClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Props Handling', () => {
    it('should handle empty notes array', () => {
      render(<FretboardVisualizer {...defaultProps} notes={[]} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should handle different BPM values', () => {
      render(<FretboardVisualizer {...defaultProps} bpm={140} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should handle playing state', () => {
      render(<FretboardVisualizer {...defaultProps} isPlaying={true} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should handle current time updates', () => {
      render(<FretboardVisualizer {...defaultProps} currentTime={5000} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });
  });

  describe('Canvas Configuration', () => {
    it('should configure canvas with proper settings', () => {
      render(<FretboardVisualizer {...defaultProps} />);

      const canvas = screen.getByTestId('three-canvas');
      expect(canvas).toBeInTheDocument();
      // Note: Testing internal Canvas props would require more complex mocking
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const mockOnSettingsClick = vi.fn();

      render(
        <FretboardVisualizer
          {...defaultProps}
          onSettingsClick={mockOnSettingsClick}
        />,
      );

      const settingsButton = screen.getByLabelText('Fretboard Settings');
      expect(settingsButton).toHaveAttribute(
        'aria-label',
        'Fretboard Settings',
      );
    });
  });

  describe('Performance Considerations', () => {
    it('should render without performance issues for large note arrays', () => {
      const largeNoteArray: ExerciseNote[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `note-${i}`,
          timestamp: i * 100,
          string: (i % 4) + 1,
          fret: i % 24,
          duration: 500,
          note: 'E',
        }),
      );

      render(<FretboardVisualizer {...defaultProps} notes={largeNoteArray} />);

      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });
  });
});
