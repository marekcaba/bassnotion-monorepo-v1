/**
 * MusicalContextAnalyzer - Task 7.2
 *
 * Implements musical context intelligence for predictive asset loading
 * based on MIDI content analysis and user behavioral patterns.
 *
 * Part of Story 2.2: Task 7, Subtask 7.2
 */

import {
  type ParsedMidiData,
  type ParsedTrack,
} from './MidiParserProcessor.js';

export interface MusicalPattern {
  id: string;
  type: 'chord_progression' | 'drum_pattern' | 'bass_line' | 'harmonic_rhythm';
  pattern: any[];
  frequency: number; // How often this pattern appears
  nextPatterns: Map<string, number>; // Likely next patterns with probabilities
  associatedAssets: string[]; // Assets commonly used with this pattern
}

export interface UserBehaviorPattern {
  userId?: string;
  sessionId: string;
  patterns: {
    preferredInstruments: Map<string, number>; // Instrument -> usage frequency
    commonProgressions: MusicalPattern[];
    practiceSchedule: Map<string, number>; // Time -> activity frequency
    difficultyProgression: number[]; // Historical difficulty levels
  };
  assetUsage: {
    mostUsedAssets: Map<string, number>; // Asset -> usage count
    loadingTimes: Map<string, number[]>; // Asset -> historical load times
    failureRates: Map<string, number>; // Asset -> failure rate
  };
}

export interface ContextPrediction {
  type: 'immediate' | 'short_term' | 'long_term';
  assets: AssetPredictionItem[];
  confidence: number; // 0-1
  reasoning: string[];
  timeframe: number; // milliseconds until needed
}

export interface AssetPredictionItem {
  url: string;
  type: 'audio' | 'midi';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  probability: number; // 0-1 likelihood of being needed
  estimatedLoadTime: number; // milliseconds
}

export interface MusicalContextState {
  currentKey: string;
  currentTimeSignature: string;
  currentTempo: number;
  currentChordProgression: string[];
  currentGenre: string;
  complexityLevel: number; // 0-1
  activeInstruments: Set<string>;
  recentPatterns: MusicalPattern[];
  userEngagement: 'low' | 'medium' | 'high';
}

export class MusicalContextAnalyzer {
  private patterns: Map<string, MusicalPattern> = new Map();
  private userBehavior: UserBehaviorPattern | null = null;
  private currentContext: MusicalContextState;
  private predictionHistory: ContextPrediction[] = [];
  private maxHistoryLength = 100;

  constructor() {
    this.currentContext = this.initializeDefaultContext();
  }

  /**
   * Initialize default musical context
   */
  private initializeDefaultContext(): MusicalContextState {
    return {
      currentKey: 'C',
      currentTimeSignature: '4/4',
      currentTempo: 120,
      currentChordProgression: [],
      currentGenre: 'unknown',
      complexityLevel: 0.5,
      activeInstruments: new Set(),
      recentPatterns: [],
      userEngagement: 'medium',
    };
  }

  /**
   * Analyze MIDI data and update musical context
   */
  public analyzeMusicalContext(midiData: ParsedMidiData): MusicalContextState {
    console.log('🎼 Analyzing musical context from MIDI data...');

    // Reset context for fresh analysis
    this.currentContext = this.initializeDefaultContext();

    // Update basic musical properties
    this.updateBasicContext(midiData);

    // Analyze patterns
    this.analyzePatterns(midiData);

    // Update instrument usage
    this.updateInstrumentUsage(midiData);

    // Determine complexity
    this.calculateComplexity(midiData);

    // Analyze genre characteristics
    this.analyzeGenre(midiData);

    console.log('🎼 Musical context analysis complete:', {
      key: this.currentContext.currentKey,
      tempo: this.currentContext.currentTempo,
      complexity: this.currentContext.complexityLevel,
      instruments: Array.from(this.currentContext.activeInstruments),
    });

    return this.currentContext;
  }

  /**
   * Update basic musical context from MIDI metadata
   */
  private updateBasicContext(midiData: ParsedMidiData): void {
    if (midiData.metadata) {
      this.currentContext.currentTempo = midiData.metadata.tempo || 120;
      this.currentContext.currentKey = midiData.metadata.key || 'C';

      if (midiData.metadata.timeSignature) {
        this.currentContext.currentTimeSignature = `${midiData.metadata.timeSignature.numerator}/${midiData.metadata.timeSignature.denominator}`;
      }
    }

    // Extract chord progression from chord tracks
    if (midiData.tracks.chords && midiData.tracks.chords.length > 0) {
      this.currentContext.currentChordProgression =
        this.extractChordProgression(midiData.tracks.chords);
    }
  }

  /**
   * Extract chord progression from chord tracks
   */
  private extractChordProgression(chordTracks: ParsedTrack[]): string[] {
    const chords: string[] = [];

    chordTracks.forEach((track) => {
      // Analyze simultaneous notes to identify chords
      const chordEvents = this.identifyChordEvents(track);
      chords.push(...chordEvents);
    });

    return chords;
  }

  /**
   * Identify chord events from a track
   */
  private identifyChordEvents(track: ParsedTrack): string[] {
    const chords: string[] = [];
    const simultaneousNotes: Map<number, string[]> = new Map();

    // Group notes by time
    track.notes.forEach((note) => {
      const time = Math.floor(note.startTime * 4); // Quantize to quarter notes
      if (!simultaneousNotes.has(time)) {
        simultaneousNotes.set(time, []);
      }
      simultaneousNotes.get(time)!.push(note.note);
    });

    // Analyze each time slice for chord identification
    simultaneousNotes.forEach((notes, _time) => {
      if (notes.length >= 3) {
        // Need at least 3 notes for a chord
        const chordSymbol = this.identifyChordFromNotes(notes);
        if (chordSymbol) {
          chords.push(chordSymbol);
        }
      }
    });

    return chords;
  }

  /**
   * Identify chord symbol from notes
   */
  private identifyChordFromNotes(notes: string[]): string | null {
    // Simplified chord identification
    // In practice, this would use more sophisticated music theory
    const uniqueNotes = Array.from(
      new Set(notes.map((note) => note.replace(/[0-9]/g, ''))),
    );

    if (uniqueNotes.length >= 3) {
      const root = uniqueNotes[0];

      // Basic triad identification
      if (
        uniqueNotes.includes('C') &&
        uniqueNotes.includes('E') &&
        uniqueNotes.includes('G')
      ) {
        return 'C';
      }
      // Add more chord patterns as needed
      return root || null; // Fallback to root note with null check
    }

    return null;
  }

  /**
   * Analyze musical patterns in the MIDI data
   */
  private analyzePatterns(midiData: ParsedMidiData): void {
    // Analyze chord progressions
    if (midiData.tracks.chords.length > 0) {
      this.analyzeChordProgressionPatterns(midiData.tracks.chords);
    }

    // Analyze drum patterns
    if (midiData.tracks.drums.length > 0) {
      this.analyzeDrumPatterns(midiData.tracks.drums);
    }

    // Analyze bass line patterns
    if (midiData.tracks.bass.length > 0) {
      this.analyzeBassPatterns(midiData.tracks.bass);
    }
  }

  /**
   * Analyze chord progression patterns
   */
  private analyzeChordProgressionPatterns(chordTracks: ParsedTrack[]): void {
    const progressions = this.extractChordProgression(chordTracks);

    // Look for common progression patterns (e.g., ii-V-I, vi-IV-I-V)
    const commonProgressions = this.findCommonProgressions(progressions);

    commonProgressions.forEach((progression) => {
      const patternId = `chord_prog_${progression.join('-')}`;
      const existingPattern = this.patterns.get(patternId);

      if (existingPattern) {
        existingPattern.frequency++;
      } else {
        this.patterns.set(patternId, {
          id: patternId,
          type: 'chord_progression',
          pattern: progression,
          frequency: 1,
          nextPatterns: new Map(),
          associatedAssets: this.getAssetsForChordProgression(progression),
        });
      }
    });
  }

  /**
   * Find common chord progressions
   */
  private findCommonProgressions(chords: string[]): string[][] {
    const progressions: string[][] = [];

    // Extract 4-chord progressions
    for (let i = 0; i <= chords.length - 4; i++) {
      progressions.push(chords.slice(i, i + 4));
    }

    return progressions;
  }

  /**
   * Get associated assets for chord progression
   */
  private getAssetsForChordProgression(progression: string[]): string[] {
    const assets: string[] = [];

    progression.forEach((chord) => {
      // Add bass samples for chord roots
      const root = chord.replace(/[^A-G#b]/g, '');
      assets.push(`bass-${root}.wav`);

      // Add chord voicing presets
      assets.push(`chord-${chord.toLowerCase()}.preset`);
    });

    return assets;
  }

  /**
   * Analyze drum patterns
   */
  private analyzeDrumPatterns(drumTracks: ParsedTrack[]): void {
    drumTracks.forEach((track) => {
      const patterns = this.extractDrumPatterns(track);

      patterns.forEach((pattern) => {
        const patternId = `drum_${pattern.signature}`;
        const existingPattern = this.patterns.get(patternId);

        if (existingPattern) {
          existingPattern.frequency++;
        } else {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'drum_pattern',
            pattern: pattern.events,
            frequency: 1,
            nextPatterns: new Map(),
            associatedAssets: ['fill-1.wav', 'fill-2.wav'], // Common fills
          });
        }
      });
    });
  }

  /**
   * Extract drum patterns from track
   */
  private extractDrumPatterns(
    track: ParsedTrack,
  ): Array<{ signature: string; events: any[] }> {
    // Simplified pattern extraction
    const patterns: Array<{ signature: string; events: any[] }> = [];

    // Group notes by measure
    const measures = this.groupNotesByMeasure(track.notes, 4); // 4/4 time

    measures.forEach((measure) => {
      const signature = this.calculateDrumPatternSignature(measure);
      patterns.push({
        signature,
        events: measure,
      });
    });

    return patterns;
  }

  /**
   * Group notes by measure
   */
  private groupNotesByMeasure(notes: any[], beatsPerMeasure: number): any[][] {
    const measures: any[][] = [];
    const measureLength = beatsPerMeasure;

    let currentMeasure: any[] = [];
    let currentMeasureStart = 0;

    notes.forEach((note) => {
      const measureIndex = Math.floor(note.startTime / measureLength);

      if (measureIndex > currentMeasureStart) {
        if (currentMeasure.length > 0) {
          measures.push(currentMeasure);
        }
        currentMeasure = [];
        currentMeasureStart = measureIndex;
      }

      currentMeasure.push(note);
    });

    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures;
  }

  /**
   * Calculate drum pattern signature
   */
  private calculateDrumPatternSignature(notes: any[]): string {
    // Create a simplified signature based on kick and snare patterns
    const kickTimes = notes
      .filter((n) => n.note.includes('kick'))
      .map((n) => n.startTime);
    const snareTimes = notes
      .filter((n) => n.note.includes('snare'))
      .map((n) => n.startTime);

    return `k${kickTimes.length}-s${snareTimes.length}`;
  }

  /**
   * Analyze bass patterns
   */
  private analyzeBassPatterns(bassTracks: ParsedTrack[]): void {
    bassTracks.forEach((track) => {
      const patterns = this.extractBassLinePatterns(track);

      patterns.forEach((pattern) => {
        const patternId = `bass_${pattern.type}`;
        const existingPattern = this.patterns.get(patternId);

        if (existingPattern) {
          existingPattern.frequency++;
        } else {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'bass_line',
            pattern: pattern.notes,
            frequency: 1,
            nextPatterns: new Map(),
            associatedAssets: this.getAssetsForBassPattern(pattern),
          });
        }
      });
    });
  }

  /**
   * Extract bass line patterns
   */
  private extractBassLinePatterns(
    track: ParsedTrack,
  ): Array<{ type: string; notes: any[] }> {
    const patterns: Array<{ type: string; notes: any[] }> = [];

    // Analyze for common bass patterns
    const notes = track.notes;

    if (this.isWalkingBass(notes)) {
      patterns.push({ type: 'walking', notes });
    } else if (this.isRootBass(notes)) {
      patterns.push({ type: 'root', notes });
    } else {
      patterns.push({ type: 'melodic', notes });
    }

    return patterns;
  }

  /**
   * Determine if bass line is walking bass
   */
  private isWalkingBass(notes: any[]): boolean {
    // Simplified walking bass detection
    // Look for stepwise motion and quarter note rhythm
    if (notes.length < 4) return false;

    let stepwiseCount = 0;
    for (let i = 1; i < notes.length; i++) {
      const interval = Math.abs(
        notes[i].octave * 12 +
          this.getNoteNumber(notes[i].note) -
          (notes[i - 1].octave * 12 + this.getNoteNumber(notes[i - 1].note)),
      );
      if (interval <= 2) stepwiseCount++;
    }

    return stepwiseCount / (notes.length - 1) > 0.6;
  }

  /**
   * Determine if bass line follows chord roots
   */
  private isRootBass(notes: any[]): boolean {
    // This would analyze if bass notes align with chord roots
    // Simplified implementation
    return notes.length > 0 && notes.every((note) => note.startTime % 1 === 0);
  }

  /**
   * Get assets for bass pattern
   */
  private getAssetsForBassPattern(pattern: {
    type: string;
    notes: any[];
  }): string[] {
    const assets: string[] = [];

    pattern.notes.forEach((note) => {
      assets.push(`bass-${note.note}${note.octave}.wav`);
    });

    return assets;
  }

  /**
   * Update instrument usage tracking
   */
  private updateInstrumentUsage(midiData: ParsedMidiData): void {
    this.currentContext.activeInstruments.clear();

    Object.entries(midiData.tracks).forEach(([instrument, tracks]) => {
      if (tracks.length > 0) {
        this.currentContext.activeInstruments.add(instrument);
      }
    });
  }

  /**
   * Calculate musical complexity
   */
  /**
   * Calculate musical complexity with enhanced algorithm
   */
  private calculateComplexity(midiData: ParsedMidiData): void {
    let complexity = 0;

    // Factor 1: Number of active instruments (0-0.25)
    const instrumentCount = this.currentContext.activeInstruments.size;
    complexity += Math.min(instrumentCount * 0.06, 0.25);

    // Factor 2: Chord progression complexity (0-0.25)
    const uniqueChords = new Set(this.currentContext.currentChordProgression);
    const chordComplexity = Math.min(uniqueChords.size * 0.04, 0.15);

    // Add complexity for advanced chord types
    const advancedChords = this.currentContext.currentChordProgression.filter(
      (chord) =>
        chord.includes('7') ||
        chord.includes('9') ||
        chord.includes('sus') ||
        chord.includes('dim'),
    );
    complexity += chordComplexity + advancedChords.length * 0.02;

    // Factor 3: Tempo complexity (0-0.2)
    const tempo = this.currentContext.currentTempo;
    if (tempo > 160) {
      complexity += 0.2; // Very fast
    } else if (tempo > 140) {
      complexity += 0.15; // Fast
    } else if (tempo < 60) {
      complexity += 0.1; // Very slow
    } else if (tempo < 80) {
      complexity += 0.05; // Slow
    }

    // Factor 4: Time signature complexity (0-0.25)
    const timeSignature = this.currentContext.currentTimeSignature;
    if (timeSignature === '4/4') {
      complexity += 0; // Standard
    } else if (timeSignature === '3/4' || timeSignature === '2/4') {
      complexity += 0.05; // Simple
    } else if (timeSignature === '6/8' || timeSignature === '12/8') {
      complexity += 0.1; // Compound
    } else if (timeSignature === '5/4' || timeSignature === '7/8') {
      complexity += 0.2; // Complex
    } else {
      complexity += 0.25; // Very complex
    }

    // Factor 5: Note density and rhythmic complexity (0-0.3)
    let totalNotes = 0;
    let totalDuration = 0;
    const rhythmicVariety = new Set<number>();

    Object.values(midiData.tracks)
      .flat()
      .forEach((track) => {
        if (track && track.notes) {
          totalNotes += track.notes.length;
          track.notes.forEach((note: any) => {
            totalDuration = Math.max(
              totalDuration,
              note.startTime + note.duration,
            );
            // Track rhythmic variety by quantizing note durations
            const quantizedDuration = Math.round(note.duration * 16) / 16;
            rhythmicVariety.add(quantizedDuration);
          });
        }
      });

    if (totalDuration > 0) {
      const noteDensity = totalNotes / totalDuration;
      complexity += Math.min(noteDensity * 0.02, 0.2); // Note density contribution
      complexity += Math.min(rhythmicVariety.size * 0.01, 0.1); // Rhythmic variety contribution
    }

    // Factor 6: Polyphony complexity (0-0.2)
    let maxSimultaneousNotes = 0;
    Object.values(midiData.tracks)
      .flat()
      .forEach((track) => {
        if (track && track.notes) {
          // Check for overlapping notes to determine polyphony
          const timeSlices = new Map<number, number>();
          track.notes.forEach((note: any) => {
            for (
              let t = Math.floor(note.startTime * 4);
              t < Math.ceil((note.startTime + note.duration) * 4);
              t++
            ) {
              timeSlices.set(t, (timeSlices.get(t) || 0) + 1);
            }
          });
          const trackMaxPolyphony = Math.max(
            ...Array.from(timeSlices.values()),
            0,
          );
          maxSimultaneousNotes = Math.max(
            maxSimultaneousNotes,
            trackMaxPolyphony,
          );
        }
      });
    complexity += Math.min(maxSimultaneousNotes * 0.04, 0.2);

    // Factor 7: Track interaction complexity (0-0.15)
    const trackCount = Object.values(midiData.tracks)
      .flat()
      .filter((track) => track && track.notes && track.notes.length > 0).length;
    if (trackCount > 1) {
      complexity += Math.min(trackCount * 0.03, 0.15);
    }

    // Ensure complexity is between 0 and 1
    this.currentContext.complexityLevel = Math.min(
      Math.max(complexity, 0),
      1.0,
    );
  }

  /**
   * Analyze genre characteristics
   */
  private analyzeGenre(_midiData: ParsedMidiData): void {
    // Simplified genre detection based on patterns
    const drumPatterns = Array.from(this.patterns.values()).filter(
      (p) => p.type === 'drum_pattern',
    );
    const chordProgressions = Array.from(this.patterns.values()).filter(
      (p) => p.type === 'chord_progression',
    );

    if (drumPatterns.some((p) => p.id.includes('k4-s2'))) {
      this.currentContext.currentGenre = 'rock';
    } else if (chordProgressions.some((p) => p.pattern.includes('ii-V-I'))) {
      this.currentContext.currentGenre = 'jazz';
    } else {
      this.currentContext.currentGenre = 'general';
    }
  }

  /**
   * Generate intelligent asset predictions
   */
  public generateAssetPredictions(
    midiData: ParsedMidiData,
    userBehavior?: UserBehaviorPattern,
  ): ContextPrediction[] {
    console.log('🔮 Generating intelligent asset predictions...');

    this.analyzeMusicalContext(midiData);
    if (userBehavior) {
      this.userBehavior = userBehavior;
    }

    const predictions: ContextPrediction[] = [];

    // Generate immediate predictions
    predictions.push(this.generateImmediatePredictions());

    // Generate short-term predictions
    predictions.push(this.generateShortTermPredictions());

    // Generate long-term predictions
    predictions.push(this.generateLongTermPredictions());

    // Store predictions in history
    this.predictionHistory.push(...predictions);
    if (this.predictionHistory.length > this.maxHistoryLength) {
      this.predictionHistory = this.predictionHistory.slice(
        -this.maxHistoryLength,
      );
    }

    console.log('🔮 Asset predictions generated:', {
      totalPredictions: predictions.length,
      averageConfidence:
        predictions.reduce((sum, p) => sum + p.confidence, 0) /
        predictions.length,
    });

    return predictions;
  }

  /**
   * Generate immediate asset predictions (needed within seconds)
   */
  private generateImmediatePredictions(): ContextPrediction {
    const assets: AssetPredictionItem[] = [];
    const reasoning: string[] = [];

    // Predict bass assets for current chord progression
    if (this.currentContext.activeInstruments.has('bass')) {
      this.currentContext.currentChordProgression.forEach((chord) => {
        const root = chord.replace(/[^A-G#b]/g, '');
        assets.push({
          url: `bass-${root}.wav`,
          type: 'audio',
          category: 'bass',
          priority: 'high',
          probability: 0.9,
          estimatedLoadTime: 100,
        });
        reasoning.push(`Bass sample for ${chord} chord`);
      });
    }

    // Also predict bass assets based on active bass instruments
    if (this.currentContext.activeInstruments.has('bass')) {
      const commonBassNotes = ['C', 'F', 'G', 'Am'];
      commonBassNotes.forEach((note) => {
        assets.push({
          url: `bass-${note}.wav`,
          type: 'audio',
          category: 'bass',
          priority: 'high',
          probability: 0.8,
          estimatedLoadTime: 100,
        });
      });
      reasoning.push('Common bass samples for bass instrument');
    }

    // Predict drum assets for current pattern
    if (this.currentContext.activeInstruments.has('drums')) {
      assets.push({
        url: 'kick-standard.wav',
        type: 'audio',
        category: 'drum',
        priority: 'high',
        probability: 0.8,
        estimatedLoadTime: 120,
      });
      assets.push({
        url: 'snare-standard.wav',
        type: 'audio',
        category: 'drum',
        priority: 'high',
        probability: 0.8,
        estimatedLoadTime: 120,
      });
      assets.push({
        url: 'fill-standard.wav',
        type: 'audio',
        category: 'drum',
        priority: 'medium',
        probability: 0.7,
        estimatedLoadTime: 150,
      });
      reasoning.push('Standard drum samples for current pattern');
    }

    // Predict chord assets
    if (this.currentContext.activeInstruments.has('chords')) {
      this.currentContext.currentChordProgression.forEach((chord) => {
        assets.push({
          url: `chord-${chord.toLowerCase()}.preset`,
          type: 'audio',
          category: 'chord',
          priority: 'high',
          probability: 0.85,
          estimatedLoadTime: 180,
        });
      });
      reasoning.push('Chord presets for current progression');
    }

    return {
      type: 'immediate',
      assets,
      confidence: 0.85,
      reasoning,
      timeframe: 5000, // 5 seconds
    };
  }

  /**
   * Generate short-term asset predictions (needed within minutes)
   */
  private generateShortTermPredictions(): ContextPrediction {
    const assets: AssetPredictionItem[] = [];
    const reasoning: string[] = [];

    // Predict based on common progression patterns
    const likelyNextChords = this.predictNextChords();
    likelyNextChords.forEach((chord) => {
      assets.push({
        url: `chord-${chord.toLowerCase()}.preset`,
        type: 'audio',
        category: 'chord-preset',
        priority: 'medium',
        probability: 0.6,
        estimatedLoadTime: 200,
      });
      reasoning.push(`Likely next chord: ${chord}`);
    });

    // Predict based on user behavior
    if (this.userBehavior) {
      const commonAssets = Array.from(
        this.userBehavior.assetUsage.mostUsedAssets.entries(),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      commonAssets.forEach(([asset, usage]) => {
        assets.push({
          url: asset,
          type: 'audio',
          category: 'user-preference',
          priority: 'low',
          probability: Math.min(usage / 100, 0.8),
          estimatedLoadTime: 300,
        });
        reasoning.push(`User frequently uses: ${asset}`);
      });
    }

    return {
      type: 'short_term',
      assets,
      confidence: 0.65,
      reasoning,
      timeframe: 300000, // 5 minutes
    };
  }

  /**
   * Generate long-term asset predictions (needed within session)
   */
  private generateLongTermPredictions(): ContextPrediction {
    const assets: AssetPredictionItem[] = [];
    const reasoning: string[] = [];

    // Predict based on genre characteristics
    const genreAssets = this.getAssetsForGenre(
      this.currentContext.currentGenre,
    );
    genreAssets.forEach((asset) => {
      assets.push({
        url: asset,
        type: 'audio',
        category: 'genre-specific',
        priority: 'low',
        probability: 0.4,
        estimatedLoadTime: 500,
      });
    });
    reasoning.push(
      `Genre-specific assets for ${this.currentContext.currentGenre}`,
    );

    // Predict practice progression assets
    if (this.userBehavior) {
      const nextDifficulty = this.predictNextDifficultyLevel();
      const difficultyAssets = this.getAssetsForDifficulty(nextDifficulty);

      difficultyAssets.forEach((asset) => {
        assets.push({
          url: asset,
          type: 'audio',
          category: 'difficulty-progression',
          priority: 'low',
          probability: 0.3,
          estimatedLoadTime: 400,
        });
      });
      reasoning.push(`Next difficulty level: ${nextDifficulty}`);
    }

    return {
      type: 'long_term',
      assets,
      confidence: 0.45,
      reasoning,
      timeframe: 1800000, // 30 minutes
    };
  }

  /**
   * Predict likely next chords
   */
  private predictNextChords(): string[] {
    const currentChords = this.currentContext.currentChordProgression;
    if (currentChords.length === 0) return [];

    const lastChord = currentChords[currentChords.length - 1];
    if (!lastChord) return ['C', 'F', 'G'];

    // Simplified next chord prediction
    const commonProgressions: Record<string, string[]> = {
      C: ['F', 'G', 'Am'],
      F: ['C', 'G', 'Dm'],
      G: ['C', 'Em', 'Am'],
      Am: ['F', 'C', 'G'],
    };

    return commonProgressions[lastChord] || ['C', 'F', 'G'];
  }

  /**
   * Get assets for genre
   */
  private getAssetsForGenre(genre: string): string[] {
    const genreAssets: Record<string, string[]> = {
      rock: [
        'drums-rock-kit.preset',
        'bass-rock-tone.preset',
        'guitar-distortion.preset',
      ],
      jazz: [
        'drums-jazz-kit.preset',
        'bass-jazz-upright.preset',
        'piano-rhodes.preset',
      ],
      general: [
        'drums-standard.preset',
        'bass-clean.preset',
        'piano-acoustic.preset',
      ],
    };

    const assets = genreAssets[genre];
    return assets || genreAssets['general'] || [];
  }

  /**
   * Predict next difficulty level
   */
  private predictNextDifficultyLevel(): number {
    if (!this.userBehavior) return 0.5;

    const progression = this.userBehavior.patterns.difficultyProgression;
    if (progression.length === 0) return 0.5;

    const recent = progression.slice(-5);
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length;

    // Slightly increase difficulty
    return Math.min(average + 0.1, 1.0);
  }

  /**
   * Get assets for difficulty level
   */
  private getAssetsForDifficulty(difficulty: number): string[] {
    if (difficulty < 0.3) {
      return ['beginner-bass-scales.mid', 'simple-chord-progressions.mid'];
    } else if (difficulty < 0.7) {
      return ['intermediate-bass-lines.mid', 'complex-chords.mid'];
    } else {
      return ['advanced-bass-techniques.mid', 'jazz-chords.mid'];
    }
  }

  /**
   * Get note number for pitch calculations
   */
  private getNoteNumber(noteName: string): number {
    const noteMap: Record<string, number> = {
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
    return noteMap[noteName] || 0;
  }

  /**
   * Update user behavior patterns
   */
  public updateUserBehavior(behavior: UserBehaviorPattern): void {
    this.userBehavior = behavior;
    console.log('👤 User behavior patterns updated');
  }

  /**
   * Get current musical context
   */
  public getCurrentContext(): MusicalContextState {
    return { ...this.currentContext };
  }

  /**
   * Get prediction accuracy metrics
   */
  public getPredictionMetrics(): {
    totalPredictions: number;
    averageConfidence: number;
    recentAccuracy: number;
  } {
    const totalPredictions = this.predictionHistory.length;
    const averageConfidence =
      totalPredictions > 0
        ? this.predictionHistory.reduce((sum, p) => sum + p.confidence, 0) /
          totalPredictions
        : 0;

    // Simplified accuracy calculation
    const recentAccuracy = 0.75; // Placeholder - would track actual vs predicted

    return {
      totalPredictions,
      averageConfidence,
      recentAccuracy,
    };
  }

  /**
   * Clear historical data
   */
  public clearHistory(): void {
    this.predictionHistory = [];
    this.patterns.clear();
    console.log('🧹 Musical context history cleared');
  }
}
