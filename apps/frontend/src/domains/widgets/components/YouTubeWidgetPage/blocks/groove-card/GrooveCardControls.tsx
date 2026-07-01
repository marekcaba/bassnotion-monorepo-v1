'use client';

/**
 * GrooveCardControls — LAUNCH-02.5c.
 *
 * Bottom-row controls: Mute Bass / Key stepper / Play (center) / Tempo
 * stepper / Solo Drums. Plus a click toggle (♪) that the shell positions
 * in the top-right.
 *
 * Tempo and Key are stepper buttons (◂ value ▸) with ±1 step. The
 * caller (useGrooveCardPlayback) owns clamping; this component just
 * fires onTempoChange / onKeyChange with the next value.
 *
 * Every cap-relevant button reads `useEntitlement()` so LAUNCH-02 can
 * make the levers cap-aware without touching this component.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from 'lucide-react';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { Popover, PopoverAnchor } from '@/shared/components/ui/popover';
import type { CountdownState } from '@/domains/widgets/hooks/useCountdown';
import type { HoverHintKey } from './captions';
import { parsePitchClass, spellPitchClass, prefersFlats } from './pitchClass';

/**
 * Convert an `originalKey` label + a semitone offset into a real note-name
 * display label, e.g. "E" + 2 → "F♯", "Db" + 3 → "E", "Bb" − 2 → "A♭".
 *
 * Parses flats/sharps/glyphs on the way in; spells the result in flats when the
 * original key was a flat key (bass-friendly), sharps otherwise. Falls back to
 * a "±N" form only when the original key is genuinely unparseable.
 */
export function formatKeyLabel(
  originalKey: string,
  semitonesFromOriginal: number,
): string {
  const baseIndex = parsePitchClass(originalKey);
  if (baseIndex == null) {
    if (semitonesFromOriginal === 0) return originalKey;
    const sign = semitonesFromOriginal > 0 ? '+' : '';
    return `${originalKey} ${sign}${semitonesFromOriginal}`;
  }
  return (
    spellPitchClass(
      baseIndex + semitonesFromOriginal,
      prefersFlats(originalKey),
    ) || originalKey
  );
}

interface GrooveCardControlsProps {
  isPlaying: boolean;
  isReady: boolean;
  isLoading: boolean;
  /** Visual count-in driver. While `isCountingDown` is true and
   *  `currentBeat > 0`, the play button shows the beat number instead of
   *  the Play/Pause icon. */
  countdownState: CountdownState;
  currentBpm: number;
  currentSemitones: number;
  pendingKeyShift: number | null;
  originalKey: string;
  isBassMuted: boolean;
  isSoloDrums: boolean;
  /** Disable the Mute button (e.g. while the bass is soloed — muting the part
   *  you're soloing would just be silence). */
  muteDisabled?: boolean;
  onPlayPause: () => void;
  onTempoChange: (next: number) => void;
  onKeyChange: (next: number) => void;
  onMuteBass: (muted: boolean) => void;
  onSoloDrums: (solo: boolean) => void;
  /** Fired when a FREE user taps Solo Drums while the deconstruction cap is on.
   *  The button stays tappable (not a dead disabled control) so the cap can
   *  pitch the upgrade instead of silently doing nothing. */
  onDeconCapHit?: () => void;
  /** The in-flow upgrade pitch — a popover anchored to the control just bumped.
   *  `pitchLever` names which control to anchor to (null = closed). The parent
   *  owns the open state (set on cap-hit, cleared on dismiss). */
  pitchLever?: 'tempo' | 'transpose' | 'loopRange' | 'deconstruction' | null;
  onPitchOpenChange?: (open: boolean) => void;
  /** Rendered inside the popover when open — the message + Upgrade CTA. */
  pitchContent?: React.ReactNode;
  /** Optional hover-hint reporter. Called with a `HoverHintKey` when the
   *  pointer enters one of the labelled buttons, and `null` on leave. The
   *  parent renders the matching string in the caption row above. Pointer-
   *  only — touch users don't see hover state. */
  onHoverHint?: (next: HoverHintKey | null) => void;
  /** When true, apply the deconstruction (Solo Drums) cap from entitlement.
   *  Only the drill surface opts in; tutorial/marketing surfaces leave it
   *  off so Solo Drums stays available there regardless of tier. */
  enforceCaps?: boolean;
  /** When true (drill bricks), the key + tempo are PRESCRIBED by the author —
   *  the steppers render disabled (read-only) so the student practices exactly
   *  the prescribed setup ("do exactly this"). */
  lockSettings?: boolean;
  /** When true (Dynamic Loop engaged), ONLY the key stepper is locked — the
   *  auto-cycle owns the key, so manual transposes are disabled. Tempo stays
   *  free. Separate from lockSettings (which also locks tempo). */
  lockKey?: boolean;
  /** The NEXT key the Dynamic Loop will move to (note-name label, e.g. "E"), or
   *  null when not cycling. Rendered as a green letter after a "→" arrow inside
   *  the key stepper, so the player can anticipate the change. */
  nextKeyLabel?: string | null;
  /** The effective transpose edge (absolute semitones): the engine's ±6, or the
   *  entitlement band when the user is capped. Used to DIM the key chevron at
   *  the edge so a member who's hit ±6 (the real end of the range — there is no
   *  ±7) sees a disabled control, not the upgrade pitch. */
  transposeRange: number;
  /** True when the transpose edge is the entitlement BAND (free tier), not the
   *  engine. In that case the chevron stays ENABLED at the edge so bumping it
   *  fires the upgrade pitch (the cap IS the CTA). When false (member), the
   *  chevron dims at the engine edge instead. */
  transposeCapped?: boolean;
  /** When true, the tempo + transpose chevrons GREY OUT (disable) once the
   *  value reaches the entitlement band edge, instead of staying enabled to
   *  fire the upsell. The public `/free` funnel opts in: the cap is shown as a
   *  dead control + a revealed Sign up button, not an in-card pitch. Default
   *  false preserves the in-app "teaching moment" (live chevron at the edge).
   *  Needs `originalBpm` to locate the tempo band centre. */
  dimAtCap?: boolean;
  /** The groove's default BPM — the centre of the tempo band. Only needed to
   *  compute the tempo cap edges for `dimAtCap`. */
  originalBpm?: number;
}

export function GrooveCardControls({
  isPlaying,
  isReady,
  isLoading,
  countdownState,
  currentBpm,
  currentSemitones,
  pendingKeyShift,
  originalKey,
  isBassMuted,
  isSoloDrums,
  muteDisabled = false,
  onPlayPause,
  onTempoChange,
  onKeyChange,
  onMuteBass,
  onSoloDrums,
  onDeconCapHit,
  pitchLever,
  onPitchOpenChange,
  pitchContent,
  onHoverHint,
  enforceCaps = false,
  lockSettings = false,
  lockKey = false,
  nextKeyLabel = null,
  transposeRange,
  transposeCapped = false,
  dimAtCap = false,
  originalBpm,
}: GrooveCardControlsProps) {
  // Cap-aware hook reads — LAUNCH-02 will populate these.
  const { caps } = useEntitlement();

  // While the Dynamic Loop drives the key (lockKey), show the ACTUAL current
  // key and suppress the manual "queued" affordances — the green next-key
  // preview chip is the proper "change incoming" signal there. pendingKeyShift
  // is set on every auto-cycle setKey, so honouring it here would make the
  // stepper jump ahead to the next key and pin a permanent "…".
  const displayedSemitones = lockKey
    ? currentSemitones
    : (pendingKeyShift ?? currentSemitones);
  const keyLabel = formatKeyLabel(originalKey, displayedSemitones);

  // Edge-dim the key chevrons. When the user is NOT capped (a member), the
  // transpose edge is the engine's hard ±6 — there is no further to go, so the
  // chevron at that edge is disabled (dimmed), NOT a hidden upsell trigger. When
  // capped (free tier), the chevron normally stays ENABLED at the band edge so
  // bumping it surfaces the upgrade pitch (the cap is the CTA) — UNLESS the
  // surface opts into `dimAtCap` (the /free funnel), which greys the chevron at
  // the band edge instead and reveals its own Sign up button.
  const atUpperKeyEdge =
    (!transposeCapped || dimAtCap) &&
    !lockKey &&
    currentSemitones >= transposeRange;
  const atLowerKeyEdge =
    (!transposeCapped || dimAtCap) &&
    !lockKey &&
    currentSemitones <= -transposeRange;

  // Tempo cap edges — only computed for `dimAtCap` (the funnel). The band is
  // [originalBpm − limit, originalBpm + limit]; grey the matching chevron once
  // the displayed BPM reaches an edge. In-app leaves these false (the tempo
  // chevrons there never edge-dim — the cap fires the pitch instead).
  const tempoLimit = caps.tempo.isCapped ? caps.tempo.limit : undefined;
  const tempoBandHi =
    dimAtCap && tempoLimit != null && originalBpm != null
      ? originalBpm + tempoLimit
      : undefined;
  const tempoBandLo =
    dimAtCap && tempoLimit != null && originalBpm != null
      ? originalBpm - tempoLimit
      : undefined;
  const atUpperTempoEdge = tempoBandHi != null && currentBpm >= tempoBandHi;
  const atLowerTempoEdge = tempoBandLo != null && currentBpm <= tempoBandLo;

  // Band levers (tempo/transpose) are NOT disabled when capped — they stay
  // enabled so the user can move WITHIN the band and bump the edge (the
  // engine clamps to the band and fires the cap-hit upsell). Disabling them
  // would hide the teaching moment. Mute is never capped. Only deconstruction
  // (solo drums) is a hard on/off gate.
  const deconCapped = enforceCaps && caps.deconstruction.isCapped;

  // Hover hint helper. PointerEvent unifies mouse / pen / touch; we filter
  // out 'touch' so taps don't briefly flash a hint before the tap action's
  // own reactive caption replaces it.
  const hoverProps = (key: HoverHintKey) =>
    onHoverHint
      ? {
          onPointerEnter: (e: ReactPointerEvent) => {
            if (e.pointerType === 'touch') return;
            onHoverHint(key);
          },
          onPointerLeave: () => onHoverHint(null),
        }
      : {};

  // One Popover for the whole row; the active lever provides the anchor so the
  // pitch pops FROM the control just bumped. A non-matching lever renders the
  // control plain. `transpose` anchors to the Key control, `tempo`/`loopRange`/
  // `deconstruction` to theirs.
  const anchorIf = (
    lever: 'tempo' | 'transpose' | 'loopRange' | 'deconstruction',
    node: React.ReactNode,
  ) =>
    pitchLever === lever ? <PopoverAnchor asChild>{node}</PopoverAnchor> : node;

  return (
    <Popover
      open={pitchLever != null}
      onOpenChange={(o) => onPitchOpenChange?.(o)}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black/40 rounded-b-xl">
        {anchorIf(
          'deconstruction',
          <button
            type="button"
            onClick={() =>
              deconCapped ? onDeconCapHit?.() : onSoloDrums(!isSoloDrums)
            }
            // When capped, stay enabled so the tap pitches the upgrade (the cap
            // is the pitch); only truly disable while the card isn't ready yet.
            disabled={!isReady}
            aria-pressed={isSoloDrums}
            aria-label="Solo drums"
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isSoloDrums
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            } ${
              // In-app gives the capped Solo a subtle dim as a "special" cue.
              // The funnel (dimAtCap) keeps it fully live — no lock cues there;
              // clicking it simply reveals the Sign up button.
              deconCapped && !dimAtCap ? 'opacity-60' : ''
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            {...hoverProps('solo-drums')}
          >
            Solo
          </button>,
        )}

        {anchorIf(
          'transpose',
          <div {...hoverProps('key')}>
            <Stepper
              label={keyLabel}
              // The key value is a note name; render it as an anchored letter so
              // it doesn't shift when an accidental (♯/♭) is added. A pending
              // change shows by the letter itself updating — no "…" suffix.
              labelKind="note"
              onPrev={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) - 1)
              }
              onNext={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) + 1)
              }
              disabled={!isReady || lockSettings || lockKey}
              // Dim the chevron at the engine edge for an uncapped (member)
              // user — ±6 is the end of the range, not a paywall. ← lowers the
              // key (prev), → raises it (next).
              disablePrev={atLowerKeyEdge}
              disableNext={atUpperKeyEdge}
              ariaLabel="Key"
              // Dynamic Loop: the upcoming key (green) shown after the arrow so
              // the player can anticipate the change.
              nextKeyLabel={nextKeyLabel}
              // Roller-wheel neighbours: the keys ±offset semitones from the current one, so
              // the wheel shows the adjacent keys sliding through (e.g. D♯ ‹ E › F).
              neighborFor={(offset) =>
                formatKeyLabel(originalKey, displayedSemitones + offset)
              }
            />
          </div>,
        )}

        <button
          type="button"
          onClick={onPlayPause}
          disabled={!isReady}
          // Play button never shows a focus ring (its space shortcut is the
          // dedicated control; a ring would clash with the design).
          data-no-focus-ring
          aria-label={
            countdownState.isCountingDown && countdownState.currentBeat > 0
              ? `Countdown beat ${countdownState.currentBeat}`
              : isPlaying
                ? 'Pause'
                : 'Play'
          }
          className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-400 transition-colors focus:outline-none focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          {...hoverProps(isPlaying ? 'play-pause-pause' : 'play-pause-play')}
        >
          {isLoading ? (
            <span className="text-[10px] uppercase tracking-wider">
              Loading
            </span>
          ) : countdownState.isCountingDown &&
            countdownState.currentBeat > 0 ? (
            // Count-in: show "1", "2", "3", "4" inside the button. Same UX
            // pattern as the YouTube tutorial player (PlaybackControlsBar).
            <span className="text-2xl font-bold leading-none" aria-hidden>
              {countdownState.currentBeat}
            </span>
          ) : isPlaying ? (
            <Pause className="w-6 h-6" aria-hidden />
          ) : (
            <Play className="w-6 h-6 ml-0.5" aria-hidden />
          )}
        </button>

        {anchorIf(
          'tempo',
          <div {...hoverProps('tempo')}>
            <Stepper
              label={`${currentBpm}`}
              suffix=" BPM"
              onPrev={() => onTempoChange(currentBpm - 1)}
              onNext={() => onTempoChange(currentBpm + 1)}
              disabled={!isReady || lockSettings}
              // dimAtCap (the /free funnel): grey the matching chevron once the
              // tempo reaches the band edge. In-app leaves both false.
              disablePrev={atLowerTempoEdge}
              disableNext={atUpperTempoEdge}
              ariaLabel="Tempo"
              // Roller-wheel neighbours: the BPM values ±offset, so the wheel shows the
              // adjacent tempos sliding through (e.g. 119 ‹ 120 › 121).
              neighborFor={(offset) => `${currentBpm + offset}`}
            />
          </div>,
        )}

        <button
          type="button"
          onClick={() => onMuteBass(!isBassMuted)}
          disabled={!isReady || muteDisabled}
          aria-pressed={isBassMuted}
          aria-label="Mute bass"
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isBassMuted
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          {...hoverProps('mute-bass')}
        >
          Mute
        </button>
      </div>
      {pitchContent}
    </Popover>
  );
}

/**
 * KeyChangeDisplay — the animated "current → next" key indicator shown inside
 * the key stepper while the Dynamic Loop cycles. Stable layout: a fixed central
 * arrow ("we go to here") with a bare letter on each side — green CURRENT key
 * (playing now), muted NEXT key, no pill/rectangle/count. When the cycle
 * advances, EACH letter
 * crossfades to its new value (the departing letter eases out + drifts, the new
 * one eases in), so the whole indicator reads as the keys travelling forward.
 */
function KeyChangeDisplay({
  currentLabel,
  nextLabel,
}: {
  currentLabel: string;
  nextLabel: string;
}) {
  return (
    <span
      className="flex items-center justify-center gap-1.5 text-center"
      aria-label={`Current key ${currentLabel}, next key ${nextLabel}`}
    >
      {/* CURRENT key is green (what's playing now); NEXT is muted. */}
      <AnimatedLetter label={currentLabel} className="text-emerald-300" />
      <ArrowRight className="w-3.5 h-3.5 text-white/40 shrink-0" aria-hidden />
      <AnimatedLetter label={nextLabel} className="text-white/50" />
    </span>
  );
}

/**
 * AnimatedLetter — a single key letter that crossfades when its value changes:
 * the departing letter eases out (drifting left), the new one eases in. The slot
 * has a FIXED width (sized for a 2-glyph key like "D♭") and centers its content,
 * so single-char keys ("E") and flat/sharp keys ("D♭") occupy the same space and
 * the letters never shift horizontally as the key changes — the central arrow
 * stays put. Both the live and departing letters are absolutely centered so
 * neither drives the box width.
 */
function AnimatedLetter({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const prevRef = useRef(label);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (prevRef.current === label) return undefined;
    const departing = prevRef.current;
    prevRef.current = label;
    setLeaving(departing);
    const t = setTimeout(() => setLeaving(null), 200);
    return () => clearTimeout(t);
  }, [label]);

  return (
    <span className="relative inline-flex h-5 w-8 shrink-0 items-center justify-center">
      <span
        key={`in-${label}`}
        className={`absolute inset-0 flex items-center justify-center text-base font-semibold leading-none animate-key-arrive ${className}`}
      >
        {label}
      </span>
      {leaving && leaving !== label && (
        <span
          key={`out-${leaving}`}
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center text-base font-semibold leading-none animate-key-leave ${className}`}
        >
          {leaving}
        </span>
      )}
    </span>
  );
}

/**
 * NoteLabel — a key note name where the BASE LETTER is centered between the
 * stepper arrows and any accidental (♯/♭) hangs off the letter's RIGHT without
 * affecting that centering. The accidental is absolutely positioned at the
 * letter's right edge, so "C" and "C♯" keep the SAME centered letter position —
 * the letter never shifts when an accidental appears; only the glyph is added.
 */
function NoteLabel({ label }: { label: string }) {
  // Split the leading note letter (A-G, case-insensitive) from any accidental
  // glyph(s). A non-note fallback label (e.g. "E +3") renders as-is in the base.
  const m = /^([A-Ga-g])(.*)$/.exec(label);
  const base = m ? m[1] : label;
  const accidental = m ? m[2] : '';
  return (
    <span className="flex items-center justify-center">
      {/* The base letter is centered; the accidental is absolutely placed at its
          right edge so it doesn't push the letter off-center. */}
      <span className="relative inline-flex items-center justify-center text-base font-semibold text-white">
        <span>{base}</span>
        {accidental ? (
          <span className="absolute left-full top-0">{accidental}</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * RollerStrip — the HORIZONTAL port of the gym RollerPicker's wheel. This is what makes the
 * roller READ as a wheel (rather than a crossfade): it renders a STRIP of cells — the prev
 * and next values flanking the current one — and on a step the WHOLE STRIP slides one cell so
 * a real NEIGHBOUR slides into the bright centre while the current value slides out to a
 * faded edge. A fixed gradient-mask LENS (opaque centre band → transparent edges, left↔right)
 * stays put; values flow through it. After the slide it snaps back to centre with NO
 * transition and commits the new value (onStep) — invisible because the values shifted in
 * lockstep. Identical mechanism to the vertical roller, just translateX + a left/right mask.
 *
 * `neighborFor(offset)` returns the label `offset` cells from centre (−2..+2). `renderCell`
 * renders one label (a NoteLabel for keys, plain text for tempo). `onStep(dir)` commits the
 * value change (dir −1 prev / +1 next) AFTER the slide, so the parent's new `currentLabel`
 * is already the value that slid into centre.
 */
const ROLLER_MS = 320;
const ROLLER_EASING = 'ease-in-out';

/** The handle a Stepper holds to drive its strip's slide from the chevrons. */
export interface RollerStripHandle {
  step: (dir: number) => void;
}

const RollerStrip = forwardRef<
  RollerStripHandle,
  {
    currentLabel: string;
    neighborFor: (offset: number) => string;
    renderCell: (label: string) => React.ReactNode;
    /** Commit the value change after the slide (the deferred onPrev/onNext). dir: −1 | +1. */
    onStepCommit: (dir: number) => void;
    cellWidthPx: number;
  }
>(function RollerStrip(
  { currentLabel, neighborFor, renderCell, onStepCommit, cellWidthPx },
  ref,
) {
  // offset in CELLS: 0 = centred. A step sets ±1 (animated); on transition-end we commit the
  // value and reset to 0 (no animation) — exactly the vertical roller's spin/snap dance.
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const animatingRef = useRef(false);
  animatingRef.current = animating;
  const pendingRef = useRef<null | (() => void)>(null);
  const safetyTimerRef = useRef<number | null>(null);

  // Commit the deferred value change + snap back to centre. Idempotent: guarded by the
  // pending callback so the transitionend handler and the safety timeout can't double-fire it.
  const settle = () => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    const commit = pendingRef.current;
    pendingRef.current = null;
    if (!commit) return;
    commit();
    setAnimating(false);
    setOffset(0);
  };

  // NEXT (dir +1) reveals the value to the RIGHT → the strip moves LEFT (offset −1).
  useImperativeHandle(ref, () => ({
    step: (dir: number) => {
      if (animatingRef.current) return;
      setAnimating(true);
      pendingRef.current = () => onStepCommit(dir);
      setOffset(-dir);
      // Safety net: if transitionend never fires (reduced-motion, a dropped frame, a
      // backgrounded tab), settle anyway so the value still commits and the strip re-arms.
      safetyTimerRef.current = window.setTimeout(settle, ROLLER_MS + 80);
    },
  }));

  useEffect(
    () => () => {
      if (safetyTimerRef.current !== null)
        window.clearTimeout(safetyTimerRef.current);
    },
    [],
  );

  const onTransitionEnd = () => settle();

  // 5 cells: prev2 | prev | CURRENT | next | next2. The outer two are BUFFER so a value always
  // covers the viewport edge mid-slide (the cell sliding in isn't blank until snap).
  const cells = [
    neighborFor(-2),
    neighborFor(-1),
    currentLabel,
    neighborFor(1),
    neighborFor(2),
  ];
  const CENTER = 2;
  // The VIEWPORT is exactly ONE cell wide — the visible footprint is just the current value,
  // so the control doesn't spread open with neighbours sitting beside it (the bug we're
  // fixing). The other cells overflow OUTSIDE this slot (clipped); they're invisible at rest
  // and only seen as they swipe THROUGH the slot during a step. So a value slides FROM/TO the
  // fixed centre rather than living next to it — for both key and tempo identically.
  const viewportPx = cellWidthPx;

  // Gradient LENS (left→right): solid through the centre, fading to transparent at the two
  // edges, so the incoming value fades IN at the edge as it arrives and the outgoing fades OUT
  // as it leaves — the "swipe" dissolve. The solid core is wide (most of the cell) so the
  // resting value is crisp; only the outer ~22% on each side feathers.
  const EDGE = 22; // % of the slot that feathers on each side
  const curve = (t: number) => Math.pow(1 - t, 2.2);
  const stopsArr = [0, 0.25, 0.5, 0.75, 1];
  const leftStops = stopsArr
    .map((t) => `rgba(0,0,0,${curve(t).toFixed(3)}) ${(EDGE * (1 - t)).toFixed(2)}%`)
    .reverse()
    .join(', ');
  const rightStops = stopsArr
    .map(
      (t) =>
        `rgba(0,0,0,${curve(t).toFixed(3)}) ${(100 - EDGE + EDGE * t).toFixed(2)}%`,
    )
    .join(', ');
  const maskGradient = `linear-gradient(to right, ${leftStops}, #000 ${EDGE}%, #000 ${100 - EDGE}%, ${rightStops})`;

  return (
    <div
      style={{
        width: viewportPx,
        height: 24,
        overflow: 'hidden',
        position: 'relative',
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
    >
      <div
        onTransitionEnd={onTransitionEnd}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          // The viewport is ONE cell wide (its left edge = x 0). The strip's CENTER cell must
          // sit there, so shift the strip left by CENTER cells — the prev cells then hang off
          // to the left (clipped) and the next cells off to the right (clipped), ready to
          // swipe in. The lower cells stay in the DOM as the slide buffer.
          left: -CENTER * cellWidthPx,
          display: 'flex',
          flexDirection: 'row',
          transform: `translateX(${offset * cellWidthPx}px)`,
          transition: animating
            ? `transform ${ROLLER_MS}ms ${ROLLER_EASING}`
            : 'none',
        }}
      >
        {cells.map((c, i) => (
          <div
            key={`${i}-${c}`}
            style={{
              width: cellWidthPx,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {renderCell(c)}
          </div>
        ))}
      </div>
    </div>
  );
});

export interface StepperProps {
  label: string;
  suffix?: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  ariaLabel: string;
  /** 'note' renders the label as a note name with the BASE letter anchored in a
   *  fixed slot and any accidental (♯/♭) hanging off its right, so the letter
   *  never shifts when an accidental is added/removed. 'text' (default) renders
   *  the label centered with its suffix (e.g. tempo "100 BPM"). */
  labelKind?: 'note' | 'text';
  /** Per-direction disable for the range EDGE (dim just the prev or next
   *  chevron when there's no further to go). Combined with the whole-stepper
   *  `disabled`. */
  disablePrev?: boolean;
  disableNext?: boolean;
  /** Dynamic Loop: the upcoming key shown in green after the arrow. Null when
   *  not cycling (then the plain stepper renders). */
  nextKeyLabel?: string | null;
  /** Width (in ch) of the text-label slot. Default 3 — sized for tempo numbers.
   *  Wider text labels (e.g. "Major", "Pos 1") pass a larger value so they don't
   *  wrap or shift neighbours. Only affects labelKind='text'. */
  labelWidthCh?: number;
  /** Return the label `offset` cells from the current value (−2..+2). When provided, the
   *  value renders as the animated ROLLER WHEEL (neighbours visible at the faded edges, the
   *  strip slides one cell per step). When omitted, a plain static label renders. The Dynamic
   *  Loop branch (nextKeyLabel) always uses its own KeyChangeDisplay regardless. */
  neighborFor?: (offset: number) => string;
  /** Press-and-hold to AUTO-REPEAT (accelerating), for continuous ranges like tempo where
   *  stepping one tap at a time is tedious. A TAP behaves exactly like a normal step (one
   *  animated slide); only a genuine hold kicks in fast repeat (committing values directly,
   *  bypassing the per-step slide). Default off — discrete pickers (key) would overshoot. */
  holdRepeat?: boolean;
}

export function Stepper({
  label,
  suffix,
  onPrev,
  onNext,
  disabled,
  ariaLabel,
  labelKind = 'text',
  disablePrev = false,
  disableNext = false,
  nextKeyLabel = null,
  labelWidthCh = 3,
  neighborFor,
  holdRepeat = false,
}: StepperProps) {
  // The strip handle — chevrons drive its slide; the value commit (onPrev/onNext) is deferred
  // until the slide completes so the parent's new label is the value that slid into centre.
  const stripRef = useRef<RollerStripHandle>(null);
  const animate = neighborFor != null;
  // dir → the deferred commit the strip fires after sliding.
  const commit = (dir: number) => (dir < 0 ? onPrev() : onNext());

  // One animated step (a tap): slide the wheel, which commits on transition-end. Falls back to
  // a direct commit when not animating.
  const slideStep = (dir: number) =>
    animate && stripRef.current ? stripRef.current.step(dir) : commit(dir);

  // ── Press-and-hold auto-repeat (holdRepeat) ──────────────────────────────────
  // A TAP = one normal slideStep. A genuine HOLD (button still down past the threshold) kicks
  // in an accelerating direct-commit repeat — bypassing the per-step slide so fast scrubbing
  // doesn't queue dozens of slides. Mirrors the gym RollerPicker's tap-vs-hold split.
  const HOLD_THRESHOLD = 350; // ms held before fast repeat starts
  const holdTimerRef = useRef<number | null>(null);
  const handlersRef = useRef({ onPrev, onNext });
  handlersRef.current = { onPrev, onNext };
  const stopHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  useEffect(() => stopHold, []);
  const startHold = (dir: number) => {
    if (disabled) return;
    slideStep(dir); // the same animated step a plain tap does
    let delay = 200; // repeat cadence once auto-repeat starts
    const tick = () => {
      delay = Math.max(45, delay * 0.82); // accelerate, floor ~22/sec
      commit(dir); // direct commit during the fast repeat (no slide queue)
      holdTimerRef.current = window.setTimeout(tick, delay);
    };
    holdTimerRef.current = window.setTimeout(tick, HOLD_THRESHOLD);
  };

  // Chevron wiring: hold-repeat uses pointer events (down starts, up/leave/cancel stops);
  // otherwise a plain click does one animated step.
  const prevHandlers = holdRepeat
    ? {
        onPointerDown: () => startHold(-1),
        onPointerUp: stopHold,
        onPointerLeave: stopHold,
        onPointerCancel: stopHold,
      }
    : { onClick: () => slideStep(-1) };
  const nextHandlers = holdRepeat
    ? {
        onPointerDown: () => startHold(1),
        onPointerUp: stopHold,
        onPointerLeave: stopHold,
        onPointerCancel: stopHold,
      }
    : { onClick: () => slideStep(1) };

  // Cell width = the VISIBLE FOOTPRINT (the viewport is one cell). Sized to hold the glyph
  // plus a little edge room for the swipe feather — NOT extra-wide (the viewport clips the
  // neighbours regardless, so width is purely the resting footprint). Note keeps its 84px
  // (a comfortable letter slot); tempo is snug to its digits (~17px/ch + padding) so the
  // control isn't spread open.
  const cellWidthPx =
    labelKind === 'note' ? 84 : Math.round(labelWidthCh * 17) + 8;
  const renderNote = (v: string) => <NoteLabel label={v} />;
  const renderText = (v: string) => (
    <span className="text-base font-semibold text-white tabular-nums">{v}</span>
  );

  return (
    <div className="flex items-center gap-1" aria-label={ariaLabel}>
      <button
        type="button"
        {...prevHandlers}
        disabled={disabled || disablePrev}
        aria-label={`${ariaLabel} down`}
        className="touch-none select-none p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
      </button>
      {/* Key label lives in a FIXED-WIDTH slot sized for the WIDER engaged
          state ("current → next"), so engaging the Dynamic Loop — which swaps
          the plain key letter for the animated KeyChangeDisplay — doesn't change
          the stepper's footprint and shove the neighbouring controls. */}
      {labelKind === 'note' ? (
        <span className="flex w-[84px] items-center justify-center">
          {nextKeyLabel ? (
            // Dynamic Loop's own crossfading current→next display (already animated).
            <KeyChangeDisplay currentLabel={label} nextLabel={nextKeyLabel} />
          ) : animate ? (
            // Plain key as the roller WHEEL — neighbour keys visible + sliding, accidental-
            // centred (NoteLabel) in each cell.
            <RollerStrip
              ref={stripRef}
              currentLabel={label}
              neighborFor={neighborFor!}
              renderCell={renderNote}
              onStepCommit={commit}
              cellWidthPx={cellWidthPx}
            />
          ) : (
            <NoteLabel label={label} />
          )}
        </span>
      ) : (
        // FIXED-WIDTH numeric label: the value sits in a constant-width, tabular-figures slot
        // so 2↔3 digit changes (99↔100) don't reflow the suffix or the neighbours. The value
        // rides the roller wheel; the suffix ("BPM") is a fixed element after it.
        <span className="flex items-center justify-center text-base font-semibold text-white">
          {animate ? (
            <RollerStrip
              ref={stripRef}
              currentLabel={label}
              neighborFor={neighborFor!}
              renderCell={renderText}
              onStepCommit={commit}
              cellWidthPx={cellWidthPx}
            />
          ) : (
            <span
              className="inline-block whitespace-nowrap tabular-nums"
              style={{
                width: `${labelWidthCh}ch`,
                textAlign: labelWidthCh > 3 ? 'center' : 'right',
              }}
            >
              {label}
            </span>
          )}
          {suffix && <span className="ml-1.5">{suffix.trim()}</span>}
        </span>
      )}
      <button
        type="button"
        {...nextHandlers}
        disabled={disabled || disableNext}
        aria-label={`${ariaLabel} up`}
        className="touch-none select-none p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
