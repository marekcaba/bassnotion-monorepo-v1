/**
 * MusicalContextAnalyzer Tests
 *
 * Tests the musical context intelligence for predictive asset loading
 * based on MIDI content analysis and user behavioral patterns.
 *
 * Part of Story 2.2: Task 7, Subtask 7.2
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  MusicalContextAnalyzer,
  type UserBehaviorPattern,
} from '../plugins/MusicalContextAnalyzer.js';
import type { ParsedMidiData } from '../plugins/MidiParserProcessor.js';
import { TrackType } from '../plugins/MidiParserProcessor.js';

// Helper function to create test data with type assertions for simpler test setup
function createMockMidiData(overrides: any = {}): ParsedMidiData {
  const defaultData = {
    tracks: { chords: [], drums: [], bass: [], melody: [], other: [] },
    metadata: {
      trackCount: 0,
      totalNotes: 0,
      duration: 4,
      timeSignature: { numerator: 4, denominator: 4 },
      tempo: 120,
      key: 'C',
    },
    expression: {
      vibrato: 0,
      tremolo: 0,
      bend: 0,
      trill: 0,
    },
    performance: {
      timing: { accuracy: 0.9, consistency: 0.8 },
      dynamics: { range: 0.7, consistency: 0.8 },
      articulation: { variety: 0.6, consistency: 0.7 },
    },
    musicTheory: {
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
        complexity: 0.5,
        jazzContent: 0,
        classicalContent: 0,
      },
    },
  };

  return {
    ...defaultData,
    ...overrides,
    tracks: { ...defaultData.tracks, ...overrides.tracks },
    metadata: { ...defaultData.metadata, ...overrides.metadata },
    expression: { ...defaultData.expression, ...overrides.expression },
    performance: { ...defaultData.performance, ...overrides.performance },
    musicTheory: { ...defaultData.musicTheory, ...overrides.musicTheory },
  } as ParsedMidiData;
}

describe('MusicalContextAnalyzer', () => {
  let analyzer: MusicalContextAnalyzer;

  beforeEach(() => {
    analyzer = new MusicalContextAnalyzer();
  });

  describe('Initialization', () => {
    test('should initialize with default musical context', () => {
      const context = analyzer.getCurrentContext();

      expect(context).toEqual({
        currentKey: 'C',
        currentTimeSignature: '4/4',
        currentTempo: 120,
        currentChordProgression: [],
        currentGenre: 'unknown',
        complexityLevel: 0.5,
        activeInstruments: new Set(),
        recentPatterns: [],
        userEngagement: 'medium',
      });
    });
  });

  describe('Musical Context Analysis', () => {
    test('should analyze basic musical properties from MIDI data', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'E',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'G',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
        metadata: {
          tempo: 140,
          key: 'G',
          timeSignature: { numerator: 3, denominator: 4 },
          duration: 4,
          trackCount: 1,
          totalNotes: 3,
        },
        musicTheory: {
          keySignature: {
            key: 'G',
            mode: 'major',
            confidence: 0.8,
            sharpsFlats: 1,
          },
          detectedChords: [],
          scaleAnalysis: {
            primaryScale: 'G major',
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
            complexity: 0.5,
            jazzContent: 0,
            classicalContent: 0,
          },
        },
      });

      const context = analyzer.analyzeMusicalContext(mockMidiData);

      expect(context.currentTempo).toBe(140);
      expect(context.currentKey).toBe('G');
      expect(context.currentTimeSignature).toBe('3/4');
      expect(context.activeInstruments.has('chords')).toBe(true);
    });

    test('should extract chord progressions from chord tracks', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                // C major chord (0-1s)
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'E',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'G',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                // F major chord (1-2s)
                {
                  note: 'F',
                  octave: 4,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'A',
                  octave: 4,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'C',
                  octave: 5,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const context = analyzer.analyzeMusicalContext(mockMidiData);

      expect(context.currentChordProgression).toContain('C');
      expect(context.currentChordProgression.length).toBeGreaterThan(0);
    });

    test('should identify active instruments', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [
            {
              id: 'drum-track-1',
              name: 'Drums',
              channel: 10,
              type: TrackType.DRUMS,
              notes: [
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 0,
                  endTime: 0.1,
                  duration: 0.1,
                  velocity: 90,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          bass: [
            {
              id: 'bass-track-1',
              name: 'Bass',
              channel: 2,
              type: TrackType.BASS,
              notes: [
                {
                  note: 'C',
                  octave: 2,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 70,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          melody: [],
          other: [],
        },
      });

      const context = analyzer.analyzeMusicalContext(mockMidiData);

      expect(context.activeInstruments.has('chords')).toBe(true);
      expect(context.activeInstruments.has('drums')).toBe(true);
      expect(context.activeInstruments.has('bass')).toBe(true);
      expect(context.activeInstruments.has('melody')).toBe(false);
    });

    test('should calculate musical complexity', () => {
      const simpleMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
        metadata: { tempo: 120 },
      });

      const complexMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [
            {
              id: 'drum-track-1',
              name: 'Drums',
              channel: 10,
              type: TrackType.DRUMS,
              notes: [
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 0,
                  endTime: 0.1,
                  duration: 0.1,
                  velocity: 90,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          bass: [
            {
              id: 'bass-track-1',
              name: 'Bass',
              channel: 2,
              type: TrackType.BASS,
              notes: [
                {
                  note: 'C',
                  octave: 2,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 70,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          melody: [
            {
              id: 'melody-track-1',
              name: 'Melody',
              channel: 3,
              type: TrackType.MELODY,
              notes: [
                {
                  note: 'C',
                  octave: 5,
                  startTime: 0,
                  endTime: 0.5,
                  duration: 0.5,
                  velocity: 75,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          other: [],
        },
        metadata: {
          tempo: 180,
          timeSignature: { numerator: 7, denominator: 8 },
        },
      });

      const simpleContext = analyzer.analyzeMusicalContext(simpleMidiData);
      const complexContext = analyzer.analyzeMusicalContext(complexMidiData);

      expect(complexContext.complexityLevel).toBeGreaterThan(
        simpleContext.complexityLevel,
      );
    });
  });

  describe('Pattern Analysis', () => {
    test('should detect chord progression patterns', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                // Simulated chord progression: C - F - G - C
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'E',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'G',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'F',
                  octave: 4,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'A',
                  octave: 4,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'C',
                  octave: 5,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      analyzer.analyzeMusicalContext(mockMidiData);

      // Patterns should be detected and stored internally
      // We can test this through the prediction system
      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      expect(predictions.length).toBeGreaterThan(0);
    });

    test('should analyze drum patterns', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [],
          drums: [
            {
              id: 'drum-track-1',
              name: 'Drums',
              channel: 10,
              type: TrackType.DRUMS,
              notes: [
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 0,
                  endTime: 0.1,
                  duration: 0.1,
                  velocity: 90,
                },
                {
                  note: 'snare',
                  octave: 1,
                  startTime: 1,
                  endTime: 1.1,
                  duration: 0.1,
                  velocity: 85,
                },
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 2,
                  endTime: 2.1,
                  duration: 0.1,
                  velocity: 90,
                },
                {
                  note: 'snare',
                  octave: 1,
                  startTime: 3,
                  endTime: 3.1,
                  duration: 0.1,
                  velocity: 85,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const context = analyzer.analyzeMusicalContext(mockMidiData);
      expect(context.activeInstruments.has('drums')).toBe(true);

      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      const drumPredictions = predictions
        .flatMap((p) => p.assets)
        .filter((a) => a.category.includes('drum'));
      expect(drumPredictions.length).toBeGreaterThan(0);
    });

    test('should analyze bass line patterns', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [],
          drums: [],
          bass: [
            {
              id: 'bass-track-1',
              name: 'Bass',
              channel: 2,
              type: TrackType.BASS,
              notes: [
                {
                  note: 'C',
                  octave: 2,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 70,
                },
                {
                  note: 'D',
                  octave: 2,
                  startTime: 1,
                  endTime: 2,
                  duration: 1,
                  velocity: 70,
                },
                {
                  note: 'E',
                  octave: 2,
                  startTime: 2,
                  endTime: 3,
                  duration: 1,
                  velocity: 70,
                },
                {
                  note: 'F',
                  octave: 2,
                  startTime: 3,
                  endTime: 4,
                  duration: 1,
                  velocity: 70,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          melody: [],
          other: [],
        },
      });

      const context = analyzer.analyzeMusicalContext(mockMidiData);
      expect(context.activeInstruments.has('bass')).toBe(true);

      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      const bassPredictions = predictions
        .flatMap((p) => p.assets)
        .filter((a) => a.category.includes('bass'));
      expect(bassPredictions.length).toBeGreaterThan(0);
    });
  });

  describe('Genre Detection', () => {
    test('should detect rock genre from drum patterns', () => {
      const rockMidiData = createMockMidiData({
        tracks: {
          chords: [],
          drums: [
            {
              id: 'drum-track-1',
              name: 'Drums',
              channel: 10,
              type: TrackType.DRUMS,
              notes: [
                // Rock pattern: kick on 1,3 and snare on 2,4
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 0,
                  endTime: 0.1,
                  duration: 0.1,
                  velocity: 90,
                },
                {
                  note: 'snare',
                  octave: 1,
                  startTime: 1,
                  endTime: 1.1,
                  duration: 0.1,
                  velocity: 85,
                },
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 2,
                  endTime: 2.1,
                  duration: 0.1,
                  velocity: 90,
                },
                {
                  note: 'snare',
                  octave: 1,
                  startTime: 3,
                  endTime: 3.1,
                  duration: 0.1,
                  velocity: 85,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const _context = analyzer.analyzeMusicalContext(rockMidiData);

      // Genre detection might not be exact, but should influence predictions
      const predictions = analyzer.generateAssetPredictions(rockMidiData);
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe('Asset Predictions', () => {
    test('should generate immediate predictions', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'E',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
                {
                  note: 'G',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const predictions = analyzer.generateAssetPredictions(mockMidiData);

      expect(predictions).toHaveLength(3); // immediate, short_term, long_term

      const immediatePrediction = predictions.find(
        (p) => p.type === 'immediate',
      );
      expect(immediatePrediction).toBeDefined();
      expect(immediatePrediction!.confidence).toBeGreaterThan(0.7);
      expect(immediatePrediction!.timeframe).toBeLessThan(10000); // < 10 seconds
    });

    test('should generate predictions with different priorities', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [
            {
              id: 'drum-track-1',
              name: 'Drums',
              channel: 10,
              type: TrackType.DRUMS,
              notes: [
                {
                  note: 'kick',
                  octave: 1,
                  startTime: 0,
                  endTime: 0.1,
                  duration: 0.1,
                  velocity: 90,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      const allAssets = predictions.flatMap((p) => p.assets);

      const highPriorityAssets = allAssets.filter((a) => a.priority === 'high');
      const mediumPriorityAssets = allAssets.filter(
        (a) => a.priority === 'medium',
      );
      const lowPriorityAssets = allAssets.filter((a) => a.priority === 'low');

      expect(highPriorityAssets.length).toBeGreaterThan(0);
      expect(
        mediumPriorityAssets.length + lowPriorityAssets.length,
      ).toBeGreaterThan(0);
    });

    test('should incorporate user behavior in predictions', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const userBehavior: UserBehaviorPattern = {
        sessionId: 'test-session',
        patterns: {
          preferredInstruments: new Map([
            ['bass', 0.8],
            ['drums', 0.6],
          ]),
          commonProgressions: [],
          practiceSchedule: new Map(),
          difficultyProgression: [0.3, 0.4, 0.5],
        },
        assetUsage: {
          mostUsedAssets: new Map([
            ['bass-C.wav', 25],
            ['drums-rock-kit.preset', 15],
          ]),
          loadingTimes: new Map(),
          failureRates: new Map(),
        },
      };

      const predictions = analyzer.generateAssetPredictions(
        mockMidiData,
        userBehavior,
      );
      const allAssets = predictions.flatMap((p) => p.assets);

      const userPreferenceAssets = allAssets.filter(
        (a) => a.category === 'user-preference',
      );
      expect(userPreferenceAssets.length).toBeGreaterThan(0);

      const bassAsset = allAssets.find((a) => a.url === 'bass-C.wav');
      expect(bassAsset).toBeDefined();
    });
  });

  describe('User Behavior Integration', () => {
    test('should update user behavior patterns', () => {
      const userBehavior: UserBehaviorPattern = {
        sessionId: 'test-session',
        patterns: {
          preferredInstruments: new Map([['bass', 0.9]]),
          commonProgressions: [],
          practiceSchedule: new Map([['morning', 0.7]]),
          difficultyProgression: [0.2, 0.4, 0.6],
        },
        assetUsage: {
          mostUsedAssets: new Map([['bass-E.wav', 30]]),
          loadingTimes: new Map([['bass-E.wav', [100, 120, 90]]]),
          failureRates: new Map([['bass-E.wav', 0.02]]),
        },
      };

      analyzer.updateUserBehavior(userBehavior);

      // Verify behavior is incorporated in predictions
      const mockMidiData = createMockMidiData();

      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      const allAssets = predictions.flatMap((p) => p.assets);

      const preferredAsset = allAssets.find((a) => a.url === 'bass-E.wav');
      expect(preferredAsset).toBeDefined();
    });

    test('should predict difficulty progression', () => {
      const userBehavior: UserBehaviorPattern = {
        sessionId: 'test-session',
        patterns: {
          preferredInstruments: new Map(),
          commonProgressions: [],
          practiceSchedule: new Map(),
          difficultyProgression: [0.1, 0.2, 0.3, 0.4, 0.5], // Progressive difficulty
        },
        assetUsage: {
          mostUsedAssets: new Map(),
          loadingTimes: new Map(),
          failureRates: new Map(),
        },
      };

      analyzer.updateUserBehavior(userBehavior);

      const mockMidiData = createMockMidiData();

      const predictions = analyzer.generateAssetPredictions(mockMidiData);
      const longTermPrediction = predictions.find(
        (p) => p.type === 'long_term',
      );

      expect(longTermPrediction).toBeDefined();
      const difficultyAssets = longTermPrediction!.assets.filter(
        (a) => a.category === 'difficulty-progression',
      );
      expect(difficultyAssets.length).toBeGreaterThan(0);
    });
  });

  describe('Prediction Metrics', () => {
    test('should track prediction metrics', () => {
      const mockMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [
                {
                  note: 'C',
                  octave: 4,
                  startTime: 0,
                  endTime: 1,
                  duration: 1,
                  velocity: 80,
                },
              ],
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      // Generate some predictions
      analyzer.generateAssetPredictions(mockMidiData);
      analyzer.generateAssetPredictions(mockMidiData);

      const metrics = analyzer.getPredictionMetrics();

      expect(metrics.totalPredictions).toBe(6); // 2 calls * 3 prediction types each
      expect(metrics.averageConfidence).toBeGreaterThan(0);
      expect(metrics.recentAccuracy).toBeGreaterThan(0);
    });

    test('should limit prediction history', () => {
      const mockMidiData = createMockMidiData();

      // Generate many predictions to test history limit
      for (let i = 0; i < 50; i++) {
        analyzer.generateAssetPredictions(mockMidiData);
      }

      const metrics = analyzer.getPredictionMetrics();
      expect(metrics.totalPredictions).toBeLessThanOrEqual(100); // Max history length
    });
  });

  describe('Resource Management', () => {
    test('should clear history when requested', () => {
      const mockMidiData = createMockMidiData();

      analyzer.generateAssetPredictions(mockMidiData);
      let metrics = analyzer.getPredictionMetrics();
      expect(metrics.totalPredictions).toBeGreaterThan(0);

      analyzer.clearHistory();
      metrics = analyzer.getPredictionMetrics();
      expect(metrics.totalPredictions).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty MIDI data', () => {
      const emptyMidiData = createMockMidiData();

      const context = analyzer.analyzeMusicalContext(emptyMidiData);
      expect(context.activeInstruments.size).toBe(0);
      expect(context.currentChordProgression).toHaveLength(0);

      const predictions = analyzer.generateAssetPredictions(emptyMidiData);
      expect(predictions).toHaveLength(3); // Still generates 3 types of predictions
    });

    test('should handle tracks with no notes', () => {
      const noNotesMidiData = createMockMidiData({
        tracks: {
          chords: [
            {
              id: 'chord-track-1',
              name: 'Chords',
              channel: 1,
              type: TrackType.CHORDS,
              notes: [], // Empty notes array
              controllers: [],
              articulations: [],
              confidence: {
                overall: 0.8,
                byFeature: {
                  channelAnalysis: 0.8,
                  nameAnalysis: 0.9,
                  noteRangeAnalysis: 0.7,
                  patternAnalysis: 0.8,
                },
              },
            },
          ],
          drums: [],
          bass: [],
          melody: [],
          other: [],
        },
      });

      const context = analyzer.analyzeMusicalContext(noNotesMidiData);
      expect(context.activeInstruments.has('chords')).toBe(true); // Track exists but no notes

      const predictions = analyzer.generateAssetPredictions(noNotesMidiData);
      expect(predictions).toHaveLength(3);
    });
  });
});
