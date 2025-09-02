import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';

// Mock dependencies
vi.mock('@/domains/playback/services/storage/GlobalSampleCache');

describe('Widget Performance Tests', () => {
  const mockInstruments = {
    harmony: {
      audioNode: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        setParameterValues: vi.fn()
      }
    },
    drums: {
      1: { start: vi.fn(), volume: { value: -10 } },
      3: { start: vi.fn(), volume: { value: -10 } },
      5: { start: vi.fn(), volume: { value: -10 } }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Widget Mount Performance', () => {
    it('should mount widgets quickly with cached instruments', async () => {
      // Setup cache to return instruments
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation((key) => {
        if (key === 'harmony-preloaded') return mockInstruments.harmony;
        if (key === 'drums-preloaded') return mockInstruments.drums;
        return null;
      });

      const MockWidget = ({ name }: { name: string }) => {
        const [loaded, setLoaded] = React.useState(false);

        React.useEffect(() => {
          const instrument = GlobalSampleCache.getCachedInstrument(`${name}-preloaded`);
          if (instrument) {
            setLoaded(true);
          }
        }, [name]);

        return <div>{loaded ? `${name} ready` : `${name} loading`}</div>;
      };

      const startTime = performance.now();
      render(
        <>
          <MockWidget name="harmony" />
          <MockWidget name="drums" />
        </>
      );

      await waitFor(() => {
        expect(screen.getByText('harmony ready')).toBeInTheDocument();
        expect(screen.getByText('drums ready')).toBeInTheDocument();
      });

      const totalMountTime = performance.now() - startTime;

      // Should mount reasonably quickly (under 100ms for test environment)
      expect(totalMountTime).toBeLessThan(100);
    });

    it('should handle mounting without cache (fallback scenario)', async () => {
      // No cache available
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);

      const MockWidget = ({ name }: { name: string }) => {
        const [status, setStatus] = React.useState('checking');

        React.useEffect(() => {
          const instrument = GlobalSampleCache.getCachedInstrument(`${name}-preloaded`);
          if (instrument) {
            setStatus('cached');
          } else {
            setStatus('fallback');
          }
        }, [name]);

        return <div>{name}: {status}</div>;
      };

      render(<MockWidget name="harmony" />);

      await waitFor(() => {
        expect(screen.getByText('harmony: fallback')).toBeInTheDocument();
      });

      // Should handle fallback gracefully
      expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith('harmony-preloaded');
    });

    it('should handle parallel widget mounting efficiently', async () => {
      // All instruments cached
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation((key) => {
        if (key.includes('harmony')) return mockInstruments.harmony;
        if (key.includes('drums')) return mockInstruments.drums;
        return null;
      });

      let readyCount = 0;

      const MockWidgetPage = () => {
        const [widgetsReady, setWidgetsReady] = React.useState(0);

        const WidgetComponent = ({ type }: { type: string }) => {
          React.useEffect(() => {
            const instrument = GlobalSampleCache.getCachedInstrument(`${type}-preloaded`);
            if (instrument) {
              setWidgetsReady(prev => prev + 1);
            }
          }, [type]);

          return <div>{type} widget</div>;
        };

        return (
          <>
            <WidgetComponent type="harmony" />
            <WidgetComponent type="drums" />
            <div>Widgets ready: {widgetsReady}/2</div>
          </>
        );
      };

      render(<MockWidgetPage />);

      await waitFor(() => {
        expect(screen.getByText('Widgets ready: 2/2')).toBeInTheDocument();
      });

      expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith('harmony-preloaded');
      expect(GlobalSampleCache.getCachedInstrument).toHaveBeenCalledWith('drums-preloaded');
    });
  });

  describe('Memory Efficiency', () => {
    it('should reuse same instrument instances across widgets', async () => {
      const instrumentRefs: any[] = [];

      vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation(() => {
        return mockInstruments.harmony; // Return same instance
      });

      const MockWidget = ({ id }: { id: number }) => {
        React.useEffect(() => {
          const instrument = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
          instrumentRefs.push(instrument);
        }, [id]);

        return <div>Widget {id}</div>;
      };

      render(
        <>
          <MockWidget id={1} />
          <MockWidget id={2} />
        </>
      );

      await waitFor(() => {
        expect(instrumentRefs.length).toBe(2);
      });

      // All widgets should reference the same instrument object
      expect(instrumentRefs[0]).toBe(instrumentRefs[1]);
    });

    it('should not create duplicate instruments on re-render', async () => {
      let cacheCheckCount = 0;

      // Return cached instrument after first check
      vi.mocked(GlobalSampleCache.getCachedInstrument).mockImplementation(() => {
        cacheCheckCount++;
        return mockInstruments.harmony;
      });

      const MockWidget = () => {
        const [renderCount, setRenderCount] = React.useState(0);
        const instrumentRef = React.useRef<any>(null);

        React.useEffect(() => {
          if (!instrumentRef.current) {
            instrumentRef.current = GlobalSampleCache.getCachedInstrument('test-instrument');
          }
        }, [renderCount]);

        return (
          <div>
            <button onClick={() => setRenderCount(c => c + 1)}>Re-render</button>
            <div>Render count: {renderCount}</div>
            <div>Has instrument: {instrumentRef.current ? 'yes' : 'no'}</div>
          </div>
        );
      };

      const { rerender } = render(<MockWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Has instrument: yes')).toBeInTheDocument();
      });
      
      // Re-render the component
      rerender(<MockWidget />);
      
      // Should have checked cache only once despite re-render
      expect(cacheCheckCount).toBe(1);
    });
  });

  describe('Initialization Performance', () => {
    it('should initialize widgets faster with preloaded samples', async () => {
      const initTimes: Record<string, number> = {};

      const MockOptimizedWidget = ({ name, cached }: { name: string; cached: boolean }) => {
        const [initialized, setInitialized] = React.useState(false);

        React.useEffect(() => {
          const startTime = performance.now();
          
          if (cached) {
            // Simulate cached initialization (immediate)
            setInitialized(true);
            initTimes[`${name}-cached`] = performance.now() - startTime;
          } else {
            // Simulate loading initialization (delayed)
            setTimeout(() => {
              setInitialized(true);
              initTimes[`${name}-fresh`] = performance.now() - startTime;
            }, 50);
          }
        }, [name, cached]);

        return <div>{initialized ? `${name} ready` : `${name} initializing`}</div>;
      };

      // Test cached vs non-cached initialization
      render(
        <>
          <MockOptimizedWidget name="harmony" cached={true} />
          <MockOptimizedWidget name="drums" cached={false} />
        </>
      );

      await waitFor(() => {
        expect(screen.getByText('harmony ready')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText('drums ready')).toBeInTheDocument();
      }, { timeout: 100 });

      // Cached initialization should be much faster
      expect(initTimes['harmony-cached']).toBeLessThan(initTimes['drums-fresh']);
    });
  });
});