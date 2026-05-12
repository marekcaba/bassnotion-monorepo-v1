import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { HarmonyWidget } from '../../HarmonyWidget/index.js';

// Mock TransportContext
vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportControls: () => ({
    tempo: 120,
    isPlaying: false,
    isPaused: false,
    isStopped: true,
    setTempo: vi.fn(),
    timeSignature: { numerator: 4, denominator: 4 },
    servicesReady: true,
  }),
}));

// Mock SyncContext - path relative to HarmonyWidget location
vi.mock('@/domains/widgets/components/base/SyncProvider.js', () => ({
  useSyncContext: () => ({
    subscribeToEvent: vi.fn(),
    publishEvent: vi.fn(),
  }),
}));

// Mock useVisualBeat
vi.mock('@/domains/widgets/hooks/useVisualBeat', () => ({
  useVisualBeat: () => ({
    beatIndex: 0,
    measureIndex: 0,
    isCountdown: false,
  }),
}));

// Mock useMeasureSync
vi.mock('@/domains/widgets/hooks/useBeatGridSync', () => ({
  useMeasureSync: () => ({
    registerChordIndicator: vi.fn(),
  }),
}));

// Mock correlation hook
vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: () => ({
    correlationId: 'test-correlation-id',
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }),
}));

// Mock lifecycle
vi.mock('@/domains/playback/utils/InitializationLifecycleLogger.js', () => ({
  lifecycle: {
    checkpoint: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('@/domains/playback/hooks/useTrack', () => ({
  useTrack: () => ({
    track: {
      id: 'harmony-widget-track',
      state: 'ready',
      audioContext: new AudioContext(),
      isPlaying: false,
    },
    isReady: true,
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  }),
}));

vi.mock('@/domains/playback/utils/ensureAudioContext', () => ({
  ensureAudioContext: vi.fn(),
  withAudioContext: (fn: Function) => fn,
}));

// Mock the GlobalSampleCache
vi.mock('@/domains/playback/modules/storage/cache/GlobalSampleCache', () => ({
  GlobalSampleCache: {
    getCachedInstrument: vi.fn().mockReturnValue(null),
    getCachedInstrumentNames: vi.fn().mockReturnValue([]),
    hasInstrument: vi.fn().mockReturnValue(false),
    getStats: vi.fn().mockReturnValue({
      samplesCount: 0,
      instrumentsCount: 0,
      totalSize: 0,
    }),
  },
}));

// Mock UI components
vi.mock('../VolumeKnob', () => ({
  VolumeKnob: () => <div data-testid="volume-knob">Volume Knob</div>,
}));

vi.mock('../ChordSlotSelector', () => ({
  ChordSlotSelector: () => (
    <div data-testid="chord-slot-selector">Chord Slot Selector</div>
  ),
}));

vi.mock('../ProfessionalKeyboardSelector', () => ({
  ProfessionalKeyboardSelector: () => (
    <div data-testid="keyboard-selector">Keyboard Selector</div>
  ),
}));

describe('HarmonyWidget Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the harmony widget', async () => {
    const props = {
      progression: ['C', 'Am', 'F', 'G'],
      currentChord: 0,
      isPlaying: false,
      isVisible: true,
      onNextChord: vi.fn(),
      onProgressionChange: vi.fn(),
      onToggleVisibility: vi.fn(),
    };

    render(<HarmonyWidget {...props} />);

    // Should render the widget
    expect(screen.getByText('Harmony Track')).toBeInTheDocument();
  });

  it('should check for pre-loaded instruments on mount', async () => {
    const { GlobalSampleCache } =
      await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');

    const props = {
      progression: ['C'],
      currentChord: 0,
      isPlaying: false,
      isVisible: true,
      onNextChord: vi.fn(),
      onProgressionChange: vi.fn(),
      onToggleVisibility: vi.fn(),
    };

    render(<HarmonyWidget {...props} />);

    // Should check for pre-loaded instrument
    await waitFor(() => {
      expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith(
        'harmony-preloaded',
      );
    });
  });

  it('should not render when isVisible is false', () => {
    const props = {
      progression: ['C'],
      currentChord: 0,
      isPlaying: false,
      isVisible: false,
      onNextChord: vi.fn(),
      onProgressionChange: vi.fn(),
      onToggleVisibility: vi.fn(),
    };

    const { container } = render(<HarmonyWidget {...props} />);

    expect(container.firstChild).toBeNull();
  });
});
