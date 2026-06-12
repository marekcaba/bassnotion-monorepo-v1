import { describe, it, expect } from 'vitest';
import type { ExerciseNote } from '@bassnotion/contracts';
import { exerciseToMusicXML } from '@/domains/widgets/utils/exerciseToMusicXML';
const N = (m:number,beat:number,sub:number,dur:string): ExerciseNote => ({
  id:`n-${m}-${beat}-${dur}`, string:3, fret:5, note:'C', color:'#000', duration:dur,
  position:{ measure:m, beat, subdivision:sub, tick:Math.round((sub/4)*480) },
} as any);
describe('cross-bar tie split', () => {
  it('a half note on the last eighth of bar 1 ties across into bar 2', () => {
    // bar 1 (0-indexed measure 1), beat 3 (=beat4), sub2 = last eighth; half = 2 beats
    // → fills 0.5 beat to barline (tie start) + 1.5 beats in bar 2 (tie stop)
    const xml = exerciseToMusicXML({
      notes: [ N(1,3,2,'half'), N(2,0,0,'quarter') ],
      bpm: 120, timeSignature: { numerator:4, denominator:4 } as any, totalBars: 2,
    });
    const starts = (xml.match(/<tie type="start"\/>/g)||[]).length;
    const stops  = (xml.match(/<tie type="stop"\/>/g)||[]).length;
    expect(starts).toBeGreaterThanOrEqual(1);
    expect(stops).toBeGreaterThanOrEqual(1);
    expect(starts).toBe(stops); // balanced
  });
  it('every tie is balanced — none dangles over a barline', () => {
    // four quarters filling bar 1 exactly; no note crosses a barline.
    const xml = exerciseToMusicXML({
      notes: [
        N(1, 0, 0, 'quarter'),
        N(1, 1, 0, 'quarter'),
        N(1, 2, 0, 'quarter'),
        N(1, 3, 0, 'quarter'),
      ],
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 } as any,
      totalBars: 1,
    });
    const starts = (xml.match(/<tie type="start"\/>/g) || []).length;
    const stops = (xml.match(/<tie type="stop"\/>/g) || []).length;
    expect(starts).toBe(stops); // balanced; no orphan tie
  });
});
