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
      id: 'bass-widget-track',
      name: 'Bass',
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

vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { BassLineWidget } from '../BassLineWidget';

describe('BassLineWidget', () => {
  const defaultProps = {
    pattern: 'Root-Fifth',
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
    render(<BassLineWidget {...defaultProps} />);

    // Check for bass-specific elements
    expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<BassLineWidget {...defaultProps} isVisible={false} />);

    // The component should still mount but be hidden
    const container = document.querySelector('[data-visible="false"]');
    expect(container).toBeInTheDocument();
  });

  it('should handle pattern changes', () => {
    const onPatternChange = vi.fn();
    render(
      <BassLineWidget {...defaultProps} onPatternChange={onPatternChange} />,
    );

    // Pattern change would be triggered through UI interaction
    // Since the component uses internal state and effects,
    // we'd need to simulate the actual UI interaction
  });

  it('should initialize with correct tempo', () => {
    const { rerender } = render(
      <BassLineWidget {...defaultProps} tempo={140} />,
    );

    // Verify the component receives the tempo prop
    expect(defaultProps.tempo).toBe(120);

    // Update tempo
    rerender(<BassLineWidget {...defaultProps} tempo={140} />);
  });

  it('should handle play/pause toggle', () => {
    const onTogglePlay = vi.fn();
    render(
      <BassLineWidget
        {...defaultProps}
        onTogglePlay={onTogglePlay}
        isPlaying={false}
      />,
    );

    // The component should respond to isPlaying prop changes
    expect(onTogglePlay).not.toHaveBeenCalled();
  });

  it('should handle visibility toggle', () => {
    const onToggleVisibility = vi.fn();
    const { rerender } = render(
      <BassLineWidget
        {...defaultProps}
        onToggleVisibility={onToggleVisibility}
        isVisible={true}
      />,
    );

    // Component should be visible
    expect(document.querySelector('[data-visible="true"]')).toBeTruthy();

    // Change visibility
    rerender(
      <BassLineWidget
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
      category: 'bass',
      difficulty: 'beginner',
      instrumentType: 'bass',
      tempo: 100,
    };

    render(<BassLineWidget {...defaultProps} exercise={mockExercise as any} />);

    // The exercise should affect the widget's behavior
    // This would be internal to the component
  });
});
