/**
 * ChordInstrumentProcessor - Sophisticated Chord/Harmony Instrument
 * Story 2.2 - Task 4: Advanced chord instrument with intelligent voicing and harmonic analysis
 *
 * Features:
 * - Intelligent chord voicing and voice leading optimization
 * - Multiple sound presets (pad, Rhodes, organ, strings, brass)
 * - Harmonic analysis with chord symbol recognition
 * - Roman numeral notation support
 * - Stereo imaging and harmonic enhancement effects
 * - Real-time chord progression analysis
 */

import { loadGlobalTone } from './toneLoader';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import type { Exercise } from '@bassnotion/contracts';
import {
  extractExerciseNotes,
  getVelocityLayersForExercise,
} from '@/domains/playback/utils/extractExerciseNotes';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

import Soundfont from 'soundfont-player';
import { SalamanderVelocitySampler } from '../../modules/instruments/implementations/harmony/SalamanderVelocitySampler.js';
import { WurlitzerVelocitySampler } from '../../modules/instruments/implementations/harmony/WurlitzerVelocitySampler.js';
import { LongPadSampler } from './LongPadSampler';
import { RhodesVelocitySampler } from '../../modules/instruments/implementations/harmony/RhodesVelocitySampler.js';
import { TheSawSampler } from './TheSawSampler';

// Import shared types
import {
import { createStructuredLogger } from '@bassnotion/contracts';
  ChordPreset,
  ChordQuality,
  ChordSymbol,
  VoicingStyle,
  HarmonicContext,
  ChordInstrumentConfig,
  ChordProgression,
} from './ChordTypes';

// ============================================================================
// TYPES & INTERFACES (Additional types not in ChordTypes)
// ============================================================================

// These types are now imported from ChordTypes.ts
// Re-export them for backward compatibility
export { ChordPreset, ChordQuality, VoicingStyle } from './ChordTypes';
export type { ChordSymbol } from './ChordTypes';

// Additional enums and interfaces specific to this processor
interface ExtendedChordSymbol extends ChordSymbol {
  extensions: number[];
  alterations: string[];
  inversion?: number;
}

export interface ParsedChord {
  symbol: ChordSymbol;
  notes: string[];
  voicing: string[];
  romanNumeral: string;
  function: string;
  confidence: number;
  timestamp: number;
}

export interface VoicingOptions {
  style: VoicingStyle;
  range: { min: string; max: string };
  doubling: boolean;
  omissions: string[];
  voiceLeading: boolean;
  smoothness: number; // 0-1
}

// Extended HarmonicContext with additional fields
interface ExtendedHarmonicContext extends HarmonicContext {
  previousChord?: ParsedChord;
  nextChord?: ParsedChord;
  position: 'strong' | 'weak';
  function: 'tonic' | 'subdominant' | 'dominant' | 'secondary' | 'chromatic';
}

// Extended ChordProgression with additional fields
interface ExtendedChordProgression extends ChordProgression {
  chords: ParsedChord[];
  romanNumerals: string[];
  functions: string[];
  cadences: CadencePoint[];
  analysis: ProgressionAnalysis;
}

export interface CadencePoint {
  type: 'authentic' | 'plagal' | 'deceptive' | 'half' | 'phrygian';
  location: number;
  strength: number;
  chords: string[];
}

export interface ProgressionAnalysis {
  complexity: number;
  jazzContent: number;
  classicalContent: number;
  modernContent: number;
  functionalHarmony: number;
  chromaticism: number;
}

export interface ChordEffects {
  reverb: {
    decay: number;
    wet: number;
  };
  chorus: {
    frequency: number;
    depth: number;
    wet: number;
  };
  stereoImaging: {
    width: number;
  };
  harmonicEnhancement: {
    brightness: number;
    warmth: number;
    presence: number;
  };
}

// Extended ChordInstrumentConfig with additional fields
interface ExtendedChordInstrumentConfig extends ChordInstrumentConfig {
  voicingOptions: VoicingOptions;
  velocity: {
    sensitivity: number;
    curve: 'linear' | 'exponential' | 'logarithmic';
  };
}

// ============================================================================
// CHORD VOICING ENGINE
// ============================================================================

export class ChordVoicingEngine {
  private noteNames = [
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

  public generateVoicing(
    chord: ChordSymbol,
    options: VoicingOptions,
    context?: HarmonicContext,
  ): string[] {
    const baseNotes = this.getChordNotes(chord);
    let voicing = this.applyVoicingStyle(baseNotes, options.style);

    if (options.voiceLeading && context?.previousChord) {
  const { correlationId, logger } = useCorrelation('baseNotes');
      voicing = this.optimizeVoiceLeading(
        voicing,
        context.previousChord.voicing,
        options.smoothness,
      );
    }

    voicing = this.applyRange(voicing, options.range);
    if (options.doubling) {
      voicing = this.applyDoubling(voicing);
    }
    voicing = this.applyOmissions(voicing, options.omissions);

    return voicing;
  }

  private getChordNotes(chord: ChordSymbol): string[] {
    // Ensure root has octave information for proper interval calculation
    const rootWithOctave =
      chord.root.includes('4') ||
      chord.root.includes('3') ||
      chord.root.includes('5')
        ? chord.root
        : chord.root + '4';

    const notes: string[] = [rootWithOctave];

    switch (chord.quality) {
      case ChordQuality.MAJOR:
        notes.push(this.addInterval(rootWithOctave, 4)); // Major third
        notes.push(this.addInterval(rootWithOctave, 7)); // Perfect fifth
        break;
      case ChordQuality.MINOR:
        notes.push(this.addInterval(rootWithOctave, 3)); // Minor third
        notes.push(this.addInterval(rootWithOctave, 7)); // Perfect fifth
        break;
      case ChordQuality.DOMINANT:
        notes.push(this.addInterval(rootWithOctave, 4)); // Major third
        notes.push(this.addInterval(rootWithOctave, 7)); // Perfect fifth
        notes.push(this.addInterval(rootWithOctave, 10)); // Minor seventh
        break;
      case ChordQuality.MAJOR_SEVENTH:
        notes.push(this.addInterval(rootWithOctave, 4)); // Major third
        notes.push(this.addInterval(rootWithOctave, 7)); // Perfect fifth
        notes.push(this.addInterval(rootWithOctave, 11)); // Major seventh
        break;
      case ChordQuality.MINOR_SEVENTH:
        notes.push(this.addInterval(rootWithOctave, 3)); // Minor third
        notes.push(this.addInterval(rootWithOctave, 7)); // Perfect fifth
        notes.push(this.addInterval(rootWithOctave, 10)); // Minor seventh
        break;
      case ChordQuality.DIMINISHED:
        notes.push(this.addInterval(rootWithOctave, 3)); // Minor third
        notes.push(this.addInterval(rootWithOctave, 6)); // Diminished fifth
        break;
      case ChordQuality.AUGMENTED:
        notes.push(this.addInterval(rootWithOctave, 4)); // Major third
        notes.push(this.addInterval(rootWithOctave, 8)); // Augmented fifth
        break;
    }

    // Add extensions
    chord.extensions.forEach((extension) => {
      notes.push(this.addInterval(rootWithOctave, extension));
    });

    return notes;
  }

  private applyVoicingStyle(notes: string[], style: VoicingStyle): string[] {
    switch (style) {
      case VoicingStyle.CLOSE:
        return this.createCloseVoicing(notes);
      case VoicingStyle.OPEN:
        return this.createOpenVoicing(notes);
      case VoicingStyle.DROP_2:
        return this.createDrop2Voicing(notes);
      case VoicingStyle.DROP_3:
        return this.createDrop3Voicing(notes);
      case VoicingStyle.SPREAD:
        return this.createSpreadVoicing(notes);
      case VoicingStyle.QUARTAL:
        return this.createQuartalVoicing(notes);
      case VoicingStyle.CLUSTER:
        return this.createClusterVoicing(notes);
      default:
        return notes;
    }
  }

  private optimizeVoiceLeading(
    currentVoicing: string[],
    previousVoicing: string[],
    smoothness: number,
  ): string[] {
    const optimized = [...currentVoicing];
    const maxMovement = 7 * (1 - smoothness);

    return optimized.map((note, index) => {
      if (index < previousVoicing.length && previousVoicing[index]) {
        const movement = Math.abs(
          this.calculateInterval(previousVoicing[index], note),
        );
        if (movement > maxMovement) {
          return this.findCloserVoicing(note, previousVoicing[index]);
        }
      }
      return note;
    });
  }

  private addInterval(root: string, semitones: number): string {
    // Extract note name and octave from root
    let rootNoteName: string;
    let rootOctave: number;

    if (root.includes('#') || root.includes('b')) {
      // Handle sharps and flats (e.g., "C#4", "Bb3")
      rootNoteName = root.slice(0, 2);
      rootOctave = parseInt(root.slice(2)) || 4;
    } else {
      // Handle natural notes (e.g., "C4", "G")
      rootNoteName = root.charAt(0);
      rootOctave = parseInt(root.slice(1)) || 4;
    }

    const rootIndex = this.noteNames.indexOf(rootNoteName);

    if (rootIndex === -1) {
      logger.warn(`Unknown root note: ${root}, falling back to C4`);
      return 'C4';
    }

    // Calculate new note index and handle octave wraparound
    const newIndex = (rootIndex + semitones) % 12;
    const octaveAdjustment = Math.floor((rootIndex + semitones) / 12);
    const finalOctave = rootOctave + octaveAdjustment;

    return this.noteNames[newIndex] + finalOctave;
  }

  private calculateInterval(note1: string, note2: string): number {
    // Handle full note names including sharps/flats
    const noteName1 =
      note1.includes('#') || note1.includes('b')
        ? note1.slice(0, 2)
        : note1.charAt(0);
    const noteName2 =
      note2.includes('#') || note2.includes('b')
        ? note2.slice(0, 2)
        : note2.charAt(0);
    const index1 = this.noteNames.indexOf(noteName1);
    const index2 = this.noteNames.indexOf(noteName2);
    return (index2 - index1 + 12) % 12;
  }

  private createCloseVoicing(notes: string[]): string[] {
    return notes.sort((a, b) => this.compareNotes(a, b));
  }

  private createOpenVoicing(notes: string[]): string[] {
    const voicing = [...notes];
    if (voicing.length >= 4 && voicing[1]) {
      voicing[1] = this.transposeOctave(voicing[1], 1);
    }
    return voicing;
  }

  private createDrop2Voicing(notes: string[]): string[] {
    const voicing = [...notes];
    if (voicing.length >= 4) {
      const secondHighest = voicing[voicing.length - 2];
      if (secondHighest) {
        voicing[voicing.length - 2] = this.transposeOctave(secondHighest, -1);
      }
    }
    return voicing;
  }

  private createDrop3Voicing(notes: string[]): string[] {
    const voicing = [...notes];
    if (voicing.length >= 4) {
      const thirdHighest = voicing[voicing.length - 3];
      if (thirdHighest) {
        voicing[voicing.length - 3] = this.transposeOctave(thirdHighest, -1);
      }
    }
    return voicing;
  }

  private createSpreadVoicing(notes: string[]): string[] {
    return notes.map((note, index) => {
      if (index > 0) {
        return this.transposeOctave(note, Math.floor(index / 2));
      }
      return note;
    });
  }

  private createQuartalVoicing(notes: string[]): string[] {
    const root = notes[0];
    // TODO: Review non-null assertion - consider null safety
    if (!root) return notes;

    return [
      root,
      this.addInterval(root, 5), // Perfect fourth
      this.addInterval(root, 10), // Minor seventh
      this.addInterval(root, 15), // Another fourth
    ];
  }

  private createClusterVoicing(notes: string[]): string[] {
    const root = notes[0];
    // TODO: Review non-null assertion - consider null safety
    if (!root) return notes;

    return [
      root,
      this.addInterval(root, 1), // Minor second
      this.addInterval(root, 2), // Major second
      this.addInterval(root, 4), // Major third
    ];
  }

  private applyRange(
    voicing: string[],
    range: { min: string; max: string },
  ): string[] {
    return voicing.map((note) => {
      let adjustedNote = note;
      while (this.compareNotes(adjustedNote, range.min) < 0) {
        adjustedNote = this.transposeOctave(adjustedNote, 1);
      }
      while (this.compareNotes(adjustedNote, range.max) > 0) {
        adjustedNote = this.transposeOctave(adjustedNote, -1);
      }
      return adjustedNote;
    });
  }

  private applyDoubling(voicing: string[]): string[] {
    const doubled = [...voicing];
    const root = voicing[0];
    if (root) {
      doubled.push(this.transposeOctave(root, 1));
    }
    return doubled;
  }

  private applyOmissions(voicing: string[], omissions: string[]): string[] {
    // TODO: Review non-null assertion - consider null safety
    return voicing.filter((note) => !omissions.includes(note.charAt(0)));
  }

  private compareNotes(note1: string, note2: string): number {
    // Extract octave numbers for proper musical comparison
    const octave1 = parseInt(note1.slice(-1)) || 4;
    const octave2 = parseInt(note2.slice(-1)) || 4;

    if (octave1 !== octave2) {
      return octave1 - octave2;
    }

    // If same octave, compare note names
    const noteName1 = note1.charAt(0);
    const noteName2 = note2.charAt(0);
    const noteIndex1 = this.noteNames.indexOf(noteName1);
    const noteIndex2 = this.noteNames.indexOf(noteName2);

    return noteIndex1 - noteIndex2;
  }

  private transposeOctave(note: string, octaves: number): string {
    const noteName = note.charAt(0);
    const accidental = note.includes('#') ? '#' : note.includes('b') ? 'b' : '';
    const octave = parseInt(note.slice(-1)) || 4;
    return `${noteName}${accidental}${octave + octaves}`;
  }

  private findCloserVoicing(target: string, reference: string): string {
    const targetOctaves = [
      this.transposeOctave(target, -1),
      target,
      this.transposeOctave(target, 1),
    ];

    let closest = target;
    let minDistance = Math.abs(this.calculateInterval(reference, target));

    targetOctaves.forEach((octave) => {
      const distance = Math.abs(this.calculateInterval(reference, octave));
      if (distance < minDistance) {
        minDistance = distance;
        closest = octave;
      }
    });

    return closest;
  }
}

// ============================================================================
// HARMONIC ANALYZER
// ============================================================================

export class HarmonicAnalyzer {
  private noteNames = [
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

  public analyzeChord(notes: string[], context?: HarmonicContext): ParsedChord {
    const symbol = this.identifyChordSymbol(notes);
    const voicing = [...notes];
    const romanNumeral = this.generateRomanNumeral(symbol, context?.key || 'C');
    const chordFunction = this.analyzeFunction(symbol, context);
    const confidence = this.calculateConfidence(notes, symbol);

    return {
      symbol,
      notes,
      voicing,
      romanNumeral,
      function: chordFunction,
      confidence,
      timestamp: Date.now(),
    };
  }

  public analyzeProgression(
    chords: ParsedChord[],
    key: string,
  ): ChordProgression {
    const romanNumerals = chords.map((chord) => chord.romanNumeral);
    const functions = chords.map((chord) => chord.function);
    const cadences = this.identifyCadences(chords);
    const analysis = this.analyzeProgressionStyle(chords);

    return {
      chords,
      key,
      romanNumerals,
      functions,
      cadences,
      analysis,
    };
  }

  private identifyChordSymbol(notes: string[]): ChordSymbol {
    const fullRoot = notes[0] || 'C';
    const root = fullRoot.charAt(0); // Extract just the note name without octave
    const quality = this.identifyQuality(notes, fullRoot);
    const extensions: number[] = [];
    const alterations: string[] = [];

    return { root, quality, extensions, alterations };
  }

  private identifyQuality(notes: string[], root: string): ChordQuality {
    const intervals = notes.map((note) => this.calculateInterval(root, note));

    if (intervals.includes(4) && intervals.includes(7)) {
      if (intervals.includes(10)) return ChordQuality.DOMINANT;
      if (intervals.includes(11)) return ChordQuality.MAJOR_SEVENTH;
      return ChordQuality.MAJOR;
    }

    if (intervals.includes(3) && intervals.includes(7)) {
      if (intervals.includes(10)) return ChordQuality.MINOR_SEVENTH;
      return ChordQuality.MINOR;
    }

    return ChordQuality.MAJOR;
  }

  private generateRomanNumeral(symbol: ChordSymbol, key: string): string {
    const scalePosition = this.getScalePosition(symbol.root, key);
    const romanNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    return romanNumerals[scalePosition - 1] || 'I';
  }

  private analyzeFunction(
    symbol: ChordSymbol,
    context?: HarmonicContext,
  ): string {
    // TODO: Review non-null assertion - consider null safety
    if (!context) return 'unknown';

    const scalePosition = this.getScalePosition(symbol.root, context.key);
    switch (scalePosition) {
      case 1:
        return 'tonic';
      case 4:
        return 'subdominant';
      case 5:
        return 'dominant';
      case 2:
        return 'supertonic';
      case 3:
        return 'mediant';
      case 6:
        return 'submediant';
      case 7:
        return 'leading-tone';
      default:
        return 'chromatic';
    }
  }

  private calculateConfidence(notes: string[], _symbol: ChordSymbol): number {
    // Simple confidence calculation
    return notes.length > 0 ? 0.8 : 0.0;
  }

  private identifyCadences(chords: ParsedChord[]): CadencePoint[] {
    const cadences: CadencePoint[] = [];

    for (let i = 0; i < chords.length - 1; i++) {
      const current = chords[i];
      const next = chords[i + 1];

      // TODO: Review non-null assertion - consider null safety
      if (!current || !next) continue;

      if (current.function === 'dominant' && next.function === 'tonic') {
        cadences.push({
          type: 'authentic',
          location: next.timestamp,
          strength: 0.9,
          chords: [current.romanNumeral, next.romanNumeral],
        });
      }

      if (current.function === 'subdominant' && next.function === 'tonic') {
        cadences.push({
          type: 'plagal',
          location: next.timestamp,
          strength: 0.7,
          chords: [current.romanNumeral, next.romanNumeral],
        });
      }
    }

    return cadences;
  }

  private analyzeProgressionStyle(chords: ParsedChord[]): ProgressionAnalysis {
    const totalChords = chords.length;
    let jazzContent = 0;
    let classicalContent = 0;
    let modernContent = 0;
    let functionalHarmony = 0;
    let chromaticism = 0;

    chords.forEach((chord) => {
      if (chord.symbol.extensions.length > 0) jazzContent++;
      if (chord.symbol.quality === ChordQuality.DOMINANT) jazzContent++;

      if (['tonic', 'subdominant', 'dominant'].includes(chord.function)) {
        classicalContent++;
        functionalHarmony++;
      }

      if (chord.symbol.alterations.length > 0) modernContent++;
      if (chord.function === 'chromatic') chromaticism++;
    });

    return {
      complexity: (jazzContent + modernContent) / totalChords,
      jazzContent: jazzContent / totalChords,
      classicalContent: classicalContent / totalChords,
      modernContent: modernContent / totalChords,
      functionalHarmony: functionalHarmony / totalChords,
      chromaticism: chromaticism / totalChords,
    };
  }

  private calculateInterval(note1: string, note2: string): number {
    // Handle full note names including sharps/flats
    const noteName1 =
      note1.includes('#') || note1.includes('b')
        ? note1.slice(0, 2)
        : note1.charAt(0);
    const noteName2 =
      note2.includes('#') || note2.includes('b')
        ? note2.slice(0, 2)
        : note2.charAt(0);
    const index1 = this.noteNames.indexOf(noteName1);
    const index2 = this.noteNames.indexOf(noteName2);
    return (index2 - index1 + 12) % 12;
  }

  private getScalePosition(note: string, key: string): number {
    const keyIndex = this.noteNames.indexOf(key);
    const noteIndex = this.noteNames.indexOf(note);
    return ((noteIndex - keyIndex + 12) % 12) + 1;
  }
}

// ============================================================================
// CHORD INSTRUMENT PROCESSOR
// ============================================================================

export class ChordInstrumentProcessor {
  // TODO: Review non-null assertion - consider null safety
  private polySynth!: Tone.PolySynth;
  private sampler: Tone.Sampler | null = null; // Tone.js Sampler for real samples
  private velocitySampler: SalamanderVelocitySampler | null = null; // 16-velocity Salamander
  private wurlitzerSampler: WurlitzerVelocitySampler | null = null; // Wurlitzer electric piano
  private exerciseContext: Exercise | null = null; // For smart loading
  private longPadSampler: LongPadSampler | null = null; // Long Pad synth
  private rhodesSampler: RhodesVelocitySampler | null = null; // Rhodes electric piano
  private theSawSampler: TheSawSampler | null = null; // The Saw synth
  private soundfontInstrument: any = null; // Soundfont instrument
  private useSoundfont = false; // Flag to use soundfont vs synthesis
  private useSampler = false; // Flag to use Tone.Sampler for real samples
  private useVelocitySampler = false; // Flag to use 16-velocity sampler
  private useWurlitzer = false; // Flag to use Wurlitzer sampler
  private useLongPad = false; // Flag to use Long Pad sampler
  private useRhodes = false; // Flag to use Rhodes sampler
  private useTheSaw = false; // Flag to use The Saw sampler
  private voicingEngine: ChordVoicingEngine;
  private harmonicAnalyzer: HarmonicAnalyzer;
  private currentPreset: ChordPreset;
  private config: ChordInstrumentConfig;
  private volumeBeforePanic = 1; // Store volume before panic for restoration
  // TODO: Review non-null assertion - consider null safety
  private effects!: {
    reverb: Tone.Reverb;
    chorus: Tone.Chorus;
    stereoWidener: Tone.StereoWidener;
    eq: Tone.EQ3;
  };
  private activeChords: Map<string, { notes: string[]; time: number }>;
  private chordProgression: ChordProgression | null;
  private currentVolume = 0.7; // Store current volume for samplers
  private releaseTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Track scheduled releases for cancellation

  // CRITICAL: Pre-activated AudioContext for user gesture compliance
  private preActivatedContext: AudioContext | null = null;

  constructor(config?: Partial<ChordInstrumentConfig>) {
    this.config = this.createDefaultConfig(config);
    this.currentPreset = this.config.preset;
    this.activeChords = new Map();
    this.chordProgression = null;

    this.voicingEngine = new ChordVoicingEngine();
    this.harmonicAnalyzer = new HarmonicAnalyzer();

    // Don't initialize Tone.js components in constructor
    // Wait for explicit initialization to avoid AudioContext issues
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * CRITICAL: Pre-activate AudioContext during user interaction
   * Must be called directly from user gesture (click, touch, etc.)
   */
  public async preActivateAudioContext(): Promise<void> {
    try {
      // Ensure Tone is loaded and initialize if needed
      await this.ensureToneLoaded();

      // Initialize Tone.js components if not already done
      if (!this.polySynth) {
        await this.initializeInstrument();
      }
      if (!this.effects) {
        await this.setupEffects();
      }

      if (typeof window !== 'undefined') {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        this.preActivatedContext = new AudioContextClass();
        if (this.preActivatedContext.state === 'suspended') {
          await this.preActivatedContext.resume();
        }
        logger.info(
          '🎼 Pre-activated AudioContext for soundfonts (user gesture preserved)',
        );
      }
    } catch (error) {
      logger.warn('🎼 Failed to pre-activate AudioContext:', error);
    }
  }

  public async playChord(
    chordSymbol: string | ChordSymbol,
    options?: {
      velocity?: number;
      duration?: number;
      voicingStyle?: VoicingStyle;
      context?: HarmonicContext;
      time?: number | string;
    },
  ): Promise<void> {
    const symbol =
      typeof chordSymbol === 'string'
        ? this.parseChordSymbol(chordSymbol)
        : chordSymbol;

    const voicing = this.voicingEngine.generateVoicing(
      symbol,
      {
        ...this.config.voicingOptions,
        style: options?.voicingStyle || this.config.voicingOptions.style,
      },
      options?.context,
    );

    const velocity = (options?.velocity || 0.7) * this.currentVolume;
    const duration = options?.duration || 2000;

    // Analyze the chord
    const analyzedChord = this.harmonicAnalyzer.analyzeChord(
      voicing,
      options?.context,
    );

    // Play the voicing
    await this.triggerChord(voicing, velocity, duration, options?.time);

    // Update chord progression
    this.updateChordProgression(analyzedChord);
  }

  public stopChord(chordId?: string): void {
    logger.info(
      '🎹 ChordInstrumentProcessor.stopChord called with chordId:',
      chordId,
    );

    // CRITICAL: When no chordId provided, this is a STOP ALL (DAW panic button)
    if (!chordId) {
      // Cancel all scheduled Transport events to prevent future notes
      if (Tone && Tone.Transport) {
        try {
          // Cancel all events starting from slightly in the past to catch any that might be "in flight"
          const now = Tone.Transport.seconds;
          const cancelFrom = Math.max(0, now - 0.1); // Go back 100ms to catch in-flight events
          Tone.Transport.cancel(cancelFrom);
          // logger.info(`🎹 Cancelled all Transport events from ${cancelFrom} (now: ${now})`);

          // Also clear the Transport timeline completely
          if ((Tone.Transport as any).timeline) {
            const timeline = (Tone.Transport as any).timeline;
            logger.info(
              `🎹 Clearing ${timeline._timeline.length} events from Transport timeline`,
            );
            timeline.cancel(0); // Cancel everything from the beginning
          }
        } catch (error) {
          logger.warn('Failed to cancel Transport events:', error);
        }
      }

      // Cancel all scheduled release timeouts
      logger.info(
        `🎹 Cancelling ${this.releaseTimeouts.size} scheduled releases`,
      );
      this.releaseTimeouts.forEach((timeout, id) => {
        clearTimeout(timeout);
        logger.info(`🎹 Cancelled release timeout for chord ${id}`);
      });
      this.releaseTimeouts.clear();
    } else {
      // Cancel specific chord release timeout
      const timeout = this.releaseTimeouts.get(chordId);
      if (timeout) {
        clearTimeout(timeout);
        this.releaseTimeouts.delete(chordId);
        logger.info(`🎹 Cancelled release timeout for chord ${chordId}`);
      }
    }

    if (this.useVelocitySampler && this.velocitySampler) {
      // logger.info('🚨 EMERGENCY STOP: ChordInstrumentProcessor velocity sampler - PROFESSIONAL DAW BEHAVIOR');
      // When no chordId, this is STOP ALL - use immediate gain cutting
      if (!chordId) {
        // logger.info('🚨 Calling velocity sampler panic methods for immediate silence...');

        // Call allSoundOff first for immediate gain cutting
        if (typeof (this.velocitySampler as any).allSoundOff === 'function') {
          // logger.info('🚨 Calling velocitySampler.allSoundOff() - immediate gain cutting');
          (this.velocitySampler as any).allSoundOff();
        }

        // Then call stopAll for comprehensive stop
        if (typeof (this.velocitySampler as any).stopAll === 'function') {
          // logger.info('🚨 Calling velocitySampler.stopAll() - comprehensive stop');
          (this.velocitySampler as any).stopAll();
        }
      } else {
        logger.info(
          '🎹 Single chord stop - chordId:',
          chordId,
          'hasStopAll:',
          typeof (this.velocitySampler as any).stopAll === 'function',
        );
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    // Handle other keyboard instruments that auto-manage note duration
    if (this.useWurlitzer && this.wurlitzerSampler) {
      // Stop all notes immediately if stopAll is available (global stop)
      if (
        !chordId &&
        typeof (this.wurlitzerSampler as any).stopAll === 'function'
      ) {
        (this.wurlitzerSampler as any).stopAll();
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    if (this.useLongPad && this.longPadSampler) {
      // Stop all notes immediately if stopAll is available (global stop)
      if (
        !chordId &&
        typeof (this.longPadSampler as any).stopAll === 'function'
      ) {
        (this.longPadSampler as any).stopAll();
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    if (this.useRhodes && this.rhodesSampler) {
      // Stop all notes immediately if stopAll is available (global stop)
      if (
        !chordId &&
        typeof (this.rhodesSampler as any).stopAll === 'function'
      ) {
        (this.rhodesSampler as any).stopAll();
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    if (this.useTheSaw && this.theSawSampler) {
      // Stop all notes immediately if stopAll is available (global stop)
      if (
        !chordId &&
        typeof (this.theSawSampler as any).stopAll === 'function'
      ) {
        (this.theSawSampler as any).stopAll();
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    if (this.useSampler && this.sampler) {
      logger.info('🎹 Using regular sampler for stop');
      // Stop all notes immediately for global stop
      if (!chordId && typeof this.sampler.releaseAll === 'function') {
        // Store original envelope
        const originalEnvelope = {
          attack: this.sampler.attack,
          decay: this.sampler.decay,
          sustain: this.sampler.sustain,
          release: this.sampler.release,
        };

        // Set to immediate silence
        this.sampler.attack = 0;
        this.sampler.decay = 0;
        this.sampler.sustain = 0;
        this.sampler.release = 0;

        // Release all notes
        this.sampler.releaseAll(Tone.immediate());

        // Restore envelope after a brief moment
        setTimeout(() => {
          if (this.sampler) {
            this.sampler.attack = originalEnvelope.attack;
            this.sampler.decay = originalEnvelope.decay;
            this.sampler.sustain = originalEnvelope.sustain;
            this.sampler.release = originalEnvelope.release;
          }
        }, 50);

        logger.info('🎹 Regular sampler stopped with envelope manipulation');
      }

      // Clear tracking
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    if (this.useSoundfont && this.soundfontInstrument) {
      // For soundfont instruments, we can't manually stop individual notes
      // as they have their own duration. Just clear our tracking.
      if (chordId && this.activeChords.has(chordId)) {
        this.activeChords.delete(chordId);
      } else {
        this.activeChords.clear();
      }
      return;
    }

    // For synthesis, handle note release manually
    if (!chordId) {
      // GLOBAL STOP - Release all active notes immediately
      logger.info(
        `🎹 Stopping all ${this.activeChords.size} active chords in polySynth`,
      );

      try {
        if (typeof this.polySynth.releaseAll === 'function') {
          // Store original envelope
          const originalEnvelope = {
            attack: this.polySynth.get('envelope.attack'),
            decay: this.polySynth.get('envelope.decay'),
            sustain: this.polySynth.get('envelope.sustain'),
            release: this.polySynth.get('envelope.release'),
          };

          // Set to immediate silence
          this.polySynth.set({
            'envelope.attack': 0,
            'envelope.decay': 0,
            'envelope.sustain': 0,
            'envelope.release': 0,
          });

          // Release all notes
          this.polySynth.releaseAll(Tone.immediate());

          // Restore envelope after a brief moment
          setTimeout(() => {
            this.polySynth.set({
              'envelope.attack': originalEnvelope.attack,
              'envelope.decay': originalEnvelope.decay,
              'envelope.sustain': originalEnvelope.sustain,
              'envelope.release': originalEnvelope.release,
            });
          }, 50);

          logger.info('🎹 PolySynth stopped with immediate envelope');
        } else {
          // Fallback: release all tracked notes
          this.activeChords.forEach((chord) => {
            chord.notes.forEach((note) => {
              try {
                this.polySynth.triggerRelease(note, Tone.immediate());
              } catch (error) {
                logger.warn(`Failed to release note ${note}:`, error);
              }
            });
          });
        }
      } catch (error) {
        logger.warn('🎸 PolySynth global stop failed:', error);
      }

      this.activeChords.clear();
    } else if (chordId && this.activeChords.has(chordId)) {
      // Release specific chord notes
      const chord = this.activeChords.get(chordId);
      if (chord) {
        try {
          if (typeof this.polySynth.triggerRelease === 'function') {
            chord.notes.forEach((note) => {
              this.polySynth.triggerRelease(note);
            });
          }
        } catch (error) {
          logger.warn('🎸 Failed to release specific chord notes:', error);
        }
      }
      this.activeChords.delete(chordId);
    } else {
      // Release all active chord notes individually, then use releaseAll as backup
      try {
        if (typeof this.polySynth.triggerRelease === 'function') {
          // First try to release all tracked notes individually
          this.activeChords.forEach((chord) => {
            chord.notes.forEach((note) => {
              try {
                this.polySynth.triggerRelease(note);
              } catch (error) {
                logger.warn('🔴 Failed to release note:', note, error);
              }
            });
          });
        }

        // Then use releaseAll as backup to catch any remaining notes
        if (typeof this.polySynth.releaseAll === 'function') {
          // For immediate stop when no chordId (global stop)
          if (!chordId) {
            // Temporarily set all voice envelopes to immediate release
            const originalRelease = this.polySynth.get().envelope.release;
            this.polySynth.set({ envelope: { release: 0 } });

            // Release all notes immediately
            this.polySynth.releaseAll(Tone.immediate());

            // Restore original release after a brief moment
            setTimeout(() => {
              this.polySynth.set({ envelope: { release: originalRelease } });
            }, 50);
          } else {
            // Normal release for specific chord
            this.polySynth.releaseAll();
          }
        } else {
          logger.warn(
            '🎸 PolySynth.releaseAll() not available, likely in test environment',
          );
        }
      } catch (error) {
        logger.warn(
          '🎸 PolySynth note release failed, likely in test environment:',
          error,
        );
      }
      this.activeChords.clear();
    }
  }

  /**
   * Set exercise context for smart loading
   * Should be called before setPreset to enable smart loading
   */
  public setExerciseContext(exercise: Exercise | null): void {
    this.exerciseContext = exercise;
    logger.info('🎹 ChordInstrumentProcessor: Exercise context set', {
      hasExercise: !!exercise,
      chordProgression: exercise?.chord_progression,
      difficulty: exercise?.difficulty,
    });
  }

  public async setPreset(preset: ChordPreset): Promise<void> {
    this.currentPreset = preset;

    // Ensure Tone is loaded and components are initialized
    await this.ensureToneLoaded();

    // Initialize components if not already done
    if (!this.polySynth) {
      await this.initializeInstrument();
    }

    // Ensure effects are initialized before setting up preset
    if (!this.effects || !this.effects.reverb) {
      logger.warn('Effects not initialized, initializing now...');
      await this.setupEffects();
    }

    await this.setupPreset(preset);
  }

  /**
   * Ensure samples are fully loaded and ready to play
   * Called from HarmonyWidget to force immediate sample loading on page mount
   */
  public async ensureSamplesLoaded(): Promise<void> {
    logger.info(
      '🎹 ChordInstrumentProcessor: Ensuring samples are loaded for preset:',
      this.currentPreset,
    );

    // For piano preset, ensure Salamander sampler is loaded and ready
    if (this.currentPreset === ChordPreset.PIANO) {
      if (!this.velocitySampler) {
        logger.info('🎹 Velocity sampler not loaded, loading now...');
        const loaded = await this.loadVelocitySampler();
        if (!loaded) {
          throw new Error('Failed to load Salamander piano samples');
        }
      } else {
        // Ensure existing sampler is ready
        logger.info('🎹 Ensuring existing Salamander sampler is ready...');
        await this.velocitySampler.ensureReady();
      }

      // Ensure it's connected to effects
      if (this.effects?.reverb && this.velocitySampler) {
        try {
          this.velocitySampler.connect(this.effects.reverb);
          logger.info('✅ Salamander sampler connected to effects');
        } catch (error) {
          logger.warn('Failed to connect Salamander to effects:', error);
        }
      }
    }

    logger.info('✅ ChordInstrumentProcessor: Samples loaded and ready!');
  }

  private async loadSoundfontInstrument(instrumentName: string): Promise<void> {
    try {
      logger.info(
        `🎼 Starting to load professional samples: ${instrumentName}`,
      );

      if (Tone && Tone.context && Tone.context.state !== 'running') {
        logger.info(
          '🎼 AudioContext not running, will start on first user interaction',
        );
        // Don't start the context here - it will be started when user interacts with the widget
      }

      // Check instrument type and load appropriate sound
      if (instrumentName === 'acoustic_grand_piano') {
        // Try to use 16-velocity Salamander Grand Piano
        const velocityLoaded = await this.loadVelocitySampler();
        if (velocityLoaded) {
          this.useVelocitySampler = true;
          this.useSampler = false;
          this.useSoundfont = false;
          logger.info(
            `✅ Successfully loaded Salamander Grand Piano with 16 velocity layers!`,
          );
          return;
        }

        // Fallback to single-velocity Tone.Sampler
        const loaded = await this.loadToneSampler('salamander');
        if (loaded) {
          this.useSampler = true;
          this.useVelocitySampler = false;
          this.useSoundfont = false;
          logger.info(
            `✅ Successfully loaded Salamander Grand Piano using Tone.Sampler with local samples!`,
          );
          return;
        } else {
          // Fallback to piano synthesis
          logger.info('⚠️ Sampler failed, using piano synthesis fallback');
          await this.loadPianoSynthesis();
          this.useSampler = false;
          this.useVelocitySampler = false;
          this.useSoundfont = false;
          return;
        }
      } else if (instrumentName === 'drawbar_organ') {
        // Use synthesis for drawbar organ
        await this.loadOrganSynthesis();
        this.useSampler = false;
        this.useSoundfont = false;
        logger.info(`✅ Successfully loaded drawbar organ synthesis!`);
        return;
      } else if (
        instrumentName === 'pad_2_warm' ||
        instrumentName === 'pad_1_new_age'
      ) {
        // Use synthesis for warm pad
        await this.loadWarmPadSynthesis();
        this.useSampler = false;
        this.useSoundfont = false;
        logger.info(`✅ Successfully loaded warm pad synthesis!`);
        return;
      } else if (instrumentName === 'electric_piano_1') {
        // For Rhodes, use synthesis for now (until real samples are ready)
        await this.loadRhodesSynthesis();
        this.useSampler = false;
        this.useSoundfont = false;
        logger.info(
          `✅ Successfully loaded Rhodes synthesis (samples coming soon)!`,
        );
        return;
      } else if (
        instrumentName === 'string_ensemble_1' ||
        instrumentName === 'brass_section' ||
        instrumentName === 'lead_1_square'
      ) {
        // For other instruments, fall back to basic synthesis
        logger.info(
          `⚠️ ${instrumentName} not implemented, using default synthesis`,
        );
        this.useSampler = false;
        this.useSoundfont = false;
        return;
      }

      // First try to load professional samples from Supabase
      const professionalSamples =
        await this.loadProfessionalKeyboardSamples(instrumentName);
      if (professionalSamples && Object.keys(professionalSamples).length > 0) {
        this.currentSoundfont = professionalSamples;
        this.isLoadedSoundfont = true;
        logger.info(
          `✅ Successfully loaded professional ${instrumentName} samples from Supabase!`,
        );
        logger.info(`🎼 Professional instrument details:`, {
          name: instrumentName,
          isLoaded: true,
          usingSoundfont: true,
          source: 'Supabase professional samples',
          noteCount: Object.keys(professionalSamples).length,
          sampleNotes: Object.keys(professionalSamples).slice(0, 10),
        });
        return;
      }

      // Fallback to local soundfont files if professional samples not available
      logger.info(
        '🎼 Professional samples not available, falling back to local soundfont...',
      );

      const soundfontUrl = `/soundfonts/${instrumentName}-mp3.js`;
      logger.info(`🎼 Attempting to fetch soundfont directly: ${soundfontUrl}`);

      try {
        const response = await fetch(soundfontUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const soundfontText = await response.text();
        logger.info(
          `🎼 Fetched soundfont file, ${soundfontText.length} characters`,
        );

        // Parse the MIDI.js soundfont format manually
        const begin = soundfontText.indexOf('MIDI.Soundfont.');
        if (begin < 0) {
          throw new Error(
            'Invalid MIDI.js Soundfont format - no MIDI.Soundfont found',
          );
        }

        const assignmentIndex = soundfontText.indexOf('=', begin) + 2;
        const endIndex = soundfontText.lastIndexOf(',');

        if (assignmentIndex <= 2 || endIndex <= assignmentIndex) {
          throw new Error(
            'Invalid MIDI.js Soundfont format - cannot parse structure',
          );
        }

        const jsonPart = soundfontText.slice(assignmentIndex, endIndex) + '}';
        const soundfontData = JSON.parse(jsonPart);

        logger.info(
          `🎼 Parsed soundfont with ${Object.keys(soundfontData).length} notes`,
        );

        // Create a mock soundfont instrument that uses Tone.js for playback
        this.soundfontInstrument =
          this.createCustomSoundfontPlayer(soundfontData);
        this.useSoundfont = true;

        logger.info(
          `✅ Successfully loaded real ${instrumentName} samples using direct fetch!`,
        );
        logger.info('🎼 Soundfont instrument details:', {
          name: instrumentName,
          isLoaded: !!this.soundfontInstrument,
          usingSoundfont: this.useSoundfont,
          source: 'local files (direct fetch)',
          noteCount: Object.keys(soundfontData).length,
          url: soundfontUrl,
        });
      } catch (fetchError) {
        logger.warn(
          `🎼 Direct fetch failed: ${fetchError.message}, falling back to soundfont-player`,
        );

        // Fallback to soundfont-player with custom nameToUrl
        this.soundfontInstrument = await Soundfont.instrument(
          Tone.context,
          instrumentName,
          {
            format: 'mp3',
            nameToUrl: (name: string, soundfont?: string, format?: string) => {
              const actualFormat = format === 'ogg' ? 'ogg' : 'mp3';
              const localUrl = `/soundfonts/${name}-${actualFormat}.js`;
              logger.info(
                `🎼 Loading soundfont from local path (fallback): ${localUrl}`,
              );
              return localUrl;
            },
          },
        );
        this.useSoundfont = true;

        logger.info(
          `✅ Successfully loaded real ${instrumentName} samples using soundfont-player fallback!`,
        );
      }
    } catch (error) {
      logger.error(`❌ Failed to load ${instrumentName} soundfont:`, error);
      logger.info('🎼 Falling back to synthesis');
      this.useSoundfont = false;
      this.soundfontInstrument = null;

      // Apply appropriate synthesis based on instrument type
      if (instrumentName === 'acoustic_grand_piano') {
        await this.loadPianoSynthesis();
      } else if (instrumentName === 'electric_piano_1') {
        await this.loadRhodesSynthesis();
      } else if (instrumentName === 'drawbar_organ') {
        await this.loadOrganSynthesis();
      } else if (
        instrumentName === 'pad_2_warm' ||
        instrumentName === 'pad_1_new_age'
      ) {
        await this.loadWarmPadSynthesis();
      } else {
        logger.info(
          `⚠️ No synthesis fallback for ${instrumentName}, using default pad`,
        );
        await this.loadWarmPadSynthesis();
      }
    }
  }

  private createCustomSoundfontPlayer(
    soundfontData: Record<string, string>,
  ): any {
    return {
      play: async (
        note: string | number,
        when?: number,
        options?: { gain?: number; duration?: number },
      ) => {
        try {
          // Ensure AudioContext is running
          if (Tone.context.state !== 'running') {
            logger.info('🎼 Starting AudioContext for soundfont playback...');
            await Tone.start();
          }

          // Convert MIDI note number to note name if needed
          const noteName =
            typeof note === 'number' ? this.midiToNoteName(note) : note;
          const noteKey = this.findSoundfontNoteKey(noteName, soundfontData);

          if (!noteKey || !soundfontData[noteKey]) {
            logger.warn(`🎼 Note ${noteName} not found in soundfont data`);
            return;
          }

          // Get the Base64 audio data
          const base64Data = soundfontData[noteKey];
          if (!base64Data || !base64Data.startsWith('data:audio/')) {
            logger.warn(`🎼 Invalid audio data for note ${noteName}`);
            return;
          }

          // Decode and play the audio using Tone.js
          await this.playBase64Audio(
            base64Data,
            options?.gain || 0.7,
            options?.duration || 2000,
          );
        } catch (error) {
          logger.warn(`🎼 Error playing note ${note}:`, error);
        }
      },
    };
  }

  private midiToNoteName(midiNumber: number): string {
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
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return noteNames[noteIndex] + octave;
  }

  private findSoundfontNoteKey(
    noteName: string,
    soundfontData: Record<string, string>,
  ): string | null {
    // Try exact match first
    if (soundfontData[noteName]) return noteName;

    // Try common variations
    const variations = [
      noteName.replace('#', 's'), // C# -> Cs
      noteName.replace('b', 'f'), // Db -> Df
      noteName.replace('#', 'b'), // A# -> Ab (enharmonic equivalent)
      noteName.toUpperCase(),
      noteName.toLowerCase(),
    ];

    for (const variation of variations) {
      if (soundfontData[variation]) return variation;
    }

    // If still not found, log available keys around this note for debugging
    if (!soundfontData[noteName]) {
      logger.warn(`🎼 Note ${noteName} not found. Trying nearby notes...`);
      const allKeys = Object.keys(soundfontData);
      const nearbyKeys = allKeys.filter(
        (key) => key.includes('4') || key.includes('A') || key.includes('B'),
      );
      logger.warn(
        `🎼 Available keys containing 'A', 'B', or '4': ${nearbyKeys.slice(0, 10).join(', ')}`,
      );
    }

    return null;
  }

  private async playBase64Audio(
    base64Data: string,
    gain = 0.7,
    duration = 2000,
  ): Promise<void> {
    try {
      // Ensure Tone.js is started
      if (Tone.context.state !== 'running') {
        logger.info('🎼 Starting Tone.js AudioContext...');
        await Tone.start();
      }

      // Convert base64 to audio buffer
      const dataUrlIndex = base64Data.indexOf(',');
      if (dataUrlIndex === -1) {
        throw new Error('Invalid base64 data format');
      }

      const base64Audio = base64Data.slice(dataUrlIndex + 1);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      logger.info(`🎼 Decoding audio data, size: ${bytes.length} bytes`);

      // CRITICAL FIX: Use pre-activated AudioContext to maintain user gesture
      let audioContext: AudioContext;

      if (
        this.preActivatedContext &&
        this.preActivatedContext.state !== 'closed'
      ) {
        // Use pre-activated context (maintains user activation)
        audioContext = this.preActivatedContext;
        logger.info(
          '🎼 Using pre-activated AudioContext (user gesture preserved)',
        );
      } else if (
        typeof window !== 'undefined' &&
        window.preActivatedHarmonyContext &&
        window.preActivatedHarmonyContext.state !== 'closed'
      ) {
        // Use globally pre-activated context from user gesture
        audioContext = window.preActivatedHarmonyContext;
        logger.info(
          '🎼 Using globally pre-activated AudioContext (user gesture preserved)',
        );
      } else {
        // Fallback: create fresh context (may be silent if no user gesture)
        logger.warn(
          '🎼 No pre-activated context available, creating fresh one (may be silent)',
        );
        if (typeof window !== 'undefined') {
          const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;
          audioContext = new AudioContextClass();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        } else {
          throw new Error('AudioContext not available');
        }
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      logger.info(
        `🎼 Audio decoded successfully: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`,
      );

      // Check if the audio buffer contains actual audio data
      const channelData = audioBuffer.getChannelData(0);
      let maxAmplitude = 0;
      for (let i = 0; i < Math.min(1000, channelData.length); i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
      }
      logger.info(
        `🎼 Audio buffer sample data check - max amplitude: ${maxAmplitude.toFixed(6)}, first 10 samples:`,
        Array.from(channelData.slice(0, 10).map((x) => x.toFixed(4))),
      );

      // Create audio source using native Web Audio API
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = audioBuffer;
      // Boost gain significantly for quiet soundfont samples
      const boostedGain = gain * 100; // 100x amplification for extremely quiet samples
      gainNode.gain.value = Math.min(boostedGain, 10.0); // Allow higher gain for quiet samples
      logger.info(
        `🎼 Boosted gain from ${gain} to ${gainNode.gain.value} (${Math.round(boostedGain / gain)}x amplification)`,
      );
      logger.info(
        `🎼 Final gain calculation: ${gain} * 100 = ${boostedGain}, capped to ${gainNode.gain.value}`,
      );

      // Connect: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      logger.info(
        `🎼 Audio routing: BufferSource -> GainNode(${gainNode.gain.value}) -> Destination`,
      );
      logger.info(`🎼 Connection verification:`, {
        sourceConnected: !!source.buffer,
        gainNodeConnected: !!gainNode.gain,
        destinationReady: !!audioContext.destination,
        sameContexts:
          source.context === gainNode.context &&
          gainNode.context === audioContext,
      });

      logger.info(`🎼 Starting native Web Audio playback with gain: ${gain}`);
      logger.info(
        `🎼 AudioContext state: ${audioContext.state}, sampleRate: ${audioContext.sampleRate}`,
      );
      logger.info(
        `🎼 Audio buffer: ${audioBuffer.length} samples, ${audioBuffer.duration}s, channels: ${audioBuffer.numberOfChannels}`,
      );
      logger.info(
        `🎼 Output destination: ${audioContext.destination.channelCount} channels, maxChannelCount: ${audioContext.destination.maxChannelCount}`,
      );
      logger.info(
        `🎼 AudioContext instance:`,
        audioContext.constructor.name,
        audioContext,
      );

      // AudioContext is verified to be working

      source.start();

      // Monitor playback
      source.addEventListener('ended', () => {
        logger.info('🎼 Native soundfont sample playback ended');
      });

      // Clean up after duration
      setTimeout(
        () => {
          try {
            source.stop();
            source.disconnect();
            gainNode.disconnect();
            logger.info('🎼 Cleaned up native audio nodes');
          } catch (error) {
            logger.warn('🎼 Error during cleanup:', error);
          }
        },
        Math.min(duration, audioBuffer.duration * 1000),
      );
    } catch (error) {
      logger.error('🎼 Failed to play base64 audio:', error);
      // Fallback to synthesis if soundfont fails
      logger.warn('🎼 Falling back to synthesis');
    }
  }

  private async loadRealInstrumentForPreset(
    preset: ChordPreset,
  ): Promise<void> {
    // Reset all instrument flags
    this.useSoundfont = false;
    this.useSampler = false;
    this.useVelocitySampler = false;
    this.useWurlitzer = false;
    this.useLongPad = false;
    this.useRhodes = false;
    this.useTheSaw = false;

    // Handle our professional keyboard instruments
    switch (preset) {
      case ChordPreset.PIANO:
        // Use Salamander Grand Piano
        logger.info('🎹 Loading Salamander Grand Piano for PIANO preset...');
        const velocityLoaded = await this.loadVelocitySampler();
        if (velocityLoaded) {
          this.useVelocitySampler = true;
          // CRITICAL: Ensure samples are fully loaded and ready
          logger.info('🎹 Ensuring Salamander is fully ready after loading...');
          if (this.velocitySampler) {
            await this.velocitySampler.ensureReady();
          }
          logger.info('✅ Salamander Grand Piano fully loaded and ready!');
          return;
        }
        // Fallback to soundfont
        logger.warn('⚠️ Salamander failed to load, falling back to soundfont');
        await this.loadSoundfontInstrument('acoustic_grand_piano');
        break;

      case ChordPreset.WURLITZER:
        // Use Wurlitzer electric piano
        const wurlitzerLoaded = await this.loadWurlitzerSampler();
        if (wurlitzerLoaded) {
          this.useWurlitzer = true;
          return;
        }
        // Fallback to soundfont
        await this.loadSoundfontInstrument('electric_piano_1');
        break;

      case ChordPreset.LONG_PAD:
        // Use Long Pad sampler
        const longPadLoaded = await this.loadLongPadSampler();
        if (longPadLoaded) {
          this.useLongPad = true;
          return;
        }
        // Fallback to soundfont
        await this.loadSoundfontInstrument('pad_1_new_age');
        break;

      case ChordPreset.RHODES_VELOCITY:
        // Use Rhodes velocity sampler
        const rhodesLoaded = await this.loadRhodesSampler();
        if (rhodesLoaded) {
          this.useRhodes = true;
          return;
        }
        // Fallback to soundfont
        await this.loadSoundfontInstrument('electric_piano_1');
        break;

      case ChordPreset.THE_SAW:
        // Use The Saw sampler
        const sawLoaded = await this.loadTheSawSampler();
        if (sawLoaded) {
          this.useTheSaw = true;
          return;
        }
        // Fallback to soundfont
        await this.loadSoundfontInstrument('lead_1_square');
        break;

      default:
        // Map other presets to soundfont instruments
        const soundfontMapping: Record<ChordPreset, string> = {
          [ChordPreset.RHODES]: 'electric_piano_1', // Fender Rhodes
          [ChordPreset.ORGAN]: 'drawbar_organ', // Hammond B3
          [ChordPreset.STRINGS]: 'string_ensemble_1',
          [ChordPreset.BRASS]: 'brass_section',
          [ChordPreset.PAD]: 'pad_2_warm', // Warm pad
          [ChordPreset.SYNTH_LEAD]: 'lead_1_square',
          [ChordPreset.WARM_PAD]: 'pad_1_new_age',
        };

        const instrumentName = soundfontMapping[preset];
        if (instrumentName) {
          await this.loadSoundfontInstrument(instrumentName);
        }
        break;
    }
  }

  public setVolume(volume: number): void {
    try {
      // Store volume for use with samplers
      this.currentVolume = volume;

      // Convert linear volume (0-1) to decibels for Tone.js
      const dbVolume = volume > 0 ? Tone.gainToDb(volume) : -Infinity;

      // Set volume for synthesis
      if (this.polySynth && typeof this.polySynth.volume !== 'undefined') {
        this.polySynth.volume.value = dbVolume;
      }

      // Note: Individual samplers don't have setVolume methods
      // Volume is controlled via velocity when playing notes
      if (this.sampler && this.sampler.volume) {
        this.sampler.volume.value = dbVolume;
      }
    } catch (error) {
      logger.warn('Failed to set volume:', error);
    }
  }

  public updateVoicingOptions(options: Partial<VoicingOptions>): void {
    this.config.voicingOptions = { ...this.config.voicingOptions, ...options };
  }

  public updateEffects(effects: Partial<ChordEffects>): void {
    this.config.effects = { ...this.config.effects, ...effects };
    this.applyEffectSettings();
  }

  public analyzeProgression(chords: string[], key: string): ChordProgression {
    const parsedChords = chords.map((chordSymbol) => {
      const symbol = this.parseChordSymbol(chordSymbol);
      const voicing = this.voicingEngine.generateVoicing(
        symbol,
        this.config.voicingOptions,
      );
      return this.harmonicAnalyzer.analyzeChord(voicing, {
        key,
        mode: 'major',
        position: 'strong',
        function: 'tonic',
      });
    });

    return this.harmonicAnalyzer.analyzeProgression(parsedChords, key);
  }

  public getChordProgression(): ChordProgression | null {
    return this.chordProgression;
  }

  public reset(): void {
    this.stopChord();
    this.chordProgression = null;
    this.activeChords.clear();
  }

  /**
   * Load 16-velocity Salamander Grand Piano
   */
  private async loadVelocitySampler(): Promise<boolean> {
    try {
      logger.info('🎹 Loading 16-velocity Salamander Grand Piano...');

      // Ensure Tone is loaded first
      await this.ensureToneLoaded();

      // Check if Tone context is available
      if (!Tone || !Tone.context) {
        logger.error('❌ Tone.js not available for velocity sampler');
        return false;
      }

      // Dispose existing velocity sampler if any
      if (this.velocitySampler) {
        this.velocitySampler.dispose();
        this.velocitySampler = null;
      }

      // Create new velocity sampler
      this.velocitySampler = new SalamanderVelocitySampler();

      // Initialize with smart loading if exercise context is available
      if (this.exerciseContext) {
        const requiredNotes = extractExerciseNotes(this.exerciseContext);
        const velocityLayers = getVelocityLayersForExercise(
          this.exerciseContext,
        );
        logger.info('🎹 Smart loading Salamander with exercise context', {
          notesCount: requiredNotes.length,
          layers: velocityLayers,
        });
        await this.velocitySampler.initialize(requiredNotes, velocityLayers);
      } else {
        // Fallback to loading common velocity layers
        logger.info('🎹 No exercise context, loading default velocity layers');
        await this.velocitySampler.initialize();
      }

      // Connect to effects chain if available
      try {
        logger.info('Checking effects for Salamander connection:', {
          hasEffects: !!this.effects,
          hasReverb: !!this.effects?.reverb,
          reverbType: this.effects?.reverb?.constructor?.name,
          isReverbToneNode: this.effects?.reverb instanceof Tone.ToneAudioNode,
          hasInput: !!this.effects?.reverb?.input,
        });

        // Check if effects.reverb is a valid AudioNode before connecting
        if (
          this.effects &&
          this.effects.reverb &&
          this.effects.reverb instanceof Tone.Reverb
        ) {
          logger.info('Connecting Salamander to reverb effect');
          this.velocitySampler.connect(this.effects.reverb);
        } else {
          // Connect directly to destination if effects not ready
          logger.info('Connecting Salamander directly to destination');
          if (Tone && Tone.Destination) {
            this.velocitySampler.connect(Tone.Destination);
          }
        }
      } catch (connectError) {
        logger.warn(
          'Could not connect Salamander to effects, connecting to destination directly:',
          connectError,
        );
        try {
          if (Tone && Tone.Destination) {
            this.velocitySampler.connect(Tone.Destination);
          }
        } catch (destError) {
          logger.warn(
            'Could not connect to destination, will connect on play',
          );
        }
      }

      logger.info('✅ 16-velocity Salamander Grand Piano ready!');
      return true;
    } catch (error) {
      logger.error('❌ Failed to load velocity sampler:', error);
      if (this.velocitySampler) {
        this.velocitySampler.dispose();
        this.velocitySampler = null;
      }
      return false;
    }
  }

  /**
   * Load Wurlitzer Electric Piano
   */
  private async loadWurlitzerSampler(): Promise<boolean> {
    try {
      logger.info('🎹 Loading Wurlitzer Electric Piano...');

      // Dispose existing sampler if any
      if (this.wurlitzerSampler) {
        this.wurlitzerSampler.dispose();
        this.wurlitzerSampler = null;
      }

      // Create new Wurlitzer sampler
      this.wurlitzerSampler = new WurlitzerVelocitySampler();
      await this.wurlitzerSampler.initialize();

      // Connect to effects chain if available
      try {
        if (this.effects && this.effects.reverb && this.effects.reverb.input) {
          this.wurlitzerSampler.connect(this.effects.reverb);
        } else {
          // Connect directly to destination if effects not ready
          this.wurlitzerSampler.connect(Tone.Destination);
        }
      } catch (connectError) {
        logger.warn(
          'Could not connect Wurlitzer to effects, trying direct destination',
        );
        try {
          this.wurlitzerSampler.connect(Tone.Destination);
        } catch (e) {
          logger.warn('Wurlitzer connection failed, will connect on play');
        }
      }

      logger.info('✅ Wurlitzer Electric Piano ready!');
      return true;
    } catch (error) {
      logger.error('❌ Failed to load Wurlitzer sampler:', error);
      if (this.wurlitzerSampler) {
        this.wurlitzerSampler.dispose();
        this.wurlitzerSampler = null;
      }
      return false;
    }
  }

  /**
   * Load Long Pad Sampler
   */
  private async loadLongPadSampler(): Promise<boolean> {
    try {
      logger.info('🎹 Loading Long Pad...');

      // Dispose existing sampler if any
      if (this.longPadSampler) {
        this.longPadSampler.dispose();
        this.longPadSampler = null;
      }

      // Create new Long Pad sampler
      this.longPadSampler = new LongPadSampler();
      await this.longPadSampler.initialize();

      // Connect to effects chain if available
      try {
        if (this.effects && this.effects.reverb && this.effects.reverb.input) {
          this.longPadSampler.connect(this.effects.reverb);
        } else {
          // Connect directly to destination if effects not ready
          this.longPadSampler.connect(Tone.Destination);
        }
      } catch (connectError) {
        logger.warn(
          'Could not connect Long Pad to effects, trying direct destination',
        );
        try {
          this.longPadSampler.connect(Tone.Destination);
        } catch (e) {
          logger.warn('Long Pad connection failed, will connect on play');
        }
      }

      logger.info('✅ Long Pad ready!');
      return true;
    } catch (error) {
      logger.error('❌ Failed to load Long Pad sampler:', error);
      if (this.longPadSampler) {
        this.longPadSampler.dispose();
        this.longPadSampler = null;
      }
      return false;
    }
  }

  /**
   * Load Rhodes Electric Piano
   */
  private async loadRhodesSampler(): Promise<boolean> {
    try {
      logger.info('🎹 Loading Rhodes Electric Piano...');

      // Dispose existing sampler if any
      if (this.rhodesSampler) {
        this.rhodesSampler.dispose();
        this.rhodesSampler = null;
      }

      // Create new Rhodes sampler
      this.rhodesSampler = new RhodesVelocitySampler();
      await this.rhodesSampler.initialize();

      // Check if sampler initialized properly
      if (!this.rhodesSampler) {
        throw new Error('Rhodes sampler failed to initialize');
      }

      // Connect to effects chain if available
      try {
        if (this.effects && this.effects.reverb && this.effects.reverb.input) {
          this.rhodesSampler.connect(this.effects.reverb);
        } else {
          // Connect directly to destination if effects not ready
          this.rhodesSampler.connect(Tone.Destination);
        }
      } catch (connectError) {
        logger.warn(
          'Could not connect Rhodes to effects, trying direct destination',
        );
        try {
          this.rhodesSampler.connect(Tone.Destination);
        } catch (e) {
          logger.warn('Rhodes connection failed, will connect on play');
        }
      }

      logger.info('✅ Rhodes Electric Piano ready!');
      return true;
    } catch (error) {
      logger.error('❌ Failed to load Rhodes sampler:', error);
      if (this.rhodesSampler) {
        this.rhodesSampler.dispose();
        this.rhodesSampler = null;
      }
      return false;
    }
  }

  /**
   * Load The Saw Synthesizer
   */
  private async loadTheSawSampler(): Promise<boolean> {
    try {
      logger.info('🎹 Loading The Saw...');

      // Dispose existing sampler if any
      if (this.theSawSampler) {
        this.theSawSampler.dispose();
        this.theSawSampler = null;
      }

      // Create new The Saw sampler
      this.theSawSampler = new TheSawSampler();
      await this.theSawSampler.initialize();

      // Connect to effects chain if available
      try {
        if (this.effects && this.effects.reverb && this.effects.reverb.input) {
          this.theSawSampler.connect(this.effects.reverb);
        } else {
          // Connect directly to destination if effects not ready
          this.theSawSampler.connect(Tone.Destination);
        }
      } catch (connectError) {
        logger.warn(
          'Could not connect The Saw to effects, trying direct destination',
        );
        try {
          this.theSawSampler.connect(Tone.Destination);
        } catch (e) {
          logger.warn('The Saw connection failed, will connect on play');
        }
      }

      logger.info('✅ The Saw ready!');
      return true;
    } catch (error) {
      logger.error('❌ Failed to load The Saw sampler:', error);
      if (this.theSawSampler) {
        this.theSawSampler.dispose();
        this.theSawSampler = null;
      }
      return false;
    }
  }

  /**
   * Load Tone.js Sampler with professional samples from CDN
   */
  private async loadToneSampler(instrumentType: string): Promise<boolean> {
    try {
      logger.info(`🎹 Loading Tone.Sampler for ${instrumentType}...`);

      // Dispose existing sampler if any
      if (this.sampler) {
        this.sampler.dispose();
        this.sampler = null;
      }

      let urls: Record<string, string> = {};
      let baseUrl = '';

      if (instrumentType === 'salamander') {
        // Use local Salamander Grand Piano samples
        // Load every 3rd note for efficiency (Tone.js will interpolate)
        urls = {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
          C2: 'C2.mp3',
          'D#2': 'Ds2.mp3',
          'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',
          C3: 'C3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
          C5: 'C5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',
          C6: 'C6.mp3',
          'D#6': 'Ds6.mp3',
          'F#6': 'Fs6.mp3',
          A6: 'A6.mp3',
          C7: 'C7.mp3',
          'D#7': 'Ds7.mp3',
          'F#7': 'Fs7.mp3',
          A7: 'A7.mp3',
          C8: 'C8.mp3',
        };
        // Use local samples from public folder
        baseUrl = '/samples/salamander-piano/';
      } else {
        logger.warn(
          `Unknown instrument type for Tone.Sampler: ${instrumentType}`,
        );
        return false;
      }

      // Create new sampler with error handling
      try {
        this.sampler = new Tone.Sampler({
          urls,
          baseUrl,
          onload: () => {
            logger.info(
              `✅ Tone.Sampler loaded successfully for ${instrumentType}`,
            );
            // Connect to effects chain if available
            if (this.sampler) {
              if (this.effects && this.effects.reverb) {
                this.sampler.connect(this.effects.reverb);
              } else {
                // Connect directly to destination if effects not ready
                this.sampler.connect(Tone.Destination);
              }
            }
          },
          onerror: (error) => {
            logger.error(`❌ Failed to load Tone.Sampler:`, error);
            throw error;
          },
        });

        // Wait for samples to load with timeout
        await Promise.race([
          Tone.loaded(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Sampler loading timeout')),
              10000,
            ),
          ),
        ]);

        logger.info(
          `🎹 Tone.Sampler ready with ${Object.keys(urls).length} samples`,
        );
        return true;
      } catch (error) {
        logger.error(
          '❌ Sampler loading failed, falling back to synthesis:',
          error,
        );
        // Reset sampler on error
        if (this.sampler) {
          this.sampler.dispose();
          this.sampler = null;
        }
        return false;
      }
    } catch (error) {
      logger.error('❌ Failed to load Tone.Sampler:', error);
      return false;
    }
  }

  /**
   * Create piano synthesis fallback
   */
  private async loadPianoSynthesis(): Promise<void> {
    logger.info('🎹 Creating piano synthesis fallback...');

    // Dispose existing polySynth if needed
    if (this.polySynth) {
      this.polySynth.dispose();
    }

    // Create a piano-like synthesis using additive synthesis
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'custom',
        partials: [1, 0.67, 0.3, 0.2, 0.12, 0.08, 0.05], // Piano-like harmonics
      },
      envelope: {
        attack: 0.005,
        decay: 1.0,
        sustain: 0.3,
        release: 1.5,
      },
      filter: {
        Q: 2,
        frequency: 4000,
        type: 'lowpass',
        rolloff: -12,
      },
      filterEnvelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.8,
        release: 1.5,
        baseFrequency: 2000,
        octaves: 2,
      },
    });

    // Set polyphony
    this.polySynth.maxPolyphony = this.config.polyphony;

    // Add subtle chorus for richness
    const chorus = new Tone.Chorus(0.5, 2.5, 0.2).start();

    // Connect through effects chain
    this.polySynth.connect(chorus).connect(this.effects.reverb);

    logger.info('🎹 Piano synthesis ready (fallback for Salamander)');
  }

  /**
   * Create Rhodes electric piano synthesis
   */
  private async loadRhodesSynthesis(): Promise<void> {
    logger.info('🎹 Creating Rhodes electric piano synthesis...');

    // Dispose existing polySynth if needed
    if (this.polySynth) {
      this.polySynth.dispose();
    }

    // Create FM synthesis approximation of Rhodes
    this.polySynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 0.5,
      modulationIndex: 1.2,
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 1.2,
      },
      modulation: {
        type: 'sine',
      },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.5,
      },
    });

    // Set polyphony
    this.polySynth.maxPolyphony = this.config.polyphony;

    // Add characteristic Rhodes effects
    const tremolo = new Tone.Tremolo(5.5, 0.3).start();
    const phaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 2,
      baseFrequency: 400,
    });

    // Connect through effects chain (reverb is already connected to destination)
    this.polySynth
      .connect(tremolo)
      .connect(phaser)
      .connect(this.effects.reverb);

    logger.info('🎹 Rhodes electric piano synthesis ready');
  }

  /**
   * Create drawbar organ synthesis
   */
  private async loadOrganSynthesis(): Promise<void> {
    logger.info('🎹 Creating drawbar organ synthesis...');

    // Dispose existing polySynth if needed
    if (this.polySynth) {
      this.polySynth.dispose();
    }

    // Create Hammond-style organ with drawbar harmonics
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'custom',
        partials: [1, 0, 0.5, 0, 0.33, 0, 0, 0.25, 0.125], // Classic drawbar settings
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.9,
        release: 0.2,
      },
    });

    // Set polyphony
    this.polySynth.maxPolyphony = this.config.polyphony;

    // Add rotary speaker effect
    const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
    const tremolo = new Tone.Tremolo(6, 0.8).start();

    // Connect through effects chain (reverb is already connected to destination)
    this.polySynth
      .connect(chorus)
      .connect(tremolo)
      .connect(this.effects.reverb);

    logger.info('🎹 Drawbar organ synthesis ready');
  }

  /**
   * Create warm pad synthesis
   */
  private async loadWarmPadSynthesis(): Promise<void> {
    logger.info('🎹 Creating warm pad synthesis...');

    // Dispose existing polySynth if needed
    if (this.polySynth) {
      this.polySynth.dispose();
    }

    // Create warm analog-style pad using Synth (which is Monophonic)
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sawtooth',
      },
      envelope: {
        attack: 0.8,
        decay: 0.5,
        sustain: 0.8,
        release: 2.0,
      },
      filter: {
        Q: 1,
        frequency: 800,
        type: 'lowpass',
        rolloff: -24,
      },
      filterEnvelope: {
        attack: 0.5,
        decay: 0.2,
        sustain: 0.5,
        release: 2.0,
        baseFrequency: 200,
        octaves: 4,
      },
    });

    // Set polyphony
    this.polySynth.maxPolyphony = this.config.polyphony;

    // Add detune for warmth (simulating multiple oscillators)
    this.polySynth.set({
      detune: 20, // Slight detune for analog warmth
    });

    // Add lush effects
    const chorus = new Tone.Chorus(2, 3.5, 0.7).start();
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 });

    // Connect through effects chain (reverb is already connected to destination)
    this.polySynth.connect(chorus).connect(reverb).connect(this.effects.reverb);

    logger.info('🎹 Warm pad synthesis ready');
  }

  /**
   * Load professional keyboard samples from Supabase storage
   */
  private async loadProfessionalKeyboardSamples(
    instrumentName: string,
  ): Promise<Record<string, string> | null> {
    try {
      // Map instrument names to Supabase keyboard categories
      const instrumentMapping: Record<string, string> = {
        electric_piano_1: 'nice-keys-rhodes',
        pad_2_warm: 'zynaddsubfx-synth',
        acoustic_grand_piano: 'salamander-piano',
        drawbar_organ: 'versilian-organ',
        church_organ: 'versilian-organ',
        piano: 'salamander-piano',
        rhodes: 'nice-keys-rhodes',
        organ: 'versilian-organ',
        synth: 'zynaddsubfx-synth',
      };

      const professionalInstrument =
        instrumentMapping[instrumentName.toLowerCase()];
      if (!professionalInstrument) {
        logger.info(
          `🎼 No professional mapping for instrument: ${instrumentName}`,
        );
        return null;
      }

      logger.info(
        `🎼 Loading professional samples for: ${professionalInstrument}`,
      );

      // Load sample metadata from Supabase
      const metadataUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio-samples/metadata/keyboard-instruments.json`;

      try {
        const metadataResponse = await fetch(metadataUrl);
        if (!metadataResponse.ok) {
          throw new Error(
            `Failed to load metadata: ${metadataResponse.status}`,
          );
        }

        const metadata = await metadataResponse.json();
        const instrumentData = metadata.instruments.find(
          (inst: any) => inst.id === professionalInstrument,
        );

        if (!instrumentData || !instrumentData.samples) {
          logger.info(`🎼 No sample data found for: ${professionalInstrument}`);
          return null;
        }

        // Load individual sample files and create soundfont-compatible object
        const soundfontData: Record<string, string> = {};
        const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio-samples/keyboards/${professionalInstrument}`;

        // Load a subset of key samples (C, E, G notes across octaves for chord playing)
        const importantNotes = [
          'C3',
          'E3',
          'G3',
          'C4',
          'E4',
          'G4',
          'C5',
          'E5',
          'G5',
        ];

        for (const note of importantNotes) {
          const samplePath = `${baseUrl}/${note}.mp3`;

          try {
            const sampleResponse = await fetch(samplePath);
            if (sampleResponse.ok) {
              const audioBuffer = await sampleResponse.arrayBuffer();
              // Convert to Base64 for soundfont compatibility
              const base64Audio = btoa(
                String.fromCharCode(...new Uint8Array(audioBuffer)),
              );
              soundfontData[note] = `data:audio/mp3;base64,${base64Audio}`;
              logger.info(`🎼 Loaded professional sample: ${note}`);
            }
          } catch (error) {
            logger.warn(`🎼 Failed to load sample ${note}:`, error);
          }
        }

        if (Object.keys(soundfontData).length > 0) {
          logger.info(
            `🎼 Successfully loaded ${Object.keys(soundfontData).length} professional samples for ${professionalInstrument}`,
          );
          return soundfontData;
        }
      } catch (error) {
        logger.warn(`🎼 Failed to load professional samples metadata:`, error);
      }

      return null;
    } catch (error) {
      logger.warn(`🎼 Error loading professional keyboard samples:`, error);
      return null;
    }
  }

  public dispose(): void {
    this.reset();

    // ✅ CRITICAL FIX: Handle velocity sampler disposal
    if (this.velocitySampler) {
      try {
        this.velocitySampler.dispose();
        this.velocitySampler = null;
      } catch (error) {
        logger.warn('🎸 Velocity sampler disposal failed:', error);
      }
    }

    // Dispose Wurlitzer sampler
    if (this.wurlitzerSampler) {
      try {
        this.wurlitzerSampler.dispose();
        this.wurlitzerSampler = null;
      } catch (error) {
        logger.warn('🎸 Wurlitzer sampler disposal failed:', error);
      }
    }

    // Dispose Long Pad sampler
    if (this.longPadSampler) {
      try {
        this.longPadSampler.dispose();
        this.longPadSampler = null;
      } catch (error) {
        logger.warn('🎸 Long Pad sampler disposal failed:', error);
      }
    }

    // Dispose Rhodes sampler
    if (this.rhodesSampler) {
      try {
        this.rhodesSampler.dispose();
        this.rhodesSampler = null;
      } catch (error) {
        logger.warn('🎸 Rhodes sampler disposal failed:', error);
      }
    }

    // Dispose The Saw sampler
    if (this.theSawSampler) {
      try {
        this.theSawSampler.dispose();
        this.theSawSampler = null;
      } catch (error) {
        logger.warn('🎸 The Saw sampler disposal failed:', error);
      }
    }

    // ✅ CRITICAL FIX: Handle sampler disposal
    if (this.sampler) {
      try {
        if (typeof this.sampler.dispose === 'function') {
          this.sampler.dispose();
        }
        this.sampler = null;
      } catch (error) {
        logger.warn('🎸 Sampler disposal failed:', error);
      }
    }

    // ✅ CRITICAL FIX: Handle polySynth.dispose() in test environment
    try {
      if (typeof this.polySynth.dispose === 'function') {
        this.polySynth.dispose();
      } else {
        logger.warn(
          '🎸 PolySynth.dispose() not available, likely in test environment',
        );
      }
    } catch (error) {
      logger.warn(
        '🎸 PolySynth disposal failed, likely in test environment:',
        error,
      );
    }

    // ✅ CRITICAL FIX: Handle effects disposal in test environment
    Object.values(this.effects).forEach((effect) => {
      try {
        if (typeof effect.dispose === 'function') {
          effect.dispose();
        } else {
          logger.warn(
            '🎸 Effect.dispose() not available, likely in test environment',
          );
        }
      } catch (error) {
        logger.warn(
          '🎸 Effect disposal failed, likely in test environment:',
          error,
        );
      }
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async ensureToneLoaded(): Promise<void> {
    try {
      if (!Tone || !Tone.context) {
        Tone = await loadGlobalTone();
        logger.info(
          '🎵 Using global Tone.js instance in ChordInstrumentProcessor',
          {
            context: Tone?.context,
            contextState: Tone?.context?.state,
            contextTime: Tone?.context?.currentTime,
          },
        );
      }
    } catch (error) {
      logger.error('❌ Failed to load Tone.js:', error);
      throw new Error('Failed to load audio library');
    }
  }

  private async initializeInstrument(): Promise<void> {
    await this.ensureToneLoaded();

    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.0 },
    });

    // Set polyphony after creation
    this.polySynth.maxPolyphony = this.config.polyphony;
  }

  private async setupEffects(): Promise<void> {
    await this.ensureToneLoaded();

    logger.info('🎵 ChordInstrumentProcessor setupEffects - Tone instance:', {
      tone: Tone,
      context: Tone?.context,
      contextState: Tone?.context?.state,
      contextTime: Tone?.context?.currentTime,
    });

    try {
      this.effects = {
        reverb: new Tone.Reverb({
          decay: this.config.effects.reverb.decay,
          wet: this.config.effects.reverb.wet,
        }),
        chorus: new Tone.Chorus({
          frequency: this.config.effects.chorus.frequency,
          depth: this.config.effects.chorus.depth,
          wet: this.config.effects.chorus.wet,
        }),
        stereoWidener: new Tone.StereoWidener(
          this.config.effects.stereoImaging.width,
        ),
        eq: new Tone.EQ3({ low: 0, mid: 0, high: 0 }),
      };

      // logger.info('🎵 Effects created with context:', {
      //   reverbContext: this.effects.reverb?.context,
      //   reverbContextTime: this.effects.reverb?.context?.currentTime,
      // });

      // CRITICAL: Connect the reverb (final effect) to destination
      // This ensures any synth connected to reverb will reach the speakers
      this.effects.reverb.toDestination();
    } catch (error) {
      logger.warn(
        'Failed to initialize effects, using empty effects chain:',
        error,
      );
      this.effects = {
        reverb: null as any,
        chorus: null as any,
        stereoWidener: null as any,
        eq: null as any,
      };
    }

    // Connect effects chain with error handling for test environments
    try {
      const chainResult = this.polySynth.chain(
        this.effects.eq,
        this.effects.chorus,
        this.effects.reverb,
        this.effects.stereoWidener,
      );

      // Ensure toDestination exists before calling
      if (chainResult && typeof chainResult.toDestination === 'function') {
        chainResult.toDestination();
      } else {
        // Fallback for test environments
        logger.warn(
          'ChordInstrumentProcessor: toDestination not available, likely in test environment',
        );
      }
    } catch (error) {
      // Graceful degradation for test environments
      logger.warn(
        'ChordInstrumentProcessor: Effect chain setup failed, likely in test environment:',
        error,
      );

      // Ensure effects are still properly initialized for testing
      Object.values(this.effects).forEach((effect) => {
        if (effect && typeof effect.set === 'function') {
          // Effects are properly mocked and can be used in tests
        }
      });
    }
  }

  private async setupPreset(preset: ChordPreset): Promise<void> {
    // Load real instrument samples for supported presets
    await this.loadRealInstrumentForPreset(preset);

    // Ensure polySynth is available before setting preset
    if (!this.polySynth || typeof this.polySynth.set !== 'function') {
      logger.warn(
        'ChordInstrumentProcessor: polySynth.set not available, likely in test environment',
      );
      return;
    }

    switch (preset) {
      case ChordPreset.PAD:
        // Lush analog pad with multiple detuned oscillators
        this.polySynth.set({
          oscillator: {
            type: 'fatsawtooth',
            spread: 30,
            count: 3,
          },
          envelope: { attack: 1.2, decay: 0.4, sustain: 0.8, release: 2.5 },
          filterEnvelope: {
            attack: 1.0,
            decay: 0.5,
            sustain: 0.7,
            release: 2.0,
          },
          filter: { type: 'lowpass', frequency: 800, Q: 5 },
        });
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 3.5, wet: 0.45 });
        }
        break;

      case ChordPreset.RHODES:
        // Authentic Rhodes electric piano with FM synthesis and tremolo
        this.polySynth.set({
          oscillator: {
            type: 'fmsine',
            modulationType: 'sine',
            modulationIndex: 15,
            harmonicity: 3.01,
          },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 1.5 },
          filterEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.5,
            release: 1.0,
          },
          filter: { type: 'lowpass', frequency: 2000, Q: 1 },
        });
        if (
          this.effects?.chorus &&
          typeof this.effects.chorus.set === 'function'
        ) {
          this.effects.chorus.set({ frequency: 1.5, depth: 0.4, wet: 0.35 });
        }
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 1.8, wet: 0.25 });
        }
        break;

      case ChordPreset.ORGAN:
        // Hammond B3 drawbar organ simulation with rotating speaker effect
        this.polySynth.set({
          oscillator: {
            type: 'fatsquare',
            spread: 20,
            count: 2,
          },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0.95, release: 0.1 },
          filter: { type: 'highpass', frequency: 100, Q: 0.5 },
        });
        if (
          this.effects?.chorus &&
          typeof this.effects.chorus.set === 'function'
        ) {
          this.effects.chorus.set({ frequency: 6, depth: 0.5, wet: 0.4 });
        }
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 1.2, wet: 0.2 });
        }
        break;

      case ChordPreset.STRINGS:
        // Lush string ensemble with slow attack and rich harmonics
        this.polySynth.set({
          oscillator: {
            type: 'fatsawtooth',
            spread: 40,
            count: 4,
          },
          envelope: { attack: 1.0, decay: 0.2, sustain: 0.9, release: 2.0 },
          filterEnvelope: {
            attack: 1.2,
            decay: 0.4,
            sustain: 0.8,
            release: 1.8,
          },
          filter: { type: 'lowpass', frequency: 1200, Q: 2 },
        });
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 4.5, wet: 0.6 });
        }
        break;

      case ChordPreset.BRASS:
        // Warm brass section with rich harmonics
        this.polySynth.set({
          oscillator: {
            type: 'fatsquare',
            spread: 25,
            count: 3,
          },
          envelope: { attack: 0.08, decay: 0.15, sustain: 0.85, release: 0.6 },
          filterEnvelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.5,
          },
          filter: { type: 'lowpass', frequency: 1500, Q: 3 },
        });
        if (this.effects?.eq && typeof this.effects.eq.set === 'function') {
          this.effects.eq.set({ low: 3, mid: 2, high: 1 });
        }
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 2.0, wet: 0.3 });
        }
        break;

      case ChordPreset.PIANO:
        // Realistic piano with complex harmonics and natural decay
        this.polySynth.set({
          oscillator: {
            type: 'fmtriangle',
            modulationType: 'sine',
            modulationIndex: 2,
            harmonicity: 2.01,
          },
          envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
          filterEnvelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.3,
            release: 1.0,
          },
          filter: { type: 'lowpass', frequency: 3000, Q: 0.8 },
        });
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 1.5, wet: 0.2 });
        }
        break;

      case ChordPreset.SYNTH_LEAD:
        // Analog synth lead with filter sweep
        this.polySynth.set({
          oscillator: {
            type: 'fatsawtooth',
            spread: 15,
            count: 2,
          },
          envelope: { attack: 0.02, decay: 0.08, sustain: 0.75, release: 0.4 },
          filterEnvelope: {
            attack: 0.05,
            decay: 0.15,
            sustain: 0.6,
            release: 0.3,
          },
          filter: { type: 'lowpass', frequency: 1800, Q: 8 },
        });
        break;

      case ChordPreset.WARM_PAD:
        // Ultra-warm analog pad with slow evolution
        this.polySynth.set({
          oscillator: {
            type: 'fattriangle',
            spread: 35,
            count: 4,
          },
          envelope: { attack: 2.0, decay: 0.6, sustain: 0.9, release: 3.5 },
          filterEnvelope: {
            attack: 2.5,
            decay: 1.0,
            sustain: 0.8,
            release: 3.0,
          },
          filter: { type: 'lowpass', frequency: 600, Q: 4 },
        });
        if (
          this.effects?.reverb &&
          typeof this.effects.reverb.set === 'function'
        ) {
          this.effects.reverb.set({ decay: 6.0, wet: 0.7 });
        }
        break;
    }
  }

  // Public method for DAW integration
  public async triggerChordFromDAW(params: {
    chord: string;
    velocity: number;
    time: number;
    duration?: string;
  }): void {
    try {
      // Parse the chord symbol
      const chordSymbol = this.parseChordSymbol(params.chord);

      // Generate voicing
      const voicing = this.generateVoicing(
        chordSymbol,
        this.voicingOptions,
        this.lastVoicing,
      );

      // Convert duration string to seconds if provided
      const durationInSeconds = params.duration
        ? this.parseDuration(params.duration)
        : 2.0; // Default 2 seconds

      // Trigger the chord
      await this.triggerChord(
        voicing,
        params.velocity,
        durationInSeconds,
        params.time,
      );

      // Update last voicing for voice leading
      this.lastVoicing = voicing;

      this.logger.info('🎹 ChordInstrumentProcessor: DAW chord triggered', {
        chord: params.chord,
        voicing,
        velocity: params.velocity,
        time: params.time,
        duration: durationInSeconds,
      });
    } catch (error) {
      this.logger.error(
        '🎹 ChordInstrumentProcessor: Error triggering DAW chord',
        error,
      );
    }
  }

  private async triggerChord(
    voicing: string[],
    velocity: number,
    duration: number,
    time?: number | string,
  ): Promise<void> {
    // Ensure Tone is loaded
    await this.ensureToneLoaded();

    // Restore volume if it was muted by panic
    if (this.currentVolume === 0 && this.volumeBeforePanic > 0) {
      logger.info('🎹 Restoring volume after panic:', this.volumeBeforePanic);
      this.currentVolume = this.volumeBeforePanic;
      this.setVolume(this.volumeBeforePanic);
      // Reset the stored volume
      this.volumeBeforePanic = 1;
    }

    // Use the provided time for proper Transport synchronization
    // When time is undefined, Tone.js will use the current time
    const playbackTime = time;

    logger.info('🎹 ChordInstrumentProcessor.triggerChord timing:', {
      time,
      currentTransportTime: Tone?.Transport?.seconds || 0,
      transportState: Tone?.Transport?.state || 'unknown',
      voicingNotes: voicing.length,
      notes: voicing,
    });

    // Ensure AudioContext is started before playing
    if (Tone && Tone.context) {
      if (Tone.context.state !== 'running') {
        try {
          logger.info('🎼 Starting AudioContext due to user interaction...');
          await Tone.start();
        } catch (error) {
          logger.warn('🎼 Failed to start AudioContext:', error);
          return;
        }
      }
    } else {
      logger.warn('🎼 Tone.js not properly initialized, cannot play chord');
      return;
    }

    const chordId = `chord_${Date.now()}`;

    logger.info('🎵 Triggering chord:', {
      voicing,
      useVelocitySampler: this.useVelocitySampler,
      useSampler: this.useSampler,
      useSoundfont: this.useSoundfont,
      hasVelocitySampler: !!this.velocitySampler,
      hasSampler: !!this.sampler,
      hasSoundfontInstrument: !!this.soundfontInstrument,
      currentPreset: this.currentPreset,
      contextState: Tone.context.state,
    });

    if (this.useVelocitySampler && this.velocitySampler) {
      logger.info(
        '🎹 Using 16-velocity Salamander Grand Piano for chord playback',
      );

      // Check if sampler is loaded
      const samplerStatus = (this.velocitySampler as any).getStatus?.();
      if (!samplerStatus?.initialized) {
        logger.warn('🎹 Salamander sampler not yet initialized, waiting...');
        // Try to initialize if not done
        try {
          await (this.velocitySampler as any).initialize?.();
        } catch (error) {
          logger.error('🎹 Failed to initialize Salamander sampler:', error);
          // Fallback to synthesis
          logger.info('🎹 Falling back to synthesis mode');
          return this.playbackActualNotes(
            voicing,
            velocity,
            duration,
            playbackTime,
          );
        }
      }

      // Ensure the sampler is ready before playing
      if ((this.velocitySampler as any).ensureReady) {
        try {
          logger.info(
            '🎹 Ensuring Salamander sampler is ready before playing chord...',
          );
          await (this.velocitySampler as any).ensureReady();
        } catch (error) {
          logger.error('🎹 Failed to ensure sampler ready:', error);
        }
      }

      // Convert velocity from 0-1 to MIDI 0-127
      const midiVelocity = Math.round(velocity * 127);

      // Play each note with velocity
      for (const note of voicing) {
        try {
          await this.velocitySampler.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            midiVelocity,
          );
        } catch (error) {
          logger.error(
            `🎹 Failed to play note ${note} with velocity sampler:`,
            error,
          );
          // If first note fails, try fallback for all notes
          if (voicing.indexOf(note) === 0) {
            logger.info(
              '🎹 First note failed, falling back to synthesis for entire chord',
            );
            return this.playbackActualNotes(
              voicing,
              velocity,
              duration,
              playbackTime,
            );
          }
        }
      }
    } else if (this.useWurlitzer && this.wurlitzerSampler) {
      logger.info('🎹 Using Wurlitzer Electric Piano for chord playback');
      const midiVelocity = Math.round(velocity * 127);

      for (const note of voicing) {
        try {
          await this.wurlitzerSampler.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            midiVelocity,
          );
        } catch (error) {
          logger.error(
            `🎹 Failed to play note ${note} with Wurlitzer:`,
            error,
          );
        }
      }
    } else if (this.useLongPad && this.longPadSampler) {
      logger.info('🎹 Using Long Pad for chord playback');

      for (const note of voicing) {
        try {
          await this.longPadSampler.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            velocity,
          );
        } catch (error) {
          logger.error(`🎹 Failed to play note ${note} with Long Pad:`, error);
        }
      }
    } else if (this.useRhodes && this.rhodesSampler) {
      logger.info('🎹 Using Rhodes Electric Piano for chord playback');
      const midiVelocity = Math.round(velocity * 127);

      for (const note of voicing) {
        try {
          await this.rhodesSampler.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            midiVelocity,
          );
        } catch (error) {
          logger.error(`🎹 Failed to play note ${note} with Rhodes:`, error);
        }
      }
    } else if (this.useTheSaw && this.theSawSampler) {
      logger.info('🎹 Using The Saw for chord playback');

      for (const note of voicing) {
        try {
          await this.theSawSampler.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            velocity,
          );
        } catch (error) {
          logger.error(`🎹 Failed to play note ${note} with The Saw:`, error);
        }
      }
    } else if (this.useSampler && this.sampler) {
      logger.info('🎹 Using Tone.Sampler for chord playback');
      // Use Tone.Sampler for professional samples
      voicing.forEach((note) => {
        try {
          this.sampler!.triggerAttackRelease(
            note,
            duration / 1000,
            playbackTime,
            velocity,
          );
        } catch (error) {
          logger.error(`🎹 Failed to play note ${note} with Sampler:`, error);
        }
      });
    } else if (this.useSoundfont && this.soundfontInstrument) {
      logger.info('🎼 Using soundfont samples for chord playback');
      // Use real instrument samples
      const playPromises = voicing.map(async (note) => {
        try {
          // Convert Tone.js note format (C4) to MIDI note number for soundfont
          const midiNote = this.noteToMidi(note);
          logger.info(`🎼 Playing soundfont note: ${note} (MIDI: ${midiNote})`);
          await this.soundfontInstrument.play(midiNote, undefined, {
            gain: velocity,
            duration: duration / 1000, // Convert ms to seconds
          });
        } catch (error) {
          logger.warn('🎸 Soundfont chord trigger failed:', error);
        }
      });

      // Wait for all notes to start playing
      await Promise.all(playPromises);
    } else {
      logger.info('🎸 Using synthesis fallback for chord playback');

      // Ensure Tone.js is started
      if (Tone.context.state !== 'running') {
        // logger.info('🎸 Starting Tone.js context...');
        await Tone.start();
      }

      // Fallback to synthesis
      voicing.forEach((note) => {
        try {
          if (typeof this.polySynth.triggerAttack === 'function') {
            logger.info(
              `🎸 Triggering note: ${note} with velocity: ${velocity}`,
            );
            this.polySynth.triggerAttack(note, playbackTime, velocity);
          } else {
            logger.warn(
              '🎸 PolySynth.triggerAttack() not available, likely in test environment',
            );
          }
        } catch (error) {
          logger.warn(
            '🎸 Chord trigger failed, likely in test environment:',
            error,
          );
        }
      });
    }

    // Track active chord with notes for manual release
    this.activeChords.set(chordId, {
      notes: voicing,
      time: Date.now(),
    });

    // Schedule manual release after duration (only needed for synthesis)
    if (!this.useSoundfont) {
      // Clear any existing timeout for this chord
      const existingTimeout = this.releaseTimeouts.get(chordId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.releaseTimeouts.delete(chordId);
      }

      // Create new timeout and track it
      const timeout = setTimeout(() => {
        if (this.activeChords.has(chordId)) {
          // Manually release the specific notes of this chord
          try {
            if (typeof this.polySynth.triggerRelease === 'function') {
              voicing.forEach((note) => {
                this.polySynth.triggerRelease(note);
              });
            }
          } catch (error) {
            logger.warn('🎸 Manual chord release failed:', error);
          }
          this.activeChords.delete(chordId);
        }
        this.releaseTimeouts.delete(chordId);
      }, duration);

      this.releaseTimeouts.set(chordId, timeout);
    }
  }

  private noteToMidi(note: string): number {
    // Convert Tone.js note format (e.g., "C4", "A#3") to MIDI note number
    const noteMap: { [key: string]: number } = {
      C: 0,
      'C#': 1,
      Db: 1,
      D: 2,
      'D#': 3,
      Eb: 3,
      E: 4,
      F: 5,
      'F#': 6,
      Gb: 6,
      G: 7,
      'G#': 8,
      Ab: 8,
      A: 9,
      'A#': 10,
      Bb: 10,
      B: 11,
    };

    const noteName =
      note.includes('#') || note.includes('b')
        ? note.slice(0, 2)
        : note.charAt(0);
    const octave = parseInt(note.slice(-1)) || 4;

    return (octave + 1) * 12 + (noteMap[noteName] || 0);
  }

  private parseChordSymbol(symbol: string): ChordSymbol {
    // Extract root note name properly including sharps/flats
    let root: string;
    if (
      symbol.length > 1 &&
      (symbol.charAt(1) === '#' || symbol.charAt(1) === 'b')
    ) {
      // Handle sharp/flat roots like "C#", "Bb"
      root = symbol.slice(0, 2) + '4'; // Add default octave
    } else {
      // Handle natural roots like "C", "G"
      root = symbol.charAt(0) + '4'; // Add default octave
    }

    let quality = ChordQuality.MAJOR;
    const extensions: number[] = [];
    const alterations: string[] = [];

    if (symbol.includes('m') && !symbol.includes('maj')) {
      quality = ChordQuality.MINOR;
    }

    if (symbol.includes('7')) {
      if (symbol.includes('maj7') || symbol.includes('M7')) {
        quality = ChordQuality.MAJOR_SEVENTH;
      } else if (quality === ChordQuality.MINOR) {
        quality = ChordQuality.MINOR_SEVENTH;
      } else {
        quality = ChordQuality.DOMINANT;
      }
    }

    if (symbol.includes('dim')) {
      quality = ChordQuality.DIMINISHED;
    }

    if (symbol.includes('aug') || symbol.includes('+')) {
      quality = ChordQuality.AUGMENTED;
    }

    if (symbol.includes('sus2')) {
      quality = ChordQuality.SUSPENDED_SECOND;
    }

    if (symbol.includes('sus4')) {
      quality = ChordQuality.SUSPENDED_FOURTH;
    }

    // Extract just the note name (without octave) for the ChordSymbol interface
    const rootNoteName =
      root.includes('#') || root.includes('b')
        ? root.slice(0, 2)
        : root.charAt(0);
    return { root: rootNoteName, quality, extensions, alterations };
  }

  private updateChordProgression(chord: ParsedChord): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.chordProgression) {
      this.chordProgression = {
        chords: [chord],
        key: 'C',
        romanNumerals: [chord.romanNumeral],
        functions: [chord.function],
        cadences: [],
        analysis: {
          complexity: 0,
          jazzContent: 0,
          classicalContent: 0,
          modernContent: 0,
          functionalHarmony: 0,
          chromaticism: 0,
        },
      };
    } else {
      this.chordProgression.chords.push(chord);
      this.chordProgression.romanNumerals.push(chord.romanNumeral);
      this.chordProgression.functions.push(chord.function);

      // Re-analyze progression
      this.chordProgression = this.harmonicAnalyzer.analyzeProgression(
        this.chordProgression.chords,
        this.chordProgression.key,
      );
    }
  }

  private applyEffectSettings(): void {
    // ✅ CRITICAL FIX: Handle effects.set() methods in test environment
    try {
      if (typeof this.effects.reverb.set === 'function') {
        this.effects.reverb.set({
          decay: this.config.effects.reverb.decay,
          wet: this.config.effects.reverb.wet,
        });
      } else {
        logger.warn(
          '🎸 Effects.reverb.set() not available, likely in test environment',
        );
      }
    } catch (error) {
      logger.warn(
        '🎸 Reverb effect settings failed, likely in test environment:',
        error,
      );
    }

    try {
      if (typeof this.effects.chorus.set === 'function') {
        this.effects.chorus.set({
          frequency: this.config.effects.chorus.frequency,
          depth: this.config.effects.chorus.depth,
          wet: this.config.effects.chorus.wet,
        });
      } else {
        logger.warn(
          '🎸 Effects.chorus.set() not available, likely in test environment',
        );
      }
    } catch (error) {
      logger.warn(
        '🎸 Chorus effect settings failed, likely in test environment:',
        error,
      );
    }

    // ✅ CRITICAL FIX: Handle stereo widener width setting
    try {
      if (
        this.effects.stereoWidener.width &&
        typeof this.effects.stereoWidener.width.value !== 'undefined'
      ) {
        this.effects.stereoWidener.width.value =
          this.config.effects.stereoImaging.width;
      } else {
        logger.warn(
          '🎸 StereoWidener.width not available, likely in test environment',
        );
      }
    } catch (error) {
      logger.warn(
        '🎸 Stereo widener settings failed, likely in test environment:',
        error,
      );
    }

    // ✅ CRITICAL FIX: Apply harmonic enhancement through EQ with error handling
    try {
      if (typeof this.effects.eq.set === 'function') {
        const { brightness, warmth, presence } =
          this.config.effects.harmonicEnhancement;
        this.effects.eq.set({
          low: warmth * 3 - 1.5,
          mid: presence * 2 - 1,
          high: brightness * 3 - 1.5,
        });
      } else {
        logger.warn(
          '🎸 Effects.eq.set() not available, likely in test environment',
        );
      }
    } catch (error) {
      logger.warn(
        '🎸 EQ effect settings failed, likely in test environment:',
        error,
      );
    }
  }

  private createDefaultConfig(
    config?: Partial<ChordInstrumentConfig>,
  ): ChordInstrumentConfig {
    return {
      preset: ChordPreset.PAD,
      voicingOptions: {
        style: VoicingStyle.CLOSE,
        range: { min: 'C3', max: 'C6' },
        doubling: false,
        omissions: [],
        voiceLeading: true,
        smoothness: 0.7,
      },
      effects: {
        reverb: { decay: 2.0, wet: 0.3 },
        chorus: { frequency: 1.5, depth: 0.2, wet: 0.2 },
        stereoImaging: { width: 0.5 },
        harmonicEnhancement: { brightness: 0.5, warmth: 0.5, presence: 0.5 },
      },
      polyphony: 8,
      velocity: { sensitivity: 0.8, curve: 'exponential' },
      ...config,
    };
  }

  /**
   * MIDI Panic - All Notes Off (Professional DAW implementation)
   * Implements CC#123 (All Notes Off)
   */
  public allNotesOff(): void {
    // logger.info('🚨 ChordInstrumentProcessor.allNotesOff() - MIDI CC#123');

    // Stop all active chords first
    this.stopChord();

    // Call allNotesOff on all samplers if available
    if (
      this.velocitySampler &&
      typeof (this.velocitySampler as any).allNotesOff === 'function'
    ) {
      (this.velocitySampler as any).allNotesOff();
    }
    if (
      this.wurlitzerSampler &&
      typeof (this.wurlitzerSampler as any).allNotesOff === 'function'
    ) {
      (this.wurlitzerSampler as any).allNotesOff();
    }
    if (
      this.longPadSampler &&
      typeof (this.longPadSampler as any).allNotesOff === 'function'
    ) {
      (this.longPadSampler as any).allNotesOff();
    }
    if (
      this.rhodesSampler &&
      typeof (this.rhodesSampler as any).allNotesOff === 'function'
    ) {
      (this.rhodesSampler as any).allNotesOff();
    }
    if (
      this.theSawSampler &&
      typeof (this.theSawSampler as any).allNotesOff === 'function'
    ) {
      (this.theSawSampler as any).allNotesOff();
    }
  }

  /**
   * MIDI Panic - All Sound Off (Professional DAW implementation)
   * Implements CC#120 (All Sound Off) - immediate silence
   */
  public allSoundOff(): void {
    // logger.info('🚨 ChordInstrumentProcessor.allSoundOff() - MIDI CC#120 - IMMEDIATE GAIN CUTTING');

    // CRITICAL: Store current volume before muting
    const originalVolume = this.currentVolume;

    // IMMEDIATE: Set master volume to 0 to cut all sound instantly
    this.currentVolume = 0;
    this.setVolume(0);

    // CRITICAL: Stop scheduled chord releases first
    this.stopChord(); // This will call stopAll on samplers

    // Immediate stop of all synthesizers with gain cutting
    if (this.polySynth) {
      try {
        // IMMEDIATE GAIN CUTTING on polySynth
        if (
          this.polySynth.volume &&
          this.polySynth.volume.value !== undefined
        ) {
          this.polySynth.volume.value = -Infinity;
          // logger.info('🚨 Set polySynth.volume.value = -Infinity');
        } else if (this.polySynth.volume && this.polySynth.volume.gain) {
          this.polySynth.volume.gain.value = 0;
          // logger.info('🚨 Set polySynth.volume.gain.value = 0');
        }

        this.polySynth.releaseAll(0); // Immediate release
        // logger.info('🚨 Called polySynth.releaseAll(0)');
      } catch (error) {
        logger.warn('Failed to release polySynth voices:', error);
      }
    }

    // Call allSoundOff on all samplers if available
    if (
      this.velocitySampler &&
      typeof (this.velocitySampler as any).allSoundOff === 'function'
    ) {
      // logger.info('🚨 Calling velocitySampler.allSoundOff()');
      (this.velocitySampler as any).allSoundOff();
    }
    if (
      this.wurlitzerSampler &&
      typeof (this.wurlitzerSampler as any).allSoundOff === 'function'
    ) {
      logger.info('🚨 Calling wurlitzerSampler.allSoundOff()');
      (this.wurlitzerSampler as any).allSoundOff();
    }
    if (
      this.longPadSampler &&
      typeof (this.longPadSampler as any).allSoundOff === 'function'
    ) {
      logger.info('🚨 Calling longPadSampler.allSoundOff()');
      (this.longPadSampler as any).allSoundOff();
    }
    if (
      this.rhodesSampler &&
      typeof (this.rhodesSampler as any).allSoundOff === 'function'
    ) {
      logger.info('🚨 Calling rhodesSampler.allSoundOff()');
      (this.rhodesSampler as any).allSoundOff();
    }
    if (
      this.theSawSampler &&
      typeof (this.theSawSampler as any).allSoundOff === 'function'
    ) {
      logger.info('🚨 Calling theSawSampler.allSoundOff()');
      (this.theSawSampler as any).allSoundOff();
    }

    logger.info(
      '🚨 ChordInstrumentProcessor.allSoundOff() - emergency stop completed',
    );

    // Store the original volume for later restoration but DO NOT restore it automatically
    // Volume will be restored when playChord is called again
    this.volumeBeforePanic = originalVolume;
    logger.info(
      '🎹 Stored volume',
      originalVolume,
      'for restoration on next play',
    );
  }

  /**
   * MIDI Panic - General panic button
   * Combines CC#120 (All Sound Off) and CC#123 (All Notes Off)
   */
  public panic(): void {
    logger.info(
      '🚨 ChordInstrumentProcessor.panic() - Professional MIDI Panic',
    );
    this.allSoundOff();
    this.allNotesOff();
  }

  /**
   * Preview a chord - plays sound even when in STOP/panic state
   * This allows auditioning chord sounds while transport is stopped
   */
  public previewChord(chord: ChordParameters, duration = '2n'): void {
    logger.info(
      `🎹 ChordInstrumentProcessor.previewChord(${chord.symbol}) - PREVIEW MODE`,
    );

    if (!this.isInitialized) {
      logger.warn('🎹 Cannot preview chord - processor not initialized');
      return;
    }

    // Check if we're currently in a STOP/panic state (volume muted)
    const wasInPanicState =
      this.volumeBeforePanic !== null || this.currentVolume === 0;

    if (wasInPanicState) {
      logger.info('🎹 Preview: Temporarily restoring volume for chord preview');

      // Temporarily restore volume for preview
      const previewVolume = this.volumeBeforePanic || 0.7; // Use stored volume or reasonable default
      this.setVolume(previewVolume * 0.8); // Slightly lower for preview

      // Also restore volume on individual samplers if they were muted
      if (this.velocitySampler) {
        try {
          // Try to restore sampler volume if it was muted
          const sampler = this.velocitySampler as any;
          if (sampler.samplers) {
            sampler.samplers.forEach((layerSampler: any) => {
              if (layerSampler && layerSampler.volume) {
                if (layerSampler.volume.value === -Infinity) {
                  layerSampler.volume.value = -6; // -6dB for preview
                } else if (
                  layerSampler.volume.gain &&
                  layerSampler.volume.gain.value === 0
                ) {
                  layerSampler.volume.gain.value = this.Tone.dbToGain(-6);
                }
              }
            });
          }
        } catch (error) {
          logger.warn(
            '🎹 Failed to restore sampler volume for preview:',
            error,
          );
        }
      }
    }

    // Play the preview chord
    try {
      const chordId = `preview-${Date.now()}`;
      this.playChord(chord, '+0.01', duration, chordId);
      logger.info(`🎹 Preview chord played: ${chord.symbol}`);
    } catch (error) {
      logger.warn('🎹 Failed to play preview chord:', error);
    }

    // If we were in panic state, restore the muted state after preview
    if (wasInPanicState) {
      setTimeout(() => {
        logger.info('🎹 Preview: Restoring STOP muting after chord preview');

        // Restore the STOP muting
        this.currentVolume = 0;
        this.setVolume(0);

        // Also re-mute samplers
        if (this.velocitySampler) {
          try {
            const sampler = this.velocitySampler as any;
            if (sampler.samplers) {
              sampler.samplers.forEach((layerSampler: any) => {
                if (layerSampler && layerSampler.volume) {
                  if (layerSampler.volume.value !== undefined) {
                    layerSampler.volume.value = -Infinity;
                  } else if (layerSampler.volume.gain) {
                    layerSampler.volume.gain.value = 0;
                  }
                }
              });
            }
          } catch (error) {
            logger.warn('🎹 Failed to restore STOP muting on sampler:', error);
          }
        }

        logger.info('🎹 STOP muting restored after chord preview');
      }, 1500); // Allow enough time for chord to be heard
    }
  }

  /**
   * MIDI Panic - Emergency stop with full disposal
   * Nuclear option when normal panic doesn't work
   */
  public midiPanic(): void {
    // logger.info('🚨 ChordInstrumentProcessor.midiPanic() - Emergency MIDI Panic');

    try {
      // 1. Immediate stop all
      this.allSoundOff();

      // 2. Call midiPanic on all samplers if available
      if (
        this.velocitySampler &&
        typeof (this.velocitySampler as any).midiPanic === 'function'
      ) {
        (this.velocitySampler as any).midiPanic();
      }
      if (
        this.wurlitzerSampler &&
        typeof (this.wurlitzerSampler as any).midiPanic === 'function'
      ) {
        (this.wurlitzerSampler as any).midiPanic();
      }
      if (
        this.longPadSampler &&
        typeof (this.longPadSampler as any).midiPanic === 'function'
      ) {
        (this.longPadSampler as any).midiPanic();
      }
      if (
        this.rhodesSampler &&
        typeof (this.rhodesSampler as any).midiPanic === 'function'
      ) {
        (this.rhodesSampler as any).midiPanic();
      }
      if (
        this.theSawSampler &&
        typeof (this.theSawSampler as any).midiPanic === 'function'
      ) {
        (this.theSawSampler as any).midiPanic();
      }

      // 3. Clear active chords
      this.activeChords.clear();
    } catch (error) {
      logger.error('🚨 ChordInstrumentProcessor.midiPanic() failed:', error);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ChordInstrumentProcessor;
