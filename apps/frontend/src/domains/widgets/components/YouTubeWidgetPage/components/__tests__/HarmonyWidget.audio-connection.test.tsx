import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HarmonyWidget } from '../../HarmonyWidget/index.js';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';

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

// Mock SyncContext
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

// Mock React components and hooks
vi.mock('../VolumeKnob', () => ({
  VolumeKnob: ({ value, onChange, onMuteToggle }: any) => (
    <div data-testid="volume-knob">
      <span>Volume: {value}</span>
      <button onClick={() => onChange(50)}>Set 50</button>
      <button onClick={onMuteToggle}>Toggle Mute</button>
    </div>
  ),
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

// Mock dependencies
vi.mock('@/domains/playback/hooks/useTrack');
vi.mock('@/domains/playback/utils/ensureAudioContext');

// Mock dynamic imports - GlobalSampleCache
vi.mock('@/domains/playback/modules/storage/cache/GlobalSampleCache', () => ({
  GlobalSampleCache: {
    getCachedInstrument: vi.fn(),
    getCachedInstrumentNames: vi.fn().mockReturnValue([]),
    hasInstrument: vi.fn().mockReturnValue(false),
    setCachedInstrument: vi.fn(),
    getCachedUrl: vi.fn().mockReturnValue(null),
    getCachedBuffer: vi.fn().mockReturnValue(null),
    getStats: vi.fn().mockReturnValue({
      samplesCount: 0,
      instrumentsCount: 0,
      totalSize: 0,
    }),
    cacheInstrument: vi.fn(),
  },
}));

// Mock WamKeyboard module
vi.mock(
  '@/domains/playback/modules/instruments/adapters/wam/WamKeyboard',
  () => ({
    default: class MockWamKeyboard {
      static async createInstance(context: AudioContext) {
        return new MockWamKeyboard(context);
      }

      audioContext: AudioContext;
      audioNode: any;

      constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
      }

      async createAudioNode() {
        return mockWamKeyboardNode;
      }
    },
  }),
);

// Mock AudioContext constructor if not in browser environment
if (typeof AudioContext === 'undefined') {
  global.AudioContext = class MockAudioContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    createGain() {
      return {};
    }
    createOscillator() {
      return {};
    }
    resume() {
      return Promise.resolve();
    }
  } as any;
}

// Create a proper mock AudioContext
const createMockAudioContext = () => {
  const mockGainNode = {
    gain: { value: 0.8 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    numberOfInputs: 1,
    numberOfOutputs: 1,
    context: null as any,
  };

  const mockDestination = {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockContext = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: mockDestination,
    createGain: vi.fn(() => {
      mockGainNode.context = mockContext;
      return mockGainNode;
    }),
    createOscillator: vi.fn(() => ({
      frequency: { value: 440 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    resume: vi.fn().mockResolvedValue(undefined),
  };

  // Make mockContext appear to be an AudioContext instance
  Object.setPrototypeOf(mockContext, AudioContext.prototype);

  return { mockContext, mockGainNode, mockDestination };
};

// Mock WamKeyboardNode
const mockWamKeyboardNode = {
  gainNode: null as any,
  context: null as any,
  _isConnected: false,
  activeSampler: null as any,
  currentInstrument: 'grandpiano',

  connect: vi.fn(function (this: any, destination: AudioNode) {
    this._isConnected = true;
    if (this.gainNode) {
      this.gainNode.connect(destination);
    }
    return this;
  }),

  disconnect: vi.fn(function (this: any) {
    this._isConnected = false;
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
  }),

  initialize: vi.fn(async function (this: any) {
    if (this.context) {
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.8;
    }
  }),

  loadInstrument: vi.fn(async function (this: any, instrument: string) {
    this.currentInstrument = instrument;
    // Mock sampler
    this.activeSampler = {
      triggerAttackRelease: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getStatus: () => ({ loadedLayers: ['v10'], isReady: true }),
      destination: this.gainNode,
    };
    return Promise.resolve();
  }),

  setParameterValues: vi.fn().mockResolvedValue(undefined),
  clearEvents: vi.fn(),
  triggerNote: vi.fn(function (
    this: any,
    note: number,
    velocity: number,
    time?: number,
  ) {
    if (this.activeSampler) {
      const noteName =
        ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][
          note % 12
        ] + Math.floor(note / 12 - 1);
      this.activeSampler.triggerAttackRelease(
        noteName,
        2,
        time,
        velocity / 127,
      );
    }
  }),
  releaseNote: vi.fn(),
};

// Mock Tone.js
const mockTone = {
  context: {
    state: 'running',
    _context: null as any,
    rawContext: null as any,
  },
  Destination: {
    volume: { value: 0 },
    mute: false,
    _internalChannels: [],
    _volume: null,
    input: null,
  },
  Master: {
    volume: { value: 0 },
    mute: false,
  },
  start: vi.fn().mockResolvedValue(undefined),
};

// Create mock plugin wrapper for PluginManager
const createMockPluginWrapper = (audioNode: any) => ({
  state: 'active',
  getWamKeyboard: vi.fn(() => ({ audioNode })),
});

// Create mock PluginManager
const createMockPluginManager = (mockNode: any) => {
  const pluginWrapper = createMockPluginWrapper(mockNode);
  return {
    getPlugin: vi.fn(() => pluginWrapper),
    loadPlugin: vi.fn().mockResolvedValue(undefined),
    activatePlugin: vi.fn().mockResolvedValue(undefined),
  };
};

describe('HarmonyWidget - Audio Connection Tests', () => {
  const { mockContext, mockGainNode, mockDestination } =
    createMockAudioContext();

  let mockPluginManager: ReturnType<typeof createMockPluginManager>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock node state
    mockWamKeyboardNode.context = mockContext;
    mockWamKeyboardNode.gainNode = null;
    mockWamKeyboardNode._isConnected = false;
    mockWamKeyboardNode.activeSampler = null;
    mockWamKeyboardNode.currentInstrument = 'grandpiano';

    // Create fresh PluginManager mock
    mockPluginManager = createMockPluginManager(mockWamKeyboardNode);

    // Set up window mocks for CoreServices and WindowRegistry
    (window as any).Tone = mockTone;

    const mockCoreServices = {
      isReady: () => true,
      initialize: vi.fn().mockResolvedValue(undefined),
      getAudioEngine: () => ({
        isReady: () => true,
        getContext: () => mockContext,
        getTone: () => mockTone,
      }),
      getPluginManager: () => mockPluginManager,
    };

    // Set both new and legacy window globals for WindowRegistry
    (window as any).__bassnotion_coreServices = mockCoreServices;
    (window as any).__globalCoreServices = mockCoreServices;
    (window as any).__bassnotion_samplesReady = true;
    (window as any).__samplesReady = true;

    // Mock WindowRegistry static methods
    const WindowRegistry =
      await import('@/domains/playback/services/WindowRegistry.js');
    vi.spyOn(WindowRegistry.WindowRegistry, 'getCoreServices').mockReturnValue(
      mockCoreServices,
    );
    vi.spyOn(WindowRegistry.WindowRegistry, 'getSamplesReady').mockReturnValue(
      true,
    );

    // Set up GlobalSampleCache mock
    const { GlobalSampleCache } =
      await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation(() => {
      return null;
    });
    vi.mocked(GlobalSampleCache.getCachedInstrumentNames).mockReturnValue([]);
    vi.mocked(GlobalSampleCache.hasInstrument).mockReturnValue(false);

    // Mock useTrack hook
    vi.mocked(useTrack).mockReturnValue({
      track: {
        id: 'harmony-widget-track',
        state: 'ready',
        audioContext: mockContext,
        isPlaying: false,
      } as any,
      isReady: true,
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
    } as any);

    // Mock ensureAudioContext
    vi.mocked(withAudioContext).mockImplementation((fn: Function) => fn);

    // Connect mock nodes properly
    mockTone.context._context = mockContext;
    mockTone.context.rawContext = mockContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).Tone;
    delete (window as any).__globalCoreServices;
    delete (window as any).__bassnotion_coreServices;
    delete (window as any).__bassnotion_samplesReady;
    delete (window as any).__samplesReady;
  });

  describe('Audio Context Connection', () => {
    it('should properly connect WAM plugin to audio context destination via PluginManager', async () => {
      // Set plugin state to 'loaded' so activation will be called
      const loadedPluginWrapper = {
        state: 'loaded',
        getWamKeyboard: vi.fn(() => ({ audioNode: mockWamKeyboardNode })),
      };
      mockPluginManager.getPlugin.mockReturnValue(loadedPluginWrapper);

      const props = {
        progression: ['C', 'Am', 'F', 'G'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Wait for plugin initialization via PluginManager
      await waitFor(
        () => {
          expect(mockPluginManager.getPlugin).toHaveBeenCalledWith(
            'wam-keyboard',
          );
        },
        { timeout: 3000 },
      );

      // Verify the plugin was activated (state was 'loaded' so activatePlugin should be called)
      await waitFor(() => {
        expect(mockPluginManager.activatePlugin).toHaveBeenCalled();
      });
    });

    it('should handle suspended audio context properly', async () => {
      // Set context to suspended
      mockContext.state = 'suspended';

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should still attempt to initialize even with suspended context
      // The hook allows plugin creation with suspended context (for autoplay policy)
      await waitFor(
        () => {
          // Component should render without crashing
          expect(screen.getByText('Harmony Track')).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Reset context state for other tests
      mockContext.state = 'running';
    });
  });

  describe('PluginManager Integration', () => {
    it('should use pre-loaded harmony instrument when available', async () => {
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');

      const preloadedInstrument = {
        audioNode: mockWamKeyboardNode,
      };

      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(
        preloadedInstrument,
      );

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should check for cached instrument
      await waitFor(() => {
        expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith(
          'harmony-preloaded',
        );
      });
    });

    it('should get plugin from PluginManager when no pre-loaded instrument exists', async () => {
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should check cache first
      await waitFor(() => {
        expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith(
          'harmony-preloaded',
        );
      });

      // Then get plugin from PluginManager
      await waitFor(
        () => {
          expect(mockPluginManager.getPlugin).toHaveBeenCalledWith(
            'wam-keyboard',
          );
        },
        { timeout: 3000 },
      );
    });

    it('should load and activate plugin via PluginManager', async () => {
      // Set plugin state to unloaded to test full lifecycle
      const unloadedPluginWrapper = {
        state: 'unloaded',
        getWamKeyboard: vi.fn(() => ({ audioNode: mockWamKeyboardNode })),
      };
      mockPluginManager.getPlugin.mockReturnValue(unloadedPluginWrapper);

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      await waitFor(
        () => {
          expect(mockPluginManager.getPlugin).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      // Should load the plugin since state is 'unloaded'
      await waitFor(
        () => {
          expect(mockPluginManager.loadPlugin).toHaveBeenCalledWith(
            'wam-keyboard',
          );
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle audio context creation failure gracefully', async () => {
      // Remove audio engine
      (window as any).__globalCoreServices = null;

      const WindowRegistry =
        await import('@/domains/playback/services/WindowRegistry.js');
      vi.spyOn(
        WindowRegistry.WindowRegistry,
        'getCoreServices',
      ).mockReturnValue(null);

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should still render without crashing
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();
    });

    it('should handle PluginManager not available', async () => {
      // CoreServices without PluginManager
      (window as any).__globalCoreServices = {
        isReady: () => true,
        initialize: vi.fn().mockResolvedValue(undefined),
        getAudioEngine: () => ({
          isReady: () => true,
          getContext: () => mockContext,
        }),
        getPluginManager: () => null,
      };

      const WindowRegistry =
        await import('@/domains/playback/services/WindowRegistry.js');
      vi.spyOn(
        WindowRegistry.WindowRegistry,
        'getCoreServices',
      ).mockReturnValue((window as any).__globalCoreServices);

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should still show UI without crashing
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();
    });

    it('should handle plugin getPlugin throwing error', async () => {
      mockPluginManager.getPlugin.mockImplementation(() => {
        throw new Error('Plugin not registered');
      });

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      render(<HarmonyWidget {...props} />);

      // Should still show UI
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clear events on unmount but keep plugin in cache', async () => {
      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        harmonyInstrument: 'grandpiano' as const,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      const { unmount } = render(<HarmonyWidget {...props} />);

      // Wait for plugin to be loaded
      await waitFor(
        () => {
          expect(mockPluginManager.getPlugin).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Initialize the node so clearEvents is available
      await mockWamKeyboardNode.initialize();

      // Unmount the component
      unmount();

      // Should clear events (plugin kept in cache for reuse)
      // Note: The refactored code clears events but does NOT disconnect
      // This is intentional - the plugin is kept in singleton cache
      await waitFor(() => {
        expect(mockWamKeyboardNode.clearEvents).toHaveBeenCalled();
      });
    });
  });

  describe('UI Rendering', () => {
    it('should render harmony widget with chord progression', async () => {
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

      // Should show the title
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();

      // Should show chord buttons in collapsed view - there may be multiple "C" so use getAllByText
      const chordButtons = screen.getAllByText('C');
      expect(chordButtons.length).toBeGreaterThan(0);
      expect(screen.getByText('Am')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should expand widget when clicking chord progression button', async () => {
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

      // Find the chord progression button (contains chord dots like Am, F, G)
      // It's the button that contains the chord progression display
      const allButtons = screen.getAllByRole('button');
      // Find the button that contains the chord progression (has Am text inside)
      const expandButton = allButtons.find((btn) =>
        btn.textContent?.includes('Am'),
      );

      expect(expandButton).toBeDefined();
      if (expandButton) {
        const user = userEvent.setup();
        await user.click(expandButton);

        // Should show expanded view with Test button
        await waitFor(() => {
          expect(screen.getByText('Test')).toBeInTheDocument();
        });
      }
    });
  });
});
