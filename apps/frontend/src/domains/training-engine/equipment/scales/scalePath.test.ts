import { describe, it, expect } from 'vitest';
import { buildNoteUniverse, selectBox } from './noteUniverse';
import { buildScalePath, scalePathBeats } from './scalePath';

const FB4 = { stringCount: 4 as const, maxFrets: 24 };

describe('buildScalePath — ordered, timed play sequence', () => {
  it('is empty for no notes', () => {
    expect(buildScalePath([])).toEqual([]);
  });

  it('plays ascending then back down with NO doubled top/bottom note', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box, { descend: true });
    // up (N) + down (N-2 interior) = 2N-2 steps; midis mirror without repeating ends.
    expect(path.length).toBe(2 * box.length - 2);
    const midis = path.map((p) => p.midi);
    // first half strictly ascending
    for (let i = 1; i < box.length; i++)
      expect(midis[i]!).toBeGreaterThanOrEqual(midis[i - 1]!);
    // top note appears exactly once (the turn-around)
    const top = Math.max(...midis);
    expect(midis.filter((m) => m === top).length).toBe(1);
    // bottom note appears exactly once (it starts the next loop)
    const bottom = Math.min(...midis);
    expect(midis.filter((m) => m === bottom).length).toBe(1);
  });

  it('ascending-only when descend:false', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box, { descend: false });
    expect(path.length).toBe(box.length);
    const midis = path.map((p) => p.midi);
    for (let i = 1; i < midis.length; i++)
      expect(midis[i]!).toBeGreaterThanOrEqual(midis[i - 1]!);
  });

  it('straight eighths: each step is 0.5 beat apart, duration 8n', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box, { rhythm: '8n' });
    path.forEach((p, i) => {
      expect(p.duration).toBe('8n');
      expect(p.startBeat).toBeCloseTo(i * 0.5);
      expect(p.step).toBe(i);
    });
  });

  it('quarters: each step is 1 beat apart (rhythm is a parameter, ready for Phase B)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box, { rhythm: '4n' });
    path.forEach((p, i) => {
      expect(p.duration).toBe('4n');
      expect(p.startBeat).toBeCloseTo(i * 1);
    });
  });

  it('carries midi + string + fret so the heard note and lit dot are the same event', () => {
    const u = buildNoteUniverse(FB4, 'A', 'minor_pentatonic');
    const box = selectBox(u, FB4, 'A', 'minor_pentatonic', 1);
    const path = buildScalePath(box);
    for (const p of path) {
      // every played note traces back to a real universe note (same midi+string+fret)
      const match = box.find(
        (n) => n.midi === p.midi && n.string === p.string && n.fret === p.fret,
      );
      expect(match).toBeTruthy();
    }
  });

  it('marks roots (for emphasis)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box);
    expect(path.some((p) => p.isRoot)).toBe(true);
    for (const p of path)
      if (p.isRoot) {
        const match = box.find((n) => n.midi === p.midi);
        expect(match!.isRoot).toBe(true);
      }
  });
});

describe('scalePathBeats — loop length', () => {
  it('is 0 for an empty path', () => {
    expect(scalePathBeats([])).toBe(0);
  });

  it('eighths: 2N-2 steps × 0.5 beat = the loop length', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const path = buildScalePath(box, { rhythm: '8n' });
    expect(scalePathBeats(path)).toBeCloseTo(path.length * 0.5);
  });
});
