import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Track } from '../Track.js';
import { TrackState } from '../../../types/track.js';
import { PluginState } from '../../../types/plugin.js';
import type { EventBus } from '../EventBus.js';
import type { ErrorReporter } from '../../errors/ErrorReporter.js';

// Mock modules first
vi.mock('../ServiceRegistry.js', () => ({
  serviceRegistry: {
    get: vi.fn(),
  },
}));

vi.mock('../EventBus.js');
vi.mock('../../errors/ErrorReporter.js');

// Import the mocked serviceRegistry after mocking
import { serviceRegistry } from '../ServiceRegistry.js';

describe('Track', () => {
  let mockEventBus: EventBus;
  let mockErrorReporter: ErrorReporter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getGlobalInstance: vi.fn(),
    } as any;

    mockErrorReporter = {
      report: vi.fn(),
    } as any;

    // Configure service registry mock
    vi.mocked(serviceRegistry.get).mockImplementation((key: string) => {
      if (key === 'eventBus') return mockEventBus;
      if (key === 'errorReporter') return mockErrorReporter;
      throw new Error(`Service ${key} not found`);
    });

    // Also set up global window mocks since Track checks these
    if (typeof window !== 'undefined') {
      (window as any).__serviceRegistry = {
        get: vi.mocked(serviceRegistry.get),
      };
    }
  });

  afterEach(() => {
    // Clean up global mocks
    if (typeof window !== 'undefined') {
      delete (window as any).__serviceRegistry;
      delete (window as any).__globalEventBus;
      delete (window as any).__globalCoreServices;
    }
  });

  describe('constructor', () => {
    it('should create track with required config', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      expect(track.name).toBe('Test Track');
      expect(track.instrumentType).toBe('bass');
      expect(track.id).toBeDefined();
      expect(track.state).toBe(TrackState.UNINITIALIZED);
    });

    it('should apply optional config', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'drums',
        color: '#FF0000',
        index: 5,
        mixing: { volume: 0.5, pan: -0.5 },
      });

      expect(track.color).toBe('#FF0000');
      expect(track.index).toBe(5);
      expect(track.mixing.volume).toBe(0.5);
      expect(track.mixing.pan).toBe(-0.5);
      expect(track.mixing.mute).toBe(false); // Default value
    });

    it('should generate random color if not provided', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'chords',
      });

      expect(track.color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should initialize with default values', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'melody',
      });

      // Check defaults
      expect(track.index).toBe(0);
      expect(track.mixing.volume).toBe(0.75);
      expect(track.mixing.pan).toBe(0);
      expect(track.mixing.mute).toBe(false);
      expect(track.mixing.solo).toBe(false);
      expect(track.routing.outputDestination).toBe('master');
      expect(track.routing.sends).toEqual([]);
      expect(track.sync.priority).toBe(50);
      expect(track.sync.humanization).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      await track.initialize();

      expect(track.state).toBe(TrackState.READY);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:initialized', {
        trackId: track.id,
        instrumentType: 'bass',
      });
    });

    it('should not reinitialize if already initialized', async () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      await track.initialize();
      const firstCallCount = (mockEventBus.emit as any).mock.calls.length;

      await track.initialize();
      const secondCallCount = (mockEventBus.emit as any).mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount); // No additional calls
    });

    it('should fail if track is disposed', async () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      await track.dispose();

      await expect(track.initialize()).rejects.toThrow();
    });

    it('should handle plugin initialization', async () => {
      const mockPlugin = {
        id: 'plugin1',
        state: PluginState.LOADED,
        initialize: vi.fn().mockResolvedValue(undefined),
        metadata: { 
          name: 'Test Plugin',
          manufacturer: 'Test',
          version: '1.0.0',
          category: 'INSTRUMENT' 
        },
      };

      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.plugins.push(mockPlugin as any);

      await track.initialize();

      expect(mockPlugin.initialize).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should validate valid track', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      expect(track.validate()).toBe(true);
    });

    it('should fail validation for invalid mixing values', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.mixing.volume = 1.5; // Invalid
      expect(track.validate()).toBe(false);

      track.mixing.volume = 0.5;
      track.mixing.pan = -2; // Invalid
      expect(track.validate()).toBe(false);
    });

    it('should fail validation for invalid velocity range', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.musical.velocityRange = { min: -1, max: 127 };
      expect(track.validate()).toBe(false);

      track.musical.velocityRange = { min: 0, max: 128 };
      expect(track.validate()).toBe(false);

      track.musical.velocityRange = { min: 100, max: 50 };
      expect(track.validate()).toBe(false);
    });

    it('should fail validation for invalid sync values', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.sync.priority = -1;
      expect(track.validate()).toBe(false);

      track.sync.priority = 50;
      track.sync.humanization = 1.5;
      expect(track.validate()).toBe(false);
    });

    it('should validate automation points', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.automation.push({
        parameter: 'volume',
        points: [
          {
            position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0 },
            value: 0.5,
          },
          {
            position: { bars: 2, beats: 1, sixteenths: 0, ticks: 0 },
            value: 1.5,
          }, // Invalid
        ],
        mode: 'read',
        curveType: 'linear',
      });

      expect(track.validate()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose track and plugins', async () => {
      const mockPlugin = {
        id: 'plugin1',
        dispose: vi.fn().mockResolvedValue(undefined),
        metadata: { category: 'INSTRUMENT' },
      };

      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.plugins.push(mockPlugin as any);
      track.patterns.push({ type: 'bass', events: [] } as any);

      await track.dispose();

      expect(track.state).toBe(TrackState.DISPOSING);
      expect(mockPlugin.dispose).toHaveBeenCalled();
      expect(track.plugins).toEqual([]);
      expect(track.patterns).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:disposed', {
        trackId: track.id,
        instrumentType: 'bass',
      });
    });

    it('should not dispose twice', async () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      await track.dispose();
      const firstCallCount = (mockEventBus.emit as any).mock.calls.length;

      await track.dispose();
      const secondCallCount = (mockEventBus.emit as any).mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('reset', () => {
    it('should reset track to initial state', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      // Modify track
      track.mixing.volume = 0.2;
      track.mixing.mute = true;
      track.patterns.push({ type: 'bass', events: [] } as any);
      track.automation.push({
        parameter: 'volume',
        points: [],
        mode: 'read',
        curveType: 'linear',
      });

      track.reset();

      expect(track.state).toBe(TrackState.READY);
      expect(track.mixing.volume).toBe(0.75); // Default
      expect(track.mixing.mute).toBe(false); // Default
      expect(track.patterns).toEqual([]);
      expect(track.automation).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:reset', {
        trackId: track.id,
        instrumentType: 'bass',
      });
    });
  });

  describe('clone', () => {
    it('should create a deep clone with new ID', () => {
      const track = new Track({
        name: 'Original Track',
        instrumentType: 'bass',
        color: '#FF0000',
        index: 3,
      });

      track.mixing.volume = 0.5;
      track.automation.push({
        parameter: 'volume',
        points: [
          {
            position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0 },
            value: 0.5,
          },
        ],
        mode: 'read',
        curveType: 'linear',
      });

      const cloned = track.clone();

      expect(cloned.id).not.toBe(track.id);
      expect(cloned.name).toBe('Original Track (Copy)');
      expect(cloned.instrumentType).toBe('bass');
      expect(cloned.color).toBe('#FF0000');
      expect(cloned.index).toBe(4);
      expect(cloned.mixing.volume).toBe(0.5);
      expect(cloned.automation).toHaveLength(1);
      expect(cloned.automation[0]).not.toBe(track.automation[0]); // Deep clone
    });

    it('should accept custom ID', () => {
      const track = new Track({
        name: 'Original Track',
        instrumentType: 'bass',
      });

      const cloned = track.clone('custom-id');

      expect(cloned.id).toBe('custom-id');
    });
  });

  describe('plugin management', () => {
    it('should add plugin', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const plugin = {
        id: 'plugin1',
        metadata: { category: 'EFFECT' },
      } as any;

      track.addPlugin(plugin);

      expect(track.plugins).toContain(plugin);
      expect(track.metrics.pluginCount).toBe(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:pluginAdded', {
        trackId: track.id,
        pluginId: 'plugin1',
        pluginType: 'EFFECT',
      });
    });

    it('should remove plugin', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const plugin = {
        id: 'plugin1',
        metadata: { category: 'EFFECT' },
      } as any;

      track.plugins.push(plugin);
      track.removePlugin('plugin1');

      expect(track.plugins).not.toContain(plugin);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:pluginRemoved', {
        trackId: track.id,
        pluginId: 'plugin1',
        pluginType: 'EFFECT',
      });
    });
  });

  describe('pattern management', () => {
    it('should add pattern', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const pattern = { type: 'bass', events: [] } as any;

      track.addPattern(pattern);

      expect(track.patterns).toContain(pattern);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:patternAdded', {
        trackId: track.id,
        patternType: 'bass',
      });
    });

    it('should remove pattern', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const pattern = { type: 'bass', events: [] } as any;
      track.patterns.push(pattern);

      track.removePattern(0);

      expect(track.patterns).not.toContain(pattern);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:patternRemoved', {
        trackId: track.id,
        patternType: 'bass',
      });
    });
  });

  describe('mixing updates', () => {
    it('should update mixing state', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const oldMixing = { ...track.mixing };

      track.updateMixing({
        volume: 0.3,
        pan: 0.5,
        mute: true,
      });

      expect(track.mixing.volume).toBe(0.3);
      expect(track.mixing.pan).toBe(0.5);
      expect(track.mixing.mute).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:mixingUpdated', {
        trackId: track.id,
        oldMixing,
        newMixing: track.mixing,
      });
    });
  });

  describe('automation', () => {
    it('should add automation curve', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      const automation = {
        parameter: 'volume',
        points: [],
        mode: 'read' as const,
        curveType: 'linear' as const,
      };

      track.addAutomation(automation);

      expect(track.automation).toContain(automation);
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:automationAdded', {
        trackId: track.id,
        parameter: 'volume',
      });
    });

    it('should get automation value', () => {
      const track = new Track({
        name: 'Test Track',
        instrumentType: 'bass',
      });

      track.automation.push({
        parameter: 'volume',
        points: [
          {
            position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0 },
            value: 0.5,
          },
        ],
        mode: 'read',
        curveType: 'linear',
      });

      const value = track.getAutomationValue('volume', 0);
      expect(value).toBe(0.5);

      const noValue = track.getAutomationValue('pan', 0);
      expect(noValue).toBeUndefined();
    });
  });
});
