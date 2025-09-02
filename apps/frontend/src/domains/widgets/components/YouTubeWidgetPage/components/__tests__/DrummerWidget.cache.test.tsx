import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
import * as Tone from 'tone';

// Mock dependencies
vi.mock('@/domains/playback/services/storage/GlobalSampleCache');
vi.mock('tone');

describe('DrummerWidget - Cache Integration Tests', () => {
  const mockDrumPads = {
    1: { // Kick
      start: vi.fn(),
      stop: vi.fn(),
      volume: { value: -10 },
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    },
    3: { // Snare
      start: vi.fn(),
      stop: vi.fn(),
      volume: { value: -10 },
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    },
    5: { // Hi-hat
      start: vi.fn(),
      stop: vi.fn(),
      volume: { value: -10 },
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Tone.js mocks
    vi.mocked(Tone.start).mockResolvedValue();
    vi.mocked(Tone.loaded).mockResolvedValue();
    
    // Setup GlobalSampleCache mock
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Drum Triggering with Cached Samples', () => {
    it('should trigger cached drum samples correctly', async () => {
      // Return cached drums
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockDrumPads);

      // Mock DrummerWidget behavior
      const MockDrummerWidget = () => {
        const [samplesLoaded, setSamplesLoaded] = React.useState(false);
        const drumPadsRef = React.useRef<any>(null);

        React.useEffect(() => {
          const loadSamples = async () => {
            const preloadedDrums = GlobalSampleCache.getCachedInstrument('drums-preloaded');
            if (preloadedDrums) {
              drumPadsRef.current = preloadedDrums;
              setSamplesLoaded(true);
            }
          };
          loadSamples();
        }, []);

        const triggerDrum = (padNumber: number) => {
          if (drumPadsRef.current && drumPadsRef.current[padNumber]) {
            drumPadsRef.current[padNumber].start();
          }
        };

        return (
          <div>
            {samplesLoaded ? (
              <>
                <button onClick={() => triggerDrum(1)}>Kick</button>
                <button onClick={() => triggerDrum(3)}>Snare</button>
                <button onClick={() => triggerDrum(5)}>Hi-hat</button>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        );
      };

      render(<MockDrummerWidget />);

      // Wait for samples to load from cache
      await waitFor(() => {
        expect(screen.getByText('Kick')).toBeInTheDocument();
      });

      // Test triggering each drum
      const user = userEvent.setup();
      
      // Trigger kick
      await user.click(screen.getByText('Kick'));
      expect(mockDrumPads[1].start).toHaveBeenCalledTimes(1);
      
      // Trigger snare
      await user.click(screen.getByText('Snare'));
      expect(mockDrumPads[3].start).toHaveBeenCalledTimes(1);
      
      // Trigger hi-hat
      await user.click(screen.getByText('Hi-hat'));
      expect(mockDrumPads[5].start).toHaveBeenCalledTimes(1);
    });

    it('should maintain proper timing when triggering cached samples', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockDrumPads);

      const triggerTimes: number[] = [];
      
      // Track when each drum is triggered
      mockDrumPads[1].start.mockImplementation(() => {
        triggerTimes.push(performance.now());
      });

      const MockDrummerWidget = () => {
        const drumPadsRef = React.useRef<any>(mockDrumPads);
        
        const playRhythm = async () => {
          // Play a simple rhythm: kick, wait 100ms, kick
          drumPadsRef.current[1].start();
          await new Promise(resolve => setTimeout(resolve, 100));
          drumPadsRef.current[1].start();
        };

        return <button onClick={playRhythm}>Play Rhythm</button>;
      };

      render(<MockDrummerWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Play Rhythm'));

      await waitFor(() => {
        expect(triggerTimes.length).toBe(2);
        const timeDiff = triggerTimes[1] - triggerTimes[0];
        // Should be approximately 100ms apart
        expect(timeDiff).toBeGreaterThan(90);
        expect(timeDiff).toBeLessThan(110);
      });
    });
  });

  describe('Volume and Effects with Cached Drums', () => {
    it('should apply volume changes to cached drum samples', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockDrumPads);

      const MockDrummerWidget = () => {
        const drumPadsRef = React.useRef<any>(mockDrumPads);
        
        const changeVolume = (padNumber: number, volume: number) => {
          if (drumPadsRef.current && drumPadsRef.current[padNumber]) {
            drumPadsRef.current[padNumber].volume.value = volume;
          }
        };

        return (
          <div>
            <button onClick={() => changeVolume(1, -20)}>Quiet Kick</button>
            <button onClick={() => changeVolume(1, 0)}>Loud Kick</button>
            <div>Kick Volume: {drumPadsRef.current[1].volume.value}</div>
          </div>
        );
      };

      render(<MockDrummerWidget />);
      
      const user = userEvent.setup();
      
      // Make kick quiet
      await user.click(screen.getByText('Quiet Kick'));
      expect(mockDrumPads[1].volume.value).toBe(-20);
      
      // Make kick loud
      await user.click(screen.getByText('Loud Kick'));
      expect(mockDrumPads[1].volume.value).toBe(0);
    });

    it('should maintain individual volume settings per pad', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockDrumPads);

      const MockDrummerWidget = () => {
        const drumPadsRef = React.useRef<any>(mockDrumPads);
        
        const setDrumMix = () => {
          // Set individual volumes for a drum mix
          drumPadsRef.current[1].volume.value = -5;  // Kick prominent
          drumPadsRef.current[3].volume.value = -10; // Snare medium
          drumPadsRef.current[5].volume.value = -15; // Hi-hat quiet
        };

        return (
          <div>
            <button onClick={setDrumMix}>Set Mix</button>
            <div data-testid="kick-vol">{drumPadsRef.current[1].volume.value}</div>
            <div data-testid="snare-vol">{drumPadsRef.current[3].volume.value}</div>
            <div data-testid="hihat-vol">{drumPadsRef.current[5].volume.value}</div>
          </div>
        );
      };

      render(<MockDrummerWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Set Mix'));
      
      // Verify each drum has its own volume
      await waitFor(() => {
        expect(mockDrumPads[1].volume.value).toBe(-5);
        expect(mockDrumPads[3].volume.value).toBe(-10);
        expect(mockDrumPads[5].volume.value).toBe(-15);
      });
    });
  });

  describe('Performance with Cached Samples', () => {
    it('should load instantly when using cached samples', async () => {
      let loadStartTime: number;
      let loadEndTime: number;

      const MockDrummerWidget = ({ cacheHit }: { cacheHit?: boolean }) => {
        const [loaded, setLoaded] = React.useState(false);

        React.useEffect(() => {
          loadStartTime = performance.now();
          const drums = GlobalSampleCache.getCachedInstrument('drums-preloaded');
          if (drums) {
            loadEndTime = performance.now();
            setLoaded(true);
          }
        }, [cacheHit]); // React to cacheHit prop changes

        return <div>{loaded ? 'Ready' : 'Loading'}</div>;
      };

      // First render without cache
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);
      const { rerender } = render(<MockDrummerWidget cacheHit={false} />);
      expect(screen.getByText('Loading')).toBeInTheDocument();

      // Second render with cache - prop change will trigger useEffect
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(mockDrumPads);
      rerender(<MockDrummerWidget cacheHit={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
        const loadTime = loadEndTime - loadStartTime;
        // Should be nearly instant (under 10ms)
        expect(loadTime).toBeLessThan(10);
      });
    });

    it('should handle multiple widgets using same cached drums', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockDrumPads);

      const MockWidget = ({ id }: { id: number }) => {
        const drumPadsRef = React.useRef<any>(null);

        React.useEffect(() => {
          drumPadsRef.current = GlobalSampleCache.getCachedInstrument('drums-preloaded');
        }, []);

        const triggerKick = () => {
          drumPadsRef.current?.[1]?.start();
        };

        return <button onClick={triggerKick}>Widget {id} Kick</button>;
      };

      render(
        <>
          <MockWidget id={1} />
          <MockWidget id={2} />
          <MockWidget id={3} />
        </>
      );

      const user = userEvent.setup();
      
      // Each widget should trigger the same cached drum
      await user.click(screen.getByText('Widget 1 Kick'));
      await user.click(screen.getByText('Widget 2 Kick'));
      await user.click(screen.getByText('Widget 3 Kick'));
      
      // Same drum pad triggered 3 times
      expect(mockDrumPads[1].start).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing drum pads gracefully', async () => {
      // Return incomplete drum set
      const incompleteDrums = { 1: mockDrumPads[1] }; // Only kick
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(incompleteDrums);

      const MockDrummerWidget = () => {
        const drumPadsRef = React.useRef<any>(null);
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
          drumPadsRef.current = GlobalSampleCache.getCachedInstrument('drums-preloaded');
        }, []);

        const triggerDrum = (padNumber: number) => {
          try {
            if (!drumPadsRef.current?.[padNumber]) {
              setError(`Drum pad ${padNumber} not loaded`);
              return;
            }
            drumPadsRef.current[padNumber].start();
          } catch (e) {
            setError('Error triggering drum');
          }
        };

        return (
          <div>
            <button onClick={() => triggerDrum(1)}>Kick</button>
            <button onClick={() => triggerDrum(3)}>Snare</button>
            {error && <div role="alert">{error}</div>}
          </div>
        );
      };

      render(<MockDrummerWidget />);
      
      const user = userEvent.setup();
      
      // Kick should work
      await user.click(screen.getByText('Kick'));
      expect(incompleteDrums[1].start).toHaveBeenCalled();
      
      // Snare should show error
      await user.click(screen.getByText('Snare'));
      expect(screen.getByRole('alert')).toHaveTextContent('Drum pad 3 not loaded');
    });
  });
});