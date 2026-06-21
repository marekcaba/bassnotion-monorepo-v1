import { describe, it, expect } from 'vitest';
import { measureAtMarkers, scoreMarkerMeasurements } from './measureAtMarkers';

const sr = 48000;

/** A bass note: attack at `atSec`, then a decaying rippling body. */
function note(buf: Float32Array, atSec: number, freq = 60, dur = 0.5) {
  const s = Math.floor(atSec * sr);
  for (let i = 0; i < dur * sr && s + i < buf.length; i++) {
    const tt = i / sr;
    const attack = Math.min(1, tt / 0.005); // sharp-ish 5ms rise
    const decay = Math.exp(-tt / 0.4);
    const ripple = 0.6 + 0.4 * Math.cos(2 * Math.PI * 8 * tt);
    buf[s + i]! += 0.8 * attack * decay * ripple * Math.sin(2 * Math.PI * freq * tt);
  }
}

describe('measureAtMarkers — search the player audio AT each coach marker', () => {
  it('measures the offset when the player attack is near the marker', () => {
    const buf = new Float32Array(sr);
    note(buf, 0.5); // player attack at 0.5s
    // marker at 0.48s (player is 20ms LATE relative to it)
    const m = measureAtMarkers(buf, sr, 0, [0.48]);
    expect(m[0]!.playerSec).not.toBeNull();
    expect(m[0]!.errorSec! * 1000).toBeGreaterThan(10); // ~+20ms late
    expect(m[0]!.errorSec! * 1000).toBeLessThan(35);
  });

  it('reports MISSED when there is no attack in the marker window', () => {
    const buf = new Float32Array(sr); // silent
    const m = measureAtMarkers(buf, sr, 0, [0.5]);
    expect(m[0]!.playerSec).toBeNull();
    expect(m[0]!.errorSec).toBeNull();
  });

  it('finds the ATTACK, not the louder rippling body, inside the window', () => {
    const buf = new Float32Array(sr);
    note(buf, 0.5); // attack 0.5, body ripples louder after
    const m = measureAtMarkers(buf, sr, 0, [0.5]);
    expect(m[0]!.playerSec).not.toBeNull();
    // must land on the attack (~0.5), NOT 100ms+ into the body
    expect(Math.abs(m[0]!.playerSec! - 0.5)).toBeLessThan(0.025);
  });

  it('a body ripple BETWEEN two markers is never examined (no phantom)', () => {
    const buf = new Float32Array(2 * sr);
    note(buf, 0.5);
    note(buf, 1.2); // big gap; the 0.5 note ripples in between but no marker points there
    const m = measureAtMarkers(buf, sr, 0, [0.5, 1.2]);
    expect(m).toHaveLength(2); // exactly 2 measurements — one per marker, no extras
    expect(m[0]!.playerSec).not.toBeNull();
    expect(m[1]!.playerSec).not.toBeNull();
  });

  it('measurement count ALWAYS equals marker count', () => {
    const buf = new Float32Array(2 * sr);
    note(buf, 0.5, 60, 0.15); // SHORT note (rings 0.5..0.65) so 0.9/1.3/1.7 are silent
    // 4 markers, only one has a note → still 4 measurements (3 missed)
    const m = measureAtMarkers(buf, sr, 0, [0.5, 0.9, 1.3, 1.7]);
    expect(m).toHaveLength(4);
    expect(m.filter((x) => x.playerSec != null)).toHaveLength(1);
  });

  it('does NOT grab a NEIGHBOUR note when markers are close (~130ms apart)', () => {
    // THE bimodal-error bug: two fast notes 130ms apart. Marker 2's wide window would
    // reach back to note 1's (louder) attack and report a false ~-130ms "early". The
    // neighbour-bounded window must keep marker 2 on note 2.
    const buf = new Float32Array(sr);
    note(buf, 0.5, 55, 0.1); // note 1 (short — decays before note 2, like articulated playing)
    note(buf, 0.63, 73, 0.1); // note 2, 130ms later
    // markers exactly on each note
    const m = measureAtMarkers(buf, sr, 0, [0.5, 0.63]);
    expect(m[0]!.playerSec).not.toBeNull();
    expect(m[1]!.playerSec).not.toBeNull();
    // each must measure its OWN note (a small CONSTANT window latency is fine — it's the
    // same for every note and calibrates out), NOT grab the other note (~±130ms, which
    // would flip the sign or blow past 100ms). The key property: same-note, not neighbour.
    expect(Math.abs(m[0]!.errorSec! * 1000)).toBeLessThan(80);
    expect(Math.abs(m[1]!.errorSec! * 1000)).toBeLessThan(80);
    expect(m[1]!.errorSec!).toBeGreaterThan(-0.05); // NOT grabbed note 1 (would be ~-130ms)
  });

  it('respects startedAtSec (window is in ctx time, audio is buffer time)', () => {
    const buf = new Float32Array(sr);
    note(buf, 0.5); // buffer time 0.5
    // take started at ctx 10.0 → that attack is at ctx 10.5; marker in ctx time
    const m = measureAtMarkers(buf, sr, 10.0, [10.5]);
    expect(m[0]!.playerSec).not.toBeNull();
    expect(Math.abs(m[0]!.errorSec!)).toBeLessThan(0.02);
  });
});

describe('scoreMarkerMeasurements — offset/jitter/coverage', () => {
  it('splits constant offset (median) from jitter (de-meaned spread)', () => {
    const m = [
      { markerSec: 0, playerSec: 0.05, errorSec: 0.05, strength: 1 },
      { markerSec: 1, playerSec: 1.05, errorSec: 0.05, strength: 1 },
      { markerSec: 2, playerSec: 2.07, errorSec: 0.07, strength: 1 },
      { markerSec: 3, playerSec: 3.03, errorSec: 0.03, strength: 1 },
    ];
    const s = scoreMarkerMeasurements(m);
    expect(s.coverage).toBe(1);
    expect(s.offsetMs).toBeCloseTo(50, 0); // median error ≈ 50ms (the constant lean)
    expect(s.jitterMs).toBeGreaterThan(0); // spread around the median = feel
    expect(s.jitterMs).toBeLessThan(20);
  });

  it('coverage and missed count reflect nulls', () => {
    const m = [
      { markerSec: 0, playerSec: 0.01, errorSec: 0.01, strength: 1 },
      { markerSec: 1, playerSec: null, errorSec: null, strength: 0 },
      { markerSec: 2, playerSec: 2.01, errorSec: 0.01, strength: 1 },
    ];
    const s = scoreMarkerMeasurements(m);
    expect(s.hitCount).toBe(2);
    expect(s.missedCount).toBe(1);
    expect(s.coverage).toBeCloseTo(2 / 3, 3);
  });
});
