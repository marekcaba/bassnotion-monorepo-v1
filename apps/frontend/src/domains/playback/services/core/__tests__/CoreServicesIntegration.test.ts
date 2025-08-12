import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoreServices, createCoreServices } from '../CoreServices.js';
import { BaseAudioPlugin } from '../../BaseAudioPlugin.js';
import { PluginState, PluginMetadata, PluginConfig, PluginCapabilities } from '../../../types/plugin.js';

// Define PluginState globally for mocks
const PluginStateEnum = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ACTIVE: 'active',
  ERROR: 'error',
};
(global as any).PluginState = PluginStateEnum;

// Mock Tone.js
const mockTone = {
  Transport: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    position: '0:0:0',
    seconds: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
  },
  Sampler: vi.fn(() => ({
    toDestination: vi.fn(),
    dispose: vi.fn(),
  })),
  setContext: vi.fn(),
  context: {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    latencyHint: 'interactive',
  },
};

vi.mock('tone', () => ({
  default: mockTone,
  setContext: mockTone.setContext,
  Transport: mockTone.Transport,
  Sampler: mockTone.Sampler,
  context: mockTone.context,
  now: vi.fn(() => 0),
}));

// Mock dependencies
vi.mock('../../MusicalTimeEngine.js', () => ({
  MusicalTimeEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentPosition: vi.fn(() => ({ measure: 1, beat: 1, subdivision: 0 })),
      getCurrentTick: vi.fn(() => 0),
      subscribeWidget: vi.fn(),
      unsubscribeWidget: vi.fn(),
      setTempo: vi.fn(),
    })),
  },
}));

vi.mock('../../PrecisionSynchronizationEngine.js', () => ({
  PrecisionSynchronizationEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getNextSyncPoint: vi.fn(() => 1.0),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      startSynchronizedPlayback: vi.fn(),
      stopSynchronizedPlayback: vi.fn(),
      pauseSynchronizedPlayback: vi.fn(),
      seekToPosition: vi.fn(),
      scheduleEvent: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

vi.mock('../../PerformanceMonitor.js', () => ({
  PerformanceMonitor: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getMetrics: vi.fn(() => ({
        latency: 0,
        averageLatency: 0,
        maxLatency: 0,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        sampleRate: 44100,
        bufferSize: 128,
        timestamp: Date.now(),
      })),
      recordDropout: vi.fn(),
      recordBufferUnderrun: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

vi.mock('../../errors/CircuitBreaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((fn) => fn()),
    getState: vi.fn(() => 'CLOSED'),
    reset: vi.fn(),
  })),
}));

vi.mock('../../../patterns/CircuitBreaker.js', () => ({
  EnhancedCircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((fn) => fn()),
    getState: vi.fn(() => 'CLOSED'),
    reset: vi.fn(),
    chain: vi.fn(),
    unchain: vi.fn(),
    getMetrics: vi.fn(() => ({
      successCount: 0,
      failureCount: 0,
      rejectedCount: 0,
      state: 'CLOSED',
    })),
    dispose: vi.fn(),
  })),
  CircuitBreakerFactory: vi.fn().mockImplementation(() => ({
    create: vi.fn((name, preset, config) => ({
      execute: vi.fn((fn) => fn()),
      getState: vi.fn(() => 'CLOSED'),
      reset: vi.fn(),
      chain: vi.fn(),
      unchain: vi.fn(),
      getMetrics: vi.fn(() => ({
        successCount: 0,
        failureCount: 0,
        rejectedCount: 0,
        state: 'CLOSED',
      })),
      dispose: vi.fn(),
    })),
    createChain: vi.fn((configs) => ({
      execute: vi.fn((fn) => fn()),
      getState: vi.fn(() => 'CLOSED'),
      reset: vi.fn(),
      chain: vi.fn(),
      unchain: vi.fn(),
      getMetrics: vi.fn(() => ({
        successCount: 0,
        failureCount: 0,
        rejectedCount: 0,
        state: 'CLOSED',
      })),
      dispose: vi.fn(),
    })),
  })),
}));

// Mock plugin for testing
class TestPlugin extends BaseAudioPlugin {
  metadata: PluginMetadata = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test',
    description: 'Integration test plugin',
  };

  config: PluginConfig = {
    autoStart: true,
  };

  capabilities: PluginCapabilities = {
    features: ['test-feature'],
  };

  async process(): Promise<any> {
    return { processed: true };
  }

  protected async onLoad(): Promise<void> {}
  protected async onInitialize(): Promise<void> {}
  protected async onActivate(): Promise<void> {}
  protected async onDeactivate(): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onParameterChanged(): Promise<void> {}
}

// Mock plugin registration
vi.mock('../PluginManager.js', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    registerExistingPlugins: vi.fn().mockResolvedValue(undefined),
  };
});

describe('CoreServices Integration', () => {
  let coreServices: CoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    global.AudioContext = vi.fn().mockImplementation(() => ({
      sampleRate: 48000,
      currentTime: 0,
      state: 'running',
      baseLatency: 0.01,
      outputLatency: 0.01,
      createGain: vi.fn(),
      createBufferSource: vi.fn(),
      createAnalyser: vi.fn(() => ({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
      close: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(async () => {
    if (coreServices) {
      await coreServices.dispose();
    }
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should initialize all services in correct order', async () => {
      coreServices = new CoreServices();
      
      expect(coreServices.isReady()).toBe(false);
      
      await coreServices.initialize();
      
      expect(coreServices.isReady()).toBe(true);
      
      // Verify all services are available
      expect(coreServices.getEventBus()).toBeDefined();
      expect(coreServices.getAudioEngine()).toBeDefined();
      expect(coreServices.getUnifiedTransport()).toBeDefined();
      expect(coreServices.getPluginManager()).toBeDefined();
      expect(coreServices.getServiceRegistry()).toBeDefined();
    });

    it('should initialize with custom config', async () => {
      coreServices = new CoreServices({
        enableHighPrecisionTiming: false,
        enablePerformanceMonitoring: false,
        autoLoadPlugins: false,
        audioLatencyHint: 'playback',
        sampleRate: 44100,
      });

      await coreServices.initialize();

      const status = coreServices.getStatus();
      expect(status.config.enableHighPrecisionTiming).toBe(false);
      expect(status.config.enablePerformanceMonitoring).toBe(false);
      expect(status.config.autoLoadPlugins).toBe(false);
      expect(status.config.audioLatencyHint).toBe('playback');
      expect(status.config.sampleRate).toBe(44100);
    });

    it('should emit initialization event', async () => {
      coreServices = new CoreServices();
      const eventBus = coreServices.getEventBus();
      const eventHandler = vi.fn();
      
      eventBus.on('core-services:initialized', eventHandler);
      
      await coreServices.initialize();
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          services: ['eventBus', 'audioEngine', 'transportController', 'pluginManager'],
        }),
        expect.any(Object)
      );
    });

    it('should not initialize twice', async () => {
      coreServices = new CoreServices();
      
      await coreServices.initialize();
      const eventBus = coreServices.getEventBus();
      const eventHandler = vi.fn();
      eventBus.on('core-services:initialized', eventHandler);
      
      await coreServices.initialize();
      
      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('service lifecycle', () => {
    beforeEach(async () => {
      coreServices = new CoreServices();
      await coreServices.initialize();
    });

    it('should start all services', async () => {
      const eventBus = coreServices.getEventBus();
      const eventHandler = vi.fn();
      eventBus.on('core-services:started', eventHandler);

      await coreServices.start();

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should stop all services', async () => {
      coreServices = new CoreServices();
      await coreServices.initialize();
      await coreServices.start();
      
      const transportController = coreServices.getUnifiedTransport();
      
      // After starting services, transport is playing
      expect(transportController.getState()).toBe('playing');
      
      await coreServices.stop();
      
      // After stopping, transport should be stopped
      expect(transportController.getState()).toBe('stopped');
      
      // Verify services are stopped via registry report
      const registryReport = coreServices.getServiceRegistry().getServiceReport();
      expect(Object.values(registryReport).every(s => s.status === 'stopped')).toBe(true);
    });

    it('should dispose all services', async () => {
      coreServices = new CoreServices();
      await coreServices.initialize();
      
      expect(coreServices.isReady()).toBe(true);
      
      await coreServices.dispose();
      
      expect(coreServices.isReady()).toBe(false);
      
      // Verify attempting to use services after dispose throws
      await expect(coreServices.start()).rejects.toThrow('CoreServices not initialized');
      
      // Reset coreServices for cleanup
      coreServices = null as any;
    });

    it('should handle start error when not initialized', async () => {
      const uninitializedServices = new CoreServices();
      
      await expect(uninitializedServices.start()).rejects.toThrow(
        'CoreServices not initialized'
      );
    });
  });

  describe('service interactions', () => {
    beforeEach(async () => {
      coreServices = await createCoreServices({ autoLoadPlugins: false });
    });

    it('should coordinate transport and audio engine', async () => {
      const transport = coreServices.getUnifiedTransport();
      const eventBus = coreServices.getEventBus();
      const eventHandler = vi.fn();
      
      eventBus.on('transport:started', eventHandler);
      
      await transport.start();
      
      expect(mockTone.Transport.start).toHaveBeenCalled();
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should handle plugin registration and activation', async () => {
      const pluginManager = coreServices.getPluginManager();
      const eventBus = coreServices.getEventBus();
      const plugin = new TestPlugin();
      
      const registeredHandler = vi.fn();
      const activatedHandler = vi.fn();
      
      eventBus.on('plugin-manager:plugin-registered', registeredHandler);
      eventBus.on('plugin-manager:plugin-activated', activatedHandler);
      
      await pluginManager.register(plugin);
      await pluginManager.activatePlugin('test-plugin');
      
      expect(registeredHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin' }),
        expect.any(Object)
      );
      expect(activatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin' }),
        expect.any(Object)
      );
    });

    it('should create audio samplers through audio engine', async () => {
      const audioEngine = coreServices.getAudioEngine();
      
      const sampler = await audioEngine.createSampler({
        urls: { C4: 'sample.mp3' },
        baseUrl: '/samples/',
      });
      
      expect(mockTone.Sampler).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: { C4: 'sample.mp3' },
          baseUrl: '/samples/',
        })
      );
      expect(sampler).toBeDefined();
    });
  });

  describe('event flow', () => {
    beforeEach(async () => {
      coreServices = await createCoreServices({ autoLoadPlugins: false });
    });

    it('should propagate transport events to plugins', async () => {
      const pluginManager = coreServices.getPluginManager();
      const transport = coreServices.getUnifiedTransport();
      const eventBus = coreServices.getEventBus();
      
      // Create and register a plugin
      const plugin = new TestPlugin();
      const transportHandler = vi.fn();
      
      await pluginManager.register(plugin);
      await pluginManager.activatePlugin('test-plugin');
      
      // Listen for transport events
      eventBus.on('transport:started', transportHandler);
      
      // Start transport
      await transport.start();
      
      // Event should be emitted
      expect(transportHandler).toHaveBeenCalled();
    });

    it('should handle error events across services', async () => {
      const eventBus = coreServices.getEventBus();
      const errorHandler = vi.fn();
      
      eventBus.on('plugin-manager:error', errorHandler);
      
      // Simulate an error in plugin loading
      const pluginManager = coreServices.getPluginManager();
      const faultyPlugin = new TestPlugin();
      faultyPlugin.load = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      await pluginManager.register(faultyPlugin);
      await pluginManager.loadAllPlugins();
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          operation: 'load',
        }),
        expect.any(Object)
      );
    });
  });

  describe('status reporting', () => {
    beforeEach(async () => {
      coreServices = await createCoreServices({ autoLoadPlugins: false });
    });

    it('should report comprehensive status', async () => {
      const status = coreServices.getStatus();
      
      expect(status).toMatchObject({
        initialized: true,
        services: {
          eventBus: { ready: true },
          audioEngine: {
            ready: true,
            sampleRate: expect.any(Number),
          },
          transportController: {
            ready: true,
            state: 'stopped',
            tempo: 120,
          },
          pluginManager: {
            ready: true,
            pluginCount: 0,
          },
        },
        config: expect.any(Object),
      });
    });

    it('should update status after plugin registration', async () => {
      const pluginManager = coreServices.getPluginManager();
      const plugin = new TestPlugin();
      
      await pluginManager.register(plugin);
      
      const status = coreServices.getStatus();
      expect(status.services.pluginManager.pluginCount).toBe(1);
    });

    it('should update status after transport state change', async () => {
      const transport = coreServices.getUnifiedTransport();
      
      await transport.start();
      
      const status = coreServices.getStatus();
      expect(status.services.transportController.state).toBe('playing');
    });
  });

  describe('memory management', () => {
    it('should clean up resources on dispose', async () => {
      coreServices = await createCoreServices({ autoLoadPlugins: false });
      
      // Register and activate a plugin
      const pluginManager = coreServices.getPluginManager();
      const plugin = new TestPlugin();
      vi.spyOn(plugin, 'dispose');
      
      await pluginManager.register(plugin);
      await pluginManager.activatePlugin('test-plugin');
      
      // Dispose everything
      await coreServices.dispose();
      
      // Verify cleanup
      expect(plugin.dispose).toHaveBeenCalled();
      expect(pluginManager.getAllPlugins().size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock AudioContext creation failure
      global.AudioContext = vi.fn().mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });
      
      coreServices = new CoreServices();
      
      await expect(coreServices.initialize()).rejects.toThrow(
        'Failed to initialize CoreServices'
      );
    });

    it('should handle service start errors', async () => {
      coreServices = new CoreServices();
      await coreServices.initialize();
      
      // Mock a service start failure
      const registry = coreServices.getServiceRegistry();
      registry.start = vi.fn().mockRejectedValue(new Error('Service start failed'));
      
      await expect(coreServices.start()).rejects.toThrow(
        'Failed to start CoreServices'
      );
    });
  });
});
