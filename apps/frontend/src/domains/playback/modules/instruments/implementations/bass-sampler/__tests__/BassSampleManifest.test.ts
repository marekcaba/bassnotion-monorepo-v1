/**
 * Bass Sample Manifest - Unit Tests
 *
 * Tests for URL generation and sample metadata functions:
 * - buildSampleUrl: Generate Supabase URLs for samples
 * - getSamplesForString: Get all samples for a specific string
 * - getAllSamples: Get all 110 bass samples
 * - getSampleForMidiNote: Get sample config for a MIDI note
 * - getSamplesForMidiNotes: Get samples for a list of MIDI notes (FAANG)
 * - getBufferKey / parseBufferKey: Buffer key utilities
 * - isValidBassMidiNote: Validate MIDI note range
 * - getBassNoteRange: Get bass note range
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSampleUrl,
  getSamplesForString,
  getAllSamples,
  getSampleForMidiNote,
  getSamplesForMidiNotes,
  getBufferKey,
  parseBufferKey,
  isValidBassMidiNote,
  getBassNoteRange,
  DEFAULT_BASS_MANIFEST,
} from '../BassSampleManifest.js';

// Mock the logger to prevent console output during tests
vi.mock('@bassnotion/contracts', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('BassSampleManifest', () => {
  describe('DEFAULT_BASS_MANIFEST', () => {
    it('should have correct manifest metadata', () => {
      expect(DEFAULT_BASS_MANIFEST.name).toBe('BassMods Finger');
      expect(DEFAULT_BASS_MANIFEST.version).toBe('1.0.0');
      expect(DEFAULT_BASS_MANIFEST.technique).toBe('finger');
      expect(DEFAULT_BASS_MANIFEST.velocity).toBe('f');
    });

    it('should have 5 strings configured', () => {
      expect(DEFAULT_BASS_MANIFEST.strings).toHaveLength(5);
    });

    it('should have correct string configurations', () => {
      const strings = DEFAULT_BASS_MANIFEST.strings;

      expect(strings[0]).toEqual({
        name: 'B',
        openNote: 'B0',
        openMidiNote: 23,
        maxFret: 21,
        sampleCount: 22,
      });

      expect(strings[1]).toEqual({
        name: 'E',
        openNote: 'E1',
        openMidiNote: 28,
        maxFret: 21,
        sampleCount: 22,
      });

      expect(strings[2]).toEqual({
        name: 'A',
        openNote: 'A1',
        openMidiNote: 33,
        maxFret: 21,
        sampleCount: 22,
      });

      expect(strings[3]).toEqual({
        name: 'D',
        openNote: 'D2',
        openMidiNote: 38,
        maxFret: 21,
        sampleCount: 22,
      });

      expect(strings[4]).toEqual({
        name: 'G',
        openNote: 'G2',
        openMidiNote: 43,
        maxFret: 21,
        sampleCount: 22,
      });
    });

    it('should have total of 110 samples (22 × 5)', () => {
      expect(DEFAULT_BASS_MANIFEST.totalSamples).toBe(110);
    });

    it('should have correct Supabase base URL', () => {
      expect(DEFAULT_BASS_MANIFEST.baseUrl).toBe(
        'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples',
      );
    });
  });

  describe('buildSampleUrl', () => {
    describe('URL format', () => {
      it('should build correct URL for B string open (B0)', () => {
        const url = buildSampleUrl(23, 'B');
        expect(url).toBe(
          'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Bass/BassMods/Fingers-f/B%20string/B0_f_finger_Bstring.ogg',
        );
      });

      it('should build correct URL for E string open (E1)', () => {
        const url = buildSampleUrl(28, 'E');
        expect(url).toBe(
          'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Bass/BassMods/Fingers-f/E%20string/E1_f_finger_Estring.ogg',
        );
      });

      it('should build correct URL for A string open (A1)', () => {
        const url = buildSampleUrl(33, 'A');
        expect(url).toBe(
          'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Bass/BassMods/Fingers-f/A%20string/A1_f_finger_Astring.ogg',
        );
      });

      it('should build correct URL for D string open (D2)', () => {
        const url = buildSampleUrl(38, 'D');
        expect(url).toBe(
          'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Bass/BassMods/Fingers-f/D%20string/D2_f_finger_Dstring.ogg',
        );
      });

      it('should build correct URL for G string open (G2)', () => {
        const url = buildSampleUrl(43, 'G');
        expect(url).toBe(
          'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Bass/BassMods/Fingers-f/G%20string/G2_f_finger_Gstring.ogg',
        );
      });
    });

    describe('sharp notes', () => {
      it('should use "s" notation for sharp notes (C#)', () => {
        const url = buildSampleUrl(25, 'B'); // C#1 on B string fret 2
        expect(url).toContain('Cs1_f_finger_Bstring.ogg');
      });

      it('should use "s" notation for D#', () => {
        const url = buildSampleUrl(27, 'B'); // D#1 on B string fret 4
        expect(url).toContain('Ds1_f_finger_Bstring.ogg');
      });

      it('should use "s" notation for F#', () => {
        const url = buildSampleUrl(30, 'B'); // F#1 on B string fret 7
        expect(url).toContain('Fs1_f_finger_Bstring.ogg');
      });

      it('should use "s" notation for G#', () => {
        const url = buildSampleUrl(32, 'B'); // G#1 on B string fret 9
        expect(url).toContain('Gs1_f_finger_Bstring.ogg');
      });

      it('should use "s" notation for A#', () => {
        const url = buildSampleUrl(34, 'B'); // A#1 on B string fret 11
        expect(url).toContain('As1_f_finger_Bstring.ogg');
      });
    });

    describe('URL encoding', () => {
      it('should URL-encode spaces in string folder names', () => {
        const url = buildSampleUrl(23, 'B');
        expect(url).toContain('B%20string');
        expect(url).not.toContain('B string');
      });

      it('should have correct folder structure', () => {
        const url = buildSampleUrl(28, 'E');
        expect(url).toContain('/Bass/BassMods/Fingers-f/');
      });
    });

    describe('filename format', () => {
      it('should follow {Note}{Octave}_{velocity}_{technique}_{String}string.ogg pattern', () => {
        const url = buildSampleUrl(40, 'E'); // E2 on E string fret 12
        expect(url).toMatch(/E2_f_finger_Estring\.ogg$/);
      });
    });
  });

  describe('getSamplesForString', () => {
    it('should return 22 samples for B string (frets 0-21)', () => {
      const bStringConfig = DEFAULT_BASS_MANIFEST.strings[0];
      const samples = getSamplesForString(bStringConfig);

      expect(samples).toHaveLength(22);
    });

    it('should have correct MIDI notes for B string samples', () => {
      const bStringConfig = DEFAULT_BASS_MANIFEST.strings[0];
      const samples = getSamplesForString(bStringConfig);

      // First sample: B0 (MIDI 23)
      expect(samples[0].midiNote).toBe(23);
      expect(samples[0].note).toBe('B0');
      expect(samples[0].fret).toBe(0);

      // Last sample: Gs2 (MIDI 44)
      expect(samples[21].midiNote).toBe(44);
      expect(samples[21].note).toBe('Gs2');
      expect(samples[21].fret).toBe(21);
    });

    it('should have correct string assignment for all samples', () => {
      const eStringConfig = DEFAULT_BASS_MANIFEST.strings[1];
      const samples = getSamplesForString(eStringConfig);

      samples.forEach((sample) => {
        expect(sample.string).toBe('E');
      });
    });

    it('should generate valid URLs for all samples', () => {
      const aStringConfig = DEFAULT_BASS_MANIFEST.strings[2];
      const samples = getSamplesForString(aStringConfig);

      samples.forEach((sample) => {
        expect(sample.url).toContain('https://');
        expect(sample.url).toContain('.ogg');
        expect(sample.url).toContain('A%20string');
      });
    });
  });

  describe('getAllSamples', () => {
    it('should return 110 total samples', () => {
      const samples = getAllSamples();
      expect(samples).toHaveLength(110);
    });

    it('should have 22 samples per string', () => {
      const samples = getAllSamples();

      const bStringSamples = samples.filter((s) => s.string === 'B');
      const eStringSamples = samples.filter((s) => s.string === 'E');
      const aStringSamples = samples.filter((s) => s.string === 'A');
      const dStringSamples = samples.filter((s) => s.string === 'D');
      const gStringSamples = samples.filter((s) => s.string === 'G');

      expect(bStringSamples).toHaveLength(22);
      expect(eStringSamples).toHaveLength(22);
      expect(aStringSamples).toHaveLength(22);
      expect(dStringSamples).toHaveLength(22);
      expect(gStringSamples).toHaveLength(22);
    });

    it('should have unique URLs for all samples', () => {
      const samples = getAllSamples();
      const urls = samples.map((s) => s.url);
      const uniqueUrls = [...new Set(urls)];

      expect(uniqueUrls).toHaveLength(110);
    });

    it('should cover MIDI range from 23 to 64', () => {
      const samples = getAllSamples();
      const midiNotes = samples.map((s) => s.midiNote);

      expect(Math.min(...midiNotes)).toBe(23); // B0
      expect(Math.max(...midiNotes)).toBe(64); // E4 (G string fret 21)
    });
  });

  describe('getSampleForMidiNote', () => {
    describe('without preferred string', () => {
      it('should return first valid position for open string notes', () => {
        // B0 - only on B string
        const b0 = getSampleForMidiNote(23);
        expect(b0?.string).toBe('B');
        expect(b0?.fret).toBe(0);

        // E1 - B string fret 5 (first valid)
        const e1 = getSampleForMidiNote(28);
        expect(e1?.string).toBe('B');
        expect(e1?.fret).toBe(5);
      });

      it('should return null for notes outside bass range', () => {
        expect(getSampleForMidiNote(22)).toBeNull(); // Below B0
        expect(getSampleForMidiNote(65)).toBeNull(); // Above range
      });

      it('should include correct URL in returned config', () => {
        const sample = getSampleForMidiNote(33); // A1
        expect(sample?.url).toContain('.ogg');
        expect(sample?.url).toContain('https://');
      });
    });

    describe('with preferred string', () => {
      it('should use preferred string when valid', () => {
        // E1 can be played on B (fret 5) or E (open)
        // Prefer E string
        const e1OnE = getSampleForMidiNote(28, 'E');
        expect(e1OnE?.string).toBe('E');
        expect(e1OnE?.fret).toBe(0);
      });

      it('should use preferred string for A1 on A string', () => {
        // A1 can be played on B (fret 10), E (fret 5), or A (open)
        const a1OnA = getSampleForMidiNote(33, 'A');
        expect(a1OnA?.string).toBe('A');
        expect(a1OnA?.fret).toBe(0);
      });

      it('should fall back to first valid if preferred string is invalid', () => {
        // B0 can only be played on B string
        // Requesting G string should fall back to B
        const b0OnG = getSampleForMidiNote(23, 'G');
        expect(b0OnG?.string).toBe('B');
        expect(b0OnG?.fret).toBe(0);
      });

      it('should use preferred string for high fret positions', () => {
        // D3 (MIDI 50) on D string would be fret 12
        const d3OnD = getSampleForMidiNote(50, 'D');
        expect(d3OnD?.string).toBe('D');
        expect(d3OnD?.fret).toBe(12);
      });
    });
  });

  describe('getSamplesForMidiNotes', () => {
    it('should return samples for a list of MIDI notes', () => {
      const notes = [28, 33, 38, 43]; // E1, A1, D2, G2
      const samples = getSamplesForMidiNotes(notes);

      expect(samples).toHaveLength(4);
    });

    it('should deduplicate repeated MIDI notes', () => {
      const notes = [28, 28, 33, 33, 38]; // Duplicates
      const samples = getSamplesForMidiNotes(notes);

      expect(samples).toHaveLength(3); // Only unique notes
    });

    it('should sort samples by MIDI note', () => {
      const notes = [43, 28, 38, 33]; // Unsorted
      const samples = getSamplesForMidiNotes(notes);

      expect(samples[0].midiNote).toBe(28);
      expect(samples[1].midiNote).toBe(33);
      expect(samples[2].midiNote).toBe(38);
      expect(samples[3].midiNote).toBe(43);
    });

    it('should skip invalid MIDI notes', () => {
      const notes = [22, 28, 65, 33]; // 22 and 65 are invalid
      const samples = getSamplesForMidiNotes(notes);

      expect(samples).toHaveLength(2);
      expect(samples[0].midiNote).toBe(28);
      expect(samples[1].midiNote).toBe(33);
    });

    it('should return empty array for empty input', () => {
      const samples = getSamplesForMidiNotes([]);
      expect(samples).toHaveLength(0);
    });

    it('should return empty array for all invalid notes', () => {
      const notes = [0, 10, 100, 127]; // All outside bass range
      const samples = getSamplesForMidiNotes(notes);
      expect(samples).toHaveLength(0);
    });
  });

  describe('getBufferKey', () => {
    it('should convert MIDI note to string key', () => {
      expect(getBufferKey(23)).toBe('23');
      expect(getBufferKey(28)).toBe('28');
      expect(getBufferKey(64)).toBe('64');
    });

    it('should handle edge cases', () => {
      expect(getBufferKey(0)).toBe('0');
      expect(getBufferKey(127)).toBe('127');
    });
  });

  describe('parseBufferKey', () => {
    it('should convert string key back to MIDI note', () => {
      expect(parseBufferKey('23')).toBe(23);
      expect(parseBufferKey('28')).toBe(28);
      expect(parseBufferKey('64')).toBe(64);
    });

    it('should be inverse of getBufferKey', () => {
      for (let midi = 23; midi <= 64; midi++) {
        const key = getBufferKey(midi);
        const parsed = parseBufferKey(key);
        expect(parsed).toBe(midi);
      }
    });
  });

  describe('isValidBassMidiNote', () => {
    it('should return true for notes in bass range (23-64)', () => {
      expect(isValidBassMidiNote(23)).toBe(true); // B0
      expect(isValidBassMidiNote(40)).toBe(true); // E2
      expect(isValidBassMidiNote(64)).toBe(true); // E4
    });

    it('should return false for notes below B0', () => {
      expect(isValidBassMidiNote(22)).toBe(false);
      expect(isValidBassMidiNote(0)).toBe(false);
    });

    it('should return false for notes above range', () => {
      expect(isValidBassMidiNote(65)).toBe(false);
      expect(isValidBassMidiNote(127)).toBe(false);
    });

    it('should validate all open string notes as valid', () => {
      expect(isValidBassMidiNote(23)).toBe(true); // B0
      expect(isValidBassMidiNote(28)).toBe(true); // E1
      expect(isValidBassMidiNote(33)).toBe(true); // A1
      expect(isValidBassMidiNote(38)).toBe(true); // D2
      expect(isValidBassMidiNote(43)).toBe(true); // G2
    });
  });

  describe('getBassNoteRange', () => {
    it('should return correct min and max', () => {
      const range = getBassNoteRange();
      expect(range.min).toBe(23);
      expect(range.max).toBe(64);
    });
  });
});
