import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoreServices, GlobalAudioSystem } from './CoreServices.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';

// Use the mock from __mocks__ folder
vi.mock('tone');

describe('CoreServices Integration with InstrumentRegistry', () => {
  let coreServices: CoreServices;

  beforeEach(() => {
    // Reset global state
    GlobalAudioSystem._resetForTesting();

    // Clear any existing global references
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
  });

  afterEach(async () => {
    if (coreServices) {
      await coreServices.dispose();
    }
    GlobalAudioSystem._resetForTesting();
  });

  describe('InstrumentRegistry initialization', () => {
    it('should create InstrumentRegistry during construction', () => {
      coreServices = new CoreServices();

      const instrumentRegistry = coreServices.getInstrumentRegistry();

      expect(instrumentRegistry).toBeDefined();
      expect(instrumentRegistry).toBeInstanceOf(InstrumentRegistry);
    });

    it('should register InstrumentRegistry with ServiceRegistry', async () => {
      coreServices = new CoreServices();

      const serviceRegistry = coreServices.getServiceRegistry();
      const serviceNames = serviceRegistry.getServiceNames();

      expect(serviceNames).toContain('instrumentRegistry');
    });

    it('should properly set dependencies for InstrumentRegistry', () => {
      coreServices = new CoreServices();

      const serviceRegistry = coreServices.getServiceRegistry();
      const status = serviceRegistry.getServiceStatus('instrumentRegistry');

      expect(status).toBeDefined();
      expect(status.status).toBe('registered');
    });
  });

  describe('InstrumentRegistry with EventBus integration', () => {
    it('should share the same EventBus instance', () => {
      coreServices = new CoreServices();

      const eventBus = coreServices.getEventBus();
      const instrumentRegistry = coreServices.getInstrumentRegistry();

      // Register an instrument and listen for event on shared EventBus
      const listener = vi.fn();
      eventBus.on('instrument:registered', listener);

      const mockInstrument = { id: 'test-drums' };
      instrumentRegistry.setActive('drums', mockInstrument);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'drums',
          instrument: mockInstrument,
        }),
        expect.any(Object), // EventBus metadata
      );
    });

    it('should emit events through shared EventBus when instruments are removed', () => {
      coreServices = new CoreServices();

      const eventBus = coreServices.getEventBus();
      const instrumentRegistry = coreServices.getInstrumentRegistry();

      const mockInstrument = { id: 'test-bass' };
      instrumentRegistry.setActive('bass', mockInstrument);

      const listener = vi.fn();
      eventBus.on('instrument:removed', listener);

      instrumentRegistry.removeActive('bass');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bass',
          instrument: mockInstrument,
        }),
        expect.any(Object), // EventBus metadata
      );
    });
  });

  describe('Pre-initialization flow', () => {
    it('should not initialize InstrumentRegistry during pre-init', async () => {
      coreServices = new CoreServices();

      await coreServices.preInitialize();

      // InstrumentRegistry should still be accessible but not initialized through ServiceRegistry
      const instrumentRegistry = coreServices.getInstrumentRegistry();
      expect(instrumentRegistry).toBeDefined();

      // ServiceRegistry should have the service registered but not initialized
      const serviceRegistry = coreServices.getServiceRegistry();
      const status = serviceRegistry.getServiceStatus('instrumentRegistry');
      expect(status.status).toBe('registered');
    });
  });

  describe('Full initialization flow', () => {
    it('should properly initialize InstrumentRegistry during full init', async () => {
      coreServices = new CoreServices();

      // Mock user gesture for AudioContext
      const mockUserGesture = () => {
        const audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        return audioContext;
      };

      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 44100,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            createOscillator: vi.fn(),
            createAnalyser: vi.fn(),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );

      await coreServices.initialize();

      const instrumentRegistry = coreServices.getInstrumentRegistry();
      expect(instrumentRegistry).toBeDefined();

      // Should be able to register instruments
      const mockDrums = { id: 'wam-drums' };
      instrumentRegistry.setActive('drums', mockDrums);

      expect(instrumentRegistry.getActive('drums')).toBe(mockDrums);
    });

    it('should emit core-services:initialized with all services', async () => {
      coreServices = new CoreServices();
      const eventBus = coreServices.getEventBus();

      const listener = vi.fn();
      eventBus.on('core-services:initialized', listener);

      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 44100,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            createOscillator: vi.fn(),
            createAnalyser: vi.fn(),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );

      await coreServices.initialize();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          services: expect.arrayContaining([
            'eventBus',
            'audioEngine',
            'unifiedTransport',
            'transportSyncManager',
            'pluginManager',
            'audioEventRouter',
          ]),
        }),
      );
    });
  });

  describe('Service lifecycle', () => {
    it('should start InstrumentRegistry when starting all services', async () => {
      coreServices = new CoreServices();

      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 44100,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            createOscillator: vi.fn(),
            createAnalyser: vi.fn(),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );

      await coreServices.initialize();
      await coreServices.start();

      const instrumentRegistry = coreServices.getInstrumentRegistry();
      expect(instrumentRegistry).toBeDefined();

      // Should still be functional after start
      const mockHarmony = { id: 'test-harmony' };
      instrumentRegistry.setActive('harmony', mockHarmony);
      expect(instrumentRegistry.getActive('harmony')).toBe(mockHarmony);
    });

    it('should clean up InstrumentRegistry on dispose', async () => {
      coreServices = new CoreServices();

      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 44100,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            createOscillator: vi.fn(),
            createAnalyser: vi.fn(),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );

      await coreServices.initialize();

      const instrumentRegistry = coreServices.getInstrumentRegistry();
      instrumentRegistry.setActive('drums', { id: 'test' });
      instrumentRegistry.setActive('bass', { id: 'test2' });

      await coreServices.dispose();

      // After disposal, the registry should be cleared
      expect(coreServices.isReady()).toBe(false);
    });
  });

  describe('GlobalAudioSystem integration', () => {
    it('should provide InstrumentRegistry through global instance', async () => {
      const globalInstance =
        await GlobalAudioSystem.getPreInitializedInstance();

      const instrumentRegistry = globalInstance.getInstrumentRegistry();

      expect(instrumentRegistry).toBeDefined();
      expect(instrumentRegistry).toBeInstanceOf(InstrumentRegistry);
    });

    it('should share InstrumentRegistry across multiple accesses', async () => {
      const instance1 = await GlobalAudioSystem.getPreInitializedInstance();
      const instance2 = await GlobalAudioSystem.getPreInitializedInstance();

      const registry1 = instance1.getInstrumentRegistry();
      const registry2 = instance2.getInstrumentRegistry();

      // Should be the same instance
      expect(registry1).toBe(registry2);

      // Changes in one should reflect in the other
      const mockMetronome = { id: 'global-metronome' };
      registry1.setActive('metronome', mockMetronome);

      expect(registry2.getActive('metronome')).toBe(mockMetronome);
    });

    it('should make InstrumentRegistry available globally', async () => {
      await GlobalAudioSystem.getPreInitializedInstance();

      const globalServices = (window as any).__globalCoreServices;
      expect(globalServices).toBeDefined();

      const instrumentRegistry = globalServices.getInstrumentRegistry();
      expect(instrumentRegistry).toBeDefined();
      expect(instrumentRegistry).toBeInstanceOf(InstrumentRegistry);
    });
  });

  describe('Error handling', () => {
    it('should handle initialization failures gracefully', async () => {
      coreServices = new CoreServices();

      // Mock a failure in AudioEngine initialization
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force an error by not mocking AudioContext properly
      (window as any).AudioContext = undefined;

      await expect(coreServices.initialize()).rejects.toThrow();

      // InstrumentRegistry should still be accessible
      const instrumentRegistry = coreServices.getInstrumentRegistry();
      expect(instrumentRegistry).toBeDefined();
    });
  });
});
