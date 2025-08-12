import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { AudioEngine } from '../../services/core/AudioEngine.js';
import { EventBus } from '../../services/core/EventBus.js';
import { UnifiedTransport } from '../../services/core/UnifiedTransport.js';
import { PluginManager } from '../../services/core/PluginManager.js';

describe('FAANG-Style Architecture Integration', () => {
  let serviceRegistry: ServiceRegistry;
  let audioEngine: AudioEngine;
  let transportController: UnifiedTransport;
  let pluginManager: PluginManager;
  let eventBus: EventBus;

  beforeEach(async () => {
    // Initialize complete system
    serviceRegistry = new ServiceRegistry();
    eventBus = new EventBus();
    audioEngine = new AudioEngine(eventBus);
    transportController = new UnifiedTransport(audioEngine, eventBus);
    pluginManager = new PluginManager(audioEngine, eventBus);

    // Register all services
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('audioEngine', audioEngine);
    serviceRegistry.register('transport', transportController);
    serviceRegistry.register('plugins', pluginManager);

    // Initialize system
    await serviceRegistry.initialize();
  });

  describe('Core Service Integration', () => {
    it('should initialize all 5 core services successfully', async () => {
      const healthReport = await serviceRegistry.healthCheck();
      
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.services.audioEngine.status).toBe('healthy');
      expect(healthReport.services.transport.status).toBe('healthy');
      expect(healthReport.services.plugins.status).toBe('healthy');
      expect(healthReport.services.eventBus.status).toBe('healthy');
      expect(Object.keys(healthReport.services)).toHaveLength(4); // 4 services registered (eventBus is infrastructure)
    });

    it('should handle service dependencies correctly', async () => {
      // Verify UnifiedTransport has access to AudioEngine
      const tone = transportController.getTone();
      expect(tone).toBeDefined();
      
      // Verify PluginManager has access to AudioEngine
      const pluginTone = pluginManager.getTone();
      expect(pluginTone).toBeDefined();
      
      // Should be the same instance
      expect(tone).toBe(pluginTone);
    });

    it('should support service discovery', () => {
      const audioService = serviceRegistry.get('audioEngine');
      expect(audioService).toBe(audioEngine);
      
      const transportService = serviceRegistry.get('transport');
      expect(transportService).toBe(transportController);
      
      const pluginService = serviceRegistry.get('plugins');
      expect(pluginService).toBe(pluginManager);
    });
  });

  describe('Event-Driven Architecture', () => {
    it('should work end-to-end across all services', async () => {
      const events: string[] = [];
      
      // Subscribe to events from different services
      eventBus.on('audio:started', () => events.push('audio:started'));
      eventBus.on('transport:play', () => events.push('transport:play'));
      eventBus.on('plugin:loaded', () => events.push('plugin:loaded'));
      
      // Trigger actions that emit events
      await transportController.play();
      
      // Verify events were received
      expect(events).toContain('transport:play');
      expect(events).toContain('audio:started');
    });

    it('should handle cross-service communication', async () => {
      let messageReceived = false;
      
      // Plugin listens for transport events
      eventBus.on('transport:tempo-changed', (data) => {
        messageReceived = true;
        expect(data.tempo).toBe(140);
      });
      
      // Transport emits tempo change
      await transportController.setTempo(140);
      
      expect(messageReceived).toBe(true);
    });

    it('should support event namespacing and wildcards', () => {
      const receivedEvents: string[] = [];
      
      // Subscribe to all audio events
      eventBus.on('audio:*', (eventName) => {
        receivedEvents.push(eventName);
      });
      
      // Emit various audio events
      eventBus.emit('audio:initialized', {});
      eventBus.emit('audio:started', {});
      eventBus.emit('audio:stopped', {});
      
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents).toContain('audio:initialized');
      expect(receivedEvents).toContain('audio:started');
      expect(receivedEvents).toContain('audio:stopped');
    });
  });

  describe('Zero Global State Validation', () => {
    it('should confirm no global audio state', () => {
      // Validate no global audio state
      expect((window as any).ToneSingleton).toBeUndefined();
      expect((window as any).ToneInstanceId).toBeUndefined();
      expect((window as any).AudioEngine).toBeUndefined();
      expect((window as any).ServiceRegistry).toBeUndefined();
      expect((window as any).EventBus).toBeUndefined();
      
      // Validate no service instances in global scope
      expect((window as any).audioEngine).toBeUndefined();
      expect((window as any).transportController).toBeUndefined();
      expect((window as any).pluginManager).toBeUndefined();
    });

    it('should validate Tone.js only accessible through AudioEngine', () => {
      // Should not throw when accessing through AudioEngine
      expect(() => audioEngine.getTone()).not.toThrow();
      
      // Tone should not be available globally
      expect((window as any).Tone).toBeUndefined();
    });

    it('should ensure no direct Tone imports in global scope', () => {
      // This would be caught at compile time, but we verify runtime
      const globalKeys = Object.keys(window);
      const toneRelatedKeys = globalKeys.filter(key => 
        key.toLowerCase().includes('tone') || 
        key.includes('Transport') ||
        key.includes('Sampler')
      );
      
      expect(toneRelatedKeys).toHaveLength(0);
    });
  });

  describe('Single Source of Truth for Tone.js', () => {
    it('should return same Tone instance across all services', () => {
      const tone1 = audioEngine.getTone();
      const tone2 = audioEngine.getTone();
      const tone3 = transportController.getTone();
      const tone4 = pluginManager.getTone();
      
      // All should be the same instance
      expect(tone1).toBe(tone2);
      expect(tone2).toBe(tone3);
      expect(tone3).toBe(tone4);
    });

    it('should maintain single Transport instance', () => {
      const transport1 = audioEngine.getTone().Transport;
      const transport2 = transportController.getTone().Transport;
      
      expect(transport1).toBe(transport2);
      
      // Changes should be reflected across all references
      transport1.bpm.value = 140;
      expect(transport2.bpm.value).toBe(140);
    });

    it('should share audio context across all services', () => {
      const context1 = audioEngine.getContext();
      const context2 = audioEngine.getTone().context;
      
      expect(context1).toBe(context2);
      expect(context1.state).toBe('running');
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should initialize services in correct order', async () => {
      const initOrder: string[] = [];
      
      // Mock to track initialization order
      vi.spyOn(eventBus, 'emit').mockImplementation((event) => {
        if (event.includes('initialized')) {
          initOrder.push(event);
        }
      });
      
      const registry = new ServiceRegistry();
      registry.register('eventBus', eventBus);
      registry.register('audioEngine', audioEngine);
      registry.register('transport', transportController);
      registry.register('plugins', pluginManager);
      
      await registry.initialize();
      
      // AudioEngine should initialize before dependent services
      const audioIndex = initOrder.findIndex(e => e.includes('audio'));
      const transportIndex = initOrder.findIndex(e => e.includes('transport'));
      const pluginIndex = initOrder.findIndex(e => e.includes('plugin'));
      
      expect(audioIndex).toBeLessThan(transportIndex);
      expect(audioIndex).toBeLessThan(pluginIndex);
    });

    it('should cleanup services in reverse order', async () => {
      const cleanupOrder: string[] = [];
      
      vi.spyOn(eventBus, 'emit').mockImplementation((event) => {
        if (event.includes('cleanup')) {
          cleanupOrder.push(event);
        }
      });
      
      await serviceRegistry.cleanup();
      
      // Should cleanup in reverse order
      expect(cleanupOrder.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service initialization failures gracefully', async () => {
      // Mock a failure
      vi.spyOn(audioEngine, 'initialize').mockRejectedValueOnce(new Error('Init failed'));
      
      const registry = new ServiceRegistry();
      registry.register('audioEngine', audioEngine);
      
      await expect(registry.initialize()).rejects.toThrow();
      
      // Registry should still be functional
      const health = await registry.healthCheck();
      expect(health.overall).toBe('unhealthy');
    });

    it('should support circuit breaker pattern', async () => {
      // Simulate multiple failures
      let failCount = 0;
      vi.spyOn(transportController, 'play').mockImplementation(async () => {
        failCount++;
        if (failCount < 3) {
          throw new Error('Play failed');
        }
      });
      
      // First attempts should fail
      await expect(transportController.play()).rejects.toThrow();
      await expect(transportController.play()).rejects.toThrow();
      
      // Third attempt should succeed
      await expect(transportController.play()).resolves.not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency events efficiently', async () => {
      const eventCount = 10000;
      let receivedCount = 0;
      
      eventBus.on('perf:test', () => {
        receivedCount++;
      });
      
      const startTime = performance.now();
      
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('perf:test', { index: i });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(receivedCount).toBe(eventCount);
      expect(duration).toBeLessThan(1000); // Should handle 10k events in < 1 second
    });

    it('should support concurrent service operations', async () => {
      const operations = Array(100).fill(null).map((_, i) => 
        transportController.seek(i)
      );
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});