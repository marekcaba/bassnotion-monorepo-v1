/**
 * AudioEventRouter - Connects EventBus triggers to audio instruments
 * Story 3.22: Professional DAW Sequencer
 *
 * This service listens for trigger events from the PatternScheduler/EventBus
 * and routes them to the appropriate instrument processors for audio playback.
 */

import { EventBus } from './EventBus.js';
import { serviceRegistry } from './ServiceRegistry.js';
import {
  MetronomeInstrumentProcessor,
  ClickSoundType,
} from '../plugins/MetronomeInstrumentProcessor.js';
import { DrumInstrumentProcessor } from '../../modules/instruments/implementations/drums/DrumInstrumentProcessor.js';
// ChordInstrumentProcessor removed - unused code (37k lines)
// TODO: Implement WAM-based harmony playback for track system
import { BassInstrumentProcessor } from '../../modules/instruments/implementations/bass/BassInstrumentProcessor.js';
import { WamHarmonyProcessor } from '../../modules/instruments/adapters/wam/WamHarmonyProcessor.js';
import { GlobalSampleCache } from '../storage/GlobalSampleCache.js';
import type {
  Service,
  ServiceConfig,
  HealthCheckResult,
} from './ServiceRegistry.js';
import { getLogger } from '@/utils/logger.js';

// New instruments module imports
import type { Instrument, InstrumentEvent } from '../../modules/instruments/index.js';
import { 
  Metronome, 
  DrumKit, 
  BassInstrument, 
  HarmonyInstrument,
  createInstrumentAdapter 
} from '../../modules/instruments/index.js';
import { featureFlags } from '../../config/featureFlags.js';

// Import Tone dynamically
let Tone: any = null;
const loadTone = async () => {
  if (!Tone) {
    const module = await import('tone');
    Tone = module.default || module;
  }
  return Tone;
};

interface TriggerEvent {
  audioTime: number;
  timestamp: number;
  velocity?: number;
  duration?: string;
}

interface DrumTriggerEvent extends TriggerEvent {
  drum: string;
}

interface MetronomeTriggerEvent extends TriggerEvent {
  type: 'click' | 'accent';
  pitch?: string;
}

interface ChordTriggerEvent extends TriggerEvent {
  chord: string;
  notes: string[];
  voicing?: string;
}

interface BassTriggerEvent extends TriggerEvent {
  note: string;
  technique?: string;
}

interface MidiEvent {
  event: {
    type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'programChange';
    note?: number;
    velocity?: number;
    duration?: string;
    controller?: number;
    value?: number;
    bendValue?: number;
  };
  audioTime: number;
  timestamp: number;
}

export class AudioEventRouter implements Service {
  private eventBus: EventBus | null = null;
  private isInitialized = false;
  private isRunning = false;
  private logger = getLogger('audio-router');

  // Legacy instrument processors (for backward compatibility)
  private legacyMetronome: MetronomeInstrumentProcessor | null = null;
  private legacyDrums: DrumInstrumentProcessor | null = null;
  private legacyHarmony: WamHarmonyProcessor | null = null;
  private legacyBass: BassInstrumentProcessor | null = null;

  // New modular instruments
  private metronome: Instrument | null = null;
  private drums: Instrument | null = null;
  private harmony: Instrument | null = null;
  private bass: Instrument | null = null;

  // Track active instruments
  private activeInstruments = new Set<string>();

  // Event handlers (stored for cleanup)
  private eventHandlers = new Map<string, (data: any) => void>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load Tone.js
      await loadTone();

      // Get EventBus from registry
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
      if (!this.eventBus) {
        throw new Error('EventBus not found in registry');
      }

      // Initialize instrument processors
      await this.initializeInstruments();

      this.isInitialized = true;
      this.logger.info('AudioEventRouter initialized');
    } catch (error) {
      this.logger.error('Failed to initialize AudioEventRouter:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('AudioEventRouter not initialized');
    }

    if (this.isRunning) return;

    // Subscribe to trigger events
    this.subscribeToEvents();

    this.isRunning = true;
    this.logger.info('AudioEventRouter started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Unsubscribe from events
    this.unsubscribeFromEvents();

    this.isRunning = false;
    this.logger.info('AudioEventRouter stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();

    // Dispose modular instruments
    if (this.metronome) {
      await this.metronome.dispose();
      this.metronome = null;
    }
    if (this.drums) {
      await this.drums.dispose();
      this.drums = null;
    }
    if (this.harmony) {
      await this.harmony.dispose();
      this.harmony = null;
    }
    if (this.bass) {
      await this.bass.dispose();
      this.bass = null;
    }

    // Dispose legacy processors
    if (this.legacyMetronome) {
      this.legacyMetronome.dispose();
      this.legacyMetronome = null;
    }
    if (this.legacyDrums) {
      this.legacyDrums.dispose();
      this.legacyDrums = null;
    }
    if (this.legacyHarmony) {
      this.legacyHarmony.dispose();
      this.legacyHarmony = null;
    }
    if (this.legacyBass) {
      this.legacyBass.dispose();
      this.legacyBass = null;
    }

    this.activeInstruments.clear();
    this.eventHandlers.clear();
    this.eventBus = null;
    this.isInitialized = false;

    this.logger.info('AudioEventRouter disposed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const useModularInstruments = featureFlags.modularInstruments;
    
    const details: any = {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      activeInstruments: Array.from(this.activeInstruments),
      eventHandlers: this.eventHandlers.size,
      usingModularInstruments: useModularInstruments,
    };

    // Check instrument health
    if (useModularInstruments) {
      if (this.metronome) details.metronome = 'ready (modular)';
      if (this.drums) details.drums = 'ready (modular)';
      if (this.harmony) details.harmony = 'ready (modular)';
      if (this.bass) details.bass = 'ready (modular)';
    } else {
      if (this.legacyMetronome) details.metronome = 'ready (legacy)';
      if (this.legacyDrums) details.drums = 'ready (legacy)';
      if (this.legacyHarmony) details.harmony = 'ready (legacy)';
      if (this.legacyBass) details.bass = 'ready (legacy)';
    }

    const healthy = this.isInitialized && this.eventBus !== null;

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy
        ? 'AudioEventRouter operating normally'
        : 'AudioEventRouter has issues',
      details,
      timestamp: Date.now(),
    };
  }

  getConfig(): ServiceConfig {
    return {
      isRunning: this.isRunning,
      activeInstruments: Array.from(this.activeInstruments),
    };
  }

  /**
   * Initialize instrument processors
   */
  private async initializeInstruments(): Promise<void> {
    // Load supabase client for generating URLs
    const { supabase } = await import('@/infrastructure/supabase/client');

    // Check if we should use modular instruments
    const useModularInstruments = featureFlags.modularInstruments;

    // Initialize metronome
    try {
      if (useModularInstruments) {
        // Use new modular Metronome
        this.metronome = new Metronome({
          id: 'main-metronome',
          name: 'Main Metronome',
          type: 'metronome',
          clickSounds: {
            [ClickSoundType.ACOUSTIC_CLICK]: supabase.storage
              .from('audio-samples')
              .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
            [ClickSoundType.WOOD_BLOCK]: supabase.storage
              .from('audio-samples')
              .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
            [ClickSoundType.SIDE_STICK]: supabase.storage
              .from('audio-samples')
              .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
          },
        });
        await this.metronome.initialize();
        this.logger.info('Modular Metronome instrument initialized');
      } else {
        // Use legacy processor
        this.legacyMetronome = new MetronomeInstrumentProcessor();
        const metronomeSamples = {
          [ClickSoundType.ACOUSTIC_CLICK]: supabase.storage
            .from('audio-samples')
            .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
          [ClickSoundType.WOOD_BLOCK]: supabase.storage
            .from('audio-samples')
            .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
          [ClickSoundType.SIDE_STICK]: supabase.storage
            .from('audio-samples')
            .getPublicUrl('metronome/Clicks_01.mp3').data.publicUrl,
        };
        await this.legacyMetronome.initialize(metronomeSamples);
        this.logger.info('Legacy Metronome instrument initialized');
      }
      this.activeInstruments.add('metronome');
    } catch (error) {
      this.logger.error('Failed to initialize metronome:', error);
    }

    // Initialize drums
    try {
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
      const drumSamples = {
        kick: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110kik.mp3`).data.publicUrl,
        ],
        snare: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110clp.mp3`).data.publicUrl,
        ],
        hihat: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        openHihat: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        crash: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        ride: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        tom1: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110kik.mp3`).data.publicUrl,
        ],
        tom2: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110clp.mp3`).data.publicUrl,
        ],
        tom3: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110kik.mp3`).data.publicUrl,
        ],
        rimshot: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110clp.mp3`).data.publicUrl,
        ],
        clap: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110clp.mp3`).data.publicUrl,
        ],
        cowbell: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        tambourine: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
        shaker: [
          supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/dr110cht.mp3`).data.publicUrl,
        ],
      };

      if (useModularInstruments) {
        // Use new modular DrumKit
        this.drums = new DrumKit({
          id: 'main-drums',
          name: 'Boss DR-110',
          type: 'drums',
          kit: {
            name: 'Boss DR-110',
            samples: drumSamples,
          },
          grooveStyle: 'straight',
          velocityLayers: 4,
        });
        await this.drums.initialize();
        this.logger.info('Modular DrumKit initialized');
      } else {
        // Use legacy processor
        this.legacyDrums = new DrumInstrumentProcessor();
        await this.legacyDrums.initialize(drumSamples);
        this.logger.info('Legacy drum instrument initialized');
      }
      this.activeInstruments.add('drums');
    } catch (error) {
      this.logger.error('Failed to initialize drums:', error);
    }

    // Initialize harmony
    try {
      if (useModularInstruments) {
        // Use new modular HarmonyInstrument
        this.harmony = new HarmonyInstrument({
          id: 'main-harmony',
          name: 'Main Piano',
          type: 'harmony',
          instrument: 'piano',
          useWAM: true,
          voicing: 'close',
        });
        await this.harmony.initialize(Tone.context.rawContext || Tone.context._context || Tone.context);
        this.logger.info('Modular HarmonyInstrument initialized');
      } else {
        // Use legacy processor
        const preloadedHarmony = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
        if (preloadedHarmony) {
          this.logger.info('Using preloaded harmony instrument from GlobalSampleCache');
        }
        this.legacyHarmony = new WamHarmonyProcessor();
        await this.legacyHarmony.initialize(Tone.context.rawContext || Tone.context._context || Tone.context);
        this.logger.info('Legacy harmony instrument initialized');
      }
      this.activeInstruments.add('harmony');
    } catch (error) {
      this.logger.error('Failed to initialize harmony:', error);
    }

    // Initialize bass
    try {
      if (useModularInstruments) {
        // Use new modular BassInstrument
        this.bass = new BassInstrument({
          id: 'main-bass',
          name: 'Synth Bass',
          type: 'bass',
          noteRange: {
            lowest: 'E1',
            highest: 'G4',
          },
          useSynth: true,
          synthType: 'sawtooth',
          ampSimulation: true,
          velocityLayers: 6,
        });
        await this.bass.initialize();
        this.logger.info('Modular BassInstrument initialized');
      } else {
        // Use legacy processor
        this.legacyBass = new BassInstrumentProcessor();
        const bassSamples: Record<string, string[]> = {};
        const bassNotes = [
          'E1', 'F1', 'Fs1', 'G1', 'Gs1', 'A1', 'As1', 'B1',
          'C2', 'Cs2', 'D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2',
          'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3',
          'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4',
        ];
        
        bassNotes.forEach((note) => {
          bassSamples[note] = []; // Empty array will use synth fallback
        });
        
        await this.legacyBass.initialize(bassSamples);
        this.logger.info('Legacy bass instrument initialized');
      }
      this.activeInstruments.add('bass');
    } catch (error) {
      this.logger.error('Failed to initialize bass:', error);
    }
  }

  /**
   * Subscribe to EventBus trigger events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // Drum trigger handler
    const drumHandler = (data: DrumTriggerEvent) => {
      this.handleDrumTrigger(data);
    };
    this.eventBus.on('drum-trigger', drumHandler);
    this.eventHandlers.set('drum-trigger', drumHandler);

    // Metronome trigger handler
    const metronomeHandler = (data: MetronomeTriggerEvent) => {
      this.handleMetronomeTrigger(data);
    };
    this.eventBus.on('metronome-trigger', metronomeHandler);
    this.eventHandlers.set('metronome-trigger', metronomeHandler);

    // Chord trigger handler
    const chordHandler = (data: ChordTriggerEvent) => {
      this.handleChordTrigger(data);
    };
    this.eventBus.on('chord-trigger', chordHandler);
    this.eventHandlers.set('chord-trigger', chordHandler);

    // Bass trigger handler
    const bassHandler = (data: BassTriggerEvent) => {
      this.handleBassTrigger(data);
    };
    this.eventBus.on('bass-trigger', bassHandler);
    this.eventHandlers.set('bass-trigger', bassHandler);

    // MIDI event handler
    const midiHandler = (data: MidiEvent) => {
      this.handleMidiEvent(data);
    };
    this.eventBus.on('midi-event', midiHandler);
    this.eventHandlers.set('midi-event', midiHandler);

    this.logger.info('Subscribed to trigger events');
  }

  /**
   * Unsubscribe from EventBus events
   */
  private unsubscribeFromEvents(): void {
    if (!this.eventBus) return;

    for (const [event, handler] of this.eventHandlers) {
      this.eventBus.off(event, handler);
    }

    this.eventHandlers.clear();
    this.logger.info('Unsubscribed from trigger events');
  }

  /**
   * Handle drum trigger event
   */
  private handleDrumTrigger(data: DrumTriggerEvent): void {
    this.logger.info(
      `🥁 AudioEventRouter received drum trigger: drum=${data.drum}, time=${data.audioTime?.toFixed(3)}`,
    );

    const useModularInstruments = featureFlags.modularInstruments;
    const hasDrums = useModularInstruments ? !!this.drums : !!this.legacyDrums;

    if (!this.isRunning || !hasDrums) {
      this.logger.warn(
        `Cannot trigger drum: isRunning=${this.isRunning}, drums=${hasDrums}`,
      );
      return;
    }

    try {
      if (useModularInstruments && this.drums) {
        // Use modular DrumKit
        const event: InstrumentEvent = {
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          duration: data.duration || '16n',
          data: {
            drum: data.drum,
          },
        };
        this.drums.trigger(event);
      } else if (this.legacyDrums) {
        // Use legacy processor
        this.legacyDrums.triggerDrum({
          drum: data.drum,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
          duration: data.duration || '16n',
        });
      }
      this.logger.debug(`Triggered drum: ${data.drum} at ${data.audioTime}`);
    } catch (error) {
      this.logger.error('Error triggering drum:', error);
    }
  }

  /**
   * Handle metronome trigger event
   */
  private handleMetronomeTrigger(data: MetronomeTriggerEvent): void {
    this.logger.info(
      `🔔 AudioEventRouter received metronome trigger: type=${data.type}, time=${data.audioTime?.toFixed(3)}`,
    );

    const useModularInstruments = featureFlags.modularInstruments;
    const hasMetronome = useModularInstruments ? !!this.metronome : !!this.legacyMetronome;

    if (!this.isRunning || !hasMetronome) {
      this.logger.warn(
        `Cannot trigger metronome: isRunning=${this.isRunning}, metronome=${hasMetronome}`,
      );
      return;
    }

    try {
      if (useModularInstruments && this.metronome) {
        // Use modular Metronome
        const event: InstrumentEvent = {
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || (data.type === 'accent' ? 1.0 : 0.7),
          data: {
            type: data.type,
            pitch: data.pitch,
          },
        };
        this.metronome.trigger(event);
      } else if (this.legacyMetronome) {
        // Use legacy processor
        this.legacyMetronome.triggerClick({
          type: data.type,
          time: data.audioTime,
          velocity: data.velocity || (data.type === 'accent' ? 1.0 : 0.7),
        });
      }
      this.logger.debug(
        `Triggered metronome: ${data.type} at ${data.audioTime}`,
      );
    } catch (error) {
      this.logger.error('Error triggering metronome:', error);
    }
  }

  /**
   * Handle chord trigger event
   */
  private handleChordTrigger(data: ChordTriggerEvent): void {
    this.logger.info(
      `🎹 AudioEventRouter received chord trigger: chord=${data.chord}, time=${data.audioTime?.toFixed(3)}`,
    );

    const useModularInstruments = featureFlags.modularInstruments;
    const hasHarmony = useModularInstruments ? !!this.harmony : !!this.legacyHarmony;

    if (!this.isRunning || !hasHarmony) {
      this.logger.warn(
        `Cannot trigger chord: isRunning=${this.isRunning}, harmony=${hasHarmony}`,
      );
      return;
    }

    try {
      if (useModularInstruments && this.harmony) {
        // Use modular HarmonyInstrument
        const event: InstrumentEvent = {
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          duration: data.duration || '4n',
          data: {
            chord: data.chord,
            notes: data.notes,
            voicing: data.voicing,
          },
        };
        this.harmony.trigger(event);
      } else if (this.legacyHarmony) {
        // Use legacy processor
        this.legacyHarmony.triggerChord({
          chord: data.chord,
          notes: data.notes,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
          duration: data.duration || '4n',
        });
      }
      this.logger.debug(`Triggered chord: ${data.chord} at ${data.audioTime}`);
    } catch (error) {
      this.logger.error('Error triggering chord:', error);
    }
  }

  /**
   * Handle bass trigger event
   */
  private handleBassTrigger(data: BassTriggerEvent): void {
    const useModularInstruments = featureFlags.modularInstruments;
    const hasBass = useModularInstruments ? !!this.bass : !!this.legacyBass;

    if (!this.isRunning || !hasBass) {
      this.logger.warn(
        `Cannot trigger bass: isRunning=${this.isRunning}, bass=${hasBass}`,
      );
      return;
    }

    try {
      if (useModularInstruments && this.bass) {
        // Use modular BassInstrument
        const event: InstrumentEvent = {
          audioTime: data.audioTime,
          timestamp: data.timestamp,
          velocity: data.velocity || 0.8,
          duration: data.duration || '8n',
          data: {
            note: data.note,
            technique: data.technique,
          },
        };
        this.bass.trigger(event);
      } else if (this.legacyBass) {
        // Use legacy processor
        (this.legacyBass as any).triggerNote({
          note: data.note,
          velocity: data.velocity || 0.8,
          time: data.audioTime,
          duration: data.duration || '8n',
        });
      }

      this.logger.debug(`Triggered bass: ${data.note} at ${data.audioTime}`);
    } catch (error) {
      this.logger.error('Error triggering bass:', error);
    }
  }

  /**
   * Handle MIDI event
   */
  private handleMidiEvent(data: MidiEvent): void {
    if (!this.isRunning) return;

    const { event, audioTime } = data;

    this.logger.debug(
      `🎹 AudioEventRouter received MIDI event: type=${event.type}, note=${event.note}, time=${audioTime?.toFixed(3)}`,
    );

    // Route MIDI events to appropriate instruments based on note range or channel
    if (event.type === 'noteOn' && event.note !== undefined) {
      const noteNumber = event.note;

      // Route by note range (simple example)
      if (noteNumber >= 36 && noteNumber <= 51) {
        // Bass range (C2 to D#3)
        this.handleBassTrigger({
          note: this.midiNoteToNoteName(noteNumber),
          velocity: (event.velocity || 127) / 127,
          audioTime,
          timestamp: data.timestamp,
          duration: event.duration || '8n',
        });
      } else if (noteNumber >= 60 && noteNumber <= 84) {
        // Chord range (C4 to C6)
        // For now, trigger single notes as chords
        this.handleChordTrigger({
          chord: this.midiNoteToNoteName(noteNumber),
          notes: [this.midiNoteToNoteName(noteNumber)],
          velocity: (event.velocity || 127) / 127,
          audioTime,
          timestamp: data.timestamp,
          duration: event.duration || '4n',
        });
      }
      // Add more routing logic as needed
    }
  }

  /**
   * Convert MIDI note number to note name
   */
  private midiNoteToNoteName(noteNumber: number): string {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  }

  /**
   * Get active instruments
   */
  getActiveInstruments(): string[] {
    return Array.from(this.activeInstruments);
  }

  /**
   * Enable/disable specific instruments
   */
  setInstrumentEnabled(instrument: string, enabled: boolean): void {
    if (enabled) {
      this.activeInstruments.add(instrument);
    } else {
      this.activeInstruments.delete(instrument);
    }

    this.logger.info(
      `Instrument ${instrument} ${enabled ? 'enabled' : 'disabled'}`,
    );
  }
}
