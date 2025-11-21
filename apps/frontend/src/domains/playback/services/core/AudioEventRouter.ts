/**
 * AudioEventRouter - Routes audio events from EventBus to registered instruments
 *
 * IMPORTANT: This service does NOT create instruments. It only uses instruments
 * that have been registered through the InstrumentRegistry by widgets or other components.
 */

import { getLogger, Logger } from '@/utils/logger.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { AudioDebugger } from './AudioDebugger.js';
import { GlobalSampleCache } from '../../modules/storage/cache/GlobalSampleCache.js';
import { getPreloadableRegistry } from './PreloadableInstrumentRegistry.js';
import {
  DrumTriggerEvent,
  MetronomeTriggerEvent,
  ChordTriggerEvent,
  BassTriggerEvent,
  MidiEvent,
  DrumPiece,
} from '../../types/audioEvents.js';

export class AudioEventRouter {
  private logger: Logger;
  private eventBus: EventBus | null = null;
  private audioEngine: AudioEngine | null = null;
  private instrumentRegistry: InstrumentRegistry | null = null;

  // References to registered instruments (populated from registry)
  private drums: any = null;
  private bass: any = null;
  private harmony: any = null;
  private metronome: any = null;
  private voiceCue: any = null;

  // Legacy references for backward compatibility
  private legacyDrums: any = null;
  private legacyBass: any = null;
  private legacyHarmony: any = null;
  private legacyMetronome: any = null;
  private legacyVoiceCue: any = null;

  private isRunning = false;
  private activeInstruments = new Set<string>();

  // Event handler management
  private eventHandlers = new Map<string, Function>();
  private unsubscribeFunctions = new Map<string, Function>();

  constructor() {
    this.logger = getLogger('AudioEventRouter');
    this.logger.info('AudioEventRouter constructed');
    AudioDebugger.getInstance().log('AudioEventRouter', 'constructed');
  }

  /**
   * Initialize the router with dependencies
   * Can be called with or without parameters for ServiceRegistry compatibility
   */
  async initialize(eventBus?: EventBus, audioEngine?: AudioEngine): Promise<void> {
    // If already initialized and no new parameters, just return
    if (this.eventBus && this.audioEngine && !eventBus && !audioEngine) {
      this.logger.info('AudioEventRouter already initialized');
      return;
    }

    this.logger.info('Initializing AudioEventRouter');

    // Use provided parameters or keep existing ones
    if (eventBus) this.eventBus = eventBus;
    if (audioEngine) this.audioEngine = audioEngine;

    // Ensure we have both dependencies
    if (!this.eventBus || !this.audioEngine) {
      this.logger.warn('AudioEventRouter initialized without EventBus or AudioEngine - will need to be initialized again with dependencies');
      return;
    }

    // Initialize PreloadableInstrumentRegistry with dependencies
    const preloadableRegistry = getPreloadableRegistry();
    preloadableRegistry.initialize(this.eventBus, this.audioEngine);
    this.logger.info('Initialized PreloadableInstrumentRegistry');

    // Get InstrumentRegistry from CoreServices if available
    try {
      const globalServices = (window as any).__coreServices || (window as any).__globalCoreServices;
      if (globalServices?.getInstrumentRegistry) {
        this.instrumentRegistry = globalServices.getInstrumentRegistry();
        this.logger.info('Got InstrumentRegistry from CoreServices');

        // Check for any pre-registered instruments
        this.checkRegisteredInstruments();
      }
    } catch (error) {
      this.logger.warn('Could not get InstrumentRegistry from CoreServices:', error);
    }

    // Subscribe to events
    this.subscribeToEvents();

    this.logger.info('AudioEventRouter initialized with EventBus and AudioEngine');
  }

  /**
   * Check InstrumentRegistry for registered instruments
   */
  private checkRegisteredInstruments(): void {
    if (!this.instrumentRegistry) return;

    // Check for drums
    if (this.instrumentRegistry.hasActive('drums')) {
      this.drums = this.instrumentRegistry.getActive('drums');
      this.legacyDrums = this.drums; // Backward compatibility
      this.activeInstruments.add('drums');
      this.logger.info('Found pre-registered drums instrument');
    } else {
      // Check if there's a preloaded drum kit in GlobalSampleCache
      try {
        const preloadedDrums = GlobalSampleCache.getCachedInstrument('drums-preloaded');
        if (preloadedDrums && preloadedDrums.trigger) {
          // Register it with the InstrumentRegistry
          this.instrumentRegistry.setActive('drums', preloadedDrums);
          this.drums = preloadedDrums;
          this.legacyDrums = preloadedDrums;
          this.activeInstruments.add('drums');
          this.logger.info('Found and registered preloaded drums from GlobalSampleCache');
        }
      } catch (error) {
        this.logger.debug('Could not check GlobalSampleCache for preloaded drums');
      }
    }

    // Check for bass
    if (this.instrumentRegistry.hasActive('bass')) {
      this.bass = this.instrumentRegistry.getActive('bass');
      this.legacyBass = this.bass; // Backward compatibility
      this.activeInstruments.add('bass');
      this.logger.info('Found pre-registered bass instrument');
    }

    // Check for harmony
    if (this.instrumentRegistry.hasActive('harmony')) {
      this.harmony = this.instrumentRegistry.getActive('harmony');
      this.legacyHarmony = this.harmony; // Backward compatibility
      this.activeInstruments.add('harmony');
      this.logger.info('Found pre-registered harmony instrument');
    }

    // Check for metronome
    if (this.instrumentRegistry.hasActive('metronome')) {
      this.metronome = this.instrumentRegistry.getActive('metronome');
      this.legacyMetronome = this.metronome; // Backward compatibility
      this.activeInstruments.add('metronome');
      this.logger.info('Found pre-registered metronome instrument');
    } else {
      // Check if there's a preloaded metronome in GlobalSampleCache
      try {
        const preloadedMetronome = GlobalSampleCache.getCachedInstrument('metronome-preloaded');
        if (preloadedMetronome) {
          // Add the trigger method if it doesn't exist
          if (!preloadedMetronome.trigger && preloadedMetronome.click) {
            // Add compatibility trigger method
            preloadedMetronome.trigger = (event: any) => {
              const isAccent = event.data?.isDownbeat || event.data?.beat === 1;
              preloadedMetronome.click(isAccent);
            };
          }

          if (preloadedMetronome.trigger) {
            // Register it with the InstrumentRegistry
            this.instrumentRegistry.setActive('metronome', preloadedMetronome);
            this.metronome = preloadedMetronome;
            this.legacyMetronome = preloadedMetronome;
            this.activeInstruments.add('metronome');
            this.logger.info('Found and registered preloaded metronome from GlobalSampleCache');
          }
        }
      } catch (error) {
        this.logger.debug('Could not check GlobalSampleCache for preloaded metronome:', error);
      }
    }
  }

  /**
   * Subscribe to EventBus trigger events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) {
      this.logger.error('Cannot subscribe to events - no EventBus!');
      return;
    }

    this.logger.info('AudioEventRouter subscribing to EventBus events...');

    // Listen for instrument registrations from the registry
    const instrumentRegisteredHandler = (data: any) => {
      if (!data.type || !data.instrument) return;

      this.logger.info(`Instrument registered: ${data.type}`);

      // Update our references when instruments are registered
      switch (data.type) {
        case 'drums':
          this.drums = data.instrument;
          this.legacyDrums = data.instrument; // Backward compatibility
          this.activeInstruments.add('drums');
          this.logger.info('Updated drums instrument from registry');
          break;
        case 'harmony':
          this.harmony = data.instrument;
          this.legacyHarmony = data.instrument; // Backward compatibility
          this.activeInstruments.add('harmony');
          this.logger.info('Updated harmony instrument from registry');
          break;
        case 'bass':
          this.bass = data.instrument;
          this.legacyBass = data.instrument; // Backward compatibility
          this.activeInstruments.add('bass');
          this.logger.info('Updated bass instrument from registry');
          break;
        case 'metronome':
          this.metronome = data.instrument;
          this.legacyMetronome = data.instrument; // Backward compatibility
          this.activeInstruments.add('metronome');
          this.logger.info('Updated metronome instrument from registry');
          break;
      }
    };
    const instrumentRegisteredUnsubscribe = this.eventBus.on(
      'instrument:registered',
      instrumentRegisteredHandler
    );
    this.eventHandlers.set('instrument:registered', instrumentRegisteredHandler);
    this.unsubscribeFunctions.set('instrument:registered', instrumentRegisteredUnsubscribe);

    // Listen for instrument removals
    const instrumentRemovedHandler = (data: any) => {
      if (!data.type) return;

      this.logger.info(`Instrument removed: ${data.type}`);

      // Clear our references when instruments are removed
      switch (data.type) {
        case 'drums':
          this.drums = null;
          this.legacyDrums = null;
          this.activeInstruments.delete('drums');
          break;
        case 'harmony':
          this.harmony = null;
          this.legacyHarmony = null;
          this.activeInstruments.delete('harmony');
          break;
        case 'bass':
          this.bass = null;
          this.legacyBass = null;
          this.activeInstruments.delete('bass');
          break;
        case 'metronome':
          this.metronome = null;
          this.legacyMetronome = null;
          this.activeInstruments.delete('metronome');
          break;
      }
    };
    const instrumentRemovedUnsubscribe = this.eventBus.on(
      'instrument:removed',
      instrumentRemovedHandler
    );
    this.eventHandlers.set('instrument:removed', instrumentRemovedHandler);
    this.unsubscribeFunctions.set('instrument:removed', instrumentRemovedUnsubscribe);

    // Drum trigger handler (now async)
    const drumHandler = async (data: DrumTriggerEvent) => {
      await this.handleDrumTrigger(data);
    };
    const drumUnsubscribe = this.eventBus.on('drum-trigger', drumHandler);
    this.eventHandlers.set('drum-trigger', drumHandler);
    this.unsubscribeFunctions.set('drum-trigger', drumUnsubscribe);

    // Metronome trigger handler (now async)
    const metronomeHandler = async (data: MetronomeTriggerEvent) => {
      await this.handleMetronomeTrigger(data);
    };
    const metronomeUnsubscribe = this.eventBus.on(
      'metronome-trigger',
      metronomeHandler,
    );
    this.eventHandlers.set('metronome-trigger', metronomeHandler);
    this.unsubscribeFunctions.set('metronome-trigger', metronomeUnsubscribe);

    // Chord trigger handler
    const chordHandler = (data: ChordTriggerEvent) => {
      this.handleChordTrigger(data);
    };
    const chordUnsubscribe = this.eventBus.on('chord-trigger', chordHandler);
    this.eventHandlers.set('chord-trigger', chordHandler);
    this.unsubscribeFunctions.set('chord-trigger', chordUnsubscribe);

    // Bass trigger handler
    const bassHandler = (data: BassTriggerEvent) => {
      this.handleBassTrigger(data);
    };
    const bassUnsubscribe = this.eventBus.on('bass-trigger', bassHandler);
    this.eventHandlers.set('bass-trigger', bassHandler);
    this.unsubscribeFunctions.set('bass-trigger', bassUnsubscribe);

    // Voice cue trigger handler
    const voiceCueHandler = async (data: any) => {
      await this.handleVoiceCueTrigger(data);
    };
    const voiceCueUnsubscribe = this.eventBus.on('voice-cue-trigger', voiceCueHandler);
    this.eventHandlers.set('voice-cue-trigger', voiceCueHandler);
    this.unsubscribeFunctions.set('voice-cue-trigger', voiceCueUnsubscribe);

    // MIDI event handler
    const midiHandler = (data: MidiEvent) => {
      this.handleMidiEvent(data);
    };
    const midiUnsubscribe = this.eventBus.on('midi-event', midiHandler);
    this.eventHandlers.set('midi-event', midiHandler);
    this.unsubscribeFunctions.set('midi-event', midiUnsubscribe);

    this.logger.info('AudioEventRouter subscribed to EventBus trigger events', {
      metronomeHandler: !!metronomeHandler,
      drumHandler: !!drumHandler,
      eventBusConnected: !!this.eventBus,
      handlersCount: this.eventHandlers.size
    });
  }

  /**
   * Unsubscribe from EventBus events
   */
  private unsubscribeFromEvents(): void {
    if (!this.eventBus) return;

    // Call all unsubscribe functions
    for (const [event, unsubscribe] of this.unsubscribeFunctions) {
      unsubscribe();
    }

    this.eventHandlers.clear();
    this.unsubscribeFunctions.clear();
    this.logger.info('Unsubscribed from trigger events');
  }

  /**
   * Handle drum trigger event
   */
  private async handleDrumTrigger(data: DrumTriggerEvent): Promise<void> {
    this.logger.info(
      `🥁 AudioEventRouter received drum trigger: drum=${data.drum}, time=${data.audioTime?.toFixed(3)}`,
    );

    // Try multiple sources in order of preference

    // 1. Check registry for drums if we don't have them yet
    if (!this.drums && this.instrumentRegistry) {
      if (this.instrumentRegistry.hasActive('drums')) {
        this.drums = this.instrumentRegistry.getActive('drums');
        this.legacyDrums = this.drums;
        this.activeInstruments.add('drums');
        this.logger.info('Found drums in registry during trigger');
      }
    }

    // 2. Try PreloadableInstrumentRegistry for lazy-loadable drums
    if (!this.drums) {
      const preloadableRegistry = getPreloadableRegistry();
      if (preloadableRegistry.hasType('drums')) {
        const drums = await preloadableRegistry.getOrCreateByType('drums');
        if (drums) {
          this.drums = drums;
          this.legacyDrums = drums;
          this.activeInstruments.add('drums');
          this.logger.info('✅ Got drums from preloadable registry');

          // Also register in InstrumentRegistry for other components
          if (this.instrumentRegistry && !this.instrumentRegistry.hasActive('drums')) {
            this.instrumentRegistry.setActive('drums', drums);
          }
        }
      }
    }

    if (!this.isRunning || !this.drums) {
      this.logger.warn(
        `Cannot trigger drum: isRunning=${this.isRunning}, drums available=${!!this.drums}`,
      );
      return;
    }

    try {
      // Check if the drums instrument has a trigger method
      if (typeof this.drums.trigger === 'function') {
        this.drums.trigger({
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          duration: data.duration || '16n',
          data: {
            drum: data.drum as DrumPiece,
          },
        });
      }
      // Check for triggerDrum method (legacy)
      else if (typeof this.drums.triggerDrum === 'function') {
        this.drums.triggerDrum({
          drum: data.drum as DrumPiece,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
          duration: data.duration || '16n',
        });
      }
      // Check for WAM plugin play method
      else if (typeof this.drums.play === 'function') {
        // For WAM plugins, we need to trigger the appropriate note
        const drumNoteMap: Record<string, number> = {
          kick: 36,
          snare: 38,
          hihat: 42,
          openhat: 46,
          crash: 49,
          ride: 51,
          tom1: 48,
          tom2: 45,
          tom3: 43,
          rimshot: 37,
          clap: 39,
          cowbell: 56,
          tambourine: 54,
          shaker: 70,
        };

        const noteNumber = drumNoteMap[data.drum] || 60;
        this.drums.play(noteNumber, data.velocity || 0.8);

        // Schedule note off
        if (typeof this.drums.stop === 'function') {
          setTimeout(() => {
            this.drums.stop(noteNumber);
          }, 100); // Short duration for drum hits
        }
      }
      else {
        this.logger.warn('Drums instrument does not have a recognized trigger method');
      }

      this.logger.debug(`Triggered drum: ${data.drum} at ${data.audioTime}`);
    } catch (error) {
      this.logger.error('Error triggering drum:', error);
    }
  }

  /**
   * Handle metronome trigger event
   */
  private async handleMetronomeTrigger(data: MetronomeTriggerEvent): Promise<void> {
    this.logger.info(
      `🔔 AudioEventRouter received metronome trigger: beat=${data.beat}, time=${data.audioTime?.toFixed(3)}`,
    );

    // Try multiple sources in order of preference

    // 1. Check registry for metronome if we don't have one yet
    if (!this.metronome && this.instrumentRegistry) {
      const hasMetronome = this.instrumentRegistry.hasActive('metronome');
      this.logger.debug('Checking for metronome in registry', {
        hasMetronome,
        registeredTypes: this.instrumentRegistry.getRegisteredTypes()
      });

      if (hasMetronome) {
        this.metronome = this.instrumentRegistry.getActive('metronome');
        this.legacyMetronome = this.metronome;
        this.activeInstruments.add('metronome');
        this.logger.info('Found metronome in registry during trigger');
      }
    }

    // 2. Try PreloadableInstrumentRegistry for lazy-loadable metronome
    if (!this.metronome) {
      const preloadableRegistry = getPreloadableRegistry();
      if (preloadableRegistry.hasType('metronome')) {
        // Only try to create if we haven't tried recently (avoid multiple concurrent attempts)
        const metronome = await preloadableRegistry.getOrCreateByType('metronome');
        if (metronome) {
          this.metronome = metronome;
          this.legacyMetronome = metronome;
          this.activeInstruments.add('metronome');
          this.logger.info('✅ Got metronome from preloadable registry');

          // Also register in InstrumentRegistry for other components
          if (this.instrumentRegistry && !this.instrumentRegistry.hasActive('metronome')) {
            this.instrumentRegistry.setActive('metronome', metronome);
          }
        }
      }
    }

    AudioDebugger.getInstance().log('AudioEventRouter', 'metronome-trigger-received', {
      isRunning: this.isRunning,
      hasMetronome: !!this.metronome,
      hasInstrumentRegistry: !!this.instrumentRegistry,
      beat: data.beat,
      isDownbeat: data.isDownbeat
    });

    if (!this.isRunning || !this.metronome) {
      this.logger.warn(
        `Cannot trigger metronome: isRunning=${this.isRunning}, metronome available=${!!this.metronome}`,
      );
      AudioDebugger.getInstance().log('AudioEventRouter', 'metronome-trigger-blocked', {
        isRunning: this.isRunning,
        hasMetronome: !!this.metronome
      });
      return;
    }

    try {
      // Check if metronome has appropriate method
      if (typeof this.metronome.trigger === 'function') {
        AudioDebugger.getInstance().log('AudioEventRouter', 'calling-metronome-trigger');
        this.metronome.trigger({
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          data: {
            beat: data.beat,
            isDownbeat: data.isDownbeat,
          },
        });
      }
      else if (typeof this.metronome.triggerClick === 'function') {
        AudioDebugger.getInstance().log('AudioEventRouter', 'calling-metronome-triggerClick');
        this.metronome.triggerClick({
          beat: data.beat,
          isDownbeat: data.isDownbeat,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
        });
      }
      else {
        this.logger.warn('Metronome does not have a recognized trigger method');
      }
    } catch (error) {
      this.logger.error('Error triggering metronome:', error);
    }
  }

  /**
   * Handle chord trigger event
   */
  private handleChordTrigger(data: ChordTriggerEvent): void {
    this.logger.info(
      `🎹 Chord trigger: chord=${data.chord}, root=${data.root}, time=${data.audioTime?.toFixed(3)}`,
    );

    // Check registry for harmony if we don't have it yet
    if (!this.harmony && this.instrumentRegistry) {
      if (this.instrumentRegistry.hasActive('harmony')) {
        this.harmony = this.instrumentRegistry.getActive('harmony');
        this.legacyHarmony = this.harmony;
        this.activeInstruments.add('harmony');
        this.logger.info('Found harmony in registry during trigger');
      }
    }

    if (!this.isRunning || !this.harmony) {
      // Skip warning for MIDI-based harmony events (they use direct scheduling in RegionProcessor)
      // Only warn for actual chord symbol events that need the legacy WamKeyboard path
      if (data.chord !== 'harmony-note') {
        this.logger.warn(
          `Cannot trigger chord: isRunning=${this.isRunning}, harmony available=${!!this.harmony}`,
        );
      }
      return;
    }

    try {
      // Check if harmony has appropriate method
      if (typeof this.harmony.trigger === 'function') {
        this.harmony.trigger({
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.7,
          duration: data.duration || '2n',
          data: {
            chord: data.chord,
            root: data.root,
            quality: data.quality,
            inversion: data.inversion,
          },
        });
      }
      else if (typeof this.harmony.playChord === 'function') {
        this.harmony.playChord({
          chord: data.chord,
          root: data.root,
          quality: data.quality,
          inversion: data.inversion,
          velocity: data.velocity || 0.7,
          time: data.audioTime,
          duration: data.duration || '2n',
        });
      }
      else {
        this.logger.warn('Harmony does not have a recognized trigger method');
      }
    } catch (error) {
      this.logger.error('Error triggering chord:', error);
    }
  }

  /**
   * Handle bass trigger event
   */
  private handleBassTrigger(data: BassTriggerEvent): void {
    this.logger.info(
      `🎸 Bass trigger: note=${data.note}, time=${data.audioTime?.toFixed(3)}`,
    );

    // Check registry for bass if we don't have it yet
    if (!this.bass && this.instrumentRegistry) {
      if (this.instrumentRegistry.hasActive('bass')) {
        this.bass = this.instrumentRegistry.getActive('bass');
        this.legacyBass = this.bass;
        this.activeInstruments.add('bass');
        this.logger.info('Found bass in registry during trigger');
      }
    }

    if (!this.isRunning || !this.bass) {
      this.logger.warn(
        `Cannot trigger bass: isRunning=${this.isRunning}, bass available=${!!this.bass}`,
      );
      return;
    }

    try {
      // Check if bass has appropriate method
      if (typeof this.bass.trigger === 'function') {
        this.bass.trigger({
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          duration: data.duration || '8n',
          data: {
            note: data.note,
            octave: data.octave,
          },
        });
      }
      else if (typeof this.bass.triggerNote === 'function') {
        this.bass.triggerNote({
          note: data.note,
          octave: data.octave,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
          duration: data.duration || '8n',
        });
      }
      else {
        this.logger.warn('Bass does not have a recognized trigger method');
      }
    } catch (error) {
      this.logger.error('Error triggering bass:', error);
    }
  }

  /**
   * Handle voice cue trigger event
   */
  private async handleVoiceCueTrigger(data: any): Promise<void> {
    this.logger.info(
      `🗣️ Voice cue trigger: cue=${data.cue}, time=${data.audioTime?.toFixed(3)}`,
    );

    // Check registry for voice cue if we don't have it yet
    if (!this.voiceCue && this.instrumentRegistry) {
      if (this.instrumentRegistry.hasActive('voice-cue')) {
        this.voiceCue = this.instrumentRegistry.getActive('voice-cue');
        this.legacyVoiceCue = this.voiceCue;
        this.activeInstruments.add('voice-cue');
        this.logger.info('Found voice cue in registry during trigger');
      }
    }

    // Try PreloadableInstrumentRegistry if not found
    if (!this.voiceCue) {
      const preloadableRegistry = getPreloadableRegistry();
      if (preloadableRegistry.hasConfig('voice-cue')) {
        try {
          const voiceCueInstrument = await preloadableRegistry.getOrCreateByType('voice-cue');
          if (voiceCueInstrument) {
            this.voiceCue = voiceCueInstrument;
            this.legacyVoiceCue = voiceCueInstrument;
            this.activeInstruments.add('voice-cue');
            this.logger.info('✅ Got voice cue from preloadable registry');

            // Also register in InstrumentRegistry for other components
            if (this.instrumentRegistry && !this.instrumentRegistry.hasActive('voice-cue')) {
              this.instrumentRegistry.setActive('voice-cue', voiceCueInstrument);
            }
          }
        } catch (error) {
          this.logger.error('Failed to get voice cue from preloadable registry:', error);
        }
      }
    }

    AudioDebugger.getInstance().log('AudioEventRouter', 'voice-cue-trigger-received', {
      isRunning: this.isRunning,
      hasVoiceCue: !!this.voiceCue,
      cue: data.cue
    });

    if (!this.isRunning || !this.voiceCue) {
      this.logger.warn(
        `Cannot trigger voice cue: isRunning=${this.isRunning}, voiceCue available=${!!this.voiceCue}`,
      );
      AudioDebugger.getInstance().log('AudioEventRouter', 'voice-cue-trigger-blocked', {
        isRunning: this.isRunning,
        hasVoiceCue: !!this.voiceCue
      });
      return;
    }

    try {
      // Check if voice cue has appropriate method
      if (typeof this.voiceCue.trigger === 'function') {
        AudioDebugger.getInstance().log('AudioEventRouter', 'calling-voice-cue-trigger');
        this.voiceCue.trigger({
          cue: data.cue,
          time: data.audioTime,
          velocity: data.velocity || 1.0,
        });
      } else {
        this.logger.warn('VoiceCue does not have a recognized trigger method');
      }
    } catch (error) {
      this.logger.error('Error triggering voice cue:', error);
    }
  }

  /**
   * Handle MIDI event
   */
  private handleMidiEvent(data: MidiEvent): void {
    this.logger.debug(`🎹 MIDI event: type=${data.type}, note=${data.note}`);

    if (!this.isRunning) {
      this.logger.warn('Cannot handle MIDI event: router not running');
      return;
    }

    // Route MIDI to appropriate instrument based on channel or other logic
    // This is a placeholder for MIDI routing logic
    this.logger.debug('MIDI routing not yet implemented');
  }

  /**
   * Start the router
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('AudioEventRouter already running');
      return;
    }

    // Try to get InstrumentRegistry if we don't have it yet
    if (!this.instrumentRegistry) {
      try {
        const globalServices = (window as any).__coreServices || (window as any).__globalCoreServices;
        if (globalServices?.getInstrumentRegistry) {
          this.instrumentRegistry = globalServices.getInstrumentRegistry();
          this.logger.info('Got InstrumentRegistry from CoreServices on start');
        }
      } catch (error) {
        this.logger.warn('Could not get InstrumentRegistry on start:', error);
      }
    }

    // Check registry again for any instruments registered before start
    this.checkRegisteredInstruments();

    this.isRunning = true;
    this.logger.info('AudioEventRouter started');
    AudioDebugger.getInstance().log('AudioEventRouter', 'started', {
      hasMetronome: !!this.metronome,
      hasDrums: !!this.drums,
      hasBass: !!this.bass,
      hasHarmony: !!this.harmony,
      hasInstrumentRegistry: !!this.instrumentRegistry
    });
  }

  /**
   * Stop the router
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('AudioEventRouter not running');
      return;
    }

    this.isRunning = false;

    // CRITICAL FIX: Stop all active WAM plugin audio sources immediately
    // Call deactivate() on each instrument to stop playing audio
    const instrumentsToStop = [
      { name: 'drums', ref: this.drums },
      { name: 'bass', ref: this.bass },
      { name: 'harmony', ref: this.harmony },
      { name: 'metronome', ref: this.metronome },
      { name: 'legacyDrums', ref: this.legacyDrums },
      { name: 'legacyBass', ref: this.legacyBass },
      { name: 'legacyHarmony', ref: this.legacyHarmony },
      { name: 'legacyMetronome', ref: this.legacyMetronome },
    ];

    for (const { name, ref } of instrumentsToStop) {
      if (ref && typeof ref.deactivate === 'function') {
        try {
          await ref.deactivate();
          this.logger.info(`Deactivated ${name} instrument`);
        } catch (error) {
          this.logger.error(`Failed to deactivate ${name}:`, error);
        }
      }
    }

    this.logger.info('AudioEventRouter stopped - all instruments deactivated');
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing AudioEventRouter');

    await this.stop();
    this.unsubscribeFromEvents();

    // Clear references
    this.drums = null;
    this.bass = null;
    this.harmony = null;
    this.metronome = null;
    this.legacyDrums = null;
    this.legacyBass = null;
    this.legacyHarmony = null;
    this.legacyMetronome = null;

    this.activeInstruments.clear();
    this.eventBus = null;
    this.audioEngine = null;
    this.instrumentRegistry = null;

    this.logger.info('AudioEventRouter disposed');
  }

  /**
   * Get status information
   */
  getStatus(): {
    isRunning: boolean;
    activeInstruments: string[];
    hasEventBus: boolean;
    hasAudioEngine: boolean;
    hasInstrumentRegistry: boolean;
  } {
    return {
      isRunning: this.isRunning,
      activeInstruments: Array.from(this.activeInstruments),
      hasEventBus: !!this.eventBus,
      hasAudioEngine: !!this.audioEngine,
      hasInstrumentRegistry: !!this.instrumentRegistry,
    };
  }
}