/**
 * verifyPitch — monophonic bass pitch detection for the bass coach (the "WHAT").
 *
 * THE MODEL: the coach grades onset TIMING via measureAtMarkers (the "WHEN"). Pitch adds
 * the "WHAT" — for each matched onset we detect the player's fundamental and compare to
 * the note the chart says should be there. This (a) confirms the right note, (b) rejects a
 * wrong-pitch hit, and (c) on WEAK/quiet notes — where the timing detector is least sure —
 * a clear pitch read disambiguates a real note from a wobble.
 *
 * Algorithm: YIN (de Cheveigné & Kawahara 2002) — autocorrelation-difference + cumulative
 * mean normalization + parabolic interpolation. Time-domain, not FFT (FFT-bin spacing is
 * ~2.5Hz between bass semitones at E1≈41Hz — far too coarse). The lag search is BOUNDED to
 * the bass register (B0≈30.9Hz … G2≈98Hz fundamentals, with headroom) — the primary
 * octave-error guard. Bass is monophonic, so a single-f0 search is valid.
 *
 * Returns { midi, confidence, cents } or null when no confident pitch (very short/staccato
 * notes, dead/ghost notes) — null is a FIRST-CLASS answer (never a guessed label). `cents`
 * (sub-Hz deviation from equal temperament) is a free byproduct, stored for future
 * intonation grading.
 *
 * Pure + offline: a Float32 window in, a pitch out. Unit-tested.
 */

export interface PitchResult {
  /** Detected MIDI note number (rounded to the nearest semitone). */
  midi: number;
  /** Detected fundamental in Hz (pre-rounding). */
  hz: number;
  /** YIN confidence in [0,1] = 1 − (CMND value at the chosen lag). Higher = surer. */
  confidence: number;
  /** Signed cents deviation from the nearest equal-tempered semitone (−50..+50). */
  cents: number;
}

export interface VerifyPitchOptions {
  /** Lowest fundamental to search (Hz). B0≈30.9 (5/6-string low B) with headroom. */
  minHz?: number;
  /** Highest fundamental to search (Hz). Bass rarely exceeds G2≈98; cap with headroom so
   *  a bright harmonic doesn't pull the estimate up an octave. */
  maxHz?: number;
  /** CMND threshold: the first lag whose normalized difference dips below this is the
   *  period. ~0.15 is the YIN-standard absolute threshold. Lower = stricter. */
  threshold?: number;
  /** Minimum confidence (1 − CMND) to RETURN a pitch; below → null (no confident read). */
  minConfidence?: number;
}

const DEFAULTS: Required<VerifyPitchOptions> = {
  minHz: 28, // a touch below B0 (30.9) for headroom
  // maxHz 150 (≈ D3) — ABOVE the highest fretted note these bass exercises use, but LOW enough
  // that a bass note's 2nd harmonic (≥ 2× its fundamental, so ≥ ~82Hz for low-E) can't be mistaken
  // for a higher fundamental. Was 400, which let the search lock onto the 2nd–5th partials of every
  // low note → octave/harmonic errors. The equipment path also passes a tighter chart-anchored band;
  // this default protects any caller that doesn't.
  maxHz: 150,
  threshold: 0.15,
  minConfidence: 0.5,
};

/** Hz → MIDI (float). A4=440=MIDI 69. */
export function hzToMidiFloat(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** MIDI → Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Detect the fundamental pitch of a mono signal WINDOW via YIN. The caller slices a window
 * starting ~10ms after the onset (skip the broadband attack) of length ≥ a few periods of
 * the lowest note (~65ms for low-B). Returns null if no confident pitch.
 */
export function verifyPitch(
  window: Float32Array,
  sampleRate: number,
  opts: VerifyPitchOptions = {},
): PitchResult | null {
  const minHz = opts.minHz ?? DEFAULTS.minHz;
  const maxHz = opts.maxHz ?? DEFAULTS.maxHz;
  const threshold = opts.threshold ?? DEFAULTS.threshold;
  const minConfidence = opts.minConfidence ?? DEFAULTS.minConfidence;

  // Lag (period in samples) search bounds from the Hz register. minHz → max lag.
  const maxLag = Math.floor(sampleRate / minHz);
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  // Need at least 2× maxLag samples for the difference function to be meaningful.
  if (window.length < 2 * maxLag) return null;

  const N = maxLag; // number of lags we evaluate
  // 1) Difference function d(tau) = sum_j (x[j] - x[j+tau])^2 over an integration window.
  const diff = new Float32Array(N + 1);
  const integ = window.length - maxLag; // samples used per lag
  for (let tau = minLag; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < integ; j++) {
      const delta = (window[j] ?? 0) - (window[j + tau] ?? 0);
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2) Cumulative mean normalized difference (CMND). d'(0)=1; d'(tau)=d(tau)/((1/tau)·Σ).
  const cmnd = new Float32Array(N + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += diff[tau]!;
    cmnd[tau] = running > 0 ? (diff[tau]! * tau) / running : 1;
  }

  // 3) Absolute threshold: the FIRST lag (≥ minLag) where CMND dips below `threshold` and
  //    is a local minimum. If none, take the global minimum in range (best effort).
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau]! < threshold) {
      // descend to the local minimum of this dip
      while (tau + 1 <= maxLag && cmnd[tau + 1]! < cmnd[tau]!) tau++;
      bestTau = tau;
      break;
    }
  }
  if (bestTau < 0) {
    // no dip below threshold — global min as a fallback (lower confidence)
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau]! < minVal) {
        minVal = cmnd[tau]!;
        bestTau = tau;
      }
    }
    if (bestTau < 0) return null;
  }

  // 3b) OCTAVE-DOWN guard. YIN's classic error: it can land on the SUB-octave (a lag ~2× the true
  // period) because the fundamental's dip can be shallower than its sub-octave's, especially on a
  // bright high note or a short-ish window. If a lag near bestTau/2 (one octave UP) has a CMND
  // within a small margin of the chosen one, prefer the SHORTER lag (the true, higher fundamental).
  // This recovers the high notes that were reading an octave low (C#3 → C#2) without re-introducing
  // the chart-anchored-band bias.
  for (let half = Math.round(bestTau / 2); half >= minLag; half = Math.round(half / 2)) {
    // find the local minimum of the dip nearest `half`
    let h = half;
    while (h + 1 <= maxLag && cmnd[h + 1]! < cmnd[h]!) h++;
    while (h - 1 >= minLag && cmnd[h - 1]! < cmnd[h]!) h--;
    // accept the higher octave if its dip is nearly as deep (within 0.12 of the chosen CMND).
    if (cmnd[h]! <= cmnd[bestTau]! + 0.12) {
      bestTau = h;
    } else {
      break; // the octave up isn't credible — stop climbing
    }
  }

  // 4) Parabolic interpolation around bestTau for sub-sample period precision.
  let tauInterp = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const a = cmnd[bestTau - 1]!;
    const b = cmnd[bestTau]!;
    const c = cmnd[bestTau + 1]!;
    const denom = a + c - 2 * b;
    if (Math.abs(denom) > 1e-9) {
      tauInterp = bestTau + (a - c) / (2 * denom);
    }
  }

  const hz = sampleRate / tauInterp;
  if (hz < minHz || hz > maxHz) return null;

  const confidence = Math.max(0, Math.min(1, 1 - cmnd[bestTau]!));
  if (confidence < minConfidence) return null;

  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  return { midi, hz, confidence, cents };
}

/**
 * CHART-INFORMED, OCTAVE-EXACT pitch detection. We KNOW the expected note, so instead of blind
 * YIN (which guesses the octave and often grabs the sub-octave on bright high notes), we MEASURE
 * the signal's periodicity at the EXPECTED period and its OCTAVE NEIGHBORS (½× = octave up, 2× =
 * octave down) and pick whichever the signal is genuinely most periodic at. The octave becomes
 * unambiguous: a note an octave up has exactly HALF the period (its difference function dips at
 * half the lag), so comparing the dip depth at expected vs ½×/2× tells us the real octave.
 *
 * Each candidate lag is searched over a small ±1-semitone window (so a slightly sharp/flat fret
 * still locks), with parabolic interpolation. Returns the detected MIDI (octave-exact) + confidence.
 *
 * @param expectedMidi  the chart's expected note — anchors the candidate periods.
 */
export function verifyPitchChartInformed(
  window: Float32Array,
  sampleRate: number,
  expectedMidi: number,
  opts: { minConfidence?: number } = {},
): PitchResult | null {
  const minConfidence = opts.minConfidence ?? 0.3;
  const expHz = midiToHz(expectedMidi);

  // Candidate fundamentals: the expected note + the octave below + the octave above. (We grade
  // the EXACT octave now, but we still detect all three so an octave-off PLAYING reads as the wrong
  // octave rather than null — the grade then marks it wrong, honestly.)
  const candidates = [
    { midi: expectedMidi - 12, hz: expHz / 2 }, // octave down
    { midi: expectedMidi, hz: expHz }, // expected
    { midi: expectedMidi + 12, hz: expHz * 2 }, // octave up
  ];

  // We need the difference function up to the LONGEST candidate lag (the octave-down period), with
  // ±1 semitone of search slack around it. Guard the window length against that longest lag.
  const lowestHz = expHz / 2 / Math.pow(2, 1 / 12); // octave-down, a semitone flat
  const maxLag = Math.floor(sampleRate / lowestHz);
  if (window.length < 2 * maxLag) return null;

  // Difference function d(tau) over [2, maxLag]. (Local, like verifyPitch's.)
  const integ = window.length - maxLag;
  const diff = new Float32Array(maxLag + 1);
  for (let tau = 2; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < integ; j++) {
      const d = (window[j] ?? 0) - (window[j + tau] ?? 0);
      sum += d * d;
    }
    diff[tau] = sum;
  }
  // CMND over the full lag axis (textbook YIN d').
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += diff[tau]!;
    cmnd[tau] = running > 0 ? (diff[tau]! * tau) / running : 1;
  }

  // For each candidate, find the deepest CMND dip within ±1 semitone of its target lag.
  // Find each candidate's deepest dip (within ±1 semitone of its target lag).
  const dips: { midi: number; cmnd: number; tau: number }[] = [];
  for (const cand of candidates) {
    const targetLag = sampleRate / cand.hz;
    const loLag = Math.max(2, Math.floor(targetLag / Math.pow(2, 1 / 12)));
    const hiLag = Math.min(maxLag, Math.ceil(targetLag * Math.pow(2, 1 / 12)));
    let dipTau = -1;
    let dipVal = Infinity;
    for (let tau = loLag; tau <= hiLag; tau++) {
      if (cmnd[tau]! < dipVal) {
        dipVal = cmnd[tau]!;
        dipTau = tau;
      }
    }
    if (dipTau >= 0) dips.push({ midi: cand.midi, cmnd: dipVal, tau: dipTau });
  }
  if (dips.length === 0) return null;

  // OCTAVE CORRECTION (the physics): a periodic signal ALWAYS also dips at 2× its period (two
  // cycles line up), so a genuine HIGH note has a near-equal ARTIFACT dip an octave down — and on
  // bright/short high bass notes that artifact can be marginally deeper, slipping the read down an
  // octave. The textbook fix: among candidates within a small margin of the deepest dip, prefer the
  // HIGHEST octave (shortest tau). Safe for genuine LOW notes — they have NO competitive dip an
  // octave UP (a low signal doesn't repeat at half its period), so the higher candidate stays
  // shallow and is rejected. So: the highest-pitch candidate whose dip is within OCTAVE_MARGIN of
  // the deepest wins.
  const OCTAVE_MARGIN = 0.1;
  const deepest = Math.min(...dips.map((d) => d.cmnd));
  const credible = dips.filter((d) => d.cmnd <= deepest + OCTAVE_MARGIN);
  // smallest tau = highest pitch
  let best = credible[0]!;
  for (const d of credible) if (d.tau < best.tau) best = d;

  // Parabolic interpolation for sub-sample period (cents precision).
  let tauInterp = best.tau;
  if (best.tau > 2 && best.tau < maxLag) {
    const a = cmnd[best.tau - 1]!;
    const b = cmnd[best.tau]!;
    const c = cmnd[best.tau + 1]!;
    const denom = a + c - 2 * b;
    if (Math.abs(denom) > 1e-9) tauInterp = best.tau + (a - c) / (2 * denom);
  }

  const confidence = Math.max(0, Math.min(1, 1 - best.cmnd));
  if (confidence < minConfidence) return null;

  const hz = sampleRate / tauInterp;
  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  return { midi, hz, confidence, cents };
}
