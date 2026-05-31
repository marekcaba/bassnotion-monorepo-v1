/**
 * Ambient type declaration for `signalsmith-stretch` (v1.3.2).
 *
 * The published package ships JS + inlined WASM with no bundled `.d.ts`,
 * so we hand-declare the surface the pitch-shift adapter uses. Shape from
 * the package README (web/release): the default export is an async
 * factory returning a real AudioWorkletNode with extra methods bolted on.
 *
 * Only the members the adapter touches are typed; the rest of the
 * (buffer-streaming) API is omitted intentionally — we use live-input
 * mode, where input/rate/loop are ignored.
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
    // Live-input mode ignores input/rate/loopStart/loopEnd — omitted.
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
    start(when?: number): void;
    stop(when?: number): void;
    /** Live-input latency in seconds. */
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
