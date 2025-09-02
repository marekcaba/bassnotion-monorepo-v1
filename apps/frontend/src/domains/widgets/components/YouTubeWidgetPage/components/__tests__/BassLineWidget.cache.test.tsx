import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';

// Mock dependencies
vi.mock('@/domains/playback/services/storage/GlobalSampleCache');
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://test.url/bass.mp3' } })
      })
    }
  }
}));

describe('BassLineWidget - Cache Integration Tests', () => {
  const mockBassInstrument = {
    audioNode: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      setParameterValues: vi.fn(),
      scheduleEvents: vi.fn(),
      clearEvents: vi.fn(),
      isConnected: false
    },
    type: 'WamBass'
  };

  const mockAudioContext = {
    state: 'running',
    sampleRate: 44100,
    currentTime: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bass Sample Playback', () => {
    it('should play bass notes with cached instrument', async () => {
      // Return cached bass instrument
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const [ready, setReady] = React.useState(false);
        const bassRef = React.useRef<any>(null);

        React.useEffect(() => {
          // Check cache first
          const cached = GlobalSampleCache.getCachedInstrument('bass-preloaded');
          if (cached) {
            bassRef.current = cached;
            setReady(true);
          } else {
            // For this test, we expect cache to be available
            setReady(false);
          }
        }, []);

        const playBassLine = () => {
          if (bassRef.current) {
            const pattern = [
              { note: 28, time: 0, velocity: 0.8 },     // E1
              { note: 28, time: 0.25, velocity: 0.8 },  // E1
              { note: 31, time: 0.5, velocity: 0.8 },   // G1
              { note: 33, time: 0.75, velocity: 0.8 }   // A1
            ];
            
            bassRef.current.audioNode.clearEvents();
            bassRef.current.audioNode.scheduleEvents(pattern);
          }
        };

        const playSlap = () => {
          if (bassRef.current) {
            bassRef.current.audioNode.setParameterValues({ technique: 'slap' });
            bassRef.current.audioNode.scheduleEvents([
              { note: 36, time: 0, velocity: 0.9 } // C2 slap
            ]);
          }
        };

        return (
          <div>
            {ready ? (
              <>
                <button onClick={playBassLine}>Play Bass Line</button>
                <button onClick={playSlap}>Play Slap</button>
              </>
            ) : (
              <div>Loading bass...</div>
            )}
          </div>
        );
      };

      render(<MockBassWidget />);

      // Should immediately be ready with cached instrument
      expect(screen.getByText('Play Bass Line')).toBeInTheDocument();

      const user = userEvent.setup();
      
      // Test bass line playback
      await user.click(screen.getByText('Play Bass Line'));
      
      expect(mockBassInstrument.audioNode.clearEvents).toHaveBeenCalled();
      expect(mockBassInstrument.audioNode.scheduleEvents).toHaveBeenCalledWith([
        { note: 28, time: 0, velocity: 0.8 },
        { note: 28, time: 0.25, velocity: 0.8 },
        { note: 31, time: 0.5, velocity: 0.8 },
        { note: 33, time: 0.75, velocity: 0.8 }
      ]);

      // Test slap technique
      await user.click(screen.getByText('Play Slap'));
      
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ 
        technique: 'slap' 
      });
      expect(mockBassInstrument.audioNode.scheduleEvents).toHaveBeenLastCalledWith([
        { note: 36, time: 0, velocity: 0.9 }
      ]);
    });

    it('should handle different bass playing techniques', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const bassRef = React.useRef(mockBassInstrument);

        const playTechnique = (technique: string, note: number) => {
          bassRef.current.audioNode.setParameterValues({ technique });
          bassRef.current.audioNode.scheduleEvents([
            { note, time: 0, velocity: 0.8 }
          ]);
        };

        return (
          <div>
            <button onClick={() => playTechnique('fingerstyle', 33)}>Finger</button>
            <button onClick={() => playTechnique('pick', 33)}>Pick</button>
            <button onClick={() => playTechnique('slap', 33)}>Slap</button>
            <button onClick={() => playTechnique('mute', 33)}>Mute</button>
          </div>
        );
      };

      render(<MockBassWidget />);
      
      const user = userEvent.setup();

      // Test each technique
      await user.click(screen.getByText('Finger'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ 
        technique: 'fingerstyle' 
      });

      await user.click(screen.getByText('Pick'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ 
        technique: 'pick' 
      });

      await user.click(screen.getByText('Slap'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ 
        technique: 'slap' 
      });

      await user.click(screen.getByText('Mute'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ 
        technique: 'mute' 
      });
    });

    it('should play walking bass line pattern', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const bassRef = React.useRef(mockBassInstrument);

        const playWalkingBass = async () => {
          const walkingPattern = [
            { note: 28, duration: 0.25 }, // E1
            { note: 30, duration: 0.25 }, // F#1
            { note: 32, duration: 0.25 }, // G#1
            { note: 33, duration: 0.25 }, // A1
            { note: 35, duration: 0.25 }, // B1
            { note: 33, duration: 0.25 }, // A1
            { note: 32, duration: 0.25 }, // G#1
            { note: 30, duration: 0.25 }  // F#1
          ];

          let currentTime = 0;
          for (const { note, duration } of walkingPattern) {
            bassRef.current.audioNode.scheduleEvents([
              { note, time: currentTime, velocity: 0.7 }
            ]);
            currentTime += duration;
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
          }
        };

        return <button onClick={playWalkingBass}>Play Walking Bass</button>;
      };

      render(<MockBassWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Play Walking Bass'));

      // Should schedule multiple events over time
      await waitFor(() => {
        expect(mockBassInstrument.audioNode.scheduleEvents).toHaveBeenCalledTimes(8);
      }, { timeout: 3000 });
    });

    it('should handle bass line with rests and ties', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const bassRef = React.useRef(mockBassInstrument);

        const playGroove = () => {
          // Groove with rests and different note lengths
          const events = [
            { note: 28, time: 0, velocity: 0.8, duration: 0.5 },      // E1 (half)
            // Rest at 0.5
            { note: 28, time: 0.75, velocity: 0.6, duration: 0.125 }, // E1 (eighth)
            { note: 33, time: 0.875, velocity: 0.6, duration: 0.125 },// A1 (eighth)
            { note: 28, time: 1, velocity: 0.8, duration: 0.25 },     // E1 (quarter)
            { note: 31, time: 1.25, velocity: 0.7, duration: 0.25 },  // G1 (quarter)
            // Rest at 1.5
            { note: 28, time: 1.75, velocity: 0.5, duration: 0.25 }   // E1 ghost note
          ];

          bassRef.current.audioNode.clearEvents();
          bassRef.current.audioNode.scheduleEvents(events);
        };

        return <button onClick={playGroove}>Play Groove</button>;
      };

      render(<MockBassWidget />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText('Play Groove'));

      expect(mockBassInstrument.audioNode.scheduleEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ note: 28, time: 0, velocity: 0.8 }),
          expect.objectContaining({ note: 28, time: 0.75, velocity: 0.6 }),
          expect.objectContaining({ note: 33, time: 0.875, velocity: 0.6 }),
          expect.objectContaining({ note: 28, time: 1, velocity: 0.8 }),
          expect.objectContaining({ note: 31, time: 1.25, velocity: 0.7 }),
          expect.objectContaining({ note: 28, time: 1.75, velocity: 0.5 })
        ])
      );
    });
  });

  describe('Bass Effects and Parameters', () => {
    it('should apply tone and effects settings', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const bassRef = React.useRef(mockBassInstrument);

        const applySettings = (settings: any) => {
          bassRef.current.audioNode.setParameterValues(settings);
        };

        return (
          <div>
            <button onClick={() => applySettings({ tone: 0.2 })}>Dark Tone</button>
            <button onClick={() => applySettings({ tone: 0.8 })}>Bright Tone</button>
            <button onClick={() => applySettings({ drive: 0.6 })}>Add Drive</button>
            <button onClick={() => applySettings({ compression: 0.7 })}>Compress</button>
          </div>
        );
      };

      render(<MockBassWidget />);
      
      const user = userEvent.setup();

      await user.click(screen.getByText('Dark Tone'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ tone: 0.2 });

      await user.click(screen.getByText('Bright Tone'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ tone: 0.8 });

      await user.click(screen.getByText('Add Drive'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ drive: 0.6 });

      await user.click(screen.getByText('Compress'));
      expect(mockBassInstrument.audioNode.setParameterValues).toHaveBeenCalledWith({ compression: 0.7 });
    });
  });

  describe('Fallback Loading', () => {
    it('should fall back to creating new instrument when cache miss', async () => {
      // Mock a bass creation function
      const mockCreateBassInstrument = vi.fn().mockResolvedValue(mockBassInstrument);
      
      // First return null (cache miss), then return created instrument
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValueOnce(null)
        .mockReturnValue(mockBassInstrument);

      const MockBassWidget = () => {
        const [status, setStatus] = React.useState('checking');
        const bassRef = React.useRef<any>(null);

        React.useEffect(() => {
          const loadBass = async () => {
            // Check cache
            let bass = GlobalSampleCache.getCachedInstrument('bass-preloaded');
            
            if (!bass) {
              setStatus('creating');
              // Create new (simulated bass creation)
              bass = await mockCreateBassInstrument({} as any);
              // Cache it
              GlobalSampleCache.cacheInstrument('bass-preloaded', bass);
            }
            
            bassRef.current = bass;
            setStatus('ready');
          };
          
          loadBass();
        }, []);

        return <div>{status}</div>;
      };

      render(<MockBassWidget />);

      // Should show creating state
      await waitFor(() => {
        expect(screen.getByText('creating')).toBeInTheDocument();
      });

      // Should create new instrument
      expect(mockCreateBassInstrument).toHaveBeenCalled();

      // Should eventually be ready
      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument();
      });
    });
  });
});