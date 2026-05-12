/**
 * WamKeyboardPlugin - AudioPlugin Wrapper for WamKeyboard
 *
 * Adapts WamKeyboard (WAM 2.0 module) to the PluginManager AudioPlugin interface.
 * This enables WamKeyboard to be registered with PluginManager and accessed
 * by RegionProcessor for CC events (sustain pedal).
 *
 * Part of Phase 2: Unify dual playback systems
 */

import type {
  AudioPlugin,
  PluginMetadata,
  PluginAudioContext,
  PluginCapabilities,
  PluginProcessingResult,
  PluginConfig,
  PluginParameterInfo,
  PluginActivateOptions,
} from '../../../../types/plugin.js';
import {
  PluginState,
  PluginCategory,
  ProcessingResultStatus,
} from '../../../../types/plugin.js';
import { WamKeyboard, KeyboardInstrument } from './WamKeyboard.js';
import { EventEmitter } from 'events';
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('WamKeyboardPlugin');

/**
 * AudioPlugin wrapper for WamKeyboard
 * Implements the PluginManager interface while delegating to WamKeyboard
 */
export class WamKeyboardPlugin extends EventEmitter implements AudioPlugin {
  public readonly metadata: PluginMetadata = {
    id: 'wam-keyboard',
    name: 'WAM Keyboard',
    version: '1.0.0',
    author: 'BassNotion',
    description:
      'Multi-instrument keyboard sampler (Grand Piano, Rhodes, Wurlitzer)',
    license: 'MIT',
    category: PluginCategory.INSTRUMENT,
    tags: ['keyboard', 'sampler', 'harmony', 'piano'],
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: false,
      supportsMIDI: true,
      supportsAutomation: false,
      supportsPresets: true,
      supportsSidechain: false,
      supportsMultiChannel: true,
      maxLatency: 10,
      cpuUsage: 0.3,
      memoryUsage: 50,
      minSampleRate: 44100,
      maxSampleRate: 96000,
      supportedBufferSizes: [128, 256, 512, 1024],
      supportsN8nPayload: false,
      supportsAssetLoading: true,
      supportsMobileOptimization: true,
    } as PluginCapabilities,
    dependencies: [],
  };

  public state: PluginState = PluginState.UNLOADED;
  public config?: PluginConfig = {
    id: 'wam-keyboard',
    name: 'WAM Keyboard',
    version: '1.0.0',
    category: PluginCategory.INSTRUMENT,
    enabled: true,
    priority: 500,
    autoStart: false,
    inputChannels: 0,
    outputChannels: 2,
    settings: {},
  };

  public capabilities?: PluginCapabilities;
  public parameters: Map<string, PluginParameterInfo> = new Map();

  // The actual WamKeyboard instance we're wrapping
  private wamKeyboard: WamKeyboard | null = null;
  private audioContext: AudioContext | null = null;
  private currentInstrument: KeyboardInstrument =
    KeyboardInstrument.GRAND_PIANO;

  constructor() {
    super();
    this.capabilities = this.metadata.capabilities;
  }

  /**
   * Get the underlying WamKeyboard instance
   * Used by RegionProcessor to access keyboard-specific methods
   */
  getWamKeyboard(): WamKeyboard | null {
    return this.wamKeyboard;
  }

  /**
   * Load the plugin (create WamKeyboard instance)
   */
  async load(): Promise<void> {
    if (this.state !== PluginState.UNLOADED) {
      logger.warn('WamKeyboardPlugin already loaded, skipping');
      return;
    }

    try {
      logger.info('📦 Loading WamKeyboardPlugin...');

      // State transition
      this.state = PluginState.LOADED;
      this.emit('loaded');

      logger.info('✅ WamKeyboardPlugin loaded successfully');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.emit('error', error, { operation: 'load' });
      throw error;
    }
  }

  /**
   * Initialize the plugin with AudioContext
   */
  async initialize(context: PluginAudioContext): Promise<void> {
    if (
      this.state === PluginState.INACTIVE ||
      this.state === PluginState.ACTIVE
    ) {
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] Already initialized (state: ' +
          this.state +
          '), skipping',
      );
      logger.warn('WamKeyboardPlugin already initialized, skipping');
      return;
    }

    try {
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] 🎹 Starting initialization...',
      );
      logger.info('🎹 Initializing WamKeyboardPlugin with AudioContext...');

      this.audioContext = context.audioContext as AudioContext;
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] AudioContext received:',
        {
          state: this.audioContext.state,
          sampleRate: this.audioContext.sampleRate,
        },
      );

      // Create WamKeyboard instance with AudioContext
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] Creating WamKeyboard instance...',
      );
      this.wamKeyboard = new WamKeyboard(this.audioContext);
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] WamKeyboard instance created',
      );

      // Initialize WamKeyboard (creates audio node, skip instrument load for now)
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] Calling wamKeyboard.initialize()...',
      );
      await this.wamKeyboard.initialize({ skipInstrumentLoad: true });
      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] wamKeyboard.initialize() completed',
      );

      // State transition
      this.state = PluginState.INACTIVE;
      this.emit('initialized');

      console.log(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] ✅ Initialization complete',
        {
          hasWamKeyboard: !!this.wamKeyboard,
          hasAudioNode: !!this.wamKeyboard?.audioNode,
          contextState: this.audioContext.state,
          state: this.state,
        },
      );
      logger.info('✅ WamKeyboardPlugin initialized successfully', {
        hasAudioNode: !!this.wamKeyboard.audioNode,
        contextState: this.audioContext.state,
      });
    } catch (error) {
      console.error(
        '[PLAYBACK-ENGINE][WamKeyboardPlugin] ❌ Initialization FAILED:',
        error,
      );
      this.state = PluginState.ERROR;
      this.emit('error', error, { operation: 'initialize' });
      throw error;
    }
  }

  /**
   * Activate the plugin (load instrument)
   * @param options - Optional activation options including instrument to load
   */
  async activate(options?: PluginActivateOptions): Promise<void> {
    if (this.state === PluginState.ACTIVE) {
      logger.warn('WamKeyboardPlugin already active, skipping');
      return;
    }

    if (!this.wamKeyboard) {
      throw new Error('Cannot activate: WamKeyboard not initialized');
    }

    try {
      // Use instrument from options if provided, otherwise use current/default
      const instrumentToLoad = options?.instrument
        ? (options.instrument as KeyboardInstrument)
        : this.currentInstrument;

      logger.info('▶️ Activating WamKeyboardPlugin...', {
        requestedInstrument: options?.instrument,
        instrumentToLoad,
      });

      // Load the specified instrument
      await this.wamKeyboard.audioNode.loadInstrument(instrumentToLoad);

      // Update current instrument to match what was loaded
      this.currentInstrument = instrumentToLoad;

      // State transition
      this.state = PluginState.ACTIVE;
      this.emit('activated');

      logger.info('✅ WamKeyboardPlugin activated', {
        instrument: instrumentToLoad,
      });
    } catch (error) {
      this.state = PluginState.ERROR;
      this.emit('error', error, { operation: 'activate' });
      throw error;
    }
  }

  /**
   * Deactivate the plugin (release all notes)
   */
  async deactivate(): Promise<void> {
    if (this.state !== PluginState.ACTIVE) {
      logger.warn('WamKeyboardPlugin not active, skipping deactivation');
      return;
    }

    if (!this.wamKeyboard) {
      return;
    }

    try {
      logger.info('⏸️ Deactivating WamKeyboardPlugin...');

      // Clear events and release all playing notes via WamKeyboardNode.clearEvents()
      // This method handles instant silence and note release properly
      if (typeof this.wamKeyboard.audioNode.clearEvents === 'function') {
        this.wamKeyboard.audioNode.clearEvents();
      }

      // State transition
      this.state = PluginState.INACTIVE;
      this.emit('deactivated');

      logger.info('✅ WamKeyboardPlugin deactivated');
    } catch (error) {
      this.emit('error', error, { operation: 'deactivate' });
      throw error;
    }
  }

  /**
   * Process audio (no-op for instruments, they process internally)
   */
  async process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    // WamKeyboard processes audio internally via Web Audio API
    return {
      success: true,
      status: ProcessingResultStatus.SUCCESS,
      processingTime: 0,
      bypassMode: false,
      processedSamples: 0,
      cpuUsage: 0,
    };
  }

  /**
   * Dispose the plugin
   */
  async dispose(): Promise<void> {
    try {
      logger.info('🗑️ Disposing WamKeyboardPlugin...');

      if (this.wamKeyboard && this.wamKeyboard.audioNode) {
        // Access the private method through type assertion
        (this.wamKeyboard.audioNode as any).disconnectAllSamplers?.();
        this.wamKeyboard = null;
      }

      this.audioContext = null;
      this.state = PluginState.UNLOADED;
      this.emit('disposed');

      logger.info('✅ WamKeyboardPlugin disposed');
    } catch (error) {
      this.emit('error', error, { operation: 'dispose' });
      throw error;
    }
  }

  /**
   * Reset plugin state for tutorial switching
   * Clears all playing notes and resets internal state without disposing the plugin
   */
  resetState(): void {
    logger.info('🔄 Resetting WamKeyboardPlugin state for tutorial switch...');

    if (this.wamKeyboard && this.wamKeyboard.audioNode) {
      // Clear any pending events - this also releases active notes via NUCLEAR OPTION
      // The clearEvents() method in WamKeyboardNode:
      // 1. Empties the event queue
      // 2. Disconnects sampler output for instant silence
      // 3. Releases all active notes via the sampler
      if (typeof this.wamKeyboard.audioNode.clearEvents === 'function') {
        this.wamKeyboard.audioNode.clearEvents();
        logger.info('🔄 Cleared events and released notes');
      }

      // Reset sustain pedal state if the method exists
      if (typeof (this.wamKeyboard.audioNode as any).resetSustain === 'function') {
        (this.wamKeyboard.audioNode as any).resetSustain();
      }
    }

    // Reset to default instrument (will be overwritten by new tutorial's exercise)
    this.currentInstrument = KeyboardInstrument.GRAND_PIANO;

    logger.info('✅ WamKeyboardPlugin state reset complete');
  }

  /**
   * Load a specific instrument
   * @param instrument - Instrument to load (grandpiano, rhodes, wurlitzer)
   */
  async loadInstrument(instrument: KeyboardInstrument): Promise<void> {
    if (!this.wamKeyboard) {
      throw new Error('Cannot load instrument: WamKeyboard not initialized');
    }

    try {
      logger.info('🎹 Loading instrument:', { instrument });

      await this.wamKeyboard.audioNode.loadInstrument(instrument);
      this.currentInstrument = instrument;

      logger.info('✅ Instrument loaded successfully', { instrument });
    } catch (error) {
      logger.error('Failed to load instrument:', error);
      throw error;
    }
  }

  /**
   * Get current instrument
   */
  getCurrentInstrument(): KeyboardInstrument {
    return this.currentInstrument;
  }

  /**
   * Set a parameter value (stub - WamKeyboard doesn't use traditional parameters)
   */
  async setParameter(name: string, value: unknown): Promise<void> {
    logger.warn('setParameter called but not implemented for WamKeyboard', {
      name,
      value,
    });
  }

  /**
   * Get a parameter value (stub)
   */
  getParameter(name: string): unknown {
    logger.warn('getParameter called but not implemented for WamKeyboard', {
      name,
    });
    return undefined;
  }

  /**
   * Reset all parameters (stub)
   */
  async resetParameters(): Promise<void> {
    logger.info('resetParameters called (no-op for WamKeyboard)');
  }

  /**
   * Bypass the plugin (stub)
   */
  async bypass(bypassed: boolean): Promise<void> {
    logger.info('bypass called (no-op for WamKeyboard)', { bypassed });
  }
}
