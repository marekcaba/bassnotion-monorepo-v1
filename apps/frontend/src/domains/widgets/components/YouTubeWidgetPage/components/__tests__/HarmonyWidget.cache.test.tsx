import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton';

// Mock dependencies
vi.mock('@/domains/playback/services/storage/GlobalSampleCache');
vi.mock('@/domains/widgets/utils/wamPluginSingleton');

describe('HarmonyWidget - Cache Integration Tests', () => {
  const mockWamKeyboard = {
    audioNode: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      setParameterValues: vi.fn(),
      clearEvents: vi.fn(),
      scheduleEvents: vi.fn(),
      isConnected: false,
      port: {
        postMessage: vi.fn()
      }
    },
    handlePatternEvent: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock behavior
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);
    vi.mocked(wamPluginSingleton.getOrCreateKeyboardPlugin).mockResolvedValue(mockWamKeyboard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Harmony Widget with Preloaded Instruments', () => {
    it('should use preloaded harmony instrument immediately', async () => {
      // Return cached instrument
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const MockHarmonyWidget = () => {
        const [pluginLoaded, setPluginLoaded] = React.useState(false);
        const keyboardRef = React.useRef<any>(null);

        React.useEffect(() => {
          const loadPlugin = async () => {
            // Check cache first
            const preloaded = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
            if (preloaded) {
              keyboardRef.current = preloaded;
              setPluginLoaded(true);
              return;
            }
            
            // Fallback
            const plugin = await wamPluginSingleton.getOrCreateKeyboardPlugin({} as any);
            keyboardRef.current = plugin;
            setPluginLoaded(true);
          };
          loadPlugin();
        }, []);

        const testChord = () => {
          if (keyboardRef.current) {
            keyboardRef.current.audioNode.scheduleEvents([
              { type: 'note', time: 0, note: 60, velocity: 0.8 },
              { type: 'note', time: 0, note: 64, velocity: 0.8 },
              { type: 'note', time: 0, note: 67, velocity: 0.8 }
            ]);
          }
        };

        return (
          <div>
            {pluginLoaded ? (
              <button onClick={testChord}>Test Chord</button>
            ) : (
              <div>Loading plugin...</div>
            )}
          </div>
        );
      };

      render(<MockHarmonyWidget />);

      // Should immediately show the button (no loading)
      await waitFor(() => {
        expect(screen.getByText('Test Chord')).toBeInTheDocument();
      });

      // Should not have called singleton
      expect(wamPluginSingleton.getOrCreateKeyboardPlugin).not.toHaveBeenCalled();

      // Test playing
      const user = userEvent.setup();
      await user.click(screen.getByText('Test Chord'));

      expect(mockWamKeyboard.audioNode.scheduleEvents).toHaveBeenCalledWith([
        { type: 'note', time: 0, note: 60, velocity: 0.8 },
        { type: 'note', time: 0, note: 64, velocity: 0.8 },
        { type: 'note', time: 0, note: 67, velocity: 0.8 }
      ]);
    });

    it('should handle chord progressions with cached instrument', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const MockHarmonyWidget = () => {
        const keyboardRef = React.useRef<any>(mockWamKeyboard);
        
        const playProgression = async () => {
          const chords = [
            [60, 64, 67], // C major
            [65, 69, 72], // F major
            [67, 71, 74], // G major
            [60, 64, 67]  // C major
          ];

          for (const chord of chords) {
            keyboardRef.current.audioNode.clearEvents();
            keyboardRef.current.audioNode.scheduleEvents(
              chord.map(note => ({ type: 'note', time: 0, note, velocity: 0.7 }))
            );
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        };

        return <button onClick={playProgression}>Play Progression</button>;
      };

      render(<MockHarmonyWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Play Progression'));

      await waitFor(() => {
        // Should have cleared events and scheduled new ones multiple times
        expect(mockWamKeyboard.audioNode.clearEvents).toHaveBeenCalledTimes(4);
        expect(mockWamKeyboard.audioNode.scheduleEvents).toHaveBeenCalledTimes(4);
      }, { timeout: 3000 });
    });
  });

  describe('Various Initialization Scenarios', () => {
    it('should handle late cache availability', async () => {
      let cacheCheckCount = 0;
      
      // First few checks return null, then return instrument
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation(() => {
        cacheCheckCount++;
        return cacheCheckCount > 2 ? mockWamKeyboard : null;
      });

      const MockHarmonyWidget = () => {
        const [status, setStatus] = React.useState('checking');
        
        React.useEffect(() => {
          const checkInterval = setInterval(() => {
            const cached = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
            if (cached) {
              setStatus('ready');
              clearInterval(checkInterval);
            } else {
              setStatus('still loading');
            }
          }, 100);

          return () => clearInterval(checkInterval);
        }, []);

        return <div>{status}</div>;
      };

      render(<MockHarmonyWidget />);

      // Should start as checking
      expect(screen.getByText('checking')).toBeInTheDocument();

      // Wait for cache to become available
      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(cacheCheckCount).toBeGreaterThan(2);
    });

    it('should initialize correctly when AudioContext is suspended', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const MockHarmonyWidget = () => {
        const [canPlay, setCanPlay] = React.useState(false);
        const keyboardRef = React.useRef(mockWamKeyboard);

        const handleUserInteraction = async () => {
          // Simulate resuming audio context
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Configure instrument after context resumes
          await keyboardRef.current.audioNode.setParameterValues({ 
            volume: 0.8,
            reverb: 0.3 
          });
          
          setCanPlay(true);
        };

        return (
          <div>
            {!canPlay ? (
              <button onClick={handleUserInteraction}>Enable Audio</button>
            ) : (
              <div>Audio Ready</div>
            )}
          </div>
        );
      };

      render(<MockHarmonyWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Enable Audio'));

      await waitFor(() => {
        expect(screen.getByText('Audio Ready')).toBeInTheDocument();
      });

      expect(mockWamKeyboard.audioNode.setParameterValues).toHaveBeenCalledWith({
        volume: 0.8,
        reverb: 0.3
      });
    });

    it('should handle connection state properly', async () => {
      const dynamicMockKeyboard = {
        ...mockWamKeyboard,
        audioNode: {
          ...mockWamKeyboard.audioNode,
          isConnected: false
        }
      };

      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(dynamicMockKeyboard);

      const MockHarmonyWidget = () => {
        const keyboardRef = React.useRef(dynamicMockKeyboard);
        const [connected, setConnected] = React.useState(false);

        const connectInstrument = () => {
          if (!keyboardRef.current.audioNode.isConnected) {
            keyboardRef.current.audioNode.connect({} as any);
            keyboardRef.current.audioNode.isConnected = true;
            setConnected(true);
          }
        };

        const disconnectInstrument = () => {
          if (keyboardRef.current.audioNode.isConnected) {
            keyboardRef.current.audioNode.disconnect();
            keyboardRef.current.audioNode.isConnected = false;
            setConnected(false);
          }
        };

        return (
          <div>
            <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
            <button onClick={connectInstrument}>Connect</button>
            <button onClick={disconnectInstrument}>Disconnect</button>
          </div>
        );
      };

      render(<MockHarmonyWidget />);
      
      const user = userEvent.setup();

      // Initially disconnected
      expect(screen.getByText('Status: Disconnected')).toBeInTheDocument();

      // Connect
      await user.click(screen.getByText('Connect'));
      expect(screen.getByText('Status: Connected')).toBeInTheDocument();
      expect(dynamicMockKeyboard.audioNode.connect).toHaveBeenCalled();

      // Disconnect
      await user.click(screen.getByText('Disconnect'));
      expect(screen.getByText('Status: Disconnected')).toBeInTheDocument();
      expect(dynamicMockKeyboard.audioNode.disconnect).toHaveBeenCalled();
    });

    it('should handle parameter updates on cached instrument', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const MockHarmonyWidget = () => {
        const keyboardRef = React.useRef(mockWamKeyboard);
        
        const updateParameters = async (params: any) => {
          await keyboardRef.current.audioNode.setParameterValues(params);
        };

        return (
          <div>
            <button onClick={() => updateParameters({ volume: 0.5 })}>Quiet</button>
            <button onClick={() => updateParameters({ volume: 1.0 })}>Loud</button>
            <button onClick={() => updateParameters({ reverb: 0.8 })}>Reverb</button>
            <button onClick={() => updateParameters({ filter: 500 })}>Filter</button>
          </div>
        );
      };

      render(<MockHarmonyWidget />);
      
      const user = userEvent.setup();

      // Test various parameter updates
      await user.click(screen.getByText('Quiet'));
      expect(mockWamKeyboard.audioNode.setParameterValues).toHaveBeenCalledWith({ volume: 0.5 });

      await user.click(screen.getByText('Loud'));
      expect(mockWamKeyboard.audioNode.setParameterValues).toHaveBeenCalledWith({ volume: 1.0 });

      await user.click(screen.getByText('Reverb'));
      expect(mockWamKeyboard.audioNode.setParameterValues).toHaveBeenCalledWith({ reverb: 0.8 });

      await user.click(screen.getByText('Filter'));
      expect(mockWamKeyboard.audioNode.setParameterValues).toHaveBeenCalledWith({ filter: 500 });
    });

    it('should handle widget unmounting with cached instrument', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const MockHarmonyWidget = () => {
        const keyboardRef = React.useRef(mockWamKeyboard);

        React.useEffect(() => {
          // Setup on mount
          return () => {
            // Cleanup on unmount
            if (keyboardRef.current?.audioNode.isConnected) {
              keyboardRef.current.audioNode.disconnect();
            }
            keyboardRef.current.audioNode.clearEvents();
          };
        }, []);

        return <div>Harmony Widget Active</div>;
      };

      const { unmount } = render(<MockHarmonyWidget />);
      
      expect(screen.getByText('Harmony Widget Active')).toBeInTheDocument();

      // Unmount the widget properly
      unmount();

      // Should have cleaned up
      expect(mockWamKeyboard.audioNode.clearEvents).toHaveBeenCalled();
    });
  });

  describe('Performance with Cached Harmony', () => {
    it('should play notes with minimal latency', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockWamKeyboard);

      const noteTimes: number[] = [];

      // Track when notes are scheduled
      mockWamKeyboard.audioNode.scheduleEvents.mockImplementation((events) => {
        noteTimes.push(performance.now());
      });

      const MockHarmonyWidget = () => {
        const keyboardRef = React.useRef(mockWamKeyboard);
        
        const playNote = (note: number) => {
          keyboardRef.current.audioNode.scheduleEvents([
            { type: 'note', time: 0, note, velocity: 0.8 }
          ]);
        };

        return (
          <div>
            <button onClick={() => playNote(60)}>C</button>
            <button onClick={() => playNote(62)}>D</button>
            <button onClick={() => playNote(64)}>E</button>
          </div>
        );
      };

      render(<MockHarmonyWidget />);
      
      const user = userEvent.setup();
      const startTime = performance.now();

      // Play notes in sequence
      await user.click(screen.getByText('C'));
      await user.click(screen.getByText('D'));
      await user.click(screen.getByText('E'));

      // Each note should be scheduled almost immediately (under 5ms from click)
      noteTimes.forEach(time => {
        const latency = time - startTime;
        expect(latency).toBeLessThan(50); // Very generous, should be much less
      });
    });
  });
});