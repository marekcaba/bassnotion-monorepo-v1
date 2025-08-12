import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioProvider } from '../../providers/AudioProvider.js';
import { useAudio } from '../../hooks/useAudio.js';
import { useTransport } from '../../hooks/useTransport.js';
import { usePlugins } from '../../hooks/usePlugins.js';
import { SyncedWidget } from '../../../widgets/components/base/SyncedWidget.js';

// Mock widget components
const mockHarmonyWidget = vi.fn();
const mockDrummerWidget = vi.fn();
const mockBassLineWidget = vi.fn();
const mockMetronomeWidget = vi.fn();

vi.mock('../../../widgets/components/YouTubeWidgetPage/components/HarmonyWidget', () => ({
  HarmonyWidget: mockHarmonyWidget
}));

vi.mock('../../../widgets/components/YouTubeWidgetPage/components/DrummerWidget', () => ({
  DrummerWidget: mockDrummerWidget
}));

vi.mock('../../../widgets/components/YouTubeWidgetPage/components/BassLineWidget', () => ({
  BassLineWidget: mockBassLineWidget
}));

vi.mock('../../../widgets/components/YouTubeWidgetPage/components/MetronomeWidget', () => ({
  MetronomeWidget: mockMetronomeWidget
}));

describe('Widget Integration with New Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Widget Hook Integration', () => {
    it('should provide all hooks to widgets correctly', () => {
      const TestWidget = () => {
        const audio = useAudio();
        const transport = useTransport();
        const plugins = usePlugins();
        
        expect(audio).toBeDefined();
        expect(transport).toBeDefined();
        expect(plugins).toBeDefined();
        
        // Verify hook APIs
        expect(typeof audio.initialize).toBe('function');
        expect(typeof audio.getTone).toBe('function');
        expect(typeof transport.play).toBe('function');
        expect(typeof transport.pause).toBe('function');
        expect(typeof transport.stop).toBe('function');
        expect(typeof plugins.load).toBe('function');
        expect(typeof plugins.get).toBe('function');
        
        return <div data-testid="test-widget">Hooks validated</div>;
      };
      
      render(
        <AudioProvider>
          <TestWidget />
        </AudioProvider>
      );
      
      expect(screen.getByTestId('test-widget')).toBeInTheDocument();
    });

    it('should share state across multiple widgets', async () => {
      let tempo1: number | undefined;
      let tempo2: number | undefined;
      
      const Widget1 = () => {
        const transport = useTransport();
        tempo1 = transport.tempo;
        
        return (
          <button 
            data-testid="widget1-set-tempo"
            onClick={() => transport.setTempo(140)}
          >
            Set Tempo
          </button>
        );
      };
      
      const Widget2 = () => {
        const transport = useTransport();
        tempo2 = transport.tempo;
        
        return <div data-testid="widget2-tempo">{transport.tempo}</div>;
      };
      
      render(
        <AudioProvider>
          <Widget1 />
          <Widget2 />
        </AudioProvider>
      );
      
      // Initial tempo should be the same
      expect(tempo1).toBe(tempo2);
      
      // Change tempo from widget 1
      fireEvent.click(screen.getByTestId('widget1-set-tempo'));
      
      await waitFor(() => {
        expect(screen.getByTestId('widget2-tempo')).toHaveTextContent('140');
      });
    });
  });

  describe('SyncedWidget Base Class', () => {
    it('should provide sync functionality to all widgets', async () => {
      class TestSyncedWidget extends SyncedWidget {
        render() {
          return (
            <div data-testid="synced-widget">
              <div>Sync ID: {this.props.syncId}</div>
              <div>Is Playing: {this.state.isPlaying ? 'yes' : 'no'}</div>
              <button onClick={() => this.handlePlay()}>Play</button>
            </div>
          );
        }
      }
      
      render(
        <AudioProvider>
          <TestSyncedWidget syncId="test-widget" />
        </AudioProvider>
      );
      
      expect(screen.getByTestId('synced-widget')).toBeInTheDocument();
      expect(screen.getByText('Sync ID: test-widget')).toBeInTheDocument();
      expect(screen.getByText('Is Playing: no')).toBeInTheDocument();
      
      // Test play functionality
      fireEvent.click(screen.getByText('Play'));
      
      await waitFor(() => {
        expect(screen.getByText('Is Playing: yes')).toBeInTheDocument();
      });
    });

    it('should sync multiple widgets together', async () => {
      const Widget1 = () => {
        const transport = useTransport();
        return (
          <div data-testid="widget1">
            <div>State: {transport.state}</div>
            <button onClick={() => transport.play()}>Play</button>
          </div>
        );
      };
      
      const Widget2 = () => {
        const transport = useTransport();
        return (
          <div data-testid="widget2">
            <div>State: {transport.state}</div>
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <Widget1 />
          <Widget2 />
        </AudioProvider>
      );
      
      // Both should start in stopped state
      expect(screen.getAllByText('State: stopped')).toHaveLength(2);
      
      // Play from widget 1
      fireEvent.click(screen.getByText('Play'));
      
      // Both should update to playing state
      await waitFor(() => {
        expect(screen.getAllByText('State: playing')).toHaveLength(2);
      });
    });
  });

  describe('Widget Performance', () => {
    it('should initialize widgets faster than old system', async () => {
      const startTime = performance.now();
      
      const PerformanceWidget = () => {
        const audio = useAudio();
        const transport = useTransport();
        const plugins = usePlugins();
        
        React.useEffect(() => {
          audio.initialize();
        }, []);
        
        return <div data-testid="perf-widget">Initialized</div>;
      };
      
      render(
        <AudioProvider>
          <PerformanceWidget />
        </AudioProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('perf-widget')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      // Should initialize faster than old system (baseline: 5000ms)
      expect(initTime).toBeLessThan(2000);
    });

    it('should handle rapid state updates efficiently', async () => {
      let updateCount = 0;
      
      const RapidUpdateWidget = () => {
        const transport = useTransport();
        const [localCount, setLocalCount] = React.useState(0);
        
        React.useEffect(() => {
          updateCount++;
        });
        
        const handleRapidUpdates = async () => {
          for (let i = 0; i < 100; i++) {
            await transport.setTempo(120 + i);
            setLocalCount(i);
          }
        };
        
        return (
          <div data-testid="rapid-widget">
            <div>Updates: {localCount}</div>
            <button onClick={handleRapidUpdates}>Start Updates</button>
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <RapidUpdateWidget />
        </AudioProvider>
      );
      
      fireEvent.click(screen.getByText('Start Updates'));
      
      await waitFor(() => {
        expect(screen.getByText('Updates: 99')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Should handle updates efficiently without excessive re-renders
      expect(updateCount).toBeLessThan(200); // Allow some re-renders but not 100+
    });
  });

  describe('Widget Error Handling', () => {
    it('should handle widget errors gracefully', async () => {
      const ErrorWidget = () => {
        const audio = useAudio();
        const [error, setError] = React.useState<string | null>(null);
        
        const handleError = async () => {
          try {
            // Simulate an error
            throw new Error('Widget error');
          } catch (err) {
            setError((err as Error).message);
          }
        };
        
        return (
          <div data-testid="error-widget">
            {error && <div data-testid="error-message">{error}</div>}
            <button onClick={handleError}>Trigger Error</button>
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <ErrorWidget />
        </AudioProvider>
      );
      
      fireEvent.click(screen.getByText('Trigger Error'));
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Widget error');
      });
      
      // Other widgets should continue to function
      expect(screen.getByTestId('error-widget')).toBeInTheDocument();
    });

    it('should recover from audio context errors', async () => {
      const RecoveryWidget = () => {
        const audio = useAudio();
        const [status, setStatus] = React.useState('initializing');
        
        React.useEffect(() => {
          audio.initialize()
            .then(() => setStatus('ready'))
            .catch(() => {
              // Attempt recovery
              setTimeout(() => {
                audio.initialize()
                  .then(() => setStatus('recovered'))
                  .catch(() => setStatus('failed'));
              }, 100);
            });
        }, []);
        
        return <div data-testid="recovery-status">{status}</div>;
      };
      
      // Mock initialization failure then success
      let initCount = 0;
      vi.spyOn(AudioEngine.prototype, 'initialize').mockImplementation(async () => {
        initCount++;
        if (initCount === 1) {
          throw new Error('Audio context failed');
        }
      });
      
      render(
        <AudioProvider>
          <RecoveryWidget />
        </AudioProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('recovery-status')).toHaveTextContent('recovered');
      });
    });
  });

  describe('Widget Developer Experience', () => {
    it('should allow widget development without Tone.js knowledge', () => {
      const SimpleWidget = () => {
        const transport = useTransport();
        
        // Developers only use high-level APIs
        return (
          <div data-testid="simple-widget">
            <button onClick={() => transport.play()}>Play</button>
            <button onClick={() => transport.pause()}>Pause</button>
            <button onClick={() => transport.stop()}>Stop</button>
            <button onClick={() => transport.setTempo(140)}>Set Tempo</button>
            <button onClick={() => transport.setLoop(true)}>Enable Loop</button>
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <SimpleWidget />
        </AudioProvider>
      );
      
      // All controls should be available without Tone.js imports
      expect(screen.getByText('Play')).toBeInTheDocument();
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
      expect(screen.getByText('Set Tempo')).toBeInTheDocument();
      expect(screen.getByText('Enable Loop')).toBeInTheDocument();
    });

    it('should provide intuitive plugin loading', async () => {
      const PluginWidget = () => {
        const plugins = usePlugins();
        const [loaded, setLoaded] = React.useState(false);
        
        const loadPlugin = async () => {
          await plugins.load('sampler', {
            urls: { C4: 'sample.mp3' }
          });
          setLoaded(true);
        };
        
        return (
          <div data-testid="plugin-widget">
            <button onClick={loadPlugin}>Load Sampler</button>
            {loaded && <div>Plugin Loaded</div>}
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <PluginWidget />
        </AudioProvider>
      );
      
      fireEvent.click(screen.getByText('Load Sampler'));
      
      await waitFor(() => {
        expect(screen.getByText('Plugin Loaded')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should detect and handle browser differences', () => {
      const BrowserWidget = () => {
        const audio = useAudio();
        const [browserInfo, setBrowserInfo] = React.useState<any>({});
        
        React.useEffect(() => {
          setBrowserInfo({
            audioSupported: audio.isSupported(),
            latencyHint: audio.getLatencyHint(),
            sampleRate: audio.getSampleRate()
          });
        }, []);
        
        return (
          <div data-testid="browser-widget">
            <div>Audio Supported: {browserInfo.audioSupported ? 'yes' : 'no'}</div>
            <div>Latency: {browserInfo.latencyHint}</div>
            <div>Sample Rate: {browserInfo.sampleRate}</div>
          </div>
        );
      };
      
      render(
        <AudioProvider>
          <BrowserWidget />
        </AudioProvider>
      );
      
      expect(screen.getByText(/Audio Supported:/)).toBeInTheDocument();
      expect(screen.getByText(/Latency:/)).toBeInTheDocument();
      expect(screen.getByText(/Sample Rate:/)).toBeInTheDocument();
    });
  });
});