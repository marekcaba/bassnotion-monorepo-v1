/**
 * MidiParserProcessor - REFACTORED
 *
 * Now uses external MIDI CC configuration loaded from JSON files.
 * This reduces the file size and makes CC mappings configurable.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import {
  WebMidi,
  Input,
  NoteMessageEvent,
  ControlChangeMessageEvent,
  MessageEvent,
} from 'webmidi';
import { MidiCCLoader } from './loaders/MidiCCLoader.js';
import type { MidiCCConfig, CCMapping } from './types/midi-cc.types.js';

const logger = createStructuredLogger('MidiParserProcessor');

// Import only the types this file uses directly. The rest are
// re-exported below via `export * from './types/midi-parser.types.js'`
// so downstream consumers can still access them.
import type {
  ParsedMidiData,
  MusicTheoryAnalysis,
  MetaEvent,
  SysExEvent,
  ParsedNote,
  ControllerEvent,
  ControllerType,
} from './types/midi-parser.types.js';

// Re-export types for compatibility
export * from './types/midi-parser.types.js';

/**
 * Enhanced MidiParserProcessor with external CC configuration
 */
export class MidiParserProcessor {
  private inputs: Input[] = [];
  private activeInput: Input | null = null;
  private parsedData: ParsedMidiData | null = null;
  private metaEvents: MetaEvent[] = [];
  private sysExEvents: SysExEvent[] = [];

  // CC configuration
  private ccLoader: MidiCCLoader;
  private ccConfig: MidiCCConfig | null = null;
  private ccConfigPath: string;

  constructor(ccConfigPath = '/data/midi/cc-mappings.json') {
    this.ccConfigPath = ccConfigPath;
    this.ccLoader = MidiCCLoader.getInstance();

    // Initialize WebMidi and CC config asynchronously
    this.initialize().catch((error) => {
      logger.warn('Initialization failed:', error);
    });
  }

  /**
   * Initialize WebMidi and load CC configuration
   */
  private async initialize(): Promise<void> {
    try {
      // Load CC configuration
      this.ccConfig = await this.ccLoader.loadCCConfig(this.ccConfigPath);
      logger.info('MIDI CC configuration loaded', {
        mappings: Object.keys(this.ccConfig.mappings).length,
      });

      // Initialize WebMidi
      await this.initializeWebMidi();
    } catch (error) {
      logger.error('Failed to initialize', { error });
      throw error;
    }
  }

  /**
   * Initialize WebMidi with system exclusive message support
   */
  async initializeWebMidi(): Promise<void> {
    try {
      await WebMidi.enable({ sysex: true });

      this.inputs = WebMidi.inputs;
      logger.info('WebMidi enabled successfully!');
      logger.info(`Available MIDI inputs: ${this.inputs.length}`);

      this.inputs.forEach((input, index) => {
        logger.info(`Input ${index}: ${input.name} (${input.manufacturer})`);
      });
    } catch (error) {
      logger.error('Failed to enable WebMidi:', error);
      throw error;
    }
  }

  /**
   * Handle Control Change messages using external configuration
   */
  private handleControlChange(e: ControlChangeMessageEvent): void {
    if (!this.ccConfig) {
      logger.warn('CC config not loaded, using default mapping');
      return;
    }

    const ccMapping = this.ccLoader.getCCMapping(
      this.ccConfig,
      e.controller.number,
    );

    const controller: ControllerEvent = {
      type: this.mapControllerTypeFromConfig(e.controller.number, ccMapping),
      value: e.rawValue!,
      time: e.timestamp,
      channel: e.target.number,
    };

    // Log the CC event with human-readable description
    logger.debug('Control Change', {
      description: this.ccLoader.getCCDescription(
        this.ccConfig,
        e.controller.number,
      ),
      value: e.rawValue,
      normalized: ccMapping
        ? this.ccLoader.normalizeCCValue(ccMapping, e.rawValue!)
        : e.rawValue! / 127,
      isSwitch: ccMapping?.isSwitch,
      switchState: ccMapping?.isSwitch
        ? this.ccLoader.getCCSwitchState(ccMapping, e.rawValue!)
        : undefined,
    });

    // Update controller data in track
    this.updateControllerData(controller.channel, controller);
  }

  /**
   * Map MIDI controller numbers to ControllerType enum using config
   */
  private mapControllerTypeFromConfig(
    controllerNumber: number,
    mapping?: CCMapping,
  ): ControllerType {
    if (!mapping) {
      // Fallback to basic mapping if no config
      return this.mapControllerTypeFallback(controllerNumber);
    }

    // Map from CC config type to ControllerType enum
    const typeMap: Record<string, ControllerType> = {
      MODULATION: ControllerType.MODULATION,
      VOLUME: ControllerType.VOLUME,
      PAN: ControllerType.PAN,
      EXPRESSION: ControllerType.EXPRESSION,
      SUSTAIN: ControllerType.SUSTAIN,
      PORTAMENTO: ControllerType.PORTAMENTO,
      REVERB: ControllerType.REVERB,
      CHORUS: ControllerType.CHORUS,
      TREMOLO: ControllerType.DELAY, // Map tremolo to delay for now
      BRIGHTNESS: ControllerType.EXPRESSION, // Map brightness to expression
      TIMBRE: ControllerType.MODULATION, // Map timbre to modulation
    };

    return typeMap[mapping.type] || ControllerType.MODULATION;
  }

  /**
   * Fallback controller mapping (original hardcoded version)
   */
  private mapControllerTypeFallback(controllerNumber: number): ControllerType {
    const controllerMap: Record<number, ControllerType> = {
      1: ControllerType.MODULATION,
      7: ControllerType.VOLUME,
      10: ControllerType.PAN,
      11: ControllerType.EXPRESSION,
      64: ControllerType.SUSTAIN,
      65: ControllerType.PORTAMENTO,
      91: ControllerType.REVERB,
      93: ControllerType.CHORUS,
    };

    return controllerMap[controllerNumber] || ControllerType.MODULATION;
  }

  /**
   * Get all effects controllers from configuration
   */
  getEffectsControllers(): Map<number, CCMapping> | undefined {
    if (!this.ccConfig) return undefined;
    return this.ccLoader.getCCsByCategory(this.ccConfig, 'effects');
  }

  /**
   * Get all performance controllers from configuration
   */
  getPerformanceControllers(): Map<number, CCMapping> | undefined {
    if (!this.ccConfig) return undefined;
    return this.ccLoader.getCCsByCategory(this.ccConfig, 'performance');
  }

  /**
   * Find CC by alias (e.g., 'sustain', 'damper', 'hold' all map to CC64)
   */
  findCCByAlias(alias: string): [number, CCMapping] | undefined {
    if (!this.ccConfig) return undefined;
    return this.ccLoader.findCCByAlias(this.ccConfig, alias);
  }

  /**
   * Reload CC configuration
   */
  async reloadCCConfig(configPath?: string): Promise<void> {
    if (configPath) {
      this.ccConfigPath = configPath;
    }

    this.ccLoader.clearCache();
    this.ccConfig = await this.ccLoader.loadCCConfig(this.ccConfigPath);

    logger.info('CC configuration reloaded', {
      path: this.ccConfigPath,
      mappings: Object.keys(this.ccConfig.mappings).length,
    });
  }

  /**
   * Get current CC configuration
   */
  getCCConfig(): MidiCCConfig | null {
    return this.ccConfig;
  }

  /**
   * Connect to a MIDI input device
   */
  connectToInput(inputIndex: number): boolean {
    if (!this.inputs || inputIndex >= this.inputs.length) {
      logger.error(`Invalid input index: ${inputIndex}`);
      return false;
    }

    // Disconnect from previous input if any
    if (this.activeInput) {
      this.disconnectInput();
    }

    this.activeInput = this.inputs[inputIndex];
    logger.info(`Connecting to ${this.activeInput.name}`);

    // Add all event listeners
    this.activeInput.addListener('noteon', (e) => this.handleNoteOn(e));
    this.activeInput.addListener('noteoff', (e) => this.handleNoteOff(e));
    this.activeInput.addListener('controlchange', (e) =>
      this.handleControlChange(e),
    );
    this.activeInput.addListener('pitchbend', (e) => this.handlePitchBend(e));
    this.activeInput.addListener('programchange', (e) =>
      this.handleProgramChange(e),
    );
    this.activeInput.addListener('channelaftertouch', (e) =>
      this.handleAftertouch(e),
    );
    this.activeInput.addListener('keyaftertouch', (e) =>
      this.handlePolyAftertouch(e),
    );
    this.activeInput.addListener('sysex', (e) => this.handleSysEx(e));

    return true;
  }

  // Placeholder methods for other MIDI events (would need full implementation)
  private handleNoteOn(_e: NoteMessageEvent): void {
    // Implementation needed
  }

  // Stub handlers — kept for API parity with the WebMIDI event surface
  // but body is not yet implemented. Prefix params with `_` so the
  // no-unused-vars rule doesn't flag them.
  private handleNoteOff(_e: NoteMessageEvent): void {
    // Implementation needed
  }

  private handlePitchBend(_e: MessageEvent): void {
    // Implementation needed
  }

  private handleProgramChange(_e: MessageEvent): void {
    // Implementation needed
  }

  private handleAftertouch(_e: MessageEvent): void {
    // Implementation needed
  }

  private handlePolyAftertouch(_e: MessageEvent): void {
    // Implementation needed
  }

  private handleSysEx(_e: MessageEvent): void {
    // Implementation needed
  }

  /**
   * Update controller data in track
   */
  private updateControllerData(
    channel: number,
    controller: ControllerEvent,
  ): void {
    if (!this.parsedData) {
      this.initializeParsedData();
    }

    // Update controller data in all relevant tracks
    Object.values(this.parsedData!.tracks).forEach((trackArray) => {
      trackArray.forEach((track) => {
        if (track.channel === channel) {
          track.controllers.push(controller);
        }
      });
    });
  }

  /**
   * Initialize parsed data structure
   */
  private initializeParsedData(): void {
    // Same as original implementation
    this.parsedData = {
      tracks: {
        bass: [],
        drums: [],
        chords: [],
        melody: [],
        other: [],
      },
      metadata: {
        timeSignature: { numerator: 4, denominator: 4 },
        tempo: 120,
        trackCount: 0,
        totalNotes: 0,
        duration: 0,
        key: '',
      },
      expression: {
        vibrato: 0,
        tremolo: 0,
        bend: 0,
        trill: 0,
      },
      performance: {
        timing: {
          accuracy: 0,
          consistency: 0,
        },
        dynamics: {
          range: 0,
          consistency: 0,
        },
        articulation: {
          variety: 0,
          consistency: 0,
        },
      },
      musicTheory: {
        keySignature: {
          key: 'C',
          mode: 'major',
          confidence: 0,
          sharpsFlats: 0,
        },
        detectedChords: [],
        scaleAnalysis: {
          primaryScale: 'C major',
          alternativeScales: [],
          modeUsage: {},
          chromaticUsage: 0,
        },
        harmonicProgression: {
          romanNumerals: [],
          functionalAnalysis: [],
          cadences: [],
          modulations: [],
        },
        musicalContext: {
          genre: 'unknown',
          style: 'unknown',
          complexity: 0,
          jazzContent: 0,
          classicalContent: 0,
        },
      },
    };
  }

  /**
   * Disconnect from current input
   */
  disconnectInput(): void {
    if (this.activeInput) {
      this.activeInput.removeListener();
      logger.info(`Disconnected from ${this.activeInput.name}`);
      this.activeInput = null;
    }
  }

  /**
   * Get parsed MIDI data
   */
  getParsedData(): ParsedMidiData | null {
    return this.parsedData;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.parsedData = null;
    this.metaEvents = [];
    this.sysExEvents = [];
    this.disconnectInput();
    logger.info('MidiParserProcessor reset');
  }

  /**
   * Get meta events
   */
  getMetaEvents(): MetaEvent[] {
    return this.metaEvents;
  }

  /**
   * Get SysEx events
   */
  getSysExEvents(): SysExEvent[] {
    return this.sysExEvents;
  }

  /**
   * Perform music theory analysis (backward compatibility)
   */
  performMusicTheoryAnalysis(_notes?: ParsedNote[]): MusicTheoryAnalysis {
    // Simple implementation for backward compatibility
    return {
      keySignature: {
        key: 'C',
        mode: 'major',
        confidence: 0.8,
        sharpsFlats: 0,
      },
      detectedChords: [],
      scaleAnalysis: {
        primaryScale: 'C major',
        alternativeScales: [],
        modeUsage: {},
        chromaticUsage: 0,
      },
      harmonicProgression: {
        romanNumerals: [],
        functionalAnalysis: [],
        cadences: [],
        modulations: [],
      },
      musicalContext: {
        genre: 'unknown',
        style: 'unknown',
        complexity: 0,
        jazzContent: 0,
        classicalContent: 0,
      },
    };
  }

  /**
   * Get comprehensive parsed data (backward compatibility)
   */
  getComprehensiveParsedData(): ParsedMidiData | null {
    return this.parsedData;
  }
}
