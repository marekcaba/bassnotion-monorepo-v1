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
    // marker at 0.48s (player attack at 0.5 → player is ~20ms LATE relative to it). The
    // complex-domain detector localizes to ~one frame (~10ms), so accept a wide-ish band
    // around the true +20ms — the point is the sign + rough magnitude, not sub-frame.
    const m = measureAtMarkers(buf, sr, 0, [0.48]);
    expect(m[0]!.playerSec).not.toBeNull();
    expect(m[0]!.errorSec! * 1000).toBeGreaterThan(0); // late, not early
    expect(m[0]!.errorSec! * 1000).toBeLessThan(40);
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

  it('does NOT snap to the window back-edge when a previous note is still ringing', () => {
    // THE -45ms snap bug: a long note rings, the next marker's window opens ON that tail
    // (already loud). A "first sample above threshold" snaps to the window start (~-back-
    // reach). The upward-crossing search must instead find the NEW note's attack.
    const buf = new Float32Array(sr);
    note(buf, 0.5, 55, 0.5); // long note 1, rings 0.5..1.0
    note(buf, 0.75, 73, 0.3); // note 2 at 0.75, while note 1 STILL ringing
    const m = measureAtMarkers(buf, sr, 0, [0.5, 0.75]);
    // note 2 must measure NEAR its own attack (0.75), not snap ~45ms early to the window edge
    expect(m[1]!.playerSec).not.toBeNull();
    expect(m[1]!.errorSec! * 1000).toBeGreaterThan(-30); // not snapped to -45 back-edge
    expect(Math.abs(m[1]!.playerSec! - 0.75)).toBeLessThan(0.05);
  });

  it('lands on the ATTACK, not a stronger mid-note event (the +109ms outlier)', () => {
    // A note whose attack is moderate but which has a STRONGER event ~80ms in (e.g. a
    // pitch transition / vibrato peak). "Strongest df peak" would land at the mid-note
    // event; the FIRST-strong-peak rule must land on the attack.
    const buf = new Float32Array(sr);
    const s = Math.floor(0.5 * sr);
    for (let i = 0; i < Math.floor(0.4 * sr) && s + i < sr; i++) {
      const tt = i / sr;
      const env = Math.min(1, tt / 0.005) * Math.exp(-tt / 0.4);
      // pitch jumps from 55 to 73 Hz at 80ms in — a strong spectral event mid-note
      const freq = tt < 0.08 ? 55 : 73;
      buf[s + i] = 0.7 * env * Math.sin(2 * Math.PI * freq * tt);
    }
    const m = measureAtMarkers(buf, sr, 0, [0.5]);
    expect(m[0]!.playerSec).not.toBeNull();
    // must land on the 0.5 attack, NOT ~80ms later at the pitch jump
    expect(Math.abs(m[0]!.playerSec! - 0.5)).toBeLessThan(0.04);
  });

  // NOTE on the ~-30ms early outliers on QUIET notes (real take, 2026-06-21): these sit
  // at the FFT-window resolution limit — a finger-noise tick ≤43ms (one FFT window) before
  // a soft pluck merges with it into a single df frame at the tick's position. The
  // look-ahead jump (below, in measureAtMarkers) corrects cases where the events ARE
  // resolvable; sub-window-merged ones can't be separated without a shorter window (which
  // would hurt low-bass frequency resolution). Accepted: the grade is "Tight / 20ms" and
  // only the quietest few notes carry it; it's a constant-ish small bias, not feel.

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

/** A note with a controllable amplitude + a sharp 1ms attack at a KNOWN sample, plus an
 *  optional faint pre-attack finger tick (the synthetic reproduction of the real-bass df
 *  shoulder that fired production ~21ms early — bass-coach-early-marker-investigation). */
function pluck(
  buf: Float32Array,
  atSec: number,
  amp: number,
  freq = 60,
  preTick = false,
) {
  const s = Math.round(atSec * sr);
  if (preTick) {
    // faint broadband tick ~3ms BEFORE the attack — what makes the df shoulder fire early.
    // Deterministic (no Math.random — unavailable in this env): a short decaying burst.
    const ps = s - Math.round(0.003 * sr);
    for (let i = 0; i < Math.round(0.001 * sr) && ps + i >= 0; i++) {
      buf[ps + i]! += amp * 0.12 * Math.sin(2 * Math.PI * 900 * (i / sr));
    }
  }
  for (let i = 0; i < 0.5 * sr && s + i < buf.length; i++) {
    const tt = i / sr;
    const attack = Math.min(1, tt / 0.001); // sharp 1ms rise — attack edge AT sample s
    const decay = Math.exp(-tt / 0.4);
    buf[s + i]! += amp * attack * decay * Math.sin(2 * Math.PI * freq * tt);
  }
}

describe('measureAtMarkers — STRENGTH-INVARIANT marker placement on the transient', () => {
  // The marker must land on the AUDIBLE attack (sample `atSec`) and NEVER before it, for
  // BOTH a loud and a quiet note. The property the pre-refine code lacked: weak notes
  // landed −28.8ms early on real bass.wav, strong −12.6ms.
  const TOL_MS = 8;
  const EARLY_GUARD_MS = 6; // the hard "never before the note" requirement

  it('LOUD note: marker on the attack, not early', () => {
    const buf = new Float32Array(sr);
    pluck(buf, 0.5, 0.9);
    const m = measureAtMarkers(buf, sr, 0, [0.5]);
    expect(m[0]!.playerSec).not.toBeNull();
    const errMs = (m[0]!.playerSec! - 0.5) * 1000;
    expect(Math.abs(errMs)).toBeLessThan(TOL_MS);
    expect(errMs).toBeGreaterThan(-EARLY_GUARD_MS);
  });

  it('QUIET note (with pre-attack tick): marker STILL on the attack, not 30ms early', () => {
    const buf = new Float32Array(sr);
    pluck(buf, 0.5, 0.18, 60, true);
    const m = measureAtMarkers(buf, sr, 0, [0.5]);
    expect(m[0]!.playerSec).not.toBeNull();
    const errMs = (m[0]!.playerSec! - 0.5) * 1000;
    expect(Math.abs(errMs)).toBeLessThan(TOL_MS);
    expect(errMs).toBeGreaterThan(-EARLY_GUARD_MS);
  });

  it('STRENGTH-INVARIANCE: loud and quiet land within a few ms of each other', () => {
    const loud = new Float32Array(sr);
    pluck(loud, 0.5, 0.9);
    const quiet = new Float32Array(sr);
    pluck(quiet, 0.5, 0.18, 60, true);
    const eLoud = (measureAtMarkers(loud, sr, 0, [0.5])[0]!.playerSec! - 0.5) * 1000;
    const eQuiet = (measureAtMarkers(quiet, sr, 0, [0.5])[0]!.playerSec! - 0.5) * 1000;
    expect(Math.abs(eLoud - eQuiet)).toBeLessThan(8);
  });
});

describe('measureAtMarkers — soft-note edge correction (0.6 peak-fraction)', () => {
  /** A note with a controllable attack RAMP length. A long ramp = a soft/slow attack
   *  whose visible edge is well after the foot of the rise. */
  function ramped(buf: Float32Array, atSec: number, rampSec: number, freq = 60) {
    const s = Math.floor(atSec * sr);
    for (let i = 0; i < 0.4 * sr && s + i < buf.length; i++) {
      const tt = i / sr;
      const attack = Math.min(1, tt / rampSec);
      buf[s + i]! += 0.8 * attack * Math.exp(-tt / 0.4) * Math.sin(2 * Math.PI * freq * tt);
    }
  }

  it('a SOFT (slow-ramp) note lands LATER than a sharp one, both on/after their attack', () => {
    const sharp = new Float32Array(sr);
    ramped(sharp, 0.5, 0.002); // 2ms ramp — sharp
    const soft = new Float32Array(sr);
    ramped(soft, 0.5, 0.04); // 40ms ramp — soft/slow

    const tSharp = measureAtMarkers(sharp, sr, 0, [0.5])[0]!.playerSec!;
    const tSoft = measureAtMarkers(soft, sr, 0, [0.5])[0]!.playerSec!;

    // both must be on/after the attack (never early)
    expect(tSharp).toBeGreaterThan(0.49);
    expect(tSoft).toBeGreaterThan(0.49);
    // the soft note's marker is pulled LATER onto its visible edge (the fix); the sharp
    // note barely moves (its rise ~= its edge). So soft lands later than sharp.
    expect(tSoft).toBeGreaterThan(tSharp);
  });

  it('does not push a SHARP note materially late (≤ ~10ms past its attack)', () => {
    const sharp = new Float32Array(sr);
    ramped(sharp, 0.5, 0.002);
    const t = measureAtMarkers(sharp, sr, 0, [0.5])[0]!.playerSec!;
    expect(Math.abs(t - 0.5) * 1000).toBeLessThan(12);
  });
})
