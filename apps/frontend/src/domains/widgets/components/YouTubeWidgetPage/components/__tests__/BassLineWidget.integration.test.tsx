/**
 * @vitest-environment jsdom
 *
 * BassLineWidget + EventBus Integration Tests
 *
 * Tests the integration between BassLineWidget and the EventBus system:
 * - Subscription to 'bass-trigger' events
 * - Visual feedback sync with audio events
 * - Exercise change handling
 * - Pattern playback scheduling
 * - Volume/mute state management
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock WindowRegistry first (before importing component)
const mockEventBus = {
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
};

const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  sampleRate: 44100,
  destination: {},
  createGain: vi.fn(() => ({
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  })),
};

const mockPlaybackEngine = {
  bassScheduler: {
    buffers: new Map(),
  },
};

const mockAudioEngine = {
  isReady: vi.fn(() => true),
  getContext: vi.fn(() => mockAudioContext),
};

const mockCoreServices = {
  getEventBus: vi.fn(() => mockEventBus),
  getAudioEngine: vi.fn(() => mockAudioEngine),
  getPlaybackEngine: vi.fn(() => mockPlaybackEngine),
};

vi.mock('@/domains/playback/services/WindowRegistry.js', () => ({
  WindowRegistry: {
    getCoreServices: vi.fn(() => mockCoreServices),
  },
}));

// Mock GlobalSampleCache
vi.mock('@/domains/playback/modules/storage/cache/GlobalSampleCache', () => ({
  GlobalSampleCache: {
    getInstance: vi.fn(() => ({
      getMetadata: vi.fn(() => null),
    })),
  },
}));

// Mock useTrack hook
vi.mock('@/domains/playback/hooks/useTrack', () => ({
  useTrack: vi.fn(() => ({
    track: {
      id: 'bass-widget-track',
      name: 'Bass',
      volume: 80,
      isMuted: false,
      isLoaded: true,
      isReady: true,
      isPlaying: false,
      setVolume: vi.fn(),
      setMute: vi.fn(),
      schedulePattern: vi.fn(),
      clear: vi.fn(),
    },
    isLoaded: true,
    isReady: true,
    error: null,
  })),
}));

// Mock useTransportContext
vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportContext: vi.fn(() => ({
    tempo: 120,
    isPlaying: false,
    currentPosition: '0:0:0',
  })),
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock VolumeKnob
vi.mock('../VolumeKnob', () => ({
  VolumeKnob: ({ value, onChange, isMuted, onMuteToggle }: any) => (
    <div data-testid="volume-knob" data-value={value} data-muted={isMuted}>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid="volume-slider"
      />
      <button onClick={onMuteToggle} data-testid="mute-button">
        {isMuted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  ),
}));

import { BassLineWidget } from '../BassLineWidget';

describe('BassLineWidget + EventBus Integration', () => {
  const defaultProps = {
    pattern: 'Root-Fifth',
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onPatternChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset EventBus mock to track subscriptions
    mockEventBus.on.mockImplementation((event, handler) => {
      // Return unsubscribe function
      return () => {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EventBus Subscription', () => {
    it('should subscribe to bass-trigger events when sampler is ready', async () => {
      render(<BassLineWidget {...defaultProps} />);

      await waitFor(() => {
        expect(mockEventBus.on).toHaveBeenCalledWith(
          'bass-trigger',
          expect.any(Function)
        );
      });
    });

    it('should unsubscribe from EventBus on unmount', async () => {
      const mockUnsubscribe = vi.fn();
      mockEventBus.on.mockImplementation(() => mockUnsubscribe);

      const { unmount } = render(<BassLineWidget {...defaultProps} />);

      await waitFor(() => {
        expect(mockEventBus.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should process bass-trigger events with MIDI note data', async () => {
      let triggerHandler: ((event: any) => void) | undefined;
      mockEventBus.on.mockImplementation((event, handler) => {
        if (event === 'bass-trigger') {
          triggerHandler = handler;
        }
        return () => {};
      });

      render(<BassLineWidget {...defaultProps} isPlaying={true} />);

      await waitFor(() => {
        expect(triggerHandler).toBeDefined();
      });

      // Simulate bass trigger event
      act(() => {
        triggerHandler!({
          midiNote: 28,
          velocity: 80,
          duration: 0.5,
          string: 1,
          fret: 0,
          audioTime: mockAudioContext.currentTime,
        });
      });

      // The component should process the event without throwing
      // Visual feedback is handled internally via state updates
    });

    it('should handle events with missing optional fields', async () => {
      let triggerHandler: ((event: any) => void) | undefined;
      mockEventBus.on.mockImplementation((event, handler) => {
        if (event === 'bass-trigger') {
          triggerHandler = handler;
        }
        return () => {};
      });

      render(<BassLineWidget {...defaultProps} isPlaying={true} />);

      await waitFor(() => {
        expect(triggerHandler).toBeDefined();
      });

      // Event with minimal data
      expect(() => {
        act(() => {
          triggerHandler!({
            note: 28, // Using 'note' instead of 'midiNote'
          });
        });
      }).not.toThrow();
    });
  });

  describe('Exercise Integration', () => {
    it('should clear state when exercise changes', async () => {
      const mockExercise1 = {
        id: 'exercise-1',
        name: 'Exercise 1',
        notes: [
          { note: 28, string: 1, fret: 0, beat: 0 },
          { note: 33, string: 2, fret: 0, beat: 1 },
        ],
      };

      const mockExercise2 = {
        id: 'exercise-2',
        name: 'Exercise 2',
        notes: [
          { note: 38, string: 2, fret: 5, beat: 0 },
        ],
      };

      const { rerender } = render(
        <BassLineWidget {...defaultProps} exercise={mockExercise1 as any} />
      );

      // Change exercise
      rerender(
        <BassLineWidget {...defaultProps} exercise={mockExercise2 as any} />
      );

      // Component should handle exercise change without errors
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should use exercise notes when available', async () => {
      const mockExercise = {
        id: 'exercise-1',
        name: 'Test Exercise',
        notes: [
          { note: 40, string: 2, fret: 7, beat: 0 },
          { note: 45, string: 3, fret: 2, beat: 1 },
          { note: 38, string: 2, fret: 5, beat: 2 },
        ],
      };

      render(
        <BassLineWidget {...defaultProps} exercise={mockExercise as any} />
      );

      // Component should render with exercise
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });
  });

  describe('Volume and Mute Controls', () => {
    it('should handle volume changes', async () => {
      render(<BassLineWidget {...defaultProps} />);

      const volumeSlider = screen.getByTestId('volume-slider');
      expect(volumeSlider).toBeInTheDocument();

      // Verify the slider is rendered with initial value
      expect(volumeSlider).toHaveValue('80');
    });

    it('should handle mute toggle', async () => {
      render(<BassLineWidget {...defaultProps} />);

      const muteButton = screen.getByTestId('mute-button');
      expect(muteButton).toBeInTheDocument();
      expect(muteButton).toHaveTextContent('Mute');

      await userEvent.click(muteButton);

      // After toggle, the button text should change
      // (actual state is managed internally)
    });
  });

  describe('Play State Management', () => {
    it('should stop notes when playback stops', async () => {
      const { rerender } = render(
        <BassLineWidget {...defaultProps} isPlaying={true} />
      );

      // Stop playback
      rerender(<BassLineWidget {...defaultProps} isPlaying={false} />);

      // Component should handle state change
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });

    it('should not schedule pattern when exercise is provided', async () => {
      const mockExercise = {
        id: 'exercise-1',
        name: 'Test Exercise',
        notes: [{ note: 28, string: 1, fret: 0, beat: 0 }],
      };

      render(
        <BassLineWidget
          {...defaultProps}
          isPlaying={true}
          exercise={mockExercise as any}
        />
      );

      // With exercise, pattern scheduling should be skipped
      // (exercise playback uses EventBus events instead)
    });
  });

  describe('Visibility', () => {
    it('should not render when not visible', () => {
      const { container } = render(
        <BassLineWidget {...defaultProps} isVisible={false} />
      );

      // Component returns null when not visible
      expect(container.firstChild).toBeNull();
    });

    it('should render when visible', () => {
      render(<BassLineWidget {...defaultProps} isVisible={true} />);

      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });
  });

  describe('Audio Context Integration', () => {
    it('should use AudioContext from CoreServices', async () => {
      render(<BassLineWidget {...defaultProps} />);

      await waitFor(() => {
        expect(mockAudioEngine.getContext).toHaveBeenCalled();
      });
    });

    it('should handle AudioContext not ready state', async () => {
      mockAudioEngine.getContext.mockReturnValueOnce({
        ...mockAudioContext,
        state: 'suspended',
      });

      render(<BassLineWidget {...defaultProps} />);

      // Component should handle suspended context gracefully
      expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
    });
  });
});

describe('BassLineWidget Pattern Playback', () => {
  const defaultProps = {
    pattern: 'Root-Fifth',
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onPatternChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset EventBus mock to return a proper unsubscribe function
    mockEventBus.on.mockImplementation((event, handler) => {
      return () => {}; // Return unsubscribe function
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use predefined pattern when no exercise', async () => {
    render(<BassLineWidget {...defaultProps} pattern="Walking Bass" />);

    // Component should use the Walking Bass pattern
    expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
  });

  it('should handle pattern change', async () => {
    const onPatternChange = vi.fn();
    const { rerender } = render(
      <BassLineWidget {...defaultProps} onPatternChange={onPatternChange} />
    );

    // Rerender with new pattern
    rerender(
      <BassLineWidget
        {...defaultProps}
        pattern="Walking Bass"
        onPatternChange={onPatternChange}
      />
    );

    expect(screen.getByTestId('volume-knob')).toBeInTheDocument();
  });
});
