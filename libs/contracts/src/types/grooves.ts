/**
 * Groove Library — reusable groove cards.
 *
 * A groove is authored ONCE (stems + default bpm/key + length) and stored in
 * the `groove_library` table. Tutorial/drill blocks reference it by id
 * (`GrooveCardBlockConfig.grooveId`) and override key/tempo/role/timebox per
 * use, so the same groove powers many daily drills without re-authoring.
 *
 * The stem set mirrors GrooveCardStemSet in block.ts (bass/drums/harmony URLs).
 */

import type { GrooveCardStemSet, ChordChart } from './block.js';

// Re-export the chord-chart types from their canonical home (block.ts, next to
// GrooveCardStemSet) so groove-library consumers can import them from here too.
export type { ChordChart, ChordChartEntry } from './block.js';
export { CHORD_SLOTS_PER_BAR } from './block.js';

/** A row in `groove_library` (camelCased from the DB record). */
export interface GrooveLibraryItem {
  id: string;
  /** Display name (e.g. "Greasy Pocket"). */
  name: string;
  /** URL-friendly unique identifier. */
  slug: string;
  /** Short tag (e.g. "Funk in E"). */
  subtitle: string;
  /** Default tempo in BPM (a reference may override per use). */
  originalBpm: number;
  /** Default key label (e.g. "E"); audio is baked here, pitch-shifted ±6. */
  originalKey: string;
  /** Groove length in bars. */
  lengthBars: number;
  /** The single stem set delivered at originalKey. */
  stems: GrooveCardStemSet;
  /** Chord chart — sparse changes over the groove's bars, shown to the player
   *  as they play along. Empty/undefined = no chart authored. */
  chordChart?: ChordChart;
  /** Optional metadata. */
  genre?: string;
  tags?: string[];
  youtubeUrl?: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a groove in the library. */
export interface CreateGrooveInput {
  name: string;
  subtitle?: string;
  originalBpm: number;
  originalKey: string;
  lengthBars: number;
  stems: GrooveCardStemSet;
  chordChart?: ChordChart;
  genre?: string;
  tags?: string[];
  youtubeUrl?: string;
}

/** Patch payload to update a groove (all fields optional). */
export type UpdateGrooveInput = Partial<CreateGrooveInput> & {
  isActive?: boolean;
};

/** List response from the groove-library endpoint. */
export interface GrooveLibraryResponse {
  grooves: GrooveLibraryItem[];
  total: number;
}
