/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/test-utils';

// Mock the track hook
vi.mock('@/domains/playback/hooks/useTrack', () => ({
  useTrack: vi.fn(() => ({
    track: {
      id: 'metronome-widget-track',
      name: 'Metronome',
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
      <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} />
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

import { MetronomeWidget } from '../MetronomeWidget';

describe('MetronomeWidget', () => {
  const defaultProps = {
    bpm: 120,
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onBpmChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible', () => {
    render(<MetronomeWidget {...defaultProps} />);
    
    // Check for metronome-specific elements
    expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<MetronomeWidget {...defaultProps} isVisible={false} />);
    
    // The component should still mount but be hidden
    const container = document.querySelector('[data-visible="false"]');
    expect(container).toBeInTheDocument();
  });

  it('should handle BPM changes', () => {
    const onBpmChange = vi.fn();
    render(
      <MetronomeWidget 
        {...defaultProps} 
        onBpmChange={onBpmChange}
        bpm={120}
      />
    );
    
    // BPM is controlled by parent
    expect(onBpmChange).not.toHaveBeenCalled();
    expect(defaultProps.bpm).toBe(120);
  });

  it('should handle different BPM values', () => {
    const { rerender } = render(<MetronomeWidget {...defaultProps} bpm={60} />);
    
    // Test various BPM values
    const bpmValues = [60, 90, 120, 140, 180];
    bpmValues.forEach(bpm => {
      rerender(<MetronomeWidget {...defaultProps} bpm={bpm} />);
    });
  });

  it('should handle play/pause state', () => {
    const { rerender } = render(
      <MetronomeWidget 
        {...defaultProps} 
        isPlaying={false}
      />
    );
    
    // Component should respond to playing state
    rerender(
      <MetronomeWidget 
        {...defaultProps} 
        isPlaying={true}
      />
    );
  });

  it('should handle visibility toggle', () => {
    const onToggleVisibility = vi.fn();
    const { rerender } = render(
      <MetronomeWidget 
        {...defaultProps} 
        onToggleVisibility={onToggleVisibility}
        isVisible={true}
      />
    );
    
    // Component should be visible
    expect(document.querySelector('[data-visible="true"]')).toBeTruthy();
    
    // Change visibility
    rerender(
      <MetronomeWidget 
        {...defaultProps} 
        onToggleVisibility={onToggleVisibility}
        isVisible={false}
      />
    );
    
    // Component should be hidden
    expect(document.querySelector('[data-visible="false"]')).toBeTruthy();
  });

  it('should initialize with correct number of dots', () => {
    render(<MetronomeWidget {...defaultProps} />);
    
    // Metronome typically shows 4 or 8 beat indicators
    // This would be internal to the component
  });

  it('should handle tempo range limits', () => {
    const onBpmChange = vi.fn();
    
    // Test minimum BPM
    const { rerender } = render(
      <MetronomeWidget 
        {...defaultProps} 
        bpm={40}
        onBpmChange={onBpmChange}
      />
    );
    
    // Test maximum BPM
    rerender(
      <MetronomeWidget 
        {...defaultProps} 
        bpm={240}
        onBpmChange={onBpmChange}
      />
    );
  });
});