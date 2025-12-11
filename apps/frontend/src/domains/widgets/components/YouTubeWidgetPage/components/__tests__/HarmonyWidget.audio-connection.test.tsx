import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HarmonyWidget } from '../HarmonyWidget';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';

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

// Mock wamPluginSingleton to not check GlobalSampleCache
vi.mock('@/domains/widgets/utils/wamPluginSingleton', () => ({
  wamPluginSingleton: {
    getOrCreateKeyboardPlugin: vi.fn(),
  },
}));

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
        // Return our mock node
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

  loadInstrument: vi.fn(async function (this: any) {
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
    console.log('Mock triggerNote called:', { note, velocity, time });
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

describe('HarmonyWidget - Audio Connection Tests', () => {
  const { mockContext, mockGainNode, mockDestination } =
    createMockAudioContext();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up window mocks
    (window as any).Tone = mockTone;
    (window as any).__globalCoreServices = {
      getAudioEngine: () => ({
        isReady: () => true,
        getContext: () => mockContext,
        getTone: () => mockTone,
      }),
    };

    // Set up mock implementations
    // Import the mocks and clear them
    const { GlobalSampleCache } =
      await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockClear();
    vi.mocked(GlobalSampleCache.getCachedInstrumentNames).mockClear();
    vi.mocked(GlobalSampleCache.hasInstrument).mockClear();
    vi.mocked(wamPluginSingleton.getOrCreateKeyboardPlugin).mockClear();

    // By default, no pre-loaded instrument - ensure mock returns null
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation(() => {
      console.log(
        'Mock GlobalSampleCache.getCachedInstrument called - returning null',
      );
      return null;
    });
    vi.mocked(GlobalSampleCache.getCachedInstrumentNames).mockReturnValue([]);
    vi.mocked(GlobalSampleCache.hasInstrument).mockReturnValue(false);

    // Mock the plugin creation to be properly async
    vi.mocked(wamPluginSingleton.getOrCreateKeyboardPlugin).mockImplementation(
      async (context) => {
        // Store the context on the node
        mockWamKeyboardNode.context = context;

        // Simulate async plugin creation
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Return the mock plugin
        return {
          audioNode: mockWamKeyboardNode,
          createAudioNode: async () => {
            await mockWamKeyboardNode.initialize();
            return mockWamKeyboardNode;
          },
        } as any;
      },
    );

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
    mockWamKeyboardNode.context = mockContext;
    mockTone.context._context = mockContext;
    mockTone.context.rawContext = mockContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).Tone;
    delete (window as any).__globalCoreServices;
  });

  describe('Audio Context Connection', () => {
    it('should properly connect WAM plugin to audio context destination', async () => {
      const props = {
        progression: ['C', 'Am', 'F', 'G'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      console.log('Test: Rendering HarmonyWidget...');
      render(<HarmonyWidget {...props} />);

      // Component first checks for pre-loaded instrument
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');

      // Log mock call information
      console.log(
        'Test: Waiting for GlobalSampleCache.getCachedInstrument to be called...',
      );

      await waitFor(
        () => {
          const calls = vi.mocked(GlobalSampleCache.getCachedInstrument).mock
            .calls;
          console.log(
            'Test: GlobalSampleCache.getCachedInstrument calls:',
            calls,
          );
          expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith(
            'harmony-preloaded',
          );
        },
        { timeout: 3000 },
      );

      // Since no pre-loaded instrument, component should create plugin directly
      // The component uses WamKeyboard.createInstance directly, not wamPluginSingleton
      await waitFor(
        () => {
          // Check if mock was used
          expect(mockContext.createGain).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );

      // Since we mocked the plugin creation, simulate the initialization
      await mockWamKeyboardNode.initialize();

      // Now wait for the connection to happen
      await waitFor(() => {
        expect(mockWamKeyboardNode.connect).toHaveBeenCalledWith(
          mockContext.destination,
        );
      });

      // Verify the gain node was created and connected
      expect(mockContext.createGain).toHaveBeenCalled();
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockDestination);
    });

    it('should handle suspended audio context properly', async () => {
      // Set context to suspended
      mockContext.state = 'suspended';

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

      // Wait for plugin initialization attempt
      await waitFor(() => {
        expect(mockContext.resume).toHaveBeenCalled();
      });

      // Should still initialize after resume
      expect(mockWamKeyboardNode.initialize).toHaveBeenCalled();
    });

    it('should verify complete audio routing chain', async () => {
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

      // Wait for plugin to load
      await waitFor(() => {
        expect(wamPluginSingleton.getOrCreateKeyboardPlugin).toHaveBeenCalled();
      });

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Find the button that shows the chord progression (to expand the widget)
      // The button contains chord dots for the progression
      const expandButton = await screen.findByRole('button');
      const user = userEvent.setup();
      await user.click(expandButton);

      // Now find and click the Test button in expanded view
      const testButton = await screen.findByRole('button', { name: 'Test' });
      await user.click(testButton);

      // Verify the complete chain:
      // 1. WamKeyboardNode triggers note
      await waitFor(() => {
        expect(mockWamKeyboardNode.triggerNote).toHaveBeenCalledWith(
          60, // C3
          80, // velocity
          expect.any(Number), // time
        );
      });

      // 2. Sampler receives triggerAttackRelease
      expect(
        mockWamKeyboardNode.activeSampler.triggerAttackRelease,
      ).toHaveBeenCalledWith('C3', 2, expect.any(Number), expect.any(Number));

      // 3. Audio nodes are connected: Sampler → GainNode → Destination
      expect(mockWamKeyboardNode.activeSampler.destination).toBe(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockDestination);
    });
  });

  describe('Tone.js Integration', () => {
    it('should detect and handle Tone.js context mismatch', async () => {
      // Create a different context for Tone
      const toneContext = { ...mockContext, id: 'tone-context' };
      mockTone.context._context = toneContext;

      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      render(<HarmonyWidget {...props} />);

      // First expand the widget
      const expandButton = await screen.findByRole('button');
      const user = userEvent.setup();
      await user.click(expandButton);

      // Now find and click the Test button
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Test'));

      // Should detect context mismatch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL: Tone.js is using a different AudioContext!',
        ),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should ensure Tone.Destination is not muted', async () => {
      // Set Tone destination as muted
      mockTone.Destination.mute = true;
      mockTone.Destination.volume.value = -60; // Very quiet

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

      // First expand the widget
      const expandButton = await screen.findByRole('button');
      const user = userEvent.setup();
      await user.click(expandButton);

      // Now find and click the Test button
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Test'));

      // Should unmute and set proper volume
      expect(mockTone.Destination.mute).toBe(false);
      expect(mockTone.Destination.volume.value).toBe(0); // 0dB = unity gain
    });
  });

  describe('WAM Plugin Initialization', () => {
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

      // Should not create new plugin
      expect(
        wamPluginSingleton.getOrCreateKeyboardPlugin,
      ).not.toHaveBeenCalled();
    });

    it('should create new plugin when no pre-loaded instrument exists', async () => {
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);

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

      // Should check cache first
      await waitFor(() => {
        expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith(
          'harmony-preloaded',
        );
      });

      // Then create new plugin since cache returned null
      await waitFor(() => {
        expect(
          wamPluginSingleton.getOrCreateKeyboardPlugin,
        ).toHaveBeenCalledWith(mockContext);
      });

      expect(mockWamKeyboardNode.initialize).toHaveBeenCalled();
      expect(mockWamKeyboardNode.loadInstrument).toHaveBeenCalled();
    });
  });

  describe('Volume and Gain Control', () => {
    it('should properly set volume through gain node', async () => {
      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      const { rerender } = render(<HarmonyWidget {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      // Initial volume should be 80
      expect(mockWamKeyboardNode.setParameterValues).toHaveBeenCalledWith({
        volume: 0.8, // 80/100
      });

      // Change volume by adjusting the slider would trigger setParameterValues
      // This is internal to the component, so we verify the initial setup
      expect(mockGainNode.gain.value).toBe(0.8);
    });

    it('should handle mute state correctly', async () => {
      mockGainNode.gain.value = 0; // Muted

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

      // First expand the widget
      const expandButton = await screen.findByRole('button');
      const user = userEvent.setup();
      await user.click(expandButton);

      // Now find and click the Test button
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Test'));

      // Should detect muted state and fix it
      expect(mockGainNode.gain.value).toBe(0.8);
    });
  });

  describe('Error Handling', () => {
    it('should handle audio context creation failure gracefully', async () => {
      // Remove audio engine
      (window as any).__globalCoreServices = null;

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

      // Should still render without crashing
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();
    });

    it('should handle plugin creation failure', async () => {
      vi.mocked(wamPluginSingleton.getOrCreateKeyboardPlugin).mockRejectedValue(
        new Error('Plugin creation failed'),
      );

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create WAM Keyboard plugin'),
          expect.any(Error),
        );
      });

      // Should still show UI
      expect(screen.getByText('Harmony Track')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should properly disconnect and clean up on unmount', async () => {
      const props = {
        progression: ['C'],
        currentChord: 0,
        isPlaying: false,
        isVisible: true,
        onNextChord: vi.fn(),
        onProgressionChange: vi.fn(),
        onToggleVisibility: vi.fn(),
      };

      const { unmount } = render(<HarmonyWidget {...props} />);

      // Wait for plugin to be created and initialized
      await waitFor(() => {
        expect(wamPluginSingleton.getOrCreateKeyboardPlugin).toHaveBeenCalled();
      });

      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now unmount the component
      unmount();

      // Should disconnect and clear events
      await waitFor(() => {
        expect(mockWamKeyboardNode.clearEvents).toHaveBeenCalled();
        expect(mockWamKeyboardNode.disconnect).toHaveBeenCalled();
      });
    });
  });
});
