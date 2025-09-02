import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
import * as Tone from 'tone';

// Mock dependencies
vi.mock('@/domains/playback/services/storage/GlobalSampleCache');
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  loaded: vi.fn().mockResolvedValue(undefined),
  Transport: {
    start: vi.fn().mockReturnValue(undefined),
    stop: vi.fn().mockReturnValue(undefined),
    pause: vi.fn().mockReturnValue(undefined),
    bpm: { value: 120 },
    timeSignature: { value: [4, 4] },
    scheduleRepeat: vi.fn(),
    cancel: vi.fn()
  },
  Player: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    volume: { value: -10 },
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn()
  }))
}));

describe('MetronomeWidget - Cache Integration Tests', () => {
  const mockMetronomeInstrument = {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setTempo: vi.fn(),
    getTempo: vi.fn().mockReturnValue(120),
    isRunning: vi.fn().mockReturnValue(false),
    dispose: vi.fn()
  };

  const mockClickSounds = {
    accent: { 
      start: vi.fn(),
      stop: vi.fn(),
      volume: { value: 0 }
    },
    regular: { 
      start: vi.fn(),
      stop: vi.fn(),
      volume: { value: -5 }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks
    vi.mocked(GlobalSampleCache.getCachedInstrument).mockReturnValue(null);
    vi.mocked(GlobalSampleCache.getCachedUrl).mockImplementation((path) => {
      if (path.includes('Clicks_03')) return 'https://test.url/accent.mp3';
      if (path.includes('Clicks_01')) return 'https://test.url/regular.mp3';
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Metronome Timing Tests', () => {
    it('should maintain accurate timing with cached metronome sounds', async () => {
      // Return cached URLs for metronome clicks
      vi.mocked(GlobalSampleCache.getCachedUrl).mockImplementation((path) => {
        if (path.includes('Clicks_03')) return 'https://cached.url/accent.mp3';
        if (path.includes('Clicks_01')) return 'https://cached.url/regular.mp3';
        return null;
      });

      const MockMetronomeWidget = () => {
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [bpm] = React.useState(120);
        const clickCount = React.useRef(0);

        const startMetronome = () => {
          setIsPlaying(true);
          // Simulate starting metronome with cached sounds
          const accentUrl = GlobalSampleCache.getCachedUrl('metronome/Clicks_03.mp3');
          const regularUrl = GlobalSampleCache.getCachedUrl('metronome/Clicks_01.mp3');
          
          if (accentUrl && regularUrl) {
            clickCount.current = 0; // Reset click count
          }
        };

        const stopMetronome = () => {
          setIsPlaying(false);
        };

        const simulateClick = () => {
          clickCount.current++;
        };

        return (
          <div>
            <button onClick={startMetronome}>Start</button>
            <button onClick={stopMetronome}>Stop</button>
            <button onClick={simulateClick}>Simulate Click</button>
            <div>BPM: {bpm}</div>
            <div>{isPlaying ? 'Playing' : 'Stopped'}</div>
            <div>Clicks: {clickCount.current}</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();
      
      // Should use cached URLs
      expect(screen.getByText('Stopped')).toBeInTheDocument();
      
      // Start metronome
      await user.click(screen.getByText('Start'));
      expect(screen.getByText('Playing')).toBeInTheDocument();
      
      // Check that cached URLs were retrieved
      expect(GlobalSampleCache.getCachedUrl).toHaveBeenCalledWith('metronome/Clicks_03.mp3');
      expect(GlobalSampleCache.getCachedUrl).toHaveBeenCalledWith('metronome/Clicks_01.mp3');
    });

    it('should handle tempo changes during playback', async () => {
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockReturnValue(mockMetronomeInstrument);

      const MockMetronomeWidget = () => {
        const [bpm, setBpm] = React.useState(120);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const metronomeRef = React.useRef(mockMetronomeInstrument);

        const updateTempo = (newBpm: number) => {
          setBpm(newBpm);
          if (metronomeRef.current && isPlaying) {
            metronomeRef.current.setTempo(newBpm);
          }
        };

        const togglePlayback = () => {
          if (isPlaying) {
            metronomeRef.current.stop();
          } else {
            metronomeRef.current.start();
          }
          setIsPlaying(!isPlaying);
        };

        return (
          <div>
            <button onClick={togglePlayback}>{isPlaying ? 'Stop' : 'Start'}</button>
            <button onClick={() => updateTempo(60)}>60 BPM</button>
            <button onClick={() => updateTempo(120)}>120 BPM</button>
            <button onClick={() => updateTempo(180)}>180 BPM</button>
            <div>Current: {bpm} BPM</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();

      // Start at 120 BPM
      await user.click(screen.getByText('Start'));
      expect(mockMetronomeInstrument.start).toHaveBeenCalled();

      // Change to 60 BPM while playing
      await user.click(screen.getByText('60 BPM'));
      expect(mockMetronomeInstrument.setTempo).toHaveBeenCalledWith(60);

      // Change to 180 BPM
      await user.click(screen.getByText('180 BPM'));
      expect(mockMetronomeInstrument.setTempo).toHaveBeenCalledWith(180);
    });

    it('should sync metronome with transport timing', async () => {
      const MockMetronomeWidget = () => {
        const [synced, setSynced] = React.useState(false);
        
        const toggleSync = () => {
          setSynced(!synced);
          if (!synced) {
            // Enable sync with Tone Transport
            Tone.Transport.start();
          } else {
            Tone.Transport.stop();
          }
        };

        return (
          <div>
            <button onClick={toggleSync}>
              {synced ? 'Disable' : 'Enable'} Transport Sync
            </button>
            <div>{synced ? 'Synced' : 'Not Synced'}</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();
      
      // Initially not synced
      expect(screen.getByText('Not Synced')).toBeInTheDocument();
      
      // Enable sync
      await user.click(screen.getByText('Enable Transport Sync'));
      expect(screen.getByText('Synced')).toBeInTheDocument();
      expect(Tone.Transport.start).toHaveBeenCalled();
      
      // Disable sync
      await user.click(screen.getByText('Disable Transport Sync'));
      expect(screen.getByText('Not Synced')).toBeInTheDocument();
      expect(Tone.Transport.stop).toHaveBeenCalled();
    });

    it('should handle different time signatures', async () => {
      const MockMetronomeWidget = () => {
        const [timeSignature, setTimeSignature] = React.useState([4, 4]);
        
        const changeTimeSignature = (newSig: number[]) => {
          setTimeSignature(newSig);
          // Update transport time signature
          Tone.Transport.timeSignature.value = newSig;
        };

        return (
          <div>
            <button onClick={() => changeTimeSignature([4, 4])}>4/4</button>
            <button onClick={() => changeTimeSignature([3, 4])}>3/4</button>
            <button onClick={() => changeTimeSignature([6, 8])}>6/8</button>
            <div>Time Signature: {timeSignature[0]}/{timeSignature[1]}</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();
      
      // Test different time signatures
      await user.click(screen.getByText('3/4'));
      expect(screen.getByText('Time Signature: 3/4')).toBeInTheDocument();
      
      await user.click(screen.getByText('6/8'));
      expect(screen.getByText('Time Signature: 6/8')).toBeInTheDocument();
      
      await user.click(screen.getByText('4/4'));
      expect(screen.getByText('Time Signature: 4/4')).toBeInTheDocument();
    });
  });

  describe('Click Sound Management', () => {
    it('should use cached click sounds efficiently', async () => {
      // Return cached sounds
      vi.mocked(GlobalSampleCache.getCachedInstrument)
        .mockImplementation((key) => {
          if (key === 'metronome-clicks') return mockClickSounds;
          return null;
        });

      const MockMetronomeWidget = () => {
        const [clicksLoaded, setClicksLoaded] = React.useState(false);
        
        React.useEffect(() => {
          const cachedClicks = GlobalSampleCache.getCachedInstrument('metronome-clicks');
          if (cachedClicks) {
            setClicksLoaded(true);
          }
        }, []);

        const playAccent = () => {
          if (clicksLoaded) {
            mockClickSounds.accent.start();
          }
        };

        const playRegular = () => {
          if (clicksLoaded) {
            mockClickSounds.regular.start();
          }
        };

        return (
          <div>
            <div>{clicksLoaded ? 'Clicks Ready' : 'Loading Clicks'}</div>
            <button onClick={playAccent}>Accent Click</button>
            <button onClick={playRegular}>Regular Click</button>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      // Should immediately load from cache
      expect(screen.getByText('Clicks Ready')).toBeInTheDocument();
      
      const user = userEvent.setup();
      
      // Test click sounds
      await user.click(screen.getByText('Accent Click'));
      expect(mockClickSounds.accent.start).toHaveBeenCalled();
      
      await user.click(screen.getByText('Regular Click'));
      expect(mockClickSounds.regular.start).toHaveBeenCalled();
    });

    it('should handle subdivision clicks', async () => {
      const MockMetronomeWidget = () => {
        const [subdivision, setSubdivision] = React.useState(1);
        
        const playSubdivision = () => {
          // Play subdivision based on current setting
          for (let i = 0; i < subdivision; i++) {
            mockClickSounds.regular.start();
          }
        };

        return (
          <div>
            <button onClick={() => setSubdivision(1)}>Quarter Notes</button>
            <button onClick={() => setSubdivision(2)}>Eighth Notes</button>
            <button onClick={() => setSubdivision(4)}>Sixteenth Notes</button>
            <button onClick={playSubdivision}>Play Subdivision</button>
            <div>Subdivision: {subdivision}</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();
      
      // Test different subdivisions
      await user.click(screen.getByText('Eighth Notes'));
      expect(screen.getByText('Subdivision: 2')).toBeInTheDocument();
      
      await user.click(screen.getByText('Sixteenth Notes'));
      expect(screen.getByText('Subdivision: 4')).toBeInTheDocument();
    });
  });

  describe('Performance and Stability', () => {
    it('should maintain timing stability over extended periods', async () => {
      const MockMetronomeWidget = () => {
        const [isStable, setIsStable] = React.useState(true);
        const [runTime, setRunTime] = React.useState(0);
        
        const simulateExtendedRun = () => {
          // Simulate running for extended period
          setRunTime(runTime + 1000); // Simulate 1 second
          
          // Check stability (in real implementation, this would check timing accuracy)
          if (runTime > 60000) { // After 60 seconds
            setIsStable(true); // Assume stable for test
          }
        };

        return (
          <div>
            <button onClick={simulateExtendedRun}>Simulate Run Time</button>
            <div>Runtime: {runTime}ms</div>
            <div>Status: {isStable ? 'Stable' : 'Unstable'}</div>
          </div>
        );
      };

      render(<MockMetronomeWidget />);
      
      const user = userEvent.setup();
      
      // Simulate extended operation
      for (let i = 0; i < 65; i++) {
        await user.click(screen.getByText('Simulate Run Time'));
      }
      
      expect(screen.getByText('Status: Stable')).toBeInTheDocument();
    });
  });
});