/**
 * LAUNCH-02.5a — Canonical InstrumentType contract tests.
 *
 * Guards against regression of the type consolidation:
 *   - All 4 audio-stem literals are valid AudioInstrumentType / InstrumentType values
 *   - Pre-existing MIDI types (incl. harmony + voice-cue kebab) are valid MidiInstrumentType values
 *   - Name-based track classification does NOT misclassify MIDI tracks named
 *     "bass" / "drums" / "harmony" / "click" into the audio-* buckets
 *     (the audio-stem NAME_PATTERNS entries must be empty arrays, not regexes)
 *   - The IAudioStemEngine interface contract (pin for 02.5b) declares the four
 *     methods 02.5b will implement on PlaybackEngine
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  TrackNameAnalysisAlgorithm,
  type InstrumentType,
  type MidiInstrumentType,
  type AudioInstrumentType,
} from '../management/TrackManagerProcessor.js';
import type { IAudioStemEngine } from '../../../services/core/IAudioStemEngine.js';

describe('LAUNCH-02.5a — canonical InstrumentType union', () => {
  describe('AudioInstrumentType literals', () => {
    it('accepts all four audio-stem literals as AudioInstrumentType', () => {
      const audioBass: AudioInstrumentType = 'audio-bass';
      const audioDrums: AudioInstrumentType = 'audio-drums';
      const audioHarmony: AudioInstrumentType = 'audio-harmony';
      const audioClick: AudioInstrumentType = 'audio-click';

      expect([audioBass, audioDrums, audioHarmony, audioClick]).toEqual([
        'audio-bass',
        'audio-drums',
        'audio-harmony',
        'audio-click',
      ]);
    });

    it('accepts audio-stem literals as InstrumentType', () => {
      const accepts = (t: InstrumentType): InstrumentType => t;
      expect(accepts('audio-bass')).toBe('audio-bass');
      expect(accepts('audio-drums')).toBe('audio-drums');
      expect(accepts('audio-harmony')).toBe('audio-harmony');
      expect(accepts('audio-click')).toBe('audio-click');
    });
  });

  describe('MidiInstrumentType literals (incl. previously broken ones)', () => {
    it('accepts harmony + voice-cue (kebab) as MidiInstrumentType', () => {
      // Pre-canonical, `harmony` was missing from triggerMethodMap and
      // `voice-cue` (kebab) collided with Scheduler.ts's `voiceCue` camelCase.
      const harmony: MidiInstrumentType = 'harmony';
      const voiceCue: MidiInstrumentType = 'voice-cue';
      expect([harmony, voiceCue]).toEqual(['harmony', 'voice-cue']);
    });

    it('accepts all 7 MIDI literals', () => {
      const all: MidiInstrumentType[] = [
        'metronome',
        'drums',
        'bass',
        'chords',
        'harmony',
        'melody',
        'voice-cue',
      ];
      expect(all).toHaveLength(7);
    });
  });

  describe('InstrumentType is the union of MIDI + Audio + "unknown"', () => {
    it('accepts unknown sentinel', () => {
      const u: InstrumentType = 'unknown';
      expect(u).toBe('unknown');
    });

    it('type-asserts MidiInstrumentType assignable to InstrumentType', () => {
      expectTypeOf<MidiInstrumentType>().toMatchTypeOf<InstrumentType>();
    });

    it('type-asserts AudioInstrumentType assignable to InstrumentType', () => {
      expectTypeOf<AudioInstrumentType>().toMatchTypeOf<InstrumentType>();
    });
  });
});

describe('LAUNCH-02.5a — NAME_PATTERNS no-misclassify guarantee', () => {
  const analyzer = new TrackNameAnalysisAlgorithm();

  const cases: Array<[string, InstrumentType]> = [
    // MIDI tracks named with words that ALSO appear in audio-stem labels MUST
    // classify to the MIDI side. Audio stems are registered by id (e.g.
    // "audio-bass"), never name-classified — their NAME_PATTERNS entries are
    // empty arrays, so no regex can match them by name.
    ['bass guitar', 'bass'],
    ['Bass DI', 'bass'],
    ['Sub Bass', 'bass'],
    ['Drum Kit', 'drums'],
    ['kick drum', 'drums'],
    ['Snare Top', 'drums'],
    ['piano comping', 'chords'],
    ['Rhodes', 'chords'],
    // Click pattern is metronome territory, not audio-click.
    ['Click Track', 'metronome'],
    ['metro', 'metronome'],
  ];

  it.each(cases)(
    'name "%s" classifies as %s (NOT an audio-* type)',
    (name, expected) => {
      const result = analyzer.analyze({ name } as any);
      expect(result.instrumentType).toBe(expected);
      expect(result.instrumentType.startsWith('audio-')).toBe(false);
    },
  );

  it('a literal track named "audio-bass" does NOT regex-match into audio-bass', () => {
    // NAME_PATTERNS['audio-bass'] is an empty array, so a track happening to
    // be named exactly "audio-bass" will still classify by the regex side
    // (matches /bass/i, picks 'bass'). The name field never feeds audio-stem
    // registration — that's by id only.
    const result = analyzer.analyze({ name: 'audio-bass' } as any);
    expect(result.instrumentType).toBe('bass');
  });
});

describe('LAUNCH-02.5a — IAudioStemEngine contract pin for 02.5b', () => {
  it('declares the methods PlaybackEngine implements for stem audio', () => {
    // Construct a structural mock to verify the interface shape at compile
    // time. If PlaybackEngine drifts from this shape, this file fails
    // type-check. NOTE: startAudioStems was removed — audio stems start
    // via the same region/event pipeline as MIDI (PlaybackEngine.start →
    // scheduleAllRegions); only stopAudioStems remains as a kill-switch.
    const mock: IAudioStemEngine = {
      setAudioStemBuffers: (_stems) => undefined,
      stopAudioStems: () => undefined,
      unregisterTracksByPrefix: (_prefix: string) => undefined,
    };

    expect(typeof mock.setAudioStemBuffers).toBe('function');
    expect(typeof mock.stopAudioStems).toBe('function');
    expect(typeof mock.unregisterTracksByPrefix).toBe('function');
  });

  it('setAudioStemBuffers accepts a Partial record keyed by AudioInstrumentType', () => {
    const calls: Array<Partial<Record<AudioInstrumentType, AudioBuffer>>> = [];
    const mock: IAudioStemEngine = {
      setAudioStemBuffers: (stems) => {
        calls.push(stems);
      },
      stopAudioStems: () => undefined,
      unregisterTracksByPrefix: () => undefined,
    };

    // Partial — caller may omit any stems
    mock.setAudioStemBuffers({});
    mock.setAudioStemBuffers({ 'audio-bass': {} as AudioBuffer });
    mock.setAudioStemBuffers({
      'audio-bass': {} as AudioBuffer,
      'audio-drums': {} as AudioBuffer,
      'audio-harmony': {} as AudioBuffer,
      'audio-click': {} as AudioBuffer,
    });
    expect(calls).toHaveLength(3);
  });
});
