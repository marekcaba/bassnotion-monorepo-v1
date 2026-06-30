import { describe, it, expect, vi } from 'vitest';

// droneStem pulls in the logger (a path-alias import); stub it so the pure URL builder can be
// unit-tested without the logging infra.
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { droneStemUrl } from './droneStem';

const BASE =
  'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples';

describe('droneStemUrl — routes a chord symbol to its quality subfolder', () => {
  it('maps the common qualities to their subfolders', () => {
    expect(droneStemUrl('Cmaj7')).toBe(`${BASE}/drones/maj7/Cmaj7.ogg`);
    expect(droneStemUrl('A7')).toBe(`${BASE}/drones/7/A7.ogg`);
    expect(droneStemUrl('Em7')).toBe(`${BASE}/drones/m7/Em7.ogg`);
  });

  it('handles the richer library qualities', () => {
    expect(droneStemUrl('D13')).toBe(`${BASE}/drones/13/D13.ogg`);
    expect(droneStemUrl('G7alt')).toBe(`${BASE}/drones/7alt/G7alt.ogg`);
    expect(droneStemUrl('Am9')).toBe(`${BASE}/drones/m9/Am9.ogg`);
    expect(droneStemUrl('Em')).toBe(`${BASE}/drones/m/Em.ogg`);
    expect(droneStemUrl('Csus13')).toBe(`${BASE}/drones/sus13/Csus13.ogg`); // replaced 13#11
  });

  it('a plain major triad (no quality) routes to the maj/ subfolder', () => {
    expect(droneStemUrl('C')).toBe(`${BASE}/drones/maj/C.ogg`);
    expect(droneStemUrl('G')).toBe(`${BASE}/drones/maj/G.ogg`);
  });

  it('keeps the two m11 voicings in distinct subfolders', () => {
    expect(droneStemUrl('Cm11_1')).toBe(`${BASE}/drones/m11-1/Cm11_1.ogg`);
    expect(droneStemUrl('Cm11_2')).toBe(`${BASE}/drones/m11-2/Cm11_2.ogg`);
  });

  it('routes the 13#11 quality, # → s in BOTH the folder and filename (Supabase-safe)', () => {
    // Supabase Storage rejects '#' in object keys, so the # in the quality becomes 's':
    // folder 13#11 → 13s11, file A13#11 → A13s11.
    expect(droneStemUrl('A13#11')).toBe(`${BASE}/drones/13s11/A13s11.ogg`);
  });

  it('SHARP roots become "s" in the filename (NOT %23) — # is invalid in storage keys', () => {
    // sharps are what droneChordSymbol emits; we rewrite '#' → 's' so the key is valid.
    // The app emits sharps as '#' (e.g. "C#m7" from droneChordSymbol); the loader folds them.
    expect(droneStemUrl('C#m7')).toBe(`${BASE}/drones/m7/Csm7.ogg`);
    expect(droneStemUrl('F#maj7')).toBe(`${BASE}/drones/maj7/Fsmaj7.ogg`);
    expect(droneStemUrl('F#sus13')).toBe(`${BASE}/drones/sus13/Fssus13.ogg`);
    expect(droneStemUrl('A#13#11')).toBe(`${BASE}/drones/13s11/As13s11.ogg`);
    expect(droneStemUrl('Bbm7')).toBe(`${BASE}/drones/m7/Bbm7.ogg`); // flats are fine
  });

  it('the resulting URL contains NO # or %23 at all (every sharp folded to s)', () => {
    for (const sym of ['C#sus13', 'C13#11', 'A#13#11', 'D#m11_1']) {
      const url = droneStemUrl(sym);
      expect(url).not.toContain('#');
      expect(url).not.toContain('%23');
    }
    expect(droneStemUrl('C#sus13')).toBe(`${BASE}/drones/sus13/Cssus13.ogg`);
    expect(droneStemUrl('C13#11')).toBe(`${BASE}/drones/13s11/C13s11.ogg`);
  });

  it('an unknown quality falls back to the flat drones/{symbol}.ogg path', () => {
    // A chord type not yet in the subfolder map still resolves (flat), so adding a new
    // library folder is the only change needed to wire it up.
    expect(droneStemUrl('Csus4')).toBe(`${BASE}/drones/Csus4.ogg`);
  });
});
