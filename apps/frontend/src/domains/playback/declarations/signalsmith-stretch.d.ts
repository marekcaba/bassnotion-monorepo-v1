/**
 * Ambient type declaration for `signalsmith-stretch` (v1.3.2).
 *
 * The published package ships JS + inlined WASM with no bundled `.d.ts`,
 * so we hand-declare the surface the pitch-shift adapter uses. Shape from
 * the package README (web/release): the default export is an async
 * factory returning a real AudioWorkletNode with extra methods bolted on.
 *
 * The adapter uses TWO modes (see PitchShiftAdapter.ts):
 *  - live-input: a source feeds the worklet input; only semitones/formant
 *    apply (input/rate/loop are ignored by the WASM in this mode).
 *  - buffer-streaming: nothing is connected to the input; the node plays its
 *    own buffer (loaded via addBuffers) and honors input/rate/loopStart/
 *    loopEnd — this is how we get true pitch-independent time-stretch.
 */
declare module 'signalsmith-stretch' {
  /** One scheduled change. All fields optional; later-scheduled changes
   *  after this one are removed by the call. */
  interface SignalsmithScheduleChange {
    /** Audio-context time (s) the change applies at. Latency-compensated. */
    output?: number;
    /** Whether the node is processing audio. */
    active?: boolean;
    /** Pitch shift in semitones. */
    semitones?: number;
    /** Tonality limit in Hz (default 8000). */
    tonalityHz?: number;
    /** Preserve formants while pitch-shifting (no "chipmunk"). */
    formantCompensation?: boolean;
    /** Explicit formant shift in semitones. */
    formantSemitones?: number;
    /** Rough fundamental (Hz) for formant analysis, or 0 to pitch-track. */
    formantBaseHz?: number;
    /** Read position in the internal buffer (s). Buffer-streaming only. */
    input?: number;
    /** Time-stretch ratio (1 = original speed). Buffer-streaming only;
     *  decoupled from `semitones`. Honored only when the worklet input is
     *  disconnected. */
    rate?: number;
    /** Loop region start (s) in the internal buffer. Buffer-streaming only. */
    loopStart?: number;
    /** Loop region end (s); loopStart === loopEnd disables looping.
     *  Buffer-streaming only. */
    loopEnd?: number;
  }

  interface SignalsmithConfigure {
    blockMs?: number | null;
    intervalMs?: number;
    splitComputation?: boolean;
    preset?: 'default' | 'cheaper';
  }

  /** The factory's resolved value: an AudioWorkletNode plus methods. */
  type SignalsmithStretchNode = AudioWorkletNode & {
    schedule(change: SignalsmithScheduleChange): void;
    /** Start playback. In buffer-streaming mode `offset` is the read position
     *  (s) and rate/semitones seed the first segment (sugar over schedule). */
    start(
      when?: number,
      offset?: number,
      duration?: number,
      rate?: number,
      semitones?: number,
    ): void;
    stop(when?: number): void;
    /** Append PCM to the internal buffer (one Float32Array per channel).
     *  Returns the new buffer end-time in seconds. Buffer-streaming mode. */
    addBuffers(channelData: Float32Array[]): Promise<number>;
    /** Drop all internal buffers, resetting the end-time to 0. */
    dropBuffers(): void;
    /** Algorithmic latency in seconds (input + output). */
    latency(): number;
    configure(opts: SignalsmithConfigure): void;
  };

  /**
   * Build (and self-register the worklet for) a Signalsmith Stretch node.
   * Returns a Promise resolving to the node.
   */
  export default function SignalsmithStretch(
    audioContext: BaseAudioContext,
    channelOptions?: AudioWorkletNodeOptions,
  ): Promise<SignalsmithStretchNode>;
}
