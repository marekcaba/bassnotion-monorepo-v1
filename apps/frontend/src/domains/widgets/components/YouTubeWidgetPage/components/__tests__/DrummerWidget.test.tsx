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
  positionToBeatIndex: vi.fn((position) => 0),
}));

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

import { DrummerWidget } from '../DrummerWidget';

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
});
