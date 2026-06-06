/**
 * DrumTwoTrackPlayer — the CLEAN two-track drum engine (2026-06-06).
 *
 * Replaces the tangled SLICES↔BED state machine with exactly the user's design,
 * nothing more:
 *
 *   1. BED  = the loop with the kick/snare BODIES notched OUT — they are physically
 *             NOT in this audio, so a kick can NEVER leak into the bed, no matter
 *             what. ONE buffer, played as ONE continuous looping source. Tempo
 *             changes by setting its playbackRate — the bed warps/stretches in
 *             real time, like flexing a clip. No re-render, no new loop, no stall.
 *             (It pitch-bends slightly when stretched — acceptable for hat/room
 *             texture; the hits stay pitch-correct below.)
 *
 *   2. HITS = the bit-exact kick/snare regions, re-GRIDDED to their positions for
 *             the current tempo (onset/ratio), scheduled per loop iteration.
 *             playbackRate = 1 always → never pitch-shifted. The kicks/snares the
 *             user hears.
 *
 * Both play together, ALWAYS. No modes. No per-slice path. No crossfade. No settle.
 * Tempo change = set the bed's playbackRate + reposition the future hits. Phase is
 * kept locked to bass/harmony by re-anchoring the grid at the engine's shared pivot
 * T (setRatio(ratio, atTime)) — same contract the old slicer used.
 *
 * Output: one AudioNode (the 'audio-drums' gain). Bed + hits both connect to it.
 */
import { detectOnsetsDetailed } from './detectOnsets.js';

/** The subset of the signalsmith PitchShiftAdapter the bed needs for a pitch-
 *  PRESERVING stretch (in tune at every tempo). Injected by the engine, which owns
 *  the adapter. When absent, the bed falls back to playbackRate (pitch-bends). */
export interface BedStretchControls {
  createBufferStreamingNode(
    ctx: AudioContext,
    output: AudioNode,
    channelData: Float32Array[],
    bufferDuration: number,
    stemProfile: 'bass' | 'harmony',
    initialSemitones?: number,
  ): AudioNode | null;
  startBufferStreaming(node: AudioNode, when: number, offsetSeconds: number): void;
  setRate(
    node: AudioNode,
    rate: number,
    ctx: AudioContext,
    applyAtAudioTime?: number,
  ): void;
  silenceNode(node: AudioNode, ctx: AudioContext): void;
  disposeNode(node: AudioNode): void;
}

export interface DrumTwoTrackOptions {
  /** Musical loop length (s) — the grid the hits re-space against and the bed loops on. */
  loopDurationSeconds: number;
  /** Confidence ≥ this ⇒ a "big hit" (kick/snare): notched from the bed + played as
   *  an overlay. Below ⇒ rides the bed as texture. */
  strongConfidenceThreshold?: number;
  /** Bed notch: how far before/after each big hit's onset to remove from the bed. */
  notchPreSeconds?: number;
  notchTailSeconds?: number;
  /** Hit region: how far before/after each onset the bit-exact overlay reads. */
  hitPreSeconds?: number;
  hitTailSeconds?: number;
  /** Declick fade lengths (s). */
  fadeSeconds?: number;
  /** High-pass the bed below this (Hz) so it carries no low end (the hits do). 0=off. */
  bedHighpassHz?: number;
  /** Look-ahead for scheduling hit one-shots (s). */
  scheduleAheadSeconds?: number;
  /** Scheduler tick (ms). */
  tickMs?: number;
}

const DEFAULTS: Required<Omit<DrumTwoTrackOptions, 'loopDurationSeconds'>> = {
  strongConfidenceThreshold: 0.3,
  notchPreSeconds: 0.037,
  notchTailSeconds: 0.13,
  hitPreSeconds: 0.039,
  hitTailSeconds: 0.2,
  fadeSeconds: 0.004,
  bedHighpassHz: 90,
  scheduleAheadSeconds: 0.06,
  tickMs: 25,
};

/** One bit-exact big hit, ready to place at any tempo. */
interface BigHit {
  /** Input-domain onset (s) on the musical loop. */
  onsetSec: number;
  /** Bit-exact PCM [onset−pre, onset+tail], per channel, edge-faded. */
  channels: Float32Array[];
  /** Where the onset sits inside `channels` (samples). */
  leadSamples: number;
}

export class DrumTwoTrackPlayer {
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer; // the raw drum loop
  private readonly output: AudioNode;
  private readonly opt: Required<DrumTwoTrackOptions>;
  private readonly sr: number;
  private readonly numCh: number;
  private readonly loopDuration: number; // musical loop length (s, input domain)

  private onsets: number[] = [];
  private confidences: number[] = [];
  private strongOnsets: number[] = []; // big-hit onset times (input s)

  /** The notched bed buffer (kicks removed). Built ONCE; never contains hits. */
  private bedBuffer: AudioBuffer | null = null;
  /** The extracted big hits. Built ONCE; re-gridded per tempo (cheap). */
  private hits: BigHit[] = [];

  private playing = false;
  private ratio = 1; // target/original tempo
  private loopStartTime = 0; // audio time of input-position 0 of the current iteration

  // The single continuous bed source (loops forever; playbackRate = the stretch).
  private bedSrc: AudioBufferSourceNode | null = null;
  private bedGain: GainNode | null = null;

  // BED ENGINE A/B: 'rate' = playbackRate (warps, pitch-bends — simple, no latency);
  // 'signalsmith' = pitch-preserving stretch (in tune at every tempo, via the engine's
  // adapter). Default signalsmith when the adapter is injected, else rate.
  private bedEngine: 'rate' | 'signalsmith' = 'rate';
  private bedStretch: BedStretchControls | null = null; // injected adapter
  private bedNode: AudioNode | null = null; // the signalsmith bed relay node
  private bedSemitones = 0; // optional bed pitch offset (default 0 = true pitch)

  // Scheduled hit one-shots (for teardown).
  private active = new Set<{ src: AudioBufferSourceNode; env: GainNode }>();
  // Hit scheduler cursor.
  private nextHitIter = 0; // the loop iteration index we're scheduling hits for
  private nextHitIndex = 0; // index into strongOnsets within that iteration
  private timer: ReturnType<typeof setInterval> | null = null;

  // Diagnostic solos (admin).
  private muteBed = false;
  private muteHits = false;

  /** The Σ(hit envelopes) map over the loop (source samples), built once with the
   *  bed; rebuildHits uses it to normalize overlaps so bed + Σhits = original. */
  private bedSumH: Float32Array | null = null;

  /** One hit's gain envelope at sample i of a length-`len` region with `lead`
   *  lead-in samples: 0→1 over the lead (attack survives), hold 1, 1→0 over the last
   *  `fade` samples. Shared by buildSplit (bed complement) and rebuildHits. */
  private hitEnv(i: number, len: number, lead: number, fade: number): number {
    let h = 1;
    if (i < lead) h = lead > 0 ? i / lead : 1;
    const outFromEnd = len - 1 - i;
    if (outFromEnd < fade) h = Math.min(h, outFromEnd / fade);
    return h;
  }

  constructor(
    ctx: AudioContext,
    buffer: AudioBuffer,
    output: AudioNode,
    options: DrumTwoTrackOptions,
  ) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.output = output;
    this.opt = { ...DEFAULTS, ...options };
    this.sr = buffer.sampleRate;
    this.numCh = buffer.numberOfChannels;
    this.loopDuration = this.opt.loopDurationSeconds;
    this.analyze();
  }

  // ── BUILD (once, at load) ───────────────────────────────────────────────────

  /** Detect onsets, pick the big hits, build the notched bed + extract the hits. */
  private analyze(): void {
    try {
      const detected = detectOnsetsDetailed(this.buffer);
      this.onsets = detected.map((o) => o.time);
      this.confidences = detected.map((o) => o.confidence);
    } catch {
      this.onsets = [0];
      this.confidences = [1];
    }
    if (this.onsets.length === 0) {
      this.onsets = [0];
      this.confidences = [1];
    }
    // Big hits = onset 0 (downbeat) always, plus any ≥ threshold.
    this.strongOnsets = this.onsets.filter(
      (_t, i) => i === 0 || (this.confidences[i] ?? 1) >= this.opt.strongConfidenceThreshold,
    );
    this.buildSplit();
  }

  /**
   * COMPLEMENTARY SPLIT — the bed and the hits share ONE region per big hit and ONE
   * envelope, so they reconstruct the original exactly: hit gets gain h(i), bed gets
   * (1 − h(i)). Where the hit is full (h=1, across the attack/body) the bed is 0 →
   * the kick is PHYSICALLY GONE from the bed (can't leak); at the region edges they
   * crossfade and SUM TO 1 → no double, no gap. At ratio 1, bed + hits = the original
   * sample-for-sample (modulo the bed high-pass, which moves the lows to the hits).
   *
   * The shared region is [onset − hitPre, onset + hitTail]. The envelope h(i): ramps
   * 0→1 over the pre (lead-in), holds 1 across pre→tail-edge, ramps 1→0 over a short
   * release at the tail. The bed uses 1−h(i) over the SAME samples.
   */
  private buildSplit(): void {
    const end = Math.min(this.buffer.length, Math.round(this.loopDuration * this.sr));
    if (end <= 0) {
      this.bedBuffer = null;
      this.hits = [];
      return;
    }
    const pre = Math.max(0, Math.round(this.opt.hitPreSeconds * this.sr));
    const tail = Math.max(1, Math.round(this.opt.hitTailSeconds * this.sr));
    const fade = Math.max(1, Math.round(this.opt.fadeSeconds * this.sr));

    // STEP 1 — each hit's own envelope h_k(i): 0→1 lead-in (attack survives), hold 1,
    // 1→0 release. The bed must equal original·(1 − Σh_k) and the summed hits equal
    // original·Σh_k, so that bed + Σhits = original. Build the SUM map Σh_k, clamped
    // to ≤1 for the bed (heavy overlaps can't make the bed go negative).
    const sumH = new Float32Array(end); // Σ h_k(i)
    for (const onsetSec of this.strongOnsets) {
      const onset = Math.round(onsetSec * this.sr);
      const readStart = Math.max(0, onset - pre);
      const readEnd = Math.min(end, onset + tail);
      const len = readEnd - readStart;
      if (len <= 1) continue;
      const lead = onset - readStart;
      for (let i = 0; i < len; i++) {
        sumH[readStart + i]! += this.hitEnv(i, len, lead, fade);
      }
    }

    // STEP 2 — BED = original · (1 − min(Σh, 1)). Where a hit is full, bed is 0 (kick
    // physically gone). At the edges they crossfade. Then high-pass the bed. The bed
    // is built ONCE and never re-rendered — playbackRate stretches it (the notch hole
    // stretches with it, so a kick can never reappear).
    const bedChannels: Float32Array[] = [];
    for (let c = 0; c < this.numCh; c++) {
      const src = this.buffer.getChannelData(c);
      const bed = new Float32Array(end);
      for (let i = 0; i < end; i++) {
        const bedG = 1 - Math.min(1, sumH[i]!);
        bed[i] = src[i]! * bedG;
      }
      if (this.opt.bedHighpassHz > 0) this.highpass(bed, this.opt.bedHighpassHz);
      bedChannels.push(bed);
    }
    try {
      const buf = this.ctx.createBuffer(this.numCh, end, this.sr);
      for (let c = 0; c < this.numCh; c++) buf.copyToChannel(bedChannels[c]!, c);
      this.bedBuffer = buf;
    } catch {
      this.bedBuffer = null;
    }

    // Store the SUM map so the per-ratio hit rebuild can normalize overlaps the same
    // way (the bed is fixed; the hits re-extract per tempo, scaling their TAIL by
    // 1/ratio so the bit-exact hit fills the bed's stretched hole — pitch-correct).
    this.bedSumH = sumH;
    this.rebuildHits(this.ratio);
  }

  /**
   * TEMPO-SCALED HITS. The bed plays at playbackRate=ratio, so its notch hole at each
   * hit stretches to (pre+tail)/ratio of REAL time. The bit-exact hit (rate 1) must
   * fill that, so it reads (pre + tail/ratio) of SOURCE — a LONGER region at slow
   * tempo (more of the kick's natural decay), keeping the kick PITCH-CORRECT. Re-run
   * on every tempo change (~ms). The release fade scales with the longer tail.
   */
  private rebuildHits(ratio: number): void {
    const r = ratio > 0 ? ratio : 1;
    const end = Math.min(this.buffer.length, Math.round(this.loopDuration * this.sr));
    const pre = Math.max(0, Math.round(this.opt.hitPreSeconds * this.sr));
    const baseTail = Math.max(1, Math.round(this.opt.hitTailSeconds * this.sr));
    const tail = Math.max(1, Math.round(baseTail / r)); // SCALED: longer at slow tempo
    const fade = Math.max(1, Math.round(this.opt.fadeSeconds * this.sr));
    const sumH = this.bedSumH;
    this.hits = [];
    for (const onsetSec of this.strongOnsets) {
      const onset = Math.round(onsetSec * this.sr);
      const readStart = Math.max(0, onset - pre);
      const readEnd = Math.min(end, onset + tail);
      const len = readEnd - readStart;
      if (len <= 1) continue;
      const leadSamples = onset - readStart;
      const hitChannels: Float32Array[] = [];
      for (let c = 0; c < this.numCh; c++) {
        const src = this.buffer.getChannelData(c);
        const region = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const d = readStart + i;
          // Normalize overlaps by the bed's Σh map at the START region only (the part
          // that complements the bed); the extended tail (beyond the bed's notch) is
          // pure kick decay → norm 1. Guard against reading past the map.
          const norm = sumH && d < sumH.length ? Math.max(1, sumH[d]!) : 1;
          region[i] = src[d]! * (this.hitEnv(i, len, leadSamples, fade) / norm);
        }
        hitChannels.push(region);
      }
      this.hits.push({ onsetSec, channels: hitChannels, leadSamples });
    }
  }

  /** One-pole high-pass in place. */
  private highpass(x: Float32Array, fc: number): void {
    const dt = 1 / this.sr;
    const rc = 1 / (2 * Math.PI * fc);
    const a = rc / (rc + dt);
    let px = x[0] ?? 0;
    let py = 0;
    for (let i = 0; i < x.length; i++) {
      const cur = x[i]!;
      py = a * (py + cur - px);
      px = cur;
      x[i] = py;
    }
  }

  // ── TRANSPORT ───────────────────────────────────────────────────────────────

  /** Real-time loop period at the current ratio. */
  private get period(): number {
    return this.loopDuration / (this.ratio || 1);
  }

  start(when?: number): void {
    if (this.playing) return;
    this.playing = true;
    this.loopStartTime = when ?? this.ctx.currentTime;
    this.nextHitIter = 0;
    this.nextHitIndex = 0;
    this.startBed();
    this.tick();
    this.timer = setInterval(() => this.tick(), this.opt.tickMs);
  }

  /** Inject the signalsmith adapter + enable the pitch-PRESERVING bed engine. Call
   *  before start() (or it re-arms the bed if already playing). The engine owns the
   *  adapter; this player drives the bed node through it. */
  attachBedStretch(controls: BedStretchControls, engine: 'rate' | 'signalsmith'): void {
    this.bedStretch = controls;
    if (this.bedEngine === engine) return;
    this.bedEngine = engine;
    if (this.playing) this.startBed(); // re-arm with the chosen engine
  }

  /** Switch the bed engine live (A/B by ear). */
  setBedEngine(engine: 'rate' | 'signalsmith'): void {
    if (this.bedEngine === engine) return;
    if (engine === 'signalsmith' && !this.bedStretch) return; // no adapter → stay rate
    this.bedEngine = engine;
    if (this.playing) this.startBed();
  }

  /** Start (or restart) the bed. Branches on bedEngine: 'signalsmith' = pitch-
   *  preserving stretch (in tune); 'rate' = playbackRate (warps/pitch-bends). */
  private startBed(): void {
    this.stopBed();
    if (!this.bedBuffer) return;
    if (this.bedEngine === 'signalsmith' && this.bedStretch) {
      this.startBedSignalsmith();
      return;
    }
    try {
      const src = this.ctx.createBufferSource();
      const env = this.ctx.createGain();
      src.buffer = this.bedBuffer;
      src.loop = true;
      // The bed buffer is exactly loopDuration long (input domain). playbackRate =
      // ratio warps it to the real tempo: ratio<1 (slower) → rate<1 → longer/lower.
      src.playbackRate.value = this.ratio || 1;
      env.gain.value = this.muteBed ? 0 : 1;
      src.connect(env);
      env.connect(this.output);
      // Align the bed loop phase to the grid: start it so input-position 0 plays at
      // loopStartTime. If loopStartTime is in the past, offset into the buffer.
      const now = this.ctx.currentTime;
      const startAt = Math.max(now, this.loopStartTime);
      const phaseSec = Math.max(0, now - this.loopStartTime); // real-time into the loop
      const offsetInput = (phaseSec * (this.ratio || 1)) % this.loopDuration; // input s
      src.start(startAt, this.loopStartTime > now ? 0 : offsetInput);
      this.bedSrc = src;
      this.bedGain = env;
    } catch {
      this.bedSrc = null;
      this.bedGain = null;
    }
  }

  /** Start the bed through signalsmith — pitch-PRESERVING stretch, in tune at every
   *  tempo. The notched bed PCM streams through the adapter (sg→relay→bedGain→output)
   *  at the current ratio, semitones 0. Started at the grid phase (raw loopStartTime;
   *  signalsmith emits at `when` with no start-latency — aligned with the bit-exact
   *  hits). A bedGain sits before the output so muteBed can solo it. */
  private startBedSignalsmith(): void {
    const ctrl = this.bedStretch;
    if (!ctrl || !this.bedBuffer) return;
    try {
      const channelData: Float32Array[] = [];
      for (let c = 0; c < this.bedBuffer.numberOfChannels; c++) {
        channelData.push(this.bedBuffer.getChannelData(c));
      }
      // A gain stage we own (for muteBed) between the bed node and the output.
      const env = this.ctx.createGain();
      env.gain.value = this.muteBed ? 0 : 1;
      env.connect(this.output);
      // 'harmony' profile = formantBaseHz 0 (auto) — closest for the broadband,
      // transient-removed bed. The node connects itself: sg → relay → env.
      const node = ctrl.createBufferStreamingNode(
        this.ctx,
        env,
        channelData,
        this.loopDuration,
        'harmony',
        this.bedSemitones,
      );
      if (!node) {
        try {
          env.disconnect();
        } catch {
          /* ignore */
        }
        return;
      }
      this.bedNode = node;
      this.bedGain = env;
      // Set the live rate, then start at the grid phase (raw — no latency pull).
      ctrl.setRate(node, this.ratio || 1, this.ctx);
      const now = this.ctx.currentTime;
      const startAt = Math.max(now + 0.005, this.loopStartTime);
      const phaseSec = Math.max(0, now - this.loopStartTime);
      const offsetInput = (phaseSec * (this.ratio || 1)) % this.loopDuration;
      ctrl.startBufferStreaming(
        node,
        startAt,
        this.loopStartTime > now ? 0 : offsetInput,
      );
    } catch {
      this.bedNode = null;
      this.bedGain = null;
    }
  }

  private stopBed(): void {
    // playbackRate bed
    if (this.bedSrc) {
      try {
        this.bedGain?.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        /* ignore */
      }
      try {
        this.bedSrc.stop();
      } catch {
        /* ignore */
      }
      this.bedSrc = null;
    }
    // signalsmith bed — silence then dispose (never a bare disconnect).
    if (this.bedNode && this.bedStretch) {
      try {
        this.bedStretch.silenceNode(this.bedNode, this.ctx);
      } catch {
        /* ignore */
      }
      try {
        this.bedStretch.disposeNode(this.bedNode);
      } catch {
        /* ignore */
      }
      this.bedNode = null;
    }
    this.bedGain = null;
  }

  stop(when?: number): void {
    this.playing = false;
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.ctx.currentTime;
    const at = when ?? now;
    // Hard-stop the bed + every hit (zero gain first so a future-armed source can't
    // escape the stop, then stop). Click-safety is the engine master-bus fade.
    this.stopBed();
    for (const { src, env } of this.active) {
      try {
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(0, now);
      } catch {
        /* ignore */
      }
      try {
        src.stop(at);
      } catch {
        /* ignore */
      }
    }
    this.active.clear();
  }

  /**
   * Tempo change. Re-anchor the grid for phase continuity at the SHARED pivot
   * `atTime` (the same instant the engine flips bass/harmony) so the drums never
   * drift. Set the bed's playbackRate (it warps live — no re-render). Re-grid the
   * future hits by resetting the hit cursor to the live iteration.
   */
  setRatio(ratio: number, atTime?: number): void {
    const newRatio = ratio > 0 ? ratio : 1;
    if (this.playing && newRatio !== this.ratio) {
      const pivot = atTime ?? this.ctx.currentTime;
      const period = this.period;
      const rel = pivot - this.loopStartTime;
      const inputPos =
        rel >= 0 && rel < period
          ? rel * this.ratio
          : this.currentInputPos(pivot);
      this.loopStartTime = pivot - inputPos / newRatio;
    }
    const changed = newRatio !== this.ratio;
    this.ratio = newRatio;
    if (!this.playing || !changed) return;
    const t = atTime ?? this.ctx.currentTime;
    // BED rate — live, no re-render either way.
    if (this.bedEngine === 'signalsmith' && this.bedNode && this.bedStretch) {
      // Pitch-PRESERVING stretch: setRate at the SHARED pivot t so the bed stays
      // locked to bass/harmony/hits. Instant (one sg.schedule), in tune.
      try {
        this.bedStretch.setRate(this.bedNode, newRatio, this.ctx, t);
      } catch {
        /* ignore */
      }
    } else if (this.bedSrc) {
      // playbackRate: warps the one buffer (pitch-bends). Set at the shared pivot.
      try {
        this.bedSrc.playbackRate.setValueAtTime(newRatio, t);
      } catch {
        try {
          this.bedSrc.playbackRate.value = newRatio;
        } catch {
          /* ignore */
        }
      }
    }
    // HITS: re-extract at the new tempo (tail scales by 1/ratio so the bit-exact hit
    // fills the bed's stretched hole — pitch-correct, longer tail at slow tempo), then
    // re-point the cursor so future hits use the new spacing + scaled regions.
    this.rebuildHits(newRatio);
    this.repointHits();
  }

  /** Input position (s, [0,loopDuration)) at audio time `now`, folded over the loop. */
  private currentInputPos(now: number): number {
    const period = this.period;
    if (period <= 0) return 0;
    let rel = (now - this.loopStartTime) % period;
    if (rel < 0) rel += period;
    return rel * (this.ratio || 1);
  }

  /** Stop future-armed hits and re-seed the hit cursor to the iteration containing
   *  `now`, pointing at the first hit at/after the live input position. */
  private repointHits(): void {
    const now = this.ctx.currentTime;
    // Stop hits that haven't sounded yet (armed for the old grid); keep ones already
    // playing (their attack is out). We can't tell easily, so fade-stop all and let
    // the scheduler re-arm — the hits are short, the re-arm is immediate.
    for (const { src, env } of this.active) {
      try {
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(env.gain.value, now);
        env.gain.linearRampToValueAtTime(0, now + 0.006);
      } catch {
        /* ignore */
      }
      try {
        src.stop(now + 0.012);
      } catch {
        /* ignore */
      }
    }
    this.active.clear();
    // Re-seed the cursor: which iteration contains `now`, and the first hit ≥ live pos.
    const period = this.period;
    const k = Math.floor((now - this.loopStartTime) / period);
    this.nextHitIter = k;
    const inputPos = this.currentInputPos(now);
    let idx = 0;
    while (idx < this.strongOnsets.length && this.strongOnsets[idx]! < inputPos) idx++;
    this.nextHitIndex = idx;
  }

  // ── HIT SCHEDULER ───────────────────────────────────────────────────────────

  /** Schedule every hit whose grid time falls within the look-ahead horizon. The bed
   *  needs no scheduling — it's one looping source. Only the hits are armed here. */
  private tick(): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    const horizon = now + this.opt.scheduleAheadSeconds;
    const period = this.period;
    if (period <= 0 || this.strongOnsets.length === 0) return;

    let guard = 0;
    while (guard++ < 256) {
      const iterStart = this.loopStartTime + this.nextHitIter * period;
      const onsetSec = this.strongOnsets[this.nextHitIndex]!;
      const tHit = iterStart + onsetSec / (this.ratio || 1);
      if (tHit > horizon) break;
      // Never schedule a hit in the past (timer jitter / re-anchor) — skip it.
      if (tHit >= now - 1e-4) {
        this.scheduleHit(this.nextHitIndex, tHit);
      }
      this.nextHitIndex++;
      if (this.nextHitIndex >= this.strongOnsets.length) {
        this.nextHitIndex = 0;
        this.nextHitIter++;
      }
    }
  }

  /** Arm ONE bit-exact hit at real-time `tHit` (its onset lands exactly there). */
  private scheduleHit(strongIndex: number, tHit: number): void {
    const hit = this.hits[strongIndex];
    if (!hit) return;
    let src: AudioBufferSourceNode;
    let env: GainNode;
    try {
      src = this.ctx.createBufferSource();
      env = this.ctx.createGain();
      // Build a per-hit buffer from the stored channels (bit-exact, pitch-correct).
      const len = hit.channels[0]!.length;
      const buf = this.ctx.createBuffer(this.numCh, len, this.sr);
      for (let c = 0; c < this.numCh; c++) buf.copyToChannel(hit.channels[c]!, c);
      src.buffer = buf;
      src.playbackRate.value = 1; // NEVER pitch-shifted.
      src.connect(env);
      env.connect(this.output);
    } catch {
      return;
    }
    // The region starts leadSamples before the onset; start it so the ONSET lands at
    // tHit. Clamp the start to now (a hit at the grace edge fires from now).
    const leadSec = hit.leadSamples / this.sr;
    const startAt = Math.max(this.ctx.currentTime, tHit - leadSec);
    env.gain.value = this.muteHits ? 0 : 1;
    try {
      src.start(startAt);
    } catch {
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    const entry = { src, env };
    this.active.add(entry);
    src.addEventListener('ended', () => {
      this.active.delete(entry);
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
    });
  }

  // ── DIAGNOSTICS / ENGINE GLUE ───────────────────────────────────────────────

  /** Solo: muteBed → hear only the hits; muteHits → hear only the bed. */
  setDiagnosticSolo(opts: { muteBed?: boolean; muteOverlays?: boolean }): void {
    if (opts.muteBed !== undefined) this.muteBed = opts.muteBed;
    if (opts.muteOverlays !== undefined) this.muteHits = opts.muteOverlays;
    // Apply to the live bed immediately (the hits pick it up as they're armed).
    if (this.bedGain) {
      try {
        this.bedGain.gain.setValueAtTime(
          this.muteBed ? 0 : 1,
          this.ctx.currentTime,
        );
      } catch {
        /* ignore */
      }
    }
  }

  /** The next loop downbeat at/after `now` — the musical "one" (for key-change seam). */
  getNextDownbeat(now: number): number | null {
    const period = this.period;
    if (!this.playing || !(period > 0)) return null;
    const k = Math.floor((now - this.loopStartTime) / period);
    let next = this.loopStartTime + k * period;
    while (next < now - 1e-6) next += period;
    return next;
  }

  /** Live state for the dev A/B tool. */
  getDebugState(): {
    ratio: number;
    bedReady: boolean;
    hitsReady: boolean;
    hitCount: number;
    bedEngine: 'rate' | 'signalsmith';
  } {
    return {
      ratio: this.ratio,
      bedReady: this.bedEngine === 'signalsmith' ? !!this.bedNode : !!this.bedBuffer,
      hitsReady: this.hits.length > 0,
      hitCount: this.hits.length,
      bedEngine: this.bedEngine,
    };
  }

  /** How many big hits (for the admin panel count). */
  textureRegionCount(): number {
    return this.strongOnsets.length;
  }
}
