/**
 * InfiniteAudioSource — the per-region audio producer the RegionScheduler
 * tracks, abstracted over the two source kinds the groove card uses:
 *
 *  - {@link NativeBufferSource}: a Web Audio `AudioBufferSourceNode`. Used by
 *    drums (and click). Tempo change requires recreating the node (playbackRate
 *    couples pitch, so the SoundTouch insert that preserves pitch needs the
 *    source's rate set at construction) — so it goes through the scheduler's
 *    windowed re-arm path. `applyRate`/`applySemitones` are therefore no-ops
 *    here; the scheduler recreates instead.
 *
 *  - {@link SignalsmithBufferSource}: signalsmith in buffer-streaming mode —
 *    ONE self-looping worklet that plays its own buffer for the whole
 *    play→stop lifetime. Used by bass/harmony. It does true pitch-independent
 *    time-stretch: `applyRate` (tempo) and `applySemitones` (pitch) are live
 *    `schedule()` calls deferred to a loop boundary — no re-arm, no new node.
 *
 * The scheduler's stop/rearm bookkeeping only ever calls `.stop(when)`, so a
 * single widened entry type covers both. All signalsmith `schedule({…,output})`
 * lives ONLY inside SignalsmithBufferSource — callers use this interface.
 */

/** Adapter surface SignalsmithBufferSource needs (a slice of PitchShiftAdapter). */
export interface SignalsmithStreamControls {
  startBufferStreaming(
    node: AudioNode,
    when: number,
    offsetSeconds: number,
  ): void;
  stopBufferStreaming(node: AudioNode, when: number): void;
  setRate(
    node: AudioNode,
    rate: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void;
  setSemitones(
    node: AudioNode,
    semitones: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void;
}

export interface InfiniteAudioSource {
  /** Begin playback at audio-time `when`, reading from buffer offset `offset` (s). */
  start(when: number, offset: number): void;
  /** Stop at audio-time `when`. Cancels a pending start too. */
  stop(when: number): void;
  /** Tempo as a stretch ratio R (1 = original speed), applied at `atTime`.
   *  Returns false if the source can't change rate in place (caller must
   *  recreate). */
  applyRate(R: number, atTime: number): boolean;
  /** Pitch in semitones, applied at `atTime`. Returns false if unsupported. */
  applySemitones(semitones: number, atTime: number): boolean;
}

/** Wraps a Web Audio AudioBufferSourceNode (drums/click). */
export class NativeBufferSource implements InfiniteAudioSource {
  constructor(private readonly node: AudioBufferSourceNode) {}

  /** The underlying node, for callers that still need the concrete source. */
  get audioBufferSourceNode(): AudioBufferSourceNode {
    return this.node;
  }

  start(when: number, offset: number): void {
    this.node.start(when, offset);
  }

  stop(when: number): void {
    this.node.stop(when);
  }

  // An ABSN can't change tempo without coupling pitch, and can't be
  // re-started. The scheduler recreates the node instead (windowed re-arm).
  applyRate(): boolean {
    return false;
  }

  applySemitones(): boolean {
    return false;
  }
}

/**
 * Wraps a signalsmith buffer-streaming node (bass/harmony). The node itself
 * is created + owned by the PlaybackEngine via the adapter; this just drives
 * its transport-aligned start and boundary-deferred rate/pitch changes.
 */
export class SignalsmithBufferSource implements InfiniteAudioSource {
  constructor(
    private readonly node: AudioNode,
    private readonly controls: SignalsmithStreamControls,
    private readonly audioContext: AudioContext,
  ) {}

  /** The node the engine owns (for dispose on stop). */
  get streamNode(): AudioNode {
    return this.node;
  }

  start(when: number, offset: number): void {
    this.controls.startBufferStreaming(this.node, when, offset);
  }

  stop(when: number): void {
    // Stop producing output at `when`; the engine still calls disposeNode
    // afterwards to tear the worklet down (lifecycle stays engine-owned).
    this.controls.stopBufferStreaming(this.node, when);
  }

  applyRate(R: number, atTime: number): boolean {
    this.controls.setRate(this.node, R, this.audioContext, atTime);
    return true;
  }

  applySemitones(semitones: number, atTime: number): boolean {
    this.controls.setSemitones(this.node, semitones, this.audioContext, atTime);
    return true;
  }
}

/** Minimal slice-player surface DrumSliceSource needs. */
export interface DrumSliceControls {
  start(when?: number): void;
  stop(when?: number): void;
  setRatio(ratio: number): void;
}

/**
 * Wraps the transient-preserving DrumBeatsPlayer (Ableton "Beats"-style slicer) as a
 * scheduler self-looping source — so drums arm once at play and change tempo LIVE via
 * applyRate, exactly like bass/harmony. The player slices the loop at every transient
 * and re-grids them un-stretched (rate 1, pristine transients); applyRate re-spaces the
 * slices and varispeeds during a drag.
 */
export class DrumSliceSource implements InfiniteAudioSource {
  constructor(private readonly player: DrumSliceControls) {}

  start(when: number): void {
    this.player.start(when);
  }

  stop(when: number): void {
    this.player.stop(when);
  }

  applyRate(R: number): boolean {
    this.player.setRatio(R);
    return true;
  }

  applySemitones(): boolean {
    // Drums never transpose.
    return true;
  }
}
