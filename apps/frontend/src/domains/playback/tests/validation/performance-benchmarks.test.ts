import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { AudioEngine } from '../../services/core/AudioEngine.js';
import { EventBus } from '../../services/core/EventBus.js';
import { UnifiedTransport } from '../../services/core/UnifiedTransport.js';
import { PluginManager } from '../../services/core/PluginManager.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Benchmarks', () => {
  let serviceRegistry: ServiceRegistry;
  let memoryBaseline: number;

  beforeEach(() => {
    // Capture memory baseline
    if (performance.memory) {
      memoryBaseline = performance.memory.usedJSHeapSize;
    }
  });

  afterEach(async () => {
    // Cleanup
    if (serviceRegistry) {
      await serviceRegistry.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('System Initialization Performance', () => {
    it('should initialize complete system under 2 seconds', async () => {
      const startTime = performance.now();

      // Initialize complete system
      serviceRegistry = new ServiceRegistry();
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      const transportController = new UnifiedTransport(audioEngine, eventBus);
      const pluginManager = new PluginManager(audioEngine, eventBus);

      serviceRegistry.register('eventBus', eventBus);
      serviceRegistry.register('audioEngine', audioEngine);
      serviceRegistry.register('transport', transportController);
      serviceRegistry.register('plugins', pluginManager);

      await serviceRegistry.initialize();

      const endTime = performance.now();
      const initTime = endTime - startTime;

      expect(initTime).toBeLessThan(2000);

      // Log for benchmark records
      console.log(`System initialization time: ${initTime.toFixed(2)}ms`);
    });

    it('should initialize individual services quickly', async () => {
      const benchmarks: Record<string, number> = {};

      // Test AudioEngine initialization
      let start = performance.now();
      const audioEngine = new AudioEngine(new EventBus());
      await audioEngine.initialize();
      benchmarks.audioEngine = performance.now() - start;

      // Test UnifiedTransport initialization
      start = performance.now();
      const transportController = new UnifiedTransport(
        audioEngine,
        new EventBus(),
      );
      await transportController.initialize();
      benchmarks.transport = performance.now() - start;

      // Test PluginManager initialization
      start = performance.now();
      const pluginManager = new PluginManager(audioEngine, new EventBus());
      await pluginManager.initialize();
      benchmarks.plugins = performance.now() - start;

      // All services should initialize quickly
      Object.entries(benchmarks).forEach(([service, time]) => {
        expect(time).toBeLessThan(500); // Each service < 500ms
        console.log(`${service} initialization: ${time.toFixed(2)}ms`);
      });
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should use less than 50% memory of old system', async () => {
      // Initialize new system
      serviceRegistry = new ServiceRegistry();
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      const transportController = new UnifiedTransport(audioEngine, eventBus);
      const pluginManager = new PluginManager(audioEngine, eventBus);

      serviceRegistry.register('eventBus', eventBus);
      serviceRegistry.register('audioEngine', audioEngine);
      serviceRegistry.register('transport', transportController);
      serviceRegistry.register('plugins', pluginManager);

      await serviceRegistry.initialize();

      // Load some plugins to simulate real usage
      await pluginManager.load('sampler', { urls: { C4: 'test.mp3' } });
      await pluginManager.load('synth', { oscillator: { type: 'sine' } });

      // Measure memory after initialization
      if (performance.memory) {
        const currentMemory = performance.memory.usedJSHeapSize;
        const memoryUsed = currentMemory - memoryBaseline;
        const memoryUsedMB = memoryUsed / (1024 * 1024);

        // Old system baseline was ~200MB, we target < 100MB
        expect(memoryUsedMB).toBeLessThan(100);

        console.log(`Memory usage: ${memoryUsedMB.toFixed(2)}MB`);
      }
    });

    it('should not leak memory during extended operation', async () => {
      if (!performance.memory) {
        console.warn('Memory API not available, skipping leak test');
        return;
      }

      // Initialize system
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      const transportController = new UnifiedTransport(audioEngine, eventBus);

      await audioEngine.initialize();
      await transportController.initialize();

      // Capture initial memory
      const initialMemory = performance.memory.usedJSHeapSize;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await transportController.setTempo(120 + (i % 60));
        await transportController.seek(i % 100);
        eventBus.emit('test:event', { index: i });
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      // Check memory after operations
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);

      // Should not grow more than 10MB
      expect(memoryGrowth).toBeLessThan(10);

      console.log(
        `Memory growth after 1000 operations: ${memoryGrowth.toFixed(2)}MB`,
      );
    });
  });

  describe('Audio Performance and Reliability', () => {
    it('should achieve >99% audio initialization success rate', async () => {
      const attempts = 100;
      let successes = 0;
      const failures: string[] = [];

      for (let i = 0; i < attempts; i++) {
        try {
          const audioEngine = new AudioEngine(new EventBus());
          await audioEngine.initialize();

          // Verify audio context is running
          const context = audioEngine.getContext();
          if (context.state === 'running') {
            successes++;
          } else {
            failures.push(`Attempt ${i}: Context state ${context.state}`);
          }

          // Cleanup
          await audioEngine.cleanup();
        } catch (error) {
          failures.push(`Attempt ${i}: ${(error as Error).message}`);
        }
      }

      const successRate = (successes / attempts) * 100;
      expect(successRate).toBeGreaterThan(99);

      console.log(`Audio initialization success rate: ${successRate}%`);
      if (failures.length > 0) {
        console.log('Failures:', failures);
      }
    });

    it('should handle sustained playback without dropouts', async () => {
      const audioEngine = new AudioEngine(new EventBus());
      const transportController = new UnifiedTransport(
        audioEngine,
        new EventBus(),
      );

      await audioEngine.initialize();
      await transportController.initialize();

      let dropouts = 0;
      let measurements = 0;

      // Monitor for dropouts
      const checkInterval = setInterval(() => {
        const context = audioEngine.getContext();
        measurements++;

        // Check if context is suspended (potential dropout)
        if (context.state !== 'running') {
          dropouts++;
        }
      }, 100);

      // Start playback
      await transportController.play();

      // Run for 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Stop monitoring
      clearInterval(checkInterval);
      await transportController.stop();

      const dropoutRate = (dropouts / measurements) * 100;
      expect(dropoutRate).toBe(0);

      console.log(`Dropout rate over 5 seconds: ${dropoutRate}%`);
    });
  });

  describe('CPU Usage Optimization', () => {
    it('should maintain low CPU usage during playback', async () => {
      // This is a simplified test - real CPU measurement would require native tools
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      const transportController = new UnifiedTransport(audioEngine, eventBus);
      const pluginManager = new PluginManager(audioEngine, eventBus);

      await audioEngine.initialize();
      await transportController.initialize();
      await pluginManager.initialize();

      // Load multiple plugins
      await pluginManager.load('drums', { volume: -12 });
      await pluginManager.load('bass', { volume: -10 });
      await pluginManager.load('harmony', { volume: -15 });

      // Start playback
      await transportController.play();

      // Measure event processing performance
      const eventCount = 10000;
      const startTime = performance.now();

      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('transport:position', { position: i / 1000 });
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const eventsPerSecond = (eventCount / processingTime) * 1000;

      // Should handle at least 100k events per second
      expect(eventsPerSecond).toBeGreaterThan(100000);

      console.log(
        `Event processing rate: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      await transportController.stop();
    });
  });

  describe('Service Count and Code Reduction', () => {
    it('should validate service count reduced from 56+ to 5', () => {
      const coreServicesPath = path.resolve(__dirname, '../../services/core');
      const coreServiceFiles = fs
        .readdirSync(coreServicesPath)
        .filter(
          (file) =>
            file.endsWith('.ts') &&
            !file.includes('test') &&
            !file.includes('spec'),
        );

      // Should have exactly 5 core service files + index + CoreServices
      const expectedFiles = [
        'AudioEngine.ts',
        'EventBus.ts',
        'ServiceRegistry.ts',
        'UnifiedTransport.ts',
        'PluginManager.ts',
        'index.ts',
        'CoreServices.ts',
      ];

      expect(coreServiceFiles.length).toBe(expectedFiles.length);

      // Verify old service files don't exist
      const oldServicesPath = path.resolve(__dirname, '../../services');
      const oldServicePatterns = [
        'MobileOptimizer.ts',
        'IOSOptimizer.ts',
        'AndroidOptimizer.ts',
        'QualityScaler.ts',
        'BatteryManager.ts',
        'NetworkLatencyMonitor.ts',
        'MemoryLeakDetector.ts',
        'ToneInstanceManager.ts',
      ];

      oldServicePatterns.forEach((pattern) => {
        const filePath = path.join(oldServicesPath, pattern);
        expect(fs.existsSync(filePath)).toBe(false);
      });

      console.log('Core services verified:', coreServiceFiles);
    });

    it('should measure lines of code reduction', () => {
      const coreServicesPath = path.resolve(__dirname, '../../services/core');
      let totalLines = 0;

      const coreFiles = [
        'AudioEngine.ts',
        'EventBus.ts',
        'ServiceRegistry.ts',
        'UnifiedTransport.ts',
        'PluginManager.ts',
      ];

      coreFiles.forEach((file) => {
        const filePath = path.join(coreServicesPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').length;
          totalLines += lines;
          console.log(`${file}: ${lines} lines`);
        }
      });

      // Target is < 5000 lines (was 50,000+)
      expect(totalLines).toBeLessThan(5000);

      console.log(`Total lines of core services: ${totalLines}`);
    });
  });

  describe('Event System Performance', () => {
    it('should handle high-frequency events efficiently', async () => {
      const eventBus = new EventBus();
      const eventCount = 100000;
      let receivedCount = 0;

      // Subscribe to events
      eventBus.on('perf:test', () => {
        receivedCount++;
      });

      const startTime = performance.now();

      // Emit many events
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('perf:test', { index: i });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const eventsPerSecond = (eventCount / duration) * 1000;

      expect(receivedCount).toBe(eventCount);
      expect(duration).toBeLessThan(1000); // 100k events in < 1 second

      console.log(
        `Event system performance: ${eventsPerSecond.toFixed(0)} events/second`,
      );
    });

    it('should handle concurrent event subscriptions efficiently', () => {
      const eventBus = new EventBus();
      const subscriberCount = 1000;
      let totalReceived = 0;

      // Add many subscribers
      for (let i = 0; i < subscriberCount; i++) {
        eventBus.on('concurrent:test', () => {
          totalReceived++;
        });
      }

      const startTime = performance.now();

      // Emit event (should trigger all subscribers)
      eventBus.emit('concurrent:test', {});

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(totalReceived).toBe(subscriberCount);
      expect(duration).toBeLessThan(10); // Should handle 1000 subscribers in < 10ms

      console.log(
        `Time to notify ${subscriberCount} subscribers: ${duration.toFixed(2)}ms`,
      );
    });
  });

  describe('Plugin System Performance', () => {
    it('should load plugins quickly', async () => {
      const audioEngine = new AudioEngine(new EventBus());
      const pluginManager = new PluginManager(audioEngine, new EventBus());

      await audioEngine.initialize();
      await pluginManager.initialize();

      const pluginTypes = ['sampler', 'synth', 'effects', 'analyzer'];
      const loadTimes: Record<string, number> = {};

      for (const type of pluginTypes) {
        const startTime = performance.now();
        await pluginManager.load(type, {});
        loadTimes[type] = performance.now() - startTime;
      }

      // Each plugin should load quickly
      Object.entries(loadTimes).forEach(([type, time]) => {
        expect(time).toBeLessThan(100); // < 100ms per plugin
        console.log(`${type} load time: ${time.toFixed(2)}ms`);
      });
    });

    it('should handle many concurrent plugins efficiently', async () => {
      const audioEngine = new AudioEngine(new EventBus());
      const pluginManager = new PluginManager(audioEngine, new EventBus());

      await audioEngine.initialize();
      await pluginManager.initialize();

      const pluginCount = 50;
      const startTime = performance.now();

      // Load many plugins concurrently
      const loadPromises = Array(pluginCount)
        .fill(null)
        .map((_, i) => pluginManager.load(`plugin-${i}`, { id: i }));

      await Promise.all(loadPromises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // 50 plugins in < 1 second

      console.log(`Loaded ${pluginCount} plugins in ${totalTime.toFixed(2)}ms`);
    });
  });
});
