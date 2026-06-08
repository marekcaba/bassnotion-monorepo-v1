'use client';

/**
 * useGrooveCardKeyboard — LAUNCH-02.5g.
 *
 * Keyboard shortcuts for the groove card:
 *   ←       transpose down one semitone
 *   →       transpose up one semitone
 *   Space   play / pause
 *   M       mute / unmute the bass
 *
 * Transpose routes through the same `setKey` command the +/- stepper
 * buttons use (clamping ±KEY_RANGE, loop-boundary queueing, waitlist cap
 * telemetry all apply identically — no second code path). Space routes
 * through the same `togglePlay` the Play button uses, and M through the
 * same bass mute toggle as the mute button.
 *
 * Scope: a single global `keydown` listener. There is only ever ONE
 * groove card on a page (waitlist, /app tutorial block, admin preview),
 * so the listener is unambiguous — no active-card gating needed. Guards:
 *
 *   1. `enabled` (caller passes `isReady`) — ignore keys until the card
 *      has finished preloading, mirroring the controls' disabled state.
 *   2. typing guard — if focus is in a text input / textarea / select /
 *      contentEditable (e.g. the waitlist email field), do nothing, so we
 *      never hijack keys while someone is typing.
 *   3. button-focus guard (Space only) — if a <button> currently has
 *      focus, let the browser's native "Space activates the focused
 *      button" fire and bail, so Space doesn't DOUBLE-toggle right after
 *      the user clicked Play (which leaves that button focused).
 *
 * Modifier chords (Ctrl/Cmd/Alt + key) are left to the browser. We only
 * `preventDefault()` on a key we actually handle — so for Space that
 * suppresses the default page-scroll, while every other key (and Space
 * when a field/button owns it) keeps its normal behaviour.
 */

import { useEffect } from 'react';

interface UseGrooveCardKeyboardArgs {
  /** Current absolute semitone offset from the original key. */
  currentSemitones: number;
  /** The card's transpose command (absolute offset; self-clamping). */
  setKey: (semitonesFromOriginal: number) => void;
  /** Toggle play/pause — the same action as the Play button. */
  togglePlay: () => void;
  /** Toggle the bass mute — the same action as the bass mute button. */
  toggleBassMute: () => void;
  /** Gate — only handle keys once the card is interactive (isReady). */
  enabled: boolean;
  /** When true (Dynamic Loop engaged), the auto-cycle owns the key, so the
   *  ←/→ transpose shortcuts are inert. Space (play/pause) and M (mute) keep
   *  working. We still preventDefault on ←/→ so a locked arrow doesn't fall
   *  through to native page scrolling. */
  lockTranspose?: boolean;
}

/** True when keyboard focus is somewhere we must not hijack typing keys. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

/** True when a <button> (or button-role) currently holds focus — the
 *  browser will activate it on Space/Enter itself, so we must not also act. */
function isButtonTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'BUTTON') return true;
  if (el.getAttribute?.('role') === 'button') return true;
  return false;
}

export function useGrooveCardKeyboard({
  currentSemitones,
  setKey,
  togglePlay,
  toggleBassMute,
  enabled,
  lockTranspose = false,
}: UseGrooveCardKeyboardArgs): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Leave modifier chords to the browser (word-jump, history nav, etc.).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Never steal keys from a focused text field (waitlist email, etc.).
      if (isTypingTarget(e.target)) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Always swallow the key (keep it from scroll-jumping the page),
        // BEFORE the lock check, so a locked arrow is fully inert.
        e.preventDefault();
        // Dynamic Loop owns the key while engaged — ignore manual transposes.
        if (lockTranspose) return;
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        // setKey takes an ABSOLUTE offset and clamps internally, so stepping
        // past ±KEY_RANGE is a no-op (same as the stepper buttons).
        setKey(currentSemitones + delta);
        return;
      }

      // Space / Spacebar → play/pause. Both key values exist across
      // browsers ('Space' is the standard; ' ' is the printable fallback).
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        // If a button owns focus (e.g. just clicked Play), let its native
        // Space-activation fire — don't double-toggle.
        if (isButtonTarget(e.target)) return;
        e.preventDefault(); // suppress page scroll
        togglePlay();
        return;
      }

      // M → toggle bass mute. The typing guard above already prevents this
      // from firing while the user types "m" in a text field. M isn't a
      // browser-default action, so no preventDefault is needed.
      if (e.key === 'm' || e.key === 'M') {
        toggleBassMute();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    currentSemitones,
    setKey,
    togglePlay,
    toggleBassMute,
    lockTranspose,
  ]);
}
