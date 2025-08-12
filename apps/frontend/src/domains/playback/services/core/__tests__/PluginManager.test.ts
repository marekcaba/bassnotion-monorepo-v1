import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginManager, PluginError } from '../PluginManager.js';
import { AudioEngine } from '../AudioEngine.js';
import { EventBus } from '../EventBus.js';
import { BaseAudioPlugin } from '../../BaseAudioPlugin.js';
import { PluginState, PluginMetadata, PluginConfig, PluginCapabilities } from '../../../types/plugin.js';

// Mock AudioPlugin implementation
class MockPlugin extends BaseAudioPlugin {
  metadata: PluginMetadata = {
    id: 'mock-plugin',
    name: 'Mock Plugin',
    version: '1.0.0',
    author: 'Test',
    description: 'Test plugin',
  };

  config: PluginConfig = {
    autoStart: false,
  };

  capabilities: PluginCapabilities = {
    features: ['audio-processing', 'midi-support'],
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

// Mock AudioContext
class MockAudioContext {
  sampleRate = 48000;
  currentTime = 0;
  baseLatency = 0.01;
  state = 'running';
}

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let audioEngine: AudioEngine;
  let eventBus: EventBus;
  let mockContext: MockAudioContext;
  let mockTone: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mocks
    mockContext = new MockAudioContext();
    mockTone = { Transport: {}, Sampler: vi.fn() };
    eventBus = new EventBus();
    
    // Mock AudioEngine
    audioEngine = {
      getContext: vi.fn(() => mockContext),
      getTone: vi.fn(() => mockTone),
    } as any;

    pluginManager = new PluginManager(audioEngine, eventBus);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.initialize();

      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:initialized', {});
      expect(audioEngine.getContext).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await pluginManager.initialize();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.initialize();

      expect(emitSpy).not.toHaveBeenCalledWith('plugin-manager:initialized', {});
    });

    it('should handle initialization errors', async () => {
      audioEngine.getContext = vi.fn(() => {
        throw new Error('Context error');
      });

      await expect(pluginManager.initialize()).rejects.toThrow(PluginError);
    });
  });

  describe('plugin registration', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('should register a plugin successfully', async () => {
      const plugin = new MockPlugin();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.register(plugin);

      expect(pluginManager.getPlugin('mock-plugin')).toBe(plugin);
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-registered', {
        pluginId: 'mock-plugin',
        metadata: plugin.metadata,
      });
    });

    it('should not register duplicate plugins', async () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();

      await pluginManager.register(plugin1);
      await expect(pluginManager.register(plugin2)).rejects.toThrow(PluginError);
    });

    it('should validate plugin dependencies', async () => {
      const plugin = new MockPlugin();
      plugin.metadata.id = 'dependent-plugin';

      await expect(
        pluginManager.register(plugin, ['non-existent-plugin'])
      ).rejects.toThrow(PluginError);
    });

    it('should register plugin with valid dependencies', async () => {
      const dependency = new MockPlugin();
      dependency.metadata.id = 'dependency-plugin';
      
      const dependent = new MockPlugin();
      dependent.metadata.id = 'dependent-plugin';

      await pluginManager.register(dependency);
      await pluginManager.register(dependent, ['dependency-plugin']);

      expect(pluginManager.getPlugin('dependent-plugin')).toBe(dependent);
    });
  });

  describe('plugin lifecycle', () => {
    let plugin: MockPlugin;

    beforeEach(async () => {
      await pluginManager.initialize();
      plugin = new MockPlugin();
      vi.spyOn(plugin, 'load');
      vi.spyOn(plugin, 'initialize');
      vi.spyOn(plugin, 'activate');
      vi.spyOn(plugin, 'deactivate');
      vi.spyOn(plugin, 'dispose');
      await pluginManager.register(plugin);
    });

    it('should load a plugin', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.loadPlugin('mock-plugin');

      expect(plugin.load).toHaveBeenCalled();
      expect(plugin.initialize).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-loaded', {
        pluginId: 'mock-plugin',
        state: expect.any(String),
      });
    });

    it('should load dependencies before plugin', async () => {
      const dependency = new MockPlugin();
      dependency.metadata.id = 'dependency-plugin';
      vi.spyOn(dependency, 'load');
      vi.spyOn(dependency, 'initialize');
      
      const dependent = new MockPlugin();
      dependent.metadata.id = 'dependent-plugin';
      vi.spyOn(dependent, 'load');
      vi.spyOn(dependent, 'initialize');

      await pluginManager.register(dependency);
      await pluginManager.register(dependent, ['dependency-plugin']);

      await pluginManager.loadPlugin('dependent-plugin');

      expect(dependency.load).toHaveBeenCalled();
      expect(dependency.initialize).toHaveBeenCalled();
      expect(dependent.load).toHaveBeenCalled();
      expect(dependent.initialize).toHaveBeenCalled();
    });

    it('should activate a plugin', async () => {
      await pluginManager.loadPlugin('mock-plugin');
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.activatePlugin('mock-plugin');

      expect(plugin.activate).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-activated', {
        pluginId: 'mock-plugin',
        state: expect.any(String),
      });
    });

    it('should deactivate a plugin', async () => {
      await pluginManager.loadPlugin('mock-plugin');
      await pluginManager.activatePlugin('mock-plugin');
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.deactivatePlugin('mock-plugin');

      expect(plugin.deactivate).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-deactivated', {
        pluginId: 'mock-plugin',
        state: expect.any(String),
      });
    });
  });

  describe('plugin queries', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('should get plugin by id', async () => {
      const plugin = new MockPlugin();
      await pluginManager.register(plugin);

      expect(pluginManager.getPlugin('mock-plugin')).toBe(plugin);
    });

    it('should throw error for non-existent plugin', () => {
      expect(() => pluginManager.getPlugin('non-existent')).toThrow(PluginError);
    });

    it('should get all plugins', async () => {
      const plugin1 = new MockPlugin();
      plugin1.metadata.id = 'plugin1';
      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'plugin2';

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins.size).toBe(2);
      expect(allPlugins.get('plugin1')).toBe(plugin1);
      expect(allPlugins.get('plugin2')).toBe(plugin2);
    });

    it('should get plugins by capability', async () => {
      const plugin1 = new MockPlugin();
      plugin1.metadata.id = 'plugin1';
      plugin1.capabilities = { features: ['audio-processing'] };
      
      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'plugin2';
      plugin2.capabilities = { features: ['midi-support'] };
      
      const plugin3 = new MockPlugin();
      plugin3.metadata.id = 'plugin3';
      plugin3.capabilities = { features: ['audio-processing', 'midi-support'] };

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);
      await pluginManager.register(plugin3);

      const audioPlugins = pluginManager.getPluginsByCapability('audio-processing');
      expect(audioPlugins).toHaveLength(2);
      expect(audioPlugins).toContain(plugin1);
      expect(audioPlugins).toContain(plugin3);
    });

    it('should get plugin state', async () => {
      const plugin = new MockPlugin();
      await pluginManager.register(plugin);

      expect(pluginManager.getPluginState('mock-plugin')).toBe(PluginState.UNLOADED);

      await pluginManager.loadPlugin('mock-plugin');
      expect(pluginManager.getPluginState('mock-plugin')).toBe(PluginState.INACTIVE);
    });
  });

  describe('batch operations', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('should load all plugins in dependency order', async () => {
      const plugin1 = new MockPlugin();
      plugin1.metadata.id = 'plugin1';
      vi.spyOn(plugin1, 'load');
      
      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'plugin2';
      vi.spyOn(plugin2, 'load');
      
      const plugin3 = new MockPlugin();
      plugin3.metadata.id = 'plugin3';
      vi.spyOn(plugin3, 'load');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2, ['plugin1']);
      await pluginManager.register(plugin3, ['plugin2']);

      await pluginManager.loadAllPlugins();

      expect(plugin1.load).toHaveBeenCalled();
      expect(plugin2.load).toHaveBeenCalled();
      expect(plugin3.load).toHaveBeenCalled();
    });

    it('should handle errors during batch loading', async () => {
      const plugin1 = new MockPlugin();
      plugin1.metadata.id = 'plugin1';
      plugin1.load = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'plugin2';
      vi.spyOn(plugin2, 'load');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.loadAllPlugins();

      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:error', expect.objectContaining({
        pluginId: 'plugin1',
        operation: 'load',
      }));
      expect(plugin2.load).toHaveBeenCalled();
    });
  });

  describe('service lifecycle', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('should start service and auto-start plugins', async () => {
      const autoStartPlugin = new MockPlugin();
      autoStartPlugin.metadata.id = 'auto-start';
      autoStartPlugin.config.autoStart = true;
      vi.spyOn(autoStartPlugin, 'load');
      vi.spyOn(autoStartPlugin, 'activate');

      await pluginManager.register(autoStartPlugin);

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.start();

      expect(autoStartPlugin.load).toHaveBeenCalled();
      expect(autoStartPlugin.activate).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:started', {});
    });

    it('should stop service and deactivate plugins', async () => {
      const plugin = new MockPlugin();
      vi.spyOn(plugin, 'deactivate');
      
      await pluginManager.register(plugin);
      await pluginManager.loadPlugin('mock-plugin');
      await pluginManager.activatePlugin('mock-plugin');

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.stop();

      expect(plugin.deactivate).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:stopped', {});
    });

    it('should dispose all plugins', async () => {
      const plugin1 = new MockPlugin();
      plugin1.metadata.id = 'plugin1';
      vi.spyOn(plugin1, 'dispose');
      
      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'plugin2';
      vi.spyOn(plugin2, 'dispose');

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await pluginManager.dispose();

      expect(plugin1.dispose).toHaveBeenCalled();
      expect(plugin2.dispose).toHaveBeenCalled();
      expect(pluginManager.getAllPlugins().size).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:disposed', {});
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('should notify active plugins of transport events', async () => {
      const plugin = new MockPlugin();
      plugin.onTransportStarted = vi.fn();
      
      await pluginManager.register(plugin);
      await pluginManager.loadPlugin('mock-plugin');
      await pluginManager.activatePlugin('mock-plugin');

      eventBus.emit('transport:started');

      expect(plugin.onTransportStarted).toHaveBeenCalled();
    });

    it('should forward plugin errors', async () => {
      const plugin = new MockPlugin();
      await pluginManager.register(plugin);

      const emitSpy = vi.spyOn(eventBus, 'emit');
      const error = new Error('Plugin error');

      // Trigger plugin error event
      plugin.on('error', (err) => {});
      const handlers = (plugin as any)._eventHandlers.get('error');
      handlers.forEach((handler: any) => handler(error, {}));

      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-error', expect.objectContaining({
        pluginId: 'mock-plugin',
        error,
      }));
    });

    it('should track plugin state changes', async () => {
      const plugin = new MockPlugin();
      await pluginManager.register(plugin);

      // Simulate state change
      plugin.on('activated', () => {});
      const handlers = (plugin as any)._eventHandlers.get('activated');
      handlers.forEach((handler: any) => handler());

      expect(pluginManager.getPluginState('mock-plugin')).toBe(PluginState.ACTIVE);
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(pluginManager.start()).rejects.toThrow(PluginError);
    });

    it('should handle plugin notification errors', async () => {
      await pluginManager.initialize();
      
      const plugin = new MockPlugin();
      plugin.onTransportStarted = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      await pluginManager.register(plugin);
      await pluginManager.loadPlugin('mock-plugin');
      await pluginManager.activatePlugin('mock-plugin');

      const emitSpy = vi.spyOn(eventBus, 'emit');

      eventBus.emit('transport:started');

      expect(emitSpy).toHaveBeenCalledWith('plugin-manager:plugin-error', expect.objectContaining({
        pluginId: 'mock-plugin',
        context: expect.objectContaining({ event: 'transport-started' }),
      }));
    });
  });
});
