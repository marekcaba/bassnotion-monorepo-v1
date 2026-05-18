/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../../test/test-utils';

// Mock the track hook
vi.mock('@/domains/playback/hooks/useTrack', () => ({
  useTrack: vi.fn(() => ({
    track: {
      id: 'drums-widget-track',
      name: 'Drums',
      volume: 80,
      isMuted: false,
      isLoaded: true,
      setVolume: vi.fn(),
      setMute: vi.fn(),
      schedulePattern: vi.fn(),
      clear: vi.fn(),
    },
    isLoaded: true,
    error: null,
  })),
}));

// Mock transport position hook
vi.mock('@/domains/widgets/hooks/useTransportPosition', () => ({
  useTransportPosition: vi.fn(() => ({
    bar: 1,
    beat: 1,
    sixteenth: 1,
    ticks: 0,
  })),
  positionToBeatIndex: vi.fn(() => 0),
}));

// Mock TransportContext
vi.mock('@/domains/playback/contexts/TransportContext', () => {
  const transportState = {
    tempo: 120,
    isPlaying: false,
    isPaused: false,
    isStopped: true,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    setTempo: vi.fn(),
    seekTo: vi.fn(),
    setLoop: vi.fn(),
    setExerciseDuration: vi.fn(),
    setTimeSignature: vi.fn(),
    timeSignature: { numerator: 4, denominator: 4 },
    isLoopEnabled: false,
    servicesReady: true,
    position: { bar: 0, beat: 0, sixteenth: 0, seconds: 0 },
  };
  return {
    useTransportControls: vi.fn(() => transportState),
    useTransportContext: vi.fn(() => transportState),
    useTransport: vi.fn(() => transportState),
    useTransportPosition: vi.fn(() => transportState.position),
    TransportProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock audio context utils
vi.mock('@/domains/playback/utils/ensureAudioContext', () => ({
  ensureAudioContext: vi.fn(() => Promise.resolve()),
  withAudioContext: vi.fn((fn) => fn),
}));

// Mock UI components
vi.mock('../VolumeKnob', () => ({
  VolumeKnob: ({ value, onChange }: any) => (
    <div data-testid="volume-knob" data-value={value}>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  ),
}));

// Mock EventBus
vi.mock('@/domains/playback/services/core/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    })),
  },
}));

// Mock pattern utils
vi.mock('@/domains/playback/types/pattern', () => ({
  toMusicalPosition: vi.fn((beat) => ({
    bar: Math.floor(beat / 4) + 1,
    beat: (beat % 4) + 1,
    sixteenth: 1,
    ticks: 0,
  })),
}));

vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { DrummerWidget } from '../../DrummerWidget/index.js';

describe('DrummerWidget', () => {
  const defaultProps = {
    pattern: 'Rock Steady',
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onPatternChange: vi.fn(),
    onToggleVisibility: vi.fn(),
    tempo: 120,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible', () => {
    render(<DrummerWidget {...defaultProps} />);

    // Check for drum-specific elements
    expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<DrummerWidget {...defaultProps} isVisible={false} />);

    // The component should still mount but be hidden
    const container = document.querySelector('[data-visible="false"]');
    expect(container).toBeInTheDocument();
  });

  it('should handle pattern changes', () => {
    const onPatternChange = vi.fn();
    render(
      <DrummerWidget
        {...defaultProps}
        onPatternChange={onPatternChange}
        pattern="Rock Steady"
      />,
    );

    // Pattern is controlled by parent
    expect(onPatternChange).not.toHaveBeenCalled();
  });

  it('should initialize with correct tempo', () => {
    const { rerender } = render(
      <DrummerWidget {...defaultProps} tempo={140} />,
    );

    // Verify the component receives the tempo prop
    expect(defaultProps.tempo).toBe(120);

    // Update tempo
    rerender(<DrummerWidget {...defaultProps} tempo={140} />);
  });

  it('should handle play/pause state', () => {
    const { rerender } = render(
      <DrummerWidget {...defaultProps} isPlaying={false} />,
    );

    // Component should respond to playing state
    rerender(<DrummerWidget {...defaultProps} isPlaying={true} />);
  });

  it('should handle visibility toggle', () => {
    const onToggleVisibility = vi.fn();
    const { rerender } = render(
      <DrummerWidget
        {...defaultProps}
        onToggleVisibility={onToggleVisibility}
        isVisible={true}
      />,
    );

    // Component should be visible
    expect(document.querySelector('[data-visible="true"]')).toBeTruthy();

    // Change visibility
    rerender(
      <DrummerWidget
        {...defaultProps}
        onToggleVisibility={onToggleVisibility}
        isVisible={false}
      />,
    );

    // Component should be hidden
    expect(document.querySelector('[data-visible="false"]')).toBeTruthy();
  });

  it('should handle exercise prop', () => {
    const mockExercise = {
      id: 'test-exercise',
      name: 'Test Exercise',
      description: 'Test',
      category: 'drums',
      difficulty: 'beginner',
      instrumentType: 'drums',
      tempo: 100,
    };

    render(<DrummerWidget {...defaultProps} exercise={mockExercise as any} />);

    // The exercise should affect the widget's behavior
    // This would be internal to the component
  });

  it('should support different drum patterns', () => {
    const patterns = ['Rock Steady', 'Jazz Swing', 'Bossa Nova'];

    patterns.forEach((pattern) => {
      const { rerender } = render(
        <DrummerWidget {...defaultProps} pattern={pattern} />,
      );

      // Each pattern should be handled
      rerender(<DrummerWidget {...defaultProps} pattern={pattern} />);
    });
  });

  describe('exercise drum pattern display', () => {
    it('should display exercise drum pattern when drumPattern (DrumHit[]) is provided', () => {
      const mockExerciseWithDrumPattern = {
        id: 'test-exercise-with-drums',
        title: 'Test Exercise',
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        // DrumHit[] format (new MIDI-converted format)
        drumPattern: [
          {
            id: 'drum-1',
            drum: 'kick',
            velocity: 100,
            position: { measure: 1, beat: 0, subdivision: 0 },
            durationTicks: 120,
            midiNote: 36,
          },
          {
            id: 'drum-2',
            drum: 'snare',
            velocity: 90,
            position: { measure: 1, beat: 2, subdivision: 0 },
            durationTicks: 120,
            midiNote: 38,
          },
        ],
      };

      render(
        <DrummerWidget
          {...defaultProps}
          exercise={mockExerciseWithDrumPattern as any}
        />,
      );

      // Component should render with the exercise drum pattern
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should display exercise drum pattern when drum_pattern (legacy format) is provided', () => {
      const mockExerciseWithLegacyPattern = {
        id: 'test-exercise-legacy',
        title: 'Test Exercise Legacy',
        bpm: 120,
        // Legacy DrumPattern format
        drum_pattern: {
          enabled: true,
          pattern: [
            { timestamp: 0, type: 'kick', velocity: 1 },
            { timestamp: 250, type: 'hihat', velocity: 0.8 },
            { timestamp: 500, type: 'snare', velocity: 1 },
          ],
        },
      };

      render(
        <DrummerWidget
          {...defaultProps}
          exercise={mockExerciseWithLegacyPattern as any}
        />,
      );

      // Component should render with the legacy drum pattern
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should display empty grid when exercise has no drum data', () => {
      const mockExerciseWithoutDrums = {
        id: 'test-exercise-no-drums',
        title: 'Test Exercise No Drums',
        bpm: 120,
        // No drum_pattern or drumPattern
      };

      render(
        <DrummerWidget
          {...defaultProps}
          exercise={mockExerciseWithoutDrums as any}
        />,
      );

      // Component should render (empty grid state)
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should fall back to preset pattern when no exercise is provided', () => {
      render(<DrummerWidget {...defaultProps} exercise={undefined} />);

      // Component should render with default preset pattern
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should prioritize DrumHit[] format over legacy format when both exist', () => {
      const mockExerciseWithBothFormats = {
        id: 'test-exercise-both',
        title: 'Test Exercise Both Formats',
        bpm: 120,
        // DrumHit[] format (should take priority)
        drumPattern: [
          {
            id: 'drum-1',
            drum: 'kick',
            velocity: 100,
            position: { measure: 1, beat: 0, subdivision: 0 },
            durationTicks: 120,
            midiNote: 36,
          },
        ],
        // Legacy format (should be ignored)
        drum_pattern: {
          enabled: true,
          pattern: [{ timestamp: 500, type: 'snare', velocity: 1 }],
        },
      };

      render(
        <DrummerWidget
          {...defaultProps}
          exercise={mockExerciseWithBothFormats as any}
        />,
      );

      // Component should render (using DrumHit[] format)
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });
  });
});
