/**
 * Musical Expression & Articulation Engine
 *
 * Implements advanced musical interpretation and micro-timing for professional
 * musical expression across all instrument types. Provides groove templates,
 * swing quantization, humanization, and context-aware musical interpretation.
 *
 * Features:
 * - Advanced musical interpretation with micro-timing
 * - Groove templates with style-specific timing variations
 * - Swing quantization with adjustable ratios
 * - Context-aware musical interpretation
 * - Realistic articulation processing
 * - Humanization algorithms
 * - Musical phrasing intelligence
 *
 * @author BassNotion Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

// Core interfaces for musical expression
export interface MidiNoteEvent {
  note: string;
  velocity: number;
  time: number;
  duration: number;
  channel: number;
  articulation?: ArticulationType;
  expression?: ExpressionData;
}

export interface ExpressionData {
  dynamics: number; // 0-127
  articulation: ArticulationType;
  phrasing: PhrasingType;
  microTiming: number; // milliseconds offset
  humanization: HumanizationSettings;
}

export interface HumanizationSettings {
  timingVariation: number; // 0-1
  velocityVariation: number; // 0-1
  durationVariation: number; // 0-1
  enabled: boolean;
}

export interface GrooveTemplate {
  name: string;
  style: MusicalStyle;
  timingAdjustments: TimingMap;
  velocityAdjustments: VelocityMap;
  accentPatterns: AccentPattern[];
  swingRatio: number; // 0-1
  humanizationAmount: number; // 0-1
  microTimingProfile: MicroTimingProfile;
}

export interface MicroTimingProfile {
  beatOffset: number; // milliseconds
  subdivisionOffset: number; // milliseconds
  accentOffset: number; // milliseconds
  ghostNoteOffset: number; // milliseconds
}

export interface TimingMap {
  [beatPosition: string]: number; // milliseconds offset
}

export interface VelocityMap {
  [beatPosition: string]: number; // velocity multiplier 0-2
}

export interface AccentPattern {
  beats: number[];
  intensity: number; // 0-1
  type: 'strong' | 'medium' | 'weak';
}

export interface MusicalContext {
  key: string;
  timeSignature: [number, number];
  tempo: number;
  style: MusicalStyle;
  genre: string;
  complexity: number; // 0-1
  emotionalIntensity: number; // 0-1
}

export type ArticulationType =
  | 'legato'
  | 'staccato'
  | 'accent'
  | 'ghost'
  | 'slide'
  | 'hammer-on'
  | 'pull-off'
  | 'bend'
  | 'vibrato'
  | 'normal';

export type PhrasingType =
  | 'linear'
  | 'curved'
  | 'stepped'
  | 'flowing'
  | 'choppy'
  | 'smooth';

export type MusicalStyle =
  | 'jazz'
  | 'rock'
  | 'blues'
  | 'funk'
  | 'latin'
  | 'classical'
  | 'pop'
  | 'electronic';

export interface OptimizationResult {
  success: boolean;
  optimizationTime: number;
  memoryFreed: number;
  efficiencyGain: number;
  recommendations: string[];
}

/**
 * Advanced Musical Expression Engine
 *
 * Provides sophisticated musical interpretation and expression processing
 * for all instrument types with context-aware musical intelligence.
 */
export class MusicalExpressionEngine extends EventEmitter {
  private static instance: MusicalExpressionEngine | null = null;

  private grooveTemplates: Map<string, GrooveTemplate> = new Map();
  // TODO: Review non-null assertion - consider null safety
  private swingProcessor!: SwingProcessor;
  // TODO: Review non-null assertion - consider null safety
  private microTimingEngine!: MicroTimingEngine;
  // TODO: Review non-null assertion - consider null safety
  private dynamicsProcessor!: DynamicsProcessor;
  // TODO: Review non-null assertion - consider null safety
  private articulationProcessor!: ArticulationProcessor;
  // TODO: Review non-null assertion - consider null safety
  private humanizationEngine!: HumanizationEngine;
  // TODO: Review non-null assertion - consider null safety
  private contextAnalyzer!: MusicalContextAnalyzer;
  // TODO: Review non-null assertion - consider null safety
  private phrasingEngine!: PhrasingEngine;

  private currentContext: MusicalContext | null = null;
  private isInitialized = false;

  private constructor() {
    super();
    console.log('🎵 Initializing Musical Expression Engine...');
  }

  /**
   * Get singleton instance of MusicalExpressionEngine
   */
  public static getInstance(): MusicalExpressionEngine {
    // TODO: Review non-null assertion - consider null safety
    if (!MusicalExpressionEngine.instance) {
      MusicalExpressionEngine.instance = new MusicalExpressionEngine();
    }
    return MusicalExpressionEngine.instance;
  }

  /**
   * Initialize the Musical Expression Engine
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Musical Expression Engine already initialized');
      return;
    }

    try {
      // Initialize core processors
      this.swingProcessor = new SwingProcessor();
      this.microTimingEngine = new MicroTimingEngine();
      this.dynamicsProcessor = new DynamicsProcessor();
      this.articulationProcessor = new ArticulationProcessor();
      this.humanizationEngine = new HumanizationEngine();
      this.contextAnalyzer = new MusicalContextAnalyzer();
      this.phrasingEngine = new PhrasingEngine();

      // Load default groove templates
      await this.loadDefaultGrooveTemplates();

      this.isInitialized = true;
      console.log('✅ Musical Expression Engine initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error(
        '❌ Failed to initialize Musical Expression Engine:',
        error,
      );
      throw error;
    }
  }

  /**
   * Apply musical expression to a collection of MIDI notes
   */
  public async applyExpression(
    notes: MidiNoteEvent[],
    context: MusicalContext,
    options: ExpressionOptions = {},
  ): Promise<MidiNoteEvent[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.currentContext = context;

    try {
      // Analyze musical context
      const contextAnalysis = await this.contextAnalyzer.analyze(
        notes,
        context,
      );

      // Apply groove template if specified
      let processedNotes = notes;
      if (options.grooveTemplate) {
        processedNotes = await this.applyGroove(
          processedNotes,
          options.grooveTemplate,
        );
      }

      // Apply swing quantization
      if (options.swingRatio !== undefined) {
        processedNotes = await this.applySwing(
          processedNotes,
          options.swingRatio,
        );
      }

      // Apply micro-timing adjustments
      processedNotes = await this.applyMicroTiming(
        processedNotes,
        contextAnalysis,
      );

      // Apply dynamics processing
      processedNotes = await this.applyDynamics(
        processedNotes,
        contextAnalysis,
      );

      // Apply articulation processing
      processedNotes = await this.applyArticulation(
        processedNotes,
        contextAnalysis,
      );

      // Apply humanization
      if (options.humanization?.enabled) {
        processedNotes = await this.applyHumanization(
          processedNotes,
          options.humanization,
        );
      }

      // Apply musical phrasing
      processedNotes = await this.applyPhrasing(
        processedNotes,
        contextAnalysis,
      );

      console.log(`🎵 Applied expression to ${processedNotes.length} notes`);
      return processedNotes;
    } catch (error) {
      console.error('❌ Error applying musical expression:', error);
      throw error;
    }
  }

  /**
   * Apply groove template to notes
   */
  public async applyGroove(
    notes: MidiNoteEvent[],
    grooveName: string,
  ): Promise<MidiNoteEvent[]> {
    const template = this.grooveTemplates.get(grooveName);
    // TODO: Review non-null assertion - consider null safety
    if (!template) {
      console.warn(`⚠️ Groove template '${grooveName}' not found`);
      return notes;
    }

    return notes.map((note) => {
      const beatPosition = this.calculateBeatPosition(note.time);
      const timingAdjustment = template.timingAdjustments[beatPosition] || 0;
      const velocityMultiplier =
        template.velocityAdjustments[beatPosition] || 1;

      return {
        ...note,
        time: note.time + timingAdjustment,
        velocity: Math.min(
          127,
          Math.max(1, note.velocity * velocityMultiplier),
        ),
        expression: {
          ...note.expression,
          dynamics: note.velocity * velocityMultiplier,
          articulation: note.expression?.articulation || 'normal',
          phrasing: note.expression?.phrasing || 'smooth',
          microTiming: timingAdjustment,
          humanization: note.expression?.humanization || {
            timingVariation: 0,
            velocityVariation: 0,
            durationVariation: 0,
            enabled: false,
          },
        },
      };
    });
  }

  /**
   * Apply swing quantization to notes
   */
  public async applySwing(
    notes: MidiNoteEvent[],
    swingRatio: number,
  ): Promise<MidiNoteEvent[]> {
    return this.swingProcessor.processNotes(notes, swingRatio);
  }

  /**
   * Apply micro-timing adjustments
   */
  private async applyMicroTiming(
    notes: MidiNoteEvent[],
    contextAnalysis: ContextAnalysis,
  ): Promise<MidiNoteEvent[]> {
    return this.microTimingEngine.processNotes(notes, contextAnalysis);
  }

  /**
   * Apply dynamics processing
   */
  private async applyDynamics(
    notes: MidiNoteEvent[],
    contextAnalysis: ContextAnalysis,
  ): Promise<MidiNoteEvent[]> {
    return this.dynamicsProcessor.processNotes(notes, contextAnalysis);
  }

  /**
   * Apply articulation processing
   */
  private async applyArticulation(
    notes: MidiNoteEvent[],
    contextAnalysis: ContextAnalysis,
  ): Promise<MidiNoteEvent[]> {
    return this.articulationProcessor.processNotes(notes, contextAnalysis);
  }

  /**
   * Apply humanization to notes
   */
  private async applyHumanization(
    notes: MidiNoteEvent[],
    settings: HumanizationSettings,
  ): Promise<MidiNoteEvent[]> {
    return this.humanizationEngine.processNotes(notes, settings);
  }

  /**
   * Apply musical phrasing
   */
  private async applyPhrasing(
    notes: MidiNoteEvent[],
    contextAnalysis: ContextAnalysis,
  ): Promise<MidiNoteEvent[]> {
    return this.phrasingEngine.processNotes(notes, contextAnalysis);
  }

  /**
   * Load default groove templates
   */
  private async loadDefaultGrooveTemplates(): Promise<void> {
    const templates: GrooveTemplate[] = [
      {
        name: 'jazz-swing',
        style: 'jazz',
        timingAdjustments: {
          '1': 0,
          '1.5': 15,
          '2': 0,
          '2.5': 15,
          '3': 0,
          '3.5': 15,
          '4': 0,
          '4.5': 15,
        },
        velocityAdjustments: {
          '1': 1.2,
          '1.5': 0.8,
          '2': 1.0,
          '2.5': 0.8,
          '3': 1.1,
          '3.5': 0.8,
          '4': 1.0,
          '4.5': 0.8,
        },
        accentPatterns: [
          { beats: [1, 3], intensity: 0.8, type: 'strong' },
          { beats: [2, 4], intensity: 0.6, type: 'medium' },
        ],
        swingRatio: 0.67,
        humanizationAmount: 0.3,
        microTimingProfile: {
          beatOffset: 0,
          subdivisionOffset: 5,
          accentOffset: -2,
          ghostNoteOffset: 8,
        },
      },
      {
        name: 'rock-straight',
        style: 'rock',
        timingAdjustments: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
        },
        velocityAdjustments: {
          '1': 1.3,
          '2': 0.9,
          '3': 1.2,
          '4': 0.9,
        },
        accentPatterns: [
          { beats: [1, 3], intensity: 0.9, type: 'strong' },
          { beats: [2, 4], intensity: 0.7, type: 'medium' },
        ],
        swingRatio: 0.5,
        humanizationAmount: 0.2,
        microTimingProfile: {
          beatOffset: 0,
          subdivisionOffset: 0,
          accentOffset: -1,
          ghostNoteOffset: 3,
        },
      },
      {
        name: 'funk-groove',
        style: 'funk',
        timingAdjustments: {
          '1': 0,
          '1.25': -3,
          '1.5': 2,
          '2': 0,
          '2.5': -2,
          '3': 0,
          '3.25': -3,
          '3.5': 2,
          '4': 0,
          '4.5': -2,
        },
        velocityAdjustments: {
          '1': 1.4,
          '1.25': 0.6,
          '1.5': 0.8,
          '2': 0.9,
          '2.5': 0.7,
          '3': 1.3,
          '3.25': 0.6,
          '3.5': 0.8,
          '4': 0.9,
          '4.5': 0.7,
        },
        accentPatterns: [
          { beats: [1], intensity: 1.0, type: 'strong' },
          { beats: [3], intensity: 0.9, type: 'strong' },
          { beats: [1.25, 3.25], intensity: 0.4, type: 'weak' },
        ],
        swingRatio: 0.52,
        humanizationAmount: 0.25,
        microTimingProfile: {
          beatOffset: 0,
          subdivisionOffset: 2,
          accentOffset: -2,
          ghostNoteOffset: 5,
        },
      },
    ];

    templates.forEach((template) => {
      this.grooveTemplates.set(template.name, template);
    });

    console.log(`✅ Loaded ${templates.length} groove templates`);
  }

  /**
   * Calculate beat position for timing adjustments
   */
  private calculateBeatPosition(time: number): string {
    // TODO: Review non-null assertion - consider null safety
    if (!this.currentContext) return '1';

    const beatsPerMeasure = this.currentContext.timeSignature[0];
    const beatUnit = this.currentContext.timeSignature[1];
    const beatDuration = (60 / this.currentContext.tempo) * (4 / beatUnit);

    const beatPosition = ((time / beatDuration) % beatsPerMeasure) + 1;
    return beatPosition.toFixed(2);
  }

  /**
   * Get available groove templates
   */
  public getGrooveTemplates(): string[] {
    return Array.from(this.grooveTemplates.keys());
  }

  /**
   * Add custom groove template
   */
  public addGrooveTemplate(template: GrooveTemplate): void {
    this.grooveTemplates.set(template.name, template);
    console.log(`✅ Added groove template: ${template.name}`);
  }

  /**
   * Dispose of the Musical Expression Engine
   */
  public async dispose(): Promise<void> {
    console.log('🧹 Disposing Musical Expression Engine...');

    try {
      // Clear templates
      this.grooveTemplates.clear();

      // Dispose processors
      if (this.swingProcessor) await this.swingProcessor.dispose();
      if (this.microTimingEngine) await this.microTimingEngine.dispose();
      if (this.dynamicsProcessor) await this.dynamicsProcessor.dispose();
      if (this.articulationProcessor)
        await this.articulationProcessor.dispose();
      if (this.humanizationEngine) await this.humanizationEngine.dispose();
      if (this.contextAnalyzer) await this.contextAnalyzer.dispose();
      if (this.phrasingEngine) await this.phrasingEngine.dispose();

      this.currentContext = null;
      this.isInitialized = false;

      // Clear singleton instance
      MusicalExpressionEngine.instance = null;

      console.log('✅ Musical Expression Engine disposed successfully');
      this.emit('disposed');
    } catch (error) {
      console.error('❌ Error disposing Musical Expression Engine:', error);
      throw error;
    }
  }
}

// Supporting processor classes
export interface ExpressionOptions {
  grooveTemplate?: string;
  swingRatio?: number;
  humanization?: HumanizationSettings;
  contextAware?: boolean;
}

export interface ContextAnalysis {
  musicalComplexity: number;
  rhythmicDensity: number;
  harmonicTension: number;
  emotionalIntensity: number;
  recommendedArticulations: ArticulationType[];
  suggestedPhrasing: PhrasingType;
}

/**
 * Swing Processor for swing quantization
 */
class SwingProcessor {
  public processNotes(
    notes: MidiNoteEvent[],
    swingRatio: number,
  ): MidiNoteEvent[] {
    return notes.map((note) => {
      const beatPosition = note.time % 1;

      // Apply swing to off-beats (0.5, 1.5, 2.5, etc.)
      if (Math.abs(beatPosition - 0.5) < 0.1) {
        const swingOffset = (swingRatio - 0.5) * 0.2; // Convert to timing offset
        return {
          ...note,
          time: note.time + swingOffset,
          expression: {
            ...note.expression,
            dynamics: note.expression?.dynamics || note.velocity,
            articulation: note.expression?.articulation || 'normal',
            phrasing: note.expression?.phrasing || 'smooth',
            microTiming: swingOffset * 1000, // Convert to milliseconds
            humanization: note.expression?.humanization || {
              timingVariation: 0,
              velocityVariation: 0,
              durationVariation: 0,
              enabled: false,
            },
          },
        };
      }

      return note;
    });
  }

  public async dispose(): Promise<void> {
    // Cleanup swing processor
  }
}

/**
 * Micro-timing Engine for subtle timing adjustments
 */
class MicroTimingEngine {
  public processNotes(
    notes: MidiNoteEvent[],
    context: ContextAnalysis,
  ): MidiNoteEvent[] {
    return notes.map((note) => {
      const microOffset = this.calculateMicroTiming(note, context);

      return {
        ...note,
        time: note.time + microOffset / 1000, // Convert ms to seconds
        expression: {
          ...note.expression,
          dynamics: note.expression?.dynamics || note.velocity,
          articulation: note.expression?.articulation || 'normal',
          phrasing: note.expression?.phrasing || 'smooth',
          microTiming: microOffset,
          humanization: note.expression?.humanization || {
            timingVariation: 0,
            velocityVariation: 0,
            durationVariation: 0,
            enabled: false,
          },
        },
      };
    });
  }

  private calculateMicroTiming(
    note: MidiNoteEvent,
    context: ContextAnalysis,
  ): number {
    // Calculate micro-timing based on musical context
    const baseOffset = (Math.random() - 0.5) * 10; // ±5ms random
    const complexityFactor = context.musicalComplexity * 5; // More complex = more timing variation
    const intensityFactor = context.emotionalIntensity * 3; // More intense = tighter timing

    return baseOffset + complexityFactor - intensityFactor;
  }

  public async dispose(): Promise<void> {
    // Cleanup micro-timing engine
  }
}

/**
 * Dynamics Processor for velocity and expression
 */
class DynamicsProcessor {
  public processNotes(
    notes: MidiNoteEvent[],
    context: ContextAnalysis,
  ): MidiNoteEvent[] {
    return notes.map((note) => {
      const dynamicVelocity = this.calculateDynamics(note, context);

      return {
        ...note,
        velocity: Math.min(127, Math.max(1, dynamicVelocity)),
        expression: {
          ...note.expression,
          dynamics: dynamicVelocity,
          articulation: note.expression?.articulation || 'normal',
          phrasing: note.expression?.phrasing || 'smooth',
          microTiming: note.expression?.microTiming || 0,
          humanization: note.expression?.humanization || {
            timingVariation: 0,
            velocityVariation: 0,
            durationVariation: 0,
            enabled: false,
          },
        },
      };
    });
  }

  private calculateDynamics(
    note: MidiNoteEvent,
    context: ContextAnalysis,
  ): number {
    const baseVelocity = note.velocity;
    const intensityMultiplier = 0.8 + context.emotionalIntensity * 0.4; // 0.8-1.2
    const complexityAdjustment = context.musicalComplexity * 10; // More complex = more dynamic range

    return baseVelocity * intensityMultiplier + complexityAdjustment;
  }

  public async dispose(): Promise<void> {
    // Cleanup dynamics processor
  }
}

/**
 * Articulation Processor for musical articulations
 */
class ArticulationProcessor {
  public processNotes(
    notes: MidiNoteEvent[],
    context: ContextAnalysis,
  ): MidiNoteEvent[] {
    return notes.map((note, index) => {
      const articulation = this.determineArticulation(
        note,
        notes,
        index,
        context,
      );

      return {
        ...note,
        articulation,
        expression: {
          ...note.expression,
          dynamics: note.expression?.dynamics || note.velocity,
          articulation,
          phrasing: note.expression?.phrasing || 'smooth',
          microTiming: note.expression?.microTiming || 0,
          humanization: note.expression?.humanization || {
            timingVariation: 0,
            velocityVariation: 0,
            durationVariation: 0,
            enabled: false,
          },
        },
      };
    });
  }

  private determineArticulation(
    note: MidiNoteEvent,
    allNotes: MidiNoteEvent[],
    index: number,
    _context: ContextAnalysis,
  ): ArticulationType {
    // Analyze note context for articulation
    const nextNote = allNotes[index + 1];
    const _prevNote = allNotes[index - 1];

    // Determine articulation based on note relationships
    if (
      nextNote &&
      Math.abs(nextNote.time - (note.time + note.duration)) < 0.01
    ) {
      return 'legato';
    }

    if (note.duration < 0.1) {
      return 'staccato';
    }

    if (note.velocity > 100) {
      return 'accent';
    }

    if (note.velocity < 40) {
      return 'ghost';
    }

    return 'normal';
  }

  public async dispose(): Promise<void> {
    // Cleanup articulation processor
  }
}

/**
 * Humanization Engine for natural musical variation
 */
class HumanizationEngine {
  public processNotes(
    notes: MidiNoteEvent[],
    settings: HumanizationSettings,
  ): MidiNoteEvent[] {
    // TODO: Review non-null assertion - consider null safety
    if (!settings.enabled) return notes;

    return notes.map((note) => {
      const timingVariation =
        (Math.random() - 0.5) * settings.timingVariation * 20; // ±10ms max
      const velocityVariation =
        (Math.random() - 0.5) * settings.velocityVariation * 20; // ±10 velocity
      const durationVariation =
        (Math.random() - 0.5) * settings.durationVariation * 0.1; // ±5% duration

      return {
        ...note,
        time: note.time + timingVariation / 1000,
        velocity: Math.min(127, Math.max(1, note.velocity + velocityVariation)),
        duration: Math.max(0.01, note.duration + durationVariation),
        expression: {
          ...note.expression,
          dynamics: note.expression?.dynamics || note.velocity,
          articulation: note.expression?.articulation || 'normal',
          phrasing: note.expression?.phrasing || 'smooth',
          microTiming: note.expression?.microTiming || 0,
          humanization: settings,
        },
      };
    });
  }

  public async dispose(): Promise<void> {
    // Cleanup humanization engine
  }
}

/**
 * Musical Context Analyzer for intelligent interpretation
 */
class MusicalContextAnalyzer {
  public async analyze(
    notes: MidiNoteEvent[],
    context: MusicalContext,
  ): Promise<ContextAnalysis> {
    const complexity = this.calculateComplexity(notes);
    const density = this.calculateRhythmicDensity(notes);
    const tension = this.calculateHarmonicTension(notes, context);
    const intensity = context.emotionalIntensity;

    return {
      musicalComplexity: complexity,
      rhythmicDensity: density,
      harmonicTension: tension,
      emotionalIntensity: intensity,
      recommendedArticulations: this.recommendArticulations(
        complexity,
        intensity,
      ),
      suggestedPhrasing: this.suggestPhrasing(context.style, intensity),
    };
  }

  private calculateComplexity(notes: MidiNoteEvent[]): number {
    // Analyze note patterns, intervals, rhythmic complexity
    const uniqueNotes = new Set(notes.map((n) => n.note)).size;
    const rhythmicVariation = this.calculateRhythmicVariation(notes);

    return Math.min(1, uniqueNotes / 12 + rhythmicVariation / 2);
  }

  private calculateRhythmicDensity(notes: MidiNoteEvent[]): number {
    if (notes.length === 0) return 0;

    const totalDuration = Math.max(...notes.map((n) => n.time + n.duration));
    return Math.min(1, notes.length / (totalDuration * 4)); // Notes per beat
  }

  private calculateHarmonicTension(
    _notes: MidiNoteEvent[],
    _context: MusicalContext,
  ): number {
    // Simplified harmonic tension calculation
    return Math.random() * 0.5 + 0.25; // Placeholder
  }

  private calculateRhythmicVariation(notes: MidiNoteEvent[]): number {
    if (notes.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < notes.length; i++) {
      const currentNote = notes[i];
      const previousNote = notes[i - 1];
      if (currentNote && previousNote) {
        intervals.push(currentNote.time - previousNote.time);
      }
    }

    if (intervals.length === 0) return 0;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0,
      ) / intervals.length;

    return Math.min(1, Math.sqrt(variance));
  }

  private recommendArticulations(
    complexity: number,
    intensity: number,
  ): ArticulationType[] {
    const articulations: ArticulationType[] = ['normal'];

    if (complexity > 0.7) {
      articulations.push('legato', 'staccato');
    }

    if (intensity > 0.8) {
      articulations.push('accent');
    }

    if (intensity < 0.3) {
      articulations.push('ghost');
    }

    return articulations;
  }

  private suggestPhrasing(
    style: MusicalStyle,
    intensity: number,
  ): PhrasingType {
    switch (style) {
      case 'jazz':
        return intensity > 0.7 ? 'flowing' : 'curved';
      case 'rock':
        return intensity > 0.8 ? 'choppy' : 'linear';
      case 'classical':
        return 'curved';
      case 'funk':
        return 'choppy';
      default:
        return 'smooth';
    }
  }

  public async dispose(): Promise<void> {
    // Cleanup context analyzer
  }
}

/**
 * Phrasing Engine for musical phrase shaping
 */
class PhrasingEngine {
  public processNotes(
    notes: MidiNoteEvent[],
    context: ContextAnalysis,
  ): MidiNoteEvent[] {
    const phrasing = context.suggestedPhrasing;

    return notes.map((note, index) => {
      const phrasePosition = this.calculatePhrasePosition(note, notes, index);
      const phrasedNote = this.applyPhrasing(note, phrasing, phrasePosition);

      return {
        ...phrasedNote,
        expression: {
          ...phrasedNote.expression,
          dynamics: phrasedNote.expression?.dynamics || phrasedNote.velocity,
          articulation: phrasedNote.expression?.articulation || 'normal',
          phrasing,
          microTiming: phrasedNote.expression?.microTiming || 0,
          humanization: phrasedNote.expression?.humanization || {
            timingVariation: 0,
            velocityVariation: 0,
            durationVariation: 0,
            enabled: false,
          },
        },
      };
    });
  }

  private calculatePhrasePosition(
    note: MidiNoteEvent,
    _allNotes: MidiNoteEvent[],
    _index: number,
  ): number {
    // Calculate position within musical phrase (0-1)
    const phraseLength = 8; // Assume 8-beat phrases
    const beatPosition = note.time % phraseLength;
    return beatPosition / phraseLength;
  }

  private applyPhrasing(
    note: MidiNoteEvent,
    phrasing: PhrasingType,
    position: number,
  ): MidiNoteEvent {
    let velocityMultiplier = 1;
    let timingAdjustment = 0;

    switch (phrasing) {
      case 'curved':
        // Crescendo to middle, diminuendo to end
        velocityMultiplier =
          position < 0.5 ? 0.8 + position * 0.4 : 1.2 - (position - 0.5) * 0.4;
        break;

      case 'flowing':
        // Smooth, connected phrasing
        timingAdjustment = Math.sin(position * Math.PI) * 5; // Subtle timing curve
        break;

      case 'choppy':
        // Separated, articulated phrasing
        if (position % 0.25 < 0.1) {
          velocityMultiplier = 1.2;
        }
        break;

      case 'linear':
        // Steady, even phrasing
        velocityMultiplier = 1;
        break;

      default:
        break;
    }

    return {
      ...note,
      time: note.time + timingAdjustment / 1000,
      velocity: Math.min(127, Math.max(1, note.velocity * velocityMultiplier)),
    };
  }

  public async dispose(): Promise<void> {
    // Cleanup phrasing engine
  }
}

export default MusicalExpressionEngine;
